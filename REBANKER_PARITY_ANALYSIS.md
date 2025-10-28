# 🔍 Rebanker Parity Analysis: PHP vs Python

**Date**: October 28, 2025  
**Purpose**: Compare PHP Rebanker (agents/php-agent/Rebanker.php) with Python Rebanker (ops/rebank/rebank_py.py)  
**Status**: 🟡 PARTIAL PARITY - Architecture differs, functionality needs alignment

---

## Executive Summary

| Aspect | PHP | Python | Status |
|--------|-----|--------|--------|
| **Purpose** | Error classification (Easy/Medium/Hard) | Compiler stderr parsing + taxonomy enrichment | ❌ DIFFERENT |
| **Input** | Error message, type, stack trace | py_compile stderr output or files | ❌ DIFFERENT |
| **Output** | ErrorClassification object | Enriched error dict with taxonomy | ⚠️ DIFFERENT |
| **Classification Levels** | 3 (EASY, MEDIUM, HARD) | Via taxonomy lookup | ⚠️ COMPATIBLE |
| **Pattern Matching** | 25+ regex patterns | Regex patterns + taxonomy DB | ✅ SIMILAR |
| **Confidence Scores** | 0.0-1.0 range | 0.0-1.0 range | ✅ COMPATIBLE |
| **Cascade Risk** | Yes (0.0-1.0) | Via severity scoring | ⚠️ COMPATIBLE |

---

## 🔴 CRITICAL DIFFERENCES

### 1. **Input Source**
- **PHP Rebanker**: Takes pre-parsed error objects (message, type, stack trace)
  ```php
  classifyError(
    string $errorMessage,
    string $errorType = 'UNKNOWN',
    string $stackTrace = '',
    ?string $context = null
  )
  ```

- **Python Rebanker**: Parses raw compiler stderr using regex
  ```python
  parse_py_compile_stderr(stderr: str) → Dict
  ```

**Impact**: PHP assumes error is already extracted; Python does the extraction itself.

### 2. **Processing Pipeline**
- **PHP**: 
  ```
  Error object → Pattern matching (EASY/MEDIUM/HARD) → Heuristic analysis → Return classification
  ```

- **Python**:
  ```
  Raw stderr → Regex parsing → Extract file/line/column/message → Enrich with taxonomy → Return dict
  ```

**Impact**: Python has 2 stages (parse + enrich); PHP has 1 stage (classify).

### 3. **Taxonomy Integration**
- **PHP Rebanker**: NO taxonomy integration (patterns hardcoded, heuristics only)
  ```php
  private const EASY_PATTERNS = [...];
  private const MEDIUM_PATTERNS = [...];
  private const HARD_PATTERNS = [...];
  ```

- **Python Rebanker**: Full taxonomy integration via `enrich_with_taxonomy()` + `classify_lines()`
  ```python
  def enrich_with_taxonomy(error, lang="py"):
      taxonomy = load_taxonomy()
      classified = classify_lines([error["message"]], lang, taxonomy)
      # Merges: code, severity, difficulty, cluster_id, hint, confidence
  ```

**Impact**: PHP is standalone; Python connects to knowledge base (CRITICAL GAP).

### 4. **Output Structure**
- **PHP**:
  ```php
  ErrorClassification {
      ErrorDifficulty $difficulty;      // EASY|MEDIUM|HARD
      float $confidence;                // 0.0-1.0
      string $reasoning;
      string $taxonomy;                 // error type
      float $cascadeRisk;               // 0.0-1.0
  }
  ```

- **Python**:
  ```python
  {
      "file": str,
      "line": int,
      "column": int,
      "message": str,
      "code": str,                      # PY_SYNTAX, PY_RUNTIME, etc.
      "severity": {"label": str, "score": float},
      "difficulty": float,              # 0.0-1.0 (from taxonomy)
      "cluster_id": str,                # Error family
      "hint": str,                      # Remediation suggestion
      "confidence": float               # 0.0-1.0
  }
  ```

**Impact**: PHP returns object; Python returns dict. Python has MORE fields (file, line, column, code, cluster_id, hint).

---

## ⚠️ MODERATE DIFFERENCES

### 5. **Error Type Matching**
- **PHP**: Uses hardcoded patterns with regex for EASY/MEDIUM/HARD
  ```php
  if (preg_match('/Missing.*semicolon/', $errorText)) {
      return ErrorClassification(ErrorDifficulty::EASY, ...);
  }
  ```

- **Python**: Uses taxonomy database with error codes and families
  ```python
  # Looks up error_code → cluster_id → severity/difficulty
  # Example: "RES.NAME_ERROR:requests" → (difficulty=0.6, severity_label="ERROR")
  ```

**Impact**: PHP is local/heuristic; Python is knowledge-based.

