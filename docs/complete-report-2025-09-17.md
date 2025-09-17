# Self-Healing Debugger: Grace Window and Trend-Aware Breaker

Date: 2025-09-17
Author: Project Team

## Executive Summary

We identified and fixed a critical fragility in the circuit breaker that previously tripped on the very first failure, starving the delta (gradient) process of a baseline. We introduced a first-two-attempts grace window and tuned trend-aware logic so the system learns before it judges. Test suites now pass and the envelope schema alignment is complete.

## Background

- Problem: Zero-tolerance behavior on attempt 1 produced immediate STOP/ROLLBACK.
- Impact: No meaningful errorDelta; the iteration loop could not learn.
- Goal: Enable a resilient, envelope-guided loop that values trends and context over single-sample failures.

## Changes Implemented

1) First-two-attempts grace
- Attempts 1 and 2 always allowed (syntax and logic). Baseline established by attempt 2.

2) Improvement signal tightened
- "Improvement" requires actual decrease in error count, not just errorsResolved > 0.

3) Early breaker open on stagnation
- If error rate exceeds budget and no improvement, open logic circuit earlier to avoid endless RETRYs.
- Added a conservative failure-streak cutoff (>=5) with no improvement.

4) Envelope schema alignment
- breakerState normalized to OPEN|CLOSED|HALF_OPEN.
- attempts[].breaker includes { state, failure_count } per schema.

5) Cascade headroom
- Increased max cascade depth to 10, allowing the breaker time to form a baseline.

## Affected Files (high level)

- utils/typescript/confidence_scoring.ts: grace logic, trend rules, schema-compatible summary.
- ai-debugging.ts: schema-normalized envelope fields; attempts breaker snapshot.
- utils/typescript/cascading_error_handler.ts: cascade depth increased.
- schemas/selfhealing.schema.json: unchanged but enforced; we aligned code to it.

## Test Results

- tests/ts/iteration-logic.test.ts: PASS (5/5)
  - Validates RETRY → RETRY → RETRY → PROMOTE under improving trend.
  - Verifies breaker can produce ROLLBACK under forced failure scenario.
- tests/ts/trend-aware-breaker.test.ts: PASS (4/4)
  - Demonstrates improving trajectory, stagnation detection, and envelope metadata integration.

## Operational Behavior (after change)

- Early phase: always collect two samples; use them to compute errorDelta and confidence trend.
- Continue while improving or net-positive; pause/backoff on noisy oscillations; rollback when regressing or budgets are exceeded without improvement.
- All interactions are persisted via the Patch Envelope and long-chain memory; schema validated.

## Risks and Mitigations

- Risk: Over-permissiveness early on. Mitigated by limiting grace to first two attempts and adding failure-streak cutoff.
- Risk: Misclassification of improvement. Mitigated by requiring actual error count reduction.

## Next Steps

- Add README slice documenting the envelope lifecycle and breaker states.
- Add tests for schema-normalized breakerState and first-two-attempts grace.
- Explore adaptive backoff policy and resilient memory buffer as incremental improvements.

## Appendix: Key Decisions

- Favor trend-aware continuation in early attempts rather than one-shot correctness.
- Treat cascade and confidence floors as separate from the breaker; map breaker blocks to ROLLBACK, not STOP.
