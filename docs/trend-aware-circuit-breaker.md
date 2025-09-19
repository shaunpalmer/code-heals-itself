# Trend-Aware Circuit Breaker

The trend-aware circuit breaker extends traditional circuit breaker patterns with intelligent trend analysis, enabling proactive failure prevention and adaptive recovery strategies.

## Overview

Traditional circuit breakers react to failures after they occur. The trend-aware circuit breaker analyzes patterns in error rates, confidence scores, and improvement velocity to predict and prevent failures before they happen.

## Core Concepts

### Trend Analysis

The system tracks multiple metrics over time to identify improvement patterns:

```typescript
interface TrendPoint {
  attempt: number;           // Attempt number
  errorsDetected: number;    // Errors found in this attempt
  errorsResolved: number;    // Errors fixed in this attempt
  confidence: number;        // Model confidence score (0-1)
  timestamp: number;         // When the attempt occurred
  errorTypes: ErrorType[];   // Types of errors encountered
  codeQualityScore: number;  // Overall code quality metric (0-1)
}
```

### Improvement Assessment

```typescript
interface ImprovementTrend {
  direction: 'improving' | 'plateauing' | 'worsening' | 'unknown';
  errorDelta: number;        // Change in error count (negative = improvement)
  confidenceDelta: number;   // Change in confidence (positive = improvement)
  velocityScore: number;     // How fast we're improving (0-1)
  stagnationRisk: number;    // Risk of getting stuck (0-1)
}
```

## Circuit Breaker States

### Enhanced State Machine

```typescript
enum CircuitState {
  CLOSED = "closed",                    // Normal operation
  DEGRADED = "degraded",               // Performance degraded, increased monitoring
  RECOVERY = "recovery",               // Attempting recovery with reduced load
  OPEN = "open",                       // Circuit open, blocking attempts
  PERMANENTLY_OPEN = "permanently_open" // Permanent failure, requires manual intervention
}
```

### State Transitions

```
CLOSED → DEGRADED (when trends show degradation)
DEGRADED → RECOVERY (when improvement detected)
RECOVERY → CLOSED (when fully recovered)
DEGRADED → OPEN (when degradation accelerates)
OPEN → RECOVERY (after timeout with backoff)
RECOVERY → PERMANENTLY_OPEN (after max recovery attempts)
```

## Configuration Parameters

### Core Settings

```typescript
interface CircuitBreakerConfig {
  maxAttempts: number;           // Maximum attempts before opening (default: 10)
  improvementWindow: number;     // Must improve within N attempts (default: 3)
  stagnationThreshold: number;   // Open if no improvement for N attempts (default: 5)
  confidenceFloor: number;       // Minimum confidence to attempt fixes (default: 0.6)
  maxTrendHistory: number;       // Maximum trend points to keep (default: 50)
}
```

### Advanced Tuning

```typescript
interface AdvancedConfig {
  degradationThreshold: number;   // When to enter degraded state (default: 0.7)
  recoveryTimeoutMs: number;      // How long to wait before recovery attempt
  backoffMultiplier: number;      // Exponential backoff multiplier
  velocityThreshold: number;      // Minimum improvement velocity required
  stagnationRiskThreshold: number; // When stagnation risk triggers action
}
```

## Usage Examples

### Basic Setup

```typescript
import { TrendAwareCircuitBreaker } from './utils/typescript/trend_aware_circuit_breaker';

const breaker = new TrendAwareCircuitBreaker({
  maxAttempts: 10,
  improvementWindow: 3,
  stagnationThreshold: 5,
  confidenceFloor: 0.6
});
```

### Recording Attempts

```typescript
// Record each debugging attempt
breaker.recordAttempt({
  errorsDetected: 3,
  errorsResolved: 2,
  confidence: 0.85,
  errorTypes: [ErrorType.SYNTAX, ErrorType.LOGIC],
  codeQualityScore: 0.75
});
```

### Decision Making

```typescript
// Check if we should attempt a fix
if (breaker.shouldAttemptFix(confidenceScore)) {
  try {
    const result = await attemptDebugFix(error, context);
    breaker.recordResult(result.success, result.metrics);
  } catch (error) {
    breaker.recordFailure(error);
  }
} else {
  console.log('Circuit breaker blocked attempt:', breaker.getStatus());
}
```

## Trend Analysis Algorithms

### Velocity Calculation

```typescript
calculateVelocity(trendPoints: TrendPoint[]): number {
  if (trendPoints.length < 2) return 0;

  const recent = trendPoints.slice(-5); // Last 5 points
  const improvements = recent.map((point, i) => {
    if (i === 0) return 0;
    return point.codeQualityScore - recent[i-1].codeQualityScore;
  });

  const avgImprovement = improvements.reduce((a, b) => a + b, 0) / improvements.length;
  return Math.max(0, Math.min(1, avgImprovement * 10)); // Scale to 0-1
}
```

### Stagnation Detection

```typescript
detectStagnation(trendPoints: TrendPoint[]): number {
  if (trendPoints.length < stagnationThreshold) return 0;

  const recent = trendPoints.slice(-stagnationThreshold);
  const hasImprovement = recent.some((point, i) => {
    if (i === 0) return false;
    return point.codeQualityScore > recent[i-1].codeQualityScore;
  });

  return hasImprovement ? 0 : 1; // 1 = stagnation detected
}
```

