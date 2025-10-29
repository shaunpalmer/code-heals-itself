# Dynamic Model Escalation: Visual Guide

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│         HEALING LOOP (run_multi_attempt_test.py)        │
└─────────────────────────────────────────────────────────┘
                          ↓
        ┌────────────────────────────────────┐
        │  Initialize Escalation Decider     │
        │  + Observer (for logging)          │
        └────────────────────────────────────┘
                          ↓
    ┌─────────────────────────────────────────────┐
    │  FOR EACH ATTEMPT:                          │
    │  1. Get current model (starts: 7B)          │
    │  2. Run healing with LLM                    │
    │  3. Measure: bugs fixed, errors, delta     │
    └─────────────────────────────────────────────┘
                          ↓
    ┌─────────────────────────────────────────────┐
    │  CREATE CIRCUIT BREAKER SUMMARY:            │
    │  • circuit_state: OPEN or CLOSED            │
    │  • is_improving: true or false              │
    │  • improvement_velocity: bugs/attempt      │
    │  • error_count, confidence                  │
    └─────────────────────────────────────────────┘
                          ↓
    ┌────────────────────────────────────────────────┐
    │  CALL ESCALATION DECIDER                       │
    │  should_escalate(                              │
    │    current_model,                              │
    │    breaker_summary,                            │
    │    prev_error_count,                           │
    │    current_error_count                         │
    │  )                                             │
    └────────────────────────────────────────────────┘
                          ↓
        ╔════════════════════════════════════╗
        ║     CHECK ESCALATION THRESHOLDS    ║
        ╚════════════════════════════════════╝
              ↙              ↓              ↖
           ┌─┘       ┌──────────────┐       └─┐
           │         │              │         │
        OPEN? ─ No Progress? ─ Stalling? ─ More Checks?
           │         │              │         │
           └─────────┴──────────────┴─────────┘
                          ↓
                    ANY TRIGGERED?
                    YES → ESCALATE ✅
                    NO → CONTINUE
                          ↓
        ┌────────────────────────────────────────┐
        │  if should_escalate:                   │
        │    1. Log event to observer            │
        │    2. Get next model in hierarchy      │
        │    3. Update client.model_name         │
        │    4. Boost temperature by 0.1         │
        │    5. Continue to next attempt         │
        │  else:                                 │
        │    1. Keep current model               │
        │    2. Continue to next attempt         │
        └────────────────────────────────────────┘
                          ↓
                  (Repeat for next attempt)
```

---

## Stagnation Detection Logic

```
ATTEMPT 1 → SUCCESS RATE: 2/7 bugs fixed ✓
   Breaker: CLOSED (first attempt, always allow)
   Velocity: 2.0 (2 bugs / 1 attempt)
   Decision: CONTINUE

ATTEMPT 2 → SUCCESS RATE: 1/7 bugs fixed (4 total)
   Improvement delta: 2 - 1 = 1.0 ✓ (still making progress)
   Breaker: CLOSED (improvement > 0)
   Velocity: 0.5 (1 bug / 2 attempts)
   Decision: CONTINUE

ATTEMPT 3 → SUCCESS RATE: 0/7 bugs fixed (4 total)
   Improvement delta: 1 - 0 = 0.0 ✗ (NO PROGRESS!)
   no_progress_counter = 1
   Breaker: OPEN (no improvement, velocity declining)
   Velocity: 0.33 (4 bugs / 3 attempts)
   Decision: CONTINUE (but mark breaker OPEN)

ATTEMPT 4 → SUCCESS RATE: 0/7 bugs fixed (4 total)
   Improvement delta: 0 - 0 = 0.0 ✗ (STILL NO PROGRESS)
   no_progress_counter = 2
   Breaker: OPEN for 2nd attempt
   ⚠️  ESCALATION THRESHOLD REACHED!
   
   🚀 ESCALATE TO SMARTER MODEL
   From: qwen2.5-coder-7b (7B)
   To:   openai/gpt-oss-20b (20B)
   Reason: "Circuit breaker OPEN for 2 attempts"
