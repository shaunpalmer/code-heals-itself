# Self-Healing Debugger API

Lightweight, dependency-free HTTP API for integrating with LangChain, LlamaIndex, CrewAI, and semantic routers.

## Quick Start
- Build: `npm run build`
- Start: `node dist/src/server/api.js`
- Health check: `curl http://localhost:8787/health`

## Endpoints

### Debug Operations
- **POST /api/debug/run**
  - Run a debug attempt (optionally multi-attempt with backoff)
  - Body: `{ error_type, message, patch_code, original_code, logits?, sessionId?, maxAttempts? }`
  - Returns: `{ action, envelope, extras }`
  - Example:
    ```bash
    curl -X POST http://localhost:8787/api/debug/run \
      -H "Content-Type: application/json" \
      -d '{"error_type": "SYNTAX", "message": "SyntaxError", "patch_code": "fix", "original_code": "broken"}'
    ```

### Envelope Management
- **GET /api/envelopes/:id**
  - Fetch a specific envelope by its patch_id
- **GET /api/envelopes?limit=N**
  - List the most recent envelopes (default 25)

### History and Similarity
- **GET /api/history/similar?message=...&code=...**
  - Retrieve recent similar outcomes from long-chain memory

### Chat Integration
- **POST /api/chat/:session/message**
  - Mirror an external chat message into this session's history
  - Body: `{ role, content, meta? }`
- **GET /api/chat/:session/messages?limit=N**
  - Retrieve chat transcript for a session (best-effort)

### Schemas and Documentation
- **GET /api/openapi.json**
  - OpenAPI 3.0 document describing the API
- **GET /api/schemas/debug.json**
  - JSON Schema for the debug function inputs (for function-calling agents)
- **GET /api/schemas/debug.out.json**
  - JSON Schema (best-effort) for debug function output shape: `{ action, envelope?, extras? }`
  - See also: `docs/function-manifest.md` for combined tool registration pointers.

### Health and Metrics
- **GET /health**
  - Basic health and metrics: uptime, memory metrics, envelope count
  - Prometheus text exposition when `?format=prom` or `Accept: text/plain` is used
  - Example: `curl http://localhost:8787/health?format=prom`

## Configuration

### Server Address / Base URL
By default, the server listens on: `http://localhost:8787`

Override the port:
- Set environment variable `PORT=9000` before starting.
- Resulting base URL becomes `http://localhost:9000`.

For remote deployment or containers, ensure you surface the host + port. OpenAPI infers the origin from request headers, so reverse proxies (nginx, traefik) just need to forward Host.

### Environment Variables
- `PORT`: Port to listen on (default 8787)
- `PERSIST_ENVELOPES`: If set to 1/true, envelopes are persisted to `data/envelopes.json`

## Comparison: LM Studio Style
LM Studio exposes endpoints like:
```
GET  http://192.168.x.x:1234/v1/models
POST http://192.168.x.x:1234/v1/chat/completions
```
This project focuses on a specialized self-healing debug surface under `/api/*` plus health/metrics. The concept is similar: a lightweight local HTTP surface with permissive CORS for tool and agent integration.

## Notes
- CORS is permissive to ease local development and agent integration.
- The server is intentionally simple and uses Node's built-in `http` module.
- Envelopes are stored in-memory and optionally persisted when enabled.
- Output schema is intentionally permissive; observers may enrich the envelope over time.
- See `docs/function-manifest.md` for a consolidated manifest linking OpenAPI and JSON Schemas for function/tool registries.

## Integrations
- LM Studio: `docs/integration-lmstudio.md`
- MCP: `docs/integration-mcp-rag.md`
- CrewAI: `docs/integration-crewai.md`
- n8n: `docs/integration-n8n.md`
- Lambda: `docs/deployment-lambda.md`
