"""
Dynamic Model Escalation Observer
==================================

Monitors circuit breaker signals during healing attempts and automatically
escalates to smarter models when the current model struggles.

Core Logic:
- Track improvement velocity and circuit breaker state
- Detect stagnation patterns (no progress for N attempts)
- Escalate intelligently based on problem difficulty
- Notify observers of escalation events
"""

import json
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from pathlib import Path

# Model escalation hierarchy (ordered by capability)
MODEL_HIERARCHY = [
    ('qwen2.5-coder-7b-instruct', 7, 'Small - syntax & simple logic'),
    ('hermes-3-llama-3.2-3b', 3, 'Tiny - baseline'),
    ('mistral-nemo-instruct-2407', 12, 'Medium - better reasoning'),
    ('vicuna-13b-v1.5', 13, 'Medium - general purpose'),
    ('openai/gpt-oss-20b', 20, 'Large - complex reasoning'),
    ('qwen3-32b', 32, 'Extra Large - deep understanding'),
]

# Model capabilities mapping
MODEL_CAPABILITIES = {
    7: {'syntax': True, 'logic': True, 'semantic': False, 'concurrent': False},
    3: {'syntax': True, 'logic': False, 'semantic': False, 'concurrent': False},
    12: {'syntax': True, 'logic': True, 'semantic': True, 'concurrent': False},
    13: {'syntax': True, 'logic': True, 'semantic': True, 'concurrent': False},
    20: {'syntax': True, 'logic': True, 'semantic': True, 'concurrent': True},
    32: {'syntax': True, 'logic': True, 'semantic': True, 'concurrent': True},
}

# Escalation thresholds
# IMPORTANT: Error delta is about PROGRESS. Give algorithm time to explore.
# These are CONSERVATIVE to avoid premature escalation on hard problems.
ESCALATION_CONFIG = {
    'stagnation_attempts': 4,  # Open circuit for 4+ attempts before escalate (was 2)
                               # Reason: Softmax needs room to settle, explore problem space
    'velocity_threshold': 0.05,  # improvement_velocity < 0.05 = stalling (was 0.1)
                                 # Reason: Very strict - only escalate if truly stuck
    'error_delta_minimum': 0.5,  # If delta < this, no progress (was 1.0)
                                 # Reason: Even fixing 1 bug every 2 attempts is progress
    'max_consecutive_no_progress': 5,  # Escalate if 5+ attempts show no improvement (was 3)
                                       # Reason: Give 5-6 attempts for a model to crack it
    'temperature_boost': 0.3,  # Increase temp after escalation for exploration (was 0.2)
                               # Reason: When escalating, boost exploration more
}


class ModelEscalationObserver:
    """
    Observes circuit breaker signals and escalation events.
    Implements observer pattern for healing loop integration.
    """

    def __init__(self, log_file: Optional[str] = None):
        self.log_file = log_file or "./data/model_escalation_events.jsonl"
        self.events: List[Dict] = []
        self.create_log_dir()

    def create_log_dir(self):
        """Ensure log directory exists"""
        Path(self.log_file).parent.mkdir(parents=True, exist_ok=True)

    def log_event(self, event_type: str, **kwargs) -> None:
        """Log escalation event"""
        event = {
            'timestamp': datetime.now().isoformat(),
            'type': event_type,
            **kwargs
        }
        self.events.append(event)

        # Write to JSONL file
        try:
            with open(self.log_file, 'a') as f:
                f.write(json.dumps(event) + '\n')
        except Exception as e:
            print(f"Warning: Could not write to escalation log: {e}")

    def notify_attempt(self, attempt_num: int, breaker_summary: Dict) -> None:
        """Called after each healing attempt with circuit breaker summary"""
        self.log_event(
            'ATTEMPT_RECORDED',
            attempt=attempt_num,
            circuit_state=breaker_summary.get('circuit_state'),
            is_improving=breaker_summary.get('is_improving'),
            improvement_velocity=breaker_summary.get('improvement_velocity'),
            error_count=breaker_summary.get('total_attempts'),
            confidence=breaker_summary.get('current_confidence')
        )

    def notify_escalation(
        self,
        attempt_num: int,
        old_model: str,
        new_model: str,
        reason: str,
        breaker_state: str
    ) -> None:
        """Called when model escalation is triggered"""
        self.log_event(
            'MODEL_ESCALATION',
            attempt=attempt_num,
            from_model=old_model,
            to_model=new_model,
            reason=reason,
            breaker_state=breaker_state
        )