### Degradation Assessment

```typescript
assessDegradation(trendPoints: TrendPoint[]): ImprovementTrend {
  const recent = trendPoints.slice(-improvementWindow);

  if (recent.length < 2) {
    return { direction: 'unknown', errorDelta: 0, confidenceDelta: 0, velocityScore: 0, stagnationRisk: 0 };
  }

  const first = recent[0];
  const last = recent[recent.length - 1];

  const errorDelta = first.errorsDetected - last.errorsDetected;
  const confidenceDelta = last.confidence - first.confidence;
  const velocityScore = this.calculateVelocity(recent);
  const stagnationRisk = this.detectStagnation(trendPoints);

  let direction: 'improving' | 'plateauing' | 'worsening' | 'unknown' = 'unknown';

  if (errorDelta > 0 && confidenceDelta > 0) {
    direction = 'improving';
  } else if (errorDelta === 0 && confidenceDelta === 0) {
    direction = 'plateauing';
  } else if (errorDelta < 0 || confidenceDelta < 0) {
    direction = 'worsening';
  }

  return { direction, errorDelta, confidenceDelta, velocityScore, stagnationRisk };
}
```

## Integration Patterns

### With AIDebugger

```typescript
class IntelligentDebugger extends AIDebugger {
  private circuitBreaker: TrendAwareCircuitBreaker;

  constructor(config: DebuggerConfig) {
    super(config);
    this.circuitBreaker = new TrendAwareCircuitBreaker(config.circuitBreaker);
  }

  async attemptFix(error: Error, context: DebugContext): Promise<FixResult> {
    // Check circuit breaker first
    if (!this.circuitBreaker.shouldAttemptFix(context.confidence)) {
      return { success: false, reason: 'Circuit breaker open' };
    }

    const result = await super.attemptFix(error, context);

    // Record result for trend analysis
    this.circuitBreaker.recordAttempt({
      errorsDetected: context.errorCount,
      errorsResolved: result.errorsFixed,
      confidence: context.confidence,
      errorTypes: context.errorTypes,
      codeQualityScore: result.qualityScore
    });

    return result;
  }
}
```

### With Observers

```typescript
class CircuitBreakerObserver extends Observer {
  update(subject: TrendAwareCircuitBreaker, data: any): void {
    if (data.stateChanged) {
      console.log(`Circuit breaker state: ${data.newState}`);

      if (data.newState === 'open') {
        // Alert monitoring system
        this.alertMonitoring(data.reason);
      }
    }
  }
}
```

## Monitoring and Metrics

### Circuit Breaker Metrics

```typescript
interface CircuitBreakerMetrics {
  currentState: CircuitState;
  attemptsThisPeriod: number;
  successRate: number;
  averageConfidence: number;
  trendDirection: string;
  stagnationRisk: number;
  lastStateChange: Date;
  recoveryAttempts: number;
}
```

### Trend Metrics

```typescript
interface TrendMetrics {
  velocityScore: number;
  errorReductionRate: number;
  confidenceGrowthRate: number;
  stagnationPeriods: number;
  improvementPeriods: number;
  averageAttemptDuration: number;
}
```

## Best Practices

### Configuration Tuning

**For High-Capability Models (GPT-4, Claude 3):**
```typescript
const sotaConfig = {
  maxAttempts: 5,
  improvementWindow: 2,
  stagnationThreshold: 3,
  confidenceFloor: 0.7
};
```

**For Medium-Capability Models (Llama 3, Mistral):**
```typescript
const midTierConfig = {
  maxAttempts: 8,
  improvementWindow: 3,
  stagnationThreshold: 4,
  confidenceFloor: 0.5
};
```

**For Local Small Models (7B/13B):**
```typescript
const localConfig = {
  maxAttempts: 12,
  improvementWindow: 4,
  stagnationThreshold: 6,
  confidenceFloor: 0.3
};
```

### Monitoring Setup

```typescript
class CircuitBreakerMonitor {
  private metrics: CircuitBreakerMetrics[] = [];

  recordMetrics(breaker: TrendAwareCircuitBreaker): void {
    const metrics = breaker.getMetrics();
    this.metrics.push(metrics);

    // Alert on concerning patterns
    if (metrics.stagnationRisk > 0.8) {
      this.alertStagnation(metrics);
    }

    if (metrics.currentState === 'permanently_open') {
      this.alertPermanentFailure(metrics);
    }
  }
}
```

## Troubleshooting

### Common Issues

**False Positives (Blocking Good Attempts):**
- Lower `confidenceFloor`
- Increase `improvementWindow`
- Review trend analysis parameters

**False Negatives (Allowing Bad Attempts):**
- Raise `confidenceFloor`
- Decrease `maxAttempts`
- Add more conservative trend detection

**Stagnation Detection Issues:**
- Adjust `stagnationThreshold`
- Review velocity calculation
- Check for noisy metrics

**Recovery Problems:**
- Tune `recoveryTimeoutMs`
- Adjust backoff parameters
- Review recovery attempt limits

This trend-aware circuit breaker provides intelligent failure prevention and adaptive recovery, ensuring reliable operation while maximizing successful fix attempts.</content>
<parameter name="filePath">c:\code-heals-itself\docs\trend-aware-circuit-breaker.md