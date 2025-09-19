# AWS Lambda Deployment (debug.run)

This guide deploys only the core debug function as a stateless Lambda behind API Gateway.

## Handler
Source: `src/lambda/debugHandler.ts`
Exports `handler` expecting POST with JSON body identical to `/api/debug/run`.

## Build Steps
1. `npm run build`
2. Package minimal bundle (exclude tests, docs):
   - Create zip with `dist/**` + `node_modules/**` + `package.json` + `package-lock.json` (or use Lambda layer for deps).
3. Set handler to: `dist/src/lambda/debugHandler.handler`
4. Runtime: `nodejs20.x`

## API Gateway (HTTP API) Mapping
- Method: POST
- Resource: /debug/run
- Integration: Lambda proxy

## Request Example
```
POST /debug/run
{
  "error_type": "SYNTAX",
  "message": "Fix missing semicolon",
  "patch_code": "const x=1",
  "original_code": "const x=1;"
}
```

## Response Example
```
200 OK
{"action":"STOP","envelope":{"patch_id":"..."},"extras":{}}
```

## Environment Variables
None required. Add (future): feature flags, persistence toggles.

## Cold Start Considerations
- AIDebugger constructor performs lightweight schema load; keep package small.
- Provisioned concurrency optional for latency-sensitive environments.

## Observability
- CloudWatch logs include errors & stack traces.
- For metrics replicate health endpoint logic in a separate Lambda if needed.

## Security
- Add IAM authorizer or API key usage plan.
- Validate input size (API Gateway payload limit default ~10MB; typical requests far smaller).

## Future Enhancements
- Batch debug attempts (array input)
- Streaming (WebSocket API Gateway) for multi-attempt progress
- S3-backed envelope persistence

See also: `docs/function-manifest.md` for schemas and `docs/integration-mcp-rag.md` for protocol tools.
