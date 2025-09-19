# JSON Schemas and Data Structures

The schema system provides validation and structure for the self-healing debugging system, ensuring consistent data exchange across all language implementations.

## Overview

The schema system consists of:

- **Unified Schema**: Single comprehensive schema for all data structures
- **Validation Framework**: JSON Schema validation for data integrity
- **Cross-Language Compatibility**: Consistent structure across TypeScript, Python, and PHP
- **Version Control**: Schema versioning and migration support

## Current Schema Files

### `selfhealing.schema.json` - Unified Schema

The main schema file that defines all data structures used by the self-healing system.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://selfhealing.system/schema/patch-envelope.json",
  "title": "AI Self-Healing System Schema",
  "description": "Unified schema for patch envelopes and circuit breaker policies",
  "definitions": {
    "circuitBreakerPolicy": {
      "type": "object",
      "description": "Circuit breaker policy configuration for different model capability classes",
      "properties": {
        "modelClass": {
          "type": "string",
          "enum": ["sota", "mid-tier", "local-small"],
          "description": "Model capability: sota (GPT-4/5, Claude 3), mid-tier (Llama 3, Mistral), local-small (7B/13B)"
        }
      }
    },
    "patchEnvelope": {
      "type": "object",
      "required": ["patch_id", "patch_data", "metadata", "attempts"],
      "properties": {
        "patch_id": { "type": "string" },
        "patch_data": {
          "type": "object",
          "required": ["language", "patched_code", "original_code"],
          "properties": {
            "language": { "type": "string", "enum": ["python", "php", "javascript", "typescript"] },
            "patched_code": { "type": "string" },
            "original_code": { "type": "string" },
            "diff": { "type": "string" }
          }
        }
      }
    }
  }
}
```

#### Key Schema Components

##### Circuit Breaker Policy

```typescript
interface CircuitBreakerPolicy {
  modelClass: "sota" | "mid-tier" | "local-small";
  syntax_error_budget: number;     // 0.01-0.50
  logic_error_budget: number;      // 0.05-0.50
  max_syntax_attempts: number;     // 1-20
  max_logic_attempts: number;      // 3-20
  confidence_floor_syntax: number; // 0.1-0.99
  confidence_floor_logic: number;  // 0.1-0.90
}
```

##### Patch Envelope

```typescript
interface PatchEnvelope {
  patch_id: string;
  patch_data: {
    language: "python" | "php" | "javascript" | "typescript";
    patched_code: string;
    original_code: string;
    diff?: string;
  };
  metadata: {
    created_at: string;
    ai_generated?: boolean;
    service?: string;
    env?: string;
  };
  attempts: Array<{
    ts: number;
    success: boolean;
    note?: string;
    breaker?: {
      state: "OPEN" | "CLOSED" | "HALF_OPEN";
      failure_count: number;
    };
  }>;
}
```

##### Trend Metadata

```typescript
interface TrendMetadata {
  errorsDetected: number;           // Total errors found
  errorsResolved: number;           // Errors fixed from previous attempts
  errorTrend: "improving" | "plateauing" | "worsening" | "unknown";
  codeQualityScore: number;         // 0-1 quality score
  improvementVelocity: number;      // 0-1 improvement rate
  stagnationRisk: number;           // 0-1 risk of getting stuck
}
```

##### Breaker State

```typescript
interface BreakerState {
  state: "OPEN" | "CLOSED" | "HALF_OPEN";
  cascadeDepth: number;
  resourceUsage: {
    cpuPercent: number;
    memoryMB: number;
    executionTimeMs: number;
    sideEffects: string[];
  };
  flagged_for_developer: boolean;
  developer_message?: string;
  success: boolean;
  timestamp: string;
}
```

## Schema Validation

### TypeScript Implementation

```typescript
import { validate } from 'jsonschema';
import * as fs from 'fs';
import * as path from 'path';

class SchemaValidator {
  private schema: any;

  constructor() {
    const schemaPath = path.resolve(__dirname, 'schemas', 'selfhealing.schema.json');
    this.schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  }

  validatePatchEnvelope(data: any): { valid: boolean; errors?: any[] } {
    const result = validate(data, this.schema.definitions.patchEnvelope);

    return {
      valid: result.valid,
      errors: result.errors
    };
  }

  validateCircuitBreakerPolicy(data: any): { valid: boolean; errors?: any[] } {
    const result = validate(data, this.schema.definitions.circuitBreakerPolicy);

    return {
      valid: result.valid,
      errors: result.errors
    };
  }
}
```

### Python Implementation

```python
import json
import jsonschema
from pathlib import Path

class SchemaValidator:
    def __init__(self):
        schema_path = Path(__file__).parent / 'schemas' / 'selfhealing.schema.json'
        with open(schema_path, 'r') as f:
            self.schema = json.load(f)

    def validate_patch_envelope(self, data: dict) -> dict:
        try:
            jsonschema.validate(data, self.schema['definitions']['patchEnvelope'])
            return {'valid': True}
        except jsonschema.ValidationError as e:
            return {'valid': False, 'errors': [str(e)]}

    def validate_circuit_breaker_policy(self, data: dict) -> dict:
        try:
            jsonschema.validate(data, self.schema['definitions']['circuitBreakerPolicy'])
            return {'valid': True}
        except jsonschema.ValidationError as e:
            return {'valid': False, 'errors': [str(e)]}
```

### PHP Implementation

```php
<?php

class SchemaValidator {
    private $schema;

    public function __construct() {
        $schemaPath = __DIR__ . '/schemas/selfhealing.schema.json';
        $this->schema = json_decode(file_get_contents($schemaPath), true);
    }

    public function validatePatchEnvelope($data) {
        return $this->validateAgainstSchema(
            $data,
            $this->schema['definitions']['patchEnvelope']
        );
    }

