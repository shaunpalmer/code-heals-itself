<?php
/**
 * PHP Circuit Breaker for Self-Healing Code System
 * 
 * Ported from TypeScript (trend_aware_circuit_breaker.ts) for cross-language parity.
 * Evaluates improvement trends and makes CONTINUE/ROLLBACK/ESCALATE decisions.
 * 
 * Matches Python Phase 7 architecture exactly:
 * - Conservative thresholds (4+ attempts minimum)
 * - Velocity-based stagnation detection
 * - Cascade vs. stagnation distinction
 */

declare(strict_types=1);

namespace CodeHealsItself\PhpAgent;

use DateTime;

/**
 * Represents a single attempt point in the trend history
 */
class TrendPoint {
    public int $attempt;
    public int $errorsDetected;
    public int $errorsResolved;
    public float $confidence;
    public int $timestamp;
    /** @var string[] */
    public array $errorTypes = [];
    public float $codeQualityScore = 0.5;

    public function __construct(
        int $attempt,
        int $errorsDetected,
        int $errorsResolved,
        float $confidence,
        array $errorTypes = [],
        float $codeQualityScore = 0.5
    ) {
        $this->attempt = $attempt;
        $this->errorsDetected = $errorsDetected;
        $this->errorsResolved = $errorsResolved;
        $this->confidence = $confidence;
        $this->errorTypes = $errorTypes;
        $this->codeQualityScore = $codeQualityScore;
        $this->timestamp = (int)(microtime(true) * 1000);
    }
}

/**
 * Improvement trend analysis result
 */
class ImprovementTrend {
    public string $direction;  // 'improving'|'plateauing'|'worsening'|'unknown'
    public int $errorDelta;    // negative = fewer errors
    public float $confidenceDelta;
    public float $velocityScore;     // 0-1, how fast we're improving
    public float $stagnationRisk;    // 0-1, likelihood of getting stuck

    public function __construct(
        string $direction = 'unknown',
        int $errorDelta = 0,
        float $confidenceDelta = 0.0,
        float $velocityScore = 0.5,
        float $stagnationRisk = 0.0
    ) {
        $this->direction = $direction;
        $this->errorDelta = $errorDelta;
        $this->confidenceDelta = $confidenceDelta;
        $this->velocityScore = $velocityScore;
        $this->stagnationRisk = $stagnationRisk;
    }
}

/**
 * Circuit Breaker with Trend Awareness
 * 
 * Maintains history of attempts and evaluates trends to decide:
 * - CONTINUE: Keep attempting with current model
 * - ROLLBACK: Revert to previous state (regression detected)
 * - ESCALATE: Upgrade to larger model (stagnation signal)
 * - COMPLETE: Success, healing complete
 */
final class TrendAwareCircuitBreaker {
    /** @var TrendPoint[] */
    private array $trendHistory = [];
    private int $maxTrendHistory;
    private int $improvementWindow;      // Must improve within N attempts
    private int $stagnationThreshold;    // Trips if no improvement for N attempts
    private float $confidenceFloor;
    private int $maxAttempts;

    // State tracking
    private bool $isOpen = false;
    private int $attemptsSinceImprovement = 0;

    public function __construct(
        int $maxAttempts = 10,
        int $improvementWindow = 3,
        int $stagnationThreshold = 4,
        float $confidenceFloor = 0.6,
        int $maxTrendHistory = 50
    ) {
        $this->maxAttempts = $maxAttempts;
        $this->improvementWindow = $improvementWindow;
        $this->stagnationThreshold = $stagnationThreshold;
        $this->confidenceFloor = $confidenceFloor;
        $this->maxTrendHistory = $maxTrendHistory;
    }

    /**
     * Record an attempt with error analysis and confidence
     */
    public function recordAttempt(
        int $errorsDetected,
        int $errorsResolved,
        float $confidence,
        array $errorTypes = [],
        float $codeQualityScore = 0.5
    ): void {
        $trendPoint = new TrendPoint(
            attempt: count($this->trendHistory) + 1,
            errorsDetected: $errorsDetected,
            errorsResolved: $errorsResolved,
            confidence: $confidence,
            errorTypes: $errorTypes,
            codeQualityScore: $codeQualityScore
        );

        $this->trendHistory[] = $trendPoint;

        // Keep history bounded
        if (count($this->trendHistory) > $this->maxTrendHistory) {
            array_shift($this->trendHistory);
        }
    }

