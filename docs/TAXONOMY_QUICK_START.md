# ReBanker Taxonomy Quick Start

**TL;DR**: ReBanker now enriches errors with severity, difficulty, cluster_id, and hints from a Core-24 taxonomy. Confidence scoring uses difficulty automatically when available.

---

## 🚀 Quick Start (3 Steps)

### 1. Install Dependencies

```bash
# Python
pip install PyYAML

# Node.js (if using TypeScript/JavaScript)
npm install js-yaml
```

### 2. Run ReBanker with Taxonomy

```bash
# Python files
python ops/rebank/rebank_py.py path/to/file.py

# JavaScript/TypeScript files
node ops/rebank/rebank_js_ts.mjs path/to/file.ts
```

### 3. Verify Enrichment

```bash
# Run tests (20 tests should pass)
python -m pytest tests/test_taxonomy_integration.py tests/test_taxonomy_confidence.py -v
```

✅ **Done!** The AI debugger (`ai-debugging.py`, `ai-debugging.ts`) automatically uses taxonomy data for confidence scoring.

---

## 📊 What You Get

### Before (Plain ReBanker)
```json
{
  "file": "test.py",
  "line": 42,
  "message": "invalid syntax",
  "code": "E999"
}
```

### After (Taxonomy-Enriched)
```json
{
  "file": "test.py",
  "line": 42,
  "message": "invalid syntax",
  "code": "E999",
  "severity": {"label": "CRITICAL", "score": 0.9},
  "difficulty": 0.6,
  "cluster_id": "SYN.INVALID_SYNTAX",
  "hint": "Check for missing punctuation or keywords",
  "confidence": 0.85
}
```

**Key Benefits**:
- **Severity** → Prioritize critical errors first
- **Difficulty** → Lower confidence for hard-to-fix errors (automatic)
- **Cluster ID** → Group similar errors for pattern analysis
- **Hint** → Human-readable guidance for debugging

---

## 🔧 How It Works (Simplified)

```
Source Code
    ↓
ReBanker (syntax check)
    ↓
Taxonomy Classifier (regex matching)
    ↓
Enriched Error Packet
    ↓
AI Debugger (extracts difficulty)
    ↓
Confidence Scoring (uses difficulty for penalty)
    ↓
Healing Loop (circuit breaker, patch generation)
```

**Automatic Integration**: No code changes needed! The AI debugger (`ai-debugging.py`) automatically:
1. Extracts `difficulty` from ReBanker result
2. Passes it to `UnifiedConfidenceScorer`
3. Applies complexity penalty based on difficulty

---

## 📋 Core-24 Taxonomy (14 Families)

| Code | Family | Examples |
|------|--------|----------|
| SYN | Syntax | Unmatched braces, invalid literals |
| RES | Resource | Import errors, file not found |
| TYP | Type | Type mismatches, undefined properties |
| IO | I/O | File read/write errors |
| OOP | Object-Oriented | Class/inheritance issues |
| ASY | Async | Promise rejection, race conditions |
| STA | State | Null access, uninitialized vars |
| SER | Serialization | JSON parse errors |
| NET | Network | HTTP errors, timeouts |
| DB | Database | Query errors, connection failures |
| BLD | Build | Compilation failures |
| CFG | Configuration | Invalid settings |
| PRF | Performance | Timeout, memory exceeded |
| LOC | Localization | Encoding errors |

---

## 🧪 Testing

```bash
# All taxonomy tests (20 tests)
pytest tests/test_taxonomy_integration.py tests/test_taxonomy_confidence.py -v

# Just integration tests (11 tests)
pytest tests/test_taxonomy_integration.py -v

# Just confidence tests (9 tests)
pytest tests/test_taxonomy_confidence.py -v
```

**Expected Result**: `20 passed` ✅

---

## 🎯 Confidence Penalty Formula

```python
# With taxonomy difficulty (automatic)
complexity_penalty = max(0.1, 1.0 - difficulty * 0.5)

# Examples:
# difficulty = 0.0 (easy)   → penalty = 1.0 (no reduction)
# difficulty = 0.5 (medium) → penalty = 0.75 (25% reduction)
# difficulty = 1.0 (hard)   → penalty = 0.5 (50% reduction)
```

**Fallback**: If taxonomy data is missing, uses `historical_data['complexity_score']` or defaults to 1.0.

---

## ⚙️ Configuration

### Taxonomy File
`rules/rebanker_taxonomy.yml` – Edit to add/modify error patterns

### Example: Add New Pattern
```yaml
families:
  - name: "Syntax"
    code: "SYN"
    detectors:
      - pattern: "expected.*\\}"  # Regex (escape special chars!)
        code: "MISSING_BRACE"
        severity:
          label: "CRITICAL"
          score: 0.9
        difficulty: 0.7
        hint: "Add missing closing brace"
    cluster: "SYN.BRACES"
```

**Important**: Double-escape regex special characters in YAML:
- `\d` → `\\d`
- `[)]}]` → `[\\)\\]\\}]`

---

## 🔍 Troubleshooting

### YAML Parse Error
```
yaml.scanner.ScannerError: while scanning a character class
```
**Fix**: Escape special characters in patterns:
```yaml
# ❌ Wrong
pattern: "missing [)]"

# ✅ Correct
pattern: "missing [\\)]"
```

### Test Failures
```bash
# Re-run tests with verbose output
pytest tests/test_taxonomy_integration.py -v --tb=short
```

### Import Errors
```bash
# Ensure project root in PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
```

---

## 📚 Full Documentation

See [`docs/TAXONOMY_INTEGRATION.md`](./TAXONOMY_INTEGRATION.md) for:
- Complete architecture details
- API reference
- Migration guide
- Performance notes
- Future enhancements

---

## ✅ Checklist

- [ ] Install `PyYAML` (Python) or `js-yaml` (Node.js)
- [ ] Run ReBanker: `python ops/rebank/rebank_py.py test.py`
- [ ] Verify JSON output includes `difficulty`, `severity`, `cluster_id`
- [ ] Run tests: `pytest tests/test_taxonomy_*.py -v` (20 passed)
- [ ] AI debugger automatically uses taxonomy data ✨

**Status**: ✅ Ready to use – no additional setup required!

---

## 🎉 Benefits Summary

1. **Automatic Confidence Adjustment**: Hard errors → lower confidence → more conservative healing
2. **No Breaking Changes**: Existing code works unchanged (backward compatible)
3. **Cross-Language Parity**: Python/JS/TS/PHP all use same taxonomy
4. **Test Coverage**: 20 tests validate enrichment, parity, confidence calculation
5. **Easy Extension**: Add new patterns to `rebanker_taxonomy.yml`

**Next Steps**: Run your AI healing loop – taxonomy enrichment happens automatically! 🚀
