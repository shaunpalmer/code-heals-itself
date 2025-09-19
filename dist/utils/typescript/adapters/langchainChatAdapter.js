"use strict";
// LangChain-style chat adapter with safe fallback when @langchain/core is not installed.
// It implements a simple ChatAdapter interface compatible with our ExternalChatMirror.
Object.defineProperty(exports, "__esModule", { value: true });
exports.LangChainChatAdapter = void 0;
function loadLang() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require('@langchain/core/messages');
    }
    catch {
        return null;
    }
}
function redact(obj) {
    // Minimal placeholder redactor: pass-through. Hook for future PII filtering.
    return obj;
}
class LangChainChatAdapter {
    constructor(redactor = redact) {
        this.redactor = redactor;
        this.history = [];
        this.lang = loadLang();
    }
    addMessage(role, content, meta) {
        const c = this.redactor(content);
        const m = meta ? { ...(meta || {}) } : undefined;
        if (this.lang) {
            const { SystemMessage, HumanMessage, AIMessage, ToolMessage } = this.lang;
            let msg;
            switch (role) {
                case 'system':
                    msg = new SystemMessage(c);
                    break;
                case 'user':
                    msg = new HumanMessage({ content: c, additional_kwargs: m });
                    break;
                case 'ai':
                    msg = new AIMessage({ content: c, additional_kwargs: m });
                    break;
                case 'tool':
                    msg = new ToolMessage({ content: JSON.stringify(c), name: 'DebuggerTool' });
                    break;
                default:
                    throw new Error(`Unsupported role: ${role}`);
            }
            this.history.push(msg);
            return;
        }
        // Fallback: store a light message object when LangChain is not available
        const fallback = (() => {
            switch (role) {
                case 'system':
                    return { _type: 'system', content: c };
                case 'user':
                    return { _type: 'human', content: c, additional_kwargs: m };
                case 'ai':
                    return { _type: 'ai', content: c, additional_kwargs: m };
                case 'tool':
                    return { _type: 'tool', content: JSON.stringify(c), name: 'DebuggerTool' };
                default:
                    return { _type: role, content: c };
            }
        })();
        this.history.push(fallback);
    }
    getMessages(limit) {
        return typeof limit === 'number' && limit >= 0
            ? this.history.slice(Math.max(0, this.history.length - limit))
            : this.history.slice();
    }
}
exports.LangChainChatAdapter = LangChainChatAdapter;
exports.default = LangChainChatAdapter;
