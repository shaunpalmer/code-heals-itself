import json
from abc import ABC, abstractmethod
from typing import Dict, Any, List
from dataclasses import dataclass, field
from datetime import datetime
from .envelope_helpers import (
    append_attempt, mark_success as helper_mark_success,
    set_envelope_timestamp, set_envelope_hash
)

@dataclass
class PatchEnvelope:
    patch_id: str
    patch_data: Dict[str, Any]
    metadata: Dict[str, Any]
    attempts: List[Dict[str, Any]]
    confidenceComponents: Dict[str, float] = field(default_factory=dict)
    breakerState: str = "CLOSED"
    cascadeDepth: int = 0
    resourceUsage: Dict[str, Any] = field(default_factory=dict)
    flagged_for_developer: bool = False
    developer_message: str = ""
    developer_flag_reason: str | None = None
    success: bool = False
    # Additional parity fields
    trend_metadata: Dict[str, Any] = field(default_factory=lambda: {
        "errorsDetected": 0,
        "errorsResolved": 0,
        "errorTrend": "unknown"
    })
    counters: Dict[str, int] = field(default_factory=dict)
    timeline: List[Dict[str, Any]] = field(default_factory=list)
    envelope_hash: str | None = None

    def to_json(self) -> str:
        return json.dumps({
            "patch_id": self.patch_id,
            "patch_data": self.patch_data,
            "metadata": self.metadata,
            "attempts": self.attempts,
            "confidenceComponents": self.confidenceComponents or {},
            "breakerState": self.breakerState,
            "cascadeDepth": self.cascadeDepth,
            "resourceUsage": self.resourceUsage or {},
            "trendMetadata": self.trend_metadata,
            "flagged_for_developer": self.flagged_for_developer,
            "developer_message": self.developer_message,
            "developer_flag_reason": self.developer_flag_reason,
            "counters": self.counters,
            "timeline": self.timeline,
            "envelopeHash": self.envelope_hash,
            "success": self.success,
            "timestamp": datetime.now().isoformat()
        }, indent=2)

    @classmethod
    def from_json(cls, json_str: str) -> 'PatchEnvelope':
        data = json.loads(json_str)
        return cls(
            patch_id=data["patch_id"],
            patch_data=data["patch_data"],
            metadata=data["metadata"],
            attempts=data.get("attempts", []),
            confidenceComponents=data.get("confidenceComponents", {}),
            breakerState=data.get("breakerState", "CLOSED"),
            cascadeDepth=data.get("cascadeDepth", 0),
            resourceUsage=data.get("resourceUsage", {}),
            flagged_for_developer=data.get("flagged_for_developer", False),
            developer_message=data.get("developer_message", ""),
            developer_flag_reason=data.get("developer_flag_reason"),
            success=data.get("success", False),
            trend_metadata=data.get("trendMetadata", {
                "errorsDetected": 0,
                "errorsResolved": 0,
                "errorTrend": "unknown"
            }),
            counters=data.get("counters", {}),
            timeline=data.get("timeline", []),
            envelope_hash=data.get("envelopeHash")
        )

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
        if self._is_big_error(envelope.patch_data):
            envelope.flagged_for_developer = True
            envelope.developer_message = self._generate_developer_message(envelope.patch_data)
            return {
                "success": False,
                "flagged": True,
                "message": "Patch flagged for developer review - potential critical issue",
                "envelope": envelope.to_json()
            }
        
        # Simulate successful execution
        execution_details = "Patch executed successfully"
        # Use helpers for parity
        helper_mark_success(envelope.__dict__, True)  # mutate underlying dict
        append_attempt(envelope.__dict__, success=True, note=execution_details, breaker_state="CLOSED", failure_count=0)
        set_envelope_timestamp(envelope.__dict__)
        set_envelope_hash(envelope.__dict__)
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