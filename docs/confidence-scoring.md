# Confidence Scoring System

The confidence scoring system provides unified, reliable confidence estimates across all debugging operations, enabling intelligent decision-making about when to attempt fixes and when to escalate to human intervention.

## Overview

The system uses multiple calibration methods to ensure confidence scores are reliable indicators of actual fix success rates:

- **Temperature Scaling**: Calibrates raw model confidence scores
- **Beta Calibration**: Uses historical success rates for calibration
- **Component-Based Scoring**: Breaks down confidence into multiple factors

## Core Components

### Error Classification

```typescript
enum ErrorType {
  SYNTAX = "syntax",      // Parse errors, missing semicolons, etc.
  LOGIC = "logic",        // Algorithm errors, incorrect logic flow
  RUNTIME = "runtime",    // Null pointer exceptions, type errors
  PERFORMANCE = "performance", // Memory leaks, slow algorithms
  SECURITY = "security"   // XSS, SQL injection, auth bypasses
}
```

### Confidence Components

The system evaluates multiple factors when calculating confidence:

```typescript
class ConfidenceComponents {
  historical_success_rate: number;    // Past success rate for similar errors
  pattern_similarity: number;         // How similar this error is to previously fixed errors
  code_complexity_penalty: number;    // Penalty for complex code structures
  test_coverage: number;             // Available test coverage for validation
}
```

## Circuit Breaker Integration

### Dual Circuit Breaker

The system uses separate circuit breakers for syntax and logic errors:

```typescript
class DualCircuitBreaker {
  syntaxBreaker: CircuitBreaker;
  logicBreaker: CircuitBreaker;

  // Different thresholds for different error types
  syntaxThreshold: number = 0.30;  // Lower bar for syntax fixes
  logicThreshold: number = 0.25;   // Higher bar for logic fixes
}
```

### Circuit States

```typescript
enum CircuitState {
  CLOSED = "closed",                    // Normal operation
  SYNTAX_OPEN = "syntax_open",          // Syntax fixes blocked
  LOGIC_OPEN = "logic_open",            // Logic fixes blocked
  PERMANENTLY_OPEN = "permanently_open" // All fixes blocked
}
```

## Confidence Scoring Methods

### Temperature Scaling

Calibrates raw model confidence using historical performance:

```typescript
class TemperatureScaler {
  temperature: number = 2.0;  // Scaling factor

  calibrate(rawConfidence: number, historicalAccuracy: number): number {
    return 1 / (1 + Math.exp(-rawConfidence / this.temperature));
  }
}
```

### Beta Calibration

Uses beta distribution for more robust calibration:

```typescript
class BetaCalibrator {
  calibrate(successes: number, total: number, rawConfidence: number): number {
    // Beta calibration using historical success rates
    const alpha = successes + 1;
    const beta = (total - successes) + 1;
    return (alpha) / (alpha + beta);
  }
}
```

## Usage Examples

### Basic Confidence Scoring

```typescript
import { UnifiedConfidenceScorer, ErrorType } from './utils/typescript/confidence_scoring';

const scorer = new UnifiedConfidenceScorer();

// Score a syntax error fix
const score = scorer.scoreConfidence({
  errorType: ErrorType.SYNTAX,
  rawConfidence: 0.85,
  historicalSuccessRate: 0.92,
  codeComplexity: 0.3,
  testCoverage: 0.8
});

console.log(`Overall confidence: ${score.overall_confidence}`);
console.log(`Syntax confidence: ${score.syntax_confidence}`);
```

### Circuit Breaker Integration

```typescript
import { DualCircuitBreaker } from './utils/typescript/confidence_scoring';

const breaker = new DualCircuitBreaker();

// Check if we should attempt a fix
if (breaker.shouldAttemptFix(ErrorType.SYNTAX, confidenceScore)) {
  // Attempt the fix
  const result = await attemptFix(error, patch);

  // Record the result for future calibration
  breaker.recordResult(ErrorType.SYNTAX, result.success, confidenceScore);
}
```

## Configuration

### Model-Specific Tuning

Different models require different confidence thresholds:

```typescript
const modelConfigs = {
  // GPT-4/Claude 3 - High capability
  sota: {
    syntax_threshold: 0.60,
    logic_threshold: 0.50,
    max_attempts: 3
  },

  // Llama 3/Mistral - Medium capability
  midTier: {
    syntax_threshold: 0.30,
    logic_threshold: 0.25,
    max_attempts: 5
  },

  // 7B/13B models - Lower capability
  localSmall: {
    syntax_threshold: 0.20,
    logic_threshold: 0.15,
    max_attempts: 7
  }
};
```

## Error Budgets

The system uses error budgets to prevent over-attempting fixes:

```typescript
class ErrorBudget {
  syntaxBudget: number = 0.10;  // 10% error rate allowed
  logicBudget: number = 0.20;   // 20% error rate allowed

  trackError(errorType: ErrorType, wasSuccessful: boolean): void {
    if (!wasSuccessful) {
      // Increment error counters
      // Check if budget exceeded
      // Trip circuit breaker if needed
    }
  }
}
```

## Monitoring and Metrics

### Confidence Metrics

```typescript
interface ConfidenceMetrics {
  averageConfidence: number;
  confidenceDistribution: number[];  // Histogram buckets
  calibrationAccuracy: number;       // How well calibrated our scores are
  overconfidenceRate: number;        // Rate of overconfident predictions
  underconfidenceRate: number;       // Rate of underconfident predictions
}
```

### Circuit Breaker Metrics

```typescript
interface CircuitBreakerMetrics {
  state: CircuitState;
  attemptsThisPeriod: number;
  successesThisPeriod: number;
  failuresThisPeriod: number;
  lastTripTime?: Date;
  recoveryAttempts: number;
}
```

## Best Practices

### Threshold Selection
- **Syntax fixes**: Lower thresholds (0.2-0.4) since they're often mechanical
- **Logic fixes**: Higher thresholds (0.4-0.7) since they require deeper understanding
- **Security fixes**: Highest thresholds (0.7+) due to safety implications

### Calibration
- Regularly recalibrate based on actual performance
- Use cross-validation to prevent overfitting
- Monitor calibration drift over time

### Circuit Breaker Tuning
- Set appropriate recovery timeouts
- Use exponential backoff for recovery attempts
- Monitor for false positives/negatives

## Troubleshooting

### Common Issues

**Overconfident predictions:**
- Increase temperature scaling factor
- Add more conservative penalties
- Review historical success rates

**Underconfident predictions:**
- Decrease temperature scaling factor
- Review calibration data quality
- Check for systematic biases

**Circuit breaker thrashing:**
- Increase recovery timeout
- Add jitter to recovery attempts
- Review error budget settings

This confidence scoring system ensures reliable, calibrated confidence estimates that enable intelligent automation while maintaining safety through appropriate thresholds and circuit breaker patterns.</content>
<parameter name="filePath">c:\code-heals-itself\docs\confidence-scoring.md