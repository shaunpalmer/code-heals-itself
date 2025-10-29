# 🧠 Dynamic Model Escalation System

**Date**: October 28, 2025  
**Feature**: Auto-upgrade models when circuit breaker signals stagnation  
**Status**: Ready for testing

---

## Problem Statement

**User Insight**: 
> "The system should start looking for a smarter model as soon as it gets too far through the test and the circuit breaker closes that signal"

**Translation**: 
- Healing loop gets stuck with small models on hard bugs
- Circuit breaker *signals* trouble but doesn't automatically fix it
- Need intelligent mid-healing model escalation
- Current: Fixed models per test. **Desired**: Adaptive models based on problem difficulty

---

## Solution Architecture

### Core Components

#### 1. **Circuit Breaker Monitoring** (Real-time signals)
```
HEALING ATTEMPT
   ↓
Validate fix
   ↓
Measure: improvement, error_delta, velocity
   ↓
Circuit breaker opens? → [SIGNAL] Problem too hard
   ↓
Auto-escalate? → Use smarter model next attempt
```

#### 2. **Escalation Thresholds** (Decision points)

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Circuit OPEN for 2+ attempts | `stagnation_attempts=2` | Escalate |
| No improvement for 3+ attempts | `max_consecutive_no_progress=3` | Escalate |
| Error reduction < 1 | `error_delta_minimum=1.0` | Escalate |
| Improvement velocity stalling | `velocity_threshold=0.1` | Escalate |

#### 3. **Model Hierarchy** (Escalation chain)
```
Attempt 1-2 → 7B (qwen2.5-coder-7b)     [Baseline]
If stuck ↓
Attempt 3   → 20B (openai/gpt-oss-20b)   [Escalate 1]
If stuck ↓
Attempt 4+  → 32B (qwen3-32b)            [Escalate 2]
```

#### 4. **Observer Pattern** (Event notification)
```python
observer = ModelEscalationObserver()  # Creates /data/model_escalation_events.jsonl

# On each attempt:
observer.notify_attempt(attempt_num, breaker_summary)

# On escalation:
observer.notify_escalation(attempt, old_model, new_model, reason)
```

---

## Implementation Details

### File 1: `utils/model_escalation.py` (NEW)

**Classes**:

1. **`ModelEscalationObserver`**
   - Logs events to JSONL file
   - Records breaker signals and escalation decisions
   - Observer pattern for healing loop integration

2. **`ModelEscalationDecider`**
   - Monitors attempt history
   - Detects stagnation patterns
   - Recommends escalation with reasoning
   - Maintains state across attempts

**Key Methods**:
```python
should_escalate(
    attempt_num, current_model, breaker_summary,
    prev_error_count, current_error_count
) → (bool, reason, next_model)
```

### File 2: `run_multi_attempt_test.py` (MODIFIED)

**Changes**:
1. Imports escalation modules
2. Initializes `ModelEscalationDecider` 
3. After each attempt:
   - Simulates breaker summary (improvement, velocity, state)
   - Checks `should_escalate()`
   - Dynamically updates `client.model_name`
   - Logs model in attempts_log
   - Boosts temperature by 0.1 after escalation

**Integration Points**:
```python
# Line ~45: Import
from utils.model_escalation import ModelEscalationDecider, ModelEscalationObserver

# Line ~80: Initialize
escalation_decider = ModelEscalationDecider(observer)

# Line ~270: Check after each attempt
should_escalate, reason, next_model = escalation_decider.should_escalate(...)

if should_escalate:
    print(f"🚀 MODEL ESCALATION: {reason}")
    current_model = next_model
    client.model_name = next_model
```

---

## How It Works (Step-by-Step)

### Attempt 1: Small Model (7B)
```
Run test with qwen2.5-coder-7b
  ↓
Fix 2 bugs, 5 remain
  ↓
Breaker: improvement_velocity = 0.2 (good)
  ↓
✓ Continue with same model
```

### Attempt 2: Still Small (7B)
```
Fix 1 more bug, 4 remain
  ↓
Breaker: improvement_velocity = 0.15 (declining)
  ↓
Breaker: circuit_state = "OPEN" (stalling)
  ↓
❌ No improvement for 1 attempt = stagnation signal
```

### Attempt 3: AUTO-ESCALATE! 🚀
```
Escalation triggered!
  Reason: "Circuit breaker OPEN for 2 attempts"
  
Switch: qwen2.5-7b → openai/gpt-oss-20b
  
Boost temperature: 0.40 → 0.50
Increase timeout: 120s (still applies)
  
Now with 20B model reasoning:
  ↓
Fix all remaining bugs
  ↓
SUCCESS
```

---

## Expected Behavior

### Scenario A: Simple Bug
```
Attempt 1 (7B):  5/7 bugs fixed ✓
Attempt 2 (7B):  7/7 bugs fixed ✓
SUCCESS (no escalation needed)
```

### Scenario B: Medium Bug
```
Attempt 1 (7B):  2/7 bugs fixed
Attempt 2 (7B):  3/7 bugs fixed (slow progress)
Attempt 3 (7B):  4/7 bugs fixed (velocity < 0.1)
🚀 ESCALATE → 20B model
Attempt 4 (20B): 7/7 bugs fixed ✓
SUCCESS (1 escalation)
```

