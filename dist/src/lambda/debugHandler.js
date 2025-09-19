"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
// AWS Lambda handler exposing the debug.run functionality via API Gateway (proxy integration)
const ai_debugging_1 = require("../../ai-debugging");
const confidence_scoring_1 = require("../../utils/typescript/confidence_scoring");
const memory_adapter_1 = __importDefault(require("../../utils/typescript/memory_adapter"));
const debuggerInstance = new ai_debugging_1.AIDebugger();
const chats = new Map();
function getChat(id) {
    let c = chats.get(id);
    if (!c) {
        c = new memory_adapter_1.default(debuggerInstance.memory || debuggerInstance._memory, id);
        chats.set(id, c);
    }
    return c;
}
function toErrorType(s) {
    switch ((s || '').toUpperCase()) {
        case 'SYNTAX': return confidence_scoring_1.ErrorType.SYNTAX;
        case 'LOGIC': return confidence_scoring_1.ErrorType.LOGIC;
        case 'RUNTIME': return confidence_scoring_1.ErrorType.RUNTIME;
        case 'PERFORMANCE': return confidence_scoring_1.ErrorType.PERFORMANCE;
        case 'SECURITY': return confidence_scoring_1.ErrorType.SECURITY;
        default: return confidence_scoring_1.ErrorType.SYNTAX;
    }
}
const handler = async (event) => {
    try {
        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: 'Method Not Allowed' }) };
        }
        const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
        const errorType = toErrorType(body.error_type);
        const message = String(body.message || '');
        const patch_code = String(body.patch_code || '');
        const original_code = String(body.original_code || '');
        if (!message || !patch_code || !original_code) {
            return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Missing required fields' }) };
        }
        const logits = Array.isArray(body.logits) ? body.logits : [];
        const sessionId = body.sessionId ? String(body.sessionId) : undefined;
        const maxAttempts = Math.max(1, Number(body.maxAttempts) || 1);
        const chat = getChat(sessionId || 'default');
        const result = await debuggerInstance.attemptWithBackoff(errorType, message, patch_code, original_code, logits, { maxAttempts, sessionId, chatAdapter: chat });
        return { statusCode: 200, headers: cors(), body: JSON.stringify(result) };
    }
    catch (e) {
        return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: (e === null || e === void 0 ? void 0 : e.message) || 'Internal Error' }) };
    }
};
exports.handler = handler;
function cors() {
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };
}
