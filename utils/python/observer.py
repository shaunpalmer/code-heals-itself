import json
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime

@dataclass
class EscalationHint:
    """Represents a difficulty-based escalation signal"""
    attempt_number: int
    difficulty_score: float  # 0.0 (easy) to 1.0 (hard)
    velocity: float  # error improvement per attempt
    reason: str  # Why escalation is suggested
    timestamp: str
    suggested_action: str  # e.g., "increase_temperature", "upgrade_model", "extend_attempts"

class Observer(ABC):
    @abstractmethod
    def update(self, subject: 'Subject', data: Dict[str, Any]) -> None:
        pass

class Subject:
    def __init__(self):
        self._observers: List[Observer] = []

    def attach(self, observer: Observer) -> None:
        if observer not in self._observers:
            self._observers.append(observer)

    def detach(self, observer: Observer) -> None:
        try:
            self._observers.remove(observer)
        except ValueError:
            pass

    def notify(self, data: Dict[str, Any]) -> None:
        for observer in self._observers:
            observer.update(self, data)

class PatchObserver(Observer):
    def __init__(self, name: str):
        self.name = name

    def update(self, subject: 'Subject', data: Dict[str, Any]) -> None:
        # Process patch outcome and serialize to JSON
        outcome = {
            "observer": self.name,
            "patch_success": data.get("success", False),
            "patch_name": data.get("patch_name", ""),
            "details": data.get("details", ""),
            "timestamp": data.get("timestamp", "")
        }
        json_output = json.dumps(outcome, indent=2)
        print(f"Observer {self.name} received update: {json_output}")
        # In a real system, this could be sent to a logging service or AI feedback loop

class EscalationHintObserver(Observer):
    """
    Active escalation observer that emits hints based on difficulty signals.
    Reacts to confidence scores, error velocity, and problem complexity.
    """
    
    # Thresholds for escalation signals (conservative, aligned with Phase 8 tuning)
    HARD_DIFFICULTY_THRESHOLD = 0.65  # difficulty > 0.65 = HARD
    VELOCITY_STALL_THRESHOLD = 0.05   # velocity < 0.05 = stalling
    EASY_CUTOFF = 0.25
    MEDIUM_CUTOFF = 0.65
    
    def __init__(self, name: str = "EscalationHint"):
        self.name = name
        self.escalation_history: List[EscalationHint] = []
    
    def update(self, subject: 'Subject', data: Dict[str, Any]) -> None:
        """
        React to difficulty signals from confidence scorer or circuit breaker.
        
        Expected data dict keys:
        - difficulty_score (float, 0.0-1.0): From taxonomy or confidence scorer
        - velocity (float): Error improvement rate (errors per attempt)
        - attempt_number (int): Current attempt in healing cycle
        - error_delta (float, optional): Progress made in this attempt
        - circuit_breaker_state (str, optional): "OPEN", "CLOSED", "HALF_OPEN"
        """
        
        difficulty = data.get("difficulty_score", 0.5)
        velocity = data.get("velocity", 0.1)
        attempt = data.get("attempt_number", 1)
        circuit_state = data.get("circuit_breaker_state", "CLOSED")
        
        # Determine if escalation hint should be emitted
        hint = self._evaluate_escalation(difficulty, velocity, attempt, circuit_state)
        
        if hint:
            self.escalation_history.append(hint)
            self._emit_hint(hint)
    
    def _evaluate_escalation(self, 
                            difficulty: float, 
                            velocity: float, 
                            attempt: int,
                            circuit_state: str) -> Optional[EscalationHint]:
        """
        Evaluate if escalation hint should be emitted based on difficulty and velocity.
        Returns EscalationHint if escalation is needed, None otherwise.
        """
        
        now = datetime.now().isoformat()
        
        # Signal 1: Hard problem + stalling velocity
        if difficulty >= self.HARD_DIFFICULTY_THRESHOLD and velocity < self.VELOCITY_STALL_THRESHOLD:
            reason = (
                f"Hard problem (difficulty={difficulty:.2f}) detected with stalling velocity "
                f"({velocity:.3f} errors/attempt). Problem may need different approach."
            )
            return EscalationHint(
                attempt_number=attempt,
                difficulty_score=difficulty,
                velocity=velocity,
                reason=reason,
                timestamp=now,
                suggested_action="increase_temperature_or_model_upgrade"
            )
        
        # Signal 2: Hard problem + circuit breaker open
        if difficulty >= self.HARD_DIFFICULTY_THRESHOLD and circuit_state == "OPEN":
            reason = (
                f"Hard problem (difficulty={difficulty:.2f}) with circuit breaker OPEN. "
                f"Stagnation detected. Consider model escalation."
            )
            return EscalationHint(
                attempt_number=attempt,
                difficulty_score=difficulty,
                velocity=velocity,
                reason=reason,
                timestamp=now,
                suggested_action="escalate_to_larger_model"
            )
        
        # Signal 3: Extreme difficulty (>0.8) at any point
        if difficulty > 0.8:
            reason = (
                f"Extreme difficulty detected (difficulty={difficulty:.2f}). "
                f"This problem may exceed current model capability. "
                f"Recommend immediate model upgrade or multi-model ensemble."
            )
            return EscalationHint(
                attempt_number=attempt,
                difficulty_score=difficulty,
                velocity=velocity,
                reason=reason,
                timestamp=now,
                suggested_action="immediate_model_escalation_or_ensemble"
            )
        
        # No escalation needed
        return None
    
    def _emit_hint(self, hint: EscalationHint) -> None:
        """Emit escalation hint to console and logging system"""
        
        difficulty_label = "EXTREME" if hint.difficulty_score > 0.8 else \
                          "HARD" if hint.difficulty_score > self.MEDIUM_CUTOFF else \
                          "MEDIUM" if hint.difficulty_score > self.EASY_CUTOFF else \
                          "EASY"
        
        message = (
            f"\n🚨 [{self.name}] ESCALATION HINT at Attempt {hint.attempt_number}\n"
            f"   Difficulty: {difficulty_label} ({hint.difficulty_score:.2%})\n"
            f"   Velocity: {hint.velocity:.3f} errors/attempt\n"
            f"   Action: {hint.suggested_action}\n"
            f"   Reason: {hint.reason}\n"
        )
        print(message)
        
        # Could log to file here for later analysis
        # Example: append to /data/escalation_hints.jsonl
    
    def get_escalation_history(self) -> List[EscalationHint]:
        """Return all escalation hints emitted during session"""
        return self.escalation_history
    
    def get_escalation_summary(self) -> Dict[str, Any]:
        """Return summary of escalation signals"""
        return {
            "total_hints": len(self.escalation_history),
            "by_action": self._group_by_action(),
            "max_difficulty": max([h.difficulty_score for h in self.escalation_history], default=0.0),
            "hints": [
                {
                    "attempt": h.attempt_number,
                    "difficulty": h.difficulty_score,
                    "velocity": h.velocity,
                    "action": h.suggested_action
                }
                for h in self.escalation_history
            ]
        }
    
    def _group_by_action(self) -> Dict[str, int]:
        """Count escalation hints by suggested action"""
        actions = {}
        for hint in self.escalation_history:
            actions[hint.suggested_action] = actions.get(hint.suggested_action, 0) + 1
        return actions

