# What Makes ReBanker Special 🏦

## 🎯 Overview

ReBanker is **far more than a simple error parser**. It's a sophisticated **taxonomy-driven diagnostic enrichment system** that transforms raw compiler/linter output into **actionable intelligence** for the self-healing loop.

**Date Explored:** October 9, 2025  
**Key Insight:** "Have a look through here, you'll see all the things that kind of makes it kind of special"

---

## 🌟 Core Architecture: The Banking Metaphor

### Why "ReBanker"?

```
Traditional Banking → ReBanker System
──────────────────────────────────────
Deposits          → Raw error messages (unstructured)
Classification    → Taxonom (categorization into families)
Enrichment        → Adding metadata (severity, difficulty, hints)
Accounts          → Clustered errors (grouping related issues)
Audit Trail       → Immutable hash verification
Withdrawal        → Structured packets for healing system
```

**Key Principle:** Raw diagnostics are "deposited" into the system, enriched with intelligence, and "withdrawn" as actionable packets.

---

## 🧬 The Five Pillars of ReBanker Intelligence

### 1. **Taxonomy-Driven Classification** 📚

**Location:** `rules/rebanker_taxonomy.yml` (516 lines of curated knowledge)

**Structure:**
```yaml
families:          # Top-level groupings
  - SYN (Syntax/Parsing)
  - RES (Name/Import/Resolve)
  - TYP (Type/Contract)
  - IO (Path/IO/Filesystem)
  - OOP (Visibility/Object Orientation)
  - ASY (Async/Concurrency)
  - NET (Network/HTTP)
  - DB (Database/Query)
  - BLD (Build/Tooling/Dependencies)
  - CFG (Environment/Config)
  - PRF (Performance/Resource)
  - LOC (i18n/Encoding/Locale)

categories:        # Specific error types (24 core patterns)
  - code:          # Canonical identifier (e.g., "SYN.UNMATCHED_BRACE")
  - severity:      # Label + numeric score (0.0-1.0)
  - difficulty:    # Repair complexity (0.0 easy → 1.0 hard)
  - hint:          # Short guidance for LLM
  - detectors:     # Regex patterns per language
  - cluster_key:   # Field for grouping related errors
  - planner:       # Strategy directives (🔥 THIS IS THE MAGIC!)
```

**Example - Private Access Error:**
```yaml
- id: "PRIVATE_ACCESS"
  code: "OOP.PRIVATE_ACCESS"
  description: "Attempt to access private member"
  severity:
    label: "ERROR"
    score: 0.7
  difficulty: 0.6  # Higher = harder to fix
  hint: "Use an exposed method or adjust visibility within policy."
  detectors:
    - langs: ["ts", "js", "php"]
      regex:
        - "Property '([^']+)' is private and only accessible within class"
      capture: ["symbol"]  # Extract the private symbol name
  cluster_key: "symbol"  # Group by which symbol was accessed
  planner:
    prefer: ["precision"]
    rails: ["prefer_wrapper_over_visibility_change"]  # 🎯 Policy guidance!
```

---

### 2. **Intelligent Enrichment Pipeline** 🔬

**What Gets Added:**

```python
# Raw input (from compiler):
"Property '_validateUser' is private and only accessible within class 'UserController'"

# ReBanker enriched output:
{
  "file": "user_controller.ts",
  "line": 1624,
  "column": 15,
  "message": "Property '_validateUser' is private...",
  "code": "OOP.PRIVATE_ACCESS",           # ← Canonical code
  "severity": {
    "label": "ERROR",
    "score": 0.7                          # ← Numeric severity
  },
  "difficulty": 0.6,                      # ← Repair complexity
  "cluster_id": "OOP.PRIVATE_ACCESS:_validateUser",  # ← Grouping key
  "hint": "Use an exposed method or adjust visibility within policy.",
  "confidence": 0.8,                      # ← Pattern match confidence
  "id": "e:a1b2c3d4e5f6",                # ← Stable error ID (hash)
  
  // 🔥 THE MAGIC: Planner directives
  "planner": {
    "prefer": ["precision"],
    "rails": ["prefer_wrapper_over_visibility_change"]
  }
}
```

---

### 3. **Planner Directives: The "Rails" System** 🚂

This is **where ReBanker becomes truly special** - it doesn't just identify errors, it **guides the healing strategy**.

#### **Strategy Preferences:**

```yaml
prefer:
  - "precision"              # Minimize blast radius
  - "block_heal"             # Fix entire code block
  - "batch_if_count>=3"      # Batch similar errors together
```

#### **Constraint Rails:**

