"""
REBANKER TRUTH-FLOW CONTRACT

WHY: Measure convergence (error delta → 0) across retries with immutable reference points.

INVARIANTS:
* rebanker_raw: immutable diagnostic (file, line, code, message, severity)
* rebanker_hash: sha256(rebanker_raw) - assert each loop
* rebanker_interpreted: LLM summary (MUTABLE)
* Chat includes previous rebanker_raw for LLM short-term memory

RULES:
* hash(rebanker_raw) === rebanker_hash → if false, ABORT
* LLM writes to rebanker_interpreted ONLY
* Circuit breaker uses rebanker_raw (facts, not interpretations)
* Delta-to-zero = measurable convergence

Cross-language parity: Python ↔ TypeScript identical behavior.
"""

# ai-debugging.py
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, Optional, Callable, List
import time
import json
import hashlib
import random
import asyncio
from functools import lru_cache

# --- Local modules (your utilities) ---
from confidence_scoring import (
    UnifiedConfidenceScorer, DualCircuitBreaker, ErrorType, ConfidenceScore
)
from cascading_error_handler import CascadingErrorHandler, SandboxExecution, Environment
from envelope import AIPatchEnvelope, PatchEnvelope, MemoryBuffer
from utils.python.envelope_helpers import (
    append_attempt, mark_success, update_counters, add_timeline_entry,
    set_envelope_timestamp, set_envelope_hash, merge_confidence, update_trend,
    set_breaker_state, set_cascade_depth, merge_resource_usage, apply_developer_flag,
    run_rebanker
)
from strategy import Debugger, LogAndFixStrategy, RollbackStrategy, SecurityAuditStrategy
from human_debugging import SeniorDeveloperSimulator
import jsonschema
import os

