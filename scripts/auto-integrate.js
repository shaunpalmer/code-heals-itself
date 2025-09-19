#!/usr/bin/env node
/* auto-integrate.js
 * Attempts to auto-wire the debugger into local ecosystem components.
 * - Ensure API up (by calling ensure-api-server script logic inline)
 * - If LM Studio is up, print note on adding a function tool referencing /api/debug/run
 * - If MCP server not running, offer guidance (MCP runs via npm run start:mcp)
 */
const { execSync, spawnSync } = require('child_process');
const http = require('http');
const fs = require('fs');

const PORT = Number(process.env.PORT) || 8787;

function isBuilt() { return fs.existsSync('dist/src/server/api.js'); }
function build() { execSync('npm run build --silent', { stdio: 'inherit' }); }
function probe(port, path = '/', timeout = 800) {
  return new Promise(resolve => {
    const req = http.get({ hostname: 'localhost', port, path, timeout }, res => resolve({ up: true, status: res.statusCode }));
    req.on('error', () => resolve({ up: false }));
    req.on('timeout', () => { req.destroy(); resolve({ up: false }); });
  });
}
async function ensureApi() {
  if (!isBuilt()) build();
  const health = await probe(PORT, '/health');
  if (health.up) return { started: false };
  console.log('[auto-integrate] starting API server');
  const child = spawnSync('node', ['dist/src/server/api.js'], { timeout: 2000 });
  if (child.status !== 0) console.warn('[auto-integrate] API start may have failed.');
  return { started: true };
}
function probeMcp() {
  try { const out = execSync('node dist/src/mcp/server.js --probe', { stdio: ['ignore', 'pipe', 'pipe'], timeout: 2000 }).toString('utf8'); return { up: true, info: JSON.parse(out) }; } catch { return { up: false }; }
}
function guidance(summary) {
  console.log('\n=== Integration Guidance ===');
  if (summary.lm.up) {
    console.log('* LM Studio detected: Add an HTTP function tool pointing to POST http://localhost:' + PORT + '/api/debug/run with JSON body matching /api/schemas/debug.json');
  } else {
    console.log('* LM Studio not detected (port 1234). If running elsewhere set LM_STUDIO_PORT.');
  }
  if (!summary.mcp.up) {
    console.log('* MCP server not running. Start with: npm run start:mcp (then configure your MCP-compatible client).');
  } else {
    console.log('* MCP server tools: ' + summary.mcp.info.tools.join(', '));
  }
  console.log('* CrewAI: ensure Python crewai installed then adapt docs/integration-crewai.md tool wrapper.');
  console.log('* n8n: see docs/integration-n8n.md to set up HTTP Request node referencing /api/debug/run.');
}
(async function main() {
  const apiResult = await ensureApi();
  const lm = await probe(Number(process.env.LM_STUDIO_PORT) || 1234, '/');
  const mcp = probeMcp();
  const summary = { api: apiResult, lm, mcp };
  console.log(JSON.stringify(summary, null, 2));
  guidance(summary);
})();
