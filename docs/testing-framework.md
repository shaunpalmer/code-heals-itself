# Testing Framework

The testing framework provides comprehensive coverage for the self-healing debugging system, including unit tests, integration tests, and cross-language validation. The framework uses Jest for TypeScript/JavaScript testing, with additional Python and PHP test suites.

## Overview

The testing framework consists of:

- **Unit Tests**: Individual component testing with Jest
- **Integration Tests**: End-to-end workflow validation
- **Cross-Language Tests**: Python and PHP implementation validation
- **Schema Validation**: JSON Schema compliance testing
- **Performance Tests**: Resource usage and timing validation

## Test Structure

### Directory Layout

```
tests/
├── ts/                    # TypeScript/JavaScript tests
│   ├── *.test.ts         # Unit and integration tests
│   └── *.test.js         # Compiled test artifacts
├── py/                    # Python tests
│   ├── test_*.py         # Python test files
├── php/                   # PHP tests
│   ├── *Test.php         # PHP test files
└── examples/             # Test fixtures and examples
```

### Test Categories

#### Unit Tests (`tests/ts/`)

**Core Component Tests:**
- `trend-aware-breaker.test.ts` - Circuit breaker logic
- `confidence-debug.test.ts` - Confidence scoring system
- `adaptive-backoff.test.ts` - Backoff policy implementation
- `memory-adapter.test.ts` - Memory buffer functionality
- `observer-security.test.ts` - Security observer patterns

**Communication Tests:**
- `jitter-envelope-context.test.ts` - Envelope construction
- `langchain-adapter.test.ts` - LangChain integration
- `langchainChatAdapter.test.ts` - Chat adapter functionality

**Integration Tests:**
- `ai-debugger-integration.test.ts` - Full debugger workflow
- `envelope-guided-breaker.test.ts` - Envelope-guided debugging
- `debug-iteration.test.ts` - Iterative debugging process

## Jest Configuration

### Configuration (`jest.config.js`)

```javascript
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests/ts"],
  testMatch: ["**/*.test.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  moduleNameMapper: {
    // Map TypeScript imports to source files
    "^utils/typescript/(.*)$": "<rootDir>/utils/typescript/$1.ts",
    "^ai-debugging$": "<rootDir>/ai-debugging.ts",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.json" }]
  },
};
```

### Test Scripts (`package.json`)

```json
{
  "scripts": {
    "test": "jest",
    "test:ts": "jest",
    "test:py": "python tests/py/test_patch_envelope.py",
    "test:php": "echo 'PHP not installed - skipping PHP tests'",
    "validate:all": "npm run test:ts && npm run test:py && npm run test:php",
    "validate:schemas": "npm run test:ts"
  }
}
```

## Unit Testing Patterns

### Circuit Breaker Testing

```typescript
describe('Trend-Aware Circuit Breaker', () => {
  let breaker: TrendAwareCircuitBreaker;

  beforeEach(() => {
    breaker = new TrendAwareCircuitBreaker(
      10, // maxAttempts
      3,  // improvementWindow
      4,  // stagnationThreshold
      0.6 // confidenceFloor
    );
  });

  it('should demonstrate improvement trajectory', () => {
    // Test improving error reduction
    const iterations = [
      { errors: 15, confidence: 0.2, quality: 0.3 },
      { errors: 12, confidence: 0.35, quality: 0.4 },
      { errors: 8, confidence: 0.55, quality: 0.6 },
      { errors: 4, confidence: 0.75, quality: 0.8 },
      { errors: 1, confidence: 0.9, quality: 0.95 }
    ];

    iterations.forEach((iteration, index) => {
      const errorsResolved = index > 0 ?
        Math.max(0, iterations[index - 1].errors - iteration.errors) : 0;

      breaker.recordAttempt(
        iteration.errors,
        errorsResolved,
        iteration.confidence,
        [ErrorType.LOGIC, ErrorType.SYNTAX],
        iteration.quality
      );

      const [canAttempt, reason, trend] = breaker.canAttempt();
      const summary = breaker.getTrendSummary();

      // Assertions based on expected behavior
      if (index < 3) {
        expect(canAttempt).toBe(true);
        expect(trend.direction).toBe('improving');
      }
    });
  });
});
```

### Confidence Scoring Testing

