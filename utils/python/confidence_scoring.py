"""
Unified Confidence Scoring System for Self-Healing Code
Provides consistent confidence scoring across all languages with error classification
"""

import math
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from enum import Enum

class ErrorType(Enum):
    SYNTAX = "syntax"
    LOGIC = "logic"
    RUNTIME = "runtime"
    PERFORMANCE = "performance"
    SECURITY = "security"

class ErrorSeverity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class CircuitState(Enum):
    CLOSED = "closed"
    SYNTAX_OPEN = "syntax_open"
    LOGIC_OPEN = "logic_open"
    PERMANENTLY_OPEN = "permanently_open"

@dataclass
class ConfidenceComponents:
    historical_success_rate: float = 0.5
    pattern_similarity: float = 0.5
    code_complexity_penalty: float = 1.0
    test_coverage: float = 0.5

@dataclass
class ConfidenceScore:
    overall_confidence: float
    syntax_confidence: float
    logic_confidence: float
    calibration_method: str = "temperature_scaling"
    components: ConfidenceComponents = None

    def __post_init__(self):
        if self.components is None:
            self.components = ConfidenceComponents()

class UnifiedConfidenceScorer:
    """
    Unified confidence scoring system with consistent behavior across languages
    Uses temperature scaling and beta calibration for reliable confidence estimates
    """

    def __init__(self, temperature: float = 1.0, calibration_samples: int = 1000):
        self.temperature = temperature
        self.calibration_samples = calibration_samples
        self.historical_scores: List[Tuple[float, bool]] = []  # (confidence, was_correct)

    def calculate_confidence(self,
                           logits: List[float],
                           error_type: ErrorType,
                           historical_data: Optional[Dict[str, Any]] = None) -> ConfidenceScore:
        """
        Calculate confidence score using unified formula across all languages

        Args:
            logits: Raw model outputs (before softmax)
            error_type: Type of error being addressed
            historical_data: Optional historical performance data

        Returns:
            ConfidenceScore with calibrated confidence values
        """

        # Apply temperature scaling
        scaled_logits = [logit / self.temperature for logit in logits]

        # Calculate probabilities using softmax
        probabilities = self._softmax(scaled_logits)
        max_prob = max(probabilities)

        # Calculate syntax vs logic confidence based on error type
        syntax_confidence = self._calculate_syntax_confidence(probabilities, error_type)
        logic_confidence = self._calculate_logic_confidence(probabilities, error_type)

        # Calculate overall confidence with components
        components = self._calculate_components(probabilities, error_type, historical_data)
        overall_confidence = self._combine_confidences(
            syntax_confidence, logic_confidence, components, error_type
        )

        # Apply beta calibration if we have historical data
        if len(self.historical_scores) >= 10:
            overall_confidence = self._beta_calibrate(overall_confidence)

        return ConfidenceScore(
            overall_confidence=overall_confidence,
            syntax_confidence=syntax_confidence,
            logic_confidence=logic_confidence,
            calibration_method="temperature_scaling" if len(self.historical_scores) < 10 else "beta_calibration",
            components=components
        )

    def _softmax(self, logits: List[float]) -> List[float]:
        """Standard softmax function"""
        exp_logits = [math.exp(logit) for logit in logits]
        sum_exp = sum(exp_logits)
        return [exp_logit / sum_exp for exp_logit in exp_logits]

    def _calculate_syntax_confidence(self, probabilities: List[float], error_type: ErrorType) -> float:
        """Calculate confidence for syntax-related errors (stricter threshold)"""
        max_prob = max(probabilities)

        if error_type == ErrorType.SYNTAX:
            # Syntax errors should be highly confident (>95% typically)
            return min(max_prob * 1.2, 1.0)  # Boost for syntax
        else:
            # For non-syntax errors, use standard probability
            return max_prob

    def _calculate_logic_confidence(self, probabilities: List[float], error_type: ErrorType) -> float:
        """Calculate confidence for logic-related errors (more forgiving)"""
        max_prob = max(probabilities)

        if error_type in [ErrorType.LOGIC, ErrorType.RUNTIME]:
            # Logic errors can have lower confidence but still be acceptable
            return max_prob * 0.9  # Slight penalty for complexity
        else:
            return max_prob

    def _calculate_components(self,
                            probabilities: List[float],
                            error_type: ErrorType,
                            historical_data: Optional[Dict[str, Any]]) -> ConfidenceComponents:
        """Calculate confidence components based on various factors"""

        # Historical success rate
        historical_success = 0.5  # Default neutral
        if historical_data and 'success_rate' in historical_data:
            historical_success = historical_data['success_rate']

        # Pattern similarity (how similar to known successful patterns)
        pattern_similarity = 0.5  # Default neutral
        if historical_data and 'pattern_similarity' in historical_data:
            pattern_similarity = historical_data['pattern_similarity']

        # Code complexity penalty
        complexity_penalty = 1.0
        if historical_data and 'complexity_score' in historical_data:
            complexity = historical_data['complexity_score']
            # Higher complexity reduces confidence
            complexity_penalty = max(0.1, 1.0 - (complexity - 1.0) * 0.1)

        # Test coverage factor
        test_coverage = 0.5
        if historical_data and 'test_coverage' in historical_data:
            test_coverage = historical_data['test_coverage']

        return ConfidenceComponents(
            historical_success_rate=historical_success,
            pattern_similarity=pattern_similarity,
            code_complexity_penalty=complexity_penalty,
            test_coverage=test_coverage
        )

    def _combine_confidences(self,
                           syntax_conf: float,
                           logic_conf: float,
                           components: ConfidenceComponents,
                           error_type: ErrorType) -> float:
        """Combine different confidence factors into overall score"""

        # Base confidence depends on error type
        if error_type == ErrorType.SYNTAX:
            base_confidence = syntax_conf
        elif error_type in [ErrorType.LOGIC, ErrorType.RUNTIME]:
            base_confidence = logic_conf
        else:
            base_confidence = (syntax_conf + logic_conf) / 2

        # Apply component modifiers
        adjusted_confidence = base_confidence
        adjusted_confidence *= components.historical_success_rate
        adjusted_confidence *= components.pattern_similarity
        adjusted_confidence *= components.code_complexity_penalty
        adjusted_confidence *= (0.5 + components.test_coverage * 0.5)  # Test coverage boost

        # Ensure bounds
        return max(0.0, min(1.0, adjusted_confidence))

    def _beta_calibrate(self, confidence: float) -> float:
        """Apply beta calibration using historical data"""
        if len(self.historical_scores) < 10:
            return confidence

        # Simple beta calibration based on historical performance
        correct_predictions = sum(1 for _, was_correct in self.historical_scores if was_correct)
        total_predictions = len(self.historical_scores)

        if total_predictions == 0:
            return confidence

        empirical_rate = correct_predictions / total_predictions

        # Adjust confidence towards empirical rate
        calibrated = confidence * 0.7 + empirical_rate * 0.3
        return calibrated

    def record_outcome(self, confidence: float, was_correct: bool):
        """Record the outcome of a confidence prediction for calibration"""
        self.historical_scores.append((confidence, was_correct))

        # Keep only recent samples for calibration
        if len(self.historical_scores) > self.calibration_samples:
            self.historical_scores.pop(0)

    def should_attempt_fix(self, confidence_score: ConfidenceScore, error_type: ErrorType) -> bool:
        """
        Determine if we should attempt a fix based on confidence and error type

        Returns True if confidence meets the threshold for the error type
        """

        if error_type == ErrorType.SYNTAX:
            # Syntax errors need very high confidence (>95%)
            return confidence_score.syntax_confidence >= 0.95
        elif error_type in [ErrorType.LOGIC, ErrorType.RUNTIME]:
            # Logic errors can proceed with lower confidence (>80%)
            return confidence_score.logic_confidence >= 0.80
        else:
            # Other errors use overall confidence (>85%)
            return confidence_score.overall_confidence >= 0.85

