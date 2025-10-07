/**
 * Unified Confidence Scoring System for Self-Healing Code
 * Provides consistent confidence scoring across all languages with error classification
 */

enum ErrorType {
  SYNTAX = "syntax",
  LOGIC = "logic",
  RUNTIME = "runtime",
  PERFORMANCE = "performance",
  SECURITY = "security"
}

enum ErrorSeverity {
  CRITICAL = "critical",
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low"
}

enum CircuitState {
  CLOSED = "closed",
  SYNTAX_OPEN = "syntax_open",
  LOGIC_OPEN = "logic_open",
  PERMANENTLY_OPEN = "permanently_open"
}

class ConfidenceComponents {
  constructor(
    public historical_success_rate: number = 0.5,
    public pattern_similarity: number = 0.5,
    public code_complexity_penalty: number = 1.0,
    public test_coverage: number = 0.5
  ) { }
}

class ConfidenceScore {
  constructor(
    public overall_confidence: number,
    public syntax_confidence: number,
    public logic_confidence: number,
    public calibration_method: string = "temperature_scaling",
    public components: ConfidenceComponents = new ConfidenceComponents()
  ) { }
}

class UnifiedConfidenceScorer {
  /**
   * Unified confidence scoring system with consistent behavior across languages
   * Uses temperature scaling and beta calibration for reliable confidence estimates
   */

  private temperature: number;
  private calibration_samples: number;
  private historical_scores: Array<[number, boolean]>; // [confidence, was_correct] pairs

  constructor(temperature: number = 1.0, calibration_samples: number = 1000) {
    this.temperature = temperature;
    this.calibration_samples = calibration_samples;
    this.historical_scores = [];
  }

