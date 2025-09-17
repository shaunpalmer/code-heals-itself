/**
 * Unified Confidence Scoring System for Self-Healing Code
 * Provides consistent confidence scoring across all languages with error classification
 */

class ErrorType {
  static SYNTAX = "syntax";
  static LOGIC = "logic";
  static RUNTIME = "runtime";
  static PERFORMANCE = "performance";
  static SECURITY = "security";
}

class ErrorSeverity {
  static CRITICAL = "critical";
  static HIGH = "high";
  static MEDIUM = "medium";
  static LOW = "low";
}

class CircuitState {
  static CLOSED = "closed";
  static SYNTAX_OPEN = "syntax_open";
  static LOGIC_OPEN = "logic_open";
  static PERMANENTLY_OPEN = "permanently_open";
}

class ConfidenceComponents {
  constructor(
    historical_success_rate = 0.5,
    pattern_similarity = 0.5,
    code_complexity_penalty = 1.0,
    test_coverage = 0.5
  ) {
    this.historical_success_rate = historical_success_rate;
    this.pattern_similarity = pattern_similarity;
    this.code_complexity_penalty = code_complexity_penalty;
    this.test_coverage = test_coverage;
  }
}

class ConfidenceScore {
  constructor(
    overall_confidence,
    syntax_confidence,
    logic_confidence,
    calibration_method = "temperature_scaling",
    components = null
  ) {
    this.overall_confidence = overall_confidence;
    this.syntax_confidence = syntax_confidence;
    this.logic_confidence = logic_confidence;
    this.calibration_method = calibration_method;
    this.components = components || new ConfidenceComponents();
  }
}

class UnifiedConfidenceScorer {
  /**
   * Unified confidence scoring system with consistent behavior across languages
   * Uses temperature scaling and beta calibration for reliable confidence estimates
   */

  constructor(temperature = 1.0, calibration_samples = 1000) {
    this.temperature = temperature;
    this.calibration_samples = calibration_samples;
    this.historical_scores = []; // Array of [confidence, was_correct] pairs
  }

  calculate_confidence(logits, error_type, historical_data = null) {
    /**
     * Calculate confidence score using unified formula across all languages
     *
     * @param {Array<number>} logits - Raw model outputs (before softmax)
     * @param {string} error_type - Type of error being addressed
     * @param {Object} historical_data - Optional historical performance data
     * @returns {ConfidenceScore}
     */

    // Apply temperature scaling
    const scaled_logits = logits.map(logit => logit / this.temperature);

    // Calculate probabilities using softmax
    const probabilities = this._softmax(scaled_logits);
    const max_prob = Math.max(...probabilities);

    // Calculate syntax vs logic confidence based on error type
    const syntax_confidence = this._calculate_syntax_confidence(probabilities, error_type);
    const logic_confidence = this._calculate_logic_confidence(probabilities, error_type);

    // Calculate overall confidence with components
    const components = this._calculate_components(probabilities, error_type, historical_data);
    const overall_confidence = this._combine_confidences(
      syntax_confidence, logic_confidence, components, error_type
    );

    // Apply beta calibration if we have historical data
    if (this.historical_scores.length >= 10) {
      const calibrated_confidence = this._beta_calibrate(overall_confidence);
      return new ConfidenceScore(
        calibrated_confidence,
        syntax_confidence,
        logic_confidence,
        "beta_calibration",
        components
      );
    }

    return new ConfidenceScore(
      overall_confidence,
      syntax_confidence,
      logic_confidence,
      "temperature_scaling",
      components
    );
  }

  _softmax(logits) {
    /** Standard softmax function */
    const exp_logits = logits.map(logit => Math.exp(logit));
    const sum_exp = exp_logits.reduce((a, b) => a + b, 0);
    return exp_logits.map(exp_logit => exp_logit / sum_exp);
  }

  _calculate_syntax_confidence(probabilities, error_type) {
    /** Calculate confidence for syntax-related errors (stricter threshold) */
    const max_prob = Math.max(...probabilities);

    if (error_type === ErrorType.SYNTAX) {
      // Syntax errors should be highly confident (>95% typically)
      return Math.min(max_prob * 1.2, 1.0); // Boost for syntax
    } else {
      // For non-syntax errors, use standard probability
      return max_prob;
    }
  }

