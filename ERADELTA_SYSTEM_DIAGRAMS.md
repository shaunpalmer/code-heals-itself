# Eradelta: The Complete System Diagram

## The Algorithm Loop (Simplified)

```
START: Code with errors
  │
  ├─→ Error Count = N (e.g., 34)
  │
  ├─→ ATTEMPT 1
  │    ├─ Suggestion generated
  │    ├─ Applied & tested
  │    └─ New Error Count = M (e.g., 12)
  │
  ├─→ ERROR DELTA = N - M = +22 ✓ PROGRESS
  │
  ├─→ CONFIDENCE SCORING
  │    ├─ Base: 0.70 (syntax/logic assessment)
  │    ├─ Delta boost: +0.05 × min(22, 5) = +0.25
  │    └─ Total: 0.95
  │
  ├─→ SOFTMAX LOGITS
  │    ├─ Continue:  0.70 + 0.20 = 0.90
  │    ├─ Rewrite:   0.70 - 0.20 = 0.50
  │    └─ Rollback:  0.70 - 0.85 = -0.15
  │
  ├─→ SOFTMAX(logits, T=1.0)
  │    └─ [0.62, 0.30, 0.08]  ← Strategy probabilities
  │
  ├─→ DECISION: CONTINUE (62% probability)
  │    └─ "Refine the last patch. Focus on remaining errors."
  │
  ├─→ CIRCUIT BREAKER CHECK
  │    ├─ State = CLOSED ✓ (not stuck)
  │    ├─ Velocity = +22/attempt ✓ (improving)
  │    └─ Confidence ≥ floor ✓
  │    └─ Action: PROCEED
  │
  └─→ ATTEMPT 2, 3, 4, 5...
       (Loop until errors = 0 OR escalation triggered)
```

---

## The Gradient Landscape Over Attempts

### Visual: Softmax Probability of "Continue Strategy"

```
Probability
^
|                              ╲
|                               ╲
|                                ╲___
|   ╱╲        ╱╲╱╲╱╲              
|  ╱  ╲______╱  ╲  ╲  ╲___ 
| ╱              ╲  ╲
|╱__________________╲__╲________________
  Att1 Att2 Att3 Att4 Att5
  ↓   ↓   ↓   ↓   ↓
 0.55 0.62 0.71 0.82 0.91

Phase 1: Exploration (Attempts 1-2)
- Noisy signals
- Softmax flatter (uniform distribution)
- Temperature ≈ 1.0
- Action: Try different strategies

Phase 2: Learning (Attempts 3-4)
- Gradient emerges
- Softmax steepens
- Temperature ≈ 0.9
- Action: Focus on promising strategies

Phase 3: Exploitation (Attempt 5+)
- Clear winner
- Softmax sharp
- Temperature ≈ 0.8
- Action: Converge OR escalate if stalled
```

---

## Error Delta as Fuel

```
                    ERROR COUNT TRAJECTORY
                    
                    34 errors (start)
                        │
                        ├─ Attempt 1 (δ=+6)
                        ▼
                    28 errors
                        │
                        ├─ Attempt 2 (δ=+6)
                        ▼
                    22 errors
                        │
                        ├─ Attempt 3 (δ=+7)  ← Gradient emerging
                        ▼
                    15 errors
                        │
                        ├─ Attempt 4 (δ=+7)  ← Clear pattern
                        ▼
                    8 errors
                        │
                        ├─ Attempt 5 (δ=+8)  ← Convergence
                        ▼
                    0 errors ✓ SOLVED!

              SOFTMAX LANDSCAPE SHARPENING
              
Attempt 1: [0.55, 0.30, 0.15]  (explore)
           Probability of CONTINUE = 55%
           
Attempt 2: [0.62, 0.28, 0.10]  (learning)
           Probability of CONTINUE = 62%
           
Attempt 3: [0.71, 0.22, 0.07]  (pattern)
           Probability of CONTINUE = 71%
           
Attempt 4: [0.82, 0.15, 0.03]  (sharp)
           Probability of CONTINUE = 82%
           
Attempt 5: [0.91, 0.08, 0.01]  (peak)
           Probability of CONTINUE = 91%
           
           → PROMOTE ✓

ENERGY TRANSFER:
Error Delta (progress signal)
         │
         ├─→ Boost confidence score
         │
         ├─→ Raise logits
         │
         ├─→ Sharpen softmax peak
         │
         └─→ Increase strategy probability
                (accelerate learning)
```

