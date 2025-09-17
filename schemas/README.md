# Schema Documentation

This directory contains JSON schemas for the Self-Healing Code System.

## Schema Files

### Execution Gate: `patch-envelope.schema.json`
- **Purpose**: Validates PatchEnvelope objects before execution
- **Status**: ACTIVE - Used by all language implementations (Python, JavaScript, TypeScript, PHP)
- **Draft**: 2020-12
- **Usage**: Pre-execution validation to ensure data integrity

### Telemetry Contract: `transmission.json`
- **Purpose**: Standardizes telemetry and outcome transmission across languages
- **Status**: ACTIVE - For telemetry implementation
- **Draft**: 07
- **Usage**: Consistent data exchange for monitoring and analytics

### Archived: `archive/transmission.v1.json`
- **Purpose**: Original transmission schema (smaller, less comprehensive)
- **Status**: ARCHIVED - Do not use
- **Draft**: 07
- **Usage**: Reference only; replaced by transmission.json

## Test Fixtures

Located in `fixtures/`:
- `patchEnvelope.valid.json` - Valid PatchEnvelope for testing
- `patchEnvelope.invalid.json` - Invalid PatchEnvelope for testing

## Usage Guidelines

1. **Always validate PatchEnvelope** before execution using `patch-envelope.schema.json`
2. **Use file-relative paths** for schema loading (not `process.cwd()`)
3. **Test with fixtures** to ensure cross-language compatibility
4. **Archive old schemas** instead of deleting them

## Path Resolution Examples

```typescript
// TypeScript/JavaScript
const schemaPath = path.resolve(__dirname, '../schemas/patch-envelope.schema.json');
```

```python
# Python
schema_path = os.path.join(os.path.dirname(__file__), 'schemas/patch-envelope.schema.json')
```

```php
// PHP
$schemaPath = __DIR__ . '/schemas/patch-envelope.schema.json';
```