# Softmax Gradient in Your Code: Integration Points

## Where Softmax Lives in Your System

### 1. **TypeScript Implementation** (`utils/typescript/confidence_scoring.ts`)

```typescript
private _softmax(logits: number[]): number[] {
  /** Standard softmax function */
  if (logits.length === 0) return [];
  
  const max = Math.max(...logits);  // For numerical stability
  const exps = logits.map(l => Math.exp(l - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  
  return exps.map(e => e / sum);
}

// Applied to confidence scores:
const scaled_logits = logits.map(logit => logit / this.temperature);
const probabilities = this._softmax(scaled_logits);
```

**Key Points**:
- Subtracts max for numerical stability (prevents overflow)
- Divides by temperature before exponential
- Returns normalized probabilities [0,1] that sum to 1

---

### 2. **Python Implementation** (`utils/python/confidence_scoring.py`)

```python
def _softmax(self, logits: List[float]) -> List[float]:
    """Standard softmax function"""
    if not logits:
        return []
    max_logit = max(logits)
    exp_logits = [math.exp(logit - max_logit) for logit in logits]
    sum_exp = sum(exp_logits)
    if sum_exp == 0:
        return [0.0 for _ in exp_logits]
    return [exp_logit / sum_exp for exp_logit in exp_logits]
```

**Same pattern**: max subtraction → exp → normalize

---

### 3. **Confidence Calculation** (Where Error Delta Affects Softmax)

```typescript
calculate_confidence(
    logits: number[],
    error_type: ErrorType,
    historical_data?: Dict,
    taxonomy_difficulty?: number
) {
    // Apply temperature scaling
    const scaled_logits = logits.map(l => l / this.temperature);
    
    // Calculate probabilities using softmax
    const probabilities = this._softmax(scaled_logits);
    
    // Error delta adjusts the logits in the next attempt
    // (Via confidence merging in envelope.ts)
}
```

**Flow**: 
- Raw error count → Error delta
- Error delta → Confidence adjustment
- Confidence → fed into softmax as logits
- Softmax → strategy probabilities

---

### 4. **Envelope Updates** (`utils/typescript/envelope.ts`)

```typescript
export function mergeConfidence(
    env: MutableEnvelope,
    components: Partial<ConfidenceComponents>
) {
    // Merges error delta + confidence components
    // These become logits for next softmax calculation
    
    env.confidenceComponents ??= { syntax: 0, logic: 0, risk: 0 };
    env.confidenceComponents.syntax = Math.max(0, Math.min(1, components.syntax ?? 0));
    env.confidenceComponents.logic  = Math.max(0, Math.min(1, components.logic ?? 0));
    env.confidenceComponents.risk   = Math.max(0, Math.min(1, components.risk ?? 0));
}
```

**Why it matters**:
- Confidence scores become softmax inputs
- They carry error delta information
- Clamping keeps them valid logits

---

### 5. **Error Delta → Trend → Confidence**

In `ai-debugging.ts`:

```typescript
function errorDelta(prevRaw: any, curRaw: any): any {
    // Returns delta information
    if (!prevRaw) return { kind: 'first', details: '...' };
    
    if (!curRaw || curRaw.status === 'clean') {
        return {
            kind: 'resolved',
            details: 'Error eliminated - zero gradient achieved'
        };
    }
    
    // ... error mutation tracking
}
```

This feeds into:

```python
# In python version (ai-debugging.py):
def error_delta(prev_raw: Optional[dict], cur_raw: Optional[dict]) -> dict:
    # Same logic
    if not prev_raw:
        return {"kind": "first", ...}
    
    if not cur_raw or cur_raw.get("status") == "clean":
        return {"kind": "resolved", ...}
```

---

## The Flow: Error Delta → Softmax → Decision

### Step 1: Collect Error Data

```python
# In run_multi_attempt_test.py:
previous_errors = 34
current_errors = 12
error_delta = previous_errors - current_errors  # = +22
```

### Step 2: Calculate Confidence (Incorporating Delta)

```python
# In utils/confidence_scoring.py:
delta_boost = 0.05 * min(error_delta, 5)  # Cap at 5 errors
new_confidence = base_confidence + delta_boost

# Example:
# base_confidence = 0.70
# error_delta = +22
# delta_boost = 0.05 * 5 = 0.25
# new_confidence = 0.95
```

### Step 3: Build Logits for Softmax

```python
# Strategy logits:
logit_continue = 0.95 + 0.20  # High: keep going
logit_rewrite = 0.95 - 0.30   # Moderate: might try rewrite
logit_rollback = 0.95 - 0.85  # Low: unlikely

logits = [1.15, 0.65, 0.10]
```

### Step 4: Apply Temperature-Adjusted Softmax

```python
# Temperature schedule:
if attempt == 1:
    temperature = 1.2  # More exploration early
elif escalated:
    temperature = 1.5  # Even more exploration (bigger model)
else:
    temperature = max(0.9, 1.0 - 0.05 * attempt)  # Cool down

# Apply softmax with temperature:
scaled_logits = [l / temperature for l in logits]
probabilities = softmax(scaled_logits)
```

### Step 5: Strategy Selection

```python
# With temperature = 1.0:
# softmax([1.15, 0.65, 0.10])
# ≈ [0.62, 0.30, 0.08]

# With temperature = 1.5 (escalated):
# softmax([1.15/1.5, 0.65/1.5, 0.10/1.5])
# softmax([0.77, 0.43, 0.07])
# ≈ [0.48, 0.36, 0.16]  ← More uniform, explore more

# Randomly select weighted by probability
strategy = random.choices(
    ['continue', 'rewrite', 'rollback'],
    weights=[0.62, 0.30, 0.08],
    k=1
)[0]
```

### Step 6: Apply and Measure

