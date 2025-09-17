// LangChain-style chat adapter with safe fallback when @langchain/core is not installed.
// It implements a simple ChatAdapter interface compatible with our ExternalChatMirror.

export type ChatRole = 'system' | 'user' | 'ai' | 'tool';

export interface ChatAdapter {
  addMessage(role: ChatRole, content: any, meta?: any): void | Promise<void>;
  getMessages(limit?: number): any[] | Promise<any[]>;
}

type BaseMessageLike = { _type: string; content: any; additional_kwargs?: any; name?: string };

function loadLang(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@langchain/core/messages');
  } catch {
    return null;
  }
}

function redact(obj: any): any {
  // Minimal placeholder redactor: pass-through. Hook for future PII filtering.
  return obj;
}

export class LangChainChatAdapter implements ChatAdapter {
  private history: BaseMessageLike[] = [];
  private lang = loadLang();

  constructor(private redactor: (obj: any) => any = redact) { }

  addMessage(role: ChatRole, content: any, meta?: any): void {
    const c = this.redactor(content);
    const m = meta ? { ...(meta || {}) } : undefined;

    if (this.lang) {
      const { SystemMessage, HumanMessage, AIMessage, ToolMessage } = this.lang;
      let msg: any;
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
      this.history.push(msg as BaseMessageLike);
      return;
    }

    // Fallback: store a light message object when LangChain is not available
    const fallback: BaseMessageLike = (() => {
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
          return { _type: role, content: c } as any;
      }
    })();
    this.history.push(fallback);
  }

  getMessages(limit?: number): BaseMessageLike[] {
    return typeof limit === 'number' && limit >= 0
      ? this.history.slice(Math.max(0, this.history.length - limit))
      : this.history.slice();
  }
}

export default LangChainChatAdapter;
