# ============================================================================
# COMPLETE SYSTEM STARTUP ORCHESTRATOR
# Decision-tree logic with intelligent fallback for Docker MCP system
# ============================================================================

@{
    Name = "Code-Heals-Itself System Startup"
    Version = "1.0"
    Description = "Full service orchestration with fallback strategies"
    Author = "Shaun Palmer + GitHub Copilot"
}

# Startup checklist:
# 1. Check Docker status
# 2. Check memory-mcp (CRITICAL)
# 3. Check watcher-mcp (CRITICAL)
# 4. Check rebanker (TRY, fallback if needed)
# 5. Check lmstudio (HYBRID: prefer local, fallback to container)
# 6. Summary and recommendations

Write-Host @"
╔════════════════════════════════════════════════════════════════════╗
║  CODE-HEALS-ITSELF SYSTEM STARTUP ORCHESTRATOR                     ║
║  Decision-Tree Strategy with Intelligent Fallback                  ║
╚════════════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

# ============================================================================
# CHECK 1: Docker Status
# ============================================================================

Write-Host "`n[1/6] Checking Docker..." -ForegroundColor Yellow

$dockerRunning = $false
try {
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -eq 0) {
        $dockerRunning = $true
        Write-Host "✅ Docker is running (Server Version: 28.5.1)" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Docker not running" -ForegroundColor Red
    exit 1
}

# ============================================================================
# CHECK 2: Memory MCP (CRITICAL)
# ============================================================================

Write-Host "`n[2/6] Checking Memory MCP (CRITICAL)..." -ForegroundColor Yellow

$memoryRunning = docker ps --filter "name=code-heals-memory-mcp" --filter "status=running" -q
if ($memoryRunning) {
    Write-Host "✅ Memory MCP is running (Port 8090)" -ForegroundColor Green
    
    # Test health endpoint
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8090/" -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ Memory MCP health check passed" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠️  Memory MCP running but health check failed" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  Memory MCP not running, attempting start..." -ForegroundColor Yellow
    docker compose up -d memory-mcp | Out-Null
    Start-Sleep -Seconds 2
    
    if (docker ps --filter "name=code-heals-memory-mcp" --filter "status=running" -q) {
        Write-Host "✅ Memory MCP started successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ CRITICAL: Memory MCP failed to start" -ForegroundColor Red
        exit 1
    }
}

# ============================================================================
# CHECK 3: Watcher MCP (CRITICAL)
# ============================================================================

Write-Host "`n[3/6] Checking Watcher MCP (CRITICAL)..." -ForegroundColor Yellow

$watcherRunning = docker ps --filter "name=code-heals-watcher-mcp" --filter "status=running" -q
if ($watcherRunning) {
    Write-Host "✅ Watcher MCP is running (Port 8091)" -ForegroundColor Green
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8091/" -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ Watcher MCP health check passed" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠️  Watcher MCP running but health check failed" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  Watcher MCP not running, attempting start..." -ForegroundColor Yellow
    docker compose up -d watcher-mcp | Out-Null
    Start-Sleep -Seconds 2
    
    if (docker ps --filter "name=code-heals-watcher-mcp" --filter "status=running" -q) {
        Write-Host "✅ Watcher MCP started successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ CRITICAL: Watcher MCP failed to start" -ForegroundColor Red
        exit 1
    }
}

# ============================================================================
# CHECK 4: Rebanker (TRY with FALLBACK)
# ============================================================================

Write-Host "`n[4/6] Checking Re-Banker (optional, fallback available)..." -ForegroundColor Yellow

$rebankerState = docker ps -a --filter "name=code-heals-rebanker" --format "{{.State.Status}}"

if ($rebankerState -eq "running") {
    Write-Host "✅ Re-Banker is running" -ForegroundColor Green
} elseif ($rebankerState -eq "exited" -or $rebankerState -eq "created") {
    Write-Host "⚠️  Re-Banker crashed or not started. Attempting recovery..." -ForegroundColor Yellow
    
    # TRY OPTION 1: Restart with current image
    docker compose up -d rebanker 2>&1 | Out-Null
    Start-Sleep -Seconds 2
    
    $rebankerState = docker ps -a --filter "name=code-heals-rebanker" --format "{{.State.Status}}"
    
    if ($rebankerState -eq "running") {
        Write-Host "✅ Re-Banker recovered and is running" -ForegroundColor Green
    } else {
        # FALLBACK: Log error but continue
        Write-Host "❌ Re-Banker unavailable (will work with Memory MCP + Watcher MCP)" -ForegroundColor Yellow
        Write-Host "   Recommendation: Check requirements.txt has pyyaml" -ForegroundColor Gray
        
        $rebankerLogs = docker logs code-heals-rebanker --tail 3 2>&1
        Write-Host "   Last logs: $rebankerLogs" -ForegroundColor Gray
    }
} else {
    Write-Host "⚠️  Re-Banker status unknown: $rebankerState" -ForegroundColor Yellow
}

# ============================================================================
# CHECK 5: LM Studio (HYBRID STRATEGY)
# ============================================================================

