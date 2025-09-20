# Python Conversion Guide: Envelope & Algorithm Helpers

This guide outlines the process for converting the TypeScript envelope and algorithm helpers into Python, maintaining parity with the existing codebase while adapting to Python idioms.

## 1. Purpose

The envelope and algorithm helpers provide a structured narrative of progress for large language models (LLMs) during the healing process:

- **Gradient Surface**: Error deltas, trend analysis, and velocity metrics
- **Context Gauges**: Circuit breaker state, cascade depth, and resource usage
- **Audit Anchors**: Timestamps and stable hashing for tamper-evidence
- **Escalation Channel**: Developer flags and messages for human-in-the-loop

This enables LLMs to reason about their position in the healing loop, adapt strategies, and avoid blind retry cycles.

## 2. Single-Responsibility Helpers (Schema-Aligned)

| Helper Function | Responsibility | Benefit to Algorithm |
|-----------------|----------------|----------------------|
| `append_attempt` | Add a normalized attempt record (ts, result, breaker snapshot) | Creates lineage for each decision point |
| `merge_confidence` | Merge or clamp confidence components (syntax, logic, risk) | Provides gradient surface, avoids binary thinking |
| `update_trend` | Derive trend metadata (improving, plateauing, worsening) | Enables LLM strategy adaptation, prevents thrashing |
| `set_breaker_state` | Apply circuit breaker snapshot (OPEN, CLOSED, HALF_OPEN) | Prevents runaway retry loops |
| `set_cascade_depth` | Track recursion depth | Stops exponential patch spawning |
| `merge_resource_usage` | Aggregate CPU, memory, time, tokens | Enables quota management and anomaly detection |
| `apply_developer_flag` | Set flagged_for_developer + reason code | Provides human escalation path for risky patches |
| `mark_success` | Latch success once achieved | Simple green light indicator |
| `set_envelope_timestamp` | ISO timestamp for ordering | Forensic timeline anchoring |
| `set_envelope_hash` | Stable hash excluding volatile fields | Tamper-evidence and logical identity |
| `add_timeline_entry` | Record compact snapshot per attempt | Travel story for easy summarization |
| `increment_counters` | Update totals (syntax_attempts, logic_attempts, errors_resolved_total) | O(1) glance for budget tracking |

## 3. Algorithm Travel Narrative

Every loop cycle follows this structured flow:

1. **Confidence Computation** → `merge_confidence()`
2. **Trend Analysis** → `update_trend()`
3. **Breaker Snapshot** → `set_breaker_state()`
4. **Cascade Depth** → `set_cascade_depth()`
5. **Sandbox Usage** → `merge_resource_usage()`
6. **Risk Evaluation** → `apply_developer_flag()`
7. **Outcome Latching** → `mark_success()`
8. **Timeline + Counters** → `add_timeline_entry()`, `increment_counters()`
9. **Final Anchors** → `set_envelope_timestamp()`, `set_envelope_hash()`
10. **Persistence** → Memory buffer & LLM mirror

## 4. Analogy: Google Maps for Debugging

Think of the system as **Google Maps for automated debugging**:

- **Roundabouts** = Retries with minor improvements
- **Roadblocks** = Breaker opening or cascade depth exceeded
- **Green Lights** = Promote to success
- **Yellow Lights** = Pause/backoff
- **Police Officer** = Developer flag redirecting to human review

The LLM isn't just guessing—it's reading road signs at each attempt, making informed navigation decisions.

## 5. Multi-Language Catch-Up Plan

### Branch Strategy
- `feature/python-port` (this branch)
- `feature/php-port`
- `feature/javascript-port`

### Implementation Steps
1. **Start with Core Envelope**: Port the schema, attempt structure, confidence components, breaker state, etc.
2. **Use Auto-Coders**: Leverage Copilot, Codex, or similar to rough out Python syntax
3. **Validate Against Schema**: Ensure all emitted envelopes validate against `selfhealing.schema.json`
4. **Port Tests**: Convert the envelope helper test suite (8 green tests) to Python
5. **Maintain Algorithm Parity**: Keep core logic identical; only adapt language idioms
6. **Integration Testing**: Validate multi-attempt flows produce consistent counters and timeline entries

