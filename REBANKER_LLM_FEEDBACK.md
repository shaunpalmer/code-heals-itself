# Re-banker LLM Feedback Integration

## Problem (Yesterday's Concern)

**Your Question:** 
> "I want to know that the large language model is getting the messages as it goes through"

**The Issue:**
When re-banker detects errors (line numbers, column positions, error codes), that structured data was being:
1. ✅ Captured in `envelope.metadata.rebanker_result`
2. ✅ Used for circuit breaker error delta calculation
3. ❌ **NOT sent to the LLM on retry attempts**

This meant the LLM was blind to the precise error locations that re-banker found.

---

## Solution (Just Implemented)

### What Changed: `ai-debugging.ts` lines 725-757

**Before:**
```typescript
chat.addMessage('user', {
  type: 'attempt.start',
  attempt,
  error_type,
  message,  // Generic: "SyntaxError: Unexpected token"
  last_patch: currentPatch,
  language: 'typescript'
}, { phase: 'attempt' });
```

**After:**
```typescript
const userMessage: any = {
  type: 'attempt.start',
  attempt,
  error_type,
  message,
  last_patch: currentPatch,
  language: 'typescript'
};

// On retry attempts, include structured re-banker error from previous envelope
if (attempt > 1 && result?.envelope?.metadata) {
  const prevRebanker = (result.envelope.metadata as any)?.rebanker_result;
  if (prevRebanker && prevRebanker.line !== null) {
    userMessage.rebanker_previous = {
      file: prevRebanker.file,
      line: prevRebanker.line,              // e.g., 42
      column: prevRebanker.column,          // e.g., 15
      error_code: prevRebanker.code,        // e.g., "JS_SYNTAX"
      error_message: prevRebanker.message,  // e.g., "Unexpected end of input"
      severity: prevRebanker.severity,      // e.g., "FATAL_SYNTAX"
      hint: `Previous patch failed at line ${prevRebanker.line}${prevRebanker.column ? `, column ${prevRebanker.column}` : ''}: ${prevRebanker.message}`
    };
  }
}

chat.addMessage('user', userMessage, { phase: 'attempt' });
```

---

## Impact: LLM Now Sees Structured Errors

### Attempt 1 (Initial)
```json
{
  "type": "attempt.start",
  "attempt": 1,
  "error_type": "SYNTAX",
  "message": "SyntaxError: Unexpected token",
  "last_patch": "const x = { broken",
  "language": "typescript"
}
```

### Attempt 2 (With Re-banker Feedback) ✨
```json
{
  "type": "attempt.start",
  "attempt": 2,
  "error_type": "SYNTAX",
  "message": "SyntaxError: Unexpected token",
  "last_patch": "const x = { maybe_fixed",
  "language": "typescript",
  "rebanker_previous": {
    "file": "test.ts",
    "line": 42,
    "column": 15,
    "error_code": "JS_SYNTAX",
    "error_message": "Unexpected end of input",
    "severity": "FATAL_SYNTAX",
    "hint": "Previous patch failed at line 42, column 15: Unexpected end of input"
  }
}
```

---

## Why This Matters

### Before (Generic Error)
**LLM sees:** "SyntaxError: Unexpected token"  
**LLM thinks:** "Hmm, could be anywhere. Let me try a different approach..."  
**Result:** Shotgun debugging, slow convergence

### After (Structured Error)
**LLM sees:** "Previous patch failed at line 42, column 15: Unexpected end of input"  
**LLM thinks:** "Ah! Line 42 needs a closing brace. Let me fix that specific spot."  
**Result:** Targeted fixes, fast convergence

---

## Re-banker's 5-Field JSON (What LLM Gets)

```json
{
  "file": "test.ts",
  "line": 42,              // ← LLM can target this exact line
  "column": 15,            // ← LLM knows where on the line
  "code": "JS_SYNTAX",     // ← LLM knows error type
  "message": "Unexpected end of input",  // ← LLM gets compiler's exact message
  "severity": "FATAL_SYNTAX"  // ← LLM knows urgency
}
```

---

## Examples: What LLM Will Say Now

### Missing Comma in Array
```
Rebanker: Line 23, column 5: SyntaxError: Unexpected token ']'
LLM Reply: "I see the issue - line 23 is missing a comma after 'value2'. Let me add it."
```

### Undefined Variable
```
Rebanker: Line 67, column 10: ReferenceError: foo is not defined
LLM Reply: "Line 67 references 'foo' which isn't declared. I'll add it at the top of the function."
```

### Missing Closing Brace
```
Rebanker: Line 42, column 15: SyntaxError: Unexpected end of input
LLM Reply: "Line 42 needs a closing brace. The object literal on line 38 wasn't closed."
```

---

## Testing

Run the test to see re-banker feedback in action:

```bash
npm run build
node dist/test_rebanker_llm_feedback.js
```

This will:
1. Submit broken code (missing brace)
2. Trigger re-banker on each attempt
3. Show that structured error data is captured
4. Confirm LLM would receive line/column hints on retries

---

## Circuit Breaker Still Works

This change **adds** LLM feedback without breaking existing flow:

1. **Re-banker runs** → Captures error (line 42, column 15)
2. **Error delta calculated** → `currentErrors = 1` (from re-banker)
3. **Circuit breaker updated** → Tracks `errorsResolved`
4. **LLM receives hint** → `"Previous patch failed at line 42, column 15"`
5. **Jitter still applies** → LLM rate limiting unchanged
6. **Risk observer still runs** → Security checks unchanged

---

## Next Steps

- ✅ **TypeScript version fixed** (just now)
- ⏳ **Python version** (needs similar chat.addMessage integration)
- ⏳ **Test with real LLM** (deploy and observe retry attempts)
- ⏳ **Monitor convergence speed** (does LLM fix errors faster with hints?)

---

## Your Architecture is Sound

You were right to question this! The re-banker was capturing perfect data, but it wasn't reaching the LLM. Now it does. 🎉

**Key insight:** You built circuit breakers, risk observers, jitter, and re-banker. The plumbing was solid. This was just one missing pipe: re-banker → LLM feedback loop.

That "niggling angle" you felt? That was good engineering intuition. 🎯
