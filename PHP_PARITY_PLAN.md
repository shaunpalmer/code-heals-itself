# 🧩 PHP Parity Plan: Modernization & Container Integration

**Date**: October 28, 2025  
**Status**: Phase 1 - Structural Alignment Ready  
**Branch Strategy**: Non-destructive, staged replication  
**Goal**: Full architectural parity with Python healing framework

---

## Executive Summary

The PHP branch currently lags the Python "Healing Framework" by approximately **17 modules**. This plan brings PHP into **feature equivalence** across three critical dimensions:

1. **Adaptive Healing Loop** — Circuit breakers + observer-based retry logic
2. **MCP Integration** — REST endpoints that integrate with Watcher MCP + Docker network
3. **Docker Architecture** — Single PHP container joining `healing-network`, same env/volumes

**Key Principle**: Architectural parity, not code duplication. PHP doesn't need to replicate Python's LLM integration—it needs identical behavioral contracts and Docker integration points.

---

## Part 1: Current State Assessment

### Python Branch (Phase 7 - Stable)
✅ Circuit breaker with velocity + gradient calculation  
✅ Model escalation (7B → 20B → 32B with temperature boost)  
✅ Observer pattern (escalation hints based on difficulty)  
✅ Rebanker error classification (Easy/Medium/Hard)  
✅ Docker integration (memory-mcp, watcher-mcp, dashboard)  
✅ Envelope + error delta tracking  
✅ Conservative thresholds (4-5 attempts before escalation)  

### PHP Branch (Current)
⚠️ Basic circuit breaker (no velocity calculation)  
❌ No model escalation logic  
❌ No observer integration  
❌ Limited error classification  
⚠️ Standalone (not integrated with Docker MCP)  
❌ No envelope pattern implementation  
⚠️ Aggressive thresholds (2 attempts escalation)  

### Gap Analysis
| Component | Python | PHP | Gap |
|-----------|--------|-----|-----|
| Circuit Breaker (velocity) | ✅ Full | ⚠️ Partial | Need velocity calc |
| Observer Pattern | ✅ Full | ❌ None | Implement event listener |
| Rebanker | ✅ Full | ⚠️ Partial | Add difficulty classification |
| Docker/MCP | ✅ Full | ❌ None | REST endpoints + network join |
| Model Escalation | ✅ Full | ❌ None | Simulation layer (no actual LLM) |
| Error Delta Tracking | ✅ Full | ⚠️ Partial | Complete implementation |
| Envelope Pattern | ✅ Full | ❌ None | JSON packet traveling through time |
| Threshold Tuning | ✅ 4-5 attempts | ⚠️ 2 attempts | Align to conservative model |

**Total modules behind**: 6-7 core components need modernization.

---

## Part 2: Parity Architecture (High Level)

### Current Python Flow
```
Code with Errors
    ↓
[Import] → Rebanker classifies (Easy/Medium/Hard)
    ↓
[Envelope] carries context (error delta, confidence, attempt history)
    ↓
[Circuit Breaker] evaluates velocity + gradient
    ↓
[Observer] signals escalation if difficulty HIGH + velocity stalled
    ↓
[Decision] CONTINUE / ROLLBACK / ESCALATE
    ↓
[Model Selector] 7B → 20B → 32B (with temperature adjustment)
    ↓
[MCP Integration] via Docker network (memory-mcp, watcher-mcp)
    ↓
[Envelope] persisted to SQLite + hot memory
```

### Target PHP Flow (Equivalent)
```
Code with Errors
    ↓
[Import] → PHP Rebanker classifies (Easy/Medium/Hard)
    ↓
[Envelope] JSON packet carries context
    ↓
[Circuit Breaker] evaluates velocity + gradient
    ↓
[Observer] REST endpoint signals escalation events
    ↓
[Decision] CONTINUE / ROLLBACK / ESCALATE
    ↓
[Simulation Layer] Mock model switching (no actual LLM, similar to Python)
    ↓
[MCP Integration] via /heal, /status, /events REST routes
    ↓
[Envelope] persisted to file/DB + hot memory
```

