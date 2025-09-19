# Multi-Language Support

The self-healing debugging system provides comprehensive multi-language support with consistent behavior across TypeScript, JavaScript, Python, and PHP implementations. Each language maintains feature parity while leveraging language-specific strengths.

## Overview

The multi-language architecture includes:

- **TypeScript**: Primary implementation with full type safety
- **JavaScript**: Compiled output from TypeScript for Node.js environments
- **Python**: Native Python implementation for data science and ML workflows
- **PHP**: Server-side implementation for web applications
- **Cross-Language Compatibility**: Consistent APIs and data structures
- **Schema Validation**: Unified JSON schemas across all languages

## Language Implementations

### TypeScript (`ai-debugging.ts`)

The primary implementation providing full type safety and comprehensive features.

```typescript
import {
  UnifiedConfidenceScorer, DualCircuitBreaker, ErrorType, ConfidenceScore
} from "./utils/typescript/confidence_scoring";
import {
  CascadingErrorHandler, SandboxExecution, Environment
} from "./utils/typescript/cascading_error_handler";
import { AIPatchEnvelope, PatchEnvelope, MemoryBuffer } from "./utils/typescript/envelope";
import { Debugger, LogAndFixStrategy, RollbackStrategy, SecurityAuditStrategy } from "./utils/typescript/strategy";
import { SeniorDeveloperSimulator } from "./utils/typescript/human_debugging";

export class AIDebugger {
  private policy: HealerPolicy;
  private scorer: UnifiedConfidenceScorer;
  private breaker: DualCircuitBreaker;
  private cascade: CascadingErrorHandler;
  private sandbox: SandboxExecution;
  private enveloper: AIPatchEnvelope;
  private memory: MemoryBuffer;
  private human: SeniorDeveloperSimulator;
  private debugger: Debugger;

  constructor(policy?: Partial<HealerPolicy>) {
    this.policy = { ...defaultPolicy, ...policy };
    this.scorer = new UnifiedConfidenceScorer(1.0, 1000);
    this.breaker = new DualCircuitBreaker(
      this.policy.max_syntax_attempts,
      this.policy.max_logic_attempts,
      this.policy.syntax_error_budget,
      this.policy.logic_error_budget
    );
    this.cascade = new CascadingErrorHandler();
    this.sandbox = new SandboxExecution();
    this.enveloper = new AIPatchEnvelope();
    this.memory = new MemoryBuffer();
    this.human = new SeniorDeveloperSimulator();
    this.debugger = new Debugger();
  }

  async process_error(
    errorType: ErrorType,
    message: string,
    patchCode: string,
    originalCode: string,
    logits?: number[]
  ): Promise<{ action: string; envelope: any }> {
    // Implementation follows consistent pattern across languages
  }
}
```

#### Key Features
- **Full Type Safety**: Comprehensive TypeScript interfaces and type checking
- **Advanced Circuit Breaker**: Trend-aware circuit breaker with gradient analysis
- **Observer Pattern**: Security monitoring and risk assessment
- **Schema Validation**: AJV-based JSON schema validation
- **Backoff Policies**: Intelligent retry strategies with jitter
- **Jitter Communication**: Structured LLM interaction protocols

### JavaScript (`ai-debugging.js`)

Compiled JavaScript output from TypeScript, optimized for Node.js environments.

```javascript
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIDebugger = exports.policyPresets = exports.defaultPolicy = void 0;

// Compiled from TypeScript with full feature parity
class AIDebugger {
  constructor(policy) {
    this.policy = policy || defaultPolicy;
    // Full implementation matching TypeScript version
  }

  async process_error(errorType, message, patchCode, originalCode, logits) {
    // Consistent API with TypeScript implementation
  }
}

exports.AIDebugger = AIDebugger;
```

#### Key Features
- **Node.js Compatible**: Direct execution in Node.js environments
- **NPM Package Ready**: Can be published as standalone npm package
- **Feature Parity**: All TypeScript features available in JavaScript
- **CommonJS/ESM Support**: Flexible module system support

### Python (`ai-debugging.py`)

Native Python implementation optimized for data science and machine learning workflows.

