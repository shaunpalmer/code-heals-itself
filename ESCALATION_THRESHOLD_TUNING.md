# Escalation Threshold Tuning: Conservative Strategy

**Date**: October 28, 2025  
**Update**: After initial testing feedback  
**Key Insight**: "Error delta is about progress. Need time for softmax to work."

---

## The Problem

**Initial Config** (Too Aggressive):
```python
'stagnation_attempts': 2,              # Escalate after 2 OPEN attempts
'max_consecutive_no_progress': 3,      # Escalate after 3 no-progress attempts
'velocity_threshold': 0.1,             # Very strict threshold
'error_delta_minimum': 1.0,            # Require 1 bug/attempt minimum
```

**Result**: Easy and medium problems escalating unnecessarily on first sign of trouble.

**Root Cause**: Not giving the model enough attempts to explore problem space.

---

## The Solution: Conservative Thresholds

**New Config** (More Generous):
```python
'stagnation_attempts': 4,              # Escalate after 4 OPEN attempts (was 2)
'max_consecutive_no_progress': 5,      # Escalate after 5 no-progress attempts (was 3)
'velocity_threshold': 0.05,            # Much more lenient threshold (was 0.1)
'error_delta_minimum': 0.5,            # Accept 1 bug every 2 attempts (was 1.0)
'temperature_boost': 0.3,              # Boost exploration more (was 0.2)
```

---

## Why This Works Better

### 1. **`stagnation_attempts: 4` (was 2)**

**Old behavior**:
```
Attempt 1 (7B): Fix 2 bugs (circuit: CLOSED)
Attempt 2 (7B): Fix 0 bugs (circuit: OPEN - immediately)
Attempt 3 (7B): Fix 0 bugs (circuit: OPEN for 2 attempts - ESCALATE!)
PROBLEM: Escalated too early, model never got to explore
```

**New behavior**:
```
Attempt 1 (7B): Fix 2 bugs (circuit: CLOSED)
Attempt 2 (7B): Fix 0 bugs (circuit: OPEN)
Attempt 3 (7B): Fix 1 bug (circuit: CLOSED - improvement!)
Attempt 4 (7B): Fix 1 bug (circuit: CLOSED - still improving)
Attempt 5 (7B): Fix 2 bugs (circuit: CLOSED - found pattern!)
Attempt 6 (7B): Fix all remaining bugs ✓
SUCCESS without escalation
```

### 2. **`max_consecutive_no_progress: 5` (was 3)**

**Rationale**:
- Softmax (and other optimization algorithms) need warmup
- First few attempts might be "exploring" the problem space
- Progress isn't linear - sometimes you go backward temporarily
- Fixing 1 bug every 2 attempts still shows *some* progress

**Example of real progress**:
```
Attempt 1: Fix 3 bugs (big breakthrough)
Attempt 2: Fix 0 bugs (exploring edge cases)
Attempt 3: Fix 1 bug (finding patterns)
Attempt 4: Fix 0 bugs (testing hypotheses)
Attempt 5: Fix 4 bugs (pieces come together)
Attempt 6: Fix all bugs ✓
```

With old threshold (3 no-progress = escalate):
- ❌ Would escalate at attempt 3 (after no progress on 2,3)
- ❌ Model never gets to attempt 5 where it solves it

With new threshold (5 no-progress = escalate):
- ✅ Allows exploration and hypothesis testing
- ✅ Model reaches insight at attempt 5

### 3. **`velocity_threshold: 0.05` (was 0.1)**

**Old**: "If not fixing 0.1+ bugs per attempt, you're stalling"  
**New**: "If not fixing 0.05+ bugs per attempt (1 bug per 20 attempts), you're stalling"

**Real-world**: On a 7-bug problem, 0.05 = "fixing 1 bug every 2 attempts" = perfectly reasonable progress

### 4. **`error_delta_minimum: 0.5` (was 1.0)**

**Old**: "Must fix at least 1 bug per attempt or escalate"  
**New**: "Fix 1 bug every 2 attempts = acceptable progress"

**Why**:
- Not every attempt finds a bug
- Sometimes you're fixing the *same bug differently*
- Progress isn't always +1 bug per attempt

### 5. **`temperature_boost: 0.3` (was 0.2)**

**Rationale**: When you DO escalate, give bigger model more room to explore
- Base temperature: 0.40
- After escalation: 0.40 + 0.3 = 0.70
- This is more exploration, more creativity

