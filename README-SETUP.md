Quick Setup Guide — Node API + XAMPP Reverse Proxy

## Overview
This guide helps you integrate the self-healing debugger's Node.js API with XAMPP/Apache without moving the project into `htdocs`. The Node app runs on port 8787, and Apache reverse-proxies `/api` requests to it.

## Prerequisites
- Node.js v22+ installed (check with `node --version`)
- XAMPP installed (default path: `C:\xampp`)
- Enable Apache modules: `mod_proxy` and `mod_proxy_http` in `C:\xampp\apache\conf\httpd.conf`

## Quick Commands
### Build the Project
```bash
npm run build
```

### Start API (Foreground)
```bash
node dist/src/server/api.js
```

### Start API (Background)
```powershell
Start-Process -NoNewWindow -FilePath "node" -ArgumentList "dist/src/server/api.js"
```

### One-Line Setup (Build + Start + PM2 + Apache Helper)
```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-all.ps1
```

## Files Added
- `scripts/apache-vhost.conf.example` — Example Apache virtual host to proxy `/api` to Node
- `scripts/apache-deploy-helper.ps1` — Copies vhost into XAMPP and opens control panel
- `scripts/pm2-setup.ps1` — Starts app with pm2 and saves process list
- `scripts/nssm-install.ps1` — Installs Node app as Windows service via NSSM
- `scripts/setup-all.ps1` — Runs the above helpers in sequence

## Configuration Steps
1. **Build and Start Node API**:
   ```bash
   npm run build
   node dist/src/server/api.js
   ```
   Verify: `curl http://localhost:8787/health`

2. **Configure Apache Proxy**:
   - Copy `scripts/apache-vhost.conf.example` to `C:\xampp\apache\conf\extra\httpd-vhosts.conf`
   - Restart Apache via XAMPP Control Panel
   - Verify: `curl http://localhost/api/health`

3. **Optional: Run as Service**:
   - Use pm2: `npm run setup:pm2`
   - Or NSSM: `npm run setup:nssm` (requires NSSM installed)

## Notes
- If using a different Node port, update the vhost example
- For production, set up TLS and restrict proxy rules
- See `docs/API.md` for full endpoint documentation
- See `docs/integration-*.md` for ecosystem integrations (CrewAI, MCP, n8n, etc.)

## Troubleshooting
- API not starting? Check Node version and dependencies: `npm install`
- Apache proxy not working? Ensure modules are enabled and vhost is included
- Port conflicts? Change Node port via `PORT=8788 node dist/src/server/api.js`
