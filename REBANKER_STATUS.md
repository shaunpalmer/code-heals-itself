# Re-Banker Integration Status & Plan

## What Re-Banker Does

**Re-Banker** is the compiler/linter error parsing layer that normalizes syntax errors from multiple languages into a single 5-field JSON payload:

```json
{
  "file": "string",
  "line": 123,
  "column": 5,
  "message": "string",
  "code": "string",          // e.g. TS1005, JS_SYNTAX, PY_SYNTAX, PHP_PARSE
  "severity": "FATAL_SYNTAX"
}
```

This payload attaches to the Envelope's metadata **without changing the schema** — no new top-level fields, just structured error data in existing `metadata` or `patch_data`.

---

## Why It's Critical

### 1. **100ms Feedback Loops**
Instead of running full test suites, re-banker uses:
- `node --check` for JavaScript (parse-only, no execution)
- `tsc --noEmit` for TypeScript (type + syntax check)
- `python -m py_compile` for Python (bytecode compilation check)
- `php -l` for PHP (CLI linter)

These are **compiler-fast** (100-200ms) and catch syntax errors **before** the AI attempts a fix.

### 2. **Gradient Calculation Input**
The error delta system needs **quantifiable errors** to track improvement:
- Attempt 1: 22 syntax errors detected by re-banker
- Attempt 2: 18 errors (delta = +4 improvement)
- Attempt 3: 12 errors (delta = +6 improvement)

Without re-banker, you only have pass/fail (binary).

### 3. **MCP Integration Path**
Re-banker is designed to be exposed as MCP tools:
- `syntax_check_php`, `syntax_check_ts`, `syntax_check_py`, `syntax_check_js`
- `rebank_errors` (parses raw compiler output)

The MCP host (your self-healing loop) calls these tools instead of shelling out directly.

---

## Current Status

### ✅ Python Re-Banker - COMPLETE
**Script:** `ops/rebank/rebank_py.py` (235 lines)  
**Status:** Fully integrated into main loop  
**Features:**
- ✅ Static syntax checking via `python -m py_compile`
- ✅ Runtime error parsing via `--stdin` mode
- ✅ **Column number extraction** from `^` pointer (NEW!)
- ✅ 5-field JSON output: `{file, line, column, message, code, severity}`
- ✅ Handles SyntaxError, IndentationError, TabError, NameError, TypeError, etc.
- ✅ Integrated into `ai-debugging.py` step 7b (two-level error capture)
- ✅ Error delta calculation feeds circuit breaker

**Test Results:**
```bash
# Column extraction working
x = [1,2,3     → {line: 1, column: 8} ✅
def x(: pass   → {line: 1, column: 10} ✅
print('hello'  → {line: 1, column: 9} ✅

# Runtime error parsing working
NameError      → {file: "test.py", line: 10, code: "RUNTIME_ERROR"} ✅
ZeroDivisionError → {file: "calc.py", line: 42, code: "RUNTIME_ERROR"} ✅
```

**Integration Flow:**
1. Sandbox executes patched code
2. **Priority 1:** If runtime error exists, parse via `rebank_py.py --stdin`
3. **Priority 2:** If no runtime error, run static syntax check
4. Attach structured error to `envelope["metadata"]["rebanker_result"]`
5. Calculate error delta (previous_errors - current_errors)
6. Feed delta to circuit breaker for trend analysis

---

### ⚠️ TypeScript Has Old Regex-Based Checking - NEEDS REMOVAL
**File:** `ai-debugging.ts` (lines 830-858)  
**Issue:** `balancePairs()` function does manual bracket counting  
**Problem:**
- Regex-based: `/\(/g`, `/\{/g`, `/\[/g` - slow, inaccurate
- Ignores strings/comments (false positives)
- Auto-appends closing brackets (dangerous!)
- **Redundant** with re-banker architecture

**Action Required:**
1. Create JS/TS re-banker (see below)
2. Remove `balancePairs()` from TypeScript main loop
3. Replace with re-banker call (same as Python integration)

