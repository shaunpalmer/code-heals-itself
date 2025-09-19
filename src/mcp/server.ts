/* Minimal MCP server exposing self-heal debug tool and a placeholder RAG search.
 * Transport: stdio
 * Depends on @modelcontextprotocol/sdk (already in dependencies).
 */
import { AIDebugger } from '../../ai-debugging';
import { ErrorType } from '../../utils/typescript/confidence_scoring';
import ChatMessageHistoryAdapter from '../../utils/typescript/memory_adapter';
// Prefer root import (SDK may not expose subpath exports depending on version)
// eslint-disable-next-line @typescript-eslint/no-var-requires
let mcp: any; try { mcp = require('@modelcontextprotocol/sdk'); } catch { mcp = {}; }
// Types guarded with fallback shims
const { StdioServerTransport, Server, jsonSchema } = mcp;
if (!Server || !StdioServerTransport) {
  // eslint-disable-next-line no-console
  console.error('[mcp] Required classes not found in @modelcontextprotocol/sdk. Check installed version.');
}

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
const server = Server ? new Server({
  name: 'self-heal-mcp',
  version: '0.1.0',
  capabilities: {
    tools: {
      'debug.run': {
        description: 'Attempt a self-healing debug run producing patch envelope.',
        inputSchema: jsonSchema({
          type: 'object',
          required: ['error_type', 'message', 'patch_code', 'original_code'],
          properties: {
            error_type: { type: 'string', enum: ['SYNTAX', 'LOGIC', 'RUNTIME', 'PERFORMANCE', 'SECURITY'] },
            message: { type: 'string' },
            patch_code: { type: 'string' },
            original_code: { type: 'string' },
            logits: { type: 'array', items: { type: 'number' } },
            sessionId: { type: 'string' },
            maxAttempts: { type: 'integer', minimum: 1, default: 1 }
          },
          additionalProperties: false
        })
      },
      'rag.search': {
        description: 'Search lightweight in-memory RAG index for context.',
        inputSchema: jsonSchema({
          type: 'object',
          required: ['query'],
          properties: {
            query: { type: 'string' },
            limit: { type: 'integer', minimum: 1, maximum: 10, default: 3 }
          },
          additionalProperties: false
        })
      },
      'rag.add': {
        description: 'Add a document to the in-memory RAG index (ephemeral).',
        inputSchema: jsonSchema({
          type: 'object',
          required: ['id', 'content'],
          properties: {
            id: { type: 'string' },
            content: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' }, default: [] }
          },
          additionalProperties: false
        })
      }
    }
  }
}) : null;

// Lightweight probe mode: if --probe passed, print tool list JSON and exit.
if (process.argv.includes('--probe')) {
  try {
    const tools = server ? Object.keys((server as any).capabilities?.tools || {}) : [];
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ mcp: true, tools }));
    process.exit(0);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ mcp: false, error: (err as any)?.message }));
    process.exit(1);
  }
}

if (server) server.setRequestHandler('tools/call', async (req: any) => {
  const { name, input } = req.params;
  if (name === 'debug.run') {
    const body: any = input || {};
    const errorType = (body.error_type || 'SYNTAX') as keyof typeof ErrorType;
    const et = ErrorType[errorType] ?? ErrorType.SYNTAX;
    const chat = getChat(body.sessionId || 'default');
    const result = await debuggerInstance.attemptWithBackoff(
      et,
      String(body.message || ''),
      String(body.patch_code || ''),
      String(body.original_code || ''),
      Array.isArray(body.logits) ? body.logits : [],
      { maxAttempts: Math.max(1, body.maxAttempts || 1), sessionId: body.sessionId, chatAdapter: chat }
    );
    return { content: [{ type: 'json', data: { action: result.action, envelope: result.envelope, extras: result.extras } }] };
  }
  if (name === 'rag.search') {
    const body: any = input || {};
    const query = String(body.query || '').trim();
    if (!query) return { content: [{ type: 'json', data: { results: [] } }] };
    const results = searchRag(query, Math.max(1, Math.min(10, body.limit || 3)));
    return { content: [{ type: 'json', data: { results } }] };
  }
  if (name === 'rag.add') {
    const body: any = input || {};
    const id = String(body.id || '').trim();
    const content = String(body.content || '').trim();
    if (!id || !content) return { content: [{ type: 'json', data: { added: false, reason: 'Missing id or content' } }] };
    const tags = Array.isArray(body.tags) ? body.tags.map((t: any) => String(t)) : [];
    const existingIdx = RAG_INDEX.findIndex(d => d.id === id);
    if (existingIdx >= 0) RAG_INDEX[existingIdx] = { id, content, tags };
    else RAG_INDEX.push({ id, content, tags });
    return { content: [{ type: 'json', data: { added: true, size: RAG_INDEX.length } }] };
  }
  throw new Error('Unknown tool: ' + name);
});

async function main() {
  if (!server || !StdioServerTransport) return;
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
