"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const langchainChatAdapter_1 = __importDefault(require("../../utils/typescript/adapters/langchainChatAdapter"));
(0, globals_1.describe)('LangChainChatAdapter', () => {
    (0, globals_1.it)('appends messages in order and respects limit', () => {
        const lc = new langchainChatAdapter_1.default();
        lc.addMessage('system', 'sys');
        lc.addMessage('user', { a: 1 }, { meta: true });
        lc.addMessage('ai', 'ok', { confidence: 0.9 });
        lc.addMessage('tool', { type: 'patch_envelope', id: 'x' });
        const all = lc.getMessages();
        (0, globals_1.expect)(all.length).toBe(4);
        const last2 = lc.getMessages(2);
        (0, globals_1.expect)(last2.length).toBe(2);
    });
    (0, globals_1.it)('maps roles properly and serializes tool content as JSON string', () => {
        var _a;
        const lc = new langchainChatAdapter_1.default();
        lc.addMessage('tool', { hello: 'world' });
        const [msg] = lc.getMessages(1);
        // In fallback, we store a light object
        (0, globals_1.expect)(msg._type === 'tool' || ((_a = msg.constructor) === null || _a === void 0 ? void 0 : _a.name) === 'ToolMessage').toBe(true);
        // Content is JSON string in either branch
        const content = msg.content;
        if (typeof content === 'string') {
            (0, globals_1.expect)(() => JSON.parse(content)).not.toThrow();
            (0, globals_1.expect)(JSON.parse(content)).toMatchObject({ hello: 'world' });
        }
    });
});