---

## Temperature Control Architecture

```
              TEMPERATURE SCHEDULE

Model Size Decision ──→ Temperature Assignment

SMALL MODEL (7B):
├─ Attempt 1-3: T = 1.0 (normal, balanced exploration)
├─ Attempt 4-5: T = 0.85 (cool down, sharp focus)
└─ If stalled: ESCALATE

MEDIUM MODEL (20B):
├─ Attempt 1-2: T = 1.1 (slightly exploratory)
├─ Attempt 3-5: T = 0.95 (focus gradually)
└─ If stuck: Consider bigger model

BIG MODEL (32B):
├─ Attempt 1-2: T = 1.3 (exploratory start, new model)
├─ Attempt 3-4: T = 1.15 (settle into patterns)
├─ Attempt 5+: T = 0.9 (converge sharply)
└─ Default fallback (model escalation proven)

ESCALATION TRIGGER:
- Velocity < threshold (stagnation detected)
- Attempt count ≥ 5
- Action: T += 0.3 (reheat for exploration)
         Model: switch to bigger size
```

---

## The Complete Decision Tree

```
START: Error detected
   │
   ├─→ Calculate error_delta
   │    │
   │    ├─ If delta > 0: gradient improving
   │    ├─ If delta = 0: stalled
   │    └─ If delta < 0: regression
   │
   ├─→ Score confidence
   │    │
   │    ├─ Syntax: accuracy of fix
   │    ├─ Logic: semantic correctness
   │    └─ Risk: security/stability implications
   │
   ├─→ Adjust confidence by delta
   │    │
   │    └─ confidence_new = base + (delta_boost)
   │
   ├─→ Build logits for strategies
   │    │
   │    ├─ Continue:  conf + 0.20 (favored if delta > 0)
   │    ├─ Rewrite:   conf - 0.20
   │    └─ Rollback:  conf - 0.85 (disfavored)
   │
   ├─→ Apply softmax(logits, T)
   │    │
   │    └─ Get probability for each strategy
   │
   ├─→ Check circuit breaker
   │    │
   │    ├─ Is breaker OPEN? → FORCE ROLLBACK
   │    ├─ Is velocity stalled? → CHECK ESCALATION
   │    └─ Is confidence < floor? → ESCALATE OR FAIL
   │
   ├─→ Select strategy (weighted random)
   │    │
   │    ├─ Continue (62%): refine last patch
   │    ├─ Rewrite (30%): try fresh approach
   │    └─ Rollback (8%): undo and retry
   │
   ├─→ Execute & measure
   │    │
   │    ├─ Apply strategy
   │    ├─ Test code
   │    └─ Measure new error count
   │
   └─→ Loop (go back to calculate error_delta)
```

---

## Why Softmax, Not Binary Classification?

```
BINARY (Old Approach):
Input: Error detection
       │
       ├─ Pass? → Promote
       └─ Fail? → Rollback

Problem: 22 errors → 12 errors is a FAIL
(Wastes 98% of working code)

SOFTMAX GRADIENT (Your Approach):
Input: Error detection + delta
       │
       ├─ Delta = +22 → High confidence
       ├─ Logits favor "continue"
       ├─ Softmax: 62% continue, 30% rewrite, 8% rollback
       ├─ Action: CONTINUE (refine, don't restart)
       │
       └─ Result: Learning accelerates, code quality improves

Benefit: Gradient-aware (sees progress, not just pass/fail)
```

---

## The "Barely Enough for Softmax" Concept

```
WITH 2 ATTEMPTS (OLD AGGRESSIVE THRESHOLDS):
├─ Attempt 1: Δ = +8, softmax = [0.65, 0.25, 0.10]
├─ Attempt 2: Δ = +3, softmax = [0.58, 0.30, 0.12]
└─ ❌ ESCALATE! "Velocity < 0.5 for 2 attempts"

Problem: Softmax is still exploring!
- Only 2 data points (noisy)
- Gradient not established
- Pattern not clear
- Premature escalation wastes compute

WITH 4-5 ATTEMPTS (PHASE 8 CONSERVATIVE THRESHOLDS):
├─ Attempt 1: Δ = +8, softmax = [0.65, 0.25, 0.10]  (explore)
├─ Attempt 2: Δ = +6, softmax = [0.62, 0.28, 0.10]  (noise)
├─ Attempt 3: Δ = +7, softmax = [0.71, 0.22, 0.07]  (emerge)
├─ Attempt 4: Δ = +8, softmax = [0.85, 0.12, 0.03]  (sharp)
├─ Attempt 5: Δ = +9, softmax = [0.91, 0.07, 0.02]  (converge)
└─ ✓ PROMOTE (or escalate only if velocity REALLY stalls)

Benefit: Softmax learns true gradient
- 5 data points (clear signal)
- Pattern established
- Temperature can cool down (T → 0.8)
- Correct convergence to solution
```