    public function validateCircuitBreakerPolicy($data) {
        return $this->validateAgainstSchema(
            $data,
            $this->schema['definitions']['circuitBreakerPolicy']
        );
    }

    private function validateAgainstSchema($data, $schema) {
        // Using opis/json-schema or similar PHP JSON Schema validator
        $validator = new Opis\JsonSchema\Validator();
        $result = $validator->validate($data, $schema);

        if ($result->isValid()) {
            return ['valid' => true];
        } else {
            $errors = [];
            foreach ($result->getErrors() as $error) {
                $errors[] = $error->getMessage();
            }
            return ['valid' => false, 'errors' => $errors];
        }
    }
}
```

## Data Structure Examples

### Circuit Breaker Policy Example

```json
{
  "modelClass": "mid-tier",
  "syntax_error_budget": 0.10,
  "logic_error_budget": 0.20,
  "max_syntax_attempts": 5,
  "max_logic_attempts": 7,
  "confidence_floor_syntax": 0.30,
  "confidence_floor_logic": 0.25
}
```

### Patch Envelope Example

```json
{
  "patch_id": "550e8400-e29b-41d4-a716-446655440000",
  "patch_data": {
    "language": "typescript",
    "patched_code": "function test() {\n  console.log('fixed');\n}",
    "original_code": "function test() {\n  console.log('broken')\n}",
    "diff": "@@ -1,2 +1,2 @@\n function test() {\n-  console.log('broken')\n+  console.log('fixed');\n }"
  },
  "metadata": {
    "created_at": "2025-09-19T10:30:00Z",
    "ai_generated": true,
    "service": "self-healing-debugger",
    "env": "development"
  },
  "attempts": [
    {
      "ts": 1632048600000,
      "success": false,
      "note": "Syntax error in patched code",
      "breaker": {
        "state": "CLOSED",
        "failure_count": 1
      }
    }
  ]
}
```

### Trend Metadata Example

```json
{
  "errorsDetected": 3,
  "errorsResolved": 2,
  "errorTrend": "improving",
  "codeQualityScore": 0.75,
  "improvementVelocity": 0.6,
  "stagnationRisk": 0.2
}
```

## Schema Evolution

### Versioning Strategy

- **Semantic Versioning**: Major.Minor.Patch format
- **Backward Compatibility**: New fields are optional
- **Migration Path**: Clear upgrade path between versions
- **Deprecation Notices**: Advance warning of breaking changes

### Migration Examples

```typescript
// Migration from v1.0.0 to v1.1.0
function migratePatchEnvelopeV1_1(data: any): any {
  // Add new optional fields with defaults
  return {
    ...data,
    metadata: {
      ...data.metadata,
      version: '1.1.0'
    },
    trendMetadata: data.trendMetadata || {
      errorsDetected: 0,
      errorsResolved: 0,
      errorTrend: 'unknown',
      codeQualityScore: 0.5,
      improvementVelocity: 0,
      stagnationRisk: 0
    }
  };
}
```

## Validation Rules

### Required Fields

- **Patch Envelope**: `patch_id`, `patch_data`, `metadata`, `attempts`
- **Patch Data**: `language`, `patched_code`, `original_code`
- **Circuit Breaker Policy**: `modelClass`, `syntax_error_budget`, `logic_error_budget`, `max_syntax_attempts`, `max_logic_attempts`

### Field Constraints

- **UUID Format**: Patch IDs must follow RFC 4122 format
- **Language Enum**: Only supported languages allowed
- **Numeric Ranges**: Confidence scores, error budgets within valid ranges
- **Timestamp Format**: ISO 8601 date-time strings

### Custom Validation Rules

```typescript
function validatePatchId(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

function validateLanguage(lang: string): boolean {
  const supportedLanguages = ['javascript', 'typescript', 'python', 'php'];
  return supportedLanguages.includes(lang);
}

function validateConfidenceScore(score: number): boolean {
  return score >= 0 && score <= 1;
}
```

## Integration Points

### API Endpoints

```typescript
// POST /api/debug/run
interface DebugRequest {
  error_type: 'SYNTAX' | 'LOGIC';
  message: string;
  patch_code: string;
  original_code: string;
  maxAttempts?: number;
}

// Response follows PatchEnvelope schema
interface DebugResponse extends PatchEnvelope {
  action: string;
  envelope: PatchEnvelope;
}
```

### Memory Adapter Integration

```typescript
interface MemoryPattern {
  error: string;
  solution: string;
  confidence: number;
  language: string;
  schema_version: string;
  validation_status: 'valid' | 'invalid' | 'unvalidated';
}
```

### Observer System Integration

```typescript
interface ObserverEvent {
  type: 'patch_attempt' | 'validation_failure' | 'circuit_trip';
  timestamp: string;
  data: Record<string, any>;
  schema_compliant: boolean;
}
```

## Best Practices

### Schema Design
- **Single Source of Truth**: One comprehensive schema file
- **Clear Definitions**: Well-documented field purposes and constraints
- **Extensible Structure**: Support for future enhancements
- **Validation First**: Always validate before processing

### Implementation Guidelines
- **Language Agnostic**: Consistent behavior across implementations
- **Error Handling**: Graceful handling of validation failures
- **Performance**: Efficient validation without blocking operations
- **Monitoring**: Track validation success/failure rates

### Maintenance
- **Regular Audits**: Periodic review of schema usage
- **Deprecation Policy**: Clear process for removing fields
- **Documentation**: Keep schema documentation current
- **Testing**: Comprehensive test coverage for all schema paths

This unified schema approach ensures data integrity and consistency across the entire self-healing debugging system while maintaining flexibility for future enhancements.</content>
<parameter name="filePath">c:\code-heals-itself\docs\schemas.md