```python
# Execute chosen strategy
# Measure new error count
# Loop back
```

---

## Key Configuration Points

### `utils/model_escalation.py`: Temperature Escalation

```python
ESCALATION_CONFIG = {
    'stagnation_attempts': 4,          # Give softmax time
    'max_consecutive_no_progress': 5,  # Before escalating
    'velocity_threshold': 0.05,        # Gradient < 0.05 = stalled
    'temperature_boost': 0.3,          # When escalating
    ...
}
```

**Translation**:
- **4 attempts**: Give softmax 4 data points to learn gradient
- **5 attempts max**: By then, gradient must be clear or escalate
- **0.3 boost**: From T=1.0 to T=1.3 (more exploration for bigger model)

---

## Why Temperature Matters at Each Stage

### Early Attempts (Exploration Phase)
```
Attempt 1-2: Temperature ≈ 1.2-1.3
             Softmax is flatter: [0.40, 0.35, 0.25]
             → Explore multiple strategies equally
             → Collect diverse error deltas
```

### Middle Attempts (Learning Phase)
```
Attempt 3-4: Temperature ≈ 1.0-1.1
             Softmax steepens: [0.65, 0.25, 0.10]
             → Gradient direction emerges
             → Focus on promising strategies
             → Still allow backup options
```

### Late Attempts (Convergence)
```
Attempt 5+: Temperature ≈ 0.8-0.9
            Softmax sharp: [0.85, 0.12, 0.03]
            → Steep gradient toward winner
            → Minimize wasted attempts
            → One clear best strategy
```

---

## Temperature Schedule in Your System

### Current Implicit Schedule

```python
# From model_escalation.py integration:
attempt 1: T = 1.0 + 0.0 = 1.0  (base)
attempt 2: T = 1.0 + 0.0 = 1.0  (stable)
attempt 3: T = 1.0 - 0.05 = 0.95  (slight cool)
attempt 4: T = 1.0 - 0.10 = 0.90  (cooler)
attempt 5: T = 1.0 - 0.15 = 0.85  (cold)

# If escalation happens at attempt 5:
attempt 5: T = 0.85 + 0.30 = 1.15  (back to hot)
```

**Why**: Escalation brings new model (bigger, different strategy space) → reheat temperature to explore.

---

## How Softmax Connects to Circuit Breaker

### Softmax Decides **Which** Strategy
```python
strategy_probs = softmax(confidence_logits, T)
# → [0.70, 0.20, 0.10] for [CONTINUE, REWRITE, ROLLBACK]
```

### Circuit Breaker Decides **Whether** to Execute
```python
if breaker_state == OPEN:
    # Too many failures, ignore strategy
    force_rollback()
elif improvement_velocity < threshold:
    # No progress, ignore strategy
    force_rollback()
else:
    # Execute strategy selected by softmax
    execute_strategy(strategy)
```

**They work together**:
1. Softmax recommends strategy (based on gradient)
2. Circuit breaker enforces safety (prevents runaway loops)

---

## Example: Debugging a 34→12→3 Path

### Attempt 1
```
Errors: 34 → 28 (Δ = +6)
Confidence: 0.65
Logits: [0.85, 0.35, -0.15]
Temperature: 1.0
Softmax: [0.54, 0.32, 0.14]
Decision: CONTINUE (54%)
```

### Attempt 2
```
Errors: 28 → 22 (Δ = +6)
Confidence: 0.72
Logits: [0.97, 0.27, -0.23]
Temperature: 0.95 (cooling)
Softmax: [0.62, 0.27, 0.11]
Decision: CONTINUE (62%) ← Stronger signal
```

### Attempt 3
```
Errors: 22 → 15 (Δ = +7)
Confidence: 0.79
Logits: [1.09, 0.19, -0.31]
Temperature: 0.90 (cooler)
Softmax: [0.71, 0.21, 0.08]
Decision: CONTINUE (71%) ← Clear gradient emerging
```

### Attempt 4
```
Errors: 15 → 8 (Δ = +7)
Confidence: 0.86
Logits: [1.21, 0.11, -0.39]
Temperature: 0.85 (cold)
Softmax: [0.82, 0.14, 0.04]
Decision: CONTINUE (82%) ← Sharp gradient
```

### Attempt 5
```
Errors: 8 → 0 (Δ = +8)
Confidence: 0.93
Logits: [1.33, 0.03, -0.47]
Temperature: 0.85
Softmax: [0.91, 0.08, 0.01]
Decision: PROMOTE ✓
```

**The Gradient**:
- Attempt 1-2: Softmax learning (0.54 → 0.62)
- Attempt 3-4: Gradient clear (0.71 → 0.82)
- Attempt 5: Convergence (0.91 → promote)

---

## Summary: Softmax in Your Healing Loop

| Stage | Role | Temperature | Softmax Output | Decision |
|-------|------|-------------|-----------------|----------|
| Early (1-2) | Explore | ~1.0-1.2 | Flat, uniform | Try multiple strategies |
| Middle (3-4) | Learn | ~0.9-1.0 | Steepening | Prefer best, allow alternatives |
| Late (5+) | Exploit | ~0.8-0.9 | Sharp peak | Strong preference for winner |
| Escalated | Re-explore | ~1.1-1.3 | Flatter | Bigger model explores new space |

---

**Key Takeaway**: 
Your softmax gradient curve carries **error delta information** through **confidence scores**, applies **temperature to control exploration**, and **steepens over attempts as the system learns**. This is why Phase 8 conservative thresholds work: they give softmax time to establish gradient direction before escalating.

---

**Reference**: ERADELTA_SOFTMAX_EXPLAINED.md (full treatment)  
**Created**: October 28, 2025  
**Context**: Softmax Integration in Code-That-Heals-Itself
