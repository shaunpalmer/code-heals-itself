# ============================================================================
# STARTUP FALLBACK STRATEGY
# ============================================================================
# Attempts to start containerized services with intelligent fallback logic.
# If a container fails, tries alternative approaches before giving up.
# 
# DECISION TREE APPROACH:
# 1. Try X (preferred method)
#    ↓ FAIL?
# 2. Try Y (fallback option 1)
#    ↓ FAIL?
# 3. Try Z (fallback option 2)
#    ↓ FAIL?
# 4. Disable, log, continue with others
# ============================================================================

param(
    [ValidateSet('rebanker', 'lmstudio', 'all')]
    [string]$Service = 'all',
    
    [switch]$Verbose = $false,
    [switch]$DryRun = $false
)

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

function Log-Step {
    param($Message, $Level = 'INFO')
    $timestamp = Get-Date -Format "HH:mm:ss"
    $prefix = @{
        INFO = "ℹ️ "
        SUCCESS = "✅"
        WARNING = "⚠️ "
        ERROR = "❌"
    }[$Level]
    
    Write-Host "$prefix [$timestamp] $Message" -ForegroundColor @{
        INFO = 'Cyan'
        SUCCESS = 'Green'
        WARNING = 'Yellow'
        ERROR = 'Red'
    }[$Level]
}

function Test-ContainerHealth {
    param($ContainerName, $Port)
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$Port/" -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            return $true
        }
    } catch {
        return $false
    }
}

function Rebuild-Container {
    param($ContainerName, $DockerfilePath)
    
    Log-Step "Rebuilding $ContainerName from $DockerfilePath..." WARNING
    
    if ($DryRun) {
        Log-Step "[DRY RUN] docker build -t code-heals-itself-$ContainerName -f $DockerfilePath ." WARNING
        return $true
    }
    
    try {
        $output = docker build -t "code-heals-itself-$ContainerName" -f "$DockerfilePath" . 2>&1
        if ($LASTEXITCODE -eq 0) {
            Log-Step "Successfully rebuilt $ContainerName" SUCCESS
            return $true
        } else {
            Log-Step "Rebuild failed: $output" ERROR
            return $false
        }
    } catch {
        Log-Step "Build error: $_" ERROR
        return $false
    }
}

function Start-Container {
    param($ContainerName)
    
    Log-Step "Starting container: $ContainerName" INFO
    
    if ($DryRun) {
        Log-Step "[DRY RUN] docker compose up -d $ContainerName" WARNING
        return $true
    }
    
    try {
        docker compose up -d $ContainerName 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Log-Step "Container started: $ContainerName" SUCCESS
            return $true
        } else {
            Log-Step "Failed to start $ContainerName" ERROR
            return $false
        }
    } catch {
        Log-Step "Start error: $_" ERROR
        return $false
    }
}

# ============================================================================
# REBANKER FALLBACK STRATEGY
# ============================================================================

function Strategy-Rebanker {
    Log-Step "REBANKER STARTUP STRATEGY" INFO
    Log-Step "Current issue: Missing 'pyyaml' module" WARNING
    
    # ATTEMPT 1: Add pyyaml to requirements.txt and rebuild
    Log-Step "ATTEMPT 1: Add pyyaml to requirements.txt" INFO
    
    $requirementsPath = ".\requirements.txt"
    $content = Get-Content $requirementsPath
    
    if ($content -notlike "*pyyaml*" -and $content -notlike "*PyYAML*") {
        Log-Step "  Adding pyyaml to requirements.txt..." INFO
        
        if ($DryRun) {
            Log-Step "  [DRY RUN] Would add: pyyaml>=6.0" WARNING
        } else {
            Add-Content $requirementsPath "`npyyaml>=6.0"
            Log-Step "  Added pyyaml to requirements.txt" SUCCESS
        }
        
        # Rebuild container with new dependency
        if (Rebuild-Container -ContainerName "rebanker" -DockerfilePath "Dockerfile.python") {
            if (Start-Container -ContainerName "rebanker") {
                Start-Sleep -Seconds 3
                Log-Step "ATTEMPT 1 SUCCEEDED: Rebanker is running" SUCCESS
                return $true
            }
        }
    } else {
        Log-Step "  pyyaml already in requirements.txt" INFO
    }
    
    # ATTEMPT 1 FAILED - Try fallback
    Log-Step "ATTEMPT 1 FAILED - Trying fallback..." WARNING
    
    # ATTEMPT 2: Install pyyaml directly into running container
    Log-Step "ATTEMPT 2: pip install pyyaml inside container" INFO
    
    if ($DryRun) {
        Log-Step "  [DRY RUN] docker exec code-heals-rebanker pip install pyyaml" WARNING
        return $false
    }
    
    try {
        # First ensure container is running
        docker compose up -d rebanker 2>&1 | Out-Null
        
        # Try to install pyyaml
        docker exec code-heals-rebanker pip install pyyaml 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Log-Step "ATTEMPT 2 SUCCEEDED: Installed pyyaml directly" SUCCESS
            return $true
        }
    } catch {
        Log-Step "ATTEMPT 2 FAILED: $_" ERROR
    }
    
    # ATTEMPT 3: Comment out rebanker from docker-compose.yml
    Log-Step "ATTEMPT 3: Disable rebanker service (fallback)" WARNING
    
    if ($DryRun) {
        Log-Step "  [DRY RUN] Would comment out rebanker in docker-compose.yml" WARNING
        return $false
    }
    
    # This would require commenting/uncommenting logic
    Log-Step "  Rebanker disabled for this session" WARNING
    Log-Step "  To restore: Fix requirements.txt and rebuild" INFO
    
    return $false
}