### 6. **Cascade Risk Calculation**
- **PHP**: Computes from heuristics (stack trace depth, message length, keyword count)
  ```php
  $cascadeRisk = min(1.0, $traceLines / 10.0);  // 10+ lines = high risk
  ```

- **Python**: NOT explicitly calculated; derived from severity score
  ```python
  # severity["score"] implicitly indicates cascade risk
  ```

**Impact**: PHP has explicit cascade scoring; Python folds it into severity.

### 7. **File/Line/Column Extraction**
- **PHP**: Does NOT extract file/line/column (assumes already separated)
- **Python**: DOES extract file/line/column from raw stderr
  ```python
  match = SYNTAX_ERROR_RE.search(stderr)  # Extracts file, line, error_type, message
  column = len(pointer_line) - len(pointer_line.lstrip())  # From ^ pointer
  ```

**Impact**: PHP is simpler (input already parsed); Python does heavy lifting.

---

## ✅ COMPATIBLE FEATURES

### 8. **Confidence Score Range**
- **PHP**: `0.0-1.0` clamped
- **Python**: `0.0-1.0` from taxonomy defaults
- ✅ **COMPATIBLE**: Both use same range

### 9. **Precision Normalization**
- **PHP**: Rounds to 3 decimals (0.001 precision)
- **Python**: Rounds to 2 decimals (0.01 precision)
- ⚠️ **COMPATIBLE BUT INCONSISTENT**: PHP is more precise

### 10. **Pattern Matching Approach**
- **PHP**: Regex patterns organized by category (syntax, type, scope, logic, etc.)
- **Python**: Regex patterns for file/line extraction, taxonomy for classification
- ✅ **COMPATIBLE**: Both use regex, just at different stages

---

## 🛠️ WHAT NEEDS TO CHANGE FOR PARITY

### High Priority (MUST FIX)

#### 1. **Add Taxonomy Integration to PHP Rebanker**
```php
// MISSING: Integration with taxonomy database
// Currently: Hardcoded patterns only
// Needed: Load taxonomy JSON/YAML and use cluster_id lookup

private function loadTaxonomy(): array {
    // Load from ops/rebank/taxonomy.yaml or similar
}

private function enrichWithTaxonomy(ErrorClassification $error): array {
    // Similar to Python enrich_with_taxonomy()
    // Returns expanded dict with code, cluster_id, hint, etc.
}
```

#### 2. **Add File/Line/Column Extraction**
```php
// MISSING: Parsing raw stderr
// Currently: Assumes error is already parsed
// Needed: Pattern matching similar to Python

private function parseSyntaxError(string $stderr): ?array {
    // Extract file, line, column from stderr
}
```

#### 3. **Unify Output Schema**
```php
// CURRENT (PHP):
{
    "difficulty": "EASY",
    "confidence": 0.85,
    "reasoning": "...",
    "taxonomy": "SYNTAX",
    "cascade_risk": 0.1
}

// SHOULD MATCH (Python + PHP unified):
{
    "file": "path/to/file.py",
    "line": 10,
    "column": 5,
    "message": "SyntaxError: invalid syntax",
    "code": "PHP_SYNTAX",        // PHP_* instead of PY_*
    "severity": {"label": "ERROR", "score": 0.8},
    "difficulty": 0.6,           // numeric, not ENUM
    "cluster_id": "PHP.SYNTAX",
    "hint": "Check closing bracket or semicolon",
    "confidence": 0.85,
    "cascade_risk": 0.1          // ADD THIS TO PYTHON
}
```

### Medium Priority (SHOULD FIX)

#### 4. **Add Batch Error Context**
```php
// MISSING: Context from related errors
// Currently: Classifies one error in isolation
// Needed: Accept array of related errors for cascade detection

private function analyzeCascade(array $errors, string $primaryErrorId): float {
    // If error #2 is same as error #1 → cascade risk = 0.9
    // If error #2 different from error #1 → cascade risk = 0.3
}
```

#### 5. **Precision Alignment**
```php
// CURRENT: PHP rounds to 3 decimals (0.123)
// SHOULD BE: Round to 2 decimals (0.12) to match Python
```

### Low Priority (NICE TO HAVE)

#### 6. **Support Multiple Error Types**
```php
// CURRENT: Assumes PHP errors only
// NEEDED: Support JavaScript/TypeScript errors too (via $lang parameter)
```

---

## 📊 Feature Comparison Table

| Feature | PHP | Python | Parity |
|---------|-----|--------|--------|
| **Pattern Matching** | ✅ Yes (25+ patterns) | ✅ Yes (regex) | ✅ |
| **File Extraction** | ❌ No | ✅ Yes | ❌ MISSING |
| **Line Extraction** | ❌ No | ✅ Yes | ❌ MISSING |
| **Column Extraction** | ❌ No | ✅ Yes | ❌ MISSING |
| **Taxonomy Lookup** | ❌ No | ✅ Yes | ❌ MISSING |
| **Confidence Score** | ✅ Yes | ✅ Yes | ✅ |
| **Cascade Risk** | ✅ Yes | ⚠️ Implicit | ⚠️ |
| **Cluster ID** | ❌ No | ✅ Yes | ❌ MISSING |
| **Hint/Suggestion** | ❌ No | ✅ Yes | ❌ MISSING |
| **Batch Processing** | ✅ Yes | ❌ No | ⚠️ |
| **Statistics** | ✅ Yes | ❌ No | ⚠️ |
| **JSON Output** | ✅ Yes | ✅ Yes | ✅ |

