# PHP Data Flow: "The Big Blob of Errors"

## 🔄 Complete Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PHP ERROR SOURCES                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Runtime Errors: php -l myfile.php                              │
│  2. Tokenizer Issues: token_get_all()                              │
│  3. Pattern Detection: regex on error messages                     │
│                                                                     │
│  OUTPUT: "The Big Blob" = Array of [line, column, code, message]   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 1: CodePreprocessor.php (Ultra-Fast Scanner)                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Input:  string $filePath or string $code                          │
│                                                                     │
│  Method: scanFile() or scanCode()                                  │
│                                                                     │
│  Process:                                                          │
│    1. token_get_all($code) - tokenize PHP code                    │
│    2. Extract: line, column, type, value                          │
│    3. Track context: class/function/namespace                     │
│    4. Detect: syntax errors, undefined vars, missing imports      │
│                                                                     │
│  Output: IssueReport {                                            │
│    issues: [                                                       │
│      {                                                             │
│        line: 5,                                                    │
│        column: 10,                                                 │
│        code: "PHP_SYNTAX_ERROR",                                   │
│        message: "Parse error: syntax error, unexpected }",         │
│        severity: "ERROR"                                           │
│      },                                                            │
│      {...more issues...}                                          │
│    ],                                                              │
│    variables: ['$x', '$y'],                                        │
│    scan_time_ms: 1.5                                               │
│  }                                                                 │
│                                                                     │
│  Speed: ~50,000 LOC/second (~1ms per 50 lines)                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 2: Rebanker.php (Error Classification)                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Input:  classifyError(                                            │
│    errorMessage: $issue['message'],                                │
│    errorType: $issue['code'],                                      │
│    stackTrace: "File: src/test.php, Line: 5, Col: 10",            │
│    context: null                                                   │
│  )                                                                 │
│                                                                     │
│  Process:                                                          │
│    1. Pattern matching: Compare against EASY/MEDIUM/HARD patterns  │
│    2. Heuristics:                                                  │
│       - Message length analysis                                    │
│       - Stack trace depth (cascade detection)                      │
│       - Error keywords (severity indicators)                       │
│       - Scope complexity (variable/function count)                 │
│    3. Confidence scoring (0.0-1.0)                                 │
│    4. Cascade risk calculation                                     │
│                                                                     │
│  Output: ErrorClassification {                                     │
│    difficulty: "EASY",              // EASY | MEDIUM | HARD       │
│    confidence: 0.95,                // 0.0-1.0                     │
│    reasoning: "Syntax error: missing bracket - simple fix",        │
│    taxonomy: "SYNTAX",              // Error family                │
│    cascadeRisk: 0.1                 // 0.0-1.0                     │
│  }                                                                 │
│                                                                     │
│  CASCADE RISK SCORES:                                              │
│    - Single-line syntax error: 0.1 (low)                          │
│    - Bracket mismatch: 0.3 (medium)                                │
│    - Unclosed string: 0.8 (high - affects rest of file)           │
│    - Complex logic error: 0.5 (moderate)                           │
│    - Rule: If stackTrace lines > 3 → cascade_risk = 0.7-0.8       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 3: Classifier.php (Taxonomy Enrichment)                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Input:  classifyLines(                                            │
│    logLines: [$errorMessage],                                      │
│    lang: 'php'                                                     │
│  )                                                                 │
│                                                                     │
│  Process:                                                          │
│    1. Load taxonomy YAML (cached, ~1ms to load)                    │
│    2. Compile regex patterns for error detection                   │
│    3. Match error message against patterns                         │
│    4. Extract: file/line/column via regex                          │
│    5. Generate cluster_id (SHA1 hash of error family)              │
│    6. Return: code, severity, hint, planner directives             │
│                                                                     │
│  Output: ClassifiedError {                                         │
│    code: "PHP.SYNTAX.BRACKET",      // Taxonomy code              │
│    severity: {label: "ERROR", score: 0.9},                        │
│    clusterId: "c123abc...",         // SHA1 hash                   │
│    hint: "Missing closing bracket. Check matching pairs.",         │
│    planner: {                       // For LLM guidance             │
│      prefer: ["precision"],                                        │
│      rails: ["edit_within_span_only"]                             │
│    }                                                               │
│  }                                                                 │
│                                                                     │
│  Speed: ~5-10ms per 10 error patterns                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 4: HealingPipeline.php (Orchestrator)                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Input:  analyzeFile($filePath) or analyzeCode($code)              │
│                                                                     │
│  Orchestration:                                                    │
│    ┌─ For each file (glob pattern):                               │
│    │                                                              │
│    ├─ Step 1: CodePreprocessor.scanFile()                         │
│    │   Output: IssueReport {issues: [...]}                        │
│    │                                                              │
│    ├─ Step 2: For each issue in report:                           │
│    │   ├─ Rebanker.classifyError(...)                             │
│    │   │  Output: ErrorClassification                             │
│    │   │                                                          │
│    │   └─ Classifier.classifyLines(...)                           │
│    │      Output: ClassifiedError                                 │
│    │                                                              │
│    └─ Step 3: createEnvelope(...)                                 │
│       Combines all layers into one packet                         │
│                                                                     │
│  Output: list<HealingEnvelope> {                                  │
│    {                                                              │
│      id: "env:abc123",                                            │
│      patch_id: "patch:xyz789",                                    │
│      file: "src/buggy.php",                                       │
│      line: 5,                                                     │
│      column: 10,                                                  │
│      message: "Parse error: syntax error, unexpected }",          │
│                                                                     │
│      // From Rebanker:                                            │
│      difficulty: "EASY",                                          │
│      confidence: 0.95,                                            │
│      cascade_risk: 0.1,                                           │
│      reasoning: "Syntax error - missing bracket",                 │
│                                                                     │
│      // From Classifier:                                          │
│      code: "PHP.SYNTAX.BRACKET",                                  │
│      severity: {label: "ERROR", score: 0.9},                     │
│      cluster_id: "c123abc...",                                    │
│      hint: "Missing closing bracket...",                          │
│                                                                     │
│      // Metadata:                                                 │
│      planner: {prefer: ["precision"], rails: [...]},              │
│      attempts: [],                                                │
│      metadata: {language: "php", ...}                             │
│    },                                                             │
│    {...more envelopes...}                                         │
│  }                                                                 │
│                                                                     │
│  Speed: ~30-120ms per file (depending on errors found)             │
│                                                                     │
│  Statistics returned:                                             │
│    - total_envelopes                                              │
│    - by_difficulty (EASY/MEDIUM/HARD counts)                      │
│    - by_severity (ERROR/WARNING/INFO counts)                      │
│    - by_code (error family breakdown)                             │
│    - avg_confidence, avg_cascade_risk                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  OUTPUT: Ready for Healing Loop                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Each HealingEnvelope flows to:                                    │
│    1. CircuitBreaker (stagnation detection)                        │
│    2. Observer (logging, escalation hints)                         │
│    3. HealingLoop (attempt repairs)                                │
│    4. ModelEscalation (upgrade if needed)                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 💾 Data Type Transformations

