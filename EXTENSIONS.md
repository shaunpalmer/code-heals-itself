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

## Policy-Based Extension Control

The extensions are controlled through the `HealerPolicy` interface in `AIDebugger`. All extensions are **disabled by default** for backward compatibility.

### Policy Configuration

```typescript
import { AIDebugger, policyPresets } from './ai-debugging';

// Enable all linting extensions
const debugger = new AIDebugger({
  enable_zod_validation: true,
  enable_enhanced_eslint: true,
  enable_stylelint: true
});

// Or use a preset and add extensions
const debugger = new AIDebugger({
  ...policyPresets.midTier,
  enable_enhanced_eslint: true,
  enable_zod_validation: true
});
```

### Available Policy Options

| Policy Option | Type | Default | Description |
|---------------|------|---------|-------------|
| `enable_zod_validation` | boolean | `false` | Runtime schema validation for success envelopes |
| `enable_enhanced_eslint` | boolean | `false` | Advanced ESLint with import resolution and security rules |
| `enable_stylelint` | boolean | `false` | CSS/SCSS validation and import checking |

### Policy Presets

The system includes predefined policy presets that you can extend:

```typescript
import { policyPresets } from './ai-debugging';

// Start with a preset and add extensions
const productionPolicy = {
  ...policyPresets.sota,  // High-capability model settings
  enable_zod_validation: true,
  enable_enhanced_eslint: true,
  enable_stylelint: true
};
```

### Runtime Extension Loading

Extensions are loaded dynamically to avoid hard dependencies:

```typescript
// Extensions fail gracefully if dependencies are missing
const debugger = new AIDebugger({
  enable_enhanced_eslint: true  // Will log warning if ESLint not installed
});
```

### Extension Integration Points

Extensions are automatically integrated into the debugging workflow:

**ESLint Enhanced:**
- Triggered during final polish phase when `enable_enhanced_eslint: true`
- Runs on generated patches before they're applied
- Issues are logged but don't block the healing process

**Stylelint:**
- Triggered when `enable_stylelint: true` and CSS/SCSS files are detected
- Results attached to `envelope.metadata.stylelint`
- Used for informational purposes and quality metrics

**Zod Validation:**
- Triggered when `enable_zod_validation: true`
- Validates success celebration payloads before LLM communication
- Invalid payloads are logged and rejected

**NPM Audit:**
- Can be called manually or integrated into CI/CD pipelines
- Provides structured vulnerability reports
- Independent of the main debugging workflow

### Example: Production-Ready Configuration

```typescript
import { AIDebugger, policyPresets } from './ai-debugging';
import { runNpmAuditSummary } from './src/extensions/npm-audit-runner';

const productionDebugger = new AIDebugger({
  ...policyPresets.sota,
  enable_zod_validation: true,
  enable_enhanced_eslint: true,
  enable_stylelint: true,
  require_human_on_risky: true
});

// Pre-deployment security check
const audit = runNpmAuditSummary();
if (!audit.ok || (audit.vulnerabilities || 0) > 0) {
  console.warn('Security vulnerabilities detected:', audit);
}

// Use debugger for healing
const result = await productionDebugger.heal(error, context);
```

### 4. ESLint Enhanced Runner

#### Overview
Advanced ESLint integration with TypeScript support, import resolution, and security rules. Automatically detects import cycles, unresolved dependencies, and security vulnerabilities.

#### Key Features
- **TypeScript Support**: Full TS path resolution and type-aware linting
- **Import Analysis**: Detects missing/unused/circular imports
- **Security Rules**: Built-in security vulnerability detection
- **Alias Support**: Configurable path aliases (e.g., `@/src`)
- **Fail-Open**: Continues without ESLint if not installed

#### Installation
```bash
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-import eslint-plugin-security eslint-import-resolver-typescript eslint-import-resolver-alias
```

#### Configuration
```typescript
import { createEnhancedESLintRunner } from './src/extensions/eslint-enhanced-runner';

const eslintRunner = createEnhancedESLintRunner({
  alias: { '@': './src' },                    // Path aliases
  extensions: ['.ts', '.tsx', '.js', '.jsx'], // File extensions
  tsconfigPath: 'tsconfig.json'              // TypeScript config
});
```

#### Usage in FinalPolishObserver
```typescript
// In your FinalPolishObserver or debugging pipeline
const polishedCode = await eslintRunner(originalCode, { 
  filename: 'debugged-component.ts' 
});

// Runner detects issues but returns original code (linting is informational)
console.log(polishedCode); // Original code, issues logged to console
```

#### Detected Issues
- Import resolution failures
- Duplicate imports
- Circular dependencies
- Security vulnerabilities (eval, unsafe regex, etc.)
- TypeScript path mapping issues

### 5. Stylelint Runner

#### Overview
CSS/SCSS validation with import checking and style consistency rules. Integrates seamlessly with your existing linting pipeline.

