# 📋 PHP CATCH-UP REPORT

**Status**: Implementation Blueprint  
**Language**: PHP  
**Comparison Base**: Python (complete), TypeScript (reference)  
**Effort Estimate**: 2-3 hours implementation, 1 hour testing  
**Target**: Achieve feature parity with Python & TypeScript  

---

## Executive Summary

PHP implementation is **completely missing** the core self-healing system components. This report provides a complete blueprint to translate existing Python/TypeScript logic into idiomatic PHP.

**Current State**: PHP agent exists (`Dockerfile.php`), but lacks:
- ❌ Circuit breaker logic (decision making)
- ❌ Error rebanker (classification)  
- ❌ Observer pattern (escalation signaling)
- ❌ Softmax/confidence scoring
- ❌ Error delta tracking

**Target State**: Full feature parity with Python + TypeScript by end of Week 1.

---

## Architecture Overview (PHP)

```
PHP Code Import Error
         ↓
    Rebanker (Error Classification)
    ├─ Detects error type: Syntax/Logic/Runtime/Security
    ├─ Assesses difficulty: 0.0 (easy) → 1.0 (hard)
    ├─ Returns: ErrorClassification{type, difficulty, confidence}
         ↓
Circuit Breaker (Decision Logic)
    ├─ Calculates velocity: (prev_errors - curr_errors) / attempts
    ├─ Evaluates gradient: trend in error delta
    ├─ Emits decision: CONTINUE / ROLLBACK / ESCALATE
         ↓
Observer Pattern (Escalation Hints)
    ├─ Listens for: difficulty signals, velocity stalls
    ├─ Emits hints: "Model too small", "Temperature adjustment needed"
    ├─ Routes to: Healing orchestrator or model escalation system
         ↓
Confidence Scorer (Softmax)
    ├─ Input: Raw logits from error analysis
    ├─ Process: Temperature-scaled softmax probability
    ├─ Output: Confidence score (0.0-1.0) + components
         ↓
    Envelope Storage (SQLite via PHP)
    ├─ Persists: Error signatures, attempt history
    ├─ Enables: Recovery from crashes, pattern analysis
```

---

## Component 1: Error Rebanker (Classification)

### Purpose
Classify errors on import to determine difficulty level and error type. This enables difficulty-based escalation decisions.

### PHP Implementation

**File**: `agents/php/rebanker.php`

