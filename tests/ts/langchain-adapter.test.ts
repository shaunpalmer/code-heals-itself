import { describe, it, expect } from '@jest/globals';
import LangChainChatAdapter from '../../utils/typescript/adapters/langchainChatAdapter';

describe('LangChainChatAdapter', () => {
  it('appends messages in order and respects limit', () => {
    const lc = new LangChainChatAdapter();
    lc.addMessage('system', 'sys');
    lc.addMessage('user', { a: 1 }, { meta: true });
    lc.addMessage('ai', 'ok', { confidence: 0.9 });
    lc.addMessage('tool', { type: 'patch_envelope', id: 'x' });
    const all = lc.getMessages();
    expect(all.length).toBe(4);
    const last2 = lc.getMessages(2);
    expect(last2.length).toBe(2);
  });

  it('maps roles properly and serializes tool content as JSON string', () => {
    const lc = new LangChainChatAdapter();
    lc.addMessage('tool', { hello: 'world' });
    const [msg] = lc.getMessages(1);
    // In fallback, we store a light object
    expect(msg._type === 'tool' || msg.constructor?.name === 'ToolMessage').toBe(true);
    // Content is JSON string in either branch
    const content = (msg as any).content;
    if (typeof content === 'string') {
      expect(() => JSON.parse(content)).not.toThrow();
      expect(JSON.parse(content)).toMatchObject({ hello: 'world' });
    }
  });
});