```

---

## Model Selection Hierarchy

```
┌──────────────────────────────────────────────────────┐
│         MODEL ESCALATION CHAIN                       │
├──────────────────────────────────────────────────────┤
│                                                      │
│  TIER 1: SMALL (7B)        ← START HERE             │
│  ├─ qwen2.5-coder-7b-instruct                       │
│  │  Capabilities:                                   │
│  │  • Syntax errors ✓                               │
│  │  • Simple logic bugs ✓                           │
│  │  • Type errors ✓                                 │
│  │  • Semantic bugs ✗ (hits limit)                  │
│  │  • Concurrent bugs ✗ (hits limit)               │
│  │                                                  │
│  │  If stuck: ↓ ESCALATE                            │
│  │                                                  │
│  TIER 2: MEDIUM (20B)      ← ESCALATE 1             │
│  ├─ openai/gpt-oss-20b                              │
│  │  Capabilities:                                   │
│  │  • All TIER 1 ✓                                  │
│  │  • Semantic reasoning ✓                          │
│  │  • Type system edge cases ✓                      │
│  │  • Simple concurrency ✓                          │
│  │  • Complex concurrent bugs ✗ (limit)            │
│  │                                                  │
│  │  If still stuck: ↓ ESCALATE                      │
│  │                                                  │
│  TIER 3: LARGE (32B)       ← ESCALATE 2             │
│  ├─ qwen3-32b                                       │
│  │  Capabilities:                                   │
│  │  • All TIER 2 ✓                                  │
│  │  • Complex concurrent bugs ✓                     │
│  │  • Race conditions ✓                             │
│  │  • Multi-threaded logic ✓                        │
│  │  • Quantum computing ✗ (probably)               │
│  │                                                  │
└──────────────────────────────────────────────────────┘
```

---

## Decision Tree

```
Is circuit breaker OPEN?
├─ YES → OPEN for 2+ attempts?
│        ├─ YES → 🚀 ESCALATE
│        └─ NO → Check velocity
│
├─ NO (CLOSED) → Check progress
         ├─ No improvement for 3+ attempts?
         │  ├─ YES → 🚀 ESCALATE
         │  └─ NO → Continue
         │
         └─ Velocity < 0.1?
            ├─ YES (for 3+ attempts) → 🚀 ESCALATE
            └─ NO → Continue
```

---

## Events Timeline

```
Start: 2025-10-28T14:00:00Z
│
├─ 14:00:05 ATTEMPT_RECORDED (Attempt 1)
│  └─ Model: qwen2.5-coder-7b
│     Status: 5 failures
│     Velocity: 0.2
│     State: CLOSED
│
├─ 14:00:15 ATTEMPT_RECORDED (Attempt 2)
│  └─ Model: qwen2.5-coder-7b
│     Status: 4 failures
│     Velocity: 0.15
│     State: OPEN ⚠️
│
├─ 14:00:25 MODEL_ESCALATION 🚀
│  └─ From: qwen2.5-coder-7b
│     To: openai/gpt-oss-20b
│     Reason: Circuit breaker OPEN for 2 attempts
│
├─ 14:00:35 ATTEMPT_RECORDED (Attempt 3)
│  └─ Model: openai/gpt-oss-20b
│     Status: 0 failures ✓ SUCCESS!
│     Velocity: 1.0
│     State: CLOSED
│
└─ 14:00:40 HEALING COMPLETE ✅
   Total escalations: 1
   Final state: All bugs fixed with dynamic escalation
```

---

## Before vs After

### BEFORE (Static Model)
```
7B Model
├─ Attempt 1: Fix 2 bugs
├─ Attempt 2: Fix 1 bug (progress slowing)
├─ Attempt 3: Fix 0 bugs (stuck)
├─ Attempt 4: Fix 0 bugs (stuck)
├─ Attempt 5: Fix 0 bugs (stuck)
└─ Attempt 6: Fix 0 bugs (stuck)
   Result: 3 bugs remain, FAILED ✗
```

### AFTER (Dynamic Escalation)
```
7B Model
├─ Attempt 1: Fix 2 bugs
├─ Attempt 2: Fix 1 bug (breaker signals: STALL)
│
🚀 ESCALATE to 20B Model
│
├─ Attempt 3 (20B): Fix all remaining bugs ✓
   Result: All bugs fixed, SUCCESS ✅
   Escalations: 1
```

---

## Temperature Evolution

```
Attempt 1 (7B):  T=0.40 (baseline)
Attempt 2 (7B):  T=0.55 (gradual increase)
                 [Circuit breaker signals trouble]
🚀 ESCALATE
Attempt 3 (20B): T=0.70 (boost by 0.2 + gradual)
                 [Bigger model + more exploration = Success]
```

---

## Observer Integration

```
┌──────────────────────┐
│ ModelEscalationObserver
└──────────────────────┘
        ↑
        │ Logs events
        │
        ├→ /data/model_escalation_events.jsonl
        │
        └→ (Can attach custom observers)
                        │
                        ├→ Send Slack alert on escalation
                        ├→ Log to Prometheus metrics
                        ├→ Send to ML training pipeline
                        ├→ Update UI dashboard
                        └→ Your custom observer here!
```

---

## Return Value

```python
{
    'success': False,
    'attempts': 6,
    'convergence': [
        {'attempt': 1, 'temp': 0.40, 'failures': 5, 'model': 'qwen2.5-coder-7b'},
        {'attempt': 2, 'temp': 0.55, 'failures': 4, 'model': 'qwen2.5-coder-7b'},
        {
            'attempt': 3,
            'temp': 0.70,
            'failures': 0,
            'success': True,
            'model': 'openai/gpt-oss-20b',
            'escalation': {
                'reason': 'Circuit breaker OPEN for 2 attempts',
                'to_model': 'openai/gpt-oss-20b'
            }
        }
    ],
    'final_failures': 0,
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

**Key Insight**: System that learns its own limits and adapts automatically. 🧠✨
