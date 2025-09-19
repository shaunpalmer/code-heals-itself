# MCP Integration (Self-Heal + RAG)

Provides a Model Context Protocol (MCP) server exposing:
- debug.run  → Perform a self-healing debug attempt
- rag.search → Query a lightweight in-memory context index
- rag.add    → Insert/update ephemeral documents in the index

## Running the Server

```
npm run build
npm run start:mcp
```
The process speaks MCP over stdio. Connect using an MCP-compatible client specifying command:
```
command: node
args: ["dist/src/mcp/server.js"]
```

## Tools

### debug.run
Input:
```
{
  "error_type": "SYNTAX|LOGIC|RUNTIME|PERFORMANCE|SECURITY",
  "message": "...",
  "patch_code": "...",
  "original_code": "...",
  "logits?": number[],
  "sessionId?": string,
  "maxAttempts?": 1
}
```
Output (truncated example):
```
{"action":"SUCCESS","envelope":{"patch_id":"..."},"extras":{}}
```

### rag.search
Input:
```
{ "query": "risk", "limit": 3 }
```
Output:
```
{ "results": [ { "id": "risk", "score": 2, "snippet": "Risk observer flags..." } ] }
```

### rag.add
Input:
```
{ "id": "doc42", "content": "Describes advanced circuit breaking", "tags": ["breaker","policy"] }
```
Output:
```
{ "added": true, "size": 4 }
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
