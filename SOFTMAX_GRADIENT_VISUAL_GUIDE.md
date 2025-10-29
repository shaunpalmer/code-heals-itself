# Softmax Gradient Curve: Visual Quick Reference

## The Core Insight

> **Softmax = Directional Probability Landscape (Not a Bell Curve)**

---

## Visual 1: Softmax vs Normal Distribution

### Normal Distribution (Bell Curve)
```
Probability
    ^
    |     ╱╲
    |    ╱  ╲
    |   ╱    ╲
    |  ╱      ╲
    | ╱        ╲
    |___________╲___________
         μ
    ← symmetric around mean →
    (equal tails on both sides)
```
- Used for: Natural variation, errors, measurements
- Shape: Symmetric, continuous spread

### Softmax (Directional Gradient)
```
Probability
    ^
    |                    ╲
    |              ╱╲     ╲
    |             ╱  ╲     ╲
    |            ╱    ╲     ╲___
    |    ╱╲     ╱      ╲
    |   ╱  ╲___╱        ╲
    |__╱__________________╲__________
        ↑       ↑           ↑
       low    medium      high logit
    
    Peaked at highest input
    (exponential amplification)
```
- Used for: Classification, strategy selection, decisions
- Shape: Asymmetric, directional toward winner

---

## Visual 2: How Softmax Amplifies Logit Differences

### Input Logits: [0.5, 2.0, 0.1]

**Step 1: Exponential** (The Amplifier)
```
Input:  0.5      2.0      0.1
         ↓        ↓        ↓
exp():  1.65     7.39     1.11

Ratio of largest/smallest:
7.39 / 1.11 ≈ 6.7x amplification!
(Original difference: 2.0 - 0.1 = 1.9)
```

**Step 2: Normalize** (The Constraint)
```
Sum = 1.65 + 7.39 + 1.11 = 10.15

Softmax:  0.163    0.728    0.109
          ^^^      ^^^      ^^^
          16.3%    72.8%    10.9%

Winner gets 4.5x the runner-up!
```

---

## Visual 3: Temperature Effect (Exploration vs Exploitation)

```
Temperature = 0.1 (COLD — Exploitation)
    Probability
    ^
    |                        ╲
    |                         ╲
    |                          ╲
    |                           ╲___
    |
    |_________________________________
    Sharp gradient → steep descent
    Winner: 99.9%, Others: 0.05%
    (Always pick best strategy)


Temperature = 1.0 (NORMAL — Balanced)
    Probability
    ^
    |                    ╲
    |              ╱╲     ╲
    |             ╱  ╲     ╲___
    |            ╱    ╲
    |           ╱      ╲
    |__________╱________╲_________
    Moderate gradient
    Winner: 72.8%, Runner-up: 16.3%, Other: 10.9%
    (Prefer best, allow alternatives)


Temperature = 5.0 (HOT — Exploration)
    Probability
    ^
    |    ╱╲╱╲╱╲
    |   ╱  ╲  ╲  ╲
    |  ╱    ╲  ╲  ╲
    | ╱      ╲  ╲  ╲___
    |╱        ╲  ╲
    |__________╲__╲________
    Shallow gradient
    Distribution nearly uniform: ~33%, 34%, 33%
    (All options considered equally)
```

---

## Visual 4: Error Delta Gradient Over Attempts

### Scenario: Debugging a 34-error codebase

```
Attempt 1: Errors 34 → 28    Δ = +6
          Softmax: uncertain
          "Let me try different strategies"
          Temperature ≈ 1.0 (explore)

Attempt 2: Errors 28 → 22    Δ = +6
          Softmax: starting to learn
          "Pattern emerging..."
          Temperature ≈ 1.0 (still exploring)

Attempt 3: Errors 22 → 15    Δ = +7
          Softmax: gradient clear
          "Refinement works better!"
          Temperature ≈ 0.9 (shift focus)

Attempt 4: Errors 15 → 8     Δ = +7
          Softmax: steep gradient
          "Keep refining!"
          Temperature ≈ 0.7 (strong preference)

Attempt 5: Errors 8 → 0      Δ = +8
          Softmax: converged
          ✓ Problem solved!
```

