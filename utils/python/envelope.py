import json
import copy
from abc import ABC, abstractmethod
from contextlib import contextmanager
from typing import Dict, Any, List, Optional, Iterator
from datetime import datetime
from .envelope_helpers import (
    append_attempt,
    mark_success as helper_mark_success,
    set_envelope_timestamp,
    set_envelope_hash,
)

class PatchEnvelope:
    """Encapsulated representation of the patch envelope payload."""

    __slots__ = ("_data",)

    def __init__(
        self,
        *,
        patch_id: str,
        patch_data: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None,
        attempts: Optional[List[Dict[str, Any]]] = None,
        confidenceComponents: Optional[Dict[str, float]] = None,
        breakerState: str = "CLOSED",
        cascadeDepth: int = 0,
        resourceUsage: Optional[Dict[str, Any]] = None,
        flagged_for_developer: bool = False,
        developer_message: str = "",
        developer_flag_reason: Optional[str] = None,
        success: bool = False,
        trend_metadata: Optional[Dict[str, Any]] = None,
        counters: Optional[Dict[str, int]] = None,
        timeline: Optional[List[Dict[str, Any]]] = None,
        envelope_hash: Optional[str] = None,
    ) -> None:
        self._data: Dict[str, Any] = {
            "patch_id": patch_id,
            "patch_data": copy.deepcopy(patch_data),
            "metadata": copy.deepcopy(metadata) if metadata is not None else {},
            "attempts": copy.deepcopy(attempts) if attempts is not None else [],
            "confidenceComponents": copy.deepcopy(confidenceComponents)
            if confidenceComponents is not None
            else {},
            "breakerState": breakerState,
            "cascadeDepth": cascadeDepth,
            "resourceUsage": copy.deepcopy(resourceUsage) if resourceUsage is not None else {},
            "flagged_for_developer": bool(flagged_for_developer),
            "developer_message": developer_message,
            "developer_flag_reason": developer_flag_reason,
            "success": bool(success),
            "trendMetadata": copy.deepcopy(trend_metadata)
            if trend_metadata is not None
            else {
                "errorsDetected": 0,
                "errorsResolved": 0,
                "errorTrend": "unknown",
            },
            "counters": copy.deepcopy(counters) if counters is not None else {},
            "timeline": copy.deepcopy(timeline) if timeline is not None else [],
            "envelopeHash": envelope_hash,
        }

    # ------------------------------------------------------------------
    # Properties (read-only views)
    # ------------------------------------------------------------------
    @property
    def patch_id(self) -> str:
        return self._data["patch_id"]

    @property
    def patch_data(self) -> Dict[str, Any]:
        return copy.deepcopy(self._data["patch_data"])

    @property
    def attempts(self) -> List[Dict[str, Any]]:
        return copy.deepcopy(self._data["attempts"])

    @property
    def breaker_state(self) -> str:
        return self._data["breakerState"]

    @property
    def breakerState(self) -> str:  # Backwards compatibility alias
        return self.breaker_state

    @breakerState.setter
    def breakerState(self, value: str) -> None:
        self.set_breaker_state(value)

    @property
    def cascade_depth(self) -> int:
        return self._data["cascadeDepth"]

    @property
    def cascadeDepth(self) -> int:  # Backwards compatibility alias
        return self.cascade_depth

    @cascadeDepth.setter
    def cascadeDepth(self, value: int) -> None:
        self.set_cascade_depth(value)

    @property
    def is_successful(self) -> bool:
        return bool(self._data["success"])

    @property
    def success(self) -> bool:  # Backwards compatibility alias
        return self.is_successful

    @success.setter
    def success(self, value: bool) -> None:
        self.mark_success(value)

    @property
    def is_flagged(self) -> bool:
        return bool(self._data["flagged_for_developer"])

    @property
    def flagged_for_developer(self) -> bool:  # Backwards compatibility alias
        return self.is_flagged

    @flagged_for_developer.setter
    def flagged_for_developer(self, value: bool) -> None:
        if value:
            self.flag_for_developer()
        else:
            self.clear_developer_flag()

    @property
    def developer_message(self) -> str:
        return self._data["developer_message"]

    @developer_message.setter
    def developer_message(self, value: str) -> None:
        self.set_developer_message(value)

    @property
    def developer_flag_reason(self) -> Optional[str]:
        return self._data["developer_flag_reason"]

    @developer_flag_reason.setter
    def developer_flag_reason(self, value: Optional[str]) -> None:
        self.set_developer_reason(value)

    @property
    def metadata(self) -> Dict[str, Any]:
        return copy.deepcopy(self._data["metadata"])

    @metadata.setter
    def metadata(self, value: Dict[str, Any]) -> None:
        self._data["metadata"] = copy.deepcopy(value or {})

    @property
    def resource_usage(self) -> Dict[str, Any]:
        return copy.deepcopy(self._data["resourceUsage"])

    @property
    def resourceUsage(self) -> Dict[str, Any]:  # Backwards compatibility alias
        return self.resource_usage

    @resourceUsage.setter
    def resourceUsage(self, value: Dict[str, Any]) -> None:
        self._data["resourceUsage"] = copy.deepcopy(value or {})

    @property
    def trend_metadata(self) -> Dict[str, Any]:
        return copy.deepcopy(self._data["trendMetadata"])

    @property
    def trendMetadata(self) -> Dict[str, Any]:  # Backwards compatibility alias
        return self.trend_metadata

    @trendMetadata.setter
    def trendMetadata(self, value: Dict[str, Any]) -> None:
        self._data["trendMetadata"] = copy.deepcopy(value or {})

    @property
    def confidence_components(self) -> Dict[str, float]:
        return copy.deepcopy(self._data["confidenceComponents"])

    @property
    def confidenceComponents(self) -> Dict[str, float]:  # Backwards compatibility alias
        return self.confidence_components

    @confidenceComponents.setter
    def confidenceComponents(self, value: Dict[str, float]) -> None:
        self.update_confidence(value or {})

    @property
    def counters(self) -> Dict[str, int]:
        return copy.deepcopy(self._data["counters"])

    @counters.setter
    def counters(self, value: Dict[str, int]) -> None:
        self.update_counters(value or {})

    @property
    def timeline(self) -> List[Dict[str, Any]]:
        return copy.deepcopy(self._data["timeline"])

    @timeline.setter
    def timeline(self, value: List[Dict[str, Any]]) -> None:
        self.update_timeline(value or [])

    @property
    def envelope_hash(self) -> Optional[str]:
        return self._data["envelopeHash"]

    @property
    def envelopeHash(self) -> Optional[str]:  # Backwards compatibility alias
        return self.envelope_hash

    @envelopeHash.setter
    def envelopeHash(self, value: Optional[str]) -> None:
        self.set_envelope_hash(value)

    # ------------------------------------------------------------------
    # Controlled mutation helpers
    # ------------------------------------------------------------------
    def merge_metadata(self, extra: Optional[Dict[str, Any]]) -> None:
        if not extra:
            return
        self._data["metadata"].update(copy.deepcopy(extra))

    def set_breaker_state(self, state: str) -> None:
        self._data["breakerState"] = state

    def set_cascade_depth(self, depth: int) -> None:
        self._data["cascadeDepth"] = max(0, int(depth))

    def mark_success(self, success: bool = True) -> None:
        self._data["success"] = bool(success)

    def flag_for_developer(
        self,
        *,
        message: Optional[str] = None,
        reason: Optional[str] = None,
    ) -> None:
        self._data["flagged_for_developer"] = True
        if message is not None:
            self._data["developer_message"] = message
        if reason is not None:
            self._data["developer_flag_reason"] = reason

    def clear_developer_flag(self) -> None:
        self._data["flagged_for_developer"] = False
        self._data["developer_message"] = ""
        self._data["developer_flag_reason"] = None

    def set_developer_message(self, message: str) -> None:
        self._data["developer_message"] = message

    def set_developer_reason(self, reason: Optional[str]) -> None:
        self._data["developer_flag_reason"] = reason

    def add_attempt(self, attempt: Dict[str, Any]) -> None:
        self._data["attempts"].append(copy.deepcopy(attempt))

    def update_confidence(self, components: Dict[str, float]) -> None:
        self._data["confidenceComponents"] = copy.deepcopy(components)

    def update_resource_usage(self, usage: Dict[str, Any]) -> None:
        self._data["resourceUsage"].update(copy.deepcopy(usage))

    def update_trend(self, trend: Dict[str, Any]) -> None:
        self._data["trendMetadata"].update(copy.deepcopy(trend))

    def update_counters(self, counters: Dict[str, int]) -> None:
        self._data["counters"].update(copy.deepcopy(counters))

    def update_timeline(self, timeline: List[Dict[str, Any]]) -> None:
        self._data["timeline"] = copy.deepcopy(timeline)

    def set_envelope_hash(self, envelope_hash: Optional[str]) -> None:
        self._data["envelopeHash"] = envelope_hash

    # ------------------------------------------------------------------
    # Dict / JSON views
    # ------------------------------------------------------------------
    def to_dict(self, *, include_timestamp: bool = False) -> Dict[str, Any]:
        snapshot = copy.deepcopy(self._data)
        if include_timestamp:
            snapshot["timestamp"] = datetime.now().isoformat()
        return snapshot

    def to_json(self) -> str:
        return json.dumps(self.to_dict(include_timestamp=True), indent=2)

    @classmethod
    def from_json(cls, json_str: str) -> 'PatchEnvelope':
        data = json.loads(json_str)
        return cls(
            patch_id=data["patch_id"],
            patch_data=data["patch_data"],
            metadata=data.get("metadata", {}),
            attempts=data.get("attempts", []),
            confidenceComponents=data.get("confidenceComponents", {}),
            breakerState=data.get("breakerState", "CLOSED"),
            cascadeDepth=data.get("cascadeDepth", 0),
            resourceUsage=data.get("resourceUsage", {}),
            flagged_for_developer=data.get("flagged_for_developer", False),
            developer_message=data.get("developer_message", ""),
            developer_flag_reason=data.get("developer_flag_reason"),
            success=data.get("success", False),
            trend_metadata=data.get("trendMetadata"),
            counters=data.get("counters"),
            timeline=data.get("timeline"),
            envelope_hash=data.get("envelopeHash"),
        )

    # ------------------------------------------------------------------
    # Controlled dictionary mutation for helper compatibility
    # ------------------------------------------------------------------
    @contextmanager
    def mutable_payload(self) -> Iterator[Dict[str, Any]]:
        """Yield a mutable copy of the payload and absorb changes afterwards."""

        snapshot = self.to_dict()
        try:
            yield snapshot
        finally:
            self._absorb(snapshot)

    def _absorb(self, mutated: Dict[str, Any]) -> None:
        base_id = self._data["patch_id"]
        for key, value in mutated.items():
            if key == "patch_id" and value != base_id:
                raise ValueError("patch_id is immutable once set")
            if key == "patch_data" and value != self._data["patch_data"]:
                raise ValueError("patch_data mutation is not supported via mutable_payload")
            self._data[key] = copy.deepcopy(value)

    # Convenience access used by helper utilities that expect dict-like input
    def apply_helper(self, helper_callable, *args, **kwargs) -> None:
        with self.mutable_payload() as payload:
            helper_callable(payload, *args, **kwargs)

    def apply_multiple_helpers(self, *operations) -> None:
        with self.mutable_payload() as payload:
            for fn, args, kwargs in operations:
                fn(payload, *args, **kwargs)

