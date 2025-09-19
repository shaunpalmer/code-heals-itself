# Observer Pattern Implementation

The observer system provides comprehensive monitoring, security validation, and resource management for the self-healing debugging process. It implements the classic observer pattern with specialized observers for different aspects of the debugging workflow.

## Overview

The observer system consists of multiple specialized observers that monitor different aspects of the debugging process:

- **PatchObserver**: Monitors patch application and success
- **HangWatchdog**: Prevents resource exhaustion and infinite loops
- **RiskyEditObserver**: Security validation for potentially dangerous code changes
- **PathResolutionObserver**: Validates import paths and file references

## Core Architecture

### Observer Pattern Implementation

```typescript
abstract class Observer {
  abstract update(subject: Subject, data: Record<string, any>): void;
}

class Subject {
  private observers: Observer[] = [];

  attach(observer: Observer): void {
    // Add observer to list
  }

  detach(observer: Observer): void {
    // Remove observer from list
  }

  notify(data: Record<string, any>): void {
    // Notify all observers
  }
}
```

### Integration with AIDebugger

```typescript
class AIDebugger {
  private observers: Observer[] = [];

  attachObserver(observer: Observer): void {
    this.observers.push(observer);
  }

  private notifyObservers(data: any): void {
    this.observers.forEach(observer => observer.update(this, data));
  }
}
```

## Specialized Observers

### PatchObserver

Monitors patch application and tracks success/failure patterns:

```typescript
class PatchObserver extends Observer {
  update(subject: Subject, data: Record<string, any>): void {
    const outcome = {
      observer: this.name,
      patch_success: data.success || false,
      patch_name: data.patch_name || "",
      details: data.details || "",
      timestamp: data.timestamp || new Date().toISOString()
    };

    // Log to monitoring system
    this.logOutcome(outcome);
  }
}
```

### HangWatchdog

Prevents resource exhaustion and detects performance issues:

```typescript
type WatchdogEvent = {
  triggered: boolean;
  reason?: string;
  severity?: 'low' | 'medium' | 'high';
  suspicion?: 'none' | 'suspicious' | 'danger' | 'extreme';
  observed?: {
    execution_time_ms?: number;
    memory_used_mb?: number;
    cpu_used_percent?: number;
    limits_hit?: { time: boolean; memory: boolean; cpu: boolean };
  };
};

class HangWatchdog {
  private inFlight: Map<string, number> = new Map();

  constructor(
    private thresholdMs: number = 5000,
    private cpuThresholdPercent: number = 90
  ) {}

  beginAttempt(key: string): void {
    this.inFlight.set(key, Date.now());
  }

  endAttempt(key: string, context?: any): WatchdogEvent {
    const startTime = this.inFlight.get(key);
    if (!startTime) return { triggered: false };

    const executionTime = Date.now() - startTime;
    this.inFlight.delete(key);

    // Check execution time limits
    const timeExceeded = executionTime > this.thresholdMs;

    // Check CPU usage
    const cpuUsage = context?.resourceUsage?.cpu_used_percent;
    const cpuHot = cpuUsage && cpuUsage >= this.cpuThresholdPercent;

    // Check resource limits
    const limitsHit = context?.sandbox?.limits_hit || {};

    if (timeExceeded || cpuHot || limitsHit.time || limitsHit.cpu) {
      return {
        triggered: true,
        reason: this.determineReason(timeExceeded, cpuHot, limitsHit),
        severity: this.calculateSeverity(limitsHit),
        suspicion: this.calculateSuspicion(executionTime, cpuUsage),
        observed: {
          execution_time_ms: executionTime,
          cpu_used_percent: cpuUsage,
          limits_hit: limitsHit
        }
      };
    }

    return { triggered: false, suspicion: 'none' };
  }
}
```

### RiskyEditObserver

Security validation for code patches:

```typescript
type RiskFlag = {
  flag: string; // 'keyword' | 'size'
  reason: string;
  category?: string; // e.g., 'sql_injection', 'xss', 'auth_bypass'
  level?: 'low' | 'medium' | 'high' | 'extreme';
  keyword?: string;
};

class RiskyEditObserver {
  constructor(
    private keywords: string[] = [],
    private maxLinesChanged: number = 50
  ) {}

  evaluate(patchCode: string, originalCode?: string): RiskFlag[] {
    const flags: RiskFlag[] = [];

    // Check for security vulnerabilities
    flags.push(...this.checkSecurityVulnerabilities(patchCode));

    // Check custom keywords
    flags.push(...this.checkCustomKeywords(patchCode));

    // Check code size changes
    flags.push(...this.checkSizeLimits(patchCode, originalCode));

    return flags;
  }

  private checkSecurityVulnerabilities(code: string): RiskFlag[] {
    const vulnerabilities = [
      { pattern: /drop table|union select|or 1=1/, category: 'sql_injection', level: 'high' },
      { pattern: /<script|onerror=|javascript:/, category: 'xss', level: 'high' },
      { pattern: /eval\(|child_process\.exec/, category: 'code_exec', level: 'high' },
      { pattern: /sudo |setuid/, category: 'privilege_escalation', level: 'high' }
    ];

    // Implementation details...
  }
}
```

### PathResolutionObserver

Validates import paths and file references:

