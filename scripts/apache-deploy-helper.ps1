# apache-deploy-helper.ps1
# Copies the example vhost file into XAMPP and restarts Apache using the XAMPP control script if available.
param(
  [string]$XamppPath = "C:\\xampp",
  [string]$ProjectPath = "C:\\code-heals-itself"
)

$vhostSrc = Join-Path $ProjectPath 'scripts\apache-vhost.conf.example'
$vhostDest = Join-Path $XamppPath 'apache\conf\extra\httpd-vhosts.conf'

if (-not (Test-Path $vhostSrc)) { Write-Host "vhost example not found: $vhostSrc"; exit 1 }
if (-not (Test-Path $XamppPath)) { Write-Host "XAMPP path not found: $XamppPath"; exit 1 }

Write-Host "Backing up existing vhosts..."
Copy-Item $vhostDest ($vhostDest + '.bak') -Force
Write-Host "Copying example vhost to XAMPP..."
Copy-Item $vhostSrc $vhostDest -Force

# Try to restart Apache via xampp-control (best-effort)
$control = Join-Path $XamppPath 'xampp-control.exe'
if (Test-Path $control) {
  Write-Host "Please restart Apache from XAMPP Control Panel or run the GUI. Attempting to start via control panel will open the app..."
  Start-Process $control
} else {
  Write-Host "Could not find xampp-control.exe. Please restart Apache manually from the XAMPP Control Panel." -ForegroundColor Yellow
}

Write-Host "Done. After Apache restart, verify proxy with: http://localhost/api/health"