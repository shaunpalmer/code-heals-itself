"use strict";
/**
 * Verifies role mapping, ordering, meta preservation, tool JSON payloads,
 * and tail slicing for LangChainChatAdapter.
 *
 * We mock @langchain/core/messages to avoid a hard dependency in tests.
 */
Object.defineProperty(exports, "__esModule", { value: true });
jest.mock("@langchain/core/messages", () => {
    class MockBaseMessage {
        constructor(arg) {
            if (arg && typeof arg === "object" && ("content" in arg || "additional_kwargs" in arg)) {
                this.content = arg.content;
                this.additional_kwargs = arg.additional_kwargs;
            }
            else {
                this.content = arg;
            }
        }
        _getType() {
            var _a;
            // subclasses override .type
            // @ts-ignore
            return (_a = this.type) !== null && _a !== void 0 ? _a : "base";
        }
    }
    class SystemMessage extends MockBaseMessage {
        constructor() {
            super(...arguments);
            this.type = "system";
        }
    }
    class HumanMessage extends MockBaseMessage {
        constructor() {
            super(...arguments);
            this.type = "human";
        }
    }
    class AIMessage extends MockBaseMessage {
        constructor() {
            super(...arguments);
            this.type = "ai";
        }
    }
    class ToolMessage extends MockBaseMessage {
        constructor(arg) {
            var _a;
            // Expect object: { content: string, name: string }
            super({ content: arg === null || arg === void 0 ? void 0 : arg.content });
            this.type = "tool";
            this.name = (_a = arg === null || arg === void 0 ? void 0 : arg.name) !== null && _a !== void 0 ? _a : "Tool";
        }
    }
    return { BaseMessage: MockBaseMessage, SystemMessage, HumanMessage, AIMessage, ToolMessage };
}, { virtual: true });
const langchainChatAdapter_1 = require("../../utils/typescript/adapters/langchainChatAdapter");
describe("LangChainChatAdapter", () => {
    test("appends messages in order and maps roles to correct classes", () => {
        const chat = new langchainChatAdapter_1.LangChainChatAdapter();
        chat.addMessage("system", "You are a careful code fixer.");
        chat.addMessage("user", { attempt: 1, prompt: "Fix semicolon.", file: "user.service.ts" }, { source: "debugger" });
        chat.addMessage("ai", { text: "Here is a minimal patch." }, { model: "gpt-x" });
        chat.addMessage("tool", { patch: "// diff here", linesChanged: 3 });
        const msgs = chat.getMessages();
        expect(msgs).toHaveLength(4);
        // ordering + types (using the mock's _getType)
        expect(msgs[0]._getType()).toBe("system");
        expect(msgs[1]._getType()).toBe("human");
        expect(msgs[2]._getType()).toBe("ai");
        expect(msgs[3]._getType()).toBe("tool");
    });
    test("preserves meta in additional_kwargs for user/ai", () => {
        const chat = new langchainChatAdapter_1.LangChainChatAdapter();
        chat.addMessage("user", { content: "envelope.json", attempt: 2 }, { source: "jitter", envelope: true });
        chat.addMessage("ai", { text: "OK, trying smaller patch." }, { model: "gpt-x-mini", temperature: 0.2 });
        const [human, ai] = chat.getMessages().slice(-2);
        // Human
        expect(human._getType()).toBe("human");
        expect(human.additional_kwargs).toEqual({ source: "jitter", envelope: true });
        // AI
        expect(ai._getType()).toBe("ai");
        expect(ai.additional_kwargs).toEqual({ model: "gpt-x-mini", temperature: 0.2 });
    });
    test("serializes tool content to JSON string and sets Tool name", () => {
        const chat = new langchainChatAdapter_1.LangChainChatAdapter();
        const payload = { patch: "diff --git a b", linesChanged: 5, action: "apply_patch" };
        chat.addMessage("tool", payload);
        const toolMsg = chat.getMessages().pop();
        expect(toolMsg._getType()).toBe("tool");
        // content is a JSON string
        expect(typeof toolMsg.content).toBe("string");
        expect(JSON.parse(toolMsg.content)).toEqual(payload);
        // name is set for downstream routing
        expect(toolMsg.name).toBe("DebuggerTool");
    });
    test("getMessages(limit) returns tail slice in order", () => {
        const chat = new langchainChatAdapter_1.LangChainChatAdapter();
        chat.addMessage("system", "A");
        chat.addMessage("user", "B");
        chat.addMessage("ai", "C");
        chat.addMessage("tool", { x: 42 });
        const lastTwo = chat.getMessages(2);
        expect(lastTwo).toHaveLength(2);
        expect(lastTwo[0]._getType()).toBe("ai");
        expect(lastTwo[1]._getType()).toBe("tool");
    });
});
