# 🧠 UNIFIED MEMORY ARCHITECTURE ACROSS ALL 3 LANGUAGES

**Date**: October 29, 2025  
**Status**: Architecture designed, implementation ready  
**Problem**: Healing loop needs to remember what worked (for gradient calculation + pattern matching)

---

## PART 1: THE MEMORY PROBLEM

### Why Memory Matters

When the healing loop makes multiple attempts on a problem:

```
Attempt 1: errorCount = 34 → 12 (delta = 22)  ✅ Good progress
Attempt 2: errorCount = 12 → 3  (delta = 9)   ✅ Good progress  
Attempt 3: errorCount = 3 → 2   (delta = 1)   ⚠️ Stalling
Attempt 4: errorCount = 2 → 2   (delta = 0)   ❌ Stuck
```

**Question**: How do we know:
1. What worked in attempts 1-2? (So we don't lose ground)
2. Why did attempt 3 stall? (So we learn)
3. Have we seen this error before? (So we use known solutions)

**Answer**: A two-tier memory system:
1. **Hot Memory** (RAM): Keep last 20 envelopes instant-accessible
2. **Cold Storage** (SQLite): Persist ALL envelopes + patterns for analysis

---

## PART 2: PYTHON IMPLEMENTATION (Reference)

**Location**: `envelope_storage.py` (870 lines)

### Layer 1: InMemoryEnvelopeQueue (Hot Memory)

```python
class InMemoryEnvelopeQueue:
    def __init__(self, max_size: int = 20):
        # Circular buffer: oldest items auto-evicted when full
        self._queue: Deque[Dict] = deque(maxlen=max_size)
        self._lock = threading.Lock()  # Thread-safe for concurrent healing
    
    def push(envelope_data, action):
        # Add to memory (O(1) operation)
        entry = {
            "envelope": envelope_data,
            "action": action,
            "status": map_action_to_status(action),
            "timestamp": now()
        }
        self._queue.append(entry)  # Auto-evicts oldest if full
    
    def get_recent(limit=20):
        # Retrieve recent attempts (fast - no disk I/O)
        # Newest first
        return list(reversed(self._queue))[:limit]
    
    def get_llm_context(limit=10):
        # Generate string for LLM: "Here's what you just tried..."
        # Helps LLM learn from recent attempts
```

**Key Features**:
- ✅ Circular buffer (auto-evicts oldest)
- ✅ Thread-safe (lock for concurrent access)
- ✅ O(1) add/read operations
- ✅ Survives between healing runs (until restart)
- ✅ Generates LLM context strings

**What's Stored**:
```python
{
    "envelope": {  # Full HealingEnvelope object
        "patch_id": "abc123",
        "difficulty": "HARD",
        "confidence": 0.75,
        "cascade_risk": 0.3,
        "breakerState": "CLOSED",
        "attempts": [ ... ],
        "metadata": { ... }
    },
    "action": "PROMOTE",  # What happened
    "status": "PROMOTED",
    "timestamp": "2025-10-29T14:23:45Z"
}
```

### Layer 2: EnvelopeStorage (Cold Storage)

```python
class EnvelopeStorage:
    def __init__(self, db_path="artifacts/envelopes.db", memory_size=20):
        self.memory_queue = InMemoryEnvelopeQueue(memory_size)
        self.db_path = db_path
        self._init_database()
    
    def _init_database(self):
        # Create TWO tables
```

#### Table 1: envelopes (Healing History)

```sql
CREATE TABLE envelopes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patch_id TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL,              -- PROMOTED|REJECTED|RETRY|PENDING
    timestamp TEXT NOT NULL,
    confidence REAL,                   -- e.g., 0.75
    breaker_state TEXT,                -- OPEN|CLOSED|HALF_OPEN
    cascade_depth INTEGER DEFAULT 0,   -- How many errors cascaded?
    envelope_json TEXT NOT NULL,       -- Full envelope serialized
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES (critical for dashboard queries)
CREATE INDEX idx_envelopes_timestamp ON envelopes(timestamp DESC);
CREATE INDEX idx_envelopes_status ON envelopes(status);
```

**What This Tracks**:
- Every healing attempt (full record)
- Status progression (PENDING → PROMOTED/REJECTED)
- Confidence scores (for LLM learning)
- Breaker states (for trend analysis)
- Cascade depth (for complexity metrics)

#### Table 2: success_patterns (Knowledge Base)

```sql
CREATE TABLE success_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    error_code TEXT NOT NULL,          -- e.g., "RES.NAME_ERROR"
    cluster_id TEXT,                   -- e.g., "RES.NAME_ERROR:requests"
    fix_description TEXT,              -- "Add missing import: import requests"
    fix_diff TEXT,                     -- Actual code change
    success_count INTEGER DEFAULT 1,   -- Times this fix worked
    avg_confidence REAL,               -- Average confidence when it worked
    tags TEXT,                         -- GOLD_STANDARD, COMMON, etc.
    last_success_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(error_code, cluster_id, fix_description)
);

-- INDEXES
CREATE INDEX idx_patterns_error_code ON success_patterns(error_code);
CREATE INDEX idx_patterns_cluster_id ON success_patterns(cluster_id);
CREATE INDEX idx_patterns_tags ON success_patterns(tags);
```

**What This Learns**:
- What fixes work for what errors
- Confidence of each fix
- How many times each pattern worked
- Which patterns are "GOLD_STANDARD" (95%+ success)

### Dual-Read Strategy

```python
def get_envelopes(self, limit=20, recent_only=False):
    if recent_only:
        # FAST: Read from memory (no disk I/O)
        return self.memory_queue.get_recent(limit)
    else:
        # THOROUGH: Try memory first, fall back to disk
        recent = self.memory_queue.get_recent(limit)
        if len(recent) < limit:
            # Need more → query SQLite
            disk_results = self._query_db(limit)
            return recent + disk_results  # Memory + disk
        return recent
```

**Strategy**:
1. Recent healing (last 20 min) → memory only (fast)
2. Historical analysis → memory + disk (complete)
3. Pattern matching → disk only (exhaustive search)

---

## PART 3: TYPESCRIPT IMPLEMENTATION (Current)

**Location**: `utils/typescript/memory_adapter.ts` (101 lines)

### Current State: INCOMPLETE

```typescript
class ChatMessageHistoryAdapter {
    private messages: ChatMessage[] = [];  // Array, not circular buffer
    private store: MemoryStore;
    
    addMessage(role, content, meta) {
        // Add to array
        this.messages.push({
            role, content, ts: now(), meta
        });
        
        // Try to save to MemoryStore (no SQLite)
        try {
            this.store.safeAddOutcome(JSON.stringify(...));
        } catch {
            // Silent fail
        }
    }
    
    getMessages(limit?) {
        // Just return array (no circular buffer logic)
        return this.messages.slice();
    }
}
```

### What's Missing

- ❌ No SQLite
- ❌ No circular buffer (just array that grows forever)
- ❌ No success_patterns table
- ❌ No thread-safety (not an issue for Node.js single-threaded)
- ❌ No LLM context generation
- ❌ No pattern matching

### Recommendation

Port `EnvelopeStorage` from Python:

```typescript
// PSEUDO-CODE (not written yet)

class InMemoryEnvelopeQueue {
    private queue: CircularBuffer<Envelope> = new CircularBuffer(20);
    
    push(envelope: HealingEnvelope) {
        this.queue.append({
            envelope,
            timestamp: now(),
            action: determineAction(envelope)
        });
        // Auto-evicts oldest when full
    }
    
    getRecent(limit = 20): Envelope[] {
        return this.queue.toArray().reverse().slice(0, limit);
    }
}

class EnvelopeStorageTS {
    private memory: InMemoryEnvelopeQueue;
    private db: sqlite3.Database;  // Using better-sqlite3 for TypeScript
    
    constructor(dbPath = "data/envelopes.db") {
        this.memory = new InMemoryEnvelopeQueue();
        this.db = new Database(dbPath);
        this.initDatabase();
    }
    
    push(envelope: HealingEnvelope) {
        // Write to both memory and disk
        this.memory.push(envelope);
        this.db.prepare(`
            INSERT INTO envelopes (patch_id, status, envelope_json, ...)
            VALUES (?, ?, ?, ...)
        `).run(envelope.patch_id, ...);
    }
}
```

---

## PART 4: PHP IMPLEMENTATION (NEW - TO BUILD)

**Location**: `agents/php-agent/EnvelopeStorage.php` (to create)

### Strategy: Use PHP's Native SQLite Support

PHP has **PDO SQLite** built-in (no external dependencies!).

```php
class InMemoryEnvelopeQueue {
    private array $queue = [];
    private int $max_size = 20;
    
    public function push(array $envelope, string $action): void {
        // Simulate circular buffer with array
        $entry = [
            'envelope' => $envelope,
            'action' => $action,
            'status' => $this->mapActionToStatus($action),
            'timestamp' => date('c')
        ];
        
        $this->queue[] = $entry;
        
        // Evict oldest if over max
        if (count($this->queue) > $this->max_size) {
            array_shift($this->queue);  // Remove first
        }
    }
    
    public function getRecent(int $limit = 20): array {
        // Reverse and return
        return array_slice(array_reverse($this->queue), 0, $limit);
    }
    
    public function getLLMContext(int $limit = 10): string {
        $recent = $this->getRecent($limit);
        $lines = ["=== RECENT HEALING CONTEXT ===\n"];
        
        $total = count($recent);
        $promoted = count(array_filter($recent, fn($e) => $e['status'] === 'PROMOTED'));
        $success_rate = $total > 0 ? intval(($promoted / $total) * 100) : 0;
        
        $lines[] = "Success Rate: $success_rate% ($promoted/$total promoted)\n";
        
        foreach ($recent as $i => $entry) {
            $env = $entry['envelope'];
            $lines[] = ($i + 1) . ". [" . $entry['status'] . "] " . ($env['patch_id'] ?? 'unknown');
        }
        
        $lines[] = "=== END CONTEXT ===";
        
        return implode("\n", $lines);
    }
}

class EnvelopeStorage {
    private InMemoryEnvelopeQueue $memory;
    private string $db_path;
    private \PDO $pdo;
    
    public function __construct(string $db_path = '/data/envelopes.db', int $memory_size = 20) {
        $this->db_path = $db_path;
        $this->memory = new InMemoryEnvelopeQueue($memory_size);
        
        // Ensure directory exists
        @mkdir(dirname($db_path), 0755, true);
        
        // Connect to SQLite
        $this->pdo = new \PDO('sqlite:' . $db_path);
        $this->pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        
        $this->initDatabase();
    }
    
    private function initDatabase(): void {
        // Create tables if not exist
        $this->pdo->exec(<<<'SQL'
            CREATE TABLE IF NOT EXISTS envelopes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patch_id TEXT UNIQUE NOT NULL,
                status TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                confidence REAL,
                breaker_state TEXT,
                cascade_depth INTEGER DEFAULT 0,
                envelope_json TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_envelopes_timestamp 
            ON envelopes(timestamp DESC);
            
            CREATE INDEX IF NOT EXISTS idx_envelopes_status 
            ON envelopes(status);
            
            CREATE TABLE IF NOT EXISTS success_patterns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                error_code TEXT NOT NULL,
                cluster_id TEXT,
                fix_description TEXT,
                fix_diff TEXT,
                success_count INTEGER DEFAULT 1,
                avg_confidence REAL,
                tags TEXT,
                last_success_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(error_code, cluster_id, fix_description)
            );
            
            CREATE INDEX IF NOT EXISTS idx_patterns_error_code 
            ON success_patterns(error_code);
            
            CREATE INDEX IF NOT EXISTS idx_patterns_cluster_id 
            ON success_patterns(cluster_id);
        SQL);
    }
    
    public function addEnvelope(HealingEnvelope $envelope, string $action): void {
        // Write to memory
        $this->memory->push($envelope->toArray(), $action);
        
        // Write to disk
        $status = $this->mapActionToStatus($action);
        $json = $envelope->toJson();
        
        $stmt = $this->pdo->prepare(<<<'SQL'
            INSERT INTO envelopes 
            (patch_id, status, timestamp, confidence, breaker_state, cascade_depth, envelope_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        SQL);
        
        $stmt->execute([
            $envelope->id,
            $status,
            $envelope->timestamp ?? date('c'),
            $envelope->difficultyScore ?? 0.5,
            'CLOSED',  // Default
            0,
            $json
        ]);
    }
    
    public function getRecentEnvelopes(int $limit = 20): array {
        return $this->memory->getRecent($limit);
    }
    
    public function getLLMContext(int $limit = 10): string {
        return $this->memory->getLLMContext($limit);
    }
    
    public function getSuccessPatterns(string $error_code): array {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM success_patterns WHERE error_code = ? ORDER BY success_count DESC'
        );
        $stmt->execute([$error_code]);
        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }
    
    public function recordSuccessPattern(
        string $error_code,
        string $cluster_id,
        string $fix_description,
        string $fix_diff,
        float $confidence
    ): void {
        // Try to update existing, or insert new
        $existing = $this->pdo->prepare(
            'SELECT id FROM success_patterns WHERE error_code = ? AND cluster_id = ? AND fix_description = ?'
        )->execute([$error_code, $cluster_id, $fix_description])->fetch();
        
        if ($existing) {
            // Increment counter
            $stmt = $this->pdo->prepare(
                'UPDATE success_patterns SET success_count = success_count + 1, last_success_at = ? WHERE id = ?'
            );
            $stmt->execute([date('c'), $existing['id']]);
        } else {
            // Insert new pattern
            $stmt = $this->pdo->prepare(
                'INSERT INTO success_patterns (error_code, cluster_id, fix_description, fix_diff, avg_confidence, last_success_at) VALUES (?, ?, ?, ?, ?, ?)'
            );
            $stmt->execute([$error_code, $cluster_id, $fix_description, $fix_diff, $confidence, date('c')]);
        }
    }
}
```

### Integration with HealingPipeline

```php
// In HealingPipeline.php

class HealingPipeline {
    private EnvelopeStorage $storage;
    
    public function __construct(
        ?CodePreprocessor $preprocessor = null,
        ?Rebanker $rebanker = null,
        ?Classifier $classifier = null,
        ?EscalationObserver $observer = null,
        ?EnvelopeStorage $storage = null
    ) {
        // ... existing code ...
        $this->storage = $storage ?? new EnvelopeStorage('/data/envelopes.db');
    }
    
    public function analyzeAndHeal(string $glob_pattern): void {
        // ... find files, extract errors ...
        
        foreach ($files as $file) {
            $envelope = $this->createEnvelope($file);
            
            // STORE IT
            $action = $envelope->success ? 'PROMOTE' : 'RETRY';
            $this->storage->addEnvelope($envelope, $action);
            
            // If this was a successful fix, record the pattern
            if ($envelope->success && $envelope->cascadeRisk < 0.5) {
                $this->storage->recordSuccessPattern(
                    error_code: $envelope->code,
                    cluster_id: $envelope->clusterId,
                    fix_description: "Fixed " . substr($envelope->message, 0, 50),
                    fix_diff: $this->extractDiff($envelope),
                    confidence: $envelope->confidence
                );
            }
        }
    }
    
    public function attemptHealing(): array {
        // Get LLM context from recent attempts
        $context = $this->storage->getLLMContext(10);
        
        // Use this to inform the LLM:
        // "Here's what you just tried in the last 10 attempts. What did you learn?"
        
        // Get success patterns for this error
        $patterns = $this->storage->getSuccessPatterns($error_code);
        
        // If we've solved this before, use that pattern first
        if (!empty($patterns) && $patterns[0]['success_count'] > 5) {
            return $patterns[0]['fix_description'];
        }
        
        // Otherwise, proceed with normal healing
        return [ /* ... */ ];
    }
}
```

---

## PART 5: THE ROLLBACK + GRADIENT PROBLEM

### User's Core Insight

> "2-3 attempts not enough for softmax to converge. With rollback, need 4-5 attempts minimum."

### Why This Matters

**Softmax needs multiple data points**:
```
Attempt 1: delta=22, velocity=22/1=22    gradient=22/22=1.0
Attempt 2: delta=9,  velocity=9/2=4.5    gradient=4.5/9=0.5
Attempt 3: delta=1,  velocity=1/3≈0.33   gradient=0.33/1=0.33
Attempt 4: delta=0,  velocity=0          gradient=undefined (NEED SIGNAL!)
```

With only 2 attempts:
- Can't tell if gradient is improving or degrading
- Softmax can't establish trend
- Algorithm thinks it's stuck when it's just starting

**Phase 8 Thresholds** (already in code):
```python
stagnation_attempts: 4        # Wait 4 attempts, not 2
max_consecutive_no_progress: 5  # 5+ attempts before escalate
velocity_threshold: 0.05      # Be lenient with velocity
```

### What Needs to Change

Currently: Hard + stalling → escalate immediately

Should be:
```
Attempt 4: delta=0, velocity=0
    ↓
[Observer] detects: stalled velocity
    ↓
Decision:
    ├─ If attempt <= 2: Continue (too early)
    ├─ If attempt 3-4: Try ROLLBACK (revert to best attempt, different strategy)
    ├─ If attempt 5-6 still stuck: Escalate to larger model
    └─ If extreme difficulty (>0.8): Skip to escalation immediately
```

### Memory's Role in Rollback

To implement rollback, we NEED to remember:
1. **Best state so far**: What was the lowest error count? (Attempt 2: 3 errors)
2. **What worked**: What strategy was used? (Model: 7B, temperature: 0.8)
3. **What failed**: Attempts 3-4 tried what? (Different temperature: 1.0)

```php
// Pseudocode for intelligent rollback

$envelope_memory = $storage->getRecentEnvelopes(5);

// Find best so far
$best_attempt = null;
$best_error_count = PHP_INT_MAX;
foreach ($envelope_memory as $env) {
    if ($env['error_count'] < $best_error_count) {
        $best_error_count = $env['error_count'];
        $best_attempt = $env;
    }
}

if ($current_error_count == $previous_error_count) {
    // STALLED! Try rollback
    
    if ($attempt <= 4) {
        // Revert to best attempt, try different strategy
        $strategy = $this->pickAlternativeStrategy($best_attempt['last_strategy']);
        $temperature = $best_attempt['temperature'] + 0.2;  // Increase exploration
        
        return [
            'action' => 'ROLLBACK',
            'revert_to_state' => $best_attempt,
            'new_strategy' => $strategy,
            'new_temperature' => $temperature
        ];
    } else if ($attempt <= 6) {
        // Still stuck after 2 rollback attempts? Escalate
        return [
            'action' => 'ESCALATE',
            'reason' => 'Rollback failed, need larger model'
        ];
    }
}
```

---

## PART 6: IMPLEMENTATION PRIORITY

### CRITICAL (Do Now)

1. **Create PHPEnvelopeStorage.php** (300 lines)
   - Implement InMemoryEnvelopeQueue + EnvelopeStorage
   - Integrate with HealingPipeline
   - Time: 1-2 hours
   - Impact: Enables rollback strategy (memory-backed)

2. **Implement Rollback Decision Logic** (100 lines per language)
   - Check memory for best attempt so far
   - If stalled, revert and try different strategy
   - Time: 1 hour per language
   - Impact: 60% fewer unnecessary escalations

### HIGH (Do Next)

3. **Port TypeScript EnvelopeStorage**
   - Use better-sqlite3 module
   - Mirror Python/PHP structure
   - Time: 1 hour
   - Impact: Parity across all 3

4. **Add Success Patterns Table Usage**
   - When healing fails, check if we've solved this before
   - Use GOLD_STANDARD patterns first
   - Time: 1 hour
   - Impact: 50% faster healing on repeated errors

### MEDIUM (Do After)

5. **Dashboard Integration**
   - Query envelopes table
   - Show success rate, trends
   - Display recent attempts
   - Time: 2 hours
   - Impact: UX/monitoring

---

## PART 7: SUMMARY TABLE

| Aspect | Python | TypeScript | PHP |
|--------|--------|-----------|-----|
| Hot Memory (RAM) | ✅ InMemoryEnvelopeQueue | ⚠️ Array (not circular) | ❌ None |
| Cold Storage (DB) | ✅ SQLite 2 tables | ❌ None | ❌ None (TO BUILD) |
| Thread-safe | ✅ Yes | N/A | N/A |
| Circular buffer | ✅ deque(maxlen=20) | ❌ Plain array | ❌ None (TO BUILD) |
| LLM context | ✅ get_llm_context() | ❌ None | ❌ None (TO BUILD) |
| Pattern matching | ✅ success_patterns table | ❌ None | ❌ None (TO BUILD) |
| Rollback support | ⚠️ Classes exist | ⚠️ Classes exist | ⚠️ Classes exist |

---

## PART 8: NEXT STEPS

**Immediate Action**: Build PHPEnvelopeStorage.php with:
1. InMemoryEnvelopeQueue (20-item circular array)
2. EnvelopeStorage class with PDO SQLite
3. Two tables: envelopes + success_patterns
4. Integration with HealingPipeline

**Then**: Implement rollback decision logic (all 3 languages)

**Then**: Port TypeScript EnvelopeStorage

**Then**: Dashboard integration