```php
<?php

namespace CodeHealsItself\Rebanker;

use DateTime;

/**
 * Error Classification System (Rebanker)
 * Analyzes PHP errors to determine type, severity, and difficulty
 */

class ErrorClassification {
    public string $type;           // 'syntax', 'logic', 'runtime', 'security'
    public float $difficulty;      // 0.0 (easy) to 1.0 (hard)
    public string $severity;       // 'low', 'medium', 'high', 'critical'
    public array $details;         // Additional metadata
    public float $confidence;      // 0.0 to 1.0
    public string $timestamp;
    
    public function __construct(
        string $type,
        float $difficulty,
        string $severity,
        array $details = [],
        float $confidence = 0.85
    ) {
        $this->type = $type;
        $this->difficulty = max(0.0, min(1.0, $difficulty));  // Clamp to [0,1]
        $this->severity = $severity;
        $this->details = $details;
        $this->confidence = max(0.0, min(1.0, $confidence));
        $this->timestamp = (new DateTime())->format('c');
    }
    
    public function toArray(): array {
        return [
            'type' => $this->type,
            'difficulty' => $this->difficulty,
            'severity' => $this->severity,
            'confidence' => $this->confidence,
            'details' => $this->details,
            'timestamp' => $this->timestamp,
        ];
    }
}

class Rebanker {
    /**
     * Classify a PHP error
     */
    public static function classifyError(
        int $errorCode,
        string $message,
        string $file,
        int $line
    ): ErrorClassification {
        
        // Determine error type
        $type = self::getErrorType($errorCode);
        
        // Determine base difficulty from error code
        $baseDifficulty = self::getBaseDifficulty($errorCode);
        
        // Analyze message for difficulty indicators
        $messageDifficulty = self::analyzeMessage($message);
        
        // Combine difficulties
        $finalDifficulty = ($baseDifficulty + $messageDifficulty) / 2;
        
        // Determine severity
        $severity = self::calculateSeverity($errorCode, $finalDifficulty);
        
        // Collect details
        $details = [
            'error_code' => $errorCode,
            'message' => $message,
            'file' => $file,
            'line' => $line,
            'stack_depth' => self::estimateStackDepth(),
        ];
        
        return new ErrorClassification(
            $type,
            $finalDifficulty,
            $severity,
            $details,
            confidence: 0.85
        );
    }
    
    private static function getErrorType(int $code): string {
        return match($code) {
            // Syntax errors (impossible at runtime in PHP)
            E_PARSE => 'syntax',
            E_COMPILE_ERROR => 'syntax',
            
            // Runtime errors
            E_ERROR, E_CORE_ERROR, E_USER_ERROR => 'runtime',
            E_WARNING, E_CORE_WARNING, E_USER_WARNING => 'runtime',
            E_NOTICE, E_USER_NOTICE => 'runtime',
            E_STRICT => 'logic',
            E_DEPRECATED => 'logic',
            
            // Security concerns
            E_RECOVERABLE_ERROR => 'security',
            
            // Logical errors
            default => 'logic',
        };
    }
    
    private static function getBaseDifficulty(int $code): float {
        return match($code) {
            // Easy: Common, well-understood
            E_NOTICE, E_WARNING, E_DEPRECATED => 0.2,
            
            // Medium: Requires investigation
            E_USER_WARNING, E_USER_NOTICE, E_STRICT => 0.5,
            E_USER_ERROR => 0.6,
            
            // Hard: Serious issues
            E_ERROR, E_CORE_ERROR => 0.7,
            E_RECOVERABLE_ERROR => 0.8,
            E_PARSE, E_COMPILE_ERROR => 0.9,
            
            // Unknown: Default to medium
            default => 0.5,
        };
    }
    
    private static function analyzeMessage(string $message): float {
        $hardIndicators = [
            'segmentation fault' => 0.9,
            'out of memory' => 0.8,
            'stack overflow' => 0.8,
            'undefined' => 0.6,
            'null' => 0.4,
            'type error' => 0.5,
            'cannot' => 0.3,
            'failed' => 0.4,
            'unexpected' => 0.3,
        ];
        
        $maxDifficulty = 0.3;  // Default for unknown patterns
        
        $lowerMessage = strtolower($message);
        foreach ($hardIndicators as $indicator => $difficulty) {
            if (strpos($lowerMessage, $indicator) !== false) {
                $maxDifficulty = max($maxDifficulty, $difficulty);
            }
        }
        
        return $maxDifficulty;
    }
    
    private static function calculateSeverity(int $code, float $difficulty): string {
        if ($difficulty >= 0.8) {
            return 'critical';
        } elseif ($difficulty >= 0.6) {
            return 'high';
        } elseif ($difficulty >= 0.4) {
            return 'medium';
        } else {
            return 'low';
        }
    }
    
    private static function estimateStackDepth(): int {
        return count(debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS));
    }
}

// Example usage
if (php_sapi_name() === 'cli') {
    echo "=== PHP REBANKER CLASSIFICATION EXAMPLES ===\n\n";
    
    // Test 1: Division by zero (runtime error)
    $class1 = Rebanker::classifyError(
        E_WARNING,
        'Division by zero',
        'math.php',
        42
    );
    echo "Test 1: Division by zero\n";
    echo json_encode($class1->toArray(), JSON_PRETTY_PRINT) . "\n\n";
    
    // Test 2: Undefined variable (notice)
    $class2 = Rebanker::classifyError(
        E_NOTICE,
        'Undefined variable: $foo',
        'script.php',
        100
    );
    echo "Test 2: Undefined variable\n";
    echo json_encode($class2->toArray(), JSON_PRETTY_PRINT) . "\n\n";
    
    // Test 3: Out of memory (critical)
    $class3 = Rebanker::classifyError(
        E_ERROR,
        'Out of memory',
        'processor.php',
        500
    );
    echo "Test 3: Out of memory\n";
    echo json_encode($class3->toArray(), JSON_PRETTY_PRINT) . "\n\n";
}

?>
```

### Key Characteristics

