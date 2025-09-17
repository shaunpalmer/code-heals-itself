<?php

/**
 * Unified Confidence Scoring System for Self-Healing Code
 * Provides consistent confidence scoring across all languages with error classification
 */

class ErrorType {
    const SYNTAX = "syntax";
    const LOGIC = "logic";
    const RUNTIME = "runtime";
    const PERFORMANCE = "performance";
    const SECURITY = "security";
}

class ErrorSeverity {
    const CRITICAL = "critical";
    const HIGH = "high";
    const MEDIUM = "medium";
    const LOW = "low";
}

class CircuitState {
    const CLOSED = "closed";
    const SYNTAX_OPEN = "syntax_open";
    const LOGIC_OPEN = "logic_open";
    const PERMANENTLY_OPEN = "permanently_open";
}

class ConfidenceComponents {
    public float $historical_success_rate;
    public float $pattern_similarity;
    public float $code_complexity_penalty;
    public float $test_coverage;

    public function __construct(
        float $historical_success_rate = 0.5,
        float $pattern_similarity = 0.5,
        float $code_complexity_penalty = 1.0,
        float $test_coverage = 0.5
    ) {
        $this->historical_success_rate = $historical_success_rate;
        $this->pattern_similarity = $pattern_similarity;
        $this->code_complexity_penalty = $code_complexity_penalty;
        $this->test_coverage = $test_coverage;
    }
}

class ConfidenceScore {
    public float $overall_confidence;
    public float $syntax_confidence;
    public float $logic_confidence;
    public string $calibration_method;
    public ConfidenceComponents $components;

    public function __construct(
        float $overall_confidence,
        float $syntax_confidence,
        float $logic_confidence,
        string $calibration_method = "temperature_scaling",
        ?ConfidenceComponents $components = null
    ) {
        $this->overall_confidence = $overall_confidence;
        $this->syntax_confidence = $syntax_confidence;
        $this->logic_confidence = $logic_confidence;
        $this->calibration_method = $calibration_method;
        $this->components = $components ?? new ConfidenceComponents();
    }
}

class UnifiedConfidenceScorer {
    /**
     * Unified confidence scoring system with consistent behavior across languages
     * Uses temperature scaling and beta calibration for reliable confidence estimates
     */

    private float $temperature;
    private int $calibration_samples;
    private array $historical_scores; // Array of [confidence, was_correct] pairs

    public function __construct(float $temperature = 1.0, int $calibration_samples = 1000) {
        $this->temperature = $temperature;
        $this->calibration_samples = $calibration_samples;
        $this->historical_scores = [];
    }

    public function calculate_confidence(
        array $logits,
        string $error_type,
        ?array $historical_data = null
    ): ConfidenceScore {
        /**
         * Calculate confidence score using unified formula across all languages
         *
         * @param array $logits Raw model outputs (before softmax)
         * @param string $error_type Type of error being addressed
         * @param array|null $historical_data Optional historical performance data
         * @return ConfidenceScore
         */

        // Apply temperature scaling
        $scaled_logits = array_map(function($logit) {
            return $logit / $this->temperature;
        }, $logits);

        // Calculate probabilities using softmax
        $probabilities = $this->softmax($scaled_logits);
        $max_prob = max($probabilities);

        // Calculate syntax vs logic confidence based on error type
        $syntax_confidence = $this->calculate_syntax_confidence($probabilities, $error_type);
        $logic_confidence = $this->calculate_logic_confidence($probabilities, $error_type);

        // Calculate overall confidence with components
        $components = $this->calculate_components($probabilities, $error_type, $historical_data);
        $overall_confidence = $this->combine_confidences(
            $syntax_confidence, $logic_confidence, $components, $error_type
        );

        // Apply beta calibration if we have historical data
        if (count($this->historical_scores) >= 10) {
            $calibrated_confidence = $this->beta_calibrate($overall_confidence);
            return new ConfidenceScore(
                $calibrated_confidence,
                $syntax_confidence,
                $logic_confidence,
                "beta_calibration",
                $components
            );
        }

        return new ConfidenceScore(
            $overall_confidence,
            $syntax_confidence,
            $logic_confidence,
            "temperature_scaling",
            $components
        );
    }

    private function softmax(array $logits): array {
        /** Standard softmax function */
        $exp_logits = array_map('exp', $logits);
        $sum_exp = array_sum($exp_logits);
        return array_map(function($exp_logit) use ($sum_exp) {
            return $exp_logit / $sum_exp;
        }, $exp_logits);
    }

    private function calculate_syntax_confidence(array $probabilities, string $error_type): float {
        /** Calculate confidence for syntax-related errors (stricter threshold) */
        $max_prob = max($probabilities);

        if ($error_type === ErrorType::SYNTAX) {
            // Syntax errors should be highly confident (>95% typically)
            return min($max_prob * 1.2, 1.0); // Boost for syntax
        } else {
            // For non-syntax errors, use standard probability
            return $max_prob;
        }
    }