---

## Revised Escalation Logic

### When to Escalate (NEW)

**Threshold 1: Persistent circuit breaker failure**
```
Circuit breaker remains OPEN for 4+ consecutive attempts
→ Signal: Model is consistently not making progress
→ Action: Escalate to smarter model
```

**Threshold 2: No progress despite many attempts**
```
5+ consecutive attempts with error_delta < 0.5
→ Signal: Bug isn't being fixed, but model still trying
→ Action: Escalate to smarter model
```

**Threshold 3: Velocity too low**
```
improvement_velocity < 0.05 for sustained period
→ Signal: Progress rate is below acceptable minimum
→ Action: Escalate to smarter model
```

### When NOT to Escalate (NEW)

- ✅ First 2-3 attempts even with no progress (give time to explore)
- ✅ Mixed results (2 bugs fixed, then 0, then 1) = still exploring
- ✅ Temperature increasing (trying harder, not giving up)
- ✅ Error count decreasing over 4+ attempts (slow but steady)

---

## Expected Behavior Change

### Scenario: Medium Difficulty Bug (7 bugs)

**Old Config (Aggressive)**:
```
Attempt 1 (7B): Fix 2 bugs
Attempt 2 (7B): Fix 0 bugs (circuit OPEN)
🚀 ESCALATE (stagnation_attempts=2)
Attempt 3 (20B): Fix 5 bugs
Attempt 4 (20B): Fix all bugs ✓
Result: 1 escalation, 4 attempts total
```

**New Config (Conservative)**:
```
Attempt 1 (7B): Fix 2 bugs
Attempt 2 (7B): Fix 0 bugs (circuit OPEN)
Attempt 3 (7B): Fix 1 bug (progress, circuit CLOSED)
Attempt 4 (7B): Fix 2 bugs (more progress)
Attempt 5 (7B): Fix 2 bugs (continuing)
Attempt 6 (7B): Fix all bugs ✓
Result: 0 escalations, 6 attempts total (but with 7B model!)
```

**Benefit**: Uses efficient small model instead of expensive big model

---

## Tuning Guide

### If You See Too Many Escalations

Increase these:
```python
'stagnation_attempts': 5,  # Give 5 OPEN attempts instead of 4
'max_consecutive_no_progress': 6,  # Give 6 attempts instead of 5
'error_delta_minimum': 0.25,  # Accept even slower progress
```

### If You See No Escalations on Hard Problems

Decrease these:
```python
'stagnation_attempts': 3,  # Escalate after 3 OPEN attempts
'max_consecutive_no_progress': 4,  # Escalate after 4 no-progress attempts
'velocity_threshold': 0.1,  # Tighter tolerance on velocity
```

### If Escalation Happens but Doesn't Help

Increase temperature boost:
```python
'temperature_boost': 0.4,  # Give bigger model more exploration room
```

---

## Monitoring Escalations

**Log every escalation**:
```python
# This shows in /data/model_escalation_events.jsonl:
{
    "attempt": 5,
    "reason": "Circuit breaker OPEN for 4 attempts",
    "from_model": "qwen2.5-coder-7b",
    "to_model": "openai/gpt-oss-20b"
}
```

**Analyze patterns**:
- At which attempt do escalations usually happen?
- Which problems escalate vs solve within single model?
- How often does escalation actually help?

---

## Key Principle: Error Delta is Progress

**User's insight**: "Error delta is about progress."

Your system should:
1. ✅ Track error delta (bugs fixed per attempt)
2. ✅ Give plenty of time for delta to emerge
3. ✅ Only escalate when delta truly stalls
4. ✅ Understand that progress isn't linear

**Philosophy**: "A model making slow but steady progress > escalating to a smarter model prematurely."

---

## Summary of Changes

| Config | Old | New | Reason |
|--------|-----|-----|--------|
| `stagnation_attempts` | 2 | 4 | Give time to explore |
| `max_consecutive_no_progress` | 3 | 5 | Allow exploration phase |
| `velocity_threshold` | 0.1 | 0.05 | More lenient on speed |
| `error_delta_minimum` | 1.0 | 0.5 | Accept slower progress |
| `temperature_boost` | 0.2 | 0.3 | More exploration when escalate |

**Result**: System that respects the algorithm's need to explore, while still escalating when truly stuck.

---

**Next**: Test with conservative thresholds and monitor escalation patterns. Adjust if needed based on real data.
