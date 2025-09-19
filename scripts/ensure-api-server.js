#!/usr/bin/env node
/* ensure-api-server.js
 * Ensures the TypeScript is built and the API server is running. If not running, starts it.
 */
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const http = require('http');

const PORT = Number(process.env.PORT) || 8787;

function isBuilt() {
  return fs.existsSync('dist/src/server/api.js');
}

function probeApi() {
  return new Promise(resolve => {
    const req = http.get({ hostname: 'localhost', port: PORT, path: '/health', timeout: 1200 }, res => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

(async function main() {
  if (!isBuilt()) {
    console.log('[ensure-api] building...');
    execSync('npm run build --silent', { stdio: 'inherit' });
  }
  const up = await probeApi();
  if (up) {
    console.log(`[ensure-api] API already up on port ${PORT}`);
    return;
  }
  console.log('[ensure-api] starting API server...');
  const child = spawn('node', ['dist/src/server/api.js'], { stdio: 'inherit' });
  child.on('exit', code => console.log(`[ensure-api] api process exited code=${code}`));
})();