class ModelEscalationDecider:
    """
    Decides when and how to escalate models based on circuit breaker signals.
    Uses stateful decision logic to detect stagnation patterns.
    """

    def __init__(self, observer: Optional[ModelEscalationObserver] = None):
        self.observer = observer or ModelEscalationObserver()
        self.escalation_history: List[Dict] = []
        self.breaker_history: List[Dict] = []
        self.no_progress_counter = 0
        self.open_circuit_counter = 0

    def should_escalate(
        self,
        attempt_num: int,
        current_model: str,
        breaker_summary: Dict,
        prev_error_count: int,
        current_error_count: int
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Determine if we should escalate models.

        Args:
            attempt_num: Current attempt number (1-based)
            current_model: Currently active model name
            breaker_summary: Circuit breaker state summary dict
            prev_error_count: Error count from previous attempt
            current_error_count: Error count from current attempt

        Returns:
            (should_escalate, reason, recommended_model)
        """

        # Track history
        self.breaker_history.append(breaker_summary)
        self.observer.notify_attempt(attempt_num, breaker_summary)

        # Check 1: Circuit breaker is OPEN (stagnation detected)
        if breaker_summary.get('circuit_state') in ['OPEN', 'LOGIC_OPEN', 'SYNTAX_OPEN']:
            self.open_circuit_counter += 1

            if self.open_circuit_counter >= ESCALATION_CONFIG['stagnation_attempts']:
                reason = f"Circuit breaker OPEN for {self.open_circuit_counter} attempts"
                next_model = self._get_next_model(current_model)
                if next_model:
                    self._record_escalation(attempt_num, current_model, next_model, reason, breaker_summary)
                    return True, reason, next_model
        else:
            # Reset counter when circuit closes
            self.open_circuit_counter = 0

        # Check 2: No improvement for N consecutive attempts
        error_delta = prev_error_count - current_error_count
        if error_delta < ESCALATION_CONFIG['error_delta_minimum']:
            self.no_progress_counter += 1
        else:
            # Progress detected, reset counter
            self.no_progress_counter = 0

        if self.no_progress_counter >= ESCALATION_CONFIG['max_consecutive_no_progress']:
            reason = f"No improvement for {self.no_progress_counter} attempts (delta < 1 error)"
            next_model = self._get_next_model(current_model)
            if next_model:
                self._record_escalation(attempt_num, current_model, next_model, reason, breaker_summary)
                return True, reason, next_model

        # Check 3: Low improvement velocity (errors decreasing very slowly)
        velocity = breaker_summary.get('improvement_velocity', 0)
        if attempt_num > 2 and velocity < ESCALATION_CONFIG['velocity_threshold']:
            # Only escalate if we've tried at least a couple times with this model
            if attempt_num - len(self.escalation_history) > 1:
                reason = f"Low improvement velocity: {velocity:.2f} < {ESCALATION_CONFIG['velocity_threshold']}"
                next_model = self._get_next_model(current_model)
                if next_model:
                    self._record_escalation(attempt_num, current_model, next_model, reason, breaker_summary)
                    return True, reason, next_model

        return False, None, None

    def _get_next_model(self, current_model: str) -> Optional[str]:
        """Find next model in escalation hierarchy"""
        for i, (model_name, size, desc) in enumerate(MODEL_HIERARCHY):
            if model_name == current_model or size == self._extract_size(current_model):
                # Return next model if available
                if i + 1 < len(MODEL_HIERARCHY):
                    return MODEL_HIERARCHY[i + 1][0]
                else:
                    # Already at top model
                    return None
        return None

    def _extract_size(self, model_name: str) -> Optional[int]:
        """Extract parameter count from model name"""
        # Try to find matching model in hierarchy
        for name, size, _ in MODEL_HIERARCHY:
            if model_name == name:
                return size
            # Try fuzzy match for 32b, 20b, 13b patterns
            if any(x in model_name.lower() for x in ['32b', '32']):
                return 32
            if any(x in model_name.lower() for x in ['20b', '20']):
                return 20
            if any(x in model_name.lower() for x in ['13b', '13']):
                return 13
            if any(x in model_name.lower() for x in ['7b', '7']):
                return 7
        return None

    def _record_escalation(
        self,
        attempt_num: int,
        old_model: str,
        new_model: str,
        reason: str,
        breaker_state: Dict
    ) -> None:
        """Record escalation event"""
        escalation = {
            'attempt': attempt_num,
            'from': old_model,
            'to': new_model,
            'reason': reason,
            'circuit_state': breaker_state.get('circuit_state'),
            'timestamp': datetime.now().isoformat()
        }
        self.escalation_history.append(escalation)
        self.observer.notify_escalation(
            attempt_num,
            old_model,
            new_model,
            reason,
            breaker_state.get('circuit_state', 'unknown')
        )

    def get_escalation_count(self) -> int:
        """Return number of escalations so far"""
        return len(self.escalation_history)

    def get_escalation_history(self) -> List[Dict]:
        """Return full escalation history"""
        return self.escalation_history.copy()

    def reset(self) -> None:
        """Reset state for new healing session"""
        self.escalation_history = []
        self.breaker_history = []
        self.no_progress_counter = 0
        self.open_circuit_counter = 0


def estimate_problem_difficulty(model_failures: Dict[int, int]) -> str:
    """
    Estimate problem difficulty based on model size vs success.
    
    model_failures: {model_size: num_failures_fixed}
    
    Returns: 'simple', 'moderate', 'hard', 'extreme'
    """
    if not model_failures:
        return 'unknown'

    # If 7B fixes it → simple
    if 7 in model_failures and model_failures[7] == 0:
        return 'simple'
    # If 7B can't but 20B can → hard
    elif 7 in model_failures and model_failures[7] > 0:
        if 20 in model_failures and model_failures[20] == 0:
            return 'hard'
        elif 32 in model_failures and model_failures[32] == 0:
            return 'extreme'
    # If 20B can fix → moderate
    if 20 in model_failures and model_failures[20] == 0:
        return 'moderate'
    # If 32B can fix → extreme
    if 32 in model_failures and model_failures[32] == 0:
        return 'extreme'

    return 'unknown'


# Utility function for test runners
def get_model_for_attempt(
    attempt_num: int,
    base_model: str,
    breaker_summary: Optional[Dict] = None,
    escalation_decider: Optional[ModelEscalationDecider] = None,
    prev_error_count: int = 0,
    current_error_count: int = 0
) -> Tuple[str, Optional[str], bool]:
    """
    Get the model to use for this attempt, with automatic escalation.

    Returns:
        (model_name, escalation_reason, escalated)
    """
    if not escalation_decider:
        escalation_decider = ModelEscalationDecider()

    if not breaker_summary:
        # No breaker summary = first attempt, use base model
        return base_model, None, False

    should_escalate, reason, next_model = escalation_decider.should_escalate(
        attempt_num=attempt_num,
        current_model=base_model,
        breaker_summary=breaker_summary,
        prev_error_count=prev_error_count,
        current_error_count=current_error_count
    )

    if should_escalate and next_model:
        return next_model, reason, True
    else:
        return base_model, None, False