    private function calculate_logic_confidence(array $probabilities, string $error_type): float {
        /** Calculate confidence for logic-related errors (more forgiving) */
        $max_prob = max($probabilities);

        if (in_array($error_type, [ErrorType::LOGIC, ErrorType::RUNTIME])) {
            // Logic errors can have lower confidence but still be acceptable
            return $max_prob * 0.9; // Slight penalty for complexity
        } else {
            return $max_prob;
        }
    }

    private function calculate_components(
        array $probabilities,
        string $error_type,
        ?array $historical_data
    ): ConfidenceComponents {
        /** Calculate confidence components based on various factors */

        // Historical success rate
        $historical_success = 0.5; // Default neutral
        if ($historical_data && isset($historical_data['success_rate'])) {
            $historical_success = $historical_data['success_rate'];
        }

        // Pattern similarity (how similar to known successful patterns)
        $pattern_similarity = 0.5; // Default neutral
        if ($historical_data && isset($historical_data['pattern_similarity'])) {
            $pattern_similarity = $historical_data['pattern_similarity'];
        }

        // Code complexity penalty
        $complexity_penalty = 1.0;
        if ($historical_data && isset($historical_data['complexity_score'])) {
            $complexity = $historical_data['complexity_score'];
            // Higher complexity reduces confidence
            $complexity_penalty = max(0.1, 1.0 - ($complexity - 1.0) * 0.1);
        }

        // Test coverage factor
        $test_coverage = 0.5;
        if ($historical_data && isset($historical_data['test_coverage'])) {
            $test_coverage = $historical_data['test_coverage'];
        }

        return new ConfidenceComponents(
            $historical_success,
            $pattern_similarity,
            $complexity_penalty,
            $test_coverage
        );
    }

    private function combine_confidences(
        float $syntax_conf,
        float $logic_conf,
        ConfidenceComponents $components,
        string $error_type
    ): float {
        /** Combine different confidence factors into overall score */

        // Base confidence depends on error type
        if ($error_type === ErrorType::SYNTAX) {
            $base_confidence = $syntax_conf;
        } elseif (in_array($error_type, [ErrorType::LOGIC, ErrorType::RUNTIME])) {
            $base_confidence = $logic_conf;
        } else {
            $base_confidence = ($syntax_conf + $logic_conf) / 2;
        }

        // Apply component modifiers
        $adjusted_confidence = $base_confidence;
        $adjusted_confidence *= $components->historical_success_rate;
        $adjusted_confidence *= $components->pattern_similarity;
        $adjusted_confidence *= $components->code_complexity_penalty;
        $adjusted_confidence *= (0.5 + $components->test_coverage * 0.5); // Test coverage boost

        // Ensure bounds
        return max(0.0, min(1.0, $adjusted_confidence));
    }

    private function beta_calibrate(float $confidence): float {
        /** Apply beta calibration using historical data */
        if (count($this->historical_scores) < 10) {
            return $confidence;
        }

        // Simple beta calibration based on historical performance
        $correct_predictions = count(array_filter($this->historical_scores, function($pair) {
            return $pair[1]; // was_correct
        }));
        $total_predictions = count($this->historical_scores);

        if ($total_predictions === 0) {
            return $confidence;
        }

        $empirical_rate = $correct_predictions / $total_predictions;

        // Adjust confidence towards empirical rate
        $calibrated = $confidence * 0.7 + $empirical_rate * 0.3;
        return $calibrated;
    }

    public function record_outcome(float $confidence, bool $was_correct): void {
        /** Record the outcome of a confidence prediction for calibration */
        $this->historical_scores[] = [$confidence, $was_correct];

        // Keep only recent samples for calibration
        if (count($this->historical_scores) > $this->calibration_samples) {
            array_shift($this->historical_scores);
        }
    }

    public function should_attempt_fix(ConfidenceScore $confidence_score, string $error_type): bool {
        /**
         * Determine if we should attempt a fix based on confidence and error type
         *
         * Returns true if confidence meets the threshold for the error type
         */

        if ($error_type === ErrorType::SYNTAX) {
            // Syntax errors need very high confidence (>95%)
            return $confidence_score->syntax_confidence >= 0.95;
        } elseif (in_array($error_type, [ErrorType::LOGIC, ErrorType::RUNTIME])) {
            // Logic errors can proceed with lower confidence (>80%)
            return $confidence_score->logic_confidence >= 0.80;
        } else {
            // Other errors use overall confidence (>85%)
            return $confidence_score->overall_confidence >= 0.85;
        }
    }
}

class DualCircuitBreaker {
    /**
     * Dual circuit breaker system with different tolerances for syntax vs logic errors
     */

    private int $syntax_max_attempts;
    private int $logic_max_attempts;
    private float $syntax_error_budget;
    private float $logic_error_budget;

