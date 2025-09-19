<#
setup-opinionated.ps1
Opinionated, more-automatic setup helper. It is cautious: it will NOT write to system files unless run as Administrator.

Behavior:
- Builds the project
- Starts the API (using ensure-api-server.js)
- Installs & configures pm2 (global) and starts the app under pm2
- If run as Administrator: adds hosts entry for api.localhost -> 127.0.0.1 and deploys Apache vhost
- If run as non-admin: prints the exact commands the admin should run (hosts + Apache steps)
- Optionally attempts NSSM installation if nssm.exe is found on PATH

Usage:
  powershell -ExecutionPolicy Bypass -File scripts/setup-opinionated.ps1 [-NoHosts] [-NoApache] [-UseNssm]

#>