### Key Difference
PHP doesn't need actual LLM switching. It needs:
- ✅ Same decision logic (velocity, gradient, breakpoints)
- ✅ Same behavioral outputs (CONTINUE vs ROLLBACK vs ESCALATE)
- ✅ Same Docker integration (join healing-network, health endpoints)
- ✅ Same envelope contract (JSON serialization matches Python)
- ⚠️ Simulated model switching (can mock escalation chain)

---

## Part 3: Staged Implementation (Non-Destructive)

### Stage A: Baseline Sync (Structural Parity)

**Objective**: Copy structural files, establish branch, no code changes yet.

**Step 1: Create stable Python branch**
```bash
git checkout python/dashboard-live-integration
git pull origin python/dashboard-live-integration
git checkout -b phase7-python-stable
git push origin phase7-python-stable
```

**Step 2: Create PHP parity branch from main**
```bash
git checkout main
git pull origin main
git checkout -b php-parity-phase1
```

**Step 3: Copy non-language files**
```bash
# From phase7-python-stable, copy only:
# - docker-compose.yml (entire file)
# - .env.template (environment variables)
# - /docs/* (architecture documentation)
# - /scripts/ (parity check scripts)

# Do NOT copy:
# - Python agent code
# - Python-specific imports
# - Python test files
```

**Step 4: Establish PHP directory structure**
```
/agents/php-agent/
├── src/
│   ├── CircuitBreaker.php         (new: port from Python)
│   ├── Observer.php               (new: event pattern)
│   ├── Rebanker.php              (update: add difficulty)
│   ├── EnvelopeBuilder.php       (new: JSON envelope)
│   └── ErrorDeltaCalculator.php  (new: velocity + gradient)
├── routes/
│   ├── heal.php                  (POST /heal)
│   ├── status.php                (GET /status)
│   └── events.php                (GET /events)
├── tests/
│   ├── CircuitBreakerTest.php
│   ├── ObserverTest.php
│   └── IntegrationTest.php
├── Dockerfile.php                (new)
└── composer.json                 (update: new dependencies)
```

**Deliverable**: A clean branch with same docker structure, ready for code port.

---

### Stage B: Interface Parity (REST Endpoints)

**Objective**: PHP container exposes identical endpoints to Python MCP services.

**Step 1: Implement REST endpoints**

**Endpoint 1: GET /status**
```php
// agents/php-agent/routes/status.php
response:
{
  "name": "PHP Healing Agent",
  "status": "running",
  "version": "1.0.0",
  "container": "code-heals-php",
  "port": 8085,
  "mcp_network": "healing-network"
}
```

**Endpoint 2: POST /heal**
```php
// agents/php-agent/routes/heal.php
request:
{
  "code": "...",
  "error_count": 34,
  "model": "php-7B",
  "attempt": 1
}

response:
{
  "attempt": 1,
  "errors_before": 34,
  "errors_after": 12,
  "error_delta": 22,
  "decision": "CONTINUE",
  "breaker_state": "CLOSED",
  "velocity": 22.0,
  "gradient": 0.65,
  "confidence": 0.78,
  "recommendation": "Refine last patch"
}
```

**Endpoint 3: GET /events**
```php
// agents/php-agent/routes/events.php
response (JSONL format):
{"timestamp":"2025-10-28T14:23:45Z","type":"escalation_hint","difficulty":"HARD","confidence":0.3}
{"timestamp":"2025-10-28T14:24:12Z","type":"circuit_breaker","state":"OPEN","reason":"velocity_stalled"}
{"timestamp":"2025-10-28T14:25:33Z","type":"model_switch","from":"php-7B","to":"php-20B"}
```

**Step 2: Test parity**
```bash
# Terminal 1: Start PHP container
docker compose up -d php-agent

# Terminal 2: Test endpoints
curl http://localhost:8085/status
curl -X POST http://localhost:8085/heal -d '{"code":"...","error_count":34}'
curl http://localhost:8085/events
```

**Step 3: Verify Docker network discovery**
```bash
# Inside Docker Compose network
docker exec php-agent ping memory-mcp
docker exec php-agent ping watcher-mcp
```

**Deliverable**: PHP container responds with identical JSON contracts to Python.

---

### Stage C: Behavioral Parity (Core Algorithms)

**Objective**: Port circuit breaker, observer, and rebanker logic from Python.

**Step 1: Port CircuitBreaker class**

