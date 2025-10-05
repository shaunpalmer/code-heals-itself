"""Envelope helper functions (Python parity with TypeScript version).
Each helper is single-responsibility and schema-aligned.
They annotate / mutate PatchEnvelope instances or plain dict envelopes without
breaking existing logic.
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional, Callable, TypedDict, Literal
from dataclasses import asdict
from datetime import datetime
import copy
import hashlib

BreakerState = Literal["OPEN", "CLOSED", "HALF_OPEN"]

# Attempt record shape (schema-aligned)
class AttemptRecord(TypedDict, total=False):
    ts: int
    success: bool
    note: str
    breaker: Dict[str, Any]

ConfidenceComponents = Dict[str, float]
TrendMetadata = Dict[str, Any]
ResourceUsageSnapshot = Dict[str, Any]

ISO8601 = str

def _now_iso() -> ISO8601:
    return datetime.utcnow().isoformat() + "Z"

def _now_epoch_sec() -> int:
    return int(datetime.utcnow().timestamp())

def _clamp01(x: Optional[float]) -> Optional[float]:
    if x is None:
        return None
    try:
        if x != x:  # NaN
            return None
        return max(0.0, min(1.0, float(x)))
    except Exception:
        return None

# Accept either dataclass PatchEnvelope or dict-like.

def _ensure_attempts(env: Dict[str, Any]) -> List[AttemptRecord]:
    if "attempts" not in env or not isinstance(env["attempts"], list):
        env["attempts"] = []
    return env["attempts"]  # type: ignore

# 1) append_attempt

def append_attempt(env: Dict[str, Any], *, success: bool, note: str = "", breaker_state: Optional[BreakerState] = None, failure_count: Optional[int] = None, ts: Optional[int] = None) -> Dict[str, Any]:
    attempts = _ensure_attempts(env)
    rec: AttemptRecord = {"ts": ts or _now_epoch_sec(), "success": bool(success)}
    if note:
        rec["note"] = note
    if breaker_state:
        b: Dict[str, Any] = {"state": breaker_state}
        if isinstance(failure_count, int):
            b["failure_count"] = failure_count
        rec["breaker"] = b
    attempts.append(rec)
    return env

# 2) merge_confidence

def merge_confidence(env: Dict[str, Any], *, syntax: Optional[float] = None, logic: Optional[float] = None, risk: Optional[float] = None) -> Dict[str, Any]:
    comp: Dict[str, Any] = env.get("confidenceComponents", {}) or {}
    if syntax is not None:
        comp["syntax"] = _clamp01(syntax)
    if logic is not None:
        comp["logic"] = _clamp01(logic)
    if risk is not None:
        comp["risk"] = _clamp01(risk)
    env["confidenceComponents"] = comp
    return env

# 3) update_trend

def update_trend(env: Dict[str, Any], *, errors_detected: int, errors_resolved: int, quality_score: Optional[float] = None, improvement_velocity: Optional[float] = None, stagnation_risk: Optional[float] = None) -> Dict[str, Any]:
    ed = max(0, int(errors_detected))
    er = max(0, int(errors_resolved))
    trend = "unknown"
    if er > 0:
        trend = "improving"
    elif improvement_velocity is not None:
        trend = "worsening" if improvement_velocity < 0 else "plateauing"
    env["trendMetadata"] = {
        "errorsDetected": ed,
        "errorsResolved": er,
        "errorTrend": trend,
        "codeQualityScore": _clamp01(quality_score) if quality_score is not None else None,
        "improvementVelocity": _clamp01(improvement_velocity) if improvement_velocity is not None else None,
        "stagnationRisk": _clamp01(stagnation_risk) if stagnation_risk is not None else None,
    }
    return env

# 4) set_breaker_state

def set_breaker_state(env: Dict[str, Any], state: BreakerState) -> Dict[str, Any]:
    if state in ("OPEN", "CLOSED", "HALF_OPEN"):
        env["breakerState"] = state
    return env

# 5) set_cascade_depth

def set_cascade_depth(env: Dict[str, Any], depth: int) -> Dict[str, Any]:
    try:
        d = int(depth)
    except Exception:
        d = 0
    env["cascadeDepth"] = max(0, d)
    return env

# 6) merge_resource_usage

def merge_resource_usage(env: Dict[str, Any], usage: Optional[ResourceUsageSnapshot]) -> Dict[str, Any]:
    if usage is None:
        return env
    base = env.get("resourceUsage") or {}
    base.update(usage)
    env["resourceUsage"] = base
    return env

# 7) apply_developer_flag

def apply_developer_flag(env: Dict[str, Any], *, flagged: bool, message: Optional[str] = None, reason_code: Optional[str] = None) -> Dict[str, Any]:
    env["flagged_for_developer"] = bool(flagged)
    if flagged and message:
        env["developer_message"] = message
    if flagged and reason_code:
        env["developer_flag_reason"] = reason_code
    return env

# 8) mark_success (latching)

def mark_success(env: Dict[str, Any], success: bool) -> Dict[str, Any]:
    if env.get("success") is True:
        return env
    env["success"] = bool(success)
    return env

# 9) set_envelope_timestamp

def set_envelope_timestamp(env: Dict[str, Any], iso: Optional[str] = None) -> Dict[str, Any]:
    env["timestamp"] = iso or _now_iso()
    return env

# 10) compute_stable_envelope_hash
VOLATILE_KEYS = {"attempts", "timestamp", "envelopeHash", "developer_message", "developerMessage", "developer_flag_reason", "timeline"}

def compute_stable_envelope_hash(env: Dict[str, Any], *, sha256_hex: Callable[[bytes], str] | None = None) -> str:
    if sha256_hex is None:
        sha256_hex = lambda b: hashlib.sha256(b).hexdigest()
    # Exclude volatile keys
    base = {k: v for k, v in env.items() if k not in VOLATILE_KEYS}
    # Deterministic ordering
    canonical = json_dumps_stable(base)
    return sha256_hex(canonical.encode("utf-8"))

# 11) set_envelope_hash

def set_envelope_hash(env: Dict[str, Any]) -> Dict[str, Any]:
    env["envelopeHash"] = compute_stable_envelope_hash(env)
    return env

# 12) update_counters

def update_counters(env: Dict[str, Any], kind: str, errors_resolved: int) -> Dict[str, Any]:
    counters = env.get("counters") or {}
    counters["totalAttempts"] = counters.get("totalAttempts", 0) + 1
    if kind == "syntax":
        counters["syntaxAttempts"] = counters.get("syntaxAttempts", 0) + 1
    if kind == "logic":
        counters["logicAttempts"] = counters.get("logicAttempts", 0) + 1
    counters["errorsResolvedTotal"] = counters.get("errorsResolvedTotal", 0) + max(0, int(errors_resolved))
    env["counters"] = counters
    return env

# 13) add_timeline_entry

def add_timeline_entry(env: Dict[str, Any], *, attempt: int, errors_detected: Optional[int] = None, errors_resolved: Optional[int] = None, overall_confidence: Optional[float] = None, breaker_state: Optional[str] = None, action: Optional[str] = None) -> Dict[str, Any]:
    if "timeline" not in env or not isinstance(env["timeline"], list):
        env["timeline"] = []
    env["timeline"].append({
        "attempt": attempt,
        "ts": _now_iso(),
        "errorsDetected": errors_detected,
        "errorsResolved": errors_resolved,
        "overallConfidence": overall_confidence,
        "breakerState": breaker_state,
        "action": action
    })
    return env

# 14) run_rebanker (captures variance on every iteration)

def run_rebanker(env: Dict[str, Any], *, file_path: str, language: str = "python") -> Dict[str, Any]:
    """
    Run the appropriate re-banker script on the current file to extract structured error data.
    This should be called on EVERY iteration to capture the error delta (34→12→3).
    
    Args:
        env: The patch envelope dict
        file_path: Path to the file to check (e.g., patch_data.patched_code saved to disk)
        language: One of "python", "javascript", "typescript", "php"
    
    Returns:
        Updated envelope with rebanker_result in metadata
    
    Side effects:
        - Runs ops/rebank/rebank_<lang>.py subprocess
        - Attaches structured error object to env["metadata"]["rebanker_result"]
        - On clean: {"status": "clean"}
        - On error: {"file": str, "line": int, "column": int|None, "message": str, "code": str, "severity": str}
    """
    import subprocess
    import sys
    from pathlib import Path
    
    # Map language to rebanker script
    script_map = {
        "python": "rebank_py.py",
        "javascript": "rebank_js_ts.mjs",
        "typescript": "rebank_js_ts.mjs",
        "php": "rebank_php.php"
    }
    
    script_name = script_map.get(language.lower())
    if not script_name:
        # Unknown language, skip re-banking
        if "metadata" not in env:
            env["metadata"] = {}
        env["metadata"]["rebanker_result"] = {
            "status": "unsupported_language",
            "language": language
        }
        return env
    
    # Construct path to rebanker script
    repo_root = Path(__file__).parent.parent.parent  # utils/python/ -> repo root
    script_path = repo_root / "ops" / "rebank" / script_name
    
    if not script_path.exists():
        # Rebanker not installed yet
        if "metadata" not in env:
            env["metadata"] = {}
        env["metadata"]["rebanker_result"] = {
            "status": "rebanker_not_found",
            "script": str(script_path)
        }
        return env
    
    # Run rebanker
    try:
        if language.lower() == "python":
            cmd = [sys.executable, str(script_path), file_path, "--quiet"]
        elif language.lower() in ("javascript", "typescript"):
            cmd = ["node", str(script_path), file_path, f"--mode={language.lower()[:2]}"]
        elif language.lower() == "php":
            cmd = ["php", str(script_path), file_path]
        else:
            cmd = [sys.executable, str(script_path), file_path]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        # Parse JSON output
        output = result.stdout.strip()
        if output:
            import json as _json
            rebanker_data = _json.loads(output)
        else:
            rebanker_data = {"status": "no_output"}
        
        # Attach to envelope metadata
        if "metadata" not in env:
            env["metadata"] = {}
        env["metadata"]["rebanker_result"] = rebanker_data
        
        # Also update errorsDetected in trendMetadata if error found
        if "line" in rebanker_data and rebanker_data.get("line") is not None:
            # This is an error result (has line number)
            # Note: rebanker returns FIRST error only; for full count you'd need to parse all
            # For now we just flag that errors exist
            if "trendMetadata" in env:
                # Don't override if already set by analyzer
                pass
            else:
                env["trendMetadata"] = {
                    "errorsDetected": 1,  # At least one error
                    "errorsResolved": 0,
                    "errorTrend": "unknown"
                }
        
        return env
        
    except subprocess.TimeoutExpired:
        if "metadata" not in env:
            env["metadata"] = {}
        env["metadata"]["rebanker_result"] = {
            "status": "timeout",
            "file": file_path
        }
        return env
    except Exception as e:
        if "metadata" not in env:
            env["metadata"] = {}
        env["metadata"]["rebanker_result"] = {
            "status": "error",
            "message": str(e)
        }
        return env

# Stable JSON (sorted keys, no whitespace differences)
import json as _json

def json_dumps_stable(obj: Any) -> str:
    return _json.dumps(obj, sort_keys=True, separators=(",", ":"))

# Convenience to convert dataclass instance to dict (shallow)

def as_envelope_dict(obj: Any) -> Dict[str, Any]:
    if hasattr(obj, "__dict__"):
        try:
            return asdict(obj)  # dataclass
        except Exception:
            return dict(obj.__dict__)
    if isinstance(obj, dict):
        return obj
    raise TypeError("Unsupported envelope object type")

__all__ = [
    "BreakerState",
    "append_attempt",
    "merge_confidence",
    "update_trend",
    "set_breaker_state",
    "set_cascade_depth",
    "merge_resource_usage",
    "apply_developer_flag",
    "mark_success",
    "set_envelope_timestamp",
    "compute_stable_envelope_hash",
    "set_envelope_hash",
    "update_counters",
    "add_timeline_entry",
    "run_rebanker",
    "as_envelope_dict",
]