```yaml
rails:
  - "edit_within_span_only"              # Don't touch code outside error span
  - "restore_brace_parity"               # Ensure braces balance
  - "preserve_existing_indent"           # Keep indentation style
  - "prefer_callsite_fix"                # Fix where it's called, not definition
  - "avoid_visibility_escalation"        # Don't just make everything public!
  - "prefer_wrapper_over_visibility_change"  # Prefer encapsulation
```

**Real-World Impact:**

```python
# Without rails:
# LLM might fix private access by making method public (bad!)
class UserController:
    def _validateUser(self):  # ← Changed from private to public
        pass

# With rails ["prefer_wrapper_over_visibility_change"]:
# LLM creates proper encapsulation
class UserController:
    def _validateUser(self):  # ← Stays private!
        pass
    
    def validateUser(self):   # ← New public wrapper
        return self._validateUser()
```

---

### 4. **Error Clustering & Batching** 📦

**Cluster Key Magic:**

```yaml
cluster_key: "symbol"  # Group by variable/function name
cluster_key: "module"  # Group by missing import
cluster_key: "path"    # Group by file path
cluster_key: "code"    # Group by error type
```

**Example - Missing Module:**

```python
# Three errors, same root cause:
Error 1: "ModuleNotFoundError: No module named 'requests'" (line 5)
Error 2: "ModuleNotFoundError: No module named 'requests'" (line 42)
Error 3: "ModuleNotFoundError: No module named 'requests'" (line 89)

# ReBanker clusters them:
cluster_id: "RES.MODULE_NOT_FOUND:requests"

# Planner directive:
prefer: ["batch_if_count>=3"]

# Result: Fix all 3 with one action (add import at top)
```

---

### 5. **Immutability Contract: The Hash Verification System** 🔒

**The ReBanker Promise:**

```python
rebanker_raw = {
    "file": "main.py",
    "line": 42,
    "column": 5,
    "message": "SyntaxError: invalid syntax",
    "code": "SYN.UNEXPECTED_TOKEN",
    "severity": {"label": "FATAL_SYNTAX", "score": 0.85}
}

# Compute immutable hash
rebanker_hash = sha256(json.dumps(rebanker_raw, sort_keys=True))

# Every healing iteration:
assert_rebanker_immutable(envelope_metadata)
# ↓
# if hash(rebanker_raw) !== rebanker_hash:
#     ABORT - truth has been tampered with!
```

**Why This Matters:**

