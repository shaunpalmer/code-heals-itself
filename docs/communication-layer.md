# Communication Layer and Retry Strategies

The communication layer provides robust retry mechanisms, intelligent backoff strategies, and context-aware communication protocols for reliable interaction with AI models and external systems.

## Overview

The communication system consists of:

- **Backoff Policies**: Intelligent retry timing and rate limiting
- **Jitter Communication**: Structured LLM interaction protocols
- **Context Extraction**: Code analysis and context gathering
- **Error Recovery**: Adaptive failure handling and recovery

## Backoff Policies

### Core Backoff Functions

```typescript
// Basic sleep utility
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
}

// Add jitter to prevent thundering herd
function withJitter(ms: number, ratio: number = 0.3): number {
  const base = Math.max(0, ms);
  const jitter = base * Math.max(0, Math.min(1, ratio));
  const delta = (Math.random() * 2 - 1) * jitter; // [-jitter, +jitter]
  return Math.max(0, Math.round(base + delta));
}

// Intelligent backoff suggestion based on circuit breaker state
function suggestBackoffMs(
  summary: Record<string, any>,
  defaults: { short: number; medium: number; long: number } = {
    short: 800,
    medium: 2500,
    long: 8000
  }
): number {
  if (!summary) return defaults.short;

  // Respect existing pause periods
  if (summary.paused && summary.pause_remaining_ms > 0) {
    return summary.pause_remaining_ms;
  }

  // Short pause for oscillating confidence
  if (summary.confidence_improving && !summary.is_improving) {
    return defaults.short;
  }

  // Medium backoff when not improving and should stop
  if (!summary.is_improving && summary.should_continue_attempts === false) {
    return defaults.medium;
  }

  return defaults.short;
}
```

### Backoff Policy Interface

```typescript
interface BackoffPolicy {
  recommend(
    summary: Record<string, any>,
    bounds: {
      minMs: number;
      maxMs: number;
      defaults?: { short: number; medium: number; long: number }
    }
  ): { waitMs: number; rationale?: string };
}
```

### Default Backoff Policy

```typescript
class DefaultBackoffPolicy implements BackoffPolicy {
  recommend(summary: Record<string, any>, bounds: any): { waitMs: number; rationale?: string } {
    const baseMs = suggestBackoffMs(summary, bounds.defaults);
    const jitteredMs = withJitter(baseMs, 0.2); // 20% jitter
    const clampedMs = Math.max(bounds.minMs, Math.min(bounds.maxMs, jitteredMs));

    return {
      waitMs: clampedMs,
      rationale: this.explainRecommendation(summary, baseMs, clampedMs)
    };
  }

  private explainRecommendation(summary: any, baseMs: number, finalMs: number): string {
    if (summary?.paused) {
      return `Respecting existing pause period: ${finalMs}ms`;
    }
    if (summary?.confidence_improving && !summary?.is_improving) {
      return `Short pause for confidence oscillation: ${finalMs}ms`;
    }
    if (!summary?.is_improving && summary?.should_continue_attempts === false) {
      return `Medium backoff - not improving and should stop: ${finalMs}ms`;
    }
    return `Default debounce period: ${finalMs}ms`;
  }
}
```

### Advanced Backoff Policies

