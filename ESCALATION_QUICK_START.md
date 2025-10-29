# 🚀 Quick Start: Dynamic Model Escalation

**Status**: Ready to test  
**Files Modified**: 1  
**Files Created**: 2  

---

## What Changed

### New Files
1. **`utils/model_escalation.py`** (330 lines)
   - Core escalation logic and observer pattern
   - Detects stagnation from circuit breaker signals
   - Auto-recommends model upgrades

2. **`DYNAMIC_MODEL_ESCALATION.md`** (150 lines)
   - Full architecture guide
   - Configuration options
   - Expected behavior examples

### Modified Files
1. **`run_multi_attempt_test.py`** 
   - Added imports for escalation modules
   - Integrated escalation check after each attempt
   - Enhanced output to show models and escalations
   - Returns escalation history in results

---

## How It Works (Simple View)

```
Each Healing Attempt:
  1. Run fix attempt with current model
  2. Check: Is circuit breaker signaling trouble?
  3. If yes → Auto-escalate to smarter model
  4. If no → Continue with same model
  5. Log decision for analysis
```

---

## Run It

```bash
python run_multi_attempt_test.py
```

**New Output You'll See**:
```
🚀 MODEL ESCALATION TRIGGERED!
   Reason: Circuit breaker OPEN for 2 attempts
   Escalating: qwen2.5-coder-7b → openai/gpt-oss-20b
   Circuit breaker state: OPEN
   Improvement velocity: 0.15
```

---

## What Triggers Escalation?

✅ Circuit breaker stays OPEN for 2+ attempts  
✅ No improvement for 3+ attempts in a row  
✅ Error reduction stalls (< 1 error fixed)  
✅ Improvement velocity drops below 0.1  

---

## Model Escalation Chain

```
Problem too hard?
      ↓
7B model stuck (can't find bugs)
      ↓
🚀 Escalate to 20B (openai/gpt-oss-20b)
      ↓
Still stuck?
      ↓
🚀 Escalate to 32B (qwen3-32b)
      ↓
Now problem solved with bigger brain!
```

---

## Configuration

**File**: `utils/model_escalation.py` (lines 29-35)

```python
ESCALATION_CONFIG = {
    'stagnation_attempts': 2,           # Change: How many OPEN attempts trigger escalate
    'velocity_threshold': 0.1,          # Change: What's "too slow" progress
    'error_delta_minimum': 1.0,         # Change: Minimum errors fixed per attempt
    'max_consecutive_no_progress': 3,   # Change: How many attempts before "no progress"
    'temperature_boost': 0.2,           # Change: How much to increase temp after escalate
}
```

---

## Expected Results

### Scenario: 7-Bug Logic Test

**Before** (no escalation):
```
Attempt 1 (7B):  Fixes 2 bugs, 5 remain
Attempt 2 (7B):  Fixes 1 bug, 4 remain
Attempt 3 (7B):  Fixes 1 bug, 3 remain (STALLED)
Attempt 4 (7B):  Fixes 1 bug, 2 remain (STALLED)
Attempt 5 (7B):  Fixes 0 bugs, 2 remain (STUCK)
Attempt 6 (7B):  Fixes 0 bugs, 2 remain (STUCK)
Result: FAILED - Some bugs never fixed
```

**After** (with escalation):
```
Attempt 1 (7B):   Fixes 2 bugs, 5 remain
Attempt 2 (7B):   Fixes 1 bug, 4 remain
🚀 ESCALATE (Circuit breaker signals stagnation)
Attempt 3 (20B):  Fixes 4 bugs, 0 remain ✓
Result: SUCCESS - All bugs fixed with auto-escalation!
```

---

## Logs & Events

### Console Output
- Shows model name per attempt
- Shows escalation events with reasoning
- Final summary includes escalation count

### Event Log: `/data/model_escalation_events.jsonl`
```json
{"type": "ATTEMPT_RECORDED", "attempt": 1, ...}
{"type": "MODEL_ESCALATION", "from": "qwen2.5-7b", "to": "openai/gpt-oss-20b", ...}
{"type": "ATTEMPT_RECORDED", "attempt": 3, ...}
```

### Python Return Value
```python
{
    'success': False,
    'attempts': 6,
    'escalations': [
        {
            'attempt': 3,
            'from': 'qwen2.5-coder-7b',
            'to': 'openai/gpt-oss-20b',
            'reason': 'Circuit breaker OPEN for 2 attempts'
        }
    ]
}
```

---

## Under the Hood

### Circuit Breaker Signals
```python
breaker_summary = {
    'circuit_state': 'OPEN' if no_progress else 'CLOSED',
    'is_improving': improvement > 0,
    'improvement_velocity': errors_fixed / attempts,
    'current_confidence': (7 - failures) / 7
}
```

### Escalation Decision
```python
should_escalate, reason, next_model = escalation_decider.should_escalate(
    attempt_num=attempt,
    current_model=current_model,
    breaker_summary=breaker_summary,
    prev_error_count=prev_error_count,
    current_error_count=current_error_count
)

if should_escalate:
    print(f"🚀 Escalating: {current_model} → {next_model}")
    current_model = next_model
```

---

## Next Steps

1. ✅ Run `run_multi_attempt_test.py`
2. ⏳ Watch for "MODEL ESCALATION" messages
3. ⏳ Check `/data/model_escalation_events.jsonl` for details
4. ⏳ Run `run_extreme_test.py` (same escalation logic applies)
5. ⏳ Run `run_nightmare_mode.py` (concurrent bug escalations)
6. ⏳ Tune thresholds if needed
7. ⏳ Integrate into other test runners

---

## Philosophy

**Before**: "This model isn't working. Give up."

**After**: "This model isn't working. Try a smarter one."

System learns its own limits and adapts automatically. ✨

---

**See Also**: `DYNAMIC_MODEL_ESCALATION.md` for full documentation