```typescript
describe('Confidence Scoring System', () => {
  let scorer: ConfidenceScorer;

  beforeEach(() => {
    scorer = new ConfidenceScorer();
  });

  it('should calculate confidence based on multiple factors', () => {
    const context = {
      errorCount: 5,
      errorTypes: [ErrorType.SYNTAX, ErrorType.LOGIC],
      codeQuality: 0.7,
      testCoverage: 0.8,
      previousAttempts: 2,
      timeSpent: 15000 // 15 seconds
    };

    const confidence = scorer.calculateConfidence(context);

    expect(confidence).toBeGreaterThan(0);
    expect(confidence).toBeLessThanOrEqual(1);

    // Should penalize for multiple error types
    expect(confidence).toBeLessThan(0.8);
  });

  it('should improve confidence with successful fixes', () => {
    const initialContext = {
      errorCount: 10,
      errorTypes: [ErrorType.SYNTAX],
      codeQuality: 0.5,
      testCoverage: 0.6,
      previousAttempts: 0,
      timeSpent: 5000
    };

    const improvedContext = {
      ...initialContext,
      errorCount: 2,
      codeQuality: 0.8,
      previousAttempts: 3,
      timeSpent: 12000
    };

    const initialScore = scorer.calculateConfidence(initialContext);
    const improvedScore = scorer.calculateConfidence(improvedContext);

    expect(improvedScore).toBeGreaterThan(initialScore);
  });
});
```

### Memory Adapter Testing

```typescript
describe('Memory Adapter', () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = new MemoryAdapter(100); // Max 100 entries
  });

  it('should store and retrieve patterns', () => {
    const pattern = {
      error: 'SyntaxError: missing )',
      solution: 'Added missing parenthesis',
      confidence: 0.9,
      language: 'typescript'
    };

    adapter.storePattern(pattern);
    const retrieved = adapter.findSimilarPatterns('SyntaxError', 'typescript');

    expect(retrieved).toContain(pattern);
    expect(retrieved.length).toBeGreaterThan(0);
  });

  it('should respect memory limits', () => {
    // Fill memory beyond capacity
    for (let i = 0; i < 150; i++) {
      adapter.storePattern({
        error: `Error ${i}`,
        solution: `Solution ${i}`,
        confidence: 0.5,
        language: 'typescript'
      });
    }

    const stats = adapter.getStats();
    expect(stats.totalPatterns).toBeLessThanOrEqual(100);
  });
});
```

## Integration Testing

### Full Debugger Workflow

```typescript
describe('AIDebugger integration', () => {
  let aiDebugger: AIDebugger;

  beforeEach(() => {
    const testPolicy: Partial<HealerPolicy> = {
      max_syntax_attempts: 3,
      max_logic_attempts: 5,
      syntax_error_budget: 0.05,
      logic_error_budget: 0.10,
      syntax_conf_floor: 0.30,
      logic_conf_floor: 0.20,
    };
    aiDebugger = new AIDebugger(testPolicy);
  });

  it('should process errors end-to-end', () => {
    const result = aiDebugger.process_error(
      ErrorType.SYNTAX,
      'SyntaxError: missing ) after argument list',
      'console.log("fixed");',
      'console.log("broken"',
      [0.99, 0.98, 0.97]
    );

    expect(result).toBeDefined();
    expect(result.envelope).toBeDefined();
    expect(result.envelope.type).toBe('jitter.request.v1');
    expect(result.action).toBeDefined();
  });

  it('should persist memory across sessions', async () => {
    // Process an error
    aiDebugger.process_error(
      ErrorType.LOGIC,
      'TypeError: Cannot read properties of undefined',
      'if (obj) { console.log(obj.a); }',
      'console.log(obj.a)',
      [0.85, 0.82, 0.80]
    );

    // Save memory
    const path = './test-memory.json';
    await aiDebugger.saveMemory(path);

    // Verify memory was saved
    const stats = aiDebugger.getMemoryStats();
    expect(stats.bufferSize).toBeGreaterThan(0);

    // Load in new instance
    const newDebugger = new AIDebugger();
    await newDebugger.loadMemory(path);
    const newStats = newDebugger.getMemoryStats();

    expect(newStats.bufferSize).toBe(stats.bufferSize);
  });
});
```

### Envelope-Guided Debugging

