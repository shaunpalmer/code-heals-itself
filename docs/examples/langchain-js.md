# Example: LangChain.js using the Self-Healing API

This example shows a LangChain.js agent calling the API via OpenAPI and a direct POST.

## Using the OpenAPI Toolkit

```ts
import { JsonSpec, JsonObject } from "@langchain/core/tools";
import fetch from "node-fetch";

// Load OpenAPI spec from the running service
const specUrl = "http://localhost:8787/api/openapi.json";
const spec: JsonObject = await (await fetch(specUrl)).json();
const openApiTool = new JsonSpec({ spec });

// Example: POST /api/debug/run
const payload = {
  error_type: "SYNTAX",
  message: "Unexpected token",
  patch_code: "console.log('hello'",
  original_code: "console.log('hello'",
  maxAttempts: 2
};

const response = await fetch("http://localhost:8787/api/debug/run", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
});
const result = await response.json();
console.log("Action:", result.action);
console.log("Envelope ID:", result.envelope?.patch_id);
```

Notes:
- Alternatively, register a DynamicTool that wraps the POST call and let the agent decide when to invoke it.