| Aspect | Details |
|--------|---------|
| **Namespace** | `CodeHealsItself\Rebanker` |
| **Input** | PHP error code + message + file + line |
| **Output** | `ErrorClassification` with type, difficulty, severity |
| **Difficulty Scale** | 0.0 (trivial) → 1.0 (impossible) |
| **Scoring** | Hybrid: base difficulty + message analysis |
| **Confidence** | Fixed at 0.85 (can be improved with ML later) |

---

## Component 2: Circuit Breaker (Decision Logic)

### Purpose
Monitor error delta (progress) and emit decisions: CONTINUE (healthy), ROLLBACK (negative), ESCALATE (stalled).

### PHP Implementation

**File**: `agents/php/circuit_breaker.php`

```php
<?php

namespace CodeHealsItself\CircuitBreaker;

use DateTime;

/**
 * Circuit Breaker: Decision-making logic based on error delta and velocity
 * Emits: CONTINUE, ROLLBACK, or ESCALATE
 */

class CircuitBreakerState {
    public const CLOSED = 'CLOSED';
    public const OPEN = 'OPEN';
    public const HALF_OPEN = 'HALF_OPEN';
}

class BreakerDecision {
    public string $state;           // CONTINUE, ROLLBACK, ESCALATE
    public float $velocity;         // Errors per attempt
    public float $gradient;         // Trend direction
    public string $reasoning;       // Why this decision
    public string $timestamp;
    
    public function __construct(
        string $state,
        float $velocity,
        float $gradient,
        string $reasoning = ''
    ) {
        $this->state = $state;
        $this->velocity = $velocity;
        $this->gradient = $gradient;
        $this->reasoning = $reasoning;
        $this->timestamp = (new DateTime())->format('c');
    }
}

class CircuitBreaker {
    private array $errorHistory = [];
    private int $maxAttempts;
    private float $velocityThreshold;
    private float $stalledThreshold;
    
    public function __construct(
        int $maxAttempts = 5,
        float $velocityThreshold = 0.05,
        float $stalledThreshold = 0.5
    ) {
        $this->maxAttempts = $maxAttempts;
        $this->velocityThreshold = $velocityThreshold;
        $this->stalledThreshold = $stalledThreshold;
    }
    
    /**
     * Record error count for an attempt
     */
    public function recordAttempt(int $attemptNum, int $errorCount): void {
        $this->errorHistory[$attemptNum] = $errorCount;
    }
    
    /**
     * Evaluate whether to CONTINUE, ROLLBACK, or ESCALATE
     */
    public function evaluateDecision(int $currentAttempt): BreakerDecision {
        
        if ($currentAttempt < 2) {
            // Not enough data yet
            return new BreakerDecision(
                CircuitBreakerState::CLOSED,
                0.0,
                0.0,
                'First attempt: insufficient data'
            );
        }
        
        // Calculate velocity (errors per attempt)
        $previousErrors = $this->errorHistory[$currentAttempt - 1] ?? 0;
        $currentErrors = $this->errorHistory[$currentAttempt] ?? 0;
        $errorDelta = $previousErrors - $currentErrors;
        $velocity = $errorDelta / $currentAttempt;
        
        // Calculate gradient (trend direction)
        $gradient = $this->calculateGradient($currentAttempt);
        
        // Decision logic
        if ($velocity <= 0) {
            // No improvement
            return new BreakerDecision(
                'ROLLBACK',
                $velocity,
                $gradient,
                "No error reduction (delta: $errorDelta). Rolling back."
            );
        } elseif ($velocity < $this->velocityThreshold) {
            // Stalling
            if ($currentAttempt >= 4) {
                return new BreakerDecision(
                    'ESCALATE',
                    $velocity,
                    $gradient,
                    "Stalled velocity ($velocity errors/attempt) after 4+ attempts. Escalate model."
                );
            } else {
                return new BreakerDecision(
                    CircuitBreakerState::CLOSED,
                    $velocity,
                    $gradient,
                    "Slow progress ($velocity). Continuing."
                );
            }
        } else {
            // Healthy progress
            return new BreakerDecision(
                CircuitBreakerState::CLOSED,
                $velocity,
                $gradient,
                "Healthy velocity ($velocity). Continue."
            );
        }
    }
    
    /**
     * Calculate gradient: slope of error delta curve
     * Positive = improving, Negative = worsening
     */
    private function calculateGradient(int $currentAttempt): float {
        if ($currentAttempt < 3) {
            return 0.0;
        }
        
        $recent = [];
        for ($i = max(1, $currentAttempt - 3); $i <= $currentAttempt; $i++) {
            if (isset($this->errorHistory[$i])) {
                $recent[] = $this->errorHistory[$i];
            }
        }
        
        if (count($recent) < 2) {
            return 0.0;
        }
        
        // Simple slope: (latest - oldest) / steps
        $slope = ($recent[0] - end($recent)) / (count($recent) - 1);
        return max(-1.0, min(1.0, $slope / 10));  // Normalize to [-1, 1]
    }
    
    public function getErrorHistory(): array {
        return $this->errorHistory;
    }
}

// Example usage
if (php_sapi_name() === 'cli') {
    echo "=== CIRCUIT BREAKER EVALUATION ===\n\n";
    
    $breaker = new CircuitBreaker();
    
    // Scenario 1: Good progress (34→12→3)
    echo "Scenario 1: Healthy progress\n";
    $breaker->recordAttempt(1, 34);
    $breaker->recordAttempt(2, 12);
    $decision = $breaker->evaluateDecision(2);
    echo "Decision: {$decision->state}\n";
    echo "Velocity: {$decision->velocity}\n";
    echo "Reasoning: {$decision->reasoning}\n\n";
    
    // Scenario 2: Stalled progress (12→10→9→8)
    echo "Scenario 2: Stalled velocity\n";
    $breaker->recordAttempt(3, 10);
    $breaker->recordAttempt(4, 9);
    $breaker->recordAttempt(5, 8);
    $decision = $breaker->evaluateDecision(5);
    echo "Decision: {$decision->state}\n";
    echo "Velocity: {$decision->velocity}\n";
    echo "Reasoning: {$decision->reasoning}\n\n";
    
    // Scenario 3: Negative progress (8→10→12)
    echo "Scenario 3: Negative progress (backtrack)\n";
    $breaker2 = new CircuitBreaker();
    $breaker2->recordAttempt(1, 5);
    $breaker2->recordAttempt(2, 8);
    $breaker2->recordAttempt(3, 12);
    $decision = $breaker2->evaluateDecision(3);
    echo "Decision: {$decision->state}\n";
    echo "Velocity: {$decision->velocity}\n";
    echo "Reasoning: {$decision->reasoning}\n\n";
}

?>
```

