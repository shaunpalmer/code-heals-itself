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

## XAMPP Reverse Proxy Configuration

### Detailed Apache Setup

1. **Enable Required Modules** in `C:\xampp\apache\conf\httpd.conf`:
   ```apache
   # Uncomment these lines:
   LoadModule proxy_module modules/mod_proxy.so
   LoadModule proxy_http_module modules/mod_proxy_http.so
   LoadModule proxy_balancer_module modules/mod_proxy_balancer.so
   LoadModule lbmethod_byrequests_module modules/mod_lbmethod_byrequests.so
   ```

2. **Enable Virtual Hosts** in `C:\xampp\apache\conf\httpd.conf`:
   ```apache
   # Uncomment this line:
   Include conf/extra/httpd-vhosts.conf
   ```

3. **Deploy Virtual Host Configuration**:
   ```powershell
   npm run setup:apache-vhost
   # Or manually:
   # Copy scripts/apache-vhost.conf.example to C:\xampp\apache\conf\extra\httpd-vhosts.conf
   ```

### Reverse Proxy Features

The provided configuration includes:
- **Path-based routing**: Only `/api/*` requests are proxied to Node.js
- **Host preservation**: Original host headers are maintained
- **Request/response rewriting**: URLs are properly rewritten for responses
- **Logging**: Separate log files for API requests
- **Security**: Isolated proxy configuration

### Alternative Configurations

**Option 1: Full Domain Proxy** (uncomment in vhost file):
```apache
<VirtualHost *:80>
    ServerName api.localhost
    ProxyPass "/" "http://127.0.0.1:8787/"
    ProxyPassReverse "/" "http://127.0.0.1:8787/"
</VirtualHost>
```

**Option 2: HTTPS/SSL Support**:
```apache
<VirtualHost *:443>
    ServerName localhost
    SSLEngine on
    SSLCertificateFile "C:/xampp/apache/conf/ssl.crt/server.crt"
    SSLCertificateKeyFile "C:/xampp/apache/conf/ssl.key/server.key"
    
    ProxyPass "/api" "http://127.0.0.1:8787/api"
    ProxyPassReverse "/api" "http://127.0.0.1:8787/api"
</VirtualHost>
```

### Performance & Security Tuning

**Connection Pooling**:
```apache
# Add to httpd.conf for better performance
ProxyMaxConnectionsPerChild 0
ProxyTimeout 300
```

**Security Headers** (add to VirtualHost):
```apache
# Prevent information disclosure
ProxyAddHeaders Off
RequestHeader unset Authorization

# Add security headers
Header always set X-Frame-Options DENY
Header always set X-Content-Type-Options nosniff
```

**Rate Limiting** (requires mod_ratelimit):
```apache
<Location "/api">
    SetOutputFilter RATE_LIMIT
    SetEnv rate-limit 100  # requests per minute
</Location>
```

## Optional Extensions Setup

The system includes several optional extensions for enhanced code quality and security validation:

### Linting Extensions
```bash
# Install ESLint with advanced plugins (optional)
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-import eslint-plugin-security eslint-import-resolver-typescript eslint-import-resolver-alias

# Install Stylelint for CSS/SCSS (optional)
npm install --save-dev stylelint stylelint-config-standard stylelint-scss

# Install Zod for runtime validation (optional)
npm install zod
```

### Enable Extensions
```typescript
import { AIDebugger } from './ai-debugging';

const debugger = new AIDebugger({
  enable_enhanced_eslint: true,    // Advanced linting
  enable_stylelint: true,          // CSS/SCSS validation
  enable_zod_validation: true      // Runtime schema validation
});
```

See `EXTENSIONS.md` for complete documentation on all available extensions.

## Troubleshooting

### API Server Issues
- **API not starting?** Check Node version and dependencies: `npm install`
- **Port conflicts?** Change Node port via `PORT=8788 node dist/src/server/api.js`
- **Build failures?** Run `npm run build` and check for TypeScript errors

### Apache Reverse Proxy Issues
- **403 Forbidden?** Check that `mod_proxy` and `mod_proxy_http` are enabled in `httpd.conf`
- **404 Not Found?** Verify VirtualHost is included and ServerName matches request
- **Connection refused?** Ensure Node.js server is running on port 8787
- **Proxy timeout?** Add `ProxyTimeout 300` to VirtualHost configuration
- **CORS issues?** The proxy preserves host headers; check Node.js CORS settings

### Module Loading Problems
```bash
# Check if modules are loaded
httpd -M | findstr proxy
# Should show: proxy_module, proxy_http_module
```

### Virtual Host Conflicts
- **Multiple VirtualHosts?** Ensure only one default VirtualHost or use ServerName properly
- **Port issues?** Check that Apache is listening on port 80: `netstat -ano | findstr :80`

### SSL/HTTPS Setup
- **Certificate errors?** Generate self-signed cert: `openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365`
- **Mixed content?** Ensure all proxied URLs use consistent protocol

### Performance Issues
- **Slow responses?** Check network latency between Apache and Node.js
- **Memory usage?** Monitor both Apache and Node.js processes
- **Connection pooling?** Add `ProxyMaxConnectionsPerChild 0` to httpd.conf

### Quick Diagnostic Commands
```bash
# Test direct Node.js connection
curl http://localhost:8787/health

# Test Apache proxy
curl http://localhost/api/health

# Check Apache error logs
type C:\xampp\apache\logs\error.log | findstr -i proxy

# Check custom API logs
type C:\xampp\apache\logs\selfheal-error.log
```
