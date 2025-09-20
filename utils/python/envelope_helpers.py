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
    "as_envelope_dict",
]
