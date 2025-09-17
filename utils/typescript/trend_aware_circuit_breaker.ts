import { ErrorType } from './confidence_scoring';

interface TrendPoint {
  attempt: number;
  errorsDetected: number;
  errorsResolved: number;
  confidence: number;
  timestamp: number;
  errorTypes: ErrorType[];
  codeQualityScore: number; // 0-1 scale
}

interface ImprovementTrend {
  direction: 'improving' | 'plateauing' | 'worsening' | 'unknown';
  errorDelta: number; // negative = fewer errors
  confidenceDelta: number; // positive = more confident
  velocityScore: number; // how fast we're improving (0-1)
  stagnationRisk: number; // how likely we are to get stuck (0-1)
}

export class TrendAwareCircuitBreaker {
  private trendHistory: TrendPoint[] = [];
  private maxTrendHistory: number;
  private improvementWindow: number; // must improve within N attempts
  private stagnationThreshold: number; // trips if no improvement for N attempts
  private confidenceFloor: number;
  private maxAttempts: number;

  constructor(
    maxAttempts: number = 10,
    improvementWindow: number = 3,
    stagnationThreshold: number = 5,
    confidenceFloor: number = 0.6,
    maxTrendHistory: number = 50
  ) {
    this.maxAttempts = maxAttempts;
    this.improvementWindow = improvementWindow;
    this.stagnationThreshold = stagnationThreshold;
    this.confidenceFloor = confidenceFloor;
    this.maxTrendHistory = maxTrendHistory;
  }

  /**
   * Record an attempt with its error analysis and confidence
   */
  recordAttempt(
    errorsDetected: number,
    errorsResolved: number,
    confidence: number,
    errorTypes: ErrorType[],
    codeQualityScore: number = 0.5
  ): void {
    const trendPoint: TrendPoint = {
      attempt: this.trendHistory.length + 1,
      errorsDetected,
      errorsResolved,
      confidence,
      timestamp: Date.now(),
      errorTypes,
      codeQualityScore
    };

    this.trendHistory.push(trendPoint);

    // Keep history bounded
    if (this.trendHistory.length > this.maxTrendHistory) {
      this.trendHistory.shift();
    }
  }

  /**
   * Analyze improvement trend from recent attempts
   */
  private analyzeTrend(): ImprovementTrend {
    if (this.trendHistory.length < 2) {
      return {
        direction: 'unknown',
        errorDelta: 0,
        confidenceDelta: 0,
        velocityScore: 0.5,
        stagnationRisk: 0
      };
    }

    const recent = this.trendHistory.slice(-this.improvementWindow);
    const latest = recent[recent.length - 1];
    const baseline = recent[0];

    // Calculate deltas
    const errorDelta = latest.errorsDetected - baseline.errorsDetected;
    const confidenceDelta = latest.confidence - baseline.confidence;
    const qualityDelta = latest.codeQualityScore - baseline.codeQualityScore;

    // Determine overall trend direction
    let direction: ImprovementTrend['direction'] = 'unknown';
    if (errorDelta < -2 || confidenceDelta > 0.1 || qualityDelta > 0.1) {
      direction = 'improving';
    } else if (errorDelta > 2 || confidenceDelta < -0.1 || qualityDelta < -0.1) {
      direction = 'worsening';
    } else {
      direction = 'plateauing';
    }

    // Calculate velocity (how fast we're improving)
    const attemptSpan = latest.attempt - baseline.attempt;
    const velocityScore = Math.max(0, Math.min(1,
      (confidenceDelta * 2 + Math.abs(errorDelta) * 0.1 + qualityDelta) / attemptSpan
    ));

    // Calculate stagnation risk
    const stagnationRisk = this.calculateStagnationRisk();

    return {
      direction,
      errorDelta,
      confidenceDelta,
      velocityScore,
      stagnationRisk
    };
  }

