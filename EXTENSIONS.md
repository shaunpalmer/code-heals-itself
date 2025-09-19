# AI Self-Healing Code System - Extensions Guide

This document explains the inheritance-based extensions available in the AI self-healing code system. These extensions provide opt-in enhancements to core functionality without disrupting existing behavior.

## Overview

The system uses inheritance to provide backward-compatible extensions that can be swapped into the core classes. This approach ensures:

- **Zero disruption** to existing code
- **Opt-in adoption** - use extensions only where needed
- **Backward compatibility** - extensions inherit all base functionality
- **Easy testing** - extensions can be tested independently

## Available Extensions

### 1. ResilientMemoryBuffer

#### How It Works

The `ResilientMemoryBuffer` enhances the base `MemoryBuffer` with:

- **Safe writes:** `safeAddOutcome()` method that never throws exceptions
- **Error callbacks:** Optional `onError` callback for handling persistence failures
- **Graceful degradation:** Continues operation even when disk I/O fails
- **Observability:** Tracks failures and evictions for monitoring

#### Key Features

```typescript
// Safe write - returns boolean instead of throwing
const success = resilientBuffer.safeAddOutcome(envelopeJson);

// Error handling via callback
const buffer = new ResilientMemoryBuffer(100, (err) => {
  console.error('Memory operation failed:', err);
  // Log to monitoring system, send alerts, etc.
});
```

#### Implementation Example

```typescript
import { ResilientMemoryBuffer } from './extensions/inheritance_extensions';

// Replace MemoryBuffer with ResilientMemoryBuffer
const memory = new ResilientMemoryBuffer(100, (err) => {
  // Handle errors gracefully
  console.warn('Memory persistence failed:', err);
});

// Use exactly like the base MemoryBuffer
memory.addOutcome(envelopeJson);
await memory.save('./memory.json');
```

### 2. AdaptivePatchEnvelope

#### How It Works

The `AdaptivePatchEnvelope` enhances patch envelopes with:

- **Continuity tracking:** Links patches with `previous_patch_id` for trend analysis
- **Default constraints:** Automatically applies conservative limits if not specified
- **Metadata enrichment:** Adds safety constraints for production use
- **Patch chaining:** Maintains history of related patches

#### Key Features

```typescript
// Automatic continuity metadata
const envelope = adaptiveEnvelope.wrapPatch(patchData);
// envelope.metadata.previous_patch_id is set automatically

// Default constraints applied
const constraints = envelope.metadata;
console.log(constraints.max_lines_changed); // 25 (default)
console.log(constraints.disallow_keywords); // ['database_schema_change', ...]
```

#### Implementation Example

```typescript
import { AdaptivePatchEnvelope } from './extensions/inheritance_extensions';

// Replace AIPatchEnvelope with AdaptivePatchEnvelope
const envelopeWrapper = new AdaptivePatchEnvelope();

// Use exactly like the base AIPatchEnvelope
const envelope = envelopeWrapper.wrapPatch({
  # AI Self-Healing Code — Extensions (Opt-in)
  code: 'function fix() { return true; }',
  language: 'typescript'
});

// Envelope now includes continuity and safety metadata

### 3. ExtendedCodeErrorAnalyzer

#### How It Works

The `ExtendedCodeErrorAnalyzer` enhances error analysis with:

- **Operator continuation checks:** Detects lines ending with operators that likely need continuation
- **Quality score adjustment:** Reduces quality score proportionally to detected issues
- **Enhanced heuristics:** Builds on base analyzer with additional pattern recognition
- **Non-breaking additions:** All base functionality preserved
#### Key Features

```typescript
// Detects lines like: "x = y +" (missing continuation)

// Additional error detection
}

// Adjusted quality score
console.log(result.qualityScore); // Reduced for detected issues
```

#### Implementation Example

```typescript
import { ExtendedCodeErrorAnalyzer } from './extensions/inheritance_extensions';