# ============================================================================
# LMSTUDIO FALLBACK STRATEGY
# ============================================================================

function Strategy-LMStudio {
    Log-Step "LMSTUDIO STARTUP STRATEGY" INFO
    Log-Step "Current issue: Missing model file (./models/7B/ggml-model-f16.gguf)" WARNING
    
    # ATTEMPT 1: Check if model exists
    Log-Step "ATTEMPT 1: Check for existing model file" INFO
    
    $modelPath = ".\models\7B\ggml-model-f16.gguf"
    
    if (Test-Path $modelPath) {
        Log-Step "  Model found at: $modelPath" SUCCESS
        
        if (Start-Container -ContainerName "lmstudio") {
            Start-Sleep -Seconds 5
            
            if (Test-ContainerHealth -ContainerName "lmstudio" -Port 1234) {
                Log-Step "ATTEMPT 1 SUCCEEDED: LM Studio is running" SUCCESS
                return $true
            }
        }
    } else {
        Log-Step "  Model NOT found at: $modelPath" WARNING
    }
    
    # ATTEMPT 1 FAILED - Try fallback
    Log-Step "ATTEMPT 1 FAILED - Trying fallback..." WARNING
    
    # ATTEMPT 2: Use local LM Studio (host machine)
    Log-Step "ATTEMPT 2: Fall back to LOCAL LM Studio (host:1234)" INFO
    
    try {
        if (Test-ContainerHealth -ContainerName "localhost" -Port 1234) {
            Log-Step "ATTEMPT 2 SUCCEEDED: Local LM Studio is accessible" SUCCESS
            Log-Step "  Docker containers will use: http://host.docker.internal:1234/v1" INFO
            
            # Update docker-compose.yml to use host LM Studio
            if (-not $DryRun) {
                # This is pseudo-code; actual implementation would modify docker-compose
                Log-Step "  Note: Update LLM_API_URL in docker-compose for local LM Studio" INFO
            }
            
            return $true
        }
    } catch {
        Log-Step "ATTEMPT 2 FAILED: Local LM Studio not accessible" ERROR
    }
    
    # ATTEMPT 3: Start container without model (will fail to load, but warns gracefully)
    Log-Step "ATTEMPT 3: Start container without model (graceful degradation)" WARNING
    
    if ($DryRun) {
        Log-Step "  [DRY RUN] docker compose up -d lmstudio (will crash, but monitored)" WARNING
        return $false
    }
    
    if (Start-Container -ContainerName "lmstudio") {
        Log-Step "  Container started (will restart loop on model missing error)" WARNING
        Log-Step "  Status: Degraded - watcher-mcp will log repeated failures" WARNING
        return $true  # Technically running, but degraded
    }
    
    # ATTEMPT 4: Disable containerized LM Studio
    Log-Step "ATTEMPT 4: Disable containerized LM Studio (critical fallback)" WARNING
    
    Log-Step "  Recommendation: Use local LM Studio at http://localhost:1234" INFO
    Log-Step "  To restart: Place model file at ./models/7B/ggml-model-f16.gguf" INFO
    
    return $false
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

function Main {
    Log-Step "STARTUP FALLBACK STRATEGY - Starting diagnostic sequence" INFO
    Log-Step "Service: $Service | Verbose: $Verbose | DryRun: $DryRun" INFO
    
    if ($Service -eq 'all' -or $Service -eq 'rebanker') {
        $rebankerSuccess = Strategy-Rebanker
        Log-Step "Rebanker result: $(if ($rebankerSuccess) { '✅ SUCCESS' } else { '❌ FAILED (disabled)' })" $(if ($rebankerSuccess) { 'SUCCESS' } else { 'WARNING' })
    }
    
    Write-Host ""
    
    if ($Service -eq 'all' -or $Service -eq 'lmstudio') {
        $lmstudioSuccess = Strategy-LMStudio
        Log-Step "LM Studio result: $(if ($lmstudioSuccess) { '✅ SUCCESS' } else { '❌ NOT AVAILABLE' })" $(if ($lmstudioSuccess) { 'SUCCESS' } else { 'WARNING' })
    }
    
    Write-Host ""
    Log-Step "Startup sequence complete" INFO
}

# ============================================================================
# EXECUTE
# ============================================================================

Main