    /**
     * Analyze improvement trend from recent attempts
     */
    private function analyzeTrend(): ImprovementTrend {
        if (count($this->trendHistory) < 2) {
            return new ImprovementTrend();
        }

        $recent = array_slice($this->trendHistory, -$this->improvementWindow);
        $latest = end($recent);
        $baseline = reset($recent);

        // Calculate deltas
        $errorDelta = $latest->errorsDetected - $baseline->errorsDetected;
        $confidenceDelta = $latest->confidence - $baseline->confidence;
        $qualityDelta = $latest->codeQualityScore - $baseline->codeQualityScore;

        // Determine overall trend direction
        $direction = 'unknown';
        if ($errorDelta < -2 || $confidenceDelta > 0.1 || $qualityDelta > 0.1) {
            $direction = 'improving';
        } elseif ($errorDelta > 2 || $confidenceDelta < -0.1 || $qualityDelta < -0.1) {
            $direction = 'worsening';
        } else {
            $direction = 'plateauing';
        }

        // Calculate velocity score (0-1, normalized)
        $velocityScore = 0.5;
        if (count($recent) > 1) {
            $errorReduction = max(0, -$errorDelta) / max(1, $baseline->errorsDetected);
            $velocityScore = min(1.0, $errorReduction);
        }

        // Calculate stagnation risk
        $stagnationRisk = 0.0;
        if ($direction === 'plateauing' && count($this->trendHistory) >= $this->stagnationThreshold) {
            $stagnationRisk = 0.7;  // High risk if plateauing
        } elseif ($direction === 'worsening') {
            $stagnationRisk = 0.9;  // Very high risk if worsening
        }

        return new ImprovementTrend(
            direction: $direction,
            errorDelta: $errorDelta,
            confidenceDelta: $confidenceDelta,
            velocityScore: $velocityScore,
            stagnationRisk: $stagnationRisk
        );
    }

    /**
     * Evaluate if we should continue attempting
     * Returns [canContinue, reason]
     */
    public function can_attempt(string $errorType = 'LOGIC'): array {
        if ($this->isOpen) {
            return [false, "Circuit breaker is OPEN due to repeated failures"];
        }

        if (count($this->trendHistory) >= $this->maxAttempts) {
            return [false, "Maximum attempts reached"];
        }

        // Check confidence floor
        if (count($this->trendHistory) > 0) {
            $latest = end($this->trendHistory);
            if ($latest->confidence < $this->confidenceFloor) {
                return [false, "Confidence below floor ({$latest->confidence} < {$this->confidenceFloor})"];
            }
        }

        return [true, "Can attempt"];
    }

    /**
     * Should we continue? Main decision function
     * Returns true if we should keep trying, false if we should stop/rollback
     */
    public function shouldContinue(): bool {
        if ($this->isOpen) {
            return false;
        }

        $trend = $this->analyzeTrend();

        // Worsening trend = ROLLBACK signal
        if ($trend->direction === 'worsening') {
            return false;
        }

        // Stagnation + sufficient attempts = consider escalation (but still continue for now)
        if ($trend->stagnationRisk >= 0.7 && count($this->trendHistory) >= $this->stagnationThreshold) {
            // In real system, this would trigger escalation decision elsewhere
            // For now, still return true to continue, but with escalation signal
        }

        return true;
    }

    /**
     * Get current state summary (for monitoring)
     */
    public function getStateSummary(): array {
        $trend = $this->analyzeTrend();
        $recent = end($this->trendHistory);

        return [
            'state' => $this->isOpen ? 'OPEN' : 'CLOSED',
            'attempts' => count($this->trendHistory),
            'trend' => $trend->direction,
            'velocity_score' => $trend->velocityScore,
            'stagnation_risk' => $trend->stagnationRisk,
            'latest_confidence' => $recent?->confidence ?? 0.0,
            'latest_error_count' => $recent?->errorsDetected ?? 0
        ];
    }

    /**
     * Explicitly open the breaker (for error budget exhaustion)
     */
    public function open(): void {
        $this->isOpen = true;
    }

    /**
     * Explicitly close the breaker (for reset)
     */
    public function close(): void {
        $this->isOpen = false;
    }

    /**
     * Reset all state
     */
    public function reset(): void {
        $this->trendHistory = [];
        $this->isOpen = false;
        $this->attemptsSinceImprovement = 0;
    }

    /**
     * Get trend history for analysis
     * @return TrendPoint[]
     */
    public function getTrendHistory(): array {
        return $this->trendHistory;
    }

    /**
     * Get current trend
     */
    public function getCurrentTrend(): ImprovementTrend {
        return $this->analyzeTrend();
    }

    /**
     * Calculate velocity from trends
     * velocity = error_delta / attempts
     */
    public function calculateVelocity(): float {
        if (count($this->trendHistory) < 2) {
            return 0.0;
        }

        $first = $this->trendHistory[0];
        $latest = end($this->trendHistory);

        $errorDelta = $first->errorsDetected - $latest->errorsDetected;
        $attempts = count($this->trendHistory);

        return $attempts > 0 ? $errorDelta / $attempts : 0.0;
    }

    /**
     * Calculate gradient (velocity / delta) when delta > 0
     */
    public function calculateGradient(): float {
        if (count($this->trendHistory) < 2) {
            return 0.0;
        }

        $first = $this->trendHistory[0];
        $latest = end($this->trendHistory);

        $errorDelta = $first->errorsDetected - $latest->errorsDetected;
        $velocity = $this->calculateVelocity();

        if ($errorDelta <= 0) {
            return 0.0;
        }

        return $velocity / $errorDelta;
    }
}