// Replace CodeErrorAnalyzer with ExtendedCodeErrorAnalyzer
const analysis = ExtendedCodeErrorAnalyzer.analyzeCode(`
function buggy() {
  const x = y +  // Missing continuation
  return x;
}

// Detects the operator issue and reduces quality score
console.log(analysis.errorCount); // Includes operator error
console.log(analysis.qualityScore); // < 1.0 due to error
## How to Implement Extensions

### Step 1: Import the Extension

```typescript
// Import specific extensions you want to use
import {
  ResilientMemoryBuffer,
  AdaptivePatchEnvelope,
```


// Before (using base classes)
import { MemoryBuffer, AIPatchEnvelope, CodeErrorAnalyzer } from './envelope';

// After (using extensions)
const memory = new ResilientMemoryBuffer();
const envelope = new AdaptivePatchEnvelope();
const analyzer = ExtendedCodeErrorAnalyzer;
```

### Step 3: Configure Extensions (Optional)

```typescript
  // Custom error handling
  sendToMonitoring(err);
// Use with default settings (inherits base behavior)
const envelope = new AdaptivePatchEnvelope();
```

// All method signatures remain the same
memory.addOutcome(envelopeJson);
await memory.save('./data.json');

### ResilientMemoryBuffer Benefits
- **Graceful degradation:** Continues operation during storage issues
### AdaptivePatchEnvelope Benefits

### ExtendedCodeErrorAnalyzer Benefits

- **Non-intrusive:** Adds value without changing interfaces
## Testing Extensions

### Unit Testing

```typescript
describe('ResilientMemoryBuffer', () => {
  it('handles disk failures gracefully', () => {
    const buffer = new ResilientMemoryBuffer(10, mockErrorHandler);
    // Test that safeAddOutcome returns false on failure
    // Test that onError callback is invoked
  });
});

describe('AdaptivePatchEnvelope', () => {
  it('adds continuity metadata', () => {
    const envelope = new AdaptivePatchEnvelope();
    const patch = envelope.wrapPatch(testData);
    expect(patch.metadata.previous_patch_id).toBeDefined();
  });
});
```

### Integration Testing

```typescript
describe('Extension Integration', () => {
  it('works with existing AIDebugger', () => {
    // Test that extensions can be swapped without breaking AIDebugger
    const debugger = new AIDebugger({
      memory: new ResilientMemoryBuffer(),
      envelope: new AdaptivePatchEnvelope(),
      analyzer: ExtendedCodeErrorAnalyzer
    });
    // Verify normal operation
## Best Practices

### When to Use Extensions
- **Development:** Start with base classes, add extensions as needed

### Configuration Guidelines

- **Error handlers:** Always provide meaningful error callbacks
- **Size limits:** Configure buffer sizes based on your use case
- **Constraints:** Adjust default constraints for your environment
- **Monitoring:** Set up monitoring for extension-specific metrics

### Migration Strategy

1. **Test extensions** in isolation first
2. **Gradual rollout** - replace one component at a time
## Troubleshooting

- Verify you're importing from the correct path
- Check that you're calling the right methods
- Monitor memory usage with large buffers
- Check error callback overhead
- Profile extension-specific operations

**Incompatibility with existing code:**
- Extensions are designed to be drop-in replacements
- If issues occur, check method signatures match
- Review inheritance chain for conflicts

### Debug Mode

```typescript
// Enable debug logging for extensions
const memory = new ResilientMemoryBuffer(100, (err) => {
  console.error('[DEBUG] Memory error:', err);
## Future Extensions

The extension system is designed to be extensible. Future enhancements may include:

- **VectorMemoryBuffer:** Semantic search over patch history
- **MultiLanguageEnvelope:** Cross-language patch compatibility
- **AIAnalyzer:** LLM-powered error analysis
- **DistributedMemory:** Multi-node memory synchronization

## Contributing

## Optional: Zod validation for successCelebration (copy-paste)

If you want strict, runtime schema validation for the `success_celebration` payload (recommended for production), you can opt-in with Zod. The snippet below is copy/paste ready.

1) Install Zod in your project (one-time):

```bash
npm install zod
# or
yarn add zod
```

2) Create a tiny file (example path: `src/extensions/enable-zod-success-validation.ts`) and paste the code below.

```typescript
// src/extensions/enable-zod-success-validation.ts
import { z } from 'zod';
import { Extensions } from '../../utils/typescript/extensions/inheritance_extensions';

// Full, conservative schema for the success celebration payload
const SuccessCelebrationSchema = z.object({
  type: z.string(),
  patch_id: z.string(),
  success_metrics: z.object({
    final_confidence: z.number(),
    error_count: z.number().optional(),
    attempts_required: z.number().optional()
  }),
  message: z.string().optional(),
  celebration: z.object({
    achievement: z.string().optional(),
    threshold_exceeded: z.string().optional(),
    jitter_delay_ms: z.number().optional()
  }).optional(),
  final_state: z.object({
    code_polished: z.boolean().optional(),
    linting_applied: z.boolean().optional(),
    ready_for_deployment: z.boolean().optional()
  }).optional(),
  // optional hints we added for critical problems
  hints: z.record(z.any()).optional()
});

export function enableZodSuccessValidation() {
  // Replace the lightweight validator with a Zod-powered one
  Extensions.validateSuccessCelebration = (payload: any): boolean => {
    const result = SuccessCelebrationSchema.safeParse(payload);
    if (!result.success) {
      // Log the error (or send to telemetry) and return false to indicate invalid payload
      // Use `result.error.format()` to get a structured error map
      console.warn('SuccessCelebration validation failed:', result.error.format());
      return false;
    }
    return true;
  };
}

3) Enable it at app startup (e.g., where you initialize your AI debugger):

```typescript
import { enableZodSuccessValidation } from './extensions/enable-zod-success-validation';

// Now Extensions.validateSuccessCelebration(payload) will run the Zod schema.
```

Notes:
- This is optional; if you don't enable it the small built-in validator remains in place.
- You can customize the schema to include additional fields you care about (e.g., `error_signature`, `trend_velocity`).
- If validation fails you can decide whether to reject the celebration payload, log it for auditing, or quietly send it anyway with telemetry.



1. Extend existing base classes using inheritance
2. Maintain backward compatibility
3. Add comprehensive tests
4. Update this documentation
5. Follow the established patterns

---

For more information about the core system, see [README-v2.0.md](./README-v2.0.md).</content>
<filePath="c:\code-heals-itself\EXTENSIONS.md