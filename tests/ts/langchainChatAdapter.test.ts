/**
 * Verifies role mapping, ordering, meta preservation, tool JSON payloads,
 * and tail slicing for LangChainChatAdapter.
 *
 * We mock @langchain/core/messages to avoid a hard dependency in tests.
 */

jest.mock("@langchain/core/messages", () => {
  class MockBaseMessage {
    public content: any;
    public additional_kwargs?: any;
    constructor(arg: any) {
      if (arg && typeof arg === "object" && ("content" in arg || "additional_kwargs" in arg)) {
        this.content = (arg as any).content;
        this.additional_kwargs = (arg as any).additional_kwargs;
      } else {
        this.content = arg;
      }
    }
    _getType(): string {
      // subclasses override .type
      // @ts-ignore
      return this.type ?? "base";
    }
  }

  class SystemMessage extends MockBaseMessage {
    type = "system";
  }
  class HumanMessage extends MockBaseMessage {
    type = "human";
  }
  class AIMessage extends MockBaseMessage {
    type = "ai";
  }
  class ToolMessage extends MockBaseMessage {
    type = "tool";
    public name: string;
    constructor(arg: any) {
      // Expect object: { content: string, name: string }
      super({ content: arg?.content });
      this.name = arg?.name ?? "Tool";
    }
  }

  return { BaseMessage: MockBaseMessage, SystemMessage, HumanMessage, AIMessage, ToolMessage };
}, { virtual: true });

import LangChainChatAdapter, { LangChainChatAdapter as NamedAdapter } from "../../utils/typescript/adapters/langchainChatAdapter";

describe("LangChainChatAdapter", () => {
  test("appends messages in order and maps roles to correct classes", () => {
    const chat = new NamedAdapter();

    chat.addMessage("system", "You are a careful code fixer.");
    chat.addMessage("user", { attempt: 1, prompt: "Fix semicolon.", file: "user.service.ts" }, { source: "debugger" });
    chat.addMessage("ai", { text: "Here is a minimal patch." }, { model: "gpt-x" });
    chat.addMessage("tool", { patch: "// diff here", linesChanged: 3 });

    const msgs = chat.getMessages();
    expect(msgs).toHaveLength(4);

    // ordering + types (using the mock's _getType)
    expect((msgs[0] as any)._getType()).toBe("system");
    expect((msgs[1] as any)._getType()).toBe("human");
    expect((msgs[2] as any)._getType()).toBe("ai");
    expect((msgs[3] as any)._getType()).toBe("tool");
  });

  test("preserves meta in additional_kwargs for user/ai", () => {
    const chat = new NamedAdapter();

    chat.addMessage("user", { content: "envelope.json", attempt: 2 }, { source: "jitter", envelope: true });
    chat.addMessage("ai", { text: "OK, trying smaller patch." }, { model: "gpt-x-mini", temperature: 0.2 });

    const [human, ai] = chat.getMessages().slice(-2);

    // Human
    expect((human as any)._getType()).toBe("human");
    expect((human as any).additional_kwargs).toEqual({ source: "jitter", envelope: true });

    // AI
    expect((ai as any)._getType()).toBe("ai");
    expect((ai as any).additional_kwargs).toEqual({ model: "gpt-x-mini", temperature: 0.2 });
  });

  test("serializes tool content to JSON string and sets Tool name", () => {
    const chat = new NamedAdapter();
    const payload = { patch: "diff --git a b", linesChanged: 5, action: "apply_patch" };
    chat.addMessage("tool", payload);

    const toolMsg = chat.getMessages().pop() as any as { name: string };
    expect((toolMsg as any)._getType()).toBe("tool");

    // content is a JSON string
    expect(typeof (toolMsg as any).content).toBe("string");
    expect(JSON.parse((toolMsg as any).content)).toEqual(payload);

    // name is set for downstream routing
    expect(toolMsg.name).toBe("DebuggerTool");
  });

  test("getMessages(limit) returns tail slice in order", () => {
    const chat = new NamedAdapter();
    chat.addMessage("system", "A");
    chat.addMessage("user", "B");
    chat.addMessage("ai", "C");
    chat.addMessage("tool", { x: 42 });

    const lastTwo = chat.getMessages(2);
    expect(lastTwo).toHaveLength(2);
    expect((lastTwo[0] as any)._getType()).toBe("ai");
    expect((lastTwo[1] as any)._getType()).toBe("tool");
  });
});