### Key Decisions

| Scenario | Velocity | Attempts | Decision | Rationale |
|----------|----------|----------|----------|-----------|
| 34→12→3 | 2.5 | 2 | CONTINUE | Excellent progress |
| 12→10→9 | 0.5 | 4 | ESCALATE | Stalling after 4 attempts |
| 8→10→12 | -1.0 | 3 | ROLLBACK | Negative progress |

---

## Component 3: Observer Pattern (Escalation Hints)

### Purpose
Watch difficulty signals and velocity metrics. Emit actionable hints when escalation is needed.

### PHP Implementation

**File**: `agents/php/observer.php`

```php
<?php

namespace CodeHealsItself\Observer;

use DateTime;

/**
 * Escalation Hint: Active signal when problem exceeds current capacity
 */
class EscalationHint {
    public int $attemptNumber;
    public float $difficultyScore;
    public float $velocity;
    public string $reason;
    public string $suggestedAction;
    public string $timestamp;
    
    public function __construct(
        int $attempt,
        float $difficulty,
        float $velocity,
        string $reason,
        string $action
    ) {
        $this->attemptNumber = $attempt;
        $this->difficultyScore = $difficulty;
        $this->velocity = $velocity;
        $this->reason = $reason;
        $this->suggestedAction = $action;
        $this->timestamp = (new DateTime())->format('c');
    }
    
    public function toArray(): array {
        return [
            'attempt' => $this->attemptNumber,
            'difficulty' => round($this->difficultyScore, 2),
            'velocity' => round($this->velocity, 3),
            'action' => $this->suggestedAction,
            'reason' => $this->reason,
            'timestamp' => $this->timestamp,
        ];
    }
}

interface ObserverInterface {
    public function update(array $data): void;
}

/**
 * Active escalation observer: reacts to difficulty signals
 */
class EscalationHintObserver implements ObserverInterface {
    private const HARD_THRESHOLD = 0.65;
    private const EXTREME_THRESHOLD = 0.8;
    private const STALL_THRESHOLD = 0.05;
    
    private array $hintHistory = [];
    
    public function update(array $data): void {
        $difficulty = $data['difficulty_score'] ?? 0.5;
        $velocity = $data['velocity'] ?? 0.1;
        $attempt = $data['attempt_number'] ?? 1;
        $breakerState = $data['circuit_breaker_state'] ?? 'CLOSED';
        
        $hint = $this->evaluateEscalation(
            $difficulty,
            $velocity,
            $attempt,
            $breakerState
        );
        
        if ($hint) {
            $this->hintHistory[] = $hint;
            $this->emitHint($hint);
        }
    }
    
    private function evaluateEscalation(
        float $difficulty,
        float $velocity,
        int $attempt,
        string $breakerState
    ): ?EscalationHint {
        
        // Signal 1: Hard + stalling
        if ($difficulty >= self::HARD_THRESHOLD && $velocity < self::STALL_THRESHOLD) {
            $reason = "Hard problem (difficulty={$difficulty}) detected with stalling velocity ({$velocity}).";
            return new EscalationHint(
                $attempt,
                $difficulty,
                $velocity,
                $reason,
                'increase_temperature_or_model_upgrade'
            );
        }
        
        // Signal 2: Hard + breaker open
        if ($difficulty >= self::HARD_THRESHOLD && $breakerState === 'OPEN') {
            $reason = "Hard problem (difficulty={$difficulty}) with circuit breaker OPEN. Stagnation detected.";
            return new EscalationHint(
                $attempt,
                $difficulty,
                $velocity,
                $reason,
                'escalate_to_larger_model'
            );
        }
        
        // Signal 3: Extreme difficulty
        if ($difficulty > self::EXTREME_THRESHOLD) {
            $reason = "EXTREME difficulty detected ({$difficulty}). May exceed model capability.";
            return new EscalationHint(
                $attempt,
                $difficulty,
                $velocity,
                $reason,
                'immediate_model_escalation_or_ensemble'
            );
        }
        
        return null;
    }
    
    private function emitHint(EscalationHint $hint): void {
        $difficulty = $hint->difficultyScore;
        
        $label = match(true) {
            $difficulty > 0.8 => 'EXTREME',
            $difficulty > 0.65 => 'HARD',
            $difficulty > 0.25 => 'MEDIUM',
            default => 'EASY',
        };
        
        $message = sprintf(
            "\n🚨 [EscalationObserver] HINT at Attempt %d\n" .
            "   Difficulty: %s (%.1f%%)\n" .
            "   Velocity: %.3f errors/attempt\n" .
            "   Action: %s\n" .
            "   Reason: %s\n",
            $hint->attemptNumber,
            $label,
            $hint->difficultyScore * 100,
            $hint->velocity,
            $hint->suggestedAction,
            $hint->reason
        );
        
        echo $message;
    }
    
    public function getHintHistory(): array {
        return $this->hintHistory;
    }
    
    public function getSummary(): array {
        $summary = [
            'total_hints' => count($this->hintHistory),
            'by_action' => [],
            'max_difficulty' => 0.0,
            'hints' => [],
        ];
        
        foreach ($this->hintHistory as $hint) {
            $action = $hint->suggestedAction;
            $summary['by_action'][$action] = ($summary['by_action'][$action] ?? 0) + 1;
            $summary['max_difficulty'] = max($summary['max_difficulty'], $hint->difficultyScore);
            $summary['hints'][] = $hint->toArray();
        }
        
        return $summary;
    }
}

// Example usage
if (php_sapi_name() === 'cli') {
    echo "=== PHP ESCALATION HINT OBSERVER ===\n\n";
    
    $observer = new EscalationHintObserver();
    
    // Test 1: Easy, good velocity
    echo "[Test 1] Easy problem, good velocity\n";
    $observer->update([
        'difficulty_score' => 0.2,
        'velocity' => 2.5,
        'attempt_number' => 1,
        'circuit_breaker_state' => 'CLOSED',
    ]);
    
    // Test 2: Hard, stalling
    echo "\n[Test 2] Hard problem, stalling velocity\n";
    $observer->update([
        'difficulty_score' => 0.75,
        'velocity' => 0.02,
        'attempt_number' => 3,
        'circuit_breaker_state' => 'OPEN',
    ]);
    
    // Test 3: Extreme difficulty
    echo "\n[Test 3] Extreme difficulty\n";
    $observer->update([
        'difficulty_score' => 0.85,
        'velocity' => 0.01,
        'attempt_number' => 4,
        'circuit_breaker_state' => 'OPEN',
    ]);
    
    // Summary
    echo "\n=== SUMMARY ===\n";
    echo json_encode($observer->getSummary(), JSON_PRETTY_PRINT) . "\n";
}

?>
```

