"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const envelope_1 = require("../../utils/typescript/envelope");
const memory_adapter_1 = __importDefault(require("../../utils/typescript/memory_adapter"));
const ai_debugging_1 = require("../../ai-debugging");
const confidence_scoring_1 = require("../../utils/typescript/confidence_scoring");
(0, globals_1.describe)('ChatMessageHistoryAdapter', () => {
    (0, globals_1.it)('preserves insertion order and respects limit', () => {
        const buf = new envelope_1.ResilientMemoryBuffer(50);
        const chat = new memory_adapter_1.default(buf, 'thread-1');
        chat.addMessage('system', 'system prompt');
        chat.addMessage('user', 'u1');
        chat.addMessage('ai', 'a1');
        chat.addMessage('tool', 't1');
        const all = chat.getMessages();
        (0, globals_1.expect)(all.map(m => m.role)).toEqual(['system', 'user', 'ai', 'tool']);
        const last2 = chat.getMessages(2);
        (0, globals_1.expect)(last2.map(m => m.role)).toEqual(['ai', 'tool']);
    });
    (0, globals_1.it)('mirrors to external adapter when provided', async () => {
        const buf = new envelope_1.ResilientMemoryBuffer(50);
        const calls = [];
        const mirror = {
            addMessage(role, content, meta) { calls.push({ role, content, meta }); }
        };
        const chat = new memory_adapter_1.default(buf, 'thread-2', mirror);
        chat.addMessage('system', 'sys');
        chat.addMessage('user', { hello: 'world' });
        (0, globals_1.expect)(calls.length).toBe(2);
        (0, globals_1.expect)(calls[0].role).toBe('system');
        (0, globals_1.expect)(typeof calls[1].content).toBe('object');
    });
});
(0, globals_1.describe)('Adapter integration in attemptWithBackoff', () => {
    (0, globals_1.it)('logs system, user (envelope), ai (reply), tool (decision)', async () => {
        const dbg = new ai_debugging_1.AIDebugger({ sandbox_isolation: 'full' });
        // create a thin chat adapter to inspect messages via MemoryBuffer by duck-typing
        const store = dbg.memory;
        const mirrorCalls = [];
        const mirror = { addMessage: (r, c, m) => { mirrorCalls.push({ r, c, m }); } };
        const chat = new memory_adapter_1.default(store, 'sess-1', mirror);
        // LLM adapter stub that returns a small patch in a code fence
        const llmAdapter = async () => ({ text: '```ts\nconsole.log("fixed");\n```' });
        await dbg.attemptWithBackoff(confidence_scoring_1.ErrorType.SYNTAX, 'Missing paren', 'console.log("broken"', 'console.log("broken"', [0.1, 0.2, 0.3], { maxAttempts: 1, minMs: 0, maxMs: 1, llmAdapter, sessionId: 'sess-1', chatAdapter: chat });
        const messages = chat.getMessages();
        // We expect at least system and user from the consult path
        (0, globals_1.expect)(messages.length).toBeGreaterThanOrEqual(2);
        (0, globals_1.expect)(messages[0].role).toBe('system');
        (0, globals_1.expect)(messages[1].role).toBe('user');
        // Mirror should have been called at least twice as well
        (0, globals_1.expect)(mirrorCalls.length).toBeGreaterThanOrEqual(2);
    }, 10000);
});