  _calculate_logic_confidence(probabilities, error_type) {
    /** Calculate confidence for logic-related errors (more forgiving) */
    const max_prob = Math.max(...probabilities);

    if ([ErrorType.LOGIC, ErrorType.RUNTIME].includes(error_type)) {
      // Logic errors can have lower confidence but still be acceptable
      return max_prob * 0.9; // Slight penalty for complexity
    } else {
      return max_prob;
    }
  }

  _calculate_components(probabilities, error_type, historical_data) {
    /** Calculate confidence components based on various factors */

    // Historical success rate
    let historical_success = 0.5; // Default neutral
    if (historical_data && historical_data.success_rate !== undefined) {
      historical_success = historical_data.success_rate;
    }

    // Pattern similarity (how similar to known successful patterns)
    let pattern_similarity = 0.5; // Default neutral
    if (historical_data && historical_data.pattern_similarity !== undefined) {
      pattern_similarity = historical_data.pattern_similarity;
    }

    // Code complexity penalty
    let complexity_penalty = 1.0;
    if (historical_data && historical_data.complexity_score !== undefined) {
      const complexity = historical_data.complexity_score;
      // Higher complexity reduces confidence
      complexity_penalty = Math.max(0.1, 1.0 - (complexity - 1.0) * 0.1);
    }

    // Test coverage factor
    let test_coverage = 0.5;
    if (historical_data && historical_data.test_coverage !== undefined) {
      test_coverage = historical_data.test_coverage;
    }

    return new ConfidenceComponents(
      historical_success,
      pattern_similarity,
      complexity_penalty,
      test_coverage
    );
  }

  _combine_confidences(syntax_conf, logic_conf, components, error_type) {
    /** Combine different confidence factors into overall score */

    // Base confidence depends on error type
    let base_confidence;
    if (error_type === ErrorType.SYNTAX) {
      base_confidence = syntax_conf;
    } else if ([ErrorType.LOGIC, ErrorType.RUNTIME].includes(error_type)) {
      base_confidence = logic_conf;
    } else {
      base_confidence = (syntax_conf + logic_conf) / 2;
    }

    // Apply component modifiers
    let adjusted_confidence = base_confidence;
    adjusted_confidence *= components.historical_success_rate;
    adjusted_confidence *= components.pattern_similarity;
    adjusted_confidence *= components.code_complexity_penalty;
    adjusted_confidence *= (0.5 + components.test_coverage * 0.5); // Test coverage boost

    // Ensure bounds
    return Math.max(0.0, Math.min(1.0, adjusted_confidence));
  }

  _beta_calibrate(confidence) {
    /** Apply beta calibration using historical data */
    if (this.historical_scores.length < 10) {
      return confidence;
    }

    // Simple beta calibration based on historical performance
    const correct_predictions = this.historical_scores
      .filter(([, was_correct]) => was_correct)
      .length;
    const total_predictions = this.historical_scores.length;

    if (total_predictions === 0) {
      return confidence;
    }

    const empirical_rate = correct_predictions / total_predictions;

    // Adjust confidence towards empirical rate
    const calibrated = confidence * 0.7 + empirical_rate * 0.3;
    return calibrated;
  }

  record_outcome(confidence, was_correct) {
    /** Record the outcome of a confidence prediction for calibration */
    this.historical_scores.push([confidence, was_correct]);

    // Keep only recent samples for calibration
    if (this.historical_scores.length > this.calibration_samples) {
      this.historical_scores.shift();
    }
  }

  should_attempt_fix(confidence_score, error_type) {
    /**
     * Determine if we should attempt a fix based on confidence and error type
     *
     * Returns true if confidence meets the threshold for the error type
     */

    if (error_type === ErrorType.SYNTAX) {
      // Syntax errors need very high confidence (>95%)
      return confidence_score.syntax_confidence >= 0.95;
    } else if ([ErrorType.LOGIC, ErrorType.RUNTIME].includes(error_type)) {
      // Logic errors can proceed with lower confidence (>80%)
      return confidence_score.logic_confidence >= 0.80;
    } else {
      // Other errors use overall confidence (>85%)
      return confidence_score.overall_confidence >= 0.85;
    }
  }
}

class DualCircuitBreaker {
  /**
   * Dual circuit breaker system with different tolerances for syntax vs logic errors
   */