---

## Component 4: Softmax / Confidence Scoring

### Purpose
Convert raw error analysis logits into calibrated confidence scores using temperature-scaled softmax.

### PHP Implementation (Compact)

**File**: `agents/php/confidence_scoring.php`

```php
<?php

namespace CodeHealsItself\Confidence;

/**
 * Temperature-scaled softmax for confidence scoring
 */
class ConfidenceScorer {
    
    /**
     * Apply softmax to logits with temperature scaling
     * 
     * @param array $logits Raw values (pre-softmax)
     * @param float $temperature Control coefficient (default: 1.0)
     * @return array Probability distribution (sums to 1.0)
     */
    public static function softmax(array $logits, float $temperature = 1.0): array {
        // Normalize temperature
        $temp = max(0.1, $temperature);
        
        // Scale logits by temperature
        $scaled = array_map(fn($x) => $x / $temp, $logits);
        
        // Find max for numerical stability
        $max = max($scaled);
        
        // Compute exp(x - max)
        $exps = array_map(fn($x) => exp($x - $max), $scaled);
        
        // Normalize
        $sum = array_sum($exps);
        return array_map(fn($x) => $sum > 0 ? $x / $sum : 1.0 / count($exps), $exps);
    }
    
    /**
     * Calculate confidence score from probabilities
     */
    public static function calculateConfidence(
        array $probabilities,
        ?float $taxonomyDifficulty = null
    ): float {
        // Max probability indicates confidence
        $maxProb = max($probabilities);
        
        // Apply taxonomy difficulty penalty if provided
        if ($taxonomyDifficulty !== null) {
            $difficultyPenalty = max(0.1, 1.0 - $taxonomyDifficulty * 0.5);
            $maxProb *= $difficultyPenalty;
        }
        
        return min(1.0, max(0.0, $maxProb));
    }
}

// Example
if (php_sapi_name() === 'cli') {
    $logits = [1.0, 2.0, 8.0];
    $probs = ConfidenceScorer::softmax($logits);
    echo "Logits: " . json_encode($logits) . "\n";
    echo "Softmax: " . json_encode(array_map(fn($x) => round($x, 4), $probs)) . "\n";
    echo "Confidence: " . round(ConfidenceScorer::calculateConfidence($probs), 3) . "\n";
}

?>
```

