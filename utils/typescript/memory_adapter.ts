// ChatMessageHistory-like adapter that writes to our MemoryStore
import { MemoryStore } from './envelope';
import { LLMResponse } from './jitter_comms';

export type ChatRole = 'system' | 'user' | 'ai' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  ts: string;
  meta?: Record<string, any>;
}

export interface ExternalChatMirror {
  addMessage(role: ChatRole, content: string | object, meta?: Record<string, any>): void | Promise<void>;
  getMessages?(limit?: number): Promise<ChatMessage[] | { role: string; content: string; ts?: string; meta?: any }[]> | ChatMessage[] | { role: string; content: string; ts?: string; meta?: any }[];
}

export class ChatMessageHistoryAdapter {
  private messages: ChatMessage[] = [];
  private threadId?: string;
  private store: MemoryStore;
  private mirror?: ExternalChatMirror;

  constructor(store: MemoryStore, threadId?: string, mirror?: ExternalChatMirror) {
    this.store = store;
    this.threadId = threadId;
    this.mirror = mirror;
  }

  addMessage(role: ChatRole, content: string | object, meta: Record<string, any> = {}): void {
    const ts = new Date().toISOString();
    const payload: ChatMessage = {
      role,
      content: typeof content === 'string' ? content : safeJson(content),
      ts,
      meta: { ...(meta || {}), threadId: this.threadId }
    };
    this.messages.push(payload);
    const record = { kind: 'chat_message', ...payload } as any;
    // Best-effort persistence to MemoryStore, using safeAddOutcome when available
    try {
      (this.store as any).safeAddOutcome?.(JSON.stringify(record)) ?? this.store.addOutcome(JSON.stringify(record));
    } catch {
      // swallow persistence errors (adapter is best-effort)
    }
    // Optional mirror to external chat memory
    try {
      if (this.mirror && typeof this.mirror.addMessage === 'function') {
        void this.mirror.addMessage(role, content, payload.meta || {});
      }
    } catch {
      // do not propagate mirror failures
    }
  }

  // Retrieve messages captured by this adapter instance, in insertion order
  getMessages(limit?: number): ChatMessage[] {
    const copy = this.messages.slice();
    if (typeof limit === 'number' && limit >= 0) {
      return copy.slice(Math.max(0, copy.length - limit));
    }
    return copy;
  }

  // Retrieve messages from mirror if available (best-effort)
  async getMirrorMessages(limit?: number): Promise<ChatMessage[] | null> {
    if (!this.mirror || typeof this.mirror.getMessages !== 'function') return null;
    try {
      const raw = await this.mirror.getMessages(limit);
      const arr = Array.isArray(raw) ? raw : [];
      // Normalize a bit if the mirror uses different shape
      return arr.map((m: any) => ({
        role: m.role as ChatRole,
        content: typeof m.content === 'string' ? m.content : safeJson(m.content),
        ts: m.ts || new Date().toISOString(),
        meta: m.meta || {}
      }));
    } catch {
      return null;
    }
  }
}

function safeJson(obj: any): string {
  try {
    return JSON.stringify(obj);
  } catch {
    try { return String(obj); } catch { return ''; }
  }
}

export default ChatMessageHistoryAdapter;
