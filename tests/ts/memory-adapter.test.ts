import { describe, it, expect } from '@jest/globals';
import { ResilientMemoryBuffer } from '../../utils/typescript/envelope';
import ChatMessageHistoryAdapter, { ExternalChatMirror } from '../../utils/typescript/memory_adapter';
import { AIDebugger } from '../../ai-debugging';
import { ErrorType } from '../../utils/typescript/confidence_scoring';

describe('ChatMessageHistoryAdapter', () => {
  it('preserves insertion order and respects limit', () => {
    const buf = new ResilientMemoryBuffer(50);
    const chat = new ChatMessageHistoryAdapter(buf, 'thread-1');
    chat.addMessage('system', 'system prompt');
    chat.addMessage('user', 'u1');
    chat.addMessage('ai', 'a1');
    chat.addMessage('tool', 't1');
    const all = chat.getMessages();
    expect(all.map(m => m.role)).toEqual(['system', 'user', 'ai', 'tool']);
    const last2 = chat.getMessages(2);
    expect(last2.map(m => m.role)).toEqual(['ai', 'tool']);
  });

  it('mirrors to external adapter when provided', async () => {
    const buf = new ResilientMemoryBuffer(50);
    const calls: any[] = [];
    const mirror: ExternalChatMirror = {
      addMessage(role, content, meta) { calls.push({ role, content, meta }); }
    };
    const chat = new ChatMessageHistoryAdapter(buf, 'thread-2', mirror);
    chat.addMessage('system', 'sys');
    chat.addMessage('user', { hello: 'world' });
    expect(calls.length).toBe(2);
    expect(calls[0].role).toBe('system');
    expect(typeof calls[1].content).toBe('object');
  });
});

describe('Adapter integration in attemptWithBackoff', () => {
  it('logs system, user (envelope), ai (reply), tool (decision)', async () => {
    const dbg = new AIDebugger({ sandbox_isolation: 'full' as any });
    // create a thin chat adapter to inspect messages via MemoryBuffer by duck-typing
    const store: any = (dbg as any).memory;
    const mirrorCalls: any[] = [];
    const mirror: ExternalChatMirror = { addMessage: (r: any, c: any, m?: any): void => { mirrorCalls.push({ r, c, m }); } };
    const chat = new ChatMessageHistoryAdapter(store, 'sess-1', mirror);
    // LLM adapter stub that returns a small patch in a code fence
    const llmAdapter = async () => ({ text: '```ts\nconsole.log("fixed");\n```' });
    await dbg.attemptWithBackoff(
      ErrorType.SYNTAX,
      'Missing paren',
      'console.log("broken"',
      'console.log("broken"',
      [0.1, 0.2, 0.3],
      { maxAttempts: 1, minMs: 0, maxMs: 1, llmAdapter, sessionId: 'sess-1', chatAdapter: chat }
    );

    const messages = chat.getMessages();
    // We expect at least system and user from the consult path
    expect(messages.length).toBeGreaterThanOrEqual(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
    // Mirror should have been called at least twice as well
    expect(mirrorCalls.length).toBeGreaterThanOrEqual(2);
  }, 10000);
});