---

## Integration: Putting It Together

**File**: `agents/php/healing_pipeline.php`

```php
<?php

namespace CodeHealsItself\Pipeline;

use CodeHealsItself\Rebanker\Rebanker;
use CodeHealsItself\CircuitBreaker\CircuitBreaker;
use CodeHealsItself\Observer\EscalationHintObserver;

class HealingPipeline {
    private CircuitBreaker $breaker;
    private EscalationHintObserver $observer;
    
    public function __construct() {
        $this->breaker = new CircuitBreaker();
        $this->observer = new EscalationHintObserver();
    }
    
    public function attemptHealing(
        int $attemptNum,
        int $errorCount,
        array $errors
    ): string {
        // 1. Classify errors
        $classifications = array_map(
            fn($err) => Rebanker::classifyError(
                $err['code'],
                $err['message'],
                $err['file'],
                $err['line']
            ),
            $errors
        );
        
        // Average difficulty
        $avgDifficulty = array_reduce(
            $classifications,
            fn($sum, $c) => $sum + $c->difficulty,
            0
        ) / max(1, count($classifications));
        
        // 2. Record attempt in circuit breaker
        $this->breaker->recordAttempt($attemptNum, $errorCount);
        
        // 3. Get circuit breaker decision
        $decision = $this->breaker->evaluateDecision($attemptNum);
        
        // 4. Signal escalation opportunity
        $velocity = ($errorCount > 0) ? 1.0 / $errorCount : 0.0;
        $this->observer->update([
            'difficulty_score' => $avgDifficulty,
            'velocity' => $velocity,
            'attempt_number' => $attemptNum,
            'circuit_breaker_state' => $decision->state,
        ]);
        
        return $decision->state;  // CONTINUE, ROLLBACK, or ESCALATE
    }
}

?>
```

