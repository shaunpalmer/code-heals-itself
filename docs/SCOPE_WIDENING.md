# Scope Widening Detection - ReBanker Pattern Analysis

## 🎯 The Problem: "Can't See the Forest for the Trees"

### Scenario
```python
# File: user_service.py, Line 1624
def process_user(user_id):
    return self._validate_user(user_id)  # ❌ Error here
```

**Healing Attempts:**
```
Attempt 1: Fix line 1624 → REJECTED (line 1624 error)
Attempt 2: Fix line 1624 differently → REJECTED (line 1624 error)
Attempt 3: Fix line 1624 again → REJECTED (line 1624 error)
```

**The Real Problem:**
```python
# Line 1580 (upstream in same class)
def _validate_user(self, user_id):  # ← Private method!
    # This is the actual issue - method is private
    # Calling code can't access it
```

**Human Developer Strategy:**
1. Sees error on line 1624 multiple times
2. Realizes "I'm stuck - let me look at the bigger picture"
3. **Widens scope** to read full class
4. Finds private method on line 1580
5. Fixes visibility or refactors

---

## 🧠 AI Solution: Pattern-Based Scope Widening

### `detect_stuck_pattern()` - ReBanker Helper

**Location:** `utils/python/envelope_helpers.py`

**Purpose:** Detect when healing attempts are stuck at the same line/area, indicating the need to widen context scope.

### Algorithm

```python
def detect_stuck_pattern(history: List[Dict], tolerance: int = 5) -> Optional[Dict]:
    """
    Analyze envelope history for stuck patterns.
    
    Returns recommendation if 3+ attempts fail within ±tolerance lines
    """
    # Extract line numbers from rebanker_raw (immutable truth packets)
    line_numbers = []
    for envelope in history:
        rebanker_raw = envelope.get("metadata", {}).get("rebanker_raw", {})
        if rebanker_raw.get("status") != "clean":
            line = rebanker_raw.get("line")
            if line:
                line_numbers.append(int(line))
    
    # Check if stuck on same line (±tolerance)
    # Example: [1624, 1623, 1625, 1624] with tolerance=5
    # All within ±5 of 1624 → STUCK!
    first_line = line_numbers[0]
    stuck_count = sum(1 for line in line_numbers if abs(line - first_line) <= tolerance)
    
    if stuck_count >= 3:
        return {
            "stuck": True,
            "line": first_line,
            "stuck_count": stuck_count,
            "message": f"🔍 SCOPE WIDENING NEEDED: {stuck_count} attempts stuck near line {first_line}...",
            "strategy": "widen_scope"
        }
    
    return None
```

---

## 📊 Example: Real-World ROP Code

### The Stuck Pattern

```python
# user_controller.py
class UserController:
    def __init__(self):
        self.service = UserService()
    
    def handle_request(self, user_id):
        # Line 1624: Error reported here
        result = self.service._validate_user(user_id)  # ❌
        return result
```

**Healing History:**
```
Envelope 1: Line 1624, REJECTED, Confidence 0.45
  Fix: Try different syntax at line 1624
  
Envelope 2: Line 1623, REJECTED, Confidence 0.48
  Fix: Adjust line 1623 import
  
Envelope 3: Line 1625, REJECTED, Confidence 0.42
  Fix: Change line 1625 return statement
```

**Pattern Detection:**
```python
detect_stuck_pattern(history, tolerance=5)
# Returns:
{
    "stuck": True,
    "line": 1624,
    "stuck_count": 3,
    "message": "🔍 SCOPE WIDENING NEEDED: 3 attempts stuck near line 1624. " +
               "Error may be upstream (private method, class scope, visibility issue). " +
               "Human strategy: Expand context to include full class/module block.",
    "strategy": "widen_scope"
}
```

---

## 🔍 Scope Widening Strategy

When stuck pattern detected, LLM receives guidance:

### Before (Narrow Scope)
```
Context: Lines 1620-1630 (10 lines around error)
```

### After (Widened Scope)
```
Context: Full UserController class (lines 1500-1700)
```

Now the LLM can see:
- The private `_validate_user()` method definition
- Class structure and visibility
- Import statements
- Related methods that might be affected

---

## 🎓 Why This Matters

### Common "Stuck" Scenarios

1. **Private Method Access (ROP)**
   ```python
   # Error on line 100
   result = obj._private_method()  
   # Real issue: method is private (line 50)
   ```

2. **Missing Import**
   ```python
   # Error on line 500
   x = SomeClass()
   # Real issue: import missing at top of file (line 5)
   ```

3. **Class-Level Configuration**
   ```python
   # Error on line 300
   self.config['key']
   # Real issue: config not initialized in __init__ (line 10)
   ```

4. **Scope/Closure Issues**
   ```python
   # Error on line 200
   return inner_func()
   # Real issue: inner_func defined incorrectly (line 180)
   ```

---

## 📈 Integration with Memory Feedback Loop

The scope widening detection integrates seamlessly with the memory feedback system:

### Flow

```
1. AIDebugger attempts fix → Line 1624 error
   ↓
2. Envelope saved with rebanker_raw: {line: 1624, ...}
   ↓
3. Memory queue stores envelope
   ↓
4. Pattern analysis: detect_stuck_pattern(recent_5)
   ↓
5. If stuck: LLM receives "🔍 SCOPE WIDENING NEEDED"
   ↓
6. LLM requests broader context (full class)
   ↓
7. Next attempt uses widened scope → Finds root cause!
```