```typescript
class ExponentialBackoffPolicy implements BackoffPolicy {
  private attemptCount: number = 0;

  recommend(summary: Record<string, any>, bounds: any): { waitMs: number; rationale?: string } {
    this.attemptCount++;

    const baseDelay = Math.min(bounds.maxMs, bounds.minMs * Math.pow(2, this.attemptCount - 1));
    const jitteredDelay = withJitter(baseDelay, 0.1);
    const finalDelay = Math.max(bounds.minMs, Math.min(bounds.maxMs, jitteredDelay));

    return {
      waitMs: finalDelay,
      rationale: `Exponential backoff attempt ${this.attemptCount}: ${finalDelay}ms`
    };
  }

  reset(): void {
    this.attemptCount = 0;
  }
}

class AdaptiveBackoffPolicy implements BackoffPolicy {
  private history: number[] = [];

  recommend(summary: Record<string, any>, bounds: any): { waitMs: number; rationale?: string } {
    // Analyze recent success patterns
    const recentSuccessRate = this.calculateRecentSuccessRate();

    let baseDelay: number;
    if (recentSuccessRate > 0.8) {
      baseDelay = bounds.minMs; // Quick retries when successful
    } else if (recentSuccessRate > 0.5) {
      baseDelay = (bounds.minMs + bounds.maxMs) / 2; // Medium delay
    } else {
      baseDelay = bounds.maxMs; // Long delay when struggling
    }

    const finalDelay = withJitter(baseDelay, 0.15);

    return {
      waitMs: Math.max(bounds.minMs, Math.min(bounds.maxMs, finalDelay)),
      rationale: `Adaptive delay based on ${Math.round(recentSuccessRate * 100)}% recent success rate`
    };
  }

  private calculateRecentSuccessRate(): number {
    if (this.history.length === 0) return 0.5;
    const recent = this.history.slice(-10); // Last 10 attempts
    const successes = recent.filter(delay => delay < 2000).length; // Fast responses = success
    return successes / recent.length;
  }

  recordOutcome(success: boolean, responseTime: number): void {
    this.history.push(responseTime);
    if (this.history.length > 100) {
      this.history.shift(); // Keep only recent history
    }
  }
}
```

## Jitter Communication Protocol

### Enhanced Communication Envelope

```typescript
interface JitterEnvelope {
  type: string; // 'jitter.request.v1'
  ts: string; // ISO timestamp
  session?: string;
  instructions: string[];
  context: {
    error_message: string;
    original_code: string;
    last_patch_code: string;
    language: string;
    wider_context?: {
      function_name?: string;
      function_code?: string;
      surrounding?: string;
    };
    syntax_balance?: {
      paren: { open: number; close: number; missingClose: number };
      brace: { open: number; close: number; missingClose: number };
      bracket: { open: number; close: number; missingClose: number };
      semicolonHeuristicMissing: number;
    };
  };
  trend: Record<string, any>;
  last_attempt_status?: {
    success?: boolean;
    message?: string;
    errors_resolved?: number;
    error_delta?: number;
  };
  last_envelope?: any;
  constraints?: {
    max_lines_changed?: number;
    disallow_keywords?: string[];
  };
  metadata?: Record<string, any>;
}
```

### Envelope Construction

```typescript
function buildJitterEnvelope(params: {
  errorMessage: string;
  originalCode: string;
  lastPatch: string;
  language?: string;
  breakerSummary?: Record<string, any>;
  lastEnvelopeJson?: any;
  maxLinesChange?: number;
  sessionId?: string;
}): JitterEnvelope {
  const syntaxBalance = basicBalanceScan(params.originalCode);
  const functionContext = extractFunctionContext(params.originalCode, params.lastPatch);

  return {
    type: 'jitter.request.v1',
    ts: new Date().toISOString(),
    session: params.sessionId,
    instructions: [
      'Analyze the error and provide a targeted fix',
      'Consider the syntax balance and context',
      'Ensure the fix is minimal and safe',
      'Respect the provided constraints'
    ],
    context: {
      error_message: params.errorMessage,
      original_code: params.originalCode,
      last_patch_code: params.lastPatch,
      language: params.language || 'typescript',
      wider_context: functionContext,
      syntax_balance: syntaxBalance
    },
    trend: params.breakerSummary || {},
    last_attempt_status: extractLastAttemptStatus(params.lastEnvelopeJson),
    constraints: {
      max_lines_changed: params.maxLinesChange || 25,
      disallow_keywords: ['eval', 'dangerous_function', 'child_process']
    },
    metadata: {
      version: '1.0',
      client: 'self-healing-debugger'
    }
  };
}
```

## Context Extraction

### Function Context Analysis

```typescript
interface FunctionContext {
  functionName?: string;
  functionCode?: string;
  surrounding?: string;
}

function extractFunctionContext(originalCode: string, patchCode: string): FunctionContext {
  // Try to infer function name from patch
  const functionName = inferFunctionNameFromCode(patchCode);

  if (functionName) {
    const functionBlock = findFunctionBlockByName(originalCode, functionName);
    if (functionBlock) return functionBlock;
  }

  // Fallback: find first function-like block
  const firstFunction = findFirstFunctionBlock(originalCode);
  if (firstFunction) return firstFunction;

  // Final fallback: provide code snippet
  const snippet = originalCode.split('\n').slice(0, 100).join('\n');
  return {
    functionName: undefined,
    functionCode: snippet,
    surrounding: undefined
  };
}
```