- **Ground truth protection** - Ensures raw diagnostics aren't mutated during healing
- **Audit trail** - Can trace back to exact error state
- **Delta convergence** - Enables measuring progress (error → error' → clean)
- **Circuit breaker safety** - Breakers operate on **facts**, not interpretations

---

## 🎓 Integration with Self-Healing System

### **Flow: Raw Error → Healing Action**

```
1. Compiler/Linter Output (unstructured)
   ↓
2. ReBanker Parse (ops/rebank/rebank_py.py)
   - Regex extraction (file, line, column, message)
   ↓
3. Taxonomy Classification (rebanker/classify.py)
   - Match against 24 core patterns
   - Extract captures (symbol names, paths, etc.)
   ↓
4. Enrichment Pipeline (enrich_with_taxonomy)
   - Add code, severity, difficulty, hint
   - Compute cluster_id for grouping
   - Attach planner directives (prefer/rails)
   - Generate stable error ID (hash)
   ↓
5. Envelope Attachment (envelope.metadata.rebanker_raw)
   - Store enriched packet
   - Compute rebanker_hash (immutability)
   ↓
6. Confidence Scoring (AIDebugger)
   - Uses taxonomy difficulty in calculation
   - Example: difficulty=0.6 → lowers confidence if logits weak
   ↓
7. Strategy Selection (attemptWithBackoff)
   - Reads planner directives
   - Applies rails as constraints
   - Guides LLM fix approach
   ↓
8. Delta Convergence (error_delta)
   - Compare prev_rebanker_raw vs cur_rebanker_raw
   - Measure progress toward zero error
   ↓
9. Scope Widening Detection (detect_stuck_pattern)
   - Analyzes rebanker_raw line numbers
   - Triggers context expansion if stuck
```

---

## 🔬 Special Features Breakdown

### **A. Multi-Language Support**

```yaml
detectors:
  - langs: ["py", "ts", "js", "php"]
    regex:
      - "NameError: name '([^']+)' is not defined"      # Python
      - "cannot find name '([^']+)'"                    # TypeScript
      - "ReferenceError: ([A-Za-z_][A-Za-z0-9_]*)"     # JavaScript
      - "Undefined variable: ([A-Za-z_][A-Za-z0-9_]*)" # PHP
```

**Result:** Same `RES.NAME_ERROR` code across all languages, enabling cross-language pattern learning.

---

### **B. Capture Groups for Precise Fixes**

```yaml
regex:
  - "Property '([^']+)' does not exist on type '([^']+)'"
capture: ["symbol", "type"]

# Extracted data:
{
  "symbol": "_validateUser",
  "type": "UserController"
}

# LLM receives:
# "Property '_validateUser' does not exist on type 'UserController'"
# + exact symbol name for targeted fix
```

---

### **C. Severity Scoring (Not Just Labels)**

```yaml
severity:
  label: "FATAL_SYNTAX"  # Human-readable
  score: 0.9             # Numeric (for sorting/prioritization)
```

**Use Cases:**
- Sort errors by severity (0.9 before 0.6)
- Weight confidence scoring (FATAL = lower confidence threshold)
- Circuit breaker budgets (FATAL errors trip faster)

---

### **D. Difficulty-Aware Confidence Scoring**

```python
def calculate_confidence(logits, error_type, historical, taxonomy_difficulty):
    # Base confidence from logits
    logit_score = sum(logits[:3]) / 3
    
    # Adjust for taxonomy difficulty
    if taxonomy_difficulty:
        # difficulty=0.8 (hard) → reduce confidence
        # difficulty=0.2 (easy) → boost confidence
        difficulty_penalty = taxonomy_difficulty * 0.2
        logit_score *= (1 - difficulty_penalty)
    
    # ...combine with historical data
```

**Result:** The system **knows** that `OOP.PRIVATE_ACCESS` (difficulty=0.6) is harder than `SYN.MISSING_COLON` (difficulty=0.2).

---

### **E. Hint System for LLM Guidance**

```yaml
hint: "Add ':' after control structures or function/class declarations."
```

**Injected into LLM prompt:**
```
System: You are fixing a SYN.MISSING_COLON error.
Taxonomy Hint: Add ':' after control structures or function/class declarations.
Error: Expected ':' at line 42
Code: def process_user(user_id)  # ← Missing colon

LLM: I'll add the colon after the function signature.
Fix: def process_user(user_id):
```

---

### **F. Planner Rails: Policy Enforcement**

**Example - "avoid_visibility_escalation":**

```typescript
// Error: Property '_data' is private
class User {
  private _data: string;
  
  getName() {
    return this._data;  // ← Error here
  }
}

// ❌ Bad fix (violates rail):
class User {
  public _data: string;  // ← Made it public!
}

// ✅ Good fix (respects rail):
class User {
  private _data: string;  // ← Stays private
  
  get data() {           // ← Proper getter
    return this._data;
  }
  
  getName() {
    return this.data;    // ← Use getter
  }
}
```

**The rail prevented a security/design violation!**

---

## 📊 Taxonomy Coverage

### **Core-24 Error Families:**

| Family | Code | Example | Difficulty | Special Feature |
|--------|------|---------|------------|-----------------|
| **SYN** | Syntax/Parsing | Unmatched brace | 0.2-0.3 | `restore_brace_parity` rail |
| **RES** | Name/Import | NameError | 0.4-0.5 | `prefer_callsite_fix` rail |
| **TYP** | Type/Contract | Type mismatch | 0.5-0.6 | `avoid_visibility_escalation` |
| **IO** | Path/IO | File not found | 0.3-0.5 | Batch by `path` cluster |
| **OOP** | Visibility/OO | Private access | 0.6 | `prefer_wrapper` rail |
| **ASY** | Async/Concurrency | Missing await | 0.5-0.7 | Complex async patterns |
| **NET** | Network/HTTP | Connection refused | 0.4-0.6 | Batch network errors |
| **DB** | Database/Query | SQL syntax | 0.6-0.8 | High difficulty |
| **BLD** | Build/Tooling | Missing modules | 0.4 | `batch_if_count>=3` |
| **CFG** | Environment/Config | Env var missing | 0.3 | Low difficulty |
| **PRF** | Performance/Resource | Out of memory | 0.7-0.9 | Very hard to fix |
| **LOC** | i18n/Encoding | Unicode decode | 0.4-0.5 | Encoding-specific |

---

## 🚀 Advanced Capabilities

### **1. Stable Error IDs (Deduplication)**

```python
def _make_error_id(line: str, code: str, captures: Dict) -> str:
    payload = json.dumps({"line": line, "code": code, "captures": captures}, sort_keys=True)
    digest = hashlib.sha1(payload.encode("utf-8")).hexdigest()[:12]
    return f"e:{digest}"

# Same error always gets same ID:
"e:a1b2c3d4e5f6" → "Property '_validateUser' is private..."
```

**Use Cases:**
- Deduplicate across healing runs
- Track error lifecycle (first seen → fixed → regression)
- Dashboard timeline (show same error evolving)

---

### **2. Summary Statistics**

```python
{
  "errors": [...],
  "summary": {
    "count": 15,
    "by_severity": {
      "FATAL_SYNTAX": 5,
      "ERROR": 8,
      "WARN": 2
    },
    "by_code": {
      "SYN.UNMATCHED_BRACE": 3,
      "RES.NAME_ERROR": 7,
      "TYP.MISMATCH": 5
    },
    "by_cluster": {
      "RES.NAME_ERROR:requests": 3,  # ← 3 errors, same missing module
      "SYN.UNMATCHED_BRACE": 3
    }
  }
}
```

**Enables:**
- Prioritization ("Fix the 7 NameErrors first")
- Batching ("3 errors in same cluster → one fix")
- Progress tracking ("Were 15 errors, now 8 → improving!")

---

### **3. Cross-Language Pattern Learning**

```yaml
# Python
"NameError: name 'foo' is not defined"

# TypeScript
"Cannot find name 'foo'"

# JavaScript
"ReferenceError: foo is not defined"

# All map to:
code: "RES.NAME_ERROR"
cluster_id: "RES.NAME_ERROR:foo"
```

**Future:** Train ML model on cross-language fix patterns!

---

## 🎯 Why This Makes ReBanker Special

### **Traditional Error Parser:**
```python
{
  "line": 42,
  "message": "Property '_validateUser' is private..."
}
```

### **ReBanker:**
```python
{
  "line": 42,
  "message": "Property '_validateUser' is private...",
  "code": "OOP.PRIVATE_ACCESS",              # ← Canonical taxonomy
  "severity": {"label": "ERROR", "score": 0.7},  # ← Quantified
  "difficulty": 0.6,                        # ← Repair complexity
  "cluster_id": "OOP.PRIVATE_ACCESS:_validateUser",  # ← Grouping
  "hint": "Use exposed method or adjust visibility",  # ← LLM guidance
  "confidence": 0.8,                        # ← Match quality
  "planner": {                              # ← THE MAGIC
    "prefer": ["precision"],
    "rails": ["prefer_wrapper_over_visibility_change"]
  }
}
```

---

## 🌟 The "Banking" Philosophy

### **Why the Metaphor Works:**

1. **Deposits (Raw Errors)** - Unstructured, messy, from many sources
2. **Accounts (Clustering)** - Organize related errors together
3. **Interest (Enrichment)** - Add value through taxonomy intelligence
4. **Audit (Immutability)** - Hash verification ensures integrity
5. **Withdrawal (Structured Packets)** - Clean, actionable data for healing

**Result:** Raw compiler output → **Actionable intelligence**

---

## 🎓 Key Takeaways

1. **Taxonomy-Driven** - 516 lines of curated error knowledge (12 families, 24+ categories)
2. **Planner Directives** - Rails system guides healing strategy ("prefer_wrapper", "avoid_visibility_escalation")
3. **Intelligent Clustering** - Groups related errors for batch fixes
4. **Immutability Contract** - Hash verification protects ground truth
5. **Difficulty-Aware** - Adjusts confidence based on repair complexity
6. **Multi-Language** - Same error codes across Python, TypeScript, JavaScript, PHP
7. **Capture Groups** - Extracts symbol names, paths, types for precise fixes
8. **Hint System** - Provides LLM guidance for each error category
9. **Stable IDs** - Deduplication and lifecycle tracking
10. **Summary Statistics** - Enable prioritization and progress tracking

---

## 📝 Integration Points

### **With Memory Feedback Loop:**
```python
# Memory sees enriched errors
envelope["metadata"]["rebanker_raw"] = {
  "code": "OOP.PRIVATE_ACCESS",
  "difficulty": 0.6,
  "cluster_id": "OOP.PRIVATE_ACCESS:_validateUser"
}

# Pattern detection uses cluster_id
if stuck_on_cluster("OOP.PRIVATE_ACCESS:_validateUser"):
    trigger_scope_widening()
```

### **With Scope Widening:**
```python
# detect_stuck_pattern uses rebanker_raw line numbers
line_numbers = [
    env["metadata"]["rebanker_raw"]["line"]
    for env in history
]
# If stuck at same line → widen scope
```

### **With Confidence Scoring:**
```python
# Taxonomy difficulty affects confidence
if taxonomy_difficulty > 0.7:
    confidence *= 0.8  # Hard error = lower confidence
```

---

**Status:** ✅ **Production-Ready & Actively Enriching**

ReBanker is the **intelligent foundation** that transforms the self-healing system from "blind fixing" to **strategic, policy-aware healing**.

This is **not just parsing** - it's **diagnostic intelligence at scale**. 🏦
