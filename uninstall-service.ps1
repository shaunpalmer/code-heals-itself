# Windows Service Uninstallation Script
# Removes the Code Heals Itself Windows service

# Configuration
$ServiceName = "CodeHealsItself"
$WorkingDir = $PSScriptRoot
$nssmPath = Join-Path $PSScriptRoot "nssm.exe"

# Check if running as Administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "ERROR: This script requires Administrator privileges" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

Write-Host "=== Code Heals Itself - Service Uninstaller ===" -ForegroundColor Cyan
Write-Host ""

# Check if service exists
$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $existingService) {
    Write-Host "Service '$ServiceName' not found." -ForegroundColor Yellow
    exit 0
}

Write-Host "Service found: $ServiceName" -ForegroundColor White
Write-Host "Status: $($existingService.Status)" -ForegroundColor White
Write-Host ""

$confirm = Read-Host "Remove this service? (y/n)"
if ($confirm -ne 'y') {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
}

# Stop service if running
if ($existingService.Status -eq 'Running') {
    Write-Host "Stopping service..." -ForegroundColor Yellow
    Stop-Service -Name $ServiceName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Remove service
Write-Host "Removing service..." -ForegroundColor Yellow
if (Test-Path $nssmPath) {
    & $nssmPath remove $ServiceName confirm
} else {
    sc.exe delete $ServiceName
}

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "Service removed successfully!" -ForegroundColor Green
