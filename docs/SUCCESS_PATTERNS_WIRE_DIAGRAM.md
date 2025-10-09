# Success Patterns Integration - Wire Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   AI HEALING LOOP (ai-debugging.py)                     │
└─────────────────────────────────────────────────────────────────────────┘

1️⃣ attemptWithBackoff() starts
   │
   ├── 🧠 Inject: _get_memory_context_for_llm()
   │   └── "Recent 10 attempts: 60% success, trend: improving"
   │
   ├── 📊 Inject: _get_pattern_insights()
   │   └── "Breaker closing, confidence rising, no stuck patterns"
   │
   └── [Enter retry loop attempt 1]
       │
       ├── process_error() → Returns envelope with rebanker_raw
       │   │
       │   └── rebanker_raw = {
       │         "code": "RES.NAME_ERROR",           ← KEY FIELD!
       │         "cluster_id": "RES.NAME_ERROR:requests",
       │         "file": "test.py",
       │         "line": 42,
       │         "message": "name 'requests' is not defined"
       │       }
       │
       ├── 🏆 **NEW** Inject: _get_success_patterns_context()
       │   │
       │   ├── Extract: error_code = cur_raw.get("code")  ✅
       │   ├── Extract: cluster_id = cur_raw.get("cluster_id")  ✅
       │   │
       │   └── Query: storage.get_similar_success_patterns(
       │                 error_code="RES.NAME_ERROR",
       │                 cluster_id="RES.NAME_ERROR:requests",
       │                 limit=5,
       │                 min_confidence=0.7  ✅ NOW SUPPORTED
       │               )
       │       │
       │       └── Returns: [
       │             {
       │               "error_code": "RES.NAME_ERROR",
       │               "cluster_id": "RES.NAME_ERROR:requests",
       │               "fix_description": "Import requests library",
       │               "success_count": 47,  ← Used 47 times!
       │               "avg_confidence": 0.94,
       │               "tags": ["GOLD_STANDARD"]
       │             },
       │             ...4 more patterns
       │           ]
       │
       └── Format & Inject: chat.add_message("system", success_context, 
                                               metadata={"phase": "knowledge"})


┌─────────────────────────────────────────────────────────────────────────┐
│              STORAGE LAYER (envelope_storage.py)                        │
└─────────────────────────────────────────────────────────────────────────┘

2️⃣ save_envelope() called when action="PROMOTE"
   │
   ├── Save to SQLite: envelopes table  ✅
   ├── Save to Memory: InMemoryEnvelopeQueue  ✅
   │
   └── **NEW** Accumulate knowledge:
       │
       ├── Check: action == "PROMOTE" AND confidence >= 0.7?
       │
       ├── Extract: error_code = rebanker_raw.get("code")  ✅
       ├── Extract: cluster_id = rebanker_raw.get("cluster_id")  ✅
       │
       └── save_success_pattern(
             error_code="RES.NAME_ERROR",
             cluster_id="RES.NAME_ERROR:requests",
             fix_description="Import requests library",
             fix_diff="+ import requests",
             confidence=0.94
           )
           │
           └── SQLite: success_patterns table
               │
               ├── EXISTS? → UPDATE success_count++, recalc avg_confidence
               ├── NEW? → INSERT with success_count=1
               │
               └── Auto-tag:
                   ├── confidence >= 0.9 → "GOLD_STANDARD"
                   ├── confidence >= 0.8 → "HIGH_CONFIDENCE"
                   └── confidence >= 0.7 → "VERIFIED"


┌─────────────────────────────────────────────────────────────────────────┐
│                    DATABASE SCHEMA                                      │
└─────────────────────────────────────────────────────────────────────────┘

success_patterns
├── error_code         TEXT NOT NULL  ← From rebanker_raw.code
├── cluster_id         TEXT           ← From rebanker_raw.cluster_id
├── fix_description    TEXT           ← From patch.description
├── fix_diff           TEXT           ← From patch.diff
├── success_count      INTEGER        ← Increments each success
├── avg_confidence     REAL           ← Running average
├── tags               TEXT           ← Comma-separated: GOLD_STANDARD, etc.
├── last_success_at    TEXT           ← ISO timestamp
└── UNIQUE(error_code, cluster_id, fix_description)  ← Prevent duplicates

Indexes:
├── idx_patterns_error_code   ← Fast query by error type
├── idx_patterns_cluster_id   ← Fast query by specific cluster
└── idx_patterns_tags         ← Fast query by quality tag


┌─────────────────────────────────────────────────────────────────────────┐
│                    LLM SEES THIS CONTEXT                                │
└─────────────────────────────────────────────────────────────────────────┘

🏆 SUCCESS PATTERNS KNOWLEDGE BASE

Found 5 proven solutions for RES.NAME_ERROR (cluster: RES.NAME_ERROR:requests)

Total accumulated successes: 472 fixes
Overall confidence: 0.89 (high quality)
Gold standard patterns: 23

Top proven solutions:

1. Pattern: RES.NAME_ERROR:requests
   Success count: 47 times
   Confidence: 0.94
   Tags: GOLD_STANDARD
   Fix: Import requests library
   Last used: 2025-10-08T15:23:45

2. Pattern: RES.NAME_ERROR:requests
   Success count: 38 times
   Confidence: 0.91
   Tags: GOLD_STANDARD
   Fix: Add requests to requirements.txt
   Last used: 2025-10-07T09:12:33

...


┌─────────────────────────────────────────────────────────────────────────┐
│                    LEARNING CURVE PROJECTION                            │
└─────────────────────────────────────────────────────────────────────────┘

Week 1:   12 patterns,   24 successes,  avg confidence: 0.78
Month 1:  89 patterns,  247 successes,  avg confidence: 0.84
Year 1:   1,547 patterns, 8,923 successes, avg confidence: 0.89

System gets smarter over time! 📈


┌─────────────────────────────────────────────────────────────────────────┐
│                    NAMING CONVENTIONS (CRITICAL!)                       │
└─────────────────────────────────────────────────────────────────────────┘

✅ CORRECT:
  error_code = rebanker_raw.get("code")           # "code" field
  cluster_id = rebanker_raw.get("cluster_id")     # Direct access

❌ WRONG (deprecated):
  error_code = rebanker_raw.get("error_code")     # Field doesn't exist!

Method signatures MUST match:
  storage.get_similar_success_patterns(
    error_code=...,      # ✅ Named parameter
    cluster_id=...,      # ✅ Named parameter
    limit=5,             # ✅ Named parameter
    min_confidence=0.7   # ✅ NOW SUPPORTED
  )

SQL parameter order MUST match placeholders:
  WHERE cluster_id = ? AND avg_confidence >= ?
  (cluster_id, min_confidence, limit)  # ✅ Correct order
```

**🎯 Key Integration Points:**

1. **Injection** (ai-debugging.py:777-785): Queries knowledge base on first attempt
2. **Storage** (envelope_storage.py:420-445): Saves patterns on PROMOTE
3. **Query** (envelope_storage.py:670-690): Retrieves similar patterns with confidence filter

**✅ All naming verified and consistent!**