### Syntax Balance Analysis

```typescript
interface BalanceReport {
  paren: { open: number; close: number; missingClose: number };
  brace: { open: number; close: number; missingClose: number };
  bracket: { open: number; close: number; missingClose: number };
  semicolonHeuristicMissing: number;
}

function basicBalanceScan(code: string): BalanceReport {
  const countMatches = (pattern: string) => (code.match(new RegExp(pattern, 'g')) || []).length;

  const parenOpen = countMatches("\\(");
  const parenClose = countMatches("\\)");
  const braceOpen = countMatches("\\{");
  const braceClose = countMatches("\\}");
  const bracketOpen = countMatches("\\[");
  const bracketClose = countMatches("\\]");

  // Heuristic for missing semicolons
  const missingSemicolons = code
    .split('\n')
    .filter(line =>
      /\b(let|const|var|return|throw|break|continue)\b/.test(line.trim()) &&
      !/[;{}]$/.test(line.trim())
    ).length;

  return {
    paren: {
      open: parenOpen,
      close: parenClose,
      missingClose: Math.max(0, parenOpen - parenClose)
    },
    brace: {
      open: braceOpen,
      close: braceClose,
      missingClose: Math.max(0, braceOpen - braceClose)
    },
    bracket: {
      open: bracketOpen,
      close: bracketClose,
      missingClose: Math.max(0, bracketOpen - bracketClose)
    },
    semicolonHeuristicMissing: missingSemicolons
  };
}
```

## Integration Examples

### Complete Communication Pipeline

```typescript
class IntelligentCommunicator {
  private backoffPolicy: BackoffPolicy;
  private retryCount: number = 0;
  private maxRetries: number = 3;

  constructor(backoffPolicy: BackoffPolicy = new DefaultBackoffPolicy()) {
    this.backoffPolicy = backoffPolicy;
  }

  async communicateWithRetry(
    error: string,
    code: string,
    context: any,
    llmAdapter: LLMAdapter
  ): Promise<CommunicationResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Build communication envelope
        const envelope = buildJitterEnvelope({
          errorMessage: error,
          originalCode: code,
          lastPatch: context.lastPatch || '',
          language: context.language,
          breakerSummary: context.breakerSummary,
          sessionId: context.sessionId
        });

        // Convert to prompt
        const prompt = envelopeToPrompt(envelope);
        const systemPrompt = buildSystemPrompt(envelope);

        // Communicate with LLM
        const response = await llmAdapter(prompt, systemPrompt);

        // Validate response
        const validation = validateResponse(response);
        if (!validation.valid) {
          throw new Error(`Invalid response: ${validation.error}`);
        }

        return {
          success: true,
          response: response.text,
          attempt,
          envelope
        };

      } catch (error) {
        lastError = error as Error;
        this.retryCount++;

        if (attempt < this.maxRetries) {
          // Calculate backoff delay
          const backoff = this.backoffPolicy.recommend(
            context.breakerSummary || {},
            {
              minMs: 500,
              maxMs: 10000,
              defaults: { short: 1000, medium: 3000, long: 8000 }
            }
          );

          console.log(`Attempt ${attempt} failed, retrying in ${backoff.waitMs}ms: ${backoff.rationale}`);

          // Wait before retry
          await sleep(backoff.waitMs);
        }
      }
    }

    return {
      success: false,
      error: lastError,
      attempts: this.maxRetries
    };
  }
}
```

### Advanced Retry Strategies

```typescript
class CircuitBreakerAwareCommunicator extends IntelligentCommunicator {
  private circuitBreaker: TrendAwareCircuitBreaker;

  constructor(circuitBreaker: TrendAwareCircuitBreaker) {
    super(new AdaptiveBackoffPolicy());
    this.circuitBreaker = circuitBreaker;
  }

  async communicateWithCircuitBreaker(
    error: string,
    code: string,
    context: any,
    llmAdapter: LLMAdapter
  ): Promise<CommunicationResult> {
    // Check circuit breaker first
    if (!this.circuitBreaker.shouldAttemptFix(context.confidence || 0)) {
      return {
        success: false,
        error: new Error('Circuit breaker open'),
        blocked: true
      };
    }

    // Record attempt
    this.circuitBreaker.recordAttempt({
      errorsDetected: context.errorCount || 1,
      errorsResolved: 0, // Will be updated on success
      confidence: context.confidence || 0,
      errorTypes: [context.errorType || 'unknown'],
      codeQualityScore: context.qualityScore || 0.5
    });

    const result = await this.communicateWithRetry(error, code, context, llmAdapter);

    // Record result
    if (result.success) {
      this.circuitBreaker.recordResult(true, {
        errorsResolved: context.errorCount || 1,
        finalConfidence: context.confidence || 0
      });
    } else {
      this.circuitBreaker.recordResult(false, {
        errorsResolved: 0,
        finalConfidence: 0
      });
    }

    return result;
  }
}
```