# ---------- Helpers ----------
@lru_cache(maxsize=1)
def _load_patch_envelope_schema() -> Dict[str, Any]:
    schema_path = os.path.join(os.path.dirname(__file__), 'schemas/patch-envelope.schema.json')
    try:
        with open(schema_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        raise RuntimeError(f"Could not load PatchEnvelope schema: {e}") from e

def sha256_json(obj: dict) -> str:
    """
    Canonical hash of JSON object for immutability checking.
    Used to prove ReBanker diagnostic packets haven't been tampered with.
    """
    canonical = json.dumps(obj, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(canonical.encode('utf-8')).hexdigest()

def assert_rebanker_immutable(envelope_metadata: dict):
    """
    Enforce immutability invariant: hash(rebanker_raw) must equal stored hash.
    If violated, abort retry chain - ground truth has been tampered with.
    """
    raw = envelope_metadata.get("rebanker_raw")
    stored_hash = envelope_metadata.get("rebanker_hash")
    
    if raw and stored_hash:
        computed = sha256_json(raw)
        if computed != stored_hash:
            raise RuntimeError(
                f"🚨 IMMUTABLE REBANKER INVARIANT VIOLATED 🚨\n"
                f"Expected hash: {stored_hash}\n"
                f"Computed hash: {computed}\n"
                f"Ground truth packet was tampered with! Aborting retry chain."
            )

def error_delta(prev_raw: Optional[dict], cur_raw: Optional[dict]) -> dict:
    """
    Calculate error gradient between attempts.
    Delta-to-zero means convergence (error resolved).
    
    Returns:
        {"kind": "first|same_error|mutated|resolved", ...}
    """
    if not prev_raw:
        return {"kind": "first", "details": "Initial attempt, no previous baseline"}
    
    # Error resolved?
    if not cur_raw or cur_raw.get("status") == "clean":
        return {
            "kind": "resolved",
            "details": "Error eliminated - zero gradient achieved",
            "from_line": prev_raw.get("line"),
            "from_code": prev_raw.get("error_code")
        }
    
    # Same error code?
    if prev_raw.get("error_code") == cur_raw.get("error_code"):
        moved = (
            prev_raw.get("line") != cur_raw.get("line") or
            prev_raw.get("file") != cur_raw.get("file")
        )
        progress_note = f" (moved from line {prev_raw.get('line')})" if moved else " (same location)"
        return {
            "kind": "same_error",
            "moved": moved,
            "details": f"Error persists at line {cur_raw.get('line')}{progress_note}",
            "prev_line": prev_raw.get("line"),
            "cur_line": cur_raw.get("line")
        }
    
    # Error mutated (different error code)
    return {
        "kind": "mutated",
        "from": prev_raw.get("error_code"),
        "to": cur_raw.get("error_code"),
        "details": f"Error changed from {prev_raw.get('error_code')} to {cur_raw.get('error_code')}",
        "prev_line": prev_raw.get("line"),
        "cur_line": cur_raw.get("line")
    }

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

# ---------- Chat Message Adapter (for LLM feedback loop) ----------
class ChatMessageAdapter:
    """
    Short-term memory for LLM feedback loop.
    Mirrors TypeScript ChatMessageHistoryAdapter for cross-language parity.
    
    Stores conversation history and persists to memory buffer for auditing.
    """
    def __init__(self, memory: MemoryBuffer, session_id: Optional[str] = None):
        self.memory = memory
        self.session_id = session_id or f"session-{int(time.time() * 1000)}"
        self.messages: List[Dict[str, Any]] = []
    
    def add_message(self, role: str, content: Any, metadata: Optional[Dict[str, Any]] = None):
        """
        Add message to chat history.
        
        Args:
            role: 'system', 'user', 'tool', or 'ai'
            content: Message content (string or dict)
            metadata: Optional metadata (phase, etc.)
        """
        message = {
            "role": role,
            "content": content,
            "metadata": metadata or {},
            "timestamp": time.time()
        }
        self.messages.append(message)
        
        # Persist to memory buffer for auditing
        self.memory.add_outcome(json.dumps({
            "type": "chat_message",
            "session": self.session_id,
            "message": message
        }))
    
    def get_messages(self) -> List[Dict[str, Any]]:
        """Retrieve full chat history"""
        return self.messages.copy()

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
        envelope_json = json.loads(envelope.to_json())
        try:
            jsonschema.validate(instance=envelope_json, schema=_load_patch_envelope_schema())
        except jsonschema.ValidationError as ve:
            raise RuntimeError(f"PatchEnvelope validation failed: {ve.message}")

        # 2) Human heuristics to pick initial strategy
        human_plan = self.human.debug_like_human(message, {"error": message, "code_snippet": patch_code})
        chosen_strategy = self._map_strategy(human_plan.get("recommended_strategy", "LogAndFixStrategy"))
        self.debugger.set_strategy(chosen_strategy)

        # 3) Confidence scoring (syntax vs logic paths)
        # Extract taxonomy difficulty if available from rebanker enrichment
        taxonomy_difficulty = None
        if metadata and "rebanker_result" in metadata:
            rebanker_result = metadata["rebanker_result"]
            if isinstance(rebanker_result, dict) and "difficulty" in rebanker_result:
                taxonomy_difficulty = rebanker_result["difficulty"]
        
        conf: ConfidenceScore = self.confidence.calculate_confidence(
            logits, error_type, historical, taxonomy_difficulty
        )
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

        # 7b) RE-BANKER: Run on EVERY iteration to capture error variance (34→12→3)
        # This gives us structured error data (file/line/column/message/code/severity)
        # which feeds the delta-gradient circuit breaker and LLM envelope
        with envelope.mutable_payload() as payload:
            import tempfile
            from pathlib import Path
            
            # Save patched code to temp file for re-banking (needed for both paths)
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as tmp:
                tmp.write(patch_code)
                tmp_path = tmp.name
            
            try:
                # Priority 1: Parse runtime error if sandbox execution failed
                runtime_error = sandbox_result.get("error_message")
                
                if runtime_error:
                    # Runtime error detected - parse it through re-banker to extract file/line/column
                    # Python runtime errors have format:
                    #   Traceback (most recent call last):
                    #     File "file.py", line 10, in <module>
                    #   NameError: name 'undefined_var' is not defined
                    
                    # Feed the runtime error blob to re-banker's stdin parser
                    import subprocess
                    rebank_script = Path(__file__).parent / "ops" / "rebank" / "rebank_py.py"
                    
                    if rebank_script.exists():
                        try:
                            result = subprocess.run(
                                ["python", str(rebank_script), "--stdin"],
                                input=runtime_error,
                                capture_output=True,
                                text=True,
                                timeout=5
                            )
                            
                            if result.returncode == 0:
                                # Re-banker successfully parsed error
                                parsed = json.loads(result.stdout)
                                parsed["code"] = "RUNTIME_ERROR"  # Override code to distinguish from syntax
                                parsed["severity"] = "FATAL_RUNTIME"
                                payload.setdefault("metadata", {})["rebanker_result"] = parsed
                            else:
                                # Re-banker couldn't parse - fall back to raw blob
                                payload.setdefault("metadata", {})["rebanker_result"] = {
                                    "file": "unknown",
                                    "line": None,
                                    "column": None,
                                    "message": runtime_error,
                                    "code": "RUNTIME_ERROR_UNPARSED",
                                    "severity": "FATAL_RUNTIME"
                                }
                        except (subprocess.TimeoutExpired, json.JSONDecodeError, Exception) as e:
                            # Error parsing runtime error - use raw
                            payload.setdefault("metadata", {})["rebanker_result"] = {
                                "file": "unknown",
                                "line": None,
                                "column": None,
                                "message": f"Parse error: {e}\n{runtime_error}",
                                "code": "RUNTIME_ERROR_UNPARSED",
                                "severity": "FATAL_RUNTIME"
                            }
                    else:
                        # Re-banker script missing - use raw
                        payload.setdefault("metadata", {})["rebanker_result"] = {
                            "file": "unknown",
                            "line": None,
                            "column": None,
                            "message": runtime_error,
                            "code": "RUNTIME_ERROR_UNPARSED",
                            "severity": "FATAL_RUNTIME"
                        }
                else:
                    # Priority 2: Static syntax check via re-banker
                    run_rebanker(payload, file_path=tmp_path, language="python")
                    # Re-banker result now in payload["metadata"]["rebanker_result"]
                    # Contains: {"file": str, "line": int, "column": int|None, "message": str, "code": str, "severity": str}
                    # OR: {"status": "clean"} if no errors
            finally:
                # Clean up temp file
                Path(tmp_path).unlink(missing_ok=True)
            
            # 🔒 TRUTH-FLOW: Convert to immutable packet with hash
            rebanker_result = payload.get("metadata", {}).get("rebanker_result", {})
            
            # Rename to rebanker_raw (immutable ground truth)
            payload.setdefault("metadata", {})["rebanker_raw"] = rebanker_result
            payload["metadata"]["rebanker_hash"] = sha256_json(rebanker_result)
            payload["metadata"]["rebanker_interpreted"] = None  # LLM can write here
            
            # Remove old field name for clarity
            if "rebanker_result" in payload["metadata"]:
                del payload["metadata"]["rebanker_result"]

        # 8) Strategy follow-up (log/fix/rollback/security audit)
        strategy_outcome = self.debugger.debug({"error": message, "vulnerability": message})

        # 8b) Extract re-banker data for trend analysis (error delta calculation)
        with envelope.mutable_payload() as payload:
            rebanker_raw = payload.get("metadata", {}).get("rebanker_raw", {})
            
            # Determine current error count from re-banker
            # Note: Re-banker returns FIRST error only; full analyzer would give total count
            # For now: if re-banker found error → at least 1; if clean → 0
            current_errors = 0
            if "line" in rebanker_raw and rebanker_raw.get("line") is not None:
                current_errors = 1  # At least one error (could be more, but we have structured info on first)
            elif rebanker_raw.get("status") == "clean":
                current_errors = 0
            
            # Get previous error count from last attempt (if exists)
            previous_errors = payload.get("trendMetadata", {}).get("errorsDetected", 0)
            
            # Calculate error delta (positive = improvement)
            errors_resolved = max(0, previous_errors - current_errors)
            
            # Update trend metadata with delta
            quality_score = 1.0 if current_errors == 0 else (0.5 if errors_resolved > 0 else 0.1)
            improvement_velocity = errors_resolved / max(1, previous_errors) if previous_errors > 0 else 0.0
            
            update_trend(
                payload,
                errors_detected=current_errors,
                errors_resolved=errors_resolved,
                quality_score=quality_score,
                improvement_velocity=improvement_velocity,
                stagnation_risk=0.0 if errors_resolved > 0 else 0.5
            )

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
    
    def _minimal_tweak(self, code: str, error_message: str = "") -> str:
        """
        Conservative code fixes between retry attempts.
        Mirrors TypeScript minimalTweak() for parity.
        
        Applies lightweight heuristics:
        - Fix missing colons in if/for/def/class
        - Balance parentheses/brackets
        - Fix common indentation issues
        """
        import re
        out = code
        msg = error_message.lower()
        
        # Fix missing colons in control structures
        out = re.sub(r'^(\s*(?:if|elif|else|for|while|def|class|with|try|except|finally)\s+[^\n:]+)$', 
                     r'\1:', out, flags=re.MULTILINE)
        
        # Fix missing indentation (add 4 spaces to lines after colon)
        lines = out.split('\n')
        fixed_lines = []
        for i, line in enumerate(lines):
            fixed_lines.append(line)
            if line.rstrip().endswith(':') and i + 1 < len(lines):
                next_line = lines[i + 1]
                if next_line and not next_line.startswith(' '):
                    lines[i + 1] = '    ' + next_line
        
        # Balance parentheses/brackets (simple approach)
        if 'missing' in msg or 'unexpected end' in msg or 'unmatched' in msg:
            pairs = [('(', ')'), ('{', '}'), ('[', ']')]
            for open_char, close_char in pairs:
                open_count = out.count(open_char)
                close_count = out.count(close_char)
                missing = max(0, open_count - close_count)
                if missing > 0:
                    out += close_char * missing
        
        return out
    
    async def attempt_with_backoff(
        self,
        error_type: ErrorType,
        message: str,
        patch_code: str,
        original_code: str,
        logits: List[float],
        opts: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Full retry loop with truth-flow contract.
        Mirrors TypeScript attemptWithBackoff() for cross-language parity.
        
        Implements:
        - Exponential backoff with jitter
        - LLM chat history with previous re-banker feedback
        - Immutability invariant checking
        - Error delta calculation (gradient-to-zero)
        - Circuit breaker integration
        
        Args:
            error_type: Type of error (SYNTAX, LOGIC, etc.)
            message: Error message
            patch_code: Code to heal
            original_code: Original working code
            logits: Confidence logits from LLM
            opts: Optional config (maxAttempts, minMs, maxMs, sessionId, chatAdapter)
        
        Returns:
            Final result dict with action, envelope, and extras
        """
        opts = opts or {}
        max_attempts = max(1, opts.get("maxAttempts", 3))
        min_ms = max(0, opts.get("minMs", 500))
        max_ms = max(min_ms, opts.get("maxMs", 1500))
        
        current_patch = patch_code
        result = None
        prev_raw = None
        
        # Chat adapter for LLM feedback
        chat = opts.get("chatAdapter") or ChatMessageAdapter(self.memory, opts.get("sessionId"))
        
        # System prompt
        DEFAULT_SYSTEM_PROMPT = "You are a code healing assistant. Analyze errors and suggest fixes based on structured diagnostic feedback."
        chat.add_message("system", DEFAULT_SYSTEM_PROMPT, metadata={"phase": "init"})
        
        for attempt in range(1, max_attempts + 1):
            # User message with previous immutable packet
            user_message = {
                "type": "attempt.start",
                "attempt": attempt,
                "error_type": error_type.name,
                "message": message,
                "last_patch": current_patch,
                "language": "python"
            }
            
            # 🎯 TRUTH-FLOW: Include previous immutable ReBanker packet
            if attempt > 1 and prev_raw:
                user_message["rebanker_previous"] = {
                    "file": prev_raw.get("file"),
                    "line": prev_raw.get("line"),
                    "column": prev_raw.get("column"),
                    "error_code": prev_raw.get("code"),
                    "error_message": prev_raw.get("message"),
                    "severity": prev_raw.get("severity"),
                    "hint": f"Previous patch failed at line {prev_raw.get('line')}" +
                           (f", column {prev_raw.get('column')}" if prev_raw.get('column') else "") +
                           f": {prev_raw.get('message')}"
                }
            
            chat.add_message("user", user_message, metadata={"phase": "attempt"})
            
            # Execute attempt
            result = self.process_error(
                error_type,
                message,
                current_patch,
                original_code,
                logits,
                historical={"attempt": attempt},
                metadata={"attempt": attempt}
            )
            
            # Extract immutable packet + assert invariant
            envelope_meta = result["envelope"].get("metadata", {})
            cur_raw = envelope_meta.get("rebanker_raw")
            cur_hash = envelope_meta.get("rebanker_hash")
            
            # 🔒 IMMUTABILITY INVARIANT
            if cur_raw and cur_hash:
                try:
                    assert_rebanker_immutable(envelope_meta)
                except RuntimeError as e:
                    # Invariant violated - abort retry chain
                    chat.add_message("tool", {
                        "type": "immutability_violation",
                        "error": str(e),
                        "attempt": attempt
                    }, metadata={"phase": "error"})
                    raise
            
            # Calculate error delta (gradient-to-zero)
            delta = error_delta(prev_raw, cur_raw)
            result["envelope"]["metadata"]["delta_from_prev"] = delta
            
            # Send envelope to chat
            chat.add_message("tool", {
                "type": "patch_envelope",
                "attempt": attempt,
                "envelope": result["envelope"],
                "action": result["action"],
                "delta": delta
            }, metadata={"phase": "result"})
            
            # Final decision?
            if result["action"] in ["PROMOTE", "ROLLBACK", "HUMAN_REVIEW"]:
                chat.add_message("tool", {
                    "type": "final_decision",
                    "decision": result["action"],
                    "attempt": attempt,
                    "delta": delta
                }, metadata={"phase": "final"})
                return result
            
            # Retry with backoff
            if result["action"] in ["RETRY", "PAUSE_AND_BACKOFF"]:
                # Exponential backoff with jitter
                backoff_ms = min(max_ms, min_ms * (2 ** (attempt - 1)))
                jitter = random.uniform(0.8, 1.2)
                wait_ms = backoff_ms * jitter
                
                chat.add_message("tool", {
                    "type": "backoff",
                    "wait_ms": wait_ms,
                    "attempt": attempt
                }, metadata={"phase": "backoff"})
                
                await asyncio.sleep(wait_ms / 1000.0)
                
                # Minimal tweak (conservative fixes)
                current_patch = self._minimal_tweak(current_patch, message)
                prev_raw = cur_raw  # Save for next iteration
        
        # Max attempts reached
        return result

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