```python
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, Optional, Callable, List
import time
import json

from confidence_scoring import (
    UnifiedConfidenceScorer, DualCircuitBreaker, ErrorType, ConfidenceScore
)
from cascading_error_handler import CascadingErrorHandler, SandboxExecution, Environment
from envelope import AIPatchEnvelope, PatchEnvelope, MemoryBuffer
from strategy import Debugger, LogAndFixStrategy, RollbackStrategy, SecurityAuditStrategy
from human_debugging import SeniorDeveloperSimulator

@dataclass
class HealerPolicy:
    syntax_conf_floor: float = 0.98
    logic_conf_floor: float = 0.80
    max_syntax_attempts: int = 3
    max_logic_attempts: int = 10
    syntax_error_budget: float = 0.03
    logic_error_budget: float = 0.10
    rate_limit_per_min: int = 10
    sandbox_isolation: str = "full"
    require_human_on_risky: bool = True
    risky_keywords: List[str] = [
        "database_schema_change", "authentication_bypass", "production_data_modification"
    ]

class AIDebugger:
    def __init__(self, policy: Optional[HealerPolicy] = None):
        self.policy = policy or HealerPolicy()
        self.enveloper = AIPatchEnvelope()
        self.scorer = UnifiedConfidenceScorer(1.0, 1000)
        self.breaker = DualCircuitBreaker(
            self.policy.max_syntax_attempts,
            self.policy.max_logic_attempts,
            self.policy.syntax_error_budget,
            self.policy.logic_error_budget
        )
        self.cascade = CascadingErrorHandler()
        self.sandbox = SandboxExecution()
        self.memory = MemoryBuffer()
        self.human = SeniorDeveloperSimulator()
        self.debugger = Debugger()

    def process_error(
        self,
        error_type: str,
        message: str,
        patch_code: str,
        original_code: str,
        logits: Optional[List[float]] = None
    ) -> Dict[str, Any]:
        # Consistent implementation with TypeScript version
        pass
```

#### Key Features
- **Type Hints**: Full type annotation support
- **Data Science Ready**: Integrates with pandas, numpy, scikit-learn
- **Jupyter Notebook Support**: Works seamlessly in Jupyter environments
- **Async/Await Support**: Native Python async/await patterns
- **Schema Validation**: jsonschema library integration

### PHP (`ai-debugging.php`)

Server-side PHP implementation for web applications and traditional server environments.

```php
<?php
declare(strict_types=1);

require_once __DIR__ . '/confidence_scoring.php';
require_once __DIR__ . '/cascading_error_handler.php';
require_once __DIR__ . '/envelope.php';
require_once __DIR__ . '/strategy.php';
require_once __DIR__ . '/human_debugging.php';

final class HealerPolicy {
    public float $syntax_conf_floor = 0.98;
    public float $logic_conf_floor  = 0.80;
    public int   $max_syntax_attempts = 3;
    public int   $max_logic_attempts  = 10;
    public float $syntax_error_budget = 0.03;
    public float $logic_error_budget  = 0.10;
    public int   $rate_limit_per_min  = 10;
    public string $sandbox_isolation  = 'full';
    public bool $require_human_on_risky = true;
    /** @var string[] */
    public array $risky_keywords = [
        'database_schema_change',
        'authentication_bypass',
        'production_data_modification'
    ];
}

final class AIDebugger {
    private HealerPolicy $policy;
    private UnifiedConfidenceScorer $scorer;
    private DualCircuitBreaker $breaker;
    private CascadingErrorHandler $cascade;
    private SandboxExecution $sandbox;
    private AIPatchEnvelope $enveloper;
    private MemoryBuffer $memory;
    private SeniorDeveloperSimulator $human;
    private Debugger $debugger;

    public function __construct(?HealerPolicy $policy = null) {
        $this->policy = $policy ?? new HealerPolicy();
        $this->scorer   = new UnifiedConfidenceScorer(1.0, 1000);
        $this->breaker  = new DualCircuitBreaker(
            $this->policy->max_syntax_attempts,
            $this->policy->max_logic_attempts,
            $this->policy->syntax_error_budget,
            $this->policy->logic_error_budget
        );
        $this->cascade  = new CascadingErrorHandler();
        $this->sandbox  = new SandboxExecution();
        $this->enveloper = new AIPatchEnvelope();
        $this->memory   = new MemoryBuffer();
        $this->human    = new SeniorDeveloperSimulator();
        $this->debugger = new Debugger();
    }

    public function processError(
        string $errorType,
        string $message,
        string $patchCode,
        string $originalCode,
        ?array $logits = null
    ): array {
        // Consistent implementation with other languages
    }
}
```