class PatchWrapper(ABC):
    @abstractmethod
    def wrap_patch(self, patch: Dict[str, Any]) -> PatchEnvelope:
        pass
    
    @abstractmethod
    def unwrap_and_execute(self, envelope: PatchEnvelope) -> Dict[str, Any]:
        pass

class AIPatchEnvelope(PatchWrapper):
    def __init__(self):
        self.envelopes = {}
    
    def wrap_patch(self, patch: Dict[str, Any]) -> PatchEnvelope:
        patch_id = f"patch_{int(datetime.now().timestamp())}_{hash(str(patch))}"
        
        envelope = PatchEnvelope(
            patch_id=patch_id,
            patch_data=patch,
            metadata={
                "created_at": datetime.now().isoformat(),
                "language": "python",
                "ai_generated": True
            },
            attempts=[]
        )
        
        self.envelopes[patch_id] = envelope
        return envelope
    
    def unwrap_and_execute(self, envelope: PatchEnvelope) -> Dict[str, Any]:
        # This would contain the actual patch execution logic
        # For now, it's a placeholder that simulates execution
        
        # Check if this is a "big error" that should be flagged
        patch_snapshot = envelope.patch_data
        if self._is_big_error(patch_snapshot):
            envelope.flag_for_developer(
                message=self._generate_developer_message(patch_snapshot)
            )
            return {
                "success": False,
                "flagged": True,
                "message": "Patch flagged for developer review - potential critical issue",
                "envelope": envelope.to_json()
            }
        
        # Simulate successful execution
        execution_details = "Patch executed successfully"
        envelope.apply_multiple_helpers(
            (helper_mark_success, (True,), {}),
            (
                append_attempt,
                (),
                {
                    "success": True,
                    "note": execution_details,
                    "breaker_state": "CLOSED",
                    "failure_count": 0,
                },
            ),
            (set_envelope_timestamp, (), {}),
            (set_envelope_hash, (), {}),
        )
        result = {
            "success": True,
            "patch_id": envelope.patch_id,
            "execution_details": execution_details,
            "envelope": envelope.to_json()
        }
        return result
    
    def _is_big_error(self, patch_data: Dict[str, Any]) -> bool:
        """Determine if this is a 'big error' that needs developer attention"""
        error_indicators = [
            "database_schema_change" in str(patch_data),
            "authentication_bypass" in str(patch_data),
            "critical_security_vulnerability" in str(patch_data),
            "production_data_modification" in str(patch_data),
            len(str(patch_data)) > 1000  # Large/complex patches
        ]
        return any(error_indicators)
    
    def _generate_developer_message(self, patch_data: Dict[str, Any]) -> str:
        """Generate a message for the developer about why this needs review"""
        if "database_schema_change" in str(patch_data):
            return "Database schema modification detected. Please review for data integrity and migration implications."
        elif "authentication_bypass" in str(patch_data):
            return "Authentication-related changes detected. Critical security review required."
        elif "production_data_modification" in str(patch_data):
            return "Production data modification detected. Please verify backup and rollback procedures."
        else:
            return "Complex patch detected requiring manual review before deployment."

