# Code Heals Itself — Validation Summary

**System:** `code-heals-itself v0.9 (Python Core + PHP Integration)`
**Model:** `openai/gpt-oss-20b`
**Context window:** ~128k
**Avg input tokens per attempt:** 5000
**Run date:** October 2025

---

## 1. Purpose

To validate autonomous code repair through feedback-aware LLM loops using ReBanker metadata, structured test feedback, and iterative reasoning.

---

## 2. Components Verified

* ✅ **ReBanker Packet Integration** — Line numbers, cluster IDs, and difficulty weights accurately passed to the LLM.
* ✅ **Envelope Metadata Persistence** — Context maintained across retries and memory cycles.
* ✅ **Hot Memory + SQLite Storage** — Working in tandem with garbage collection for optimal state retention.
* ✅ **Confidence Scoring + Softmax Deltas** — Adaptive scoring convergence confirmed.
* ✅ **Multi-Attempt Loop** — Temperature scaling (0.4–1.15) validated.
* ✅ **Automated Fix Verification** — Validation through self-executing unit tests.

---

## 3. Results

| Test                       | Language | Bugs | Attempts | Status      | Notes                                                         |
| -------------------------- | -------- | ---- | -------- | ----------- | ------------------------------------------------------------- |
| `run_php_nightmare_simple` | PHP      | 6    | 1        | ✅ Success   | Fixed semantic cascade (singleton, adapter, import, division) |
| `run_extreme_test`         | Python   | 5    | 1        | ✅ Success   | Resolved nested syntax + logic chain                          |
| Prior `Quantum7B` Run      | —        | —    | 6        | ❌ Timed-Out | Context too small (4k window)                                 |

**Convergence Rate:** 100%
**Avg Attempts:** 1
**Token Efficiency:** 5000 → ~2000 patch delta
**Repair Class:** Semantic / Logical / Mixed-Type
**Confidence Delta:** +0.42 → +0.94

---

## 4. Observations

* ReBanker accurately localized faults via line-level clustering.
* Memory integration preserved loop state over successive runs.
* Increasing token budget (2000 → 5000) prevented truncation errors.
* GPT-OSS-20B handled complete envelopes without context loss.
* Self-healing loop achieved convergence in a single iteration for both test suites.

---

## 5. Next Steps

1. **Benchmark Harness:** Measure tokens vs convergence time.
2. **Envelope Delta Logging:** Enable reproducibility and model fine-tuning.
3. **Cross-Language Validation:** Extend to TypeScript, C#, and SQL parsers.
4. **Publish Technical Whitepaper:** "Envelope-Based Self-Healing Loops for Code Systems."

---

### Summary

This validation confirms that the *Code Heals Itself* architecture can autonomously detect, reason about, and repair multi-layered code defects using LLM-driven iterative refinement. The result: full logical convergence, validated empirically, across both Python and PHP environments — all achieved in a single pass.
