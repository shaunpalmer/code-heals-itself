import json
from abc import ABC, abstractmethod
from typing import Dict, Any

class Target(ABC):
    @abstractmethod
    def apply_patch(self, patch_data: Dict[str, Any]) -> Dict[str, Any]:
        pass

class Adaptee:
    def legacy_patch(self, raw_patch: str) -> str:
        # Simulate a legacy patching system
        return f"Legacy patched: {raw_patch}"

class PatchAdapter(Target):
    def __init__(self, adaptee: Adaptee):
        self.adaptee = adaptee

    def apply_patch(self, patch_data: Dict[str, Any]) -> Dict[str, Any]:
        # Adapt the patch data to the legacy system
        raw_patch = patch_data.get("raw_patch", "")
        adapted_result = self.adaptee.legacy_patch(raw_patch)

        # Create JSON outcome
        outcome = {
            "adapter": "PatchAdapter",
            "patch_applied": True,
            "original_patch": patch_data,
            "adapted_result": adapted_result,
            "success": True,
            "details": "Patch adapted and applied successfully"
        }
        return outcome

class SecurityPatchAdapter(Target):
    def apply_patch(self, patch_data: Dict[str, Any]) -> Dict[str, Any]:
        # Simulate security patch application
        vulnerability = patch_data.get("vulnerability", "")
        fix = patch_data.get("fix", "")

        # Apply security fix
        result = f"Security fix applied for {vulnerability}: {fix}"

        outcome = {
            "adapter": "SecurityPatchAdapter",
            "patch_applied": True,
            "vulnerability": vulnerability,
            "fix": fix,
            "result": result,
            "success": True,
            "details": "Security patch applied successfully"
        }
        return outcome

# Usage example
if __name__ == "__main__":
    adaptee = Adaptee()
    adapter = PatchAdapter(adaptee)

    patch_data = {"raw_patch": "Fix buffer overflow"}
    result = adapter.apply_patch(patch_data)
    print(json.dumps(result, indent=2))

    # Security adapter
    security_adapter = SecurityPatchAdapter()
    security_patch = {"vulnerability": "SQL Injection", "fix": "Use prepared statements"}
    security_result = security_adapter.apply_patch(security_patch)
    print(json.dumps(security_result, indent=2))