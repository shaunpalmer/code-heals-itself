"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
/**
 * Minimal built-in HTTP server for ecosystem integration.
 * No external deps (uses Node http/url). Safe to run alongside tests.
 *
 * Endpoints:
 * - POST /api/debug/run
 * - GET  /api/envelopes/:id
 * - GET  /api/history/similar?message=...&code=...
 * - POST /api/chat/:session/message
 * - GET  /api/openapi.json
 */
const http_1 = __importDefault(require("http"));
const url_1 = require("url");
const ai_debugging_1 = require("../../ai-debugging");
const confidence_scoring_1 = require("../../utils/typescript/confidence_scoring");
const memory_adapter_1 = __importDefault(require("../../utils/typescript/memory_adapter"));
// Singleton debugger and ephemeral stores for API runs
const debuggerInstance = new ai_debugging_1.AIDebugger();
const envelopes = new Map();
const chatSessions = new Map();
function getChat(sessionId) {
    const id = sessionId || 'default';
    let chat = chatSessions.get(id);
    if (!chat) {
        chat = new memory_adapter_1.default(debuggerInstance.memory || debuggerInstance._memory, id);
        chatSessions.set(id, chat);
    }
    return chat;
}
function json(res, status, body) {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(payload);
}
function notFound(res) {
    json(res, 404, { error: 'Not Found' });
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
async function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        req.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            if (!raw)
                return resolve({});
            try {
                resolve(JSON.parse(raw));
            }
            catch (e) {
                reject(new Error('Invalid JSON body'));
            }
        });
        req.on('error', reject);
    });
}
function openApiSpec(origin) {
    return {
        openapi: '3.0.3',
        info: { title: 'Self-Healing Debugger API', version: '0.1.0' },
        servers: [{ url: origin.replace(/\/$/, '') }],
        paths: {
            '/api/debug/run': {
                post: {
                    summary: 'Run a debug attempt',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        error_type: { type: 'string', enum: ['SYNTAX', 'LOGIC', 'RUNTIME', 'PERFORMANCE', 'SECURITY'] },
                                        message: { type: 'string' },
                                        patch_code: { type: 'string' },
                                        original_code: { type: 'string' },
                                        logits: { type: 'array', items: { type: 'number' } },
                                        sessionId: { type: 'string' },
                                        maxAttempts: { type: 'integer', minimum: 1, default: 1 }
                                    },
                                    required: ['error_type', 'message', 'patch_code', 'original_code']
                                }
                            }
                        }
                    },
                    responses: {
                        '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object' } } } }
                    }
                }
            },
            '/api/envelopes/{id}': {
                get: {
                    summary: 'Fetch an envelope by id',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } }
                }
            },
            '/api/history/similar': {
                get: {
                    summary: 'Find similar outcomes',
                    parameters: [
                        { name: 'message', in: 'query', schema: { type: 'string' } },
                        { name: 'code', in: 'query', schema: { type: 'string' } }
                    ],
                    responses: { '200': { description: 'OK' } }
                }
            },
            '/api/chat/{session}/message': {
                post: {
                    summary: 'Mirror an external chat message',
                    parameters: [{ name: 'session', in: 'path', required: true, schema: { type: 'string' } }],
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { type: 'object', properties: { role: { type: 'string' }, content: {}, meta: { type: 'object' } }, required: ['role', 'content'] } } }
                    },
                    responses: { '204': { description: 'No Content' } }
                }
            }
        }
    };
}
function startServer(port = Number(process.env.PORT) || 8787) {
    const server = http_1.default.createServer(async (req, res) => {
        var _a, _b, _c, _d;
        // CORS preflight
        if (req.method === 'OPTIONS') {
            res.writeHead(204, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            });
            return res.end();
        }
        const url = new url_1.URL(req.url || '/', `http://${req.headers.host}`);
        try {
            if (req.method === 'GET' && url.pathname === '/api/openapi.json') {
                return json(res, 200, openApiSpec(`${url.origin}`));
            }
            if (req.method === 'POST' && url.pathname === '/api/debug/run') {
                const body = await readBody(req);
                const errorType = toErrorType(body.error_type);
                const message = String(body.message || '');
                const patch_code = String(body.patch_code || '');
                const original_code = String(body.original_code || '');
                const logits = Array.isArray(body.logits) ? body.logits.map((n) => Number(n)).filter((n) => Number.isFinite(n)) : [];
                const sessionId = body.sessionId ? String(body.sessionId) : undefined;
                const maxAttempts = Math.max(1, Number(body.maxAttempts) || 1);
                if (!message || !patch_code || !original_code) {
                    return json(res, 400, { error: 'Missing required fields: message, patch_code, original_code' });
                }
                const chat = getChat(sessionId);
                const result = await debuggerInstance.attemptWithBackoff(errorType, message, patch_code, original_code, logits, { maxAttempts, sessionId, chatAdapter: chat });
                try {
                    if ((_a = result === null || result === void 0 ? void 0 : result.envelope) === null || _a === void 0 ? void 0 : _a.patch_id)
                        envelopes.set(result.envelope.patch_id, result.envelope);
                }
                catch { }
                return json(res, 200, result);
            }
            if (req.method === 'GET' && url.pathname.startsWith('/api/envelopes/')) {
                const id = url.pathname.split('/').pop() || '';
                const env = envelopes.get(id);
                if (!env)
                    return notFound(res);
                return json(res, 200, env);
            }
            if (req.method === 'GET' && url.pathname === '/api/history/similar') {
                const message = url.searchParams.get('message') || undefined;
                const code = url.searchParams.get('code') || undefined;
                const items = ((_c = (_b = debuggerInstance.memory) === null || _b === void 0 ? void 0 : _b.getSimilarOutcomes) === null || _c === void 0 ? void 0 : _c.call(_b, { message, code })) || [];
                return json(res, 200, items);
            }
            if (req.method === 'POST' && url.pathname.startsWith('/api/chat/')) {
                const parts = url.pathname.split('/'); // ['', 'api', 'chat', ':session', 'message']
                const session = parts[3];
                const tail = parts[4];
                if (tail === 'message' && session) {
                    const body = await readBody(req);
                    const role = String(body.role || 'user');
                    const content = (_d = body.content) !== null && _d !== void 0 ? _d : '';
                    const meta = typeof body.meta === 'object' && body.meta ? body.meta : {};
                    const chat = getChat(session);
                    await Promise.resolve(chat.addMessage(role, content, meta));
                    res.writeHead(204, {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type'
                    });
                    return res.end();
                }
            }
            return notFound(res);
        }
        catch (err) {
            return json(res, 500, { error: (err === null || err === void 0 ? void 0 : err.message) || 'Internal Server Error' });
        }
    });
    server.listen(port, () => {
        // eslint-disable-next-line no-console
        console.log(`[api] listening on http://localhost:${port}`);
    });
    return server;
}
// Auto-start if executed directly (node dist/server/api.js)
if (require.main === module) {
    startServer();
}
