"use strict";
/**
 * Unified Confidence Scoring System for Self-Healing Code
 * Provides consistent confidence scoring across all languages with error classification
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DualCircuitBreaker = exports.UnifiedConfidenceScorer = exports.ConfidenceScore = exports.ConfidenceComponents = exports.CircuitState = exports.ErrorSeverity = exports.ErrorType = void 0;
var ErrorType;
(function (ErrorType) {
    ErrorType["SYNTAX"] = "syntax";
    ErrorType["LOGIC"] = "logic";
    ErrorType["RUNTIME"] = "runtime";
    ErrorType["PERFORMANCE"] = "performance";
    ErrorType["SECURITY"] = "security";
})(ErrorType || (exports.ErrorType = ErrorType = {}));
var ErrorSeverity;
(function (ErrorSeverity) {
    ErrorSeverity["CRITICAL"] = "critical";
    ErrorSeverity["HIGH"] = "high";
    ErrorSeverity["MEDIUM"] = "medium";
    ErrorSeverity["LOW"] = "low";
})(ErrorSeverity || (exports.ErrorSeverity = ErrorSeverity = {}));
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "closed";
    CircuitState["SYNTAX_OPEN"] = "syntax_open";
    CircuitState["LOGIC_OPEN"] = "logic_open";
    CircuitState["PERMANENTLY_OPEN"] = "permanently_open";
})(CircuitState || (exports.CircuitState = CircuitState = {}));
var ConfidenceComponents = /** @class */ (function () {
    function ConfidenceComponents(historical_success_rate, pattern_similarity, code_complexity_penalty, test_coverage) {
        if (historical_success_rate === void 0) { historical_success_rate = 0.5; }
        if (pattern_similarity === void 0) { pattern_similarity = 0.5; }
        if (code_complexity_penalty === void 0) { code_complexity_penalty = 1.0; }
        if (test_coverage === void 0) { test_coverage = 0.5; }
        this.historical_success_rate = historical_success_rate;
        this.pattern_similarity = pattern_similarity;
        this.code_complexity_penalty = code_complexity_penalty;
        this.test_coverage = test_coverage;
    }
    return ConfidenceComponents;
}());
exports.ConfidenceComponents = ConfidenceComponents;
var ConfidenceScore = /** @class */ (function () {
    function ConfidenceScore(overall_confidence, syntax_confidence, logic_confidence, calibration_method, components) {
        if (calibration_method === void 0) { calibration_method = "temperature_scaling"; }
        if (components === void 0) { components = new ConfidenceComponents(); }
        this.overall_confidence = overall_confidence;
        this.syntax_confidence = syntax_confidence;
        this.logic_confidence = logic_confidence;
        this.calibration_method = calibration_method;
        this.components = components;
    }
    return ConfidenceScore;
}());
exports.ConfidenceScore = ConfidenceScore;
var UnifiedConfidenceScorer = /** @class */ (function () {
    function UnifiedConfidenceScorer(temperature, calibration_samples) {
        if (temperature === void 0) { temperature = 1.0; }
        if (calibration_samples === void 0) { calibration_samples = 1000; }
        this.temperature = temperature;
        this.calibration_samples = calibration_samples;
        this.historical_scores = [];
    }
    UnifiedConfidenceScorer.prototype.calculate_confidence = function (logits, error_type, historical_data) {
        /**
         * Calculate confidence score using unified formula across all languages
         *
         * @param logits Raw model outputs (before softmax)
         * @param error_type Type of error being addressed
         * @param historical_data Optional historical performance data
         * @returns ConfidenceScore
         */
        var _this = this;
        if (historical_data === void 0) { historical_data = null; }
        // Apply temperature scaling
        var scaled_logits = logits.map(function (logit) { return logit / _this.temperature; });
        // Calculate probabilities using softmax
        var probabilities = this._softmax(scaled_logits);
        var max_prob = Math.max.apply(Math, probabilities);
        // Calculate syntax vs logic confidence based on error type
        var syntax_confidence = this._calculate_syntax_confidence(probabilities, error_type);
        var logic_confidence = this._calculate_logic_confidence(probabilities, error_type);
        // Calculate overall confidence with components
        var components = this._calculate_components(probabilities, error_type, historical_data);
        var overall_confidence = this._combine_confidences(syntax_confidence, logic_confidence, components, error_type);
        // Apply beta calibration if we have historical data
        if (this.historical_scores.length >= 10) {
            var calibrated_confidence = this._beta_calibrate(overall_confidence);
            return new ConfidenceScore(calibrated_confidence, syntax_confidence, logic_confidence, "beta_calibration", components);
        }
        return new ConfidenceScore(overall_confidence, syntax_confidence, logic_confidence, "temperature_scaling", components);
    };
    UnifiedConfidenceScorer.prototype._softmax = function (logits) {
        /** Standard softmax function */
        var exp_logits = logits.map(function (logit) { return Math.exp(logit); });
        var sum_exp = exp_logits.reduce(function (a, b) { return a + b; }, 0);
        return exp_logits.map(function (exp_logit) { return exp_logit / sum_exp; });
    };
    UnifiedConfidenceScorer.prototype._calculate_syntax_confidence = function (probabilities, error_type) {
        /** Calculate confidence for syntax-related errors (stricter threshold) */
        var max_prob = Math.max.apply(Math, probabilities);
        if (error_type === ErrorType.SYNTAX) {
            // Syntax errors should be highly confident (>95% typically)
            return Math.min(max_prob * 1.2, 1.0); // Boost for syntax
        }
        else {
            // For non-syntax errors, use standard probability
            return max_prob;
        }
    };
    UnifiedConfidenceScorer.prototype._calculate_logic_confidence = function (probabilities, error_type) {
        /** Calculate confidence for logic-related errors (more forgiving) */
        var max_prob = Math.max.apply(Math, probabilities);
        if ([ErrorType.LOGIC, ErrorType.RUNTIME].includes(error_type)) {
            // Logic errors can have lower confidence but still be acceptable
            return max_prob * 0.9; // Slight penalty for complexity
        }
        else {
            return max_prob;
        }
    };
    UnifiedConfidenceScorer.prototype._calculate_components = function (probabilities, error_type, historical_data) {
        /** Calculate confidence components based on various factors */
        // Historical success rate
        var historical_success = 0.5; // Default neutral
        if (historical_data && historical_data.success_rate !== undefined) {
            historical_success = historical_data.success_rate;
        }
        // Pattern similarity (how similar to known successful patterns)
        var pattern_similarity = 0.5; // Default neutral
        if (historical_data && historical_data.pattern_similarity !== undefined) {
            pattern_similarity = historical_data.pattern_similarity;
        }
        // Code complexity penalty
        var complexity_penalty = 1.0;
        if (historical_data && historical_data.complexity_score !== undefined) {
            var complexity = historical_data.complexity_score;
            // Higher complexity reduces confidence
            complexity_penalty = Math.max(0.1, 1.0 - (complexity - 1.0) * 0.1);
        }
        // Test coverage factor
        var test_coverage = 0.5;
        if (historical_data && historical_data.test_coverage !== undefined) {
            test_coverage = historical_data.test_coverage;
        }
        return new ConfidenceComponents(historical_success, pattern_similarity, complexity_penalty, test_coverage);
    };
    UnifiedConfidenceScorer.prototype._combine_confidences = function (syntax_conf, logic_conf, components, error_type) {
        /** Combine different confidence factors into overall score */
        // Base confidence depends on error type
        var base_confidence;
        if (error_type === ErrorType.SYNTAX) {
            base_confidence = syntax_conf;
        }
        else if ([ErrorType.LOGIC, ErrorType.RUNTIME].includes(error_type)) {
            base_confidence = logic_conf;
        }
        else {
            base_confidence = (syntax_conf + logic_conf) / 2;
        }
        // Apply component modifiers
        var adjusted_confidence = base_confidence;
        adjusted_confidence *= components.historical_success_rate;
        adjusted_confidence *= components.pattern_similarity;
        adjusted_confidence *= components.code_complexity_penalty;
        adjusted_confidence *= (0.5 + components.test_coverage * 0.5); // Test coverage boost
        // Ensure bounds
        return Math.max(0.0, Math.min(1.0, adjusted_confidence));
    };
    UnifiedConfidenceScorer.prototype._beta_calibrate = function (confidence) {
        /** Apply beta calibration using historical data */
        if (this.historical_scores.length < 10) {
            return confidence;
        }
        // Simple beta calibration based on historical performance
        var correct_predictions = this.historical_scores
            .filter(function (_a) {
            var was_correct = _a[1];
            return was_correct;
        })
            .length;
        var total_predictions = this.historical_scores.length;
        if (total_predictions === 0) {
            return confidence;
        }
        var empirical_rate = correct_predictions / total_predictions;
        // Adjust confidence towards empirical rate
        var calibrated = confidence * 0.7 + empirical_rate * 0.3;
        return calibrated;
    };
    UnifiedConfidenceScorer.prototype.record_outcome = function (confidence, was_correct) {
        /** Record the outcome of a confidence prediction for calibration */
        this.historical_scores.push([confidence, was_correct]);
        // Keep only recent samples for calibration
        if (this.historical_scores.length > this.calibration_samples) {
            this.historical_scores.shift();
        }
    };
    UnifiedConfidenceScorer.prototype.should_attempt_fix = function (confidence_score, error_type) {
        /**
         * Determine if we should attempt a fix based on confidence and error type
         *
         * Returns true if confidence meets the threshold for the error type
         */
        if (error_type === ErrorType.SYNTAX) {
            // Syntax errors need very high confidence (>95%)
            return confidence_score.syntax_confidence >= 0.95;
        }
        else if ([ErrorType.LOGIC, ErrorType.RUNTIME].includes(error_type)) {
            // Logic errors can proceed with lower confidence (>80%)
            return confidence_score.logic_confidence >= 0.80;
        }
        else {
            // Other errors use overall confidence (>85%)
            return confidence_score.overall_confidence >= 0.85;
        }
    };
    return UnifiedConfidenceScorer;
}());
exports.UnifiedConfidenceScorer = UnifiedConfidenceScorer;
var DualCircuitBreaker = /** @class */ (function () {
    function DualCircuitBreaker(syntax_max_attempts, logic_max_attempts, syntax_error_budget, // 3%
    logic_error_budget // 10%
    ) {
        if (syntax_max_attempts === void 0) { syntax_max_attempts = 3; }
        if (logic_max_attempts === void 0) { logic_max_attempts = 10; }
        if (syntax_error_budget === void 0) { syntax_error_budget = 0.03; }
        if (logic_error_budget === void 0) { logic_error_budget = 0.10; }
        this.syntax_attempts = 0;
        this.logic_attempts = 0;
        this.total_attempts = 0;
        this.syntax_errors = 0;
        this.logic_errors = 0;
        this.circuit_state = CircuitState.CLOSED;
        this.last_attempt_time = null;
        this.syntax_max_attempts = syntax_max_attempts;
        this.logic_max_attempts = logic_max_attempts;
        this.syntax_error_budget = syntax_error_budget;
        this.logic_error_budget = logic_error_budget;
        this.reset();
    }
    DualCircuitBreaker.prototype.reset = function () {
        /** Reset circuit breaker state */
        this.syntax_attempts = 0;
        this.logic_attempts = 0;
        this.total_attempts = 0;
        this.syntax_errors = 0;
        this.logic_errors = 0;
        this.circuit_state = CircuitState.CLOSED;
        this.last_attempt_time = null;
    };
    DualCircuitBreaker.prototype.can_attempt = function (error_type) {
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
                return [false, "Syntax attempts exceeded (".concat(this.syntax_attempts, "/").concat(this.syntax_max_attempts, ")")];
            }
            if (this.syntax_errors / Math.max(1, this.syntax_attempts) > this.syntax_error_budget) {
                return [false, "Syntax error rate exceeded budget (".concat(this.syntax_errors, "/").concat(this.syntax_attempts, ")")];
            }
        }
        else if ([ErrorType.LOGIC, ErrorType.RUNTIME].includes(error_type)) {
            if (this.circuit_state === CircuitState.LOGIC_OPEN) {
                return [false, "Logic circuit breaker open"];
            }
            if (this.logic_attempts >= this.logic_max_attempts) {
                return [false, "Logic attempts exceeded (".concat(this.logic_attempts, "/").concat(this.logic_max_attempts, ")")];
            }
            if (this.logic_errors / Math.max(1, this.logic_attempts) > this.logic_error_budget) {
                return [false, "Logic error rate exceeded budget (".concat(this.logic_errors, "/").concat(this.logic_attempts, ")")];
            }
        }
        return [true, "OK"];
    };
    DualCircuitBreaker.prototype.record_attempt = function (error_type, success) {
        /** Record the outcome of an attempt */
        this.total_attempts += 1;
        this.last_attempt_time = new Date().toISOString();
        if (error_type === ErrorType.SYNTAX) {
            this.syntax_attempts += 1;
            if (!success) {
                this.syntax_errors += 1;
                // Check if we should open syntax circuit
                var error_rate = this.syntax_errors / this.syntax_attempts;
                if (error_rate > this.syntax_error_budget || this.syntax_attempts >= this.syntax_max_attempts) {
                    this.circuit_state = CircuitState.SYNTAX_OPEN;
                }
            }
        }
        else if ([ErrorType.LOGIC, ErrorType.RUNTIME].includes(error_type)) {
            this.logic_attempts += 1;
            if (!success) {
                this.logic_errors += 1;
                // Check if we should open logic circuit
                var error_rate = this.logic_errors / this.logic_attempts;
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
    };
    DualCircuitBreaker.prototype.get_state_summary = function () {
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
    };
    return DualCircuitBreaker;
}());
exports.DualCircuitBreaker = DualCircuitBreaker;