**Python reference** (`utils/python/confidence_scoring.py`):
```python
def evaluate_trend(self, errors, previous_errors):
    velocity = (previous_errors - errors) / attempts
    gradient = velocity / error_delta
    if velocity > 0:
        return 'ROLLBACK'
    elif gradient < velocity_threshold:
        return 'ESCALATE'
    else:
        return 'CONTINUE'
```

**PHP equivalent** (`agents/php-agent/src/CircuitBreaker.php`):
```php
<?php
class CircuitBreaker {
    private $velocityThreshold = 0.05;
    private $errorHistory = [];
    
    public function evaluateTrend($currentErrors, $previousErrors, $attempts) {
        $velocity = ($previousErrors - $currentErrors) / max(1, $attempts);
        $errorDelta = max($previousErrors, $currentErrors);
        $gradient = $velocity / max(1, $errorDelta);
        
        if ($velocity > 0) {
            return ['decision' => 'ROLLBACK', 'reason' => 'negative_velocity'];
        }
        if ($gradient < $this->velocityThreshold) {
            return ['decision' => 'ESCALATE', 'reason' => 'stalled_progress'];
        }
        return ['decision' => 'CONTINUE', 'reason' => 'healthy_gradient'];
    }
}
?>
```

**Step 2: Port Observer pattern**

**Python reference** (`agents/python/observer_security.py`):
```python
class Observer:
    def on_rebanker_classified(self, difficulty, confidence):
        if difficulty == 'HARD' and confidence < 0.5:
            self.signal_escalation_hint()
```

**PHP equivalent** (`agents/php-agent/src/Observer.php`):
```php
<?php
class Observer {
    private $eventLog = [];
    
    public function onRebankerClassified($difficulty, $confidence) {
        $event = [
            'timestamp' => date('c'),
            'type' => 'classification',
            'difficulty' => $difficulty,
            'confidence' => $confidence
        ];
        
        if ($difficulty === 'HARD' && $confidence < 0.5) {
            $event['type'] = 'escalation_hint';
            $this->logEvent($event);
        }
    }
    
    private function logEvent($event) {
        $this->eventLog[] = $event;
        file_put_contents('/data/observer_events.jsonl', json_encode($event) . "\n", FILE_APPEND);
    }
}
?>
```

**Step 3: Implement Rebanker with difficulty**

**PHP Rebanker** (`agents/php-agent/src/Rebanker.php`):
```php
<?php
class Rebanker {
    const EASY = 'EASY';
    const MEDIUM = 'MEDIUM';
    const HARD = 'HARD';
    
    public function classify($error) {
        $patterns = [
            'Easy' => ['bracket', 'semicolon', 'comma', 'missing_brace'],
            'Medium' => ['undefined_variable', 'type_mismatch', 'scope'],
            'Hard' => ['cascade', 'infinite_loop', 'deadlock', 'race_condition']
        ];
        
        foreach ($patterns as $difficulty => $keywords) {
            foreach ($keywords as $keyword) {
                if (stripos($error, $keyword) !== false) {
                    return $difficulty;
                }
            }
        }
        return self::MEDIUM; // Default
    }
}
?>
```

**Step 4: Build Envelope pattern**

**PHP Envelope** (`agents/php-agent/src/EnvelopeBuilder.php`):
```php
<?php
class EnvelopeBuilder {
    public function buildEnvelope($attempt, $errorsDelta, $confidence, $decision) {
        return [
            'attempt' => $attempt,
            'timestamp' => date('c'),
            'error_delta' => $errorsDelta,
            'confidence' => $confidence,
            'decision' => $decision,
            'metadata' => [
                'velocity' => $errorsDelta / max(1, $attempt),
                'breaker_state' => $this->determineState($errorsDelta)
            ]
        ];
    }
    
    private function determineState($errorsDelta) {
        return $errorsDelta > 0 ? 'CLOSED' : 'OPEN';
    }
}
?>
```

**Deliverable**: PHP logic produces identical decision outputs to Python.

---

### Stage D: Docker Integration

**Objective**: PHP container fully integrated into healing-network.

**Step 1: Add PHP service to docker-compose.yml**