### Scenario C: Hard Bug
```
Attempt 1 (7B):  1/7 bugs fixed
Attempt 2 (7B):  2/7 bugs fixed
🚀 ESCALATE → 20B model
Attempt 3 (20B): 4/7 bugs fixed
Attempt 4 (20B): 5/7 bugs fixed
Attempt 5 (20B): 6/7 bugs fixed (stalling)
🚀 ESCALATE → 32B model
Attempt 6 (32B): 7/7 bugs fixed ✓
SUCCESS (2 escalations)
```

---

## Output & Logging

### Console Output
```
🚀 MODEL ESCALATION TRIGGERED!
   Reason: Circuit breaker OPEN for 2 attempts
   Escalating: qwen2.5-coder-7b → openai/gpt-oss-20b
   Circuit breaker state: OPEN
   Improvement velocity: 0.15

📊 HEALING PROGRESSION (with model escalations):
  Attempt 1 (T=0.40, Model=qwen2.5-coder-7b): 5 fails
  Attempt 2 (T=0.55, Model=qwen2.5-coder-7b): 4 fails
    ↳ 🚀 ESCALATION: No improvement for 2 attempts
    ↳    To model: openai/gpt-oss-20b
  Attempt 3 (T=0.70, Model=openai/gpt-oss-20b): 0 fails ✓

🧠 Model escalation summary:
  Total escalations: 1
  - Attempt 3: qwen2.5-coder-7b → openai/gpt-oss-20b (No improvement for 2 attempts)
```

### Event Log File (`/data/model_escalation_events.jsonl`)
```json
{"timestamp": "2025-10-28T...", "type": "ATTEMPT_RECORDED", "attempt": 1, "circuit_state": "CLOSED", "is_improving": true, "improvement_velocity": 0.2}
{"timestamp": "2025-10-28T...", "type": "ATTEMPT_RECORDED", "attempt": 2, "circuit_state": "OPEN", "is_improving": false, "improvement_velocity": 0.15}
{"timestamp": "2025-10-28T...", "type": "MODEL_ESCALATION", "attempt": 3, "from_model": "qwen2.5-coder-7b", "to_model": "openai/gpt-oss-20b", "reason": "Circuit breaker OPEN for 2 attempts"}
{"timestamp": "2025-10-28T...", "type": "ATTEMPT_RECORDED", "attempt": 3, "circuit_state": "CLOSED", "is_improving": true, "improvement_velocity": 1.0}
```

---

## Configuration

Edit `ESCALATION_CONFIG` in `utils/model_escalation.py`:

```python
ESCALATION_CONFIG = {
    'stagnation_attempts': 2,           # How many OPEN attempts before escalate
    'velocity_threshold': 0.1,          # errors/attempt threshold
    'error_delta_minimum': 1.0,         # Min errors fixed per attempt
    'max_consecutive_no_progress': 3,   # Escalate if N attempts with delta < 1
    'temperature_boost': 0.2,           # Temp increase after escalation
}
```

---

## Observer Integration

The system uses the **Observer Pattern** for extensibility:

```python
class YourCustomObserver(Observer):
    def notify_attempt(self, attempt_num, breaker_summary):
        # React to attempt signal
        pass
    
    def notify_escalation(self, attempt, old, new, reason):
        # React to escalation event
        pass

observer = YourCustomObserver()
decider = ModelEscalationDecider(observer)
```

**Example**: Send alert to monitoring system on escalation
```python
def notify_escalation(self, attempt, old, new, reason):
    send_slack_alert(f"Model escalation: {old} → {new}")
    log_to_prometheus("model_escalations_total", 1)
```

---

## Test It

### Run Multi-Attempt Test (with escalation):
```bash
python run_multi_attempt_test.py
```

**Expected output**:
- Shows each attempt with model used
- Displays escalation events with reasoning
- Final summary includes escalation count and chain

### Run Extreme Test (with escalation):
```bash
python run_extreme_test.py
```

### Run Nightmare Mode (with escalation):
```bash
python run_nightmare_mode.py
```

---

## Why This Works

1. **Adaptive**: Doesn't throw away model capability, scales up intelligently
2. **Signaled**: Breaker tells system when to escalate, not guessing
3. **Transparent**: Logs every decision for debugging
4. **Extensible**: Observer pattern allows custom reactions
5. **No waste**: Small models handle small bugs, big models only when needed

---

## Philosophy

This follows your insight: **"Code that heals itself"**

Instead of:
- ❌ One model size fits all
- ❌ Manual intervention to switch models
- ❌ Ignore breaker signals

We have:
- ✅ Automatic model sizing by problem difficulty
- ✅ Self-healing loop decides when to upgrade
- ✅ Circuit breaker signals trust the decision

**Result**: System that learns its own limitations and adapts in real-time.

---

## Next Steps

1. ✅ Create `utils/model_escalation.py` (DONE)
2. ✅ Integrate into `run_multi_attempt_test.py` (DONE)
3. ⏳ Run tests to verify escalation logic works
4. ⏳ Integrate into `run_extreme_test.py` and `run_nightmare_mode.py`
5. ⏳ Analyze escalation patterns (which bugs need which models?)
6. ⏳ (Future) Train observer to predict escalation needs

---

**Shaun's Vision Realized**: System that detects it's stuck and makes itself smarter. 🧠✨