#### Key Features
- **Strict Types**: Full PHP 7.4+ strict typing support
- **Composer Ready**: PHP package management integration
- **Web Framework Integration**: Works with Laravel, Symfony, etc.
- **Schema Validation**: Opis JSON Schema integration
- **PSR Standards**: Follows PHP-FIG standards

## Cross-Language Compatibility

### Consistent API Design

All language implementations provide the same core API:

```typescript
// TypeScript
interface AIDebugger {
  process_error(
    errorType: ErrorType,
    message: string,
    patchCode: string,
    originalCode: string,
    logits?: number[]
  ): Promise<{ action: string; envelope: any }>;
}
```

```python
# Python
class AIDebugger:
    def process_error(
        self,
        error_type: str,
        message: str,
        patch_code: str,
        original_code: str,
        logits: Optional[List[float]] = None
    ) -> Dict[str, Any]:
        pass
```

```php
// PHP
class AIDebugger {
    public function processError(
        string $errorType,
        string $message,
        string $patchCode,
        string $originalCode,
        ?array $logits = null
    ): array;
}
```

### Shared Data Structures

#### HealerPolicy Configuration

```typescript
interface HealerPolicy {
  syntax_conf_floor: number;
  logic_conf_floor: number;
  max_syntax_attempts: number;
  max_logic_attempts: number;
  syntax_error_budget: number;
  logic_error_budget: number;
  rate_limit_per_min: number;
  sandbox_isolation: string;
  require_human_on_risky: boolean;
  risky_keywords: string[];
}
```

#### Error Types

```typescript
enum ErrorType {
  SYNTAX = 'SYNTAX',
  LOGIC = 'LOGIC',
  RUNTIME = 'RUNTIME',
  PERFORMANCE = 'PERFORMANCE',
  SECURITY = 'SECURITY'
}
```

#### Response Format

```typescript
interface DebugResponse {
  action: string;
  envelope: PatchEnvelope;
  success: boolean;
  confidence: number;
  attempts: number;
  error_budget_remaining: number;
}
```

## Language-Specific Utilities

### TypeScript Utilities

```typescript
// Advanced type safety and inference
type LanguageSupport = 'javascript' | 'typescript' | 'python' | 'php';
type ErrorPattern = RegExp;
type ConfidenceThreshold = number;

interface TypeSafeDebugger extends AIDebugger {
  validateTypes<T>(data: T): T;
  inferTypes(code: string): LanguageSupport;
}
```

### Python Utilities

```python
# Data science and ML integrations
import pandas as pd
import numpy as np
from typing import TypeVar, Generic

T = TypeVar('T')

class PandasDebugger(Generic[T]):
    def debug_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Debug pandas DataFrame operations"""
        pass

    def validate_ml_pipeline(self, pipeline: Any) -> bool:
        """Validate machine learning pipelines"""
        pass
```

### PHP Utilities

```php
// Web framework integrations
namespace SelfHealing;

class LaravelDebugger extends AIDebugger {
    public function debugEloquentQuery(string $query): array {
        // Debug Laravel Eloquent queries
    }

    public function validateMiddleware(array $middleware): bool {
        // Validate Laravel middleware
    }
}
```

## Testing Across Languages

### Cross-Language Test Suite

```typescript
// TypeScript test runner
describe('Cross-Language Compatibility', () => {
  const languages = ['typescript', 'javascript', 'python', 'php'];

  languages.forEach(language => {
    describe(`${language} implementation`, () => {
      it('should process errors consistently', async () => {
        const debugger = createDebuggerForLanguage(language);
        const result = await debugger.process_error(
          'SYNTAX',
          'Missing semicolon',
          'console.log("fixed");',
          'console.log("broken")'
        );

        expect(result.action).toBeDefined();
        expect(result.envelope).toBeDefined();
      });
    });
  });
});
```

### Schema Validation Tests

