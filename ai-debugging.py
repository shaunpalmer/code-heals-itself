# ai-debugging.py
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, Optional, Callable, List
import time
import json

# --- Local modules (your utilities) ---
from confidence_scoring import (
    UnifiedConfidenceScorer, DualCircuitBreaker, ErrorType, ConfidenceScore
)
from cascading_error_handler import CascadingErrorHandler, SandboxExecution, Environment
from envelope import AIPatchEnvelope, PatchEnvelope, MemoryBuffer
from utils.python.envelope_helpers import (
    append_attempt, mark_success, update_counters, add_timeline_entry,
    set_envelope_timestamp, set_envelope_hash, merge_confidence, update_trend,
    set_breaker_state, set_cascade_depth, merge_resource_usage, apply_developer_flag
)
from strategy import Debugger, LogAndFixStrategy, RollbackStrategy, SecurityAuditStrategy
from human_debugging import SeniorDeveloperSimulator
import jsonschema
import os

# ---------- Configuration / policy ----------
@dataclass
class HealerPolicy:
    # thresholds (syntax strict, logic looser)
    syntax_conf_floor: float = 0.98
    logic_conf_floor: float = 0.80
    max_syntax_attempts: int = 3
    max_logic_attempts: int = 10
    syntax_error_budget: float = 0.03     # 3%
    logic_error_budget: float = 0.10      # 10%
    rate_limit_per_min: int = 10          # FR-SEC-003
    sandbox_isolation: str = "full"       # FR-SEC-001
    require_human_on_risky: bool = True   # FR-SEC-005
    risky_keywords: List[str] = (
        "database_schema_change authentication_bypass production_data_modification".split()
    )

