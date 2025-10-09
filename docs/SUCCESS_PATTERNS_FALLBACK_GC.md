# Success Patterns - Intelligent Fallback & Garbage Collection

## Problem Statement

**Pattern Database Bloat:** After a year, you might have 1,547 patterns total, but only ~12% are relevant for any given query. This leads to:
1. **Wasted storage** on one-off flukes
2. **Query performance degradation** scanning thousands of irrelevant patterns
3. **Over-reliance on knowledge base** instead of letting LLM reason through novel problems

## Solution: Three-Tier Strategy

### 1. Intelligent Fallback Cascade 🎯

**Don't just fail when no exact match exists - progressively broaden the search:**

```
Level 1: Cluster-Specific (Most Precise)
  Query: cluster_id = "RES.NAME_ERROR:requests"
  Example: "requests module not found"
  ↓ < 5 results?

Level 2: Error Code (Broader)
  Query: error_code = "RES.NAME_ERROR"
  Example: All NameError patterns (numpy, pandas, requests, etc.)
  ↓ < 5 results?

Level 3: Error Family (Broadest)
  Query: error_code LIKE "RES.%"
  Example: All resource errors (imports, files, network, etc.)
  ↓ Still empty?

Level 4: LLM Base Knowledge + Scope Widening
  No patterns found → Let LLM reason through the problem
  Trigger: detect_stuck_pattern() → Recommend scope widening
```

### Implementation

**File:** `envelope_storage.py:648-755`

```python
def get_similar_success_patterns(
    error_code: Optional[str] = None,
    cluster_id: Optional[str] = None,
    limit: int = 5,
    min_confidence: float = 0.0
) -> List[Dict[str, Any]]:
    patterns = []
    fallback_level = "none"
    
    # Level 1: Try cluster_id (most specific)
    if cluster_id:
        patterns = query_where("cluster_id = ?", cluster_id)
        if patterns:
            fallback_level = "cluster"
    
    # Level 2: Fall back to error_code
    if len(patterns) < limit and error_code:
        patterns += query_where("error_code = ?", error_code)
        fallback_level = "error_code"
    
    # Level 3: Fall back to error family
    if len(patterns) < limit and "." in error_code:
        family = error_code.split(".")[0]  # "RES" from "RES.NAME_ERROR"
        patterns += query_where("error_code LIKE ?", f"{family}.%")
        fallback_level = "family"
    
    # Add metadata so LLM knows confidence level
    for pattern in patterns:
        pattern["fallback_level"] = fallback_level
    
    return patterns
```

### LLM Context Warnings

**File:** `ai-debugging.py:283-290`

When fallback occurs, warn LLM to not over-rely on patterns:

```
⚠️  NOTICE: Using broader pattern matches (no exact cluster match)
   → Consider: Scope widening if patterns don't apply directly

⚠️  NOTICE: Using error family patterns (very broad)
   → RECOMMENDED: Let LLM analyze context + widen scope as needed
```

This tells the LLM: "These patterns might not be exact - use your reasoning!"

---

## 2. Garbage Collection Strategy 🗑️

**Remove patterns that don't earn their keep:**

### Conservative (Default)
```sql
DELETE FROM success_patterns
WHERE success_count = 1 
  AND datetime(last_success_at) < datetime('now', '-90 days')
```

**Rationale:** One-off flukes that haven't been reused in 90 days → DELETE

### Aggressive
```sql
DELETE FROM success_patterns
WHERE success_count < 3 
  AND datetime(last_success_at) < datetime('now', '-60 days')
```

**Rationale:** Low-usage patterns (< 3 successes) older than 60 days → DELETE

### Nuclear (Emergency)
```sql
DELETE FROM success_patterns
WHERE success_count < 5
```

**Rationale:** Keep ONLY proven winners with ≥ 5 successful applications

### Implementation

**File:** `envelope_storage.py:560-610`

```python
def garbage_collect_patterns(strategy: str = "conservative") -> Dict[str, int]:
    """
    Clean up low-value success patterns to prevent database bloat.
    
    Returns:
        {
            "deleted_count": 47,
            "remaining_count": 89,
            "strategy": "conservative"
        }
    """
```

### When to Run Garbage Collection

1. **Scheduled:** Weekly cron job
2. **Threshold-based:** When `total_patterns > 1000`
3. **Manual:** Dashboard button for admins

---

## 3. ReBanker Taxonomy Families (Language Agnostic)

The taxonomy already has **12 error families** that work across languages:

