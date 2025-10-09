# Windows Service Installation Script
# Requires NSSM (Non-Sucking Service Manager)
# Download from: https://nssm.cc/download

# Configuration
$ServiceName = "CodeHealsItself"
$DisplayName = "Code Heals Itself Dashboard"
$Description = "Self-healing code dashboard with AI-powered debugging"
$PythonExe = (Get-Command python).Source
$ScriptPath = Join-Path $PSScriptRoot "dashboard_dev_server.py"
$WorkingDir = $PSScriptRoot

# Check if running as Administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "ERROR: This script requires Administrator privileges" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Check if NSSM is available
$nssmPath = Join-Path $PSScriptRoot "nssm.exe"
if (-not (Test-Path $nssmPath)) {
    Write-Host "ERROR: nssm.exe not found in $PSScriptRoot" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please download NSSM from: https://nssm.cc/download" -ForegroundColor Yellow
    Write-Host "Extract nssm.exe to: $PSScriptRoot" -ForegroundColor Yellow
    exit 1
}

Write-Host "=== Code Heals Itself - Windows Service Installer ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Service Name: $ServiceName"
Write-Host "Display Name: $DisplayName"
Write-Host "Python: $PythonExe"
Write-Host "Script: $ScriptPath"
Write-Host "Working Dir: $WorkingDir"
Write-Host ""

# Check if service already exists
$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Host "Service '$ServiceName' already exists!" -ForegroundColor Yellow
    $choice = Read-Host "Do you want to remove and reinstall? (y/n)"
    if ($choice -eq 'y') {
        Write-Host "Stopping service..." -ForegroundColor Yellow
        Stop-Service -Name $ServiceName -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        
        Write-Host "Removing service..." -ForegroundColor Yellow
        & $nssmPath remove $ServiceName confirm
        Start-Sleep -Seconds 2
    } else {
        Write-Host "Installation cancelled." -ForegroundColor Yellow
        exit 0
    }
}

# Install service
Write-Host "Installing service..." -ForegroundColor Green
& $nssmPath install $ServiceName $PythonExe $ScriptPath

# Configure service
Write-Host "Configuring service..." -ForegroundColor Green
& $nssmPath set $ServiceName AppDirectory $WorkingDir
& $nssmPath set $ServiceName DisplayName $DisplayName
& $nssmPath set $ServiceName Description $Description
& $nssmPath set $ServiceName Start SERVICE_AUTO_START
& $nssmPath set $ServiceName AppStdout "$WorkingDir\service.log"
& $nssmPath set $ServiceName AppStderr "$WorkingDir\service-error.log"
& $nssmPath set $ServiceName AppRotateFiles 1
& $nssmPath set $ServiceName AppRotateBytes 1048576  # 1MB

Write-Host ""
Write-Host "Service installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Commands:" -ForegroundColor Cyan
Write-Host "  Start service:   net start $ServiceName" -ForegroundColor White
Write-Host "  Stop service:    net stop $ServiceName" -ForegroundColor White
Write-Host "  Remove service:  $nssmPath remove $ServiceName" -ForegroundColor White
Write-Host ""
Write-Host "Logs:" -ForegroundColor Cyan
Write-Host "  Output: $WorkingDir\service.log" -ForegroundColor White
Write-Host "  Errors: $WorkingDir\service-error.log" -ForegroundColor White
Write-Host ""

$startNow = Read-Host "Start the service now? (y/n)"
if ($startNow -eq 'y') {
    Write-Host "Starting service..." -ForegroundColor Green
    Start-Service -Name $ServiceName
    Start-Sleep -Seconds 3
    
    $status = Get-Service -Name $ServiceName
    if ($status.Status -eq 'Running') {
        Write-Host ""
        Write-Host "Service is running!" -ForegroundColor Green
        Write-Host "Dashboard: http://127.0.0.1:5000" -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "WARNING: Service failed to start. Check logs." -ForegroundColor Red
    }
}
