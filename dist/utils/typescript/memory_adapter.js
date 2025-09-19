"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatMessageHistoryAdapter = void 0;
class ChatMessageHistoryAdapter {
    constructor(store, threadId, mirror) {
        this.messages = [];
        this.store = store;
        this.threadId = threadId;
        this.mirror = mirror;
    }
    addMessage(role, content, meta = {}) {
        var _a, _b, _c;
        const ts = new Date().toISOString();
        const payload = {
            role,
            content: typeof content === 'string' ? content : safeJson(content),
            ts,
            meta: { ...(meta || {}), threadId: this.threadId }
        };
        this.messages.push(payload);
        const record = { kind: 'chat_message', ...payload };
        // Best-effort persistence to MemoryStore, using safeAddOutcome when available
        try {
            (_c = (_b = (_a = this.store).safeAddOutcome) === null || _b === void 0 ? void 0 : _b.call(_a, JSON.stringify(record))) !== null && _c !== void 0 ? _c : this.store.addOutcome(JSON.stringify(record));
        }
        catch {
            // swallow persistence errors (adapter is best-effort)
        }
        // Optional mirror to external chat memory
        try {
            if (this.mirror && typeof this.mirror.addMessage === 'function') {
                void this.mirror.addMessage(role, content, payload.meta || {});
            }
        }
        catch {
            // do not propagate mirror failures
        }
    }
    // Retrieve messages captured by this adapter instance, in insertion order
    getMessages(limit) {
        const copy = this.messages.slice();
        if (typeof limit === 'number' && limit >= 0) {
            return copy.slice(Math.max(0, copy.length - limit));
        }
        return copy;
    }
    // Retrieve messages from mirror if available (best-effort)
    async getMirrorMessages(limit) {
        if (!this.mirror || typeof this.mirror.getMessages !== 'function')
            return null;
        try {
            const raw = await this.mirror.getMessages(limit);
            const arr = Array.isArray(raw) ? raw : [];
            // Normalize a bit if the mirror uses different shape
            return arr.map((m) => ({
                role: m.role,
                content: typeof m.content === 'string' ? m.content : safeJson(m.content),
                ts: m.ts || new Date().toISOString(),
                meta: m.meta || {}
            }));
        }
        catch {
            return null;
        }
    }
}
exports.ChatMessageHistoryAdapter = ChatMessageHistoryAdapter;
/**
 * TODO(API): History endpoints for pull integrations
 * - GET /api/history/similar?message=...&code=... → recent similar envelopes/messages
 * - GET /api/chat/:session/messages?limit=100 → chat transcript (for LangChain/LlamaIndex context)
 * - POST /api/chat/:session/message → external agent pushes messages to our memory mirror
 */
function safeJson(obj) {
    try {
        return JSON.stringify(obj);
    }
    catch {
        try {
            return String(obj);
        }
        catch {
            return '';
        }
    }
}
exports.default = ChatMessageHistoryAdapter;
