# Integration & Polish Improvements Backlog

## 1. Runtime Ergonomics
- **Toggleable Observer Dashboard**: Ship a lightweight web panel (React/Vite) that subscribes to envelope timelines, circuit breaker snapshots, and cascade analyses. Use the existing observer interfaces to stream updates over WebSocket or SSE.
- **Singleton Schema Cache**: Introduce a shared schema registry (Python + TypeScript) so every validator pulls from an in-memory singleton instead of re-parsing JSON files each attempt.
- **Breaker Telemetry Feed**: Emit breaker state transitions to a singleton event bus and surface them in logs + dashboard. Adds clarity when RETRY vs ROLLBACK decisions are made.

## 2. Platform Interoperability
- **Neutral Memory Adapter Layer**: Wrap `MemoryBuffer` behind an adapter registry that can point to Redis, DynamoDB, or SQLite. Keeps envelopes portable across deployment targets.
- **gRPC / HTTP Bridge**: Provide a thin FastAPI/Express gateway exposing `process_error` and `breaker` status so non-JS/Python stacks can call the healer service directly.
- **Configurable Policy Presets via CLI**: A shared `cli/policy` tool that can export/import `HealerPolicy` presets for different environments (dev/staging/prod) across languages.

## 3. Observability & Telemetry
- **Structured Logging**: Standardize log events (JSON + trace IDs) for sandbox executions, confidence computations, and breaker decisions. Enable easy ingestion into ELK/Grafana.
- **Trend-aware Metrics**: Push trend metadata (`improvementVelocity`, `stagnationRisk`) into Prometheus counters to track healing efficacy over time.
- **Audit Trails**: Persist envelope hashes + decisions into append-only storage to satisfy compliance and rollback audits.

## 4. Developer Experience
- **VS Code Extension**: Surface envelope diff previews and breaker states inside the editor via existing extension hooks documented in `EXTENSIONS.md`.
- **Helper Function Autogen Docs**: Generate docs (Sphinx & TypeDoc) for helper utilities so maintainers immediately know how to use `append_attempt`, `apply_developer_flag`, etc.
- **Scenario Playbooks**: Bundle example datasets + runbooks showing how to wire the system into CI/CD, including risk gating walkthroughs.

## 5. Safety & Guardrails
- **Rate-limit Visualization**: Expose rate limiter token bucket status to operators; adds transparency when multiple tenants call the service.
- **Out-of-band Human Approval Queue**: Integrate with Slack/Jira/ServiceNow so `flag_for_developer` automatically opens review tasks.
- **Continuous Schema Validation**: Add a background task that validates stored envelopes against the latest schema, catching drift early.

## 6. Testing & Resilience
- **Deterministic Sandbox Fixtures**: Provide fixture packs that replay synthetic sandbox runs with controlled outcomes, ensuring regression tests stay deterministic.
- **Cross-language Parity Tests**: Share envelope fixtures between Python + TypeScript to guarantee serialization symmetry.
- **Chaos Harness**: Periodically simulate failure modes (schema load failure, breaker stuck open) to verify the system keeps operating gracefully.

---
*Curated for day-one polish and cross-platform adoption—prioritize dashboard/telemetry work first, then the platform bridges and guardrails.*