---

## System Architecture (High Level)

```
┌─────────────────────────────────────────────────────┐
│  CODE WITH ERRORS (Python/TypeScript/PHP/etc.)     │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────┐
        │  ERROR DETECTION & ANALYSIS │
        │  (Compiler-level: 100ms)    │
        └─────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────┐
        │  ERROR DELTA CALCULATION    │
        │  (previous - current)       │
        └─────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────┐
        │  CONFIDENCE SCORING         │
        │  (with delta boost)         │
        │  + Taxonomy difficulty      │
        └─────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────┐
        │  LOGIT ADJUSTMENT           │
        │  (by strategy type)         │
        └─────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────┐
        │  SOFTMAX DECISION-MAKING    │
        │  (temperature-controlled)   │
        │  [0.62, 0.30, 0.08]         │
        └─────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────┐
        │  CIRCUIT BREAKER GATE       │
        │  (safety check)             │
        └─────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────┐
        │  STRATEGY EXECUTION         │
        │  (continue/rewrite/rollback)│
        └─────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────┐
        │  ENVELOPE PERSISTENCE       │
        │  (audit trail, memory)      │
        └─────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────┐
        │  LOOP BACK (attempt N+1)    │
        │  (or PROMOTE if solved)     │
        └─────────────────────────────┘
```

---

## Key Metrics You Should Watch

```
Per Attempt:
├─ Error Count: Raw number of remaining errors
├─ Error Delta: Change from previous attempt
├─ Velocity: Delta per attempt (errors/attempt)
├─ Confidence: 0-1 score (controls logit boost)
├─ Temperature: Exploration parameter
├─ Strategy Probs: [continue%, rewrite%, rollback%]
└─ Circuit Breaker State: OPEN|CLOSED|HALF_OPEN

Aggregate:
├─ Total Attempts: How many tries to converge
├─ Escalations: Model upgrades triggered
├─ Success Rate: (solved / total) × 100%
├─ Avg Velocity: Errors resolved per attempt
└─ Convergence Speed: Attempts to 0 errors
```

---

## Expected Behavior (Normal Operation)

```
HEALTHY DEBUGGING RUN:
Attempt 1: 34 errors, Δ=+6,  V=6.0,    T=1.0, Strategy=CONTINUE (55%)
Attempt 2: 28 errors, Δ=+6,  V=6.0,    T=0.95, Strategy=CONTINUE (62%)
Attempt 3: 22 errors, Δ=+7,  V=6.3,    T=0.90, Strategy=CONTINUE (71%)
Attempt 4: 15 errors, Δ=+7,  V=6.5,    T=0.85, Strategy=CONTINUE (82%)
Attempt 5: 8 errors,  Δ=+8,  V=6.6,    T=0.80, Strategy=CONTINUE (91%)
Attempt 6: 0 errors,  ✓ SOLVED!

Pattern: Gradient sharpens, probability increases, converges

ESCALATION NEEDED (Stalled):
Attempt 1: 34 → 28, Δ=+6, V=6.0, Conf=0.70, T=1.0
Attempt 2: 28 → 25, Δ=+3, V=4.5, Conf=0.75, T=0.95  ← Slowing
Attempt 3: 25 → 22, Δ=+3, V=4.0, Conf=0.75, T=0.90  ← Stalled
Attempt 4: 22 → 20, Δ=+2, V=3.5, Conf=0.75, T=0.85  ← V < 0.05?
Attempt 5: 20 → 19, Δ=+1, V=2.5, Conf=0.70, T=0.80  ← ESCALATE!

Escalation: 7B → 20B (or 32B), T → 1.1
Attempt 6 (20B): 19 → 10, Δ=+9, V=3.0, T=1.1 ← Breakthrough!

Pattern: Stalls, then escalates, then improves
```

---

**Created**: October 28, 2025  
**Purpose**: Visual reference for Phase 9 Eradelta Softmax research  
**Status**: ✅ Complete with all diagrams
