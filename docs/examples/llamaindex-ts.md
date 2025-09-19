# Example: LlamaIndex.ts calling the Self-Healing API

This example demonstrates invoking the debug API from a LlamaIndex.ts application and retrieving recent envelopes.

```ts
import fetch from "node-fetch";

// Run a debug attempt
const payload = {
  error_type: "SYNTAX",
  message: "Missing )",
  patch_code: "console.log('x'",
  original_code: "console.log('x'",
  maxAttempts: 2
};
const res = await fetch("http://localhost:8787/api/debug/run", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
});
const run = await res.json();

// Fetch the envelope by id and list recent
const id = run.envelope?.patch_id;
const envRes = await fetch(`http://localhost:8787/api/envelopes/${id}`);
const env = await envRes.json();

const listRes = await fetch("http://localhost:8787/api/envelopes?limit=5");
const recent = await listRes.json();

console.log("Decision:", run.action);
console.log("Trend:", env.trendMetadata);
console.log("Recent count:", recent.length);
```

Notes:
- You can store envelopes in a vector index and retrieve them as context for future runs.
- If you implement function-calling, you can wrap POST /api/debug/run as a callable tool.