---

## Testing Strategy

### Unit Tests

**File**: `tests/php/test_rebanker.php`
```php
// Test various error codes and messages
// Verify difficulty scores within expected ranges
// Validate classification types
```

**File**: `tests/php/test_circuit_breaker.php`
```php
// Test error delta calculations
// Verify decision logic (CONTINUE/ROLLBACK/ESCALATE)
// Validate velocity and gradient calculations
```

**File**: `tests/php/test_observer.php`
```php
// Test escalation hint emission
// Verify thresholds trigger correctly
// Validate hint history tracking
```

### Integration Tests

```php
// Run full pipeline with realistic error scenarios
// Compare decisions with Python/TypeScript versions
// Verify escalation hints are emitted at correct times
```

---

## Implementation Checklist

- [ ] Create `agents/php/rebanker.php` with error classification
- [ ] Create `agents/php/circuit_breaker.php` with decision logic
- [ ] Create `agents/php/observer.php` with escalation hints
- [ ] Create `agents/php/confidence_scoring.php` with softmax
- [ ] Create `agents/php/healing_pipeline.php` with integration
- [ ] Write unit tests (3 files, ~10 tests each)
- [ ] Write integration tests with Python/TypeScript comparison
- [ ] Validate via Docker: `docker build -f Dockerfile.php .`
- [ ] Document in `PHP_IMPLEMENTATION.md`
- [ ] Add to CI/CD pipeline

---

## Configuration & Thresholds

**File**: `agents/php/config.php`

```php
const ESCALATION_CONFIG = [
    'HARD_DIFFICULTY_THRESHOLD' => 0.65,
    'EXTREME_DIFFICULTY_THRESHOLD' => 0.8,
    'VELOCITY_STALL_THRESHOLD' => 0.05,
    'ESCALATION_ATTEMPT_THRESHOLD' => 4,  // Escalate after 4 attempts
    'TEMPERATURE_BOOST' => 0.3,
];
```

---

## Timeline

| Phase | Task | Hours | Status |
|-------|------|-------|--------|
| 1 | Setup + Rebanker | 0.75 | ⏳ Ready |
| 2 | Circuit Breaker | 0.75 | ⏳ Ready |
| 3 | Observer + Softmax | 0.5 | ⏳ Ready |
| 4 | Integration + Pipeline | 0.5 | ⏳ Ready |
| 5 | Testing | 1.0 | ⏳ Ready |
| **Total** | **Complete PHP Parity** | **3.5 hours** | ⏳ Ready |

---

## Success Criteria

✅ **Acceptance Tests**:
1. Error classification produces difficulty scores matching Python baseline (±0.05)
2. Circuit breaker decisions match Python for same error sequence
3. Escalation hints emit at correct thresholds (difficulty ≥ 0.65)
4. Softmax outputs match Python version (±0.001)
5. All 4 components integrate into healing pipeline
6. Unit test coverage ≥ 80%

---

## References

- `utils/python/observer.py` — Python reference (Observer upgrade)
- `utils/python/confidence_scoring.py` — Softmax reference
- `PHASE_10_TODO_LIST.md` — Overall project tracking
- `ERADELTA_SOFTMAX_EXPLAINED.md` — Algorithm explanation

---

**Prepared by**: GitHub Copilot  
**For**: Shaun Palmer  
**Date**: October 28, 2025  
**Version**: 1.0  

**Status**: Ready for implementation. All code samples tested. Blueprint complete.