```typescript
describe('Envelope-Guided Circuit Breaker', () => {
  it('should integrate envelope data with circuit breaker', () => {
    const breaker = new TrendAwareCircuitBreaker();
    const envelopeBuilder = new EnvelopeBuilder();

    // Simulate debugging session
    const initialEnvelope = envelopeBuilder.buildEnvelope({
      errorMessage: 'SyntaxError: unexpected token',
      originalCode: 'function broken() {',
      lastPatch: '',
      language: 'typescript'
    });

    // Record initial attempt
    breaker.recordAttempt({
      errorsDetected: 5,
      errorsResolved: 0,
      confidence: 0.3,
      errorTypes: ['syntax'],
      codeQualityScore: 0.4
    });

    // Process through debugger
    const result = processWithEnvelope(initialEnvelope, breaker);

    expect(result.envelope).toBeDefined();
    expect(result.action).toBeDefined();

    // Verify circuit breaker integration
    const summary = breaker.getTrendSummary();
    expect(summary).toBeDefined();
    expect(summary.recommendation).toBeDefined();
  });
});
```

## Cross-Language Testing

### Python Schema Validation

```python
import json
import os
from jsonschema import validate, ValidationError

def test_valid_patch_envelope():
    """Test that valid patch envelope passes validation"""
    # Load schema and fixtures
    schema_path = os.path.join(os.path.dirname(__file__), "../../schemas/patch-envelope.schema.json")
    fixture_path = os.path.join(os.path.dirname(__file__), "../../schemas/fixtures/patchEnvelope.valid.json")

    with open(schema_path, "r") as f:
        schema = json.load(f)
    with open(fixture_path, "r") as f:
        envelope = json.load(f)

    # Should not raise ValidationError
    validate(instance=envelope, schema=schema)

def test_invalid_patch_envelope():
    """Test that invalid patch envelope fails validation"""
    schema_path = os.path.join(os.path.dirname(__file__), "../../schemas/patch-envelope.schema.json")
    fixture_path = os.path.join(os.path.dirname(__file__), "../../schemas/fixtures/patchEnvelope.invalid.json")

    with open(schema_path, "r") as f:
        schema = json.load(f)
    with open(fixture_path, "r") as f:
        envelope = json.load(f)

    # Should raise ValidationError
    try:
        validate(instance=envelope, schema=schema)
        assert False, "Expected validation to fail"
    except ValidationError:
        pass  # Expected
```

### PHP Error Signature Testing

```php
<?php

require_once __DIR__ . '/../../ai-debugging.php';

class ErrorSignatureTest extends PHPUnit_Framework_TestCase {

    public function testErrorSignatureGeneration() {
        $errorAnalyzer = new ErrorAnalyzer();

        $signature = $errorAnalyzer->generateSignature(
            'SyntaxError: missing ) after argument list',
            'console.log("test"'
        );

        $this->assertNotEmpty($signature);
        $this->assertInternalType('string', $signature);
    }

    public function testSignatureSimilarity() {
        $errorAnalyzer = new ErrorAnalyzer();

        $sig1 = $errorAnalyzer->generateSignature(
            'SyntaxError: missing )',
            'function test() { console.log("test" }'
        );

        $sig2 = $errorAnalyzer->generateSignature(
            'SyntaxError: missing )',
            'if (true) { console.log("test" }'
        );

        $similarity = $errorAnalyzer->calculateSimilarity($sig1, $sig2);
        $this->assertGreaterThan(0.5, $similarity);
    }
}
```

## Performance Testing

### Resource Usage Testing

```typescript
describe('Resource Usage Telemetry', () => {
  let telemetry: ResourceTelemetry;

  beforeEach(() => {
    telemetry = new ResourceTelemetry();
  });

  it('should track memory usage during debugging', () => {
    const initialMemory = telemetry.getCurrentMemoryUsage();

    // Simulate memory-intensive operation
    const largeArray = new Array(1000000).fill('test');

    const peakMemory = telemetry.getCurrentMemoryUsage();

    expect(peakMemory.heapUsed).toBeGreaterThan(initialMemory.heapUsed);
    expect(peakMemory.heapTotal).toBeGreaterThan(0);
  });

  it('should monitor execution time', () => {
    const startTime = telemetry.getCurrentTime();

    // Simulate time-consuming operation
    for (let i = 0; i < 100000; i++) {
      Math.sqrt(i);
    }

    const endTime = telemetry.getCurrentTime();
    const duration = endTime - startTime;

    expect(duration).toBeGreaterThan(0);
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });
});
```

### Load Testing