  /**
   * Calculate risk of getting stuck in local minimum
   */
  private calculateStagnationRisk(): number {
    if (this.trendHistory.length < this.stagnationThreshold) {
      return 0;
    }

    const recentAttempts = this.trendHistory.slice(-this.stagnationThreshold);

    // Check if error counts are plateauing
    const errorCounts = recentAttempts.map(t => t.errorsDetected);
    const errorVariance = this.calculateVariance(errorCounts);

    // Check if confidence is plateauing  
    const confidences = recentAttempts.map(t => t.confidence);
    const confidenceVariance = this.calculateVariance(confidences);

    // Low variance = high stagnation risk
    const stagnationRisk = 1 - Math.min(1, (errorVariance + confidenceVariance) / 2);

    return stagnationRisk;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  /**
   * Decide whether to allow another attempt based on trend analysis
   */
  canAttempt(): [boolean, string, ImprovementTrend] {
    const currentAttempt = this.trendHistory.length;

    // Hard limit check
    if (currentAttempt >= this.maxAttempts) {
      const trend = this.analyzeTrend();
      return [false, `Maximum attempts reached (${currentAttempt}/${this.maxAttempts})`, trend];
    }

    // Need at least one attempt to analyze
    if (currentAttempt === 0) {
      const trend = this.analyzeTrend();
      return [true, "Initial attempt allowed", trend];
    }

    const trend = this.analyzeTrend();
    const latest = this.trendHistory[this.trendHistory.length - 1];

    // Check confidence floor, but allow if trend is improving to avoid premature stop
    if (latest.confidence < this.confidenceFloor && currentAttempt > 2 && trend.direction !== 'improving') {
      return [false, `Confidence below floor (${latest.confidence.toFixed(2)} < ${this.confidenceFloor})`, trend];
    }

    // Trend-based decisions
    switch (trend.direction) {
      case 'improving':
        // Keep going if we're making progress
        return [true, `Trend improving (errors: ${trend.errorDelta}, confidence: +${trend.confidenceDelta.toFixed(2)})`, trend];

      case 'worsening':
        // Stop if things are getting worse
        if (currentAttempt > 2) {
          return [false, `Trend worsening (errors: +${Math.abs(trend.errorDelta)}, confidence: ${trend.confidenceDelta.toFixed(2)})`, trend];
        } else {
          // Allow early attempts even if worsening (exploration phase)
          return [true, "Early exploration phase - allowing worsening trend", trend];
        }

      case 'plateauing':
        // Check stagnation risk
        if (trend.stagnationRisk > 0.7) {
          return [false, `High stagnation risk (${(trend.stagnationRisk * 100).toFixed(0)}%) - likely stuck in local minimum`, trend];
        } else {
          return [true, `Plateauing but low stagnation risk (${(trend.stagnationRisk * 100).toFixed(0)}%)`, trend];
        }

      default:
        // Unknown trend - be conservative but allow some attempts
        return [currentAttempt < 3, "Unknown trend - limited attempts allowed", trend];
    }
  }

  /**
   * Get current trend summary for debugging/logging
   */
  getTrendSummary(): {
    totalAttempts: number;
    trend: ImprovementTrend;
    recentHistory: TrendPoint[];
    recommendation: 'continue' | 'rollback' | 'try_different_strategy' | 'promote';
  } {
    const trend = this.analyzeTrend();
    const [canContinue, reason] = this.canAttempt();

    let recommendation: 'continue' | 'rollback' | 'try_different_strategy' | 'promote';

    // Prefer promotion when thresholds are met
    if (this.shouldPromote()) {
      recommendation = 'promote';
    } else if (trend.direction === 'improving' && canContinue) {
      recommendation = 'continue';
    } else if (trend.direction === 'worsening') {
      recommendation = 'rollback';
    } else if (trend.stagnationRisk > 0.7) {
      recommendation = 'try_different_strategy';
    } else {
      recommendation = 'rollback';
    }

    return {
      totalAttempts: this.trendHistory.length,
      trend,
      recentHistory: this.trendHistory.slice(-5), // Last 5 attempts
      recommendation
    };
  }

  /**
   * Reset the circuit breaker state
   */
  reset(): void {
    this.trendHistory = [];
  }

  /**
   * Check if we should promote the current solution
   */
  shouldPromote(): boolean {
    if (this.trendHistory.length === 0) return false;

    const latest = this.trendHistory[this.trendHistory.length - 1];
    const trend = this.analyzeTrend();

    return (
      latest.confidence > 0.8 &&
      latest.errorsDetected <= 2 &&
      trend.direction !== 'worsening'
    );
  }
}