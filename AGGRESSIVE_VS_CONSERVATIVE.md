# Aggressive vs Conservative: Visual Comparison

**Question**: When should a model escalate?

**Answer**: When it's TRULY stuck, not when it's just exploring.

---

## Side-by-Side: Old vs New

### Configuration Changes

```
AGGRESSIVE (Initial)          →  CONSERVATIVE (Tuned)
────────────────────────────────────────────────────
stagnation_attempts: 2        →  stagnation_attempts: 4
max_no_progress: 3            →  max_no_progress: 5
velocity_threshold: 0.1       →  velocity_threshold: 0.05
error_delta_min: 1.0          →  error_delta_min: 0.5
temp_boost: 0.2               →  temp_boost: 0.3
```

---

## Real Example: 7-Bug Problem

### AGGRESSIVE (Old Thresholds)

```
Attempt 1 (7B):   Fix 2 bugs ✓ (Breaker: CLOSED, velocity: 2.0)
Attempt 2 (7B):   Fix 0 bugs ✗ (Breaker: OPEN, velocity: 1.0)
Attempt 3 (7B):   Fix 0 bugs ✗ (Breaker: OPEN for 2 attempts)
                  ⚠️  STAGNATION_ATTEMPTS threshold hit!
                  
🚀 ESCALATE TO 20B MODEL
   Reason: Circuit breaker OPEN for 2 attempts

Attempt 4 (20B):  Fix 4 bugs ✓ (Breaker: CLOSED, velocity: 1.5)
Attempt 5 (20B):  Fix all remaining bugs ✓ (SUCCESS)

RESULT: Escalated at attempt 3, needed 5 total attempts
COST: Used expensive 20B model when 7B might have solved it
PROBLEM: Gave 7B model only 2 chances to explore
```

### CONSERVATIVE (New Thresholds)

```
Attempt 1 (7B):   Fix 2 bugs ✓ (Breaker: CLOSED, velocity: 2.0)
Attempt 2 (7B):   Fix 0 bugs ✗ (Breaker: OPEN, velocity: 1.0)
Attempt 3 (7B):   Fix 1 bug ✓ (Breaker: CLOSED, velocity: 0.67)
                  ✓ Progress detected! Continue.
Attempt 4 (7B):   Fix 0 bugs ✗ (Breaker: OPEN again, velocity: 0.5)
Attempt 5 (7B):   Fix 2 bugs ✓ (Breaker: CLOSED, velocity: 0.6)
Attempt 6 (7B):   Fix 2 bugs ✓ (All bugs fixed! SUCCESS)

RESULT: No escalation, 6 attempts total
COST: Used efficient 7B model for entire problem
BENEFIT: Found solution with small model, saved compute
LEARNING: Gave 7B model time to explore and find pattern
```

---

## What's Happening in the Loop

### Aggressive (Old)

```
Attempt 2: "No bugs fixed. Circuit OPEN."
Attempt 3: "Still no bugs. That's 2 OPEN attempts. ESCALATE NOW."
         ❌ Problem: Model was just starting to explore!
```

### Conservative (New)

```
Attempt 2: "No bugs fixed. Circuit OPEN."
Attempt 3: "Oh wait, fixed 1 bug! Progress detected. CLOSED."
Attempt 4: "No bugs this time, but we've seen progress before."
Attempt 5: "Fixed 2 bugs! Clear pattern emerging."
Attempt 6: "All solved!"
         ✅ Problem: Model had time to understand the bugs.
```

---

## When to Use Which

### Use AGGRESSIVE (stagnation: 2) IF:

- ✅ You're testing expensive LLMs (want quick feedback)
- ✅ You have very hard problems (want to escalate early)
- ✅ You have 50/50 chance problems need big model
- ✅ You want fast results, don't care about cost

### Use CONSERVATIVE (stagnation: 4) IF:

- ✅ You want to minimize compute cost
- ✅ Most problems solvable with small models
- ✅ You prefer letting algorithm explore
- ✅ You want data on what problems REALLY need escalation

---

## Real-World Impact

### 100 Problems

**Aggressive (Old)**:
```
Result: 45 escalations
Cost: 55 × 7B + 45 × 20B = 385 BLOPs
Time: Faster (more 20B usage)
Waste: ~20 unnecessary escalations
```

**Conservative (New)**:
```
Result: 12 escalations (only truly hard problems)
Cost: 88 × 7B + 12 × 20B = 256 BLOPs
Time: Slower (more 7B usage)
Waste: 0 unnecessary escalations
SAVINGS: 33% compute reduction!
```

---

## Error Delta Over Time

### Aggressive (2 attempts, then escalate)

```
Error count: [7] → [5] → [5] → [1] → [0]
              A1   A2   A3   A4   A5
            (7B) (7B)ESC(20B)(20B)
              
Progress visible: Only after escalation
```

### Conservative (5 attempts with same model)

```
Error count: [7] → [5] → [4] → [4] → [2] → [0]
              A1   A2   A3   A4   A5   A6
            (7B) (7B) (7B) (7B) (7B) (7B)

Progress visible: At A3, A5, A6 (pattern emerges over time)
```

---

## Metrics to Track

### Before Escalation

- **Circuit breaker state**: CLOSED vs OPEN
- **Error delta per attempt**: How many bugs fixed this attempt
- **Velocity trend**: Is progress accelerating or slowing?
- **Confidence**: Model's confidence in its fixes

### Escalation Decision

- **Reason**: Why escalate? (OPEN for N, no progress N attempts, low velocity)
- **Severity**: How stuck? (1 attempt no progress vs 5 attempts)
- **Prediction**: Will escalation help? (Is problem hard or is model wrong approach?)

### After Escalation

- **Did it help?**: Do bugs reduce with bigger model?
- **Efficiency**: Would solving with same model + more attempts been better?
- **Pattern**: What types of bugs need escalation?

---

## Algorithm Insight

**Why Softmax Needs Time**:
```
Attempt 1: Random exploration (low quality fixes)
Attempt 2: Still exploring, hitting local minima
Attempt 3: Starting to see patterns
Attempt 4: Refining approach based on patterns
Attempt 5: Breaking through to good solutions
Attempt 6: Convergence!
```

**If you escalate at Attempt 2**:
```
❌ You interrupt exploration phase
❌ Never see the breakthrough at Attempt 5
❌ Unnecessarily upgrade models
```

**If you wait until Attempt 4-5**:
```
✅ Algorithm had time to explore
✅ You see real patterns emerge
✅ Only escalate if truly stuck
✅ Make smart decisions about when to upgrade
```

---

## Summary

| Aspect | Aggressive | Conservative |
|--------|-----------|--------------|
| **Escalation Speed** | Fast | Slow |
| **Compute Cost** | High | Low |
| **Data Quality** | Noisy | Clean |
| **Best For** | Hard problems | Mixed problems |
| **Error Delta Insight** | Premature | Accurate |

**Your feedback**: "Error delta is about progress."

**Our fix**: Give algorithm time to show that progress clearly.

---

**New approach**: Conservative thresholds that respect the algorithm's exploration phase, escalate only when truly necessary. 🧠
