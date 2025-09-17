import json
from abc import ABC, abstractmethod
from typing import Dict, Any

class DebuggingStrategy(ABC):
    @abstractmethod
    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        pass

class LogAndFixStrategy(DebuggingStrategy):
    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        error = context.get("error", "")
        # Simulate logging and fixing
        fix = f"Logged and fixed: {error}"

        outcome = {
            "strategy": "LogAndFixStrategy",
            "error": error,
            "fix": fix,
            "success": True,
            "details": "Error logged and basic fix applied"
        }
        return outcome

class RollbackStrategy(DebuggingStrategy):
    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        error = context.get("error", "")
        # Simulate rollback
        rollback_action = f"Rolled back changes due to: {error}"

        outcome = {
            "strategy": "RollbackStrategy",
            "error": error,
            "rollback_action": rollback_action,
            "success": True,
            "details": "Changes rolled back to previous stable state"
        }
        return outcome

class SecurityAuditStrategy(DebuggingStrategy):
    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        vulnerability = context.get("vulnerability", "")
        # Simulate security audit and patch
        audit_result = f"Security audit passed for: {vulnerability}"

        outcome = {
            "strategy": "SecurityAuditStrategy",
            "vulnerability": vulnerability,
            "audit_result": audit_result,
            "success": True,
            "details": "Security vulnerability addressed"
        }
        return outcome

class Debugger:
    def __init__(self, strategy: DebuggingStrategy):
        self._strategy = strategy

    def set_strategy(self, strategy: DebuggingStrategy) -> None:
        self._strategy = strategy

    def debug(self, context: Dict[str, Any]) -> Dict[str, Any]:
        return self._strategy.execute(context)

# Usage example
if __name__ == "__main__":
    debugger = Debugger(LogAndFixStrategy())

    context = {"error": "Null pointer exception"}
    result = debugger.debug(context)
    print(json.dumps(result, indent=2))

    # Switch to rollback strategy
    debugger.set_strategy(RollbackStrategy())
    result2 = debugger.debug(context)
    print(json.dumps(result2, indent=2))

    # Security strategy
    debugger.set_strategy(SecurityAuditStrategy())
    security_context = {"vulnerability": "Buffer overflow"}
    result3 = debugger.debug(security_context)
    print(json.dumps(result3, indent=2))