```yaml
php-agent:
  build:
    context: ./agents/php-agent
    dockerfile: Dockerfile.php
  container_name: code-heals-php-agent
  image: code-heals-php:latest
  ports:
    - "8085:8085"
  volumes:
    - ./data:/data
    - ./agents/php-agent:/app
  environment:
    - MCP_NAME=PHPHealingAgent
    - WORKSPACE=/app
    - LOG_LEVEL=info
    - PRIMARY_URL=http://lmstudio:8080/v1
    - FALLBACK_URL=http://host.docker.internal:1234/v1
  networks:
    - healing-network
  restart: unless-stopped
  depends_on:
    - memory-mcp
    - watcher-mcp
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8085/status"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
```

**Step 2: Create Dockerfile.php**

```dockerfile
FROM php:8.2-fpm

RUN apt-get update && apt-get install -y \
    curl \
    git \
    composer \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY composer.json composer.lock* ./
RUN composer install --no-dev --optimize-autoloader

COPY . .

EXPOSE 8085

CMD ["php", "-S", "0.0.0.0:8085", "-t", "public"]
```

**Step 3: Update docker-compose.yml network**

Ensure `healing-network` exists:
```yaml
networks:
  healing-network:
    driver: bridge
```

**Step 4: Deploy and verify**

```bash
# Build PHP container
docker compose build php-agent

# Start all services
docker compose up -d

# Verify PHP is running
docker compose ps | grep php-agent

# Test connectivity to other MCP services
docker compose exec php-agent curl http://memory-mcp:8090/
docker compose exec php-agent curl http://watcher-mcp:8091/

# Check MCP Toolkit discovery
# Docker Desktop → MCP Toolkit → My servers → Should show "php-agent"
```

**Deliverable**: PHP container discovered by MCP Toolkit, integrated with healing-network.

---

## Part 4: Parity Verification Checklist

### Structural Parity
- [ ] PHP branch created from main
- [ ] docker-compose.yml updated with php-agent service
- [ ] .env configured with PHP environment variables
- [ ] /agents/php-agent directory structure matches plan
- [ ] Dockerfile.php builds successfully

### Interface Parity
- [ ] GET /status returns correct JSON schema
- [ ] POST /heal accepts envelope and returns decision
- [ ] GET /events streams JSONL escalation events
- [ ] All endpoints accessible via Docker network
- [ ] Response times < 100ms for non-healing operations

### Behavioral Parity
- [ ] CircuitBreaker.evaluateTrend() matches Python logic
- [ ] Observer signals escalation on HIGH difficulty + low confidence
- [ ] Rebanker classifies errors as Easy/Medium/Hard correctly
- [ ] Envelope JSON serializes identically to Python
- [ ] Error delta calculation produces same velocity as Python
- [ ] Gradient calculation produces same values (±0.01)

### Docker Integration
- [ ] PHP container joins healing-network successfully
- [ ] DNS resolution works (php-agent can ping memory-mcp)
- [ ] MCP Toolkit discovers php-agent service
- [ ] Health check endpoint responds correctly
- [ ] Log output goes to /data/php-agent.log

### Test Coverage
- [ ] Unit tests for CircuitBreaker logic
- [ ] Unit tests for Observer events
- [ ] Integration tests for REST endpoints
- [ ] Cross-language parity tests (PHP vs Python)
- [ ] Docker integration tests

---

## Part 5: Git Strategy (Non-Destructive)

### Branch Structure
```
main
├── phase7-python-stable (frozen, reference point)
├── php-parity-phase1 (Stage A: structural)
├── php-parity-phase2 (Stage B: REST endpoints)
├── php-parity-phase3 (Stage C: behavioral)
└── php-parity-phase4 (Stage D: Docker integration)
```

### Commit Timeline

**Phase 1: Baseline**
```bash
git commit -m "PHP Parity Phase 1: Structural alignment

- Copy docker-compose.yml, .env, docs from phase7-python-stable
- Establish /agents/php-agent directory structure
- Add Dockerfile.php skeleton
- Non-code-changing commit (structure only)"
```

**Phase 2: Endpoints**
```bash
git commit -m "PHP Parity Phase 2: REST endpoints

- Implement GET /status endpoint
- Implement POST /heal with envelope response
- Implement GET /events JSONL streaming
- Add health check logic"
```

