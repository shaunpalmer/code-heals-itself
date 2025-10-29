# DECISION TREE PATTERN: if/else if/else with Fallback

This is the programming pattern you asked for. Here's how it works in the system:

---

## PSEUDOCODE PATTERN

```
SERVICE X RECOVERY:

IF (service is healthy)
    ✅ SUCCESS - exit
ELSE IF (try recovery option 1)
    IF (succeeds)
        ✅ SUCCESS - exit
    ELSE
        // fall through
ELSE IF (try recovery option 2)
    IF (succeeds)
        ✅ SUCCESS - exit
    ELSE
        // fall through
ELSE IF (try recovery option 3)
    IF (succeeds)
        ✅ SUCCESS - exit
    ELSE
        // fall through
ELSE
    ❌ ALL OPTIONS FAILED
    Log error
    Continue with degraded functionality
```

---

## REAL EXAMPLE: REBANKER RECOVERY

### BEFORE (BROKEN)
```
Start rebanker
  → Crash: ModuleNotFoundError: No module named 'yaml'
  → Container stays down
  → SYSTEM FAILS ❌
```

### AFTER (DECISION TREE)
```powershell
IF rebanker is healthy
    ✅ Continue
ELSE IF (add pyyaml to requirements && rebuild && restart)
    ✅ SUCCESS - rebanker running
ELSE IF (docker exec && pip install pyyaml)
    ✅ SUCCESS - pyyaml installed
ELSE IF (disable rebanker gracefully)
    ⚠️ FALLBACK - continue with Memory MCP + Watcher MCP
ELSE
    ❌ Error logged, system continues
```

### ACTUAL POWERSHELL CODE

```powershell
function Strategy-Rebanker {
    Log-Step "REBANKER STARTUP STRATEGY" INFO
    
    # ATTEMPT 1: Add pyyaml to requirements.txt and rebuild
    Log-Step "ATTEMPT 1: Add pyyaml to requirements.txt" INFO
    $requirementsPath = ".\requirements.txt"
    $content = Get-Content $requirementsPath
    
    if ($content -notlike "*pyyaml*") {
        Add-Content $requirementsPath "`npyyaml>=6.0"
        
        if (Rebuild-Container -ContainerName "rebanker" -DockerfilePath "Dockerfile.python") {
            if (Start-Container -ContainerName "rebanker") {
                Log-Step "ATTEMPT 1 SUCCEEDED" SUCCESS
                return $true
            }
        }
    }
    
    # ATTEMPT 1 FAILED - Try fallback
    Log-Step "ATTEMPT 1 FAILED - Trying fallback..." WARNING
    
    # ATTEMPT 2: Install pyyaml directly into running container
    Log-Step "ATTEMPT 2: pip install pyyaml inside container" INFO
    
    try {
        docker compose up -d rebanker
        docker exec code-heals-rebanker pip install pyyaml
        if ($LASTEXITCODE -eq 0) {
            Log-Step "ATTEMPT 2 SUCCEEDED" SUCCESS
            return $true
        }
    } catch {
        Log-Step "ATTEMPT 2 FAILED" ERROR
    }
    
    # ATTEMPT 2 FAILED - Try final fallback
    
    # ATTEMPT 3: Disable rebanker gracefully (continue without it)
    Log-Step "ATTEMPT 3: Disable rebanker (graceful fallback)" WARNING
    Log-Step "Rebanker disabled, but Memory MCP + Watcher MCP still operational" INFO
    return $false  // Continue anyway
}
```

---

## REAL EXAMPLE: LM STUDIO HYBRID STRATEGY

### DECISION TREE

```
IF (local LM Studio on host:1234 is accessible)
    ✅ USE LOCAL (preferred)
ELSE IF (containerized LM Studio is running)
    ✅ USE CONTAINER
ELSE IF (start containerized LM Studio)
    IF (succeeds)
        ✅ USE CONTAINER
    ELSE
        // fall through
ELSE IF (degrade gracefully, log the issue)
    ⚠️ FALLBACK - continue with Memory MCP only
ELSE
    ❌ Completely failed
