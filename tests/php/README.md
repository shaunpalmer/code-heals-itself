# PHP Smoke Tests (XAMPP-friendly)

This folder contains a PHP HTTP smoke test that exercises the healer API through your local web server (XAMPP/Apache or PHP built-in server).

## What it covers
- GET /status
- POST /mcp/tool (tool: debug.run)
  - Clean PHP syntax → expects decision: COMPLETE
  - Common syntax error → expects not COMPLETE (php -l gate)
- POST /heal
  - Small logic error → expects action: CONTINUE

## How to run

1) Ensure the API is served at one of these URLs (in order):
   - http://localhost/api  (preferred XAMPP alias)
   - http://localhost      (served at web root)
   - http://127.0.0.1/api
   - http://127.0.0.1
   - http://127.0.0.1:8000/api (PHP built-in server or Docker)

   XAMPP setup (Apache on Windows, C:\xampp\htdocs):
   - Option A: Apache Alias (recommended, no copy):
     Add to your Apache config (httpd.conf or conf/extra/httpd-vhosts.conf):

         Alias /api "C:/code-heals-itself/public"
         <Directory "C:/code-heals-itself/public">
             AllowOverride All
             Require all granted
         </Directory>

     Then restart Apache (XAMPP Control Panel). The provided `public/.htaccess` will route to `index.php`.

   - Option B: Serve at root:
     Copy (or symlink/junction) the `public` folder contents into `C:\xampp\htdocs`,
     or create a virtual host pointing to `C:/code-heals-itself/public`. The smoke test
     will also try `http://localhost` if `/api` isn’t set up.

2) Run the smoke test via PHP CLI:

```powershell
php tests/php/smoke_http.php

Optional: Gearbox + delta trend test (CLI):

php tests/test_gearbox_delta.php
```

Optionally, override the base URL:

```powershell
$env:API_BASE_URL = "http://localhost/api"
php tests/php/smoke_http.php
```

If the API isn’t reachable, the script will exit with a helpful message and a non-zero code.
