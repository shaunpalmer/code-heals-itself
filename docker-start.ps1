# Quick start script for Docker MCP architecture
# Run this after Docker Desktop is running

Write-Host "=== Code-Heals-Itself Docker Setup ===" -ForegroundColor Green

# Check Docker is running
Write-Host "`n1. Checking Docker status..." -ForegroundColor Yellow
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Build containers
Write-Host "`n2. Building containers..." -ForegroundColor Yellow
docker compose build

# Start core services
Write-Host "`n3. Starting core services..." -ForegroundColor Yellow
docker compose up -d lmstudio dashboard

# Wait for services to be ready
Write-Host "`n4. Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check service status
Write-Host "`n5. Service status:" -ForegroundColor Yellow
docker compose ps

# Show access URLs
Write-Host "`n=== Services Ready ===" -ForegroundColor Green
Write-Host "Dashboard:   http://localhost:5000" -ForegroundColor Cyan
Write-Host "LM Studio:   http://localhost:1234/v1" -ForegroundColor Cyan
Write-Host "`nView logs:   docker compose logs -f" -ForegroundColor Yellow
Write-Host "Stop all:    docker compose down" -ForegroundColor Yellow

Write-Host "`n=== VS Code Dev Container ===" -ForegroundColor Green
Write-Host "1. Install 'Dev Containers' extension" -ForegroundColor Cyan
Write-Host "2. Press Ctrl+Shift+P" -ForegroundColor Cyan
Write-Host "3. Run: 'Dev Containers: Reopen in Container'" -ForegroundColor Cyan