class MemoryBuffer:
    """Simulates AI memory buffer for learning from patch outcomes"""
    def __init__(self, max_size: int = 100):
        self.buffer = []
        self.max_size = max_size
    
    def add_outcome(self, envelope_json: str):
        """Add patch outcome to memory buffer"""
        self.buffer.append({
            "envelope": envelope_json,
            "timestamp": datetime.now().isoformat()
        })
        
        # Maintain buffer size
        if len(self.buffer) > self.max_size:
            self.buffer.pop(0)
    
    def get_similar_outcomes(self, patch_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Retrieve similar past outcomes for learning"""
        similar = []
        for item in self.buffer:
            envelope = PatchEnvelope.from_json(item["envelope"])
            if self._is_similar(envelope.patch_data, patch_data):
                similar.append(item)
        return similar[-5:]  # Return last 5 similar outcomes
    
    def _is_similar(self, past_patch: Dict[str, Any], current_patch: Dict[str, Any]) -> bool:
        """Simple similarity check - can be enhanced with ML"""
        past_keys = set(str(past_patch).lower().split())
        current_keys = set(str(current_patch).lower().split())
        return len(past_keys.intersection(current_keys)) > 2

# Usage example
if __name__ == "__main__":
    wrapper = AIPatchEnvelope()
    memory = MemoryBuffer()
    
    # Create and wrap a patch
    patch_data = {"fix": "Add bounds checking", "vulnerability": "buffer_overflow"}
    envelope = wrapper.wrap_patch(patch_data)
    
    # Execute the patch
    result = wrapper.unwrap_and_execute(envelope)
    
    # Add to memory for learning
    memory.add_outcome(result["envelope"])
    
    print("Patch Result:")
    print(json.dumps(json.loads(result["envelope"]), indent=2))
    
    # Check for similar past outcomes
    similar = memory.get_similar_outcomes(patch_data)
    print(f"\nSimilar past outcomes: {len(similar)}")