**Phase 3: Logic**
```bash
git commit -m "PHP Parity Phase 3: Core algorithms

- Port CircuitBreaker from Python (velocity + gradient)
- Implement Observer pattern with escalation hints
- Add Rebanker with Easy/Medium/Hard classification
- Build EnvelopeBuilder for JSON packet traveling"
```

**Phase 4: Integration**
```bash
git commit -m "PHP Parity Phase 4: Docker MCP integration

- Add php-agent service to docker-compose.yml
- Join healing-network, configured DNS
- Verify MCP Toolkit discovery
- Add integration tests"
```

### Merging Strategy

Don't merge into main until:
1. All 4 stages complete
2. Cross-language parity tests pass
3. Docker integration verified
4. Documentation updated

Then:
```bash
git checkout main
git merge --no-ff php-parity-phase4 -m "Merge PHP parity: Full feature equivalence with Python"
```

---

## Part 6: Timeline & Effort Estimate

| Phase | Task | Effort | Timeline |
|-------|------|--------|----------|
| 1 | Structural alignment | 30 min | Tomorrow AM |
| 2 | REST endpoints | 1-2 hours | Tomorrow PM |
| 3 | Core algorithms | 2-3 hours | Day 2 AM |
| 4 | Docker integration | 1 hour | Day 2 PM |
| Testing | Unit + integration tests | 2 hours | Day 3 AM |
| Documentation | README, architecture update | 1 hour | Day 3 PM |

**Total**: ~8-10 hours over 3 days
**Risk Level**: Low (non-destructive, staged approach)

---

## Part 7: Success Criteria

### Must-Have
- ✅ PHP container builds and runs
- ✅ REST endpoints respond correctly
- ✅ CircuitBreaker logic produces identical decisions to Python
- ✅ Observer signals escalation properly
- ✅ Docker network integration verified
- ✅ MCP Toolkit discovers PHP agent

### Nice-to-Have
- 🎯 Full test coverage (>80%)
- 🎯 Performance benchmarks (< 100ms per endpoint)
- 🎯 Automated parity check script
- 🎯 JavaScript branch alignment begun

### Success Definition
**"PHP branch achieves behavioral and structural parity with Python framework, can be deployed alongside Python agents, and is ready for LLM integration via MCP Toolkit."**

---

## Part 8: Open Questions & Decisions

1. **PHP Framework**: Use vanilla PHP routing, or Laravel/Slim framework?
   - **Recommendation**: Vanilla PHP for minimal dependencies
   
2. **Database**: SQLite (like Python) or PostgreSQL?
   - **Recommendation**: SQLite for consistency, same /data volume
   
3. **Testing Framework**: PHPUnit or Pest?
   - **Recommendation**: PHPUnit (industry standard)
   
4. **Model Escalation Simulation**: Mock 7B/20B/32B switching, or hardcode responses?
   - **Recommendation**: Simple mock based on error_delta threshold
   
5. **JavaScript Branch**: Start now or after PHP complete?
   - **Recommendation**: After PHP (same pattern applies)

---

## Appendix: File Mappings

### Python → PHP Equivalent Files

| Python | PHP | Status |
|--------|-----|--------|
| `utils/python/circuit_breaker.py` | `src/CircuitBreaker.php` | 🚧 Port |
| `agents/python/observer_security.py` | `src/Observer.php` | 🚧 Port |
| `agents/python/rebanker.py` | `src/Rebanker.php` | 🚧 Update |
| `utils/python/envelope.py` | `src/EnvelopeBuilder.php` | 🚧 New |
| `utils/python/confidence_scoring.py` | `src/ErrorDeltaCalculator.php` | 🚧 Port |
| `ai-debugging.py` (main loop) | `routes/heal.php` | 🚧 New |
| N/A (FastAPI) | `routes/status.php` | 🚧 New |
| N/A (SQLite) | `src/EventLog.php` | 🚧 New |

---

**Report Generated**: October 28, 2025  
**Prepared by**: GitHub Copilot + Sean Palmer  
**Status**: Ready for Phase 1 implementation  
**Next Step**: Create php-parity-phase1 branch and begin structural alignment

---

*"Bringing PHP into the concert of self-healing reasoning systems."* 🧩🚀
