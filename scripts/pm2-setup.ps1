# pm2-setup.ps1
# Install pm2 (if missing), start the Node API with pm2, and save startup configuration
param(
  [string]$AppPath = "C:\code-heals-itself",
  [string]$Entry = "dist/src/server/api.js",
  [string]$Name = "selfheal"
)

Write-Host "Ensuring pm2 is available..."
try {
  npm list -g pm2 | Out-Null
} catch { }

# Install pm2 globally if missing
$pm2Check = (npm list -g --depth=0 pm2 2>$null) -ne $null
if (-not $pm2Check) {
  Write-Host "Installing pm2 globally..."
  npm install -g pm2
}

Write-Host "Starting app with pm2..."
Push-Location $AppPath
pm2 start $Entry --name $Name --update-env
pm2 save
Write-Host "pm2 process list:"
pm2 ls
Pop-Location

Write-Host "pm2 setup complete. On Windows use 'pm2-windows-startup' or configure pm2 startup per documentation."