---

### ✅ Documented
- Full design in `Syntax errors wrapping the envelope.md`
- Three complete script implementations (JS/TS, Python, PHP)
- Integration plan with MCP server architecture
- Regex patterns for parsing each language's compiler output

### ❌ Not Yet Created
- No `ops/` or `infrastructure/` directories
- Scripts not scaffolded
- MCP server not built
- Not wired into `envelope.py` or `envelope.ts`

---

## Integration Plan

### Phase 1: Standalone Scripts (Drop-in Today)
**Goal**: Get re-banker working independently before MCP integration.

**Location**: `ops/rebank/`

**Files to create**:
1. `ops/rebank/rebank-js-ts.mjs` (Node.js, handles both JS and TS)
2. `ops/rebank/rebank-py.py` (Python syntax checker)
3. `ops/rebank/rebank-php.php` (PHP linter wrapper)
4. `ops/rebank/README.md` (usage documentation)

**Usage**:
```bash
# JavaScript
node ops/rebank/rebank-js-ts.mjs src/foo.js --mode=js

# TypeScript
node ops/rebank/rebank-js-ts.mjs src/bar.ts --mode=ts

# Python
python ops/rebank/rebank-py.py utils/envelope.py

# PHP
php ops/rebank/rebank-php.php legacy/index.php
```

**Output** (on error):
```json
{"file":"src/foo.js","line":10,"column":5,"message":"Unexpected token ')'","code":"JS_SYNTAX","severity":"FATAL_SYNTAX"}
```

**Output** (on success): *(nothing, exit 0)*

---

### Phase 2: Wire into Envelope Helpers
**Goal**: Auto-attach re-banked errors to the envelope.

**Changes**:
1. Update `utils/python/envelope_helpers.py`:
   ```python
   def append_attempt(...):
       # Before AI attempt, run re-banker
       syntax_error = run_rebanker(language, file_path)
       if syntax_error:
           metadata['lastSyntax'] = syntax_error
           # Short-circuit to fix-syntax path
           return trigger_syntax_fix(syntax_error)
   ```

2. Update `utils/typescript/envelope.ts`:
   ```typescript
   async wrapPatch(patch: Record<string, any>): Promise<PatchEnvelope> {
     const syntaxError = await runRebanker(patch.language, patch.file);
     if (syntaxError) {
       envelope.metadata.lastSyntax = syntaxError;
       // Trigger syntax-specific confidence floor
     }
   }
   ```

---

### Phase 3: MCP Server (Advanced)
**Goal**: Expose re-banker as MCP tools for LLM orchestration.

**Location**: `infrastructure/mcp-servers/rebanker-ts/`

**MCP Tools**:
```typescript
{
  "tools": [
    {
      "name": "syntax_check_js",
      "description": "Fast JavaScript syntax check via node --check",
      "inputSchema": {
        "type": "object",
        "properties": {
          "file": { "type": "string" }
        }
      }
    },
    {
      "name": "syntax_check_ts",
      "description": "TypeScript syntax + type check via tsc --noEmit",
      "inputSchema": { /* ... */ }
    },
    {
      "name": "rebank_errors",
      "description": "Parse raw compiler output to 5-field error object",
      "inputSchema": {
        "type": "object",
        "properties": {
          "language": { "enum": ["js", "ts", "py", "php"] },
          "raw_output": { "type": "string" }
        }
      }
    }
  ]
}
```

**Why MCP?**
- Host (your loop) discovers tools dynamically
- Swap implementations without changing host code
- Share tools across multiple LLM agents (Claude, GPT-4, local models)

---

## Key Design Decisions

### 1. **No Schema Changes**
Re-banker output attaches to existing `metadata` field:
```json
"metadata": {
  "created_at": "2025-10-06T...",
  "lastSyntax": {
    "file": "foo.js",
    "line": 10,
    "code": "JS_SYNTAX",
    "message": "Unexpected token"
  }
}
```

