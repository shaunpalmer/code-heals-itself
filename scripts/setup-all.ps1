<#
setup-all.ps1
Combined helper to build the project, start the API, optionally configure pm2 or NSSM, and deploy the Apache vhost.
Usage examples:
  # Build, start API, setup pm2 and deploy apache vhost (defaults)
  powershell -ExecutionPolicy Bypass -File scripts/setup-all.ps1

  # Build + start API only
  powershell -ExecutionPolicy Bypass -File scripts/setup-all.ps1 -StartApi:$true -UsePm2:$false -UseNssm:$false -DeployApache:$false

  # Use NSSM instead of pm2
  powershell -ExecutionPolicy Bypass -File scripts/setup-all.ps1 -UseNssm

Parameters:
  -XamppPath   Path to XAMPP installation (default C:\xampp)
  -UsePm2      Switch: configure pm2 (default true)
  -UseNssm     Switch: configure NSSM (optional)
  -DeployApache Switch: copy vhost example into XAMPP and open control panel
  -StartApi    Switch: ensure API is built and started (default true)
#>
param(
  [string]$XamppPath = "C:\\xampp",
  [switch]$UsePm2 = $true,
  [switch]$UseNssm = $false,
  [switch]$DeployApache = $true,
  [switch]$StartApi = $true
)

function run-cmd($cmd, $args=[]) {
  Write-Host "Running: $cmd $($args -join ' ')"
  $p = Start-Process -FilePath $cmd -ArgumentList $args -NoNewWindow -PassThru -Wait
  return $p.ExitCode
}

Write-Host "== setup-all: starting at $(Get-Date) =="
$root = (Resolve-Path -Path "./").ProviderPath
Write-Host "Project root: $root"

if ($StartApi) {
  Write-Host "Building project..."
  # Prefer using npm run build to respect package scripts
  $rc = run-cmd "npm" @('run','build')
  if ($rc -ne 0) { Write-Host "Build failed (rc=$rc). Aborting." -ForegroundColor Red; exit $rc }

  Write-Host "Ensuring API server is running (it will start if needed)..."
  # Use the small helper ensure-api-server.js which builds and starts if necessary
  try {
    Start-Process -FilePath "node" -ArgumentList "scripts/ensure-api-server.js" -WindowStyle Hidden
    Start-Sleep -Seconds 1
  } catch {
    Write-Host "Failed to start ensure-api-server.js: $_" -ForegroundColor Yellow
  }
}

if ($UsePm2) {
  Write-Host "Setting up pm2 for the app..."
  try {
    Start-Process -FilePath "powershell" -ArgumentList "-ExecutionPolicy Bypass -File scripts/pm2-setup.ps1 -AppPath $root" -NoNewWindow
  } catch {
    Write-Host "pm2 setup failed: $_" -ForegroundColor Yellow
  }
}

if ($UseNssm) {
  Write-Host "Attempting NSSM install (ensure nssm.exe path inside script or on PATH)..."
  try {
    Start-Process -FilePath "powershell" -ArgumentList "-ExecutionPolicy Bypass -File scripts/nssm-install.ps1" -NoNewWindow
  } catch {
    Write-Host "NSSM install failed: $_" -ForegroundColor Yellow
  }
}

if ($DeployApache) {
  Write-Host "Deploying Apache vhost (copy example into XAMPP and open control panel)..."
  try {
    Start-Process -FilePath "powershell" -ArgumentList "-ExecutionPolicy Bypass -File scripts/apache-deploy-helper.ps1 -XamppPath '$XamppPath' -ProjectPath '$root'" -NoNewWindow
  } catch {
    Write-Host "Apache deploy helper failed: $_" -ForegroundColor Yellow
  }
}

Write-Host "== setup-all finished =="
Write-Host "Check API health: http://localhost:8787/health or proxied http://localhost/api/health (after Apache restart)."