### Python-Specific Considerations
- Use dataclasses or Pydantic for envelope structures
- Leverage `datetime` for ISO timestamps
- Use `hashlib` for SHA-256 hashing
- Implement clamping with `max(0, min(1, value))`
- Use type hints for schema alignment
- Handle mutable defaults carefully (e.g., lists in function parameters)

### Quality Gates
- All helpers must be pure functions where possible
- Schema validation must pass on sample envelopes
- Hash stability must be maintained across volatile field changes
- Unit tests must cover edge cases (clamping, enums, hash invariance)

## 6. File Structure (Proposed)
```
utils/python/
├── envelope.py          # Core envelope class and helpers
├── confidence.py        # Confidence scoring logic
├── breaker.py           # Circuit breaker implementation
├── cascade.py           # Cascading error handler
├── sandbox.py           # Sandbox execution wrapper
└── __init__.py

tests/python/
├── test_envelope_helpers.py
└── test_integration.py
```

## 7. Migration Checklist (Updated Status)
- [x] Port envelope schema alignment
- [x] Implement all 12 helper functions (Python file: `utils/python/envelope_helpers.py` — added one extra utility `as_envelope_dict`)
- [x] Add type hints and validation patterns (lightweight; jsonschema validation remains in orchestrator)
- [x] Convert unit tests (7 focused helper tests added in `tests/python/test_envelope_helpers.py` covering append, counters, clamping, trend, hash invariance, timeline)
- [x] Validate schema compliance (hash excludes volatile keys; attempts/timestamp changes do not alter hash)
- [x] Test hash stability (unit test `test_timestamp_and_hash_invariance`)
- [x] Document Python-specific idioms (see Section 5 & this checklist commentary)
- [x] Ensure backward compatibility with TypeScript version (non-invasive helper usage; legacy fields preserved)

## 8. Parity Confirmation & Notes

Achieved functional parity with the TypeScript helpers:

| Capability | TypeScript Helper | Python Equivalent | Notes |
|------------|------------------|-------------------|-------|
| Attempts lineage | `appendAttempt` | `append_attempt` | Same fields (`ts`, `success`, optional breaker) |
| Confidence components | `mergeConfidence` | `merge_confidence` | Clamps to [0,1]; risk included |
| Trend metadata | `updateTrend` | `update_trend` | Same heuristics; names adapted to snake_case params |
| Breaker state | `setBreakerState` | `set_breaker_state` | Enum values identical |
| Cascade depth | `setCascadeDepth` | `set_cascade_depth` | Integer floor & clamp |
| Resource usage | `mergeResourceUsage` | `merge_resource_usage` | Shallow merge semantics |
| Developer flag | `applyDeveloperFlag` | `apply_developer_flag` | Adds `developer_flag_reason` same key |
| Success latch | `markSuccess` | `mark_success` | True-once semantics preserved |
| Timestamp | `setEnvelopeTimestamp` | `set_envelope_timestamp` | ISO 8601 with trailing Z |
| Stable hash | `setEnvelopeHash` / `computeStableEnvelopeHash` | `set_envelope_hash` / `compute_stable_envelope_hash` | Excludes same volatile keys |
| Counters | `updateCounters` | `update_counters` | Field names identical |
| Timeline | `addTimelineEntry` | `add_timeline_entry` | Same snapshot fields |

Minor deviations:
1. Python uses UTC via `datetime.utcnow()` (pending future change to timezone-aware). Deprecation warnings noted in tests.
2. Helper tests currently 7 instead of 8 (combined certain assertions). Can split if strict numeric parity required.
3. Added `as_envelope_dict` for potential future ergonomics.

## 9. Future Enhancements
- Add `overall_confidence` weighted aggregate
- Implement `attempt_type` classification (syntax/logic/mixed)
- Create `llm_view` projection for token efficiency
- Formalize `developer_flag_reason` enum
- Add rolling window smoothing for velocity metrics

This conversion maintains the core principle: **give LLMs a map, not just coordinates**, enabling smarter, more adaptive debugging across languages. The Python port is now parity-ready for multi-language orchestration.