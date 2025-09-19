#!/usr/bin/env node
/*
 * status.js - Probe ecosystem components and print a JSON status summary.
 * Checks:
 *  - API server (local) reachable
 *  - MCP server probe (via node dist/src/mcp/server.js --probe)
 *  - LM Studio (default port 1234) optional
 *  - LangChain presence (require('@langchain/core'))
 *  - CrewAI presence (python -c 'import crewai')
 */
const { execSync, spawnSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

function checkApi(port) {
  return new Promise(resolve => {
    const req = http.get({ hostname: 'localhost', port, path: '/health', timeout: 1500 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { const j = JSON.parse(data); resolve({ up: true, data: j }); } catch { resolve({ up: true }); }
      });
    });
    req.on('error', () => resolve({ up: false }));
    req.on('timeout', () => { req.destroy(); resolve({ up: false }); });
  });
}

function checkMcp() {
  try {
    const out = execSync('node dist/src/mcp/server.js --probe', { stdio: ['ignore', 'pipe', 'pipe'], timeout: 3000 }).toString('utf8');
    const j = JSON.parse(out.trim());
    return { up: true, tools: j.tools };
  } catch (e) {
    return { up: false };
  }
}

function checkLmStudio(port = 1234) {
  return new Promise(resolve => {
    const req = http.get({ hostname: 'localhost', port, path: '/', timeout: 800 }, res => {
      resolve({ up: true, status: res.statusCode });
    });
    req.on('error', () => resolve({ up: false }));
    req.on('timeout', () => { req.destroy(); resolve({ up: false }); });
  });
}

function checkLangChain() {
  try { require.resolve('@langchain/core'); return { installed: true }; } catch { return { installed: false }; }
}

function checkCrewAI() {
  try {
    const r = spawnSync('python', ['-c', 'import crewai, json; print("OK")'], { timeout: 3000 });
    if (r.status === 0 && /OK/.test(String(r.stdout))) return { installed: true };
    return { installed: false };
  } catch { return { installed: false }; }
}

(async function main() {
  const apiPort = Number(process.env.PORT) || 8787;
  const api = await checkApi(apiPort);
  const mcp = checkMcp();
  const lm = await checkLmStudio();
  const langchain = checkLangChain();
  const crewai = checkCrewAI();
  const summary = { timestamp: new Date().toISOString(), apiPort, api, mcp, lmStudio: lm, langchain, crewai };
  console.log(JSON.stringify(summary, null, 2));
})();