```

### ACTUAL POWERSHELL CODE

```powershell
# OPTION A: Check if LOCAL LM Studio is running
$localLMRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:1234/" -TimeoutSec 2
    if ($response.StatusCode -eq 200) {
        $localLMRunning = $true
        Write-Host "✅ LOCAL LM Studio is accessible" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  LOCAL LM Studio not responding" -ForegroundColor Yellow
}

# OPTION B: If local failed, check CONTAINER
if (-not $localLMRunning) {
    $lmstudioState = docker ps -a --filter "name=code-heals-lmstudio" --format "{{.State.Status}}"
    
    if ($lmstudioState -eq "running") {
        Write-Host "✅ Container LM Studio is running" -ForegroundColor Green
        $localLMRunning = $true
    } elseif ($lmstudioState -eq "exited") {
        # Check exit code to understand why
        $exitCode = docker ps -a --filter "name=code-heals-lmstudio" --format "{{.State.ExitCode}}"
        
        if ($exitCode -eq "139") {
            Write-Host "❌ Container LM Studio crashed (exit 139 - model missing)" -ForegroundColor Red
            
            # OPTION C: Try starting anyway (will monitor)
            docker compose up -d lmstudio
            Start-Sleep -Seconds 2
            
            if (-not (docker ps --filter "name=code-heals-lmstudio" --filter "status=exited" -q)) {
                Write-Host "✅ Container LM Studio started" -ForegroundColor Green
                $localLMRunning = $true
            } else {
                Write-Host "⚠️  Container still crashing (expected)" -ForegroundColor Yellow
            }
        }
    }
}

# FINAL RESULT
if ($localLMRunning) {
    Write-Host "✅ LM Studio is available" -ForegroundColor Green
} else {
    Write-Host "⚠️  LM Studio degraded (Memory MCP still operational)" -ForegroundColor Yellow
}
```

---

## KEY PATTERN PRINCIPLES

### 1. Try Primary Path First
```
IF (preferred option works)
    ✅ Use it and exit
```

### 2. Try Fallback Options in Sequence
```
ELSE IF (option 1 works)
    ✅ Use it and exit
ELSE IF (option 2 works)
    ✅ Use it and exit
ELSE IF (option 3 works)
    ✅ Use it and exit
```

### 3. Graceful Degradation
```
ELSE
    ⚠️  Run with reduced functionality
    Log exactly what failed
    Continue anyway
```

### 4. NO HARD FAILURES
```
// Never do this:
IF (something fails)
    ❌ CRASH SYSTEM

// Instead do this:
IF (something fails)
    Try next option
    If all options fail
    Log it and continue
```

---

## HOW THIS ENABLES SELF-HEALING

The decision tree allows the system to:
- ✅ Recover from temporary failures
- ✅ Try multiple solutions automatically
- ✅ Degrade gracefully rather than crash
- ✅ Log exactly what happened for debugging
- ✅ Continue operating in degraded mode
- ✅ Allow future fixes (e.g., add model file, restart host LM Studio)

**This is what "code that heals itself" really means:**  
When something breaks, the system tries to fix it. If it can't fix it, it adapts and keeps running.

---

## CURRENT SYSTEM APPLICATION

### Memory MCP
```
IF running ✅ Continue
ELSE Restart
```

### Watcher MCP
```
IF running ✅ Continue
ELSE Restart
```

### Rebanker
```
IF running ✅ Continue
ELSE IF try rebuild with pyyaml ✅ Continue
ELSE IF try direct pip install ✅ Continue
ELSE ⚠️ Disable, continue without error analysis
```

### LM Studio
```
IF local running ✅ Use local
ELSE IF container running ✅ Use container
ELSE IF start container ✅ Try it
ELSE ⚠️ Degrade, use memory-mcp + watcher-mcp
```

---

## SUMMARY

You asked for: **"if, else if, else... if it doesn't work, bug out, it'll work on one of them"**

We built: **Multi-level fallback decision trees with graceful degradation**

Result: **System that recovers automatically and continues operating even when components fail**

This is exactly what you designed the "envelope-guided" system for.