**The Gradient Landscape**:
```
Probability of "Continue Refinement"
^
|                              ╲
|                               ╲
|                                ╲___
|    ╱╲                              
|   ╱  ╲╱╲╱╲
|  ╱        ╲___
|_╱____________________
  Att1 Att2 Att3 Att4 Att5
  ↑   ↑   ↑   ↑   ↑
  noisy → clear → steep → convergence

Att 1-2: Softmax exploring (flat terrain)
Att 3-4: Gradient emerges (slope appears)
Att 5+:  Sharp gradient (clear winner)
```

---

## Visual 5: Why "Barely Enough for Softmax"

### Escalation Too Early (2 attempts)
```
Softmax hasn't learned gradient yet:

Attempt 1: [0.65, 0.25, 0.10]  (high uncertainty)
Attempt 2: [0.58, 0.30, 0.12]  (still noisy)

❌ ESCALATE! (Stagnation detected)

But really: gradient just starting to emerge!
(Softmax needs 3-4 points to trust the direction)
```

### Conservative Escalation (4-5 attempts)
```
Softmax learns true gradient:

Attempt 1: [0.65, 0.25, 0.10]  (exploration)
Attempt 2: [0.58, 0.30, 0.12]  (noise filtering)
Attempt 3: [0.72, 0.18, 0.10]  (pattern emerges)
Attempt 4: [0.89, 0.08, 0.03]  (clear gradient)
Attempt 5: [0.95, 0.04, 0.01]  (convergence)

✓ Only escalate if velocity stays < 0.05 after attempt 5
```

---

## Visual 6: Temperature Boost on Escalation

### Without Escalation (7B model stuck)
```
Low Temperature (T ≈ 0.8):

Strategy Landscape:
|                          ╲
|                           ╲___
|_____________________________╲__
Strategy A  B  C  D  E...

→ Stuck at local optimum (narrow peak)
→ Can't explore other strategies
```

### With Escalation + Temperature Boost (32B model, T + 0.3)
```
Higher Temperature (T ≈ 1.1):

Strategy Landscape:
|              ╱╲╱╲╱╲
|            ╱  ╲  ╲  ╲
|   ╱╲___  ╱    ╲  ╲  ╲
|__╱__╲__╱______╲__╲___

→ Broader exploration (flatter peak)
→ 32B model can find better strategies
→ Then converges (T decreases as learning happens)
```

---

## Visual 7: The Complete Loop

```
Raw Error Count Change
         ↓
    Error Delta
         ↓
    Confidence Score (adjusted by delta)
         ↓
    Logit = base_confidence + delta_boost
         ↓
    Apply Softmax with Temperature
         ↓
         ├─ [Continue/Refine]:    0.728
         ├─ [Rewrite]:            0.212
         └─ [Rollback]:           0.060
         ↓
    Strategy Selection (weighted random)
         ↓
    Apply Selected Strategy
         ↓
    Measure New Error Count
         ↓
    ← Loop back (gradient learned)
```

---

## Key Equations at a Glance

### Standard Softmax
$$\sigma(z)_i = \frac{e^{z_i}}{\sum_j e^{z_j}}$$

### Temperature-Adjusted Softmax
$$\sigma_T(z)_i = \frac{e^{z_i/T}}{\sum_j e^{z_j/T}}$$

### Error Delta → Logit Boost
$$\text{logit}_{\text{new}} = \text{confidence} + (0.05 \times \text{delta})$$

### Gradient Measure
$$\text{velocity} = \frac{\Delta(\text{errors})}{\Delta(\text{attempts})}$$

---

## The One-Liner

> **Softmax creates a directional probability landscape (peaked toward winners) that needs multiple data points (4-5 attempts) to establish a reliable gradient. Temperature controls how much to explore vs exploit.**

---

**Reference**: ERADELTA_SOFTMAX_EXPLAINED.md (full technical treatment)  
**Created**: October 28, 2025
