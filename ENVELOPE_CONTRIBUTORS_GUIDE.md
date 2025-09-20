# Envelope Contributors Guide

This guide explains how to safely extend the Patch Envelope without breaking backward compatibility, downstream LLM reasoning, or schema guarantees.

## 1. Purpose of the Envelope
The Patch Envelope is the canonical state container for a healing session attempt sequence. It must:
- Reflect incremental progress (gradient) rather than binary success/failure.
- Preserve forensic traceability (attempt chronology + hash stability).
- Expose structured signals for automated AND human decision points.

## 2. Non-Negotiable Invariants
| Invariant | Description | Rationale |
|----------|-------------|-----------|
| Schema Fidelity | All emitted envelopes validate against `selfhealing.schema.json`. | Avoid consumer breakage. |
| Single Responsibility Helpers | Each field update has a dedicated helper. | Lower risk of side effects. |
| Stable Hash Domain | Hash excludes volatile fields (`attempts`, `timestamp`, `developer_message`, timeline). | Deterministic identity. |
| Additive Evolution | Do not remove existing fields; deprecate via docs first. | Backward compatibility. |
| Monotonic Attempts | `attempts[]` order is append-only. | Replay & audit integrity. |
| Timestamp Once Per Emission | Top-level `timestamp` set just before emission. | Coherent snapshot time. |
| Risk Flag Explicit | Developer escalation uses flag + optional reason code. | Human-in-loop clarity. |

## 3. Field Reference & Sources
| Field | Helper / Source | Updated When | Volatility |
|-------|-----------------|--------------|-----------|
| `confidenceComponents` | `mergeConfidence` | After scoring logits | Low |
| `trendMetadata` | `updateTrend` | After code analysis diff | Low |
| `breakerState` | `setBreakerState` | Each attempt loop | Medium |
| `cascadeDepth` | `setCascadeDepth` | Depth change / attempt | Medium |
| `resourceUsage` | `mergeResourceUsage` | After sandbox exec | Medium |
| `flagged_for_developer` | `applyDeveloperFlag` | Risk detection | Low |
| `attempts[]` | `appendAttempt` | Each attempt finalization | High (excluded from hash) |
| `counters` | `updateCounters` | Each attempt | Derived |
| `timeline[]` | `addTimelineEntry` | Each attempt | High (excluded from hash) |
| `timestamp` | `setEnvelopeTimestamp` | Finalization | High (excluded from hash) |
| `envelopeHash` | `setEnvelopeHash` | Finalization | Stable after emission |
| `policySnapshot` | Inline assignment | Envelope creation | Static |

## 4. Adding a New Field (Playbook)
1. Decide if field is gradient (learning), context, or annotation.
2. Add property to schema (end of `patchEnvelope.properties` block) WITHOUT altering existing ones.
3. Add a helper (or extend an existing one) that updates only that field.
4. Add unit tests: (a) setting, (b) boundary values, (c) hash invariance if excluded.
5. Update docs (`NAVIGATION_GUIDE.md` + this guide table).
6. Ensure emission still validates via Ajv in a local integration test.

## 5. Hash Domain Rules
Excluded fields (current): `attempts`, `timestamp`, `developer_message`, `developerMessage`, `developer_flag_reason`, `timeline`.
Why: They are either volatile per attempt or human-facing narratives.
If you exclude a field—add a comment explaining why. Avoid expanding exclusions unnecessarily (dilutes identity integrity).

## 6. Anti-Patterns (Avoid These)
| Anti-Pattern | Why Bad | Better Approach |
|--------------|---------|-----------------|
| In-line property mutation spread across functions | Hard to audit & test | Centralize in helper |
| Adding logic branches inside helpers for unrelated fields | Increases coupling | Create a new helper |
| Recomputing hash early and overwriting | Causes mismatch & confusion | Only hash at finalization |
| Embedding analysis logic inside envelope helpers | Breaks separation | Keep helpers pure shapers |
| Silent schema drift (field rename) | Breaks consumers & memory | Add new field, deprecate old via docs |

## 7. Testing Expectations
Minimum tests when you add/modify a helper:
- Happy path sets/merges correctly.
- Edge values (clamp 0..1, non-negative, enums).
- Hash remains stable when excluded fields change.
- Snapshot of envelope validates (Ajv test) if feature touches schema.

## 8. Performance Considerations
- Helpers should be O(1) or O(n) only over small arrays (attempts length). Avoid deep cloning.
- Hash canonicalization sorts keys once per finalization; acceptable given emission frequency.
- Avoid recreating large intermediate objects; shallow merges are fine.

## 9. Future-Safe Extensions (Examples)
| Proposed Field | Type | Purpose | Helper Name |
|----------------|------|---------|-------------|
| `overallConfidence` | number (0..1) | Weighted aggregate for scoring | `setOverallConfidence()` |
| `attemptType` | enum | Distinguish syntax vs logic vs mixed | `setAttemptType()` |
| `llm_view` | object | Token-thrifty projection | `buildLLMView()` |
| `reasonCodes[]` | array | Multi-cause escalation trail | `addDeveloperFlagReason()` |

## 10. Decision Flow Hook Points
| Phase | Hook | Typical Consumers |
|-------|------|------------------|
| Pre-Scoring | (future) onPreScore | Feature flags / instrumentation |
| Post-Analysis | updateTrend | Adaptive strategies |
| Pre-Decision | breaker + cascade summaries | Strategy selection |
| Post-Decision | appendAttempt + timeline | Memory / audit / UI streaming |
| Finalization | setEnvelopeTimestamp + setEnvelopeHash | Persistence layer |

## 11. Migration Strategy (If a Field Must Evolve)
1. Introduce new field (e.g. `stagnationRiskV2`).
2. Populate both old & new for at least one release iteration.
3. Mark old in documentation as deprecated.
4. After consumer confirmation, remove old from schema (last step).

## 12. Contribution Checklist (Copy/Paste PR Template)
```
- [ ] Added/updated schema (end of properties block only)
- [ ] Implemented helper (single responsibility)
- [ ] Added/updated unit tests (edge + happy path)
- [ ] Updated NAVIGATION_GUIDE.md & ENVELOPE_CONTRIBUTORS_GUIDE.md tables
- [ ] Verified hash stability (changed only if expected)
- [ ] Ajv validation passes on sample envelope
- [ ] No removal of existing schema properties
```

## 13. FAQ
**Q: Can I centralize multiple small helpers into one to “optimize”?**  
A: Avoid. Micro-helpers improve AI-assisted safety and code review clarity.

**Q: Where should business decisions (pause vs retry) live?**  
A: Outside helpers—in orchestrator logic. Helpers only *shape* state.

**Q: How do I add a new risk reason?**  
A: Extend `applyDeveloperFlag` (or create `addDeveloperFlagReason`) + update docs + tests + optionally schema if formalized.

---
**Maintain the map. Don’t redraw continents mid-journey.**