#### Key Features
- **SCSS Support**: Full Sass/SCSS syntax validation
- **Import Validation**: Detects missing stylesheet imports
- **Standard Rules**: Uses stylelint-config-standard
- **Path Resolution**: Validates @import paths
- **Fail-Open**: Continues without stylelint if not installed

#### Installation
```bash
npm install --save-dev stylelint stylelint-config-standard stylelint-scss
```

#### Usage
```typescript
import { createStylelintRunner } from './src/extensions/stylelint-runner';

const stylelintRunner = createStylelintRunner();

// In your CSS processing pipeline
const validatedCSS = await stylelintRunner(cssCode, { 
  filename: 'component.scss' 
});
```

#### Detected Issues
- Empty stylesheets
- Unknown CSS functions
- Invalid @import paths
- SCSS syntax errors

### 6. NPM Audit Runner

#### Overview
Automated security vulnerability scanning using npm audit. Provides structured vulnerability reports for dependency analysis.

#### Key Features
- **Structured Output**: JSON-formatted vulnerability reports
- **Severity Breakdown**: Categorizes by info/low/moderate/high/critical
- **Timeout Protection**: Configurable execution timeouts
- **Fail-Open**: Graceful handling of npm unavailability

#### Usage
```typescript
import { runNpmAuditSummary } from './src/extensions/npm-audit-runner';

// Run audit in project directory
const auditResult = runNpmAuditSummary('./', 15000);

if (auditResult.ok) {
  console.log(`Found ${auditResult.vulnerabilities} vulnerabilities`);
  console.log('By severity:', auditResult.severities);
} else {
  console.error('Audit failed:', auditResult.error);
}
```

#### Integration Example
```typescript
// In your CI/CD or pre-deployment checks
const audit = runNpmAuditSummary();
if (!audit.ok || (audit.vulnerabilities && audit.vulnerabilities > 0)) {
  console.warn('Security vulnerabilities detected - review dependencies');
  // Optionally fail build or send alerts
}
```

### 7. Zod Validation Extension

#### Overview
Runtime schema validation for success celebration payloads using Zod. Provides type-safe validation with detailed error reporting.

#### Key Features
- **Type Safety**: Runtime validation matching TypeScript interfaces
- **Detailed Errors**: Specific field-level validation messages
- **Forward Compatible**: Allows unknown fields for extensibility
- **Production Ready**: Comprehensive schema for success envelopes

#### Installation
```bash
npm install zod
```

#### Schema Definition
```typescript
import { SuccessCelebrationSchema, validateSuccessEnvelope } from './src/extensions/enable-zod-success-validation';

// Validate success payload
const payload = {
  type: 'success',
  patch_id: 'abc123',
  success_metrics: {
    final_confidence: 0.95,
    error_count: 0,
    attempts_required: 2
  }
};

const result = validateSuccessEnvelope(payload);
if (result.ok) {
  console.log('Payload is valid');
} else {
  console.error('Validation errors:', result.errors);
}
```

#### Integration with Extensions
```typescript
// Override the default validator
import { Extensions } from './utils/typescript/extensions/inheritance_extensions';
import { validateSuccessEnvelope } from './src/extensions/enable-zod-success-validation';

// Replace lightweight validator with Zod-powered one
Extensions.validateSuccessCelebration = (payload: any): boolean => {
  const result = validateSuccessEnvelope(payload);
  if (!result.ok) {
    console.warn('SuccessCelebration validation failed:', result.errors);
    return false;
  }
  return true;
};
```

## Integration Patterns

### Combining Extensions
```typescript
import { createEnhancedESLintRunner } from './src/extensions/eslint-enhanced-runner';
import { createStylelintRunner } from './src/extensions/stylelint-runner';
import { runNpmAuditSummary } from './src/extensions/npm-audit-runner';

class QualityGate {
  private eslint = createEnhancedESLintRunner();
  private stylelint = createStylelintRunner();

  async validateCode(code: string, language: string): Promise<boolean> {
    // Run appropriate linter based on language
    if (language.includes('typescript') || language.includes('javascript')) {
      await this.eslint(code);
    } else if (language.includes('css') || language.includes('scss')) {
      await this.stylelint(code);
    }

    // Check dependencies if package.json exists
    const audit = runNpmAuditSummary();
    if (!audit.ok) {
      console.warn('Could not run security audit');
    }

    return true; // Extensions are informational, not blocking
  }
}
```

### FinalPolishObserver Integration
```typescript
import { FinalPolishObserver } from './utils/typescript/final_polish_observer';
import { createEnhancedESLintRunner } from './src/extensions/eslint-enhanced-runner';

class ExtendedFinalPolishObserver extends FinalPolishObserver {
  private linter = createEnhancedESLintRunner();

  async polish(envelope: any): Promise<any> {
    // Run base polishing
    const polished = await super.polish(envelope);

    // Add linting if confidence is high enough
    if (polished.success_metrics.final_confidence > 0.9) {
      await this.linter(polished.code);
    }

    return polished;
  }
}
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