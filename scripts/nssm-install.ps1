# nssm-install.ps1
# Guidance: this script expects nssm.exe to be on PATH or supplied via $NssmPath
param(
  [string]$NssmPath = "C:\\nssm\\nssm.exe",
  [string]$ServiceName = "SelfHealService",
  [string]$NodeExe = "C:\\Program Files\\nodejs\\node.exe",
  [string]$AppEntry = "C:\\code-heals-itself\\dist\\src\\server\\api.js",
  [string]$AppDir = "C:\\code-heals-itself"
)

if (-not (Test-Path $NssmPath)) {
  Write-Host "nssm not found at $NssmPath. Download from https://nssm.cc/ and set path or run manually." -ForegroundColor Yellow
  exit 1
}

Write-Host "Installing Windows service via NSSM: $ServiceName"
& $NssmPath install $ServiceName $NodeExe $AppEntry
& $NssmPath set $ServiceName AppDirectory $AppDir
& $NssmPath set $ServiceName AppStdout C:\\code-heals-itself\\logs\\selfheal-out.log
& $NssmPath set $ServiceName AppStderr C:\\code-heals-itself\\logs\\selfheal-err.log
& $NssmPath start $ServiceName
Write-Host "Service $ServiceName installed and started (check Windows Services)."