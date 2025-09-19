# LM Studio Integration

This guide shows how to wire the Self-Healing Debugger as a callable tool for a model served by LM Studio (OpenAI-compatible API surface).

LM Studio typically exposes an endpoint like:
```
http://192.168.1.229:1234/v1/chat/completions
```
(Adjust host/port to your local instance.)

## 1. Obtain Schemas

Fetch tool input & output schemas plus OpenAPI (optional):
```
GET http://localhost:8787/api/schemas/debug.json
GET http://localhost:8787/api/schemas/debug.out.json
GET http://localhost:8787/api/openapi.json
```

## 2. Construct Tool Definition (OpenAI-style)

```jsonc
{
  "type": "function",
  "function": {
    "name": "run_debug_attempt",
    "description": "Attempt to self-heal a code fragment by applying patch_code to original_code and analyzing outcome.",
    "parameters": { /* insert fetched input schema body here */ }
  }
}
```

Note: If the model supports function calling (tool calling) it may return a `tool_calls` / `function_call` requesting execution.

## 3. Chat Request with Tool Declaration

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  http://192.168.1.229:1234/v1/chat/completions \
  -d '{
    "model": "openai/gpt-oss-20b",
    "messages": [
      {"role": "user", "content": "Fix the syntax error in this code: const x=1 for deployment."}
    ],
    "tools": [ { "type": "function", "function": { "name": "run_debug_attempt", "description": "Self-heal patch attempt", "parameters": { /* schema */ } } } ]
  }'
```

## 4. Executing a Tool Call

When the assistant responds with something like:
```json
{
  "choices": [ {
    "message": {
      "tool_calls": [ {
        "id": "call_abc123",
        "function": { "name": "run_debug_attempt", "arguments": "{\n  \"error_type\": \"SYNTAX\",\n  \"message\": \"Fix semicolon\",\n  \"patch_code\": \"const x=1\",\n  \"original_code\": \"const x=1;\"\n}" }
      } ]
    }
  } ]
}
```
Extract arguments JSON and call:
```
POST http://localhost:8787/api/debug/run
```
Forward the function result back as a follow-up assistant message OR as a tool response depending on LM Studio client conventions.

## 5. Bridge Script Example

See `demo/lmstudio-bridge.js` (added by this project) for a runnable Node script that:
1. Fetches the input schema.
2. Initiates a chat completion with the tool declared.
3. Detects a tool call, executes it against the self-healer API.
4. Sends a follow-up message including summarized `action` + `envelope.patch_id` (if present).

## 6. Metrics & Observability

- Scrape `http://localhost:8787/health?format=prom` into Prometheus / Grafana.
- Envelope details are fetchable via `/api/envelopes/:id` for deeper debugging.

## 7. Security Notes

- Both servers are unauthenticated by default. Use localhost binding, firewalls, or an API gateway for production.
- Avoid forwarding arbitrary untrusted code without sandboxing.

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Tool call never produced | Model not trained or function calling needs explicit `tool_choice=auto` | Add `"tool_choice": "auto"` or adapt client library |
| Connection refused to self-healer | Server not running or wrong port | Start with `node dist/src/server/api.js` or adjust `PORT` |
| Envelope missing | Attempt failed early | Inspect response `extras` or add more observers |

## 9. Next Enhancements

- Automatic tool result streaming
- Batch patch attempt planning
- Rich error envelope schema

---
For a consolidated manifest of all descriptors see `docs/function-manifest.md`.