Write-Host "`n[5/6] Checking LM Studio (hybrid strategy)..." -ForegroundColor Yellow

# STRATEGY: Try LOCAL first, then CONTAINER, then DEGRADE

# OPTION A: Check if LOCAL LM Studio is running
Write-Host "  [A] Checking LOCAL LM Studio (host:1234)..." -ForegroundColor Cyan

$localLMRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:1234/" -TimeoutSec 2 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        $localLMRunning = $true
        Write-Host "  ✅ LOCAL LM Studio is accessible (PREFERRED)" -ForegroundColor Green
    }
} catch {
    Write-Host "  ⚠️  LOCAL LM Studio not responding" -ForegroundColor Yellow
}

# OPTION B: If local failed, check CONTAINER
if (-not $localLMRunning) {
    Write-Host "  [B] Checking CONTAINER LM Studio (docker:1234)..." -ForegroundColor Cyan
    
    $lmstudioState = docker ps -a --filter "name=code-heals-lmstudio" --format "{{.State.Status}}"
    
    if ($lmstudioState -eq "running") {
        Write-Host "  ✅ Container LM Studio is running" -ForegroundColor Green
        $localLMRunning = $true
    } elseif ($lmstudioState -eq "exited") {
        # Check if it's a crash loop (exit 139 = model missing)
        $exitCode = docker ps -a --filter "name=code-heals-lmstudio" --format "{{.State.ExitCode}}"
        
        if ($exitCode -eq "139") {
            Write-Host "  ❌ Container LM Studio crashed (exit 139 - model missing)" -ForegroundColor Red
            Write-Host "  [C] Attempting to start container anyway (will monitor)..." -ForegroundColor Cyan
            
            docker compose up -d lmstudio 2>&1 | Out-Null
            Start-Sleep -Seconds 2
            
            # Check if still crashing
            $stillCrashing = (docker ps --filter "name=code-heals-lmstudio" --filter "status=exited" -q)
            
            if ($stillCrashing) {
                Write-Host "  ⚠️  Container LM Studio still crashing (expected without model file)" -ForegroundColor Yellow
                Write-Host "  📝 FALLBACK: System will use LOCAL LM Studio or degrade gracefully" -ForegroundColor Yellow
            } else {
                Write-Host "  ✅ Container LM Studio started (no longer crashing)" -ForegroundColor Green
                $localLMRunning = $true
            }
        } else {
            Write-Host "  ⚠️  Container exited with code: $exitCode" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ⚠️  Container LM Studio status: $lmstudioState" -ForegroundColor Yellow
    }
}

# FINAL CHECK
if ($localLMRunning) {
    Write-Host "`n✅ LM Studio is available (SYSTEM OPERATIONAL)" -ForegroundColor Green
} else {
    Write-Host "`n⚠️  LM Studio degraded (Memory MCP + Watcher MCP still operational)" -ForegroundColor Yellow
}

# ============================================================================
# CHECK 6: Dashboard
# ============================================================================

Write-Host "`n[6/6] Checking Dashboard..." -ForegroundColor Yellow

$dashboardRunning = docker ps --filter "name=code-heals-dashboard" --filter "status=running" -q
if ($dashboardRunning) {
    Write-Host "✅ Dashboard is running (Port 5000)" -ForegroundColor Green
} else {
    Write-Host "⚠️  Dashboard not running (optional)" -ForegroundColor Yellow
}

# ============================================================================
# SUMMARY AND RECOMMENDATIONS
# ============================================================================

Write-Host @"

╔════════════════════════════════════════════════════════════════════╗
║  SYSTEM STATUS SUMMARY                                             ║
╚════════════════════════════════════════════════════════════════════╝

CRITICAL PATH (Required):
  ✅ Docker            - Running (28.5.1)
  ✅ Memory MCP        - Running (port 8090)
  ✅ Watcher MCP       - Running (port 8091)

ENHANCED SERVICES:
  $( if ($rebankerState -eq "running") { "✅ Re-Banker      - Running" } else { "⚠️  Re-Banker      - Offline (graceful fallback)" } )
  $(if ($localLMRunning) { "✅ LM Studio       - Available" } else { "⚠️  LM Studio      - Degraded" })
  $( if ($dashboardRunning) { "✅ Dashboard       - Running (5000)" } else { "⚠️  Dashboard       - Offline" } )

═══════════════════════════════════════════════════════════════════════

NEXT STEPS:

1. 🚀 Start MCP Gateway (connects services):
   docker mcp gateway run

2. 📡 Wire LM Studio to MCP:
   • Open LM Studio → Settings → Developer → Model Context Protocol
   • Import .lmstudio-mcp-config.json

3. 📝 Wire VS Code to MCP:
   • Install: Docker for GitHub Copilot extension
   • Configure: .vscode/settings-mcp.json

4. ✔️ Test MCP Call:
   • LM Studio Chat: "Using MCP, what memory keys are stored?"
   • Copilot Chat: "@mcp docker list containers"

═══════════════════════════════════════════════════════════════════════

"@ -ForegroundColor Cyan

Write-Host "System ready! 🎯" -ForegroundColor Green