## Configuration

### Communication Configuration

```typescript
interface CommunicationConfig {
  backoff: {
    policy: 'default' | 'exponential' | 'adaptive';
    minDelayMs: number;
    maxDelayMs: number;
    jitterRatio: number;
  };
  retry: {
    maxAttempts: number;
    timeoutMs: number;
    retryableErrors: string[];
  };
  context: {
    maxFunctionLines: number;
    includeSurrounding: boolean;
    syntaxAnalysis: boolean;
  };
  validation: {
    responseSchema: boolean;
    contentFiltering: boolean;
    safetyChecks: boolean;
  };
}

const defaultConfig: CommunicationConfig = {
  backoff: {
    policy: 'adaptive',
    minDelayMs: 500,
    maxDelayMs: 10000,
    jitterRatio: 0.2
  },
  retry: {
    maxAttempts: 3,
    timeoutMs: 30000,
    retryableErrors: ['timeout', 'network', 'rate_limit']
  },
  context: {
    maxFunctionLines: 100,
    includeSurrounding: true,
    syntaxAnalysis: true
  },
  validation: {
    responseSchema: true,
    contentFiltering: true,
    safetyChecks: true
  }
};
```

## Monitoring and Metrics

### Communication Metrics

```typescript
interface CommunicationMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  retryCount: number;
  averageResponseTime: number;
  backoffDelays: number[];
  errorTypes: Record<string, number>;
  circuitBreakerTrips: number;
}

class CommunicationMonitor {
  private metrics: CommunicationMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    retryCount: 0,
    averageResponseTime: 0,
    backoffDelays: [],
    errorTypes: {},
    circuitBreakerTrips: 0
  };

  recordRequest(success: boolean, responseTime: number, retryCount: number, errorType?: string): void {
    this.metrics.totalRequests++;

    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    this.metrics.retryCount += retryCount;
    this.updateAverageResponseTime(responseTime);

    if (errorType) {
      this.metrics.errorTypes[errorType] = (this.metrics.errorTypes[errorType] || 0) + 1;
    }
  }

  recordBackoffDelay(delayMs: number): void {
    this.metrics.backoffDelays.push(delayMs);
    if (this.metrics.backoffDelays.length > 1000) {
      this.metrics.backoffDelays.shift(); // Keep recent history
    }
  }

  recordCircuitBreakerTrip(): void {
    this.metrics.circuitBreakerTrips++;
  }

  private updateAverageResponseTime(responseTime: number): void {
    const total = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1);
    this.metrics.averageResponseTime = (total + responseTime) / this.metrics.totalRequests;
  }

  getMetrics(): CommunicationMetrics {
    return { ...this.metrics };
  }
}
```

## Best Practices

### Backoff Strategy Selection
- **Default Policy**: Good for most scenarios with predictable patterns
- **Exponential Backoff**: Useful for external API rate limiting
- **Adaptive Policy**: Best for varying conditions and learning from patterns

### Retry Configuration
- Set appropriate timeouts based on expected response times
- Define clear retryable vs non-retryable errors
- Monitor retry rates to detect systemic issues

### Context Optimization
- Balance context size with processing requirements
- Include relevant surrounding code without noise
- Use syntax analysis to provide actionable insights

### Error Handling
- Implement comprehensive error classification
- Use circuit breakers to prevent cascade failures
- Log detailed error information for debugging

This communication layer ensures reliable, adaptive interaction with AI models while providing comprehensive error recovery and intelligent retry strategies.</content>
<parameter name="filePath">c:\code-heals-itself\docs\communication-layer.md