```typescript
type MissingPath = {
  source: string; // the import string as written
  resolved?: string; // resolved absolute path when found
  reason: string; // e.g. 'not_found' | 'unresolved_alias'
};

class PathResolutionObserver {
  constructor(
    private projectRoot: string = process.cwd(),
    private extraResolvers: Array<(p: string) => string | null> = []
  ) {}

  evaluate(sourceCode: string, sourceFilePath?: string): MissingPath[] {
    const missing: MissingPath[] = [];

    // Extract import statements
    const imports = this.extractImports(sourceCode);

    for (const importPath of imports) {
      if (!this.canResolve(importPath, sourceFilePath)) {
        missing.push({
          source: importPath,
          reason: 'not_found'
        });
      }
    }

    return missing;
  }
}
```

## Usage Examples

### Basic Observer Setup

```typescript
import { AIDebugger, PatchObserver, HangWatchdog, RiskyEditObserver } from './utils/typescript/observer';

const debugger = new AIDebugger();

// Attach observers
debugger.attachObserver(new PatchObserver('main-observer'));
debugger.attachObserver(new HangWatchdog(5000, 90));
debugger.attachObserver(new RiskyEditObserver());

// Observers will automatically monitor debugging attempts
const result = await debugger.heal(error, context);
```

### Custom Observer Implementation

```typescript
class MetricsObserver extends Observer {
  private metrics: any[] = [];

  update(subject: AIDebugger, data: any): void {
    this.metrics.push({
      timestamp: new Date(),
      operation: data.operation,
      success: data.success,
      duration: data.duration,
      confidence: data.confidence
    });

    // Send to monitoring system
    this.sendToMonitoring(this.metrics);
  }
}
```

### Security Integration

```typescript
class SecurityObserver extends Observer {
  update(subject: AIDebugger, data: any): void {
    if (data.operation === 'patch_attempt') {
      const riskFlags = this.evaluateSecurityRisk(data.patchCode);

      if (riskFlags.some(flag => flag.level === 'high')) {
        // Block high-risk patches
        this.blockPatch(data.patchId, riskFlags);
      } else if (riskFlags.some(flag => flag.level === 'medium')) {
        // Flag for review
        this.flagForReview(data.patchId, riskFlags);
      }
    }
  }
}
```

## Configuration

### Observer Configuration

```typescript
interface ObserverConfig {
  hangWatchdog: {
    thresholdMs: number;
    cpuThresholdPercent: number;
  };
  riskyEdit: {
    keywords: string[];
    maxLinesChanged: number;
  };
  pathResolution: {
    projectRoot: string;
    extraResolvers: Function[];
  };
}

const config: ObserverConfig = {
  hangWatchdog: {
    thresholdMs: 5000,
    cpuThresholdPercent: 90
  },
  riskyEdit: {
    keywords: ['dangerous_function', 'insecure_method'],
    maxLinesChanged: 50
  },
  pathResolution: {
    projectRoot: process.cwd(),
    extraResolvers: []
  }
};
```

## Monitoring and Metrics

### Observer Metrics

```typescript
interface ObserverMetrics {
  observerName: string;
  eventsProcessed: number;
  alertsTriggered: number;
  lastActivity: Date;
  performance: {
    averageProcessingTime: number;
    maxProcessingTime: number;
    errorRate: number;
  };
}
```

### Watchdog Metrics

```typescript
interface WatchdogMetrics {
  attemptsMonitored: number;
  timeoutsDetected: number;
  resourceLimitHits: number;
  suspicionLevels: Record<string, number>;
  averageExecutionTime: number;
}
```

## Best Practices

### Observer Design

**Single Responsibility:**
- Each observer should focus on one aspect (security, performance, etc.)
- Avoid complex interdependencies between observers

**Performance:**
- Keep observer logic lightweight
- Use asynchronous processing for heavy operations
- Implement rate limiting for high-frequency events

**Error Handling:**
- Observers should not throw exceptions
- Use try-catch blocks and log errors
- Continue operation even if an observer fails

### Security Considerations

**Input Validation:**
- Validate all data passed to observers
- Sanitize file paths and code snippets
- Use allowlists for dangerous operations

**Resource Limits:**
- Implement timeouts for observer operations
- Monitor memory usage of observers
- Set limits on concurrent observer executions

### Testing

```typescript
describe('RiskyEditObserver', () => {
  it('detects SQL injection patterns', () => {
    const observer = new RiskyEditObserver();
    const flags = observer.evaluate("DROP TABLE users");

    expect(flags).toContainEqual(
      expect.objectContaining({
        category: 'sql_injection',
        level: 'high'
      })
    );
  });
});
```

## Troubleshooting

### Common Issues

**Observers not triggering:**
- Check that observers are properly attached to the subject
- Verify observer update method signatures
- Check for exceptions in observer code

**Performance degradation:**
- Profile observer execution times
- Implement caching for expensive operations
- Use sampling for high-frequency events

**Memory leaks:**
- Ensure observers clean up resources properly
- Monitor observer instance counts
- Implement garbage collection hints

**False positives/negatives:**
- Tune detection thresholds
- Review pattern matching logic
- Update security rules regularly

This observer system provides comprehensive monitoring and security validation, ensuring safe and reliable operation of the self-healing debugging process.</content>
<parameter name="filePath">c:\code-heals-itself\docs\observer-system.md