class DualCircuitBreaker:
    """
    Dual circuit breaker system with different tolerances for syntax vs logic errors
    """

    def __init__(self,
                 syntax_max_attempts: int = 3,
                 logic_max_attempts: int = 10,
                 syntax_error_budget: float = 0.03,  # 3%
                 logic_error_budget: float = 0.10):  # 10%

        self.syntax_max_attempts = syntax_max_attempts
        self.logic_max_attempts = logic_max_attempts
        self.syntax_error_budget = syntax_error_budget
        self.logic_error_budget = logic_error_budget

        self.reset()

    def reset(self):
        """Reset circuit breaker state"""
        self.syntax_attempts = 0
        self.logic_attempts = 0
        self.total_attempts = 0
        self.syntax_errors = 0
        self.logic_errors = 0
        self.circuit_state = CircuitState.CLOSED
        self.last_attempt_time = None

    def can_attempt(self, error_type: ErrorType) -> Tuple[bool, str]:
        """
        Check if we can attempt a fix based on circuit breaker state

        Returns: (can_attempt, reason)
        """

        if self.circuit_state == CircuitState.PERMANENTLY_OPEN:
            return False, "Circuit breaker permanently open"

        if error_type == ErrorType.SYNTAX:
            if self.circuit_state == CircuitState.SYNTAX_OPEN:
                return False, "Syntax circuit breaker open"
            if self.syntax_attempts >= self.syntax_max_attempts:
                return False, f"Syntax attempts exceeded ({self.syntax_attempts}/{self.syntax_max_attempts})"
            if self.syntax_errors / max(1, self.syntax_attempts) > self.syntax_error_budget:
                return False, f"Syntax error rate exceeded budget ({self.syntax_errors}/{self.syntax_attempts})"

        elif error_type in [ErrorType.LOGIC, ErrorType.RUNTIME]:
            if self.circuit_state == CircuitState.LOGIC_OPEN:
                return False, "Logic circuit breaker open"
            if self.logic_attempts >= self.logic_max_attempts:
                return False, f"Logic attempts exceeded ({self.logic_attempts}/{self.logic_max_attempts})"
            if self.logic_errors / max(1, self.logic_attempts) > self.logic_error_budget:
                return False, f"Logic error rate exceeded budget ({self.logic_errors}/{self.logic_attempts})"

        return True, "OK"

    def record_attempt(self, error_type: ErrorType, success: bool):
        """Record the outcome of an attempt"""

        self.total_attempts += 1
        self.last_attempt_time = "current_timestamp"  # Would be actual timestamp

        if error_type == ErrorType.SYNTAX:
            self.syntax_attempts += 1
            if not success:
                self.syntax_errors += 1

                # Check if we should open syntax circuit
                error_rate = self.syntax_errors / self.syntax_attempts
                if error_rate > self.syntax_error_budget or self.syntax_attempts >= self.syntax_max_attempts:
                    self.circuit_state = CircuitState.SYNTAX_OPEN

        elif error_type in [ErrorType.LOGIC, ErrorType.RUNTIME]:
            self.logic_attempts += 1
            if not success:
                self.logic_errors += 1

                # Check if we should open logic circuit
                error_rate = self.logic_errors / self.logic_attempts
                if error_rate > self.logic_error_budget or self.logic_attempts >= self.logic_max_attempts:
                    self.circuit_state = CircuitState.LOGIC_OPEN

        # If both circuits are open, permanently open
        if (self.circuit_state == CircuitState.SYNTAX_OPEN and
            self.logic_attempts >= self.logic_max_attempts):
            self.circuit_state = CircuitState.PERMANENTLY_OPEN

    def get_state_summary(self) -> Dict[str, Any]:
        """Get current circuit breaker state summary"""
        return {
            "circuit_state": self.circuit_state.value,
            "syntax_attempts": self.syntax_attempts,
            "logic_attempts": self.logic_attempts,
            "total_attempts": self.total_attempts,
            "syntax_errors": self.syntax_errors,
            "logic_errors": self.logic_errors,
            "syntax_error_rate": self.syntax_errors / max(1, self.syntax_attempts),
            "logic_error_rate": self.logic_errors / max(1, self.logic_attempts)
        }