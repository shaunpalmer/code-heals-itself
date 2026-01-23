# PHP + VS Code MCP Quickstart

This project already ships a PHP API and a minimal MCP-style tool shim. The steps below wire it into VS Code via a stdio MCP proxy so you can call the PHP healer from Copilot/Agent mode.

## What Exists Today
- PHP API entrypoint: public/index.php (routes /status, /heal, /classify, /mcp/tool)
- MCP-style tool shim (HTTP): POST /mcp/tool in api/handlers/MCPToolHandler.php
- New MCP stdio proxy (Node): src/mcp/php-proxy.ts (for VS Code MCP)

## Fast Path (PHP-first)

### 1) Install deps
- npm install
- composer install (only if vendor/ is missing)

### 2) Start PHP API (built-in server)
From repo root:

php -S 127.0.0.1:8000 -t public public/server-router.php

If port 8000 is blocked, use 8010 instead:

php -S 127.0.0.1:8010 -t public public/server-router.php

This routes /mcp/tool to the PHP healer.

### 3) Build + Start MCP proxy (stdio)
In another terminal:

npm run build
set PHP_API_BASE=http://127.0.0.1:8000
npm run start:mcp:php

### 4) Configure VS Code MCP
Create or update .vscode/mcp.json:

{
  "servers": {
    "code-heals-itself-php": {
      "type": "stdio",
      "command": "node",
      "args": ["dist/src/mcp/php-proxy.js"],
      "env": {
        "PHP_API_BASE": "http://127.0.0.1:8000"
      }
    }
  }
}

You should now see tool debug.run available in MCP-compatible clients.

## Optional: Smoke Test
With the PHP API running:

php tests/php/smoke_http.php

## Notes
- The PHP MCP shim accepts code + error metadata and runs the PHP AIDebugger directly.
- If you want TypeScript-based healing instead, use npm run start:mcp (existing MCP server).
- LM Studio is optional for the PHP flow unless you wire a model into the PHP healing pipeline.