### 2. **Fail Fast on Fatal Syntax**
If re-banker detects syntax errors:
- Circuit breaker opens immediately (no AI attempt)
- Confidence floor = 0.95 for syntax fixes (high bar)
- Route to specialized syntax-fix prompt

### 3. **Language-Agnostic Interface**
All scripts output identical JSON structure:
- TypeScript → `{"file": "...", "line": 10, "code": "TS1005", ...}`
- Python → `{"file": "...", "line": 10, "code": "PY_SYNTAX", ...}`
- PHP → `{"file": "...", "line": 10, "code": "PHP_PARSE", ...}`

This enables:
- Single `parse_error(json)` function in envelope helpers
- Cross-language error counting for gradient calculation
- Unified confidence scoring

---

## Next Steps

### Immediate (Today)
1. ✅ **Document current status** (this file)
2. ⏳ **Scaffold `ops/rebank/` directory**
3. ⏳ **Create the 3 re-banker scripts**
4. ⏳ **Add unit tests** (one green, one red per language)

### Short-term (This Week)
5. ⏳ **Wire into `envelope_helpers.py`**
6. ⏳ **Wire into `envelope.ts`**
7. ⏳ **Update tests to expect `metadata.lastSyntax`**

### Medium-term (This Month)
8. ⏳ **Build MCP server** (`infrastructure/mcp-servers/rebanker-ts/`)
9. ⏳ **Add feature flag** (A/B test MCP vs direct shell)
10. ⏳ **Document MCP integration** in README

---

## Questions to Resolve

1. **Where to store re-banker output in envelope?**
   - Option A: `metadata.lastSyntax` (current plan)
   - Option B: `patch_data.syntax_error`
   - Option C: New `attempts[].syntax` field

2. **Should re-banker run on every attempt?**
   - Pro: Always fresh error state
   - Con: Adds 100ms per attempt
   - Middle ground: Only run if previous attempt was syntax-related

3. **What triggers syntax-specific circuit breaker logic?**
   - Option A: Presence of `metadata.lastSyntax`
   - Option B: Error code starts with "SYNTAX"
   - Option C: Confidence < 0.95 + syntax detected

4. **MCP server: TypeScript or Python?**
   - TypeScript: Better Node/TS ecosystem integration
   - Python: Matches existing envelope.py codebase
   - Both: Support dual hosts (feature flag)

---

## Implementation Checklist

### Re-Banker Scripts
- [ ] Create `ops/rebank/` directory
- [ ] `rebank-js-ts.mjs` (JavaScript + TypeScript)
- [ ] `rebank-py.py` (Python)
- [ ] `rebank-php.php` (PHP)
- [ ] `ops/rebank/README.md` (usage docs)
- [ ] Unit tests (one per language)

### Envelope Integration
- [ ] Update `envelope_helpers.py` to call re-banker
- [ ] Update `envelope.ts` to call re-banker
- [ ] Add `metadata.lastSyntax` to schema docs
- [ ] Update test fixtures to include syntax errors

### MCP Server (Optional Phase 3)
- [ ] Create `infrastructure/mcp-servers/rebanker-ts/`
- [ ] Implement MCP protocol (JSON-RPC over stdio)
- [ ] Expose `syntax_check_*` tools
- [ ] Expose `rebank_errors` tool
- [ ] Add MCP client to host loop

---

## References

- **Full design**: `Syntax errors wrapping the envelope.md` (lines 140-500)
- **MCP protocol**: https://modelcontextprotocol.io
- **Node --check**: https://nodejs.org/api/cli.html
- **tsc --noEmit**: https://www.typescriptlang.org/tsconfig/noEmit.html
- **py_compile**: https://docs.python.org/3/library/py_compile.html
- **php -l**: https://code-basics.com/languages/php/lessons/syntax-errors

---

**Status**: Ready to scaffold scripts and integrate.  
**Owner**: Sean Palmer  
**Last updated**: October 6, 2025