### LLM Context Injection

```python
# Before LLM query
pattern_insights = get_pattern_insights()

if pattern_insights.get("scope_widening_needed"):
    chat.add_message("system", 
        f"⚠ STUCK PATTERN DETECTED near line {pattern_insights['stuck_location']}. "
        f"Tried {pattern_insights['stuck_count']} times with no success. "
        f"Strategy: Expand context to full class/module to find upstream cause."
    )
```

---

## 🔧 Configuration

### Tolerance (Default: ±5 lines)

```python
# Strict: Only exact same line
detect_stuck_pattern(history, tolerance=0)

# Default: Same general area (±5 lines)
detect_stuck_pattern(history, tolerance=5)

# Loose: Wider area (±20 lines)
detect_stuck_pattern(history, tolerance=20)
```

### Minimum Attempts (Default: 3)

The algorithm requires at least 3 failed attempts in the same area before triggering scope widening. This avoids false positives on first/second try.

---

## 🎯 Success Metrics

### Before Scope Widening
```
Stuck on line 1624:
- Attempt 1: REJECTED (narrow context)
- Attempt 2: REJECTED (narrow context)
- Attempt 3: REJECTED (narrow context)
- Attempt 4: REJECTED (narrow context)
- Attempt 5: HUMAN_REVIEW (gave up)
```

### With Scope Widening
```
Stuck on line 1624:
- Attempt 1: REJECTED (narrow context)
- Attempt 2: REJECTED (narrow context)
- Attempt 3: SCOPE WIDENING TRIGGERED
- Attempt 4: PROMOTED ✅ (widened context found root cause!)
```

**Improvement:** 5 attempts → 4 attempts (20% faster)  
**Human Escalation:** Avoided!

---

## 🏗️ Architecture: Proper Separation of Concerns

### Why in ReBanker Helpers?

The stuck pattern detection belongs in **ReBanker** (not storage layer) because:

1. **ReBanker owns immutable truth packets** - Line numbers, error locations, hash-verified data
2. **Pattern detection is about truth convergence** - Detecting when we're not converging toward zero error
3. **Storage is a dumb observer** - Should only store/retrieve, not analyze patterns
4. **Reusability** - Other systems can use ReBanker helpers without depending on storage

### Correct Layering

```
┌─────────────────────────────────────────┐
│ AIDebugger (Orchestration)              │
│ - Calls detect_stuck_pattern() directly │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ ReBanker Helpers (Pattern Analysis)     │
│ - detect_stuck_pattern()                │
│ - Analyzes rebanker_raw packets         │
│ - Returns scope widening recommendation │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ Envelope Storage (Dumb Observer)        │
│ - Stores envelopes in memory + SQLite   │
│ - No intelligent analysis               │
│ - Just persistence and retrieval        │
└─────────────────────────────────────────┘
```

---

## 📝 Usage Example

### In AIDebugger

```python
from utils.python.envelope_helpers import detect_stuck_pattern

class AIDebugger:
    def attemptWithBackoff(self, ...):
        # Get recent envelope history
        history = self.get_recent_envelopes(limit=5)
        
        # Check for stuck pattern (ReBanker analysis)
        stuck_result = detect_stuck_pattern(history, tolerance=5)
        
        if stuck_result and stuck_result.get("stuck"):
            # Inject scope widening guidance into LLM prompt
            chat.add_message("system", stuck_result["message"])
            
            # Expand context for next attempt
            context_lines = self._widen_scope(
                current_line=stuck_result["line"],
                strategy="full_class"  # or "full_module"
            )
        
        # Continue with attempt...
```

### In Pattern Insights

```python
def get_pattern_insights(recent_envelopes):
    insights = {...}
    
    # Use ReBanker helper for scope analysis
    stuck_result = detect_stuck_pattern(recent_envelopes)
    
    if stuck_result:
        insights["patterns"].append(stuck_result["message"])
        insights["scope_widening_needed"] = True
        insights["stuck_location"] = stuck_result["line"]
    
    return insights
```

---

## 🚀 Future Enhancements

### 1. **Adaptive Tolerance**
```python
# Increase tolerance if still stuck after widening
if attempt > 3 and still_stuck:
    tolerance = min(tolerance * 2, 50)  # Max ±50 lines
```

### 2. **Multi-File Detection**
```python
# Detect when same error appears across multiple files
if stuck_across_files(history):
    strategy = "widen_to_module"  # Include related files
```

### 3. **Semantic Scope Widening**
```python
# Use AST to find semantic boundaries
scope = find_semantic_scope(line, file)
# Returns: "method", "class", "module", "package"
```

### 4. **Historical Learning**
```python
# Remember what scope level worked before
if similar_error_solved_at_scope("class"):
    start_with_scope = "class"  # Skip narrow attempts
```

---

## 🎓 Key Takeaways

1. **Humans naturally widen scope** when stuck - now AI does too
2. **Pattern detection belongs in ReBanker** - immutable truth analysis
3. **3+ failures in ±5 lines** → triggers scope widening recommendation
4. **Integrates with memory feedback** - part of adaptive learning system
5. **Real-world impact** - handles ROP visibility issues, missing imports, class-level bugs

This makes the AI debugging system **think like a human developer** - recognizing when to zoom out and look at the bigger picture.

---

**Status:** ✅ Implemented in `utils/python/envelope_helpers.py`  
**Branch:** `python/dashboard-live-integration`  
**Committed:** October 9, 2025