    private int $syntax_attempts;
    private int $logic_attempts;
    private int $total_attempts;
    private int $syntax_errors;
    private int $logic_errors;
    private string $circuit_state;
    private ?string $last_attempt_time;

    public function __construct(
        int $syntax_max_attempts = 3,
        int $logic_max_attempts = 10,
        float $syntax_error_budget = 0.03, // 3%
        float $logic_error_budget = 0.10   // 10%
    ) {
        $this->syntax_max_attempts = $syntax_max_attempts;
        $this->logic_max_attempts = $logic_max_attempts;
        $this->syntax_error_budget = $syntax_error_budget;
        $this->logic_error_budget = $logic_error_budget;

        $this->reset();
    }

    public function reset(): void {
        /** Reset circuit breaker state */
        $this->syntax_attempts = 0;
        $this->logic_attempts = 0;
        $this->total_attempts = 0;
        $this->syntax_errors = 0;
        $this->logic_errors = 0;
        $this->circuit_state = CircuitState::CLOSED;
        $this->last_attempt_time = null;
    }

    public function can_attempt(string $error_type): array {
        /**
         * Check if we can attempt a fix based on circuit breaker state
         *
         * Returns: [can_attempt, reason]
         */

        if ($this->circuit_state === CircuitState::PERMANENTLY_OPEN) {
            return [false, "Circuit breaker permanently open"];
        }

        if ($error_type === ErrorType::SYNTAX) {
            if ($this->circuit_state === CircuitState::SYNTAX_OPEN) {
                return [false, "Syntax circuit breaker open"];
            }
            if ($this->syntax_attempts >= $this->syntax_max_attempts) {
                return [false, "Syntax attempts exceeded ({$this->syntax_attempts}/{$this->syntax_max_attempts})"];
            }
            if ($this->syntax_errors / max(1, $this->syntax_attempts) > $this->syntax_error_budget) {
                return [false, "Syntax error rate exceeded budget ({$this->syntax_errors}/{$this->syntax_attempts})"];
            }

        } elseif (in_array($error_type, [ErrorType::LOGIC, ErrorType::RUNTIME])) {
            if ($this->circuit_state === CircuitState::LOGIC_OPEN) {
                return [false, "Logic circuit breaker open"];
            }
            if ($this->logic_attempts >= $this->logic_max_attempts) {
                return [false, "Logic attempts exceeded ({$this->logic_attempts}/{$this->logic_max_attempts})"];
            }
            if ($this->logic_errors / max(1, $this->logic_attempts) > $this->logic_error_budget) {
                return [false, "Logic error rate exceeded budget ({$this->logic_errors}/{$this->logic_attempts})"];
            }
        }

        return [true, "OK"];
    }

    public function record_attempt(string $error_type, bool $success): void {
        /** Record the outcome of an attempt */

        $this->total_attempts += 1;
        $this->last_attempt_time = date('c'); // ISO 8601 timestamp

        if ($error_type === ErrorType::SYNTAX) {
            $this->syntax_attempts += 1;
            if (!$success) {
                $this->syntax_errors += 1;

                // Check if we should open syntax circuit
                $error_rate = $this->syntax_errors / $this->syntax_attempts;
                if ($error_rate > $this->syntax_error_budget || $this->syntax_attempts >= $this->syntax_max_attempts) {
                    $this->circuit_state = CircuitState::SYNTAX_OPEN;
                }
            }

        } elseif (in_array($error_type, [ErrorType::LOGIC, ErrorType::RUNTIME])) {
            $this->logic_attempts += 1;
            if (!$success) {
                $this->logic_errors += 1;

                // Check if we should open logic circuit
                $error_rate = $this->logic_errors / $this->logic_attempts;
                if ($error_rate > $this->logic_error_budget || $this->logic_attempts >= $this->logic_max_attempts) {
                    $this->circuit_state = CircuitState::LOGIC_OPEN;
                }
            }
        }

        // If both circuits are open, permanently open
        if ($this->circuit_state === CircuitState::SYNTAX_OPEN &&
            $this->logic_attempts >= $this->logic_max_attempts) {
            $this->circuit_state = CircuitState::PERMANENTLY_OPEN;
        }
    }

    public function get_state_summary(): array {
        /** Get current circuit breaker state summary */
        return [
            'circuit_state' => $this->circuit_state,
            'syntax_attempts' => $this->syntax_attempts,
            'logic_attempts' => $this->logic_attempts,
            'total_attempts' => $this->total_attempts,
            'syntax_errors' => $this->syntax_errors,
            'logic_errors' => $this->logic_errors,
            'syntax_error_rate' => $this->syntax_errors / max(1, $this->syntax_attempts),
            'logic_error_rate' => $this->logic_errors / max(1, $this->logic_attempts)
        ];
    }
}

?>