```python
# Python schema validation test
def test_cross_language_schema_compliance():
    """Test that all language implementations produce schema-compliant output"""
    languages = ['typescript', 'javascript', 'python', 'php']

    for language in languages:
        debugger = create_debugger_for_language(language)
        result = debugger.process_error(
            error_type='SYNTAX',
            message='Test error',
            patch_code='fixed code',
            original_code='broken code'
        )

        # Validate against unified schema
        schema_validator = SchemaValidator()
        assert schema_validator.validate_patch_envelope(result['envelope'])['valid']
```

## Performance Characteristics

### Language Performance Comparison

| Language | Startup Time | Memory Usage | Throughput | Best Use Case |
|----------|-------------|--------------|------------|---------------|
| TypeScript | Fast | Moderate | High | Primary development |
| JavaScript | Fastest | Low | Highest | Production deployment |
| Python | Slow | High | Medium | Data science/ML |
| PHP | Medium | Moderate | Medium | Web applications |

### Optimization Strategies

#### TypeScript/JavaScript
- **Tree Shaking**: Remove unused code in production
- **Bundle Splitting**: Load features on demand
- **WebAssembly**: Performance-critical components

#### Python
- **PyPy**: Alternative Python implementation for speed
- **Cython**: Compile Python to C for performance
- **Numba**: JIT compilation for numerical code

#### PHP
- **OPcache**: Bytecode caching
- **JIT Compiler**: PHP 8+ JIT compilation
- **Async**: ReactPHP for concurrent processing

## Integration Patterns

### Framework Integrations

#### Node.js/Express
```javascript
const express = require('express');
const { AIDebugger } = require('self-healing-debugger');

const app = express();
const debugger = new AIDebugger();

app.post('/api/debug', async (req, res) => {
  const result = await debugger.process_error(
    req.body.error_type,
    req.body.message,
    req.body.patch_code,
    req.body.original_code
  );
  res.json(result);
});
```

#### Python/Flask
```python
from flask import Flask, request, jsonify
from ai_debugging import AIDebugger

app = Flask(__name__)
debugger = AIDebugger()

@app.route('/api/debug', methods=['POST'])
def debug():
    data = request.get_json()
    result = debugger.process_error(
        data['error_type'],
        data['message'],
        data['patch_code'],
        data['original_code']
    )
    return jsonify(result)
```

#### PHP/Laravel
```php
<?php

use Illuminate\Http\Request;
use SelfHealing\AIDebugger;

class DebugController extends Controller {
    private AIDebugger $debugger;

    public function __construct() {
        $this->debugger = new AIDebugger();
    }

    public function debug(Request $request) {
        $result = $this->debugger->processError(
            $request->input('error_type'),
            $request->input('message'),
            $request->input('patch_code'),
            $request->input('original_code')
        );

        return response()->json($result);
    }
}
```

## Deployment Considerations

### Environment-Specific Builds

#### Docker Multi-Stage Builds
```dockerfile
# Multi-language support in single container
FROM node:18 AS typescript-build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM python:3.11 AS python-build
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .

FROM php:8.2 AS php-build
WORKDIR /app
COPY composer.json .
RUN composer install
COPY . .

FROM node:18-slim AS runtime
# Combine all language runtimes
```

#### Language-Specific Deployments
```yaml
# Kubernetes multi-language deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: self-healing-debugger
spec:
  template:
    spec:
      containers:
      - name: typescript-service
        image: debugger-typescript:latest
      - name: python-service
        image: debugger-python:latest
      - name: php-service
        image: debugger-php:latest
```

## Best Practices

### Development Workflow
- **Primary Development**: Use TypeScript for new features
- **Cross-Language Testing**: Test all implementations for compatibility
- **Schema Validation**: Always validate data structures
- **Performance Monitoring**: Track performance across languages

### Maintenance
- **Feature Parity**: Keep all language implementations in sync
- **Dependency Management**: Update dependencies consistently
- **Security Updates**: Apply security patches across all languages
- **Documentation**: Maintain consistent documentation

### Performance Optimization
- **Lazy Loading**: Load language-specific features on demand
- **Caching**: Cache compiled schemas and validation results
- **Resource Pooling**: Share resources across language runtimes
- **Monitoring**: Track performance metrics by language

This multi-language architecture ensures the self-healing debugging system can be deployed and integrated across diverse technology stacks while maintaining consistent behavior and performance characteristics.</content>
<parameter name="filePath">c:\code-heals-itself\docs\multi-language-support.md