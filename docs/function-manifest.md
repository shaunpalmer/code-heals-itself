# Function Call Manifest

Unified poin## Suggested Tool Registration
```json
{
  "name": "run_debug_attempt",
  "description": "Attempt to self-heal a code fragment by applying patch_code against original_code and analyzing outcome.",
  "input_schema": { "$ref": "http://localhost:8787/api/schemas/debug.json" },
  "output_schema": { "$ref": "http://localhost:8787/api/schemas/debug.out.json" },
  "openapi": "http://localhost:8787/api/openapi.json"
}
```ent frameworks (LangChain, LlamaIndex, CrewAI, semantic routers) that want to auto-register the self-healing debug capability as a tool / function.

## Table of Contents
- [Core Resources](#core-resources)
- [Why This Manifest?](#why-this-manifest)
- [Suggested Tool Registration](#suggested-tool-registration)
- [Minimal Workflow](#minimal-workflow)
- [Caching Guidance](#caching-guidance)
- [Security Considerations](#security-considerations)
- [Roadmap Hooks](#roadmap-hooks)
- [LangChain Advanced Usage](#langchain-advanced-usage)

## Core Resources

| Purpose | URL | Notes |
|---------|-----|-------|
| OpenAPI Spec | /api/openapi.json | Full REST surface (dynamic server URL inferred) |
| Input JSON Schema | /api/schemas/debug.json | Parameters accepted by POST /api/debug/run |
| Output JSON Schema | /api/schemas/debug.out.json | Representative shape of response (action + envelope) |
| Health / Metrics (JSON) | /health | Basic status & counters |
| Health / Metrics (Prometheus) | /health?format=prom | Text exposition for scraping |
| MCP Server (stdio) | start:mcp script | Tools: debug.run, rag.search, rag.add |

## Why This Manifest?

Different ecosystems expect different descriptors:
- OpenAPI: REST discovery, Postman collections, client generation.
- JSON Schema (input): LLM function calling / tool registration (OpenAI, Anthropic, Mistral agents, LM Studio plugins).
- JSON Schema (output): Downstream validation, type inference, response routing.
- Prometheus metrics: Ops dashboards, alerting, trend baselining for auto-remediation thresholds.

Providing all three keeps the integration friction near zero.

## Integrations
- `docs/integration-lmstudio.md` (OpenAI-compatible)
- `docs/integration-crewai.md`
- `docs/integration-mcp-rag.md`

## Suggested Tool Registration

```jsonc
{
  "name": "run_debug_attempt",
  "description": "Attempt to self-heal a code fragment by applying patch_code against original_code and analyzing outcome.",
  "input_schema": { "$ref": "http://localhost:8787/api/schemas/debug.json" },
  "output_schema": { "$ref": "http://localhost:8787/api/schemas/debug.out.json" },
  "openapi": "http://localhost:8787/api/openapi.json"
}
```

At runtime you should replace `http://localhost:8787` with the actual reachable base (e.g. inside a container, `http://self-healer:8787`).

## Minimal Workflow

1. Fetch input schema -> register as callable tool.
2. When runtime detects a failing test or error log, call the tool with `{ error_type, message, patch_code, original_code }`.
3. Observe `action` field in response and optionally inspect `envelope` for success metrics / hints.
4. Log metrics: scrape `/health?format=prom` to feed dashboards.

## Caching Guidance

- Schemas are stable within a build; safe to cache for session lifetime.
- Invalidate if `package.json` version changes or server announces a new `x-revision` header (future enhancement).

## Security Considerations

- All endpoints are unauthenticated by default; place behind an internal network, dev proxy, or add a simple auth layer if exposing externally.
- Inputs accept raw code strings; consider length limits or sandboxing if turning this into a multi-tenant service.

## Roadmap Hooks (Optional)

Future manifest entries could include:
- /api/schemas/debug.stream.json (streaming token/event schema)
- /api/schemas/debug.error.json (standardized error envelope)
- SSE or WebSocket endpoint for live patch attempt telemetry

---
**Next:** If you need a Postman collection, it's easy to derive automatically from `/api/openapi.json` (we also ship a hand-crafted one in `postman/`).

## LangChain Advanced Usage

The repo already includes `@langchain/core`. To register the debug tool dynamically:

```ts
import { DynamicTool } from '@langchain/core/tools';

export const runDebugAttemptTool = new DynamicTool({
  name: 'run_debug_attempt',
  description: 'Attempt to self-heal a code fragment.',
  func: async (argsJson: string) => {
    const args = JSON.parse(argsJson);
    const res = await fetch('http://localhost:8787/api/debug/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
    return await res.text();
  }
});
```

Add `runDebugAttemptTool` to your agent’s tool list along with any retrieval tools. Use the input schema from `/api/schemas/debug.json` to build a validation layer before invocation if desired.
