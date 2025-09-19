# MCP Integration (Self-Heal + RAG)

Provides a Model Context Protocol (MCP) server exposing:
- debug.run  → Perform a self-healing debug attempt
- rag.search → Query a lightweight in-memory context index
- rag.add    → Insert/update ephemeral documents in the index

**TypeScript Support**: Full TypeScript implementation with type safety and IntelliSense support.

## Running the Server

```bash
npm run build
npm run start:mcp
```
The process speaks MCP over stdio. Connect using an MCP-compatible client specifying command:
```
command: node
args: ["dist/src/mcp/server.js"]
```

## Script Support

### Status Monitoring
Check MCP server health and available tools:
```bash
npm run status
# Output: MCP server: UP (tools: debug.run, rag.search, rag.add)
```

### Auto-Integration
Automatically detect and configure MCP server:
```bash
npm run integrate:auto
# Detects MCP status and provides connection guidance
```

### Probe Mode
Get server information without starting full MCP session:
```bash
node dist/src/mcp/server.js --probe
# Returns: {"tools":["debug.run","rag.search","rag.add"]}
```

### Service Management
Run MCP as a background service:
```bash
# Using PM2
npm run setup:pm2

# Using NSSM (Windows Service)
npm run setup:nssm
```

## TypeScript Types

The MCP server is built with full TypeScript support. Key interfaces:

```typescript
interface DebugRunInput {
  error_type: "SYNTAX" | "LOGIC" | "RUNTIME" | "PERFORMANCE" | "SECURITY";
  message: string;
  patch_code: string;
  original_code: string;
  logits?: number[];
  sessionId?: string;
  maxAttempts?: number;
}

interface RagSearchInput {
  query: string;
  limit?: number;
}

interface RagAddInput {
  id: string;
  content: string;
  tags: string[];
}

interface McpProbeResponse {
  tools: string[];
}
```

## Extending RAG
Replace the in-memory array with:
- File scan: read markdown / code comments into docs.
- Embeddings: call external model (OpenAI, LM Studio local endpoint) store vector + content.
- Hybrid scoring: lexical score + cosine similarity.

## Adding Embeddings (Sketch)
1. Add dependency for a local embedding model client.
2. On rag.add: generate embedding, push { id, content, tags, embedding }.
3. On rag.search: create embedding for query, rank by cosine, fall back to lexical if all scores < threshold.

## Error Semantics
- Unknown tool → MCP error response
- Validation issues → thrown Error (client should display)
- Empty query rag.search → returns empty result set

## Security
No auth; rely on local usage. For remote deployment wrap with an authenticated supervisor process or run behind an SSH tunnel.

## Roadmap
- Streaming patch telemetry tool (debug.stream)
- Structured error envelope tool (debug.error)
- Persistent RAG (sqlite or parquet)

See also: `docs/function-manifest.md`, `docs/integration-lmstudio.md`, `docs/integration-crewai.md`.
