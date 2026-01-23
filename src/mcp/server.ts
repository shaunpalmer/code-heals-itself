/* Minimal MCP server exposing self-heal debug tool and a placeholder RAG search.
 * Transport: stdio
 * Depends on @modelcontextprotocol/sdk (already in dependencies).
 */
import { AIDebugger } from '../../ai-debugging';
import { ErrorType } from '../../utils/typescript/confidence_scoring';
import ChatMessageHistoryAdapter from '../../utils/typescript/memory_adapter';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const debuggerInstance = new AIDebugger();
const chats = new Map<string, ChatMessageHistoryAdapter>();

function getChat(id: string) {
  let c = chats.get(id);
  if (!c) {
    c = new ChatMessageHistoryAdapter((debuggerInstance as any).memory || (debuggerInstance as any)._memory, id);
    chats.set(id, c);
  }
  return c;
}

// Simple in-memory RAG index (static demo). Each doc has id, content, tags.
const RAG_INDEX: { id: string; content: string; tags: string[] }[] = [
  { id: 'policy', content: 'Healer policy thresholds and rate limits guide patch attempts.', tags: ['policy', 'limits'] },
  { id: 'risk', content: 'Risk observer flags sensitive operations (auth, db schema).', tags: ['risk', 'observer'] },
  { id: 'memory', content: 'ResilientMemoryBuffer stores recent patch envelopes with TTL eviction.', tags: ['memory', 'buffer'] }
];

function searchRag(query: string, limit = 3) {
  const q = query.toLowerCase();
  const scored = RAG_INDEX.map(d => ({
    doc: d,
    score: (d.content.toLowerCase().includes(q) ? 2 : 0) + d.tags.filter(t => t.includes(q)).length
  })).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
  return scored.map(s => ({ id: s.doc.id, score: s.score, snippet: s.doc.content.slice(0, 160) }));
}

// Build MCP server
const server = new McpServer({
  name: 'self-heal-mcp',
  version: '0.1.0'
});
const registerTool: any = (server as any).registerTool.bind(server);

registerTool(
  'debug.run',
  {
    description: 'Attempt a self-healing debug run producing patch envelope.',
    inputSchema: {
      error_type: z.enum(['SYNTAX', 'LOGIC', 'RUNTIME', 'PERFORMANCE', 'SECURITY']),
      message: z.string(),
      patch_code: z.string(),
      original_code: z.string(),
      logits: z.array(z.number()).optional(),
      sessionId: z.string().optional(),
      maxAttempts: z.number().int().min(1).optional()
    } as any
  },
  async (args: any) => {
    const { error_type, message, patch_code, original_code, logits, sessionId, maxAttempts } = args || {};
    const errorType = (error_type || 'SYNTAX') as keyof typeof ErrorType;
    const et = ErrorType[errorType] ?? ErrorType.SYNTAX;
    const chat = getChat(sessionId || 'default');
    const result = await debuggerInstance.attemptWithBackoff(
      et,
      String(message || ''),
      String(patch_code || ''),
      String(original_code || ''),
      Array.isArray(logits) ? logits : [],
      { maxAttempts: Math.max(1, Number(maxAttempts || 1)), sessionId, chatAdapter: chat }
    );
    return { content: [{ type: 'json', data: { action: result.action, envelope: result.envelope, extras: result.extras } }] };
  }
);

registerTool(
  'rag.search',
  {
    description: 'Search lightweight in-memory RAG index for context.',
    inputSchema: {
      query: z.string(),
      limit: z.number().int().min(1).max(10).optional()
    } as any
  },
  async (args: any) => {
    const { query, limit } = args || {};
    const q = String(query || '').trim();
    if (!q) return { content: [{ type: 'json', data: { results: [] } }] };
    const results = searchRag(q, Math.max(1, Math.min(10, Number(limit || 3))));
    return { content: [{ type: 'json', data: { results } }] };
  }
);

registerTool(
  'rag.add',
  {
    description: 'Add a document to the in-memory RAG index (ephemeral).',
    inputSchema: {
      id: z.string(),
      content: z.string(),
      tags: z.array(z.string()).optional()
    } as any
  },
  async (args: any) => {
    const { id, content, tags } = args || {};
    const docId = String(id || '').trim();
    const docContent = String(content || '').trim();
    if (!docId || !docContent) {
      return { content: [{ type: 'json', data: { added: false, reason: 'Missing id or content' } }] };
    }
    const docTags = Array.isArray(tags) ? tags.map(t => String(t)) : [];
    const existingIdx = RAG_INDEX.findIndex(d => d.id === docId);
    if (existingIdx >= 0) RAG_INDEX[existingIdx] = { id: docId, content: docContent, tags: docTags };
    else RAG_INDEX.push({ id: docId, content: docContent, tags: docTags });
    return { content: [{ type: 'json', data: { added: true, size: RAG_INDEX.length } }] };
  }
);

// Lightweight probe mode: if --probe passed, print tool list JSON and exit.
if (process.argv.includes('--probe')) {
  try {
    const tools = Object.keys((server as any)._registeredTools || {});
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ mcp: true, tools }));
    process.exit(0);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ mcp: false, error: (err as any)?.message }));
    process.exit(1);
  }
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // eslint-disable-next-line no-console
  console.log('[mcp] server started (stdio) tools: debug.run, rag.search, rag.add');
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error('[mcp] fatal', err);
  process.exit(1);
});
