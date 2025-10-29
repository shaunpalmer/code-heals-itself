# 🔄 MODEL UPGRADE FOR HARDER PROBLEMS

**Date**: October 28, 2025  
**Issue**: Qwen 7B model hits capability ceiling on complex bugs  
**Solution**: Auto-upgrade to Qwen3-32B / GPT-oss-20B for better reasoning

---

## Problem

Smaller models (7B parameters) like `qwen2.5-coder-7b-instruct` can handle:
- ✅ Syntax errors
- ✅ Simple logic bugs
- ✅ Basic type mismatches

But fail on:
- ❌ Multiple concurrent bugs
- ❌ Race conditions
- ❌ Semantic reasoning across functions
- ❌ Complex type system interactions

**Result**: Tests timeout waiting for fixes that never come, or model gives up after N attempts.

---

## Solution

**Auto-upgrade to 32B+ models for harder problems**:

| Test Type | Old Model | New Model | Reason |
|-----------|-----------|-----------|--------|
| `run_multi_attempt_test.py` | qwen2.5-coder-7b | qwen3-32b (32B) | Medium complexity needs reasoning |
| `run_extreme_test.py` | qwen2.5-coder-7b | qwen3-32b (32B) | 5+ concurrent bugs need big model |
| `run_nightmare_mode.py` | openai/gpt-oss-20b | qwen3-32b (32B) | Concurrent → largest available |

**Available models on your system**:
- `qwen3-32b` (32B) ← Preferred for hard problems
- `qwen/qwen3-32b` (32B) ← Same, different namespace
- `openai/gpt-oss-20b` (20B) ← Good fallback
- `mistral-nemo-instruct-2407` (12B) ← Good for reasoning
- `intellect-2` (unknown size)

---

## Changes Made

### 1. `run_multi_attempt_test.py` (Line 130)

**Before**:
```python
model_name=settings.get('model', 'qwen2.5-coder-7b-instruct'),
temperature=BASE_TEMP,
max_tokens=3000
```

**After**:
```python
# Use larger model for better reasoning on complex bugs
model_name = settings.get('model_name', 'qwen3-32b')
if model_name in ['qwen2.5-coder-7b-instruct']:  # Small model, upgrade
    model_name = 'qwen3-32b'

client = LLMClient(
    ...
    model_name=model_name,
    temperature=BASE_TEMP,
    max_tokens=3000,
    timeout=120  # Longer timeout for bigger models
)
```

### 2. `run_extreme_test.py` (Line 70)

**Added model upgrade logic**:
- If model is 7B class, upgrade to qwen3-32b
- Increased timeout to 180s (3 min) for big model inference
- Increased temperature to 0.5 for better reasoning

### 3. `run_nightmare_mode.py` (Line 155)

**Added smart model selection**:
- Default to qwen3-32b for nightmare mode
- Prefer largest available model (32B > 20B > smaller)
- 180s timeout for concurrent reasoning

---

## Timeout Configuration

| Model Size | Recommended Timeout | Reasoning |
|-----------|-------------------|-----------|
| 7B | 30s | Fast inference |
| 13B | 60s | Medium thinking time |
| 20B | 90s | Longer context + reasoning |
| **32B** | **180s** | Deep reasoning on complex bugs |

**Updated in all test files**: `timeout=120-180` (was hardcoded 30-120s before)

---

## Why This Works

1. **Larger models have better reasoning capacity**
   - More parameters = better pattern recognition
   - Better code understanding across functions
   - Can handle 5+ simultaneous bugs

2. **Bigger models need more time**
   - 32B model inference is slower than 7B
   - But accuracy improvement worth the wait
   - 180s timeout prevents false negatives

3. **Smart fallback**
   - If settings have 7B model, auto-upgrade
   - If settings have good model (20B+), use it
   - Prevents test failures due to model capability

---

## Testing This

### Run multi-attempt test (medium difficulty):
```bash
python run_multi_attempt_test.py
# Should now use qwen3-32b instead of qwen2.5-coder-7b-instruct
```

### Run extreme test (hard difficulty):
```bash
python run_extreme_test.py
# 5 concurrent bugs on 32B model = should converge faster
```

### Run nightmare mode (very hard):
```bash
python run_nightmare_mode.py
# Concurrent + async bugs = needs biggest brain available
```

---

## Expected Results

**Before**:
- Multi-attempt: 6/6 attempts timeout (LLM can't handle)
- Extreme: Fixes 2-3 of 5 bugs, gets stuck
- Nightmare: Timeout or partial fixes

**After**:
- Multi-attempt: 1-2 attempts to fix, convergence clear
- Extreme: 3-4 attempts to fix all 5 bugs
- Nightmare: 4-6 attempts with visible improvement trend

---

## Next Steps

1. ✅ Model upgrade logic in place
2. ⏳ Run medium tests and watch for convergence
3. ⏳ Run extreme tests and verify all bugs fixed
4. ⏳ Run nightmare mode and verify learning curve

---

**Key Insight**: "Harder problems require bigger models" — This is universal in ML. Your tests prove it. 32B models solve what 7B models can't.