# ---------- Main Orchestrator ----------
class AIDebugger:
    """
    Tie everything together:
    - Wrap every patch in an envelope
    - Score confidence (syntax vs logic)
    - Enforce dual circuit breaker & cascade stop
    - Execute in sandbox with resource limits
    - Choose & execute strategy, record outcomes
    - Produce auditable JSON for learning/ops
    """

    def __init__(self, policy: Optional[HealerPolicy] = None):
        self.policy = policy or HealerPolicy()
        self.enveloper = AIPatchEnvelope()
        self.memory = MemoryBuffer(max_size=500)
        self.confidence = UnifiedConfidenceScorer(temperature=1.0, calibration_samples=1000)
        self.breaker = DualCircuitBreaker(
            syntax_max_attempts=self.policy.max_syntax_attempts,
            logic_max_attempts=self.policy.max_logic_attempts,
            syntax_error_budget=self.policy.syntax_error_budget,
            logic_error_budget=self.policy.logic_error_budget,
        )
        self.cascade = CascadingErrorHandler()
        self.sandbox = SandboxExecution(Environment.SANDBOX, self.policy.sandbox_isolation)
        self.human = SeniorDeveloperSimulator()
        self.debugger = Debugger(LogAndFixStrategy())
        self._tokens: List[float] = []  # simple rate limiter timestamps (per minute)

    # ---------- Public API ----------
    def process_error(
        self,
        error_type: ErrorType,
        message: str,
        patch_code: str,
        original_code: str,
        logits: List[float],
        historical: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Core loop for a single incident step.
        Returns a decision dict with envelope JSON and next action.
        """

        self._enforce_rate_limit()

        # 1) Wrap candidate patch
        patch = {
            "message": message,
            "patched_code": patch_code,
            "original_code": original_code,
            "language": "python",
        }
        envelope = self.enveloper.wrap_patch(patch)
        if metadata:
            envelope.merge_metadata(metadata)
              # if you merge the entire envelope you won't have a Error delta
        # --- SCHEMA VALIDATION ---
        schema_path = os.path.join(os.path.dirname(__file__), 'schemas/patch-envelope.schema.json')
        try:
            with open(schema_path, 'r', encoding='utf-8') as f:
                schema = json.load(f)
        except Exception as e:
            raise RuntimeError(f"Could not load PatchEnvelope schema: {e}")

        envelope_json = json.loads(envelope.to_json())
        try:
            jsonschema.validate(instance=envelope_json, schema=schema)
        except jsonschema.ValidationError as ve:
            raise RuntimeError(f"PatchEnvelope validation failed: {ve.message}")

        # 2) Human heuristics to pick initial strategy
        human_plan = self.human.debug_like_human(message, {"error": message, "code_snippet": patch_code})
        chosen_strategy = self._map_strategy(human_plan.get("recommended_strategy", "LogAndFixStrategy"))
        self.debugger.set_strategy(chosen_strategy)

        # 3) Confidence scoring (syntax vs logic paths)
        conf: ConfidenceScore = self.confidence.calculate_confidence(logits, error_type, historical)
        conf_floor = self._conf_floor(error_type)

        # 4) Circuit breaker & cascade gates
        can_attempt, cb_reason = self.breaker.can_attempt(error_type)
        stop_cascade, cascade_reason = self.cascade.should_stop_attempting()

        decision = {
            "can_attempt": can_attempt,
            "cb_reason": cb_reason,
            "stop_cascade": stop_cascade,
            "cascade_reason": cascade_reason,
            "confidence": {
                "overall": conf.overall_confidence,
                "syntax": conf.syntax_confidence,
                "logic": conf.logic_confidence,
            },
            "policy_floor": conf_floor,
        }

        # 5) Risk gating (schema/risky ops) – conservative per PRD
        if self._is_risky_patch(patch) and self.policy.require_human_on_risky:
            self._record_attempt(envelope, success=False, note="Risk gate → human review")
            envelope.flag_for_developer(
                message="Risky patch (policy). Human approval required."
            )
            return self._finalize(envelope, "HUMAN_REVIEW", decision)

        # 6) Decide to proceed
        if not can_attempt or stop_cascade or (self._conf_for_type(conf, error_type) < conf_floor):
            self._record_attempt(envelope, success=False, note="Gate blocked")
            return self._finalize(envelope, "STOP", decision)

        # 7) Execute in sandbox with resource limits
        sandbox_result = self.sandbox.execute_patch({
            "patch_id": envelope.patch_id,
            "language": "python",
            "patched_code": patch_code,
            "original_code": original_code,
            "diff": "<omitted>",
        })
        success = bool(sandbox_result.get("success"))

        # 8) Strategy follow-up (log/fix/rollback/security audit)
        strategy_outcome = self.debugger.debug({"error": message, "vulnerability": message})

        # 9) Update state: breaker / calibration / cascade / memory / envelope
        self.breaker.record_attempt(error_type, success)
        self.confidence.record_outcome(conf.overall_confidence, success)
        if not success:
            self.cascade.add_error_to_chain(error_type, message, conf.overall_confidence, attempt=1)
        self._record_attempt(envelope, success=success, note=strategy_outcome.get("details"))
        self.memory.add_outcome(envelope.to_json())

        # 10) Decide next step
        if success:
            return self._finalize(envelope, "PROMOTE", {**decision, "sandbox": sandbox_result, "strategy": strategy_outcome})
        elif self.breaker.can_attempt(error_type)[0]:
            return self._finalize(envelope, "RETRY", {**decision, "sandbox": sandbox_result, "strategy": strategy_outcome})
        else:
            return self._finalize(envelope, "ROLLBACK", {**decision, "sandbox": sandbox_result, "strategy": strategy_outcome})

    # ---------- Internals ----------
    def _conf_floor(self, et: ErrorType) -> float:
        return self.policy.syntax_conf_floor if et == ErrorType.SYNTAX else self.policy.logic_conf_floor

    def _conf_for_type(self, c: ConfidenceScore, et: ErrorType) -> float:
        return c.syntax_confidence if et == ErrorType.SYNTAX else c.logic_confidence

    def _map_strategy(self, name: str):
        return {
            "RollbackStrategy": RollbackStrategy(),
            "SecurityAuditStrategy": SecurityAuditStrategy(),
            "LogAndFixStrategy": LogAndFixStrategy(),
        }.get(name, LogAndFixStrategy())

    def _record_attempt(self, env: PatchEnvelope, success: bool, note: str = ""):
        bsum = self.breaker.get_state_summary()
        kind = "syntax" if "syntax" in note.lower() else ("logic" if "logic" in note.lower() else "other")

        with env.mutable_payload() as payload:
            append_attempt(
                payload,
                success=success,
                note=note,
                breaker_state=bsum.get("state", "CLOSED"),
                failure_count=bsum.get("failure_count"),
            )
            mark_success(payload, success)
            update_counters(payload, kind=kind, errors_resolved=0)
            attempt_no = payload.get("counters", {}).get(
                "totalAttempts", len(payload.get("attempts", []))
            )
            add_timeline_entry(
                payload,
                attempt=attempt_no,
                breaker_state=bsum.get("state"),
                action="promote" if success else "continue",
            )
            # Refresh timestamp & hash late (not stable across attempts; hash excludes
            # attempts/timestamp internally)
            set_envelope_timestamp(payload)
            set_envelope_hash(payload)

    def _finalize(self, env: PatchEnvelope, action: str, extras: Dict[str, Any]) -> Dict[str, Any]:
        payload = {
            "action": action,
            "envelope": json.loads(env.to_json()),
            "extras": extras,
        }
        # optional place to emit metrics/traces per PRD FR-OBS (omitted here)
        return payload

    def _is_risky_patch(self, patch: Dict[str, Any]) -> bool:
        blob = json.dumps(patch).lower()
        return any(k in blob for k in self.policy.risky_keywords)

    def _enforce_rate_limit(self):
        now = time.time()
        # drop tokens older than 60s
        self._tokens = [t for t in self._tokens if now - t < 60]
        if len(self._tokens) >= self.policy.rate_limit_per_min:
            raise RuntimeError("Rate limit exceeded for patch attempts")
        self._tokens.append(now)

# ----------- Example usage (optional manual test) -----------
if __name__ == "__main__":
    dbg = AIDebugger()
    out = dbg.process_error(
        error_type=ErrorType.SYNTAX,
        message="SyntaxError: invalid syntax",
        patch_code="def x(: pass",
        original_code="def x(): pass",
        logits=[2.3, 0.2, 0.1],
        historical={"success_rate": 0.9, "pattern_similarity": 0.8, "test_coverage": 0.7},
        metadata={"service": "example", "env": "sandbox"},
    )
    print(json.dumps(out, indent=2))