class ErrorHandler(Subject):
    def __init__(self):
        super().__init__()

    def handle_error(self, error: str, patch_name: str = "") -> None:
        data = {
            "error": error,
            "patch_name": patch_name,
            "timestamp": str(__import__('datetime').datetime.now())
        }
        self.notify(data)
    
    def signal_escalation_opportunity(self, 
                                     difficulty_score: float,
                                     velocity: float,
                                     attempt_number: int,
                                     circuit_breaker_state: str = "CLOSED") -> None:
        """
        Signal escalation opportunity to all observers (especially EscalationHintObserver).
        This is the main integration point for difficulty-aware escalation.
        """
        data = {
            "difficulty_score": difficulty_score,
            "velocity": velocity,
            "attempt_number": attempt_number,
            "circuit_breaker_state": circuit_breaker_state,
            "timestamp": str(__import__('datetime').datetime.now())
        }
        self.notify(data)

# Usage examples
if __name__ == "__main__":
    print("=" * 70)
    print("EXAMPLE 1: Basic Patch Observer")
    print("=" * 70)
    
    handler = ErrorHandler()
    observer = PatchObserver("SecurityObserver")
    handler.attach(observer)

    # Simulate an error and patch attempt
    handler.handle_error("Buffer overflow detected", "security_patch_001")
    
    print("\n" + "=" * 70)
    print("EXAMPLE 2: Escalation Hint Observer (Difficulty-Based)")
    print("=" * 70)
    
    handler2 = ErrorHandler()
    escalation_observer = EscalationHintObserver("DifficultyMonitor")
    handler2.attach(escalation_observer)
    
    # Simulate multiple attempts with increasing difficulty
    print("\n[Attempt 1] Easy problem, good velocity")
    handler2.signal_escalation_opportunity(
        difficulty_score=0.2,
        velocity=2.5,  # Good progress
        attempt_number=1,
        circuit_breaker_state="CLOSED"
    )
    
    print("\n[Attempt 2] Medium problem, slowing down")
    handler2.signal_escalation_opportunity(
        difficulty_score=0.5,
        velocity=0.3,
        attempt_number=2,
        circuit_breaker_state="CLOSED"
    )
    
    print("\n[Attempt 3] Hard problem, stalling velocity")
    handler2.signal_escalation_opportunity(
        difficulty_score=0.75,
        velocity=0.02,  # Stalling! 
        attempt_number=3,
        circuit_breaker_state="OPEN"
    )
    
    print("\n[Attempt 4] Extreme difficulty detected")
    handler2.signal_escalation_opportunity(
        difficulty_score=0.85,
        velocity=0.01,
        attempt_number=4,
        circuit_breaker_state="OPEN"
    )
    
    # Print summary
    print("\n" + "=" * 70)
    print("ESCALATION SUMMARY")
    print("=" * 70)
    summary = escalation_observer.get_escalation_summary()
    print(json.dumps(summary, indent=2))