### Core Families:
- **RES** - Resource errors (imports, files, network)
- **TYP** - Type errors (type mismatches, coercion)
- **LOG** - Logic errors (runtime logic bugs)
- **SYN** - Syntax errors (parsing failures)
- **SEC** - Security errors (permissions, auth)
- **PER** - Performance errors (timeouts, memory)
- **DAT** - Data errors (validation, format)
- **NET** - Network errors (HTTP, sockets)
- **DB** - Database errors (queries, connections)
- **API** - API errors (endpoints, contracts)
- **ENV** - Environment errors (config, vars)
- **DEP** - Dependency errors (versions, conflicts)

### Example: RES Family

```
RES.NAME_ERROR         → Specific error type
RES.NAME_ERROR:requests → Cluster (most specific)

Query progression:
1. "RES.NAME_ERROR:requests" → 2 results
2. "RES.NAME_ERROR"          → +8 results (10 total)
3. "RES.*"                   → +15 results (25 total)
```

This leverages the **taxonomy's built-in hierarchy** for intelligent fallback!

---

## Decision Tree

```
Error Occurs
  ↓
Query Success Patterns
  ↓
Found exact cluster match (cluster_id)?
  YES → Use it! (High confidence)
  NO  ↓
  
Found error_code matches?
  YES → Use broader patterns (Medium confidence)
        + Warn LLM: "Consider scope widening"
  NO  ↓
  
Found family matches (RES.*)?
  YES → Use very broad patterns (Low confidence)
        + Warn LLM: "Let reasoning guide you"
  NO  ↓
  
No patterns found
  → Return empty []
  → LLM uses base knowledge
  → Trigger scope widening if stuck
```

---

## Performance Impact

### Before (No Fallback):
```
Error: RES.NAME_ERROR:newlib
Query: cluster_id = "RES.NAME_ERROR:newlib"
Result: 0 patterns
→ LLM has zero historical context
```

### After (With Fallback):
```
Error: RES.NAME_ERROR:newlib
Query 1: cluster_id = "RES.NAME_ERROR:newlib" → 0 results
Query 2: error_code = "RES.NAME_ERROR"       → 8 results
Query 3: error_code LIKE "RES.%"             → +15 results

→ LLM sees 23 similar patterns:
   - "Import numpy" (47 times)
   - "Import pandas" (38 times)
   - "Add to requirements.txt" (12 times)
   
→ LLM learns: "This is an import issue, check module installation"
```

### Database Size Over Time

**Without GC:**
```
Year 1: 1,547 patterns (892 one-offs)
Year 2: 3,204 patterns (1,889 one-offs)
Year 3: 5,012 patterns (3,104 one-offs)
```

**With GC (Conservative):**
```
Year 1: 1,547 patterns → GC → 655 patterns (89% one-offs removed)
Year 2: 1,203 patterns → GC → 789 patterns
Year 3: 1,456 patterns → GC → 934 patterns

Stable around ~1,000 high-quality patterns!
```

---

## Usage Examples

### Query with Fallback

```python
patterns = storage.get_similar_success_patterns(
    error_code="RES.NAME_ERROR",
    cluster_id="RES.NAME_ERROR:requests",
    min_confidence=0.7
)

if patterns:
    fallback = patterns[0]["fallback_level"]
    
    if fallback == "cluster":
        # Exact match - high confidence
        print("Found exact solution!")
    
    elif fallback == "error_code":
        # Broader match - consider alternatives
        print("Found similar patterns, but not exact")
    
    elif fallback == "family":
        # Very broad - use with caution
        print("Found related errors, use LLM reasoning")
```

### Run Garbage Collection

```python
# Conservative (weekly)
result = storage.garbage_collect_patterns("conservative")
print(f"Deleted {result['deleted_count']} stale patterns")
print(f"Kept {result['remaining_count']} proven winners")

# Aggressive (monthly)
result = storage.garbage_collect_patterns("aggressive")

# Nuclear (emergency - database too big)
result = storage.garbage_collect_patterns("nuclear")
```

---

## Key Insight

**Success patterns are an ASSIST, not a CRUTCH.**

The knowledge base should:
- ✅ Accelerate common fixes (imports, typos, etc.)
- ✅ Provide context for novel problems
- ✅ Learn from successes over time

But should NOT:
- ❌ Replace LLM reasoning
- ❌ Grow indefinitely with one-off flukes
- ❌ Force exact matches when broader patterns apply

**When patterns fail → Fall back to LLM base knowledge + scope widening.**

That's the real power: **Compound learning without over-reliance.**

---

## Files Modified

- ✅ `envelope_storage.py` - Added 3-level fallback + garbage collection
- ✅ `ai-debugging.py` - Added fallback warnings to LLM context
- ✅ `docs/SUCCESS_PATTERNS_FALLBACK_GC.md` - This document

## Status: READY FOR TESTING ✅
