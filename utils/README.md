# Self-Healing Code Utilities

This utility collection provides implementations of key design patterns for AI-driven self-healing code across multiple programming languages. The focus ## Baby Steps Approach

The system implements a "baby steps" philosophy:

1. **Simple Fixes**: AI handles obvious issues (missing semicolons, basic null checks)
2. **Simulation First**: All patches are simulated before application
3. **Confidence Scoring**: AI only applies high-confidence fixes
4. **Developer Escalation**: Complex issues are flagged for human review
5. **Progressive Learning**: Each attempt improves future decisions

## Error Classification

### AI-Handleable (Quick & Confident)
- Syntax errors
- Missing imports
- Basic null pointer checks
- Simple path resolutions
- Linting issues

### Developer-Required (Complex/Critical)
- Database schema changes
- Authentication modifications
- Security vulnerability fixes
- Production data changes
- Complex architectural changesabling AI to debug, patch, and secure code while maintaining interoperability through a common JSON transmission layer.

## Overview

The utilities implement three core patterns:
- **Observer**: Monitors errors and patch outcomes
- **Adapter**: Adapts patches for different systems or legacy code
- **Strategy**: Provides different debugging and patching strategies

## Advanced Features

### Circuit Breaker Protection
Prevents infinite loops and runaway simulations:
```python
# Automatic failure detection and recovery
circuit_breaker = CircuitBreaker(failure_threshold=3, recovery_timeout=60.0)
```

### Envelope Pattern
Wraps patches for progressive learning:
```python
envelope = wrapper.wrap_patch({"fix": "Add bounds checking"})
result = wrapper.unwrap_and_execute(envelope)
```

### Developer Flagging
Automatically flags complex issues for human review:
```json
{
  "flagged_for_developer": true,
  "developer_message": "Database schema modification detected. Please review for data integrity."
}
```

### AI Memory Integration
Integrates with LangChain-style memory buffers:
```python
memory = MemoryBuffer(max_size=100)
memory.add_outcome(envelope_json)
similar_outcomes = memory.get_similar_outcomes(current_patch)
```

### Human Debugging Simulation
Replicates senior developer thought processes:
```python
simulator = SeniorDeveloperSimulator()
human_approach = simulator.debug_like_human(error, context)
```

- Python
- JavaScript
- PHP
- TypeScript

## Common JSON Transmission Schema

All pattern outcomes follow the schema defined in `../schemas/transmission.json`. This ensures consistent data exchange between different language implementations and AI systems.

Example outcome structure:
```json
{
  "pattern": "observer",
  "component": "PatchObserver",
  "success": true,
  "error": "",
  "details": "Patch applied successfully",
  "timestamp": "2025-09-16T10:00:00Z",
  "language": "python",
  "patch_data": { ... },
  "outcome": { ... }
}
```

## Usage Examples

### Python

```python
from utils.python.observer import ErrorHandler, PatchObserver
from utils.python.adapter import PatchAdapter, Adaptee
from utils.python.strategy import Debugger, LogAndFixStrategy

# Observer pattern
handler = ErrorHandler()
observer = PatchObserver("SecurityObserver")
handler.attach(observer)
handler.handle_error("Buffer overflow", "security_patch_001")

# Adapter pattern
adaptee = Adaptee()
adapter = PatchAdapter(adaptee)
result = adapter.apply_patch({"raw_patch": "Fix overflow"})
print(json.dumps(result, indent=2))

# Strategy pattern
debugger = Debugger(LogAndFixStrategy())
outcome = debugger.debug({"error": "Null pointer"})
print(json.dumps(outcome, indent=2))
```

### JavaScript

```javascript
const { ErrorHandler, PatchObserver } = require('./utils/javascript/observer');
const { PatchAdapter, Adaptee } = require('./utils/javascript/adapter');
const { Debugger, LogAndFixStrategy } = require('./utils/javascript/strategy');

// Observer pattern
const handler = new ErrorHandler();
const observer = new PatchObserver("SecurityObserver");
handler.attach(observer);
handler.handleError("Buffer overflow", "security_patch_001");

// Adapter pattern
const adaptee = new Adaptee();
const adapter = new PatchAdapter(adaptee);
const result = adapter.applyPatch({ raw_patch: "Fix overflow" });
console.log(JSON.stringify(result, null, 2));

// Strategy pattern
const debugInstance = new Debugger(new LogAndFixStrategy());
const outcome = debugInstance.debug({ error: "Null pointer" });
console.log(JSON.stringify(outcome, null, 2));
```

### PHP

```php
require_once 'utils/php/observer.php';
require_once 'utils/php/adapter.php';
require_once 'utils/php/strategy.php';

// Observer pattern
$handler = new ErrorHandler();
$observer = new PatchObserver("SecurityObserver");
$handler->attach($observer);
$handler->handleError("Buffer overflow", "security_patch_001");

// Adapter pattern
$adaptee = new Adaptee();
$adapter = new PatchAdapter($adaptee);
$result = $adapter->applyPatch(["raw_patch" => "Fix overflow"]);
echo json_encode($result, JSON_PRETTY_PRINT) . "\n";

// Strategy pattern
$debugger = new Debugger(new LogAndFixStrategy());
$outcome = $debugger->debug(["error" => "Null pointer"]);
echo json_encode($outcome, JSON_PRETTY_PRINT) . "\n";
```

### TypeScript

```typescript
import { ErrorHandler, PatchObserver } from './utils/typescript/observer';
import { PatchAdapter, Adaptee } from './utils/typescript/adapter';
import { Debugger, LogAndFixStrategy } from './utils/typescript/strategy';

// Observer pattern
const handler = new ErrorHandler();
const observer = new PatchObserver("SecurityObserver");
handler.attach(observer);
handler.handleError("Buffer overflow", "security_patch_001");

// Adapter pattern
const adaptee = new Adaptee();
const adapter = new PatchAdapter(adaptee);
const result = adapter.applyPatch({ raw_patch: "Fix overflow" });
console.log(JSON.stringify(result, null, 2));

// Strategy pattern
const debugInstance = new Debugger(new LogAndFixStrategy());
const outcome = debugInstance.debug({ error: "Null pointer" });
console.log(JSON.stringify(outcome, null, 2));
```

## AI Integration

These utilities are designed to be integrated with AI debugging systems like LangChain or custom AI agents. The JSON outcomes provide structured feedback for:

- Learning successful patch patterns
- Avoiding infinite loops through guardrails
- Cross-language patch transmission
- Security validation of AI-generated code

## Security Considerations

- All patches include rollback mechanisms
- JSON serialization prevents code injection
- Observer pattern enables continuous monitoring
- Strategy pattern allows switching to safe fallbacks

## Future Enhancements

- Multi-agent debate systems for patch validation
- Formal verification integration
- Machine learning-based pattern recognition
- Integration with existing CI/CD pipelines
- Real-time monitoring dashboards

## Contributing

When adding new patterns or languages, ensure:
1. JSON schema compliance for all outcomes
2. Circuit breaker integration for safety
3. Envelope pattern for learning
4. Developer flagging for complex issues
5. Memory buffer compatibility
6. Comprehensive error handling