  calculate_confidence(
    logits: number[],
    error_type: ErrorType,
    historical_data: Record<string, any> | null = null,
    taxonomyDifficulty: number | null = null
  ): ConfidenceScore {
    /**
     * Calculate confidence score using unified formula across all languages
     *
     * @param logits Raw model outputs (before softmax)
     * @param error_type Type of error being addressed
     * @param historical_data Optional historical performance data
     * @param taxonomyDifficulty Optional difficulty score from taxonomy (0.0-1.0)
     *                          If provided, used for complexity penalty calculation
     * @returns ConfidenceScore
     */

    // Apply temperature scaling
    const scaled_logits = logits.map(logit => logit / this.temperature);

    // Calculate probabilities using softmax
    const probabilities = this._softmax(scaled_logits);
    const max_prob = Math.max(...probabilities);

    // Calculate syntax vs logic confidence based on error type
    const syntax_confidence = this._calculate_syntax_confidence(probabilities, error_type);
    const logic_confidence = this._calculate_logic_confidence(probabilities, error_type);

    // Calculate overall confidence with components (pass taxonomy difficulty if available)
    const components = this._calculate_components(probabilities, error_type, historical_data, taxonomyDifficulty);
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

  private _softmax(logits: number[]): number[] {
    /** Standard softmax function */
    const exp_logits = logits.map(logit => Math.exp(logit));
    const sum_exp = exp_logits.reduce((a, b) => a + b, 0);
    return exp_logits.map(exp_logit => exp_logit / sum_exp);
  }

  private _calculate_syntax_confidence(probabilities: number[], error_type: ErrorType): number {
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

  private _calculate_logic_confidence(probabilities: number[], error_type: ErrorType): number {
    /** Calculate confidence for logic-related errors (more forgiving) */
    const max_prob = Math.max(...probabilities);

    if ([ErrorType.LOGIC, ErrorType.RUNTIME].includes(error_type)) {
      // Logic errors can have lower confidence but still be acceptable
      return max_prob * 0.9; // Slight penalty for complexity
    } else {
      return max_prob;
    }
  }

  private _calculate_components(
    probabilities: number[],
    error_type: ErrorType,
    historical_data: Record<string, any> | null,
    taxonomyDifficulty: number | null = null
  ): ConfidenceComponents {
    /** 
     * Calculate confidence components based on various factors 
     * 
     * @param probabilities Softmax probabilities
     * @param error_type Type of error being addressed
     * @param historical_data Optional historical performance data
     * @param taxonomyDifficulty Optional difficulty score from taxonomy (0.0-1.0)
     */

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

    // Taxonomy-aware complexity: use taxonomy difficulty if available
    if (taxonomyDifficulty !== null) {
      // Taxonomy difficulty is 0.0-1.0 scale where higher = harder
      // Convert to penalty: easy errors (0.0) have minimal penalty, hard errors (1.0) have max penalty
      complexity_penalty = Math.max(0.1, 1.0 - taxonomyDifficulty * 0.5);
    } else if (historical_data && historical_data.complexity_score !== undefined) {
      // Fallback to historical complexity score
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

  private _combine_confidences(
    syntax_conf: number,
    logic_conf: number,
    components: ConfidenceComponents,
    error_type: ErrorType
  ): number {
    /** Combine different confidence factors into overall score */

    // Base confidence depends on error type
    let base_confidence: number;
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

  private _beta_calibrate(confidence: number): number {
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

  record_outcome(confidence: number, was_correct: boolean): void {
    /** Record the outcome of a confidence prediction for calibration */
    this.historical_scores.push([confidence, was_correct]);

    // Keep only recent samples for calibration
    if (this.historical_scores.length > this.calibration_samples) {
      this.historical_scores.shift();
    }
  }

  should_attempt_fix(confidence_score: ConfidenceScore, error_type: ErrorType): boolean {
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

  private syntax_max_attempts: number;
  private logic_max_attempts: number;
  private syntax_error_budget: number;
  private logic_error_budget: number;

  private syntax_attempts: number = 0;
  private logic_attempts: number = 0;
  private total_attempts: number = 0;
  private syntax_errors: number = 0;
  private logic_errors: number = 0;
  private circuit_state: CircuitState = CircuitState.CLOSED;
  private last_attempt_time: string | null = null;

  // Error delta tracking for trend-aware decisions
  private recent_error_counts: number[] = [];
  private recent_errors_resolved: number[] = [];
  private recent_confidence_scores: number[] = [];
  private recent_error_densities: number[] = []; // errors per 100 lines of code
  private improvement_window: number = 3; // Look at last 3 attempts for trends

  // Strategy tracking
  private current_strategy: "simulation" | "rollback" | "promote" = "simulation";
  private confidence_floor_for_promotion: number = 0.85;

  // Track best observed error count to detect regressions against a known good baseline
  private best_error_count_seen: number | null = null;

  // Cumulative counters (not window-limited) for reporting
  private cumulative_errors_resolved: number = 0;
  // Track consecutive failures to prevent endless loops
  private consecutive_failures: number = 0;

  // Pause/backoff support
  private pausedUntil: number | null = null; // epoch ms
  private pauseReason: string | null = null;

  constructor(
    syntax_max_attempts: number = 3,
    logic_max_attempts: number = 10,
    syntax_error_budget: number = 0.03, // 3%
    logic_error_budget: number = 0.10   // 10%
  ) {
    this.syntax_max_attempts = syntax_max_attempts;
    this.logic_max_attempts = logic_max_attempts;
    this.syntax_error_budget = syntax_error_budget;
    this.logic_error_budget = logic_error_budget;

    this.reset();
  }

  reset(): void {
    /** Reset circuit breaker state */
    this.syntax_attempts = 0;
    this.logic_attempts = 0;
    this.total_attempts = 0;
    this.syntax_errors = 0;
    this.logic_errors = 0;
    this.circuit_state = CircuitState.CLOSED;
    this.last_attempt_time = null;
    this.recent_error_counts = [];
    this.recent_errors_resolved = [];
    this.recent_confidence_scores = [];
    this.recent_error_densities = [];
    this.current_strategy = "simulation";
    this.pausedUntil = null;
    this.pauseReason = null;
    this.best_error_count_seen = null;
    this.cumulative_errors_resolved = 0;
    this.consecutive_failures = 0;
  }

  can_attempt(error_type: ErrorType): [boolean, string] {
    /**
     * Check if we can attempt a fix based on circuit breaker state
     * Now includes trend-aware logic - if errors are decreasing, allow more attempts
     *
     * Returns: [can_attempt, reason]
     */

    if (this.circuit_state === CircuitState.PERMANENTLY_OPEN) {
      return [false, "Circuit breaker permanently open"];
    }

    // Respect pause/backoff window
    if (this.pausedUntil) {
      const now = Date.now();
      if (now < this.pausedUntil) {
        const remaining = this.pausedUntil - now;
        return [false, `Paused${this.pauseReason ? ": " + this.pauseReason : ""} (${Math.max(0, remaining)}ms remaining)`];
      }
      // Auto-resume if pause expired
      this.pausedUntil = null;
      this.pauseReason = null;
    }

    // Check for improvement trend before applying strict limits
    const isImproving = this.isShowingImprovement();
    const improvementBonus = isImproving ? 2 : 0; // Allow 2 extra attempts if improving

    if (error_type === ErrorType.SYNTAX) {
      // Always allow the very first attempt; and grace the immediate retry after first failure
      if (this.syntax_attempts === 0) {
        return [true, "First attempt (grace)"];
      }
      if (this.syntax_attempts === 1) {
        // Even if error budget looks bad (1/1), allow a second attempt so delta can start
        return [true, `First-failure grace (${this.syntax_errors}/${this.syntax_attempts})`];
      }
      if (this.circuit_state === CircuitState.SYNTAX_OPEN && !isImproving) {
        return [false, "Syntax circuit breaker open"];
      }
      const effectiveMaxAttempts = this.syntax_max_attempts + improvementBonus;
      if (this.syntax_attempts >= effectiveMaxAttempts) {
        return [false, `Syntax attempts exceeded (${this.syntax_attempts}/${effectiveMaxAttempts}${isImproving ? ' with improvement bonus' : ''})`];
      }

      // Be more lenient with error budget if we're improving
      const effectiveErrorBudget = isImproving ? this.syntax_error_budget * 1.5 : this.syntax_error_budget;
      // Grace: do not block solely on error rate for the very first attempt
      if (this.syntax_attempts >= 2 && (this.syntax_errors / Math.max(1, this.syntax_attempts) > effectiveErrorBudget)) {
        if (!isImproving) {
          return [false, `Syntax error rate exceeded budget (${this.syntax_errors}/${this.syntax_attempts})`];
        }
        // Still improving, so allow it but warn
        return [true, `Syntax error rate high but improving (${this.syntax_errors}/${this.syntax_attempts})`];
      }

    } else if ([ErrorType.LOGIC, ErrorType.RUNTIME].includes(error_type)) {
      // Always allow the very first attempt; and grace the immediate retry after first failure
      if (this.logic_attempts === 0) {
        return [true, "First attempt (grace)"];
      }
      if (this.logic_attempts === 1) {
        // Even if error budget looks bad (1/1), allow a second attempt so delta can start
        return [true, `First-failure grace (${this.logic_errors}/${this.logic_attempts})`];
      }
      if (this.circuit_state === CircuitState.LOGIC_OPEN && !isImproving) {
        return [false, "Logic circuit breaker open"];
      }
      const effectiveMaxAttempts = this.logic_max_attempts + improvementBonus;
      if (this.logic_attempts >= effectiveMaxAttempts) {
        return [false, `Logic attempts exceeded (${this.logic_attempts}/${effectiveMaxAttempts}${isImproving ? ' with improvement bonus' : ''})`];
      }

      // Be more lenient with error budget if we're improving
      const effectiveErrorBudget = isImproving ? this.logic_error_budget * 1.5 : this.logic_error_budget;
      // Grace: do not block solely on error rate for the very first attempt
      if (this.logic_attempts >= 2 && (this.logic_errors / Math.max(1, this.logic_attempts) > effectiveErrorBudget)) {
        if (!isImproving) {
          return [false, `Logic error rate exceeded budget (${this.logic_errors}/${this.logic_attempts})`];
        }
        // Still improving, so allow it but warn
        return [true, `Logic error rate high but improving (${this.logic_errors}/${this.logic_attempts})`];
      }
    }

    return [true, isImproving ? "OK (improving trend detected)" : "OK"];
  }

  record_attempt(error_type: ErrorType, success: boolean, errorsDetected: number = 0, errorsResolved: number = 0, confidence: number = 0, linesOfCode: number = 100): void {
    /** Record the outcome of an attempt with error delta tracking and envelope metadata */

    this.total_attempts += 1;
    this.last_attempt_time = new Date().toISOString();

    // Track error deltas for trend analysis
    this.recent_error_counts.push(errorsDetected);
    this.recent_errors_resolved.push(errorsResolved);
    this.cumulative_errors_resolved += Math.max(0, errorsResolved);
    this.recent_confidence_scores.push(confidence);
    // Update failure streak
    if (success) {
      this.consecutive_failures = 0;
    } else {
      this.consecutive_failures += 1;
    }

    // Calculate and track error density (errors per 100 lines)
    const errorDensity = linesOfCode > 0 ? (errorsDetected / linesOfCode) * 100 : 0;
    this.recent_error_densities.push(errorDensity);

    // Update best observed error count (baseline) regardless of success flag
    if (this.best_error_count_seen === null) {
      this.best_error_count_seen = errorsDetected;
    } else {
      this.best_error_count_seen = Math.min(this.best_error_count_seen, errorsDetected);
    }

    // Keep only recent data within window
    const windows = [
      this.recent_error_counts,
      this.recent_errors_resolved,
      this.recent_confidence_scores,
      this.recent_error_densities
    ];

    windows.forEach(window => {
      if (window.length > this.improvement_window) {
        window.shift();
      }
    });

    // Update strategy based on trends
    this.updateStrategy();

    if (error_type === ErrorType.SYNTAX) {
      this.syntax_attempts += 1;
      if (!success) {
        this.syntax_errors += 1;

        // Check if we should open syntax circuit - but consider trends and strategy
        const error_rate = this.syntax_errors / this.syntax_attempts;
        const isImproving = this.isShowingImprovement();
        const shouldKeepTrying = this.shouldContinueAttempts();

        // Only open circuit if we exceed budget AND we're not improving AND strategy says stop
        if ((error_rate > this.syntax_error_budget && !isImproving && !shouldKeepTrying) ||
          (this.syntax_attempts >= this.syntax_max_attempts && !isImproving)) {
          this.circuit_state = CircuitState.SYNTAX_OPEN;
        }
      }

    } else if ([ErrorType.LOGIC, ErrorType.RUNTIME].includes(error_type)) {
      this.logic_attempts += 1;
      if (!success) {
        this.logic_errors += 1;

        // Check if we should open logic circuit - but consider trends and strategy
        const error_rate = this.logic_errors / this.logic_attempts;
        const isImproving = this.isShowingImprovement();
        const shouldKeepTrying = this.shouldContinueAttempts();

        // Open circuit if we exceed budget and not improving; no need to also wait for shouldKeepTrying=false
        if ((error_rate > this.logic_error_budget && !isImproving) ||
          (this.logic_attempts >= this.logic_max_attempts && !isImproving)) {
          this.circuit_state = CircuitState.LOGIC_OPEN;
        }
      }
    }

    // If both circuits are open and we're not improving, permanently open
    if (this.circuit_state === CircuitState.SYNTAX_OPEN &&
      this.logic_attempts >= this.logic_max_attempts &&
      !this.isShowingImprovement() &&
      !this.shouldContinueAttempts()) {
      this.circuit_state = CircuitState.PERMANENTLY_OPEN;
    }
  }

  private isShowingImprovement(): boolean {
    /**
     * Determine if we're showing improvement based on error deltas
     * Returns true if recent attempts show decreasing error counts or increasing error resolution
     */

    if (this.recent_error_counts.length < 2) {
      // With only a single attempt recorded, treat explicit errorsResolved as improvement
      const lastResolved = this.recent_errors_resolved.length > 0 ? (this.recent_errors_resolved[this.recent_errors_resolved.length - 1] || 0) : 0;
      return lastResolved > 0;
    }

    // Focus on most recent movement: last vs previous
    const counts = this.recent_error_counts;
    const resolved = this.recent_errors_resolved;

    let recentDeltaImproving = false;
    if (counts.length >= 2) {
      const prev = counts[counts.length - 2];
      const last = counts[counts.length - 1];
      recentDeltaImproving = last < prev; // strictly better in the last step
    }

    // Only treat "resolving errors" as improvement if the last step actually reduced error count
    let lastStepResolvedHelped = false;
    if (resolved.length >= 1 && counts.length >= 2) {
      const lastResolved = resolved[resolved.length - 1] || 0;
      const prev = counts[counts.length - 2];
      const last = counts[counts.length - 1];
      lastStepResolvedHelped = lastResolved > 0 && last < prev;
    }

    // General downward trend across window (first -> last)
    let overallTrend = false;
    if (counts.length >= 3) {
      const first = counts[0];
      const last = counts[counts.length - 1];
      overallTrend = last < first;
    }

    // Improvement requires either a recent decrease, or productive resolution without regression, or overall downward trend
    return recentDeltaImproving || lastStepResolvedHelped || overallTrend;
  }

  private updateStrategy(): void {
    /**
     * Update current strategy based on error trends and confidence
     * This implements the "rollback vs simulation vs promote" decision logic
     */

    if (this.recent_confidence_scores.length === 0) {
      this.current_strategy = "simulation";
      return;
    }

    const latestConfidence = this.recent_confidence_scores[this.recent_confidence_scores.length - 1];
    const isImproving = this.isShowingImprovement();
    const improvementVelocity = this.getImprovementVelocity();

    // High confidence + improving trend = promote to live code
    if (latestConfidence >= this.confidence_floor_for_promotion && isImproving) {
      this.current_strategy = "promote";
    }
    // Declining or stagnant = rollback to known good state
    else if (!isImproving && improvementVelocity < 0) {
      this.current_strategy = "rollback";
    }
    // Default = keep experimenting in sandbox
    else {
      this.current_strategy = "simulation";
    }
  }

  private isOscillating(): boolean {
    // Detect mixed up/down movements in recent error counts indicating wobble
    if (this.recent_error_counts.length < 3) return false;
    let up = false, down = false;
    for (let i = 1; i < this.recent_error_counts.length; i++) {
      if (this.recent_error_counts[i] > this.recent_error_counts[i - 1]) up = true;
      if (this.recent_error_counts[i] < this.recent_error_counts[i - 1]) down = true;
    }
    return up && down;
  }

  private shouldContinueAttempts(): boolean {
    /**
     * Decide if we should continue attempts based on envelope metadata trends
     * This is the core "human debugger" logic you described
     */

    if (this.recent_error_counts.length < 2) {
      return true; // Always try at least twice
    }

    // Check error density trend - are we making the codebase cleaner?
    const densityImproving = this.isErrorDensityImproving();

    // Check confidence trend - are we getting more confident in our fixes?
    const confidenceImproving = this.isConfidenceImproving();

    // Check absolute progress - are we resolving more errors than we create?
    const netPositiveProgress = this.hasNetPositiveProgress();

    // If we're regressing against the best-known state and confidence isn't improving, stop
    if (this.isRegressingAgainstBest() && !confidenceImproving) {
      return false;
    }

    // Hard guard: after a handful of consecutive failures with no clear improvement,
    // stop continuing to avoid endless loops.
    if (this.total_attempts >= 5 && this.consecutive_failures >= 5 && !this.isShowingImprovement()) {
      return false;
    }

    // Continue if ANY of these indicate we're making real progress
    return densityImproving || confidenceImproving || netPositiveProgress;
  }

  private getImprovementVelocity(): number {
    /**
     * Calculate how fast we're improving (positive = getting better)
     */
    if (this.recent_error_counts.length < 2) return 0;

    const first = this.recent_error_counts[0];
    const last = this.recent_error_counts[this.recent_error_counts.length - 1];
    const attempts = this.recent_error_counts.length;

    // Velocity = (errors reduced) / attempts
    return (first - last) / attempts;
  }

  private isErrorDensityImproving(): boolean {
    /**
     * Check if error density (errors per 100 lines) is decreasing
     */
    if (this.recent_error_densities.length < 2 || this.recent_error_counts.length < 2) return false;

    const recentDensity = this.recent_error_densities.slice(-2);
    const densityImproved = recentDensity[1] < recentDensity[0];
    const lastCount = this.recent_error_counts[this.recent_error_counts.length - 1];
    const prevCount = this.recent_error_counts[this.recent_error_counts.length - 2];
    const countImproved = lastCount < prevCount;
    // Only consider density improving if we also matched or beat the best-known error count
    // If regressing vs best, do not say improving
    if (this.isRegressingAgainstBest()) return false;
    const beatsBest = this.best_error_count_seen == null ? true : lastCount <= this.best_error_count_seen;
    return densityImproved && countImproved && beatsBest;
  }

  private isConfidenceImproving(): boolean {
    /**
     * Check if confidence scores are trending upward
     */
    if (this.recent_confidence_scores.length < 2) return false;

    const recent = this.recent_confidence_scores.slice(-2);
    return recent[1] > recent[0]; // Latest > Previous
  }

  private hasNetPositiveProgress(): boolean {
    /**
     * Check if we're resolving more errors than we have remaining
     * This captures the "30→20→10→3" scenario you described
     */
    if (this.recent_errors_resolved.length === 0 || this.recent_error_counts.length < 2) return false;

    // Consider only the recent window to avoid cumulative illusion of progress
    const resolvedWindow = this.recent_errors_resolved.slice(-this.improvement_window);
    const counts = this.recent_error_counts;
    const last = counts[counts.length - 1];
    const prev = counts[counts.length - 2];
    const sumResolved = resolvedWindow.reduce((sum, r) => sum + Math.max(0, r), 0);

    // Credit net positive only if errors are non-increasing recently and the recent
    // resolved total outweighs the remaining errors. This prevents endless retries
    // when counts are flat and patch attempts keep claiming small resolutions.
    const nonIncreasing = last <= prev;
    return nonIncreasing && sumResolved > last;
  }

  private isRegressingAgainstBest(margin: number = 1): boolean {
    if (this.best_error_count_seen === null || this.recent_error_counts.length === 0) return false;
    const last = this.recent_error_counts[this.recent_error_counts.length - 1];
    return last > (this.best_error_count_seen + margin);
  }

  getRecommendedAction(): "continue" | "rollback" | "promote" | "try_different_strategy" {
    /**
     * Get the recommended action based on current trends and envelope metadata
     */

    const isImproving = this.isShowingImprovement();
    const shouldContinue = this.shouldContinueAttempts();
    const latestConfidence = this.recent_confidence_scores.length > 0 ?
      this.recent_confidence_scores[this.recent_confidence_scores.length - 1] : 0;

    // Guard: if we are overall worsening in the recent window (last well above recent min)
    // and confidence is not improving, treat as rollback even if the last step improved slightly.
    let netWorseningGuard = false;
    if (this.recent_error_counts.length >= 3) {
      const counts = this.recent_error_counts;
      const last = counts[counts.length - 1];
      const prev = counts[counts.length - 2];
      const minRecent = Math.min(...counts);
      const conf = this.recent_confidence_scores;
      const confImproving = this.isConfidenceImproving();
      // Threshold: last remains at least 2 errors above the min in window and confidence not improving
      netWorseningGuard = (last - minRecent >= 2) && !confImproving;
    }

    if (latestConfidence >= this.confidence_floor_for_promotion && isImproving) {
      return "promote";
    }

    // Early exploration grace: allow the first couple of attempts to continue
    // so the delta/gradient process can establish a baseline, unless we are
    // clearly regressing against the best-known state.
    if (this.total_attempts <= 2 && !this.isRegressingAgainstBest()) {
      return "continue";
    }

    if (!isImproving && !shouldContinue) {
      return "rollback";
    }

    if (netWorseningGuard && !shouldContinue) {
      return "rollback";
    }

    // Strong guard: if we're regressing compared to the best-known state and not clearly improving, prefer rollback
    if (this.isRegressingAgainstBest() && !isImproving) {
      return "rollback";
    }

    // If we're wobbling (oscillating) or confidence is noisy, suggest a short pause/backoff
    const suggestPause = this.isOscillating() || (!isImproving && this.isConfidenceImproving());
    if (suggestPause) {
      // NOTE: This is a recommendation; caller can invoke pause()
      // We do not change state here to keep decisions explicit.
      return "continue" as any; // will be overridden to pause_and_backoff by wrapper
    }

    if (shouldContinue) {
      return "continue";
    }

    return "try_different_strategy";
  }

  // Pause/backoff API
  pause(ms: number, reason?: string): void {
    this.pausedUntil = Date.now() + Math.max(0, ms);
    this.pauseReason = reason || null;
  }

  resume(): void {
    this.pausedUntil = null;
    this.pauseReason = null;
  }

  is_paused(): boolean {
    return this.pausedUntil !== null && Date.now() < (this.pausedUntil as number);
  }

  get_pause_remaining(): number {
    if (!this.pausedUntil) return 0;
    return Math.max(0, this.pausedUntil - Date.now());
  }

  get_state_summary(): Record<string, any> {
    /** Get current circuit breaker state summary including trend data and envelope-guided decisions */
    const isImproving = this.isShowingImprovement();
    const totalErrorsResolved = this.cumulative_errors_resolved;
    const improvementVelocity = this.getImprovementVelocity();
    const recommendedAction = this.getRecommendedAction();

    // Map internal circuit state to schema-compatible OPEN/CLOSED/HALF_OPEN
    const mapToSchemaState = (s: CircuitState): 'OPEN' | 'CLOSED' | 'HALF_OPEN' => {
      switch (s) {
        case CircuitState.CLOSED: return 'CLOSED';
        case CircuitState.SYNTAX_OPEN:
        case CircuitState.LOGIC_OPEN:
        case CircuitState.PERMANENTLY_OPEN:
          return 'OPEN';
        default: return 'CLOSED';
      }
    };

    const summary = {
      // Original circuit breaker state
      circuit_state: this.circuit_state,
      syntax_attempts: this.syntax_attempts,
      logic_attempts: this.logic_attempts,
      total_attempts: this.total_attempts,
      syntax_errors: this.syntax_errors,
      logic_errors: this.logic_errors,
      syntax_error_rate: this.syntax_errors / Math.max(1, this.syntax_attempts),
      logic_error_rate: this.logic_errors / Math.max(1, this.logic_attempts),
      // Provide a simple failure counter for schema compatibility
      failure_count: this.syntax_errors + this.logic_errors,

      // Envelope-guided trend analysis
      is_improving: isImproving,
      improvement_velocity: improvementVelocity,
      current_strategy: this.current_strategy,
      recommended_action: recommendedAction,

      // Raw trend data
      recent_error_counts: [...this.recent_error_counts],
      recent_errors_resolved: [...this.recent_errors_resolved],
      recent_confidence_scores: [...this.recent_confidence_scores],
      recent_error_densities: [...this.recent_error_densities],
      total_errors_resolved: totalErrorsResolved,

      // Decision factors
      error_density_improving: this.isErrorDensityImproving(),
      confidence_improving: this.isConfidenceImproving(),
      net_positive_progress: this.hasNetPositiveProgress(),
      should_continue_attempts: this.shouldContinueAttempts()
      ,
      // Pause/backoff state
      paused: this.is_paused(),
      pause_reason: this.pauseReason,
      pause_remaining_ms: this.get_pause_remaining(),
      // Baseline tracking
      best_error_count_seen: this.best_error_count_seen,
      consecutive_failures: this.consecutive_failures
    } as any;

    // Backward-compatible and schema-compatible 'state'
    // Tests and the JSON schema expect one of OPEN|CLOSED|HALF_OPEN.
    summary.state = mapToSchemaState(summary.circuit_state);
    return summary;
  }
}

export {
  ErrorType,
  ErrorSeverity,
  CircuitState,
  ConfidenceComponents,
  ConfidenceScore,
  UnifiedConfidenceScorer,
  DualCircuitBreaker
};