---

## 🎯 Parity Roadmap

### Phase 1: Schema Alignment (1-2 hours)
```
1. Add file/line/column fields to PHP Rebanker
2. Change difficulty from ENUM to float
3. Add severity dict (label + score)
4. Add cluster_id and hint fields
5. Rename code to use PHP_ prefix
```

### Phase 2: Taxonomy Integration (2-3 hours)
```
1. Load taxonomy.yaml into PHP
2. Implement enrichWithTaxonomy() method
3. Map Python codes (PY_SYNTAX) → PHP codes (PHP_SYNTAX)
4. Connect pattern matches to taxonomy clusters
```

### Phase 3: Stderr Parsing (1-2 hours)
```
1. Add PHP error parsing (syntax errors, runtime errors)
2. Support JavaScript errors parsing
3. Extract file/line/column from error messages
```

### Phase 4: Cross-Language Support (1 hour)
```
1. Parameterize error type by language
2. Support PHP, Python, JavaScript error patterns
3. Use language prefix in error codes (PHP_, PY_, JS_)
```

### Phase 5: Testing (1-2 hours)
```
1. Unit tests for each phase
2. Parity tests against Python outputs
3. Real error sample validation
```

**Total Effort**: 6-10 hours

---

## 🚨 Current Status

### What Works ✅
- Pattern matching (25+ patterns cover common cases)
- Confidence scoring (0.0-1.0 range)
- Cascade risk heuristics
- JSON serialization
- Batch processing
- Statistics collection

### What's Missing ❌
- Taxonomy integration (knowledge base lookup)
- File/line/column extraction (parser)
- Full output schema (fields: code, cluster_id, hint)
- Cross-language support (PHP/JS/Python detection)
- Nested error handling (cascade detection)

### Architecture Assessment
- **PHP**: Lightweight, classification-focused, ~378 lines
- **Python**: Heavyweight, parser+enricher, ~306 lines (but more complex logic)
- **Recommendation**: PHP should remain lightweight classifier; Python remains parser+enricher
  - Create separate PHP stderr parser if needed
  - OR accept PHP classifies pre-parsed errors (simpler API)

---

## 💡 Design Decision: Should PHP Parse stderr?

### Option A: PHP Remains Classifier Only ✅ RECOMMENDED
```
PHP Rebanker: Classify pre-parsed errors → lightweight, focused
PHP Parser: Separate module for extracting file/line/column
Cost: 2 modules
Benefit: Clean separation of concerns
```

### Option B: PHP Becomes Parser+Classifier
```
PHP Rebanker: Parse stderr + classify → more like Python
Cost: ~100 more lines of PHP code
Benefit: Parity with Python structure
Risk: Makes PHP more complex
```

### Recommendation: **OPTION A**
- Keep PHP Rebanker as-is (classification)
- Create `agents/php-agent/ErrorParser.php` (parsing)
- Use both in healing pipeline: Parser → Rebanker → Result

---

## Next Steps

1. **Immediate** (before continuing PHP sprint):
   - Add output schema alignment to PHP Rebanker
   - Test against parity.test.ts scenarios
   - Verify confidence scores match Python

2. **Short-term** (PHP Sprint task 6):
   - Integrate taxonomy lookup (file: taxonomy.yaml)
   - Add cluster_id and hint fields
   - Update tests to validate new fields

3. **Medium-term** (PHP Sprint task 7+):
   - Create ErrorParser.php for stderr extraction
   - Support multiple languages (PHP/JS)
   - Extend parity tests to cover all scenarios

---

## 📋 Checklist for Full Parity

- [ ] Output schema matches Python (file, line, column, code, severity, difficulty, cluster_id, hint, confidence)
- [ ] Taxonomy integration complete (loads YAML, enriches classifications)
- [ ] Precision normalized (2 decimals, not 3)
- [ ] Confidence scoring matches Python ranges
- [ ] Cascade risk calculation documented
- [ ] File/line/column extraction working
- [ ] Batch processing includes cascade detection
- [ ] JSON serialization consistent
- [ ] Tests validate against parity.test.ts
- [ ] Documentation complete

---

**Status**: 🟡 **PARTIAL PARITY** — Core classification works, but schema/taxonomy integration needed for full alignment.

**Recommendation**: Continue with current PHP Rebanker for Observer integration (task 6), then address parity gaps in polish phase.