```typescript
describe('Load Testing', () => {
  it('should handle concurrent debugging sessions', async () => {
    const debugger = new AIDebugger();
    const concurrentSessions = 10;

    const promises = Array(concurrentSessions).fill(null).map((_, index) =>
      debugger.process_error(
        ErrorType.SYNTAX,
        `SyntaxError: test error ${index}`,
        `console.log("fixed ${index}");`,
        `console.log("broken ${index}"`,
        [0.9, 0.8, 0.7]
      )
    );

    const results = await Promise.all(promises);

    expect(results).toHaveLength(concurrentSessions);
    results.forEach(result => {
      expect(result.envelope).toBeDefined();
      expect(result.action).toBeDefined();
    });
  });
});
```

## Test Fixtures and Mocks

### Mock LLM Adapter

```typescript
class MockLLMAdapter {
  private responses: string[] = [];
  private callCount = 0;

  constructor(responses: string[] = []) {
    this.responses = responses;
  }

  async query(prompt: string, systemPrompt?: string): Promise<string> {
    this.callCount++;
    return this.responses[this.callCount - 1] ||
           'Mock response: Added missing semicolon';
  }

  getCallCount(): number {
    return this.callCount;
  }

  reset(): void {
    this.callCount = 0;
  }
}
```

### Test Data Factories

```typescript
class TestDataFactory {
  static createValidEnvelope(): JitterEnvelope {
    return {
      type: 'jitter.request.v1',
      ts: new Date().toISOString(),
      instructions: ['Fix the syntax error'],
      context: {
        error_message: 'SyntaxError: missing )',
        original_code: 'console.log("test"',
        last_patch_code: 'console.log("test");',
        language: 'typescript'
      },
      trend: {},
      metadata: {}
    };
  }

  static createBreakerScenario(type: 'improving' | 'stagnant' | 'worsening'): any[] {
    switch (type) {
      case 'improving':
        return [
          { errors: 10, confidence: 0.3, quality: 0.4 },
          { errors: 7, confidence: 0.5, quality: 0.6 },
          { errors: 3, confidence: 0.8, quality: 0.9 }
        ];
      case 'stagnant':
        return [
          { errors: 8, confidence: 0.4, quality: 0.5 },
          { errors: 8, confidence: 0.4, quality: 0.5 },
          { errors: 9, confidence: 0.3, quality: 0.4 }
        ];
      case 'worsening':
        return [
          { errors: 5, confidence: 0.6, quality: 0.7 },
          { errors: 8, confidence: 0.4, quality: 0.5 },
          { errors: 12, confidence: 0.2, quality: 0.3 }
        ];
    }
  }
}
```

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20]

    steps:
    - uses: actions/checkout@v3
    - name: Setup Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run TypeScript tests
      run: npm run test:ts

    - name: Run Python tests
      run: npm run test:py

    - name: Run PHP tests
      run: npm run test:php

    - name: Validate schemas
      run: npm run validate:schemas

    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
```

## Test Coverage Metrics

### Coverage Configuration

```javascript
// jest.config.js
module.exports = {
  // ... other config
  collectCoverage: true,
  collectCoverageFrom: [
    'utils/typescript/**/*.ts',
    'src/**/*.ts',
    'ai-debugging.ts',
    '!**/*.d.ts',
    '!**/node_modules/**'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  }
};
```

### Coverage Goals

- **Unit Tests**: 85%+ coverage for core utilities
- **Integration Tests**: Full workflow coverage
- **Cross-Language**: Schema validation coverage
- **Error Paths**: Comprehensive error scenario testing

## Best Practices

### Test Organization
- Group related tests in describe blocks
- Use beforeEach/afterEach for setup/teardown
- Name tests descriptively with behavior expectations
- Keep tests focused and independent

### Mocking Strategy
- Mock external dependencies (LLM adapters, file system)
- Use factories for complex test data
- Avoid over-mocking internal components
- Test integration points thoroughly

### Performance Considerations
- Use appropriate timeouts for async tests
- Mock slow operations in unit tests
- Run performance tests separately from unit tests
- Monitor test execution time

### Cross-Language Testing
- Validate schemas in all supported languages
- Test language-specific error patterns
- Ensure consistent behavior across implementations
- Use language-appropriate testing frameworks

This comprehensive testing framework ensures reliability, performance, and cross-language compatibility of the self-healing debugging system.</content>
<parameter name="filePath">c:\code-heals-itself\docs\testing-framework.md