### Example: Real Error Journey

**START** (PHP throws error):
```
Parse error: syntax error, unexpected } in src/test.php on line 5
```

**THROUGH CodePreprocessor**:
```php
[
  'line' => 5,
  'column' => 25,
  'code' => 'PHP_SYNTAX_ERROR',
  'message' => 'Parse error: syntax error, unexpected }',
  'severity' => 'ERROR'
]
```

**THROUGH Rebanker**:
```php
ErrorClassification {
  difficulty: ErrorDifficulty::EASY,
  confidence: 0.95,
  reasoning: "Syntax error - missing opening bracket. High confidence.",
  taxonomy: "SYNTAX",
  cascadeRisk: 0.1
}
```

**THROUGH Classifier**:
```php
ClassifiedError {
  code: "PHP.SYNTAX.BRACKET",
  severity: ['label' => 'ERROR', 'score' => 0.9],
  clusterId: "7a2b5c8d9e1f",  // SHA1 hash
  hint: "Missing opening bracket '{'. Check for matching pairs.",
  planner: ['prefer' => ['precision'], 'rails' => ['edit_within_span_only']]
}
```

**FINAL** (HealingEnvelope):
```php
HealingEnvelope {
  id: "env:f47ac10b58cc4372",
  patch_id: "patch:550e8400e29b41d4",
  file: "src/test.php",
  line: 5,
  column: 25,
  message: "Parse error: syntax error, unexpected }",
  
  // Classification
  difficulty: "EASY",
  confidence: 0.95,
  cascade_risk: 0.1,
  reasoning: "Syntax error - missing bracket",
  
  // Enrichment
  code: "PHP.SYNTAX.BRACKET",
  severity: ['label' => 'ERROR', 'score' => 0.9],
  cluster_id: "7a2b5c8d9e1f",
  hint: "Missing opening bracket '{'. Check for matching pairs.",
  
  // Guidance
  planner: ['prefer' => ['precision'], 'rails' => ['edit_within_span_only']],
  
  // Audit
  attempts: [],
  metadata: ['language' => 'php', 'preprocessing_time_ms' => 1.5]
}
```

---

## 🎯 Cascade Error Handling: Detailed

### Scenario 1: Missing Bracket (Low Cascade Risk)

**Code**:
```php
function test() {
  if ($x > 5) {        // ← Missing opening bracket
    echo "yes";
  }                    // ← This } is marked as error
```

**CodePreprocessor finds**: 
- Error on line 5, column 3: "unexpected }"
- Stack trace: 1 line affected

**Rebanker analysis**:
```
- Error message: "unexpected }"
- Stack trace depth: 1 line
- Matching pattern: "unmatched.*paren" → EASY pattern matched
- Confidence: 0.95
- Cascade risk: 0.1 (only this one line)
→ Output: EASY difficulty, low cascade
```

### Scenario 2: Unclosed String (HIGH Cascade Risk)

**Code**:
```php
$str = "hello world;     // ← Missing closing quote
echo $str;
if ($condition) {
  $x = 5;
}
```

**CodePreprocessor finds**:
- Error on line 1: "unterminated string"
- But everything AFTER this line is also marked as context

**Rebanker analysis**:
```
- Error message: "unterminated string"
- Stack trace depth: 4 lines (all code after this)
- Matching pattern: "unterminated string" → EASY pattern
- BUT: traceLines > 3 → cascade_risk = 0.8 (PROMOTED)
- Confidence: 0.90
- Cascade risk: 0.8 (affects many downstream lines)
→ Output: EASY but HIGH cascade risk
```

**Key insight**: Fixing this ONE error likely fixes 4+ "errors" that are actually downstream collateral damage.

---

## 🔗 No Global State — Clean Data Flow

**Between files**: Via return values only
- CodePreprocessor returns IssueReport
- HealingPipeline calls Rebanker.classifyError()
- Rebanker returns ErrorClassification
- HealingPipeline calls Classifier.classifyLines()
- Classifier returns enriched classification
- HealingPipeline packages into HealingEnvelope

**In memory**: Each layer maintains its own cache
- CodePreprocessor: Token stream (local variable)
- Rebanker: Pattern cache (instance property, reused)
- Classifier: Taxonomy YAML cache (instance property, reused)
- HealingPipeline: Orchestration state (local variables)

**No shared global state** → Clean, testable, thread-safe architecture

---

## 📍 Entry Points

### From CLI:
```bash
php agents/php-agent/preprocess.php <file.php>
```

### From HealingPipeline directly:
```php
$pipeline = new HealingPipeline();
$envelopes = $pipeline->analyzeFile('src/buggy.php');

foreach ($envelopes as $envelope) {
  // Each envelope ready for healing loop
  echo $envelope->toJson();
}
```

### Glob pattern (batch):
```php
$envelopes = $pipeline->analyzeGlob('src/**/*.php');
```

---

## ✅ Status

**Data flow**: Fully documented
**Cascade handling**: Implemented via cascade_risk scoring
**File-to-file passing**: Via clean return values, no globals
**Memory/caching**: Per-instance caching, no shared state