  constructor(
    syntax_max_attempts = 3,
    logic_max_attempts = 10,
    syntax_error_budget = 0.03, // 3%
    logic_error_budget = 0.10   // 10%
  ) {
    this.syntax_max_attempts = syntax_max_attempts;
    this.logic_max_attempts = logic_max_attempts;
    this.syntax_error_budget = syntax_error_budget;
    this.logic_error_budget = logic_error_budget;

    this.reset();
  }

  reset() {
    /** Reset circuit breaker state */
    this.syntax_attempts = 0;
    this.logic_attempts = 0;
    this.total_attempts = 0;
    this.syntax_errors = 0;
    this.logic_errors = 0;
    this.circuit_state = CircuitState.CLOSED;
    this.last_attempt_time = null;
  }

  can_attempt(error_type) {
    /**
     * Check if we can attempt a fix based on circuit breaker state
     *
     * Returns: [can_attempt, reason]
     */

    if (this.circuit_state === CircuitState.PERMANENTLY_OPEN) {
      return [false, "Circuit breaker permanently open"];
    }

    if (error_type === ErrorType.SYNTAX) {
      if (this.circuit_state === CircuitState.SYNTAX_OPEN) {
        return [false, "Syntax circuit breaker open"];
      }
      if (this.syntax_attempts >= this.syntax_max_attempts) {
        return [false, `Syntax attempts exceeded (${this.syntax_attempts}/${this.syntax_max_attempts})`];
      }
      if (this.syntax_errors / Math.max(1, this.syntax_attempts) > this.syntax_error_budget) {
        return [false, `Syntax error rate exceeded budget (${this.syntax_errors}/${this.syntax_attempts})`];
      }

    } else if ([ErrorType.LOGIC, ErrorType.RUNTIME].includes(error_type)) {
      if (this.circuit_state === CircuitState.LOGIC_OPEN) {
        return [false, "Logic circuit breaker open"];
      }
      if (this.logic_attempts >= this.logic_max_attempts) {
        return [false, `Logic attempts exceeded (${this.logic_attempts}/${this.logic_max_attempts})`];
      }
      if (this.logic_errors / Math.max(1, this.logic_attempts) > this.logic_error_budget) {
        return [false, `Logic error rate exceeded budget (${this.logic_errors}/${self.logic_attempts})`];
      }
    }

    return [true, "OK"];
  }

  record_attempt(error_type, success) {
    /** Record the outcome of an attempt */

    this.total_attempts += 1;
    this.last_attempt_time = new Date().toISOString(); // Actual timestamp

    if (error_type === ErrorType.SYNTAX) {
      this.syntax_attempts += 1;
      if (!success) {
        this.syntax_errors += 1;

        // Check if we should open syntax circuit
        const error_rate = this.syntax_errors / this.syntax_attempts;
        if (error_rate > this.syntax_error_budget || this.syntax_attempts >= this.syntax_max_attempts) {
          this.circuit_state = CircuitState.SYNTAX_OPEN;
        }
      }

    } else if ([ErrorType.LOGIC, ErrorType.RUNTIME].includes(error_type)) {
      this.logic_attempts += 1;
      if (!success) {
        this.logic_errors += 1;

        // Check if we should open logic circuit
        const error_rate = this.logic_errors / this.logic_attempts;
        if (error_rate > this.logic_error_budget || this.logic_attempts >= this.logic_max_attempts) {
          this.circuit_state = CircuitState.LOGIC_OPEN;
        }
      }
    }

    // If both circuits are open, permanently open
    if (this.circuit_state === CircuitState.SYNTAX_OPEN &&
      this.logic_attempts >= this.logic_max_attempts) {
      this.circuit_state = CircuitState.PERMANENTLY_OPEN;
    }
  }

  get_state_summary() {
    /** Get current circuit breaker state summary */
    return {
      circuit_state: this.circuit_state,
      syntax_attempts: this.syntax_attempts,
      logic_attempts: this.logic_attempts,
      total_attempts: this.total_attempts,
      syntax_errors: this.syntax_errors,
      logic_errors: this.logic_errors,
      syntax_error_rate: this.syntax_errors / Math.max(1, this.syntax_attempts),
      logic_error_rate: this.logic_errors / Math.max(1, this.logic_attempts)
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ErrorType,
    ErrorSeverity,
    CircuitState,
    ConfidenceComponents,
    ConfidenceScore,
    UnifiedConfidenceScorer,
    DualCircuitBreaker
  };
}