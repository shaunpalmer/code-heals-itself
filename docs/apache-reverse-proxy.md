# Advanced XAMPP Reverse Proxy Configuration

This document provides comprehensive guidance for setting up and troubleshooting the Apache reverse proxy for the self-healing debugger API.

## Architecture Overview

```
Internet → Apache (Port 80/443) → Node.js API (Port 8787)
                ↓
         Static Files (htdocs)
```

The reverse proxy setup allows:
- Serving static files from Apache's document root
- Routing API calls to the Node.js application
- SSL termination at Apache level
- Request filtering and security headers
- Load balancing (if multiple Node.js instances)

## Complete VirtualHost Configuration

### Basic HTTP Setup
```apache
<VirtualHost *:80>
    ServerName localhost
    ServerAlias api.localhost
    DocumentRoot "C:/xampp/htdocs"

    # Enable proxy modules
    <IfModule mod_proxy.c>
        ProxyPreserveHost On
        ProxyRequests Off
        ProxyTimeout 300

        # API routing
        ProxyPass "/api" "http://127.0.0.1:8787/api"
        ProxyPassReverse "/api" "http://127.0.0.1:8787/api"

        # Health check (optional)
        ProxyPass "/health" "http://127.0.0.1:8787/health"
        ProxyPassReverse "/health" "http://127.0.0.1:8787/health"
    </IfModule>

    # Security headers
    <Location "/api">
        Header always set X-Frame-Options DENY
        Header always set X-Content-Type-Options nosniff
        Header always set X-XSS-Protection "1; mode=block"
    </Location>

    # Directory permissions
    <Directory "C:/xampp/htdocs">
        Require all granted
        AllowOverride All
        Options Indexes FollowSymLinks
    </Directory>

    # Logging
    ErrorLog "logs/api-error.log"
    CustomLog "logs/api-access.log" combined
</VirtualHost>
```

### HTTPS/SSL Configuration
```apache
<VirtualHost *:443>
    ServerName localhost
    DocumentRoot "C:/xampp/htdocs"

    # SSL Configuration
    SSLEngine on
    SSLCertificateFile "C:/xampp/apache/conf/ssl.crt/server.crt"
    SSLCertificateKeyFile "C:/xampp/apache/conf/ssl.key/server.key"
    SSLProtocol all -SSLv2 -SSLv3
    SSLCipherSuite HIGH:!aNULL:!MD5

    # Same proxy configuration as HTTP
    <IfModule mod_proxy.c>
        ProxyPass "/api" "http://127.0.0.1:8787/api"
        ProxyPassReverse "/api" "http://127.0.0.1:8787/api"
    </IfModule>

    # HSTS for security
    Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains"
</VirtualHost>

# Redirect HTTP to HTTPS
<VirtualHost *:80>
    ServerName localhost
    Redirect permanent / https://localhost/
</VirtualHost>
```

## Advanced Features

### Load Balancing (Multiple Node.js Instances)
```apache
<Proxy "balancer://api_cluster">
    BalancerMember "http://127.0.0.1:8787/api" route=node1
    BalancerMember "http://127.0.0.1:8788/api" route=node2
    ProxySet lbmethod=byrequests
</Proxy>

ProxyPass "/api" "balancer://api_cluster/"
ProxyPassReverse "/api" "balancer://api_cluster/"
```

### WebSocket Support
```apache
# For WebSocket connections (if your API supports them)
ProxyPass "/ws" "ws://127.0.0.1:8787/ws"
ProxyPassReverse "/ws" "ws://127.0.0.1:8787/ws"
```

### Request Filtering
```apache
# Block certain request methods
<Location "/api">
    <RequireAll>
        Require all granted
        Require method GET POST PUT DELETE
    </RequireAll>
</Location>

# Rate limiting (requires mod_ratelimit)
<Location "/api">
    SetOutputFilter RATE_LIMIT
    SetEnv rate-limit 100
</Location>
```

## Monitoring and Debugging

### Enable Debug Logging
```apache
# In httpd.conf or VirtualHost
LogLevel debug
ProxyPassLogLevel debug

# Custom log format for API requests
LogFormat "%h %l %u %t \"%r\" %>s %b \"%{Referer}i\" \"%{User-Agent}i\" %{ms}T" api_debug
CustomLog "logs/api-debug.log" api_debug
```

### Health Check Endpoints
```apache
# Simple health check
ProxyPass "/api/health" "http://127.0.0.1:8787/health"
ProxyPassReverse "/api/health" "http://127.0.0.1:8787/health"

# Detailed status (if available)
ProxyPass "/api/status" "http://127.0.0.1:8787/status"
ProxyPassReverse "/api/status" "http://127.0.0.1:8787/status"
```

## Common Issues and Solutions

### Connection Refused
**Problem**: Apache can't connect to Node.js
**Solutions**:
- Verify Node.js is running: `netstat -ano | findstr 8787`
- Check firewall settings
- Ensure correct IP address (127.0.0.1 vs localhost)

### 502 Bad Gateway
**Problem**: Node.js server is not responding
**Solutions**:
- Increase ProxyTimeout
- Check Node.js error logs
- Verify Node.js health endpoint

### 403 Forbidden
**Problem**: Proxy modules not loaded or permissions issue
**Solutions**:
- Verify modules are enabled in httpd.conf
- Check file permissions
- Ensure VirtualHost is properly configured

### Performance Issues
**Problem**: Slow response times
**Solutions**:
- Enable connection pooling
- Adjust ProxyTimeout
- Monitor resource usage
- Consider load balancing

## Security Considerations

### Network Security
- Use HTTPS for production
- Implement proper SSL/TLS configuration
- Restrict access to specific IP ranges if needed

### Application Security
- Validate all input in Node.js application
- Implement proper authentication/authorization
- Use security headers (CSP, HSTS, etc.)

### Monitoring
- Monitor Apache and Node.js logs
- Set up alerts for 5xx errors
- Track performance metrics

## Automation Scripts

The project includes several PowerShell scripts for automated setup:

- `scripts/apache-deploy-helper.ps1` - Deploy vhost configuration
- `scripts/setup-all.ps1` - Complete setup including Apache
- `scripts/pm2-setup.ps1` - Process management with PM2

## Testing the Setup

```bash
# Test direct connection
curl http://localhost:8787/api/health

# Test through proxy
curl http://localhost/api/health

# Test with custom headers
curl -H "X-API-Key: test" http://localhost/api/debug

# Test SSL (if configured)
curl -k https://localhost/api/health
```

This comprehensive setup provides a production-ready reverse proxy configuration for the self-healing debugger API.