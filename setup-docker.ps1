# Docker Desktop Setup Script for Windows with WSL2
# Run this in an elevated PowerShell (Run as Administrator)

Write-Host "=== Docker Desktop Setup for Windows ===" -ForegroundColor Green

# Step 1: Verify prerequisites
Write-Host "`n1. Verifying prerequisites..." -ForegroundColor Yellow

$osVersion = (Get-CimInstance Win32_OperatingSystem).Caption
Write-Host "OS: $osVersion"

$virtEnabled = (Get-CimInstance Win32_Processor).VirtualizationFirmwareEnabled
if ($virtEnabled -contains $true -or $virtEnabled -eq $true) {
    Write-Host "Virtualization: Enabled" -ForegroundColor Green
} else {
    Write-Host "Virtualization: NOT ENABLED - Check BIOS/UEFI settings" -ForegroundColor Red
    exit 1
}

# Step 2: Enable WSL2 features
Write-Host "`n2. Enabling WSL2 features..." -ForegroundColor Yellow

try {
    dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
    dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
    Write-Host "WSL2 features enabled successfully" -ForegroundColor Green
} catch {
    Write-Host "Failed to enable WSL2 features: $_" -ForegroundColor Red
    exit 1
}

# Set WSL2 as default and update kernel
Write-Host "Setting WSL2 as default version..." -ForegroundColor Yellow
wsl --set-default-version 2
wsl --update

Write-Host "`n=== IMPORTANT ===" -ForegroundColor Red
Write-Host "Please reboot your computer now, then run the next part of the setup."
Write-Host "After reboot, run: wsl --install -d Ubuntu"
Write-Host "Then open Docker Desktop and configure WSL integration."
Write-Host "==================" -ForegroundColor Red

Write-Host "`nSetup script completed. Reboot required." -ForegroundColor Green