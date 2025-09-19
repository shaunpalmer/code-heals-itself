# Demo Applications

The demo applications provide hands-on experiences with the self-healing debugging system, showcasing gradient-based debugging concepts through interactive CLI and web interfaces.

## Overview

The demo suite includes:

- **CLI Demo**: Command-line interface with simulated debugging scenarios
- **Browser Demo**: Interactive web interface with live visualization
- **Metrics Demo**: Prometheus metrics integration demonstration
- **LM Studio Bridge**: Local LLM integration example

## CLI Demo (`demo/index.ts`)

### Features

The CLI demo simulates gradient-based debugging with realistic error scenarios and circuit breaker logic.

```typescript
class DemoRunner {
  private breaker: TrendAwareCircuitBreaker;

  constructor() {
    this.breaker = new TrendAwareCircuitBreaker(
      10, // maxAttempts
      3,  // improvementWindow
      5,  // stagnationThreshold
      0.6 // confidenceFloor
    );
  }
}
```

### Demo Scenarios

#### 1. Null Check Missing
```typescript
{
  name: '🔧 Null Check Missing',
  code: `function processUser(user) {
  return user.name.toUpperCase();
}`,
  description: 'Missing null check causing potential runtime error',
  simulatedErrors: [5, 3, 1, 0], // errors decreasing (improving)
  simulatedConfidence: [0.3, 0.6, 0.8, 0.95] // confidence increasing
}
```

#### 2. Semicolon Missing
```typescript
{
  name: '📝 Semicolon Missing',
  code: `function calculate(x, y) {
  const result = x + y
  return result
}`,
  description: 'Missing semicolon causing syntax issues',
  simulatedErrors: [3, 2, 2, 2], // plateauing (not improving)
  simulatedConfidence: [0.4, 0.5, 0.5, 0.45] // confidence plateauing
}
```

#### 3. Complex Logic Error
```typescript
{
  name: '🔄 Complex Logic Error',
  code: `function complexLogic(data) {
  if (data.value > 0) {
    return data.value * 2;
  } else {
    return "invalid";
  }
}`,
  description: 'Complex logic requiring multiple refinements',
  simulatedErrors: [8, 6, 4, 2, 1, 0], // steady improvement
  simulatedConfidence: [0.2, 0.4, 0.6, 0.8, 0.9, 0.97] // steady confidence growth
}
```

### Running the CLI Demo

```bash
# From project root
cd demo
npx ts-node index.ts

# Or with npm script
npm run demo
```

### Interactive Mode

```bash
npx ts-node demo/index.ts --interactive
```

## Browser Demo (`demo/index.html`)

### Features

The browser demo provides a visual interface for exploring debugging concepts with:

- **Live Code Input**: Paste buggy code or use preset scenarios
- **Real-time Metrics**: Live dashboard with confidence scores and error tracking
- **Animated Progress**: Visual indicators for debugging attempts
- **Attempt History**: Status tracking with detailed attempt logs
- **Trend Analysis**: Visual representation of improvement patterns

### HTML Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Heals Itself - Interactive Demo</title>

    <!-- Prism.js for Syntax Highlighting -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet" />
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-core.min.js"></script>
</head>
<body>
    <div class="container">
        <h1>🚀 Code Heals Itself</h1>
        <p class="subtitle">Interactive Gradient-Based Debugging Demo</p>

        <div class="demo-section">
            <h2>🎯 Try It Out</h2>
            <div class="code-input-section">
                <label for="codeInput">Paste your buggy code here:</label>
                <textarea id="codeInput" placeholder="function test() { console.log('hello' }"></textarea>
            </div>
        </div>
    </div>
</body>
</html>
```

### Preset Scenarios

#### Null Check Missing
```javascript
// Original buggy code
function processUser(user) {
  return user.name.toUpperCase();
}

// Expected fix
function processUser(user) {
  if (!user || !user.name) {
    return "Invalid user";
  }
  return user.name.toUpperCase();
}
```

#### Semicolon Missing
```javascript
// Original buggy code
function calculate(x, y) {
  const result = x + y
  return result
}

// Expected fix
function calculate(x, y) {
  const result = x + y;
  return result;
}
```

#### Async/Await Missing
```javascript
// Original buggy code
function fetchData() {
  return fetch('/api/data')
    .then(response => response.json())
    .then(data => console.log(data));
}

// Expected fix
async function fetchData() {
  try {
    const response = await fetch('/api/data');
    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}
```

### JavaScript Implementation

```javascript
class BrowserDemo {
  constructor() {
    this.metrics = {
      attempts: 0,
      errors: [],
      confidence: [],
      trends: []
    };
    this.initializeEventListeners();
  }

  async runGradientDebugger() {
    const code = document.getElementById('codeInput').value;
    if (!code.trim()) {
      this.showError('Please enter some code to debug');
      return;
    }

    this.showLoading(true);
    this.resetMetrics();

    try {
      // Simulate debugging process
      await this.simulateDebuggingProcess(code);
      this.displayResults();
    } catch (error) {
      this.showError('Debugging failed: ' + error.message);
    } finally {
      this.showLoading(false);
    }
  }

  async simulateDebuggingProcess(code) {
    const maxAttempts = 5;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      this.metrics.attempts = attempt;

      // Simulate analysis delay
      await this.delay(1000);

      // Generate simulated metrics
      const errorCount = Math.max(0, Math.floor(Math.random() * 10) - attempt * 2);
      const confidence = Math.min(0.95, 0.2 + (attempt * 0.15) + Math.random() * 0.1);

      this.metrics.errors.push(errorCount);
      this.metrics.confidence.push(confidence);

      this.updateProgress(attempt, maxAttempts, errorCount, confidence);

      // Break if no errors remain
      if (errorCount === 0) break;
    }
  }

  updateProgress(attempt, maxAttempts, errors, confidence) {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const metricsDiv = document.getElementById('metrics');

    const percentage = (attempt / maxAttempts) * 100;
    progressBar.style.width = percentage + '%';
    progressText.textContent = `Attempt ${attempt}/${maxAttempts}`;

    metricsDiv.innerHTML = `
      <div class="metric">
        <span class="metric-label">Errors:</span>
        <span class="metric-value">${errors}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Confidence:</span>
        <span class="metric-value">${(confidence * 100).toFixed(1)}%</span>
      </div>
    `;
  }
}
```

## Metrics Demo (`demo/metrics-demo.js`)

### Features

The metrics demo demonstrates Prometheus integration and API usage:

```javascript
#!/usr/bin/env node
// Simple script: fetch Prometheus metrics then run a sample debug attempt and print summary.

const http = require('http');

const BASE = process.env.BASE_URL || 'http://localhost:8787';

function get(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    http.get(url, (res) => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    }).on('error', reject);
  });
}
```

### Usage

```bash
# Run metrics demo
node demo/metrics-demo.js

# With custom base URL
BASE_URL=http://localhost:3000 node demo/metrics-demo.js
```

### Sample Output

```
[demo] Fetching Prometheus metrics...
# HELP healer_debug_attempts_total Total number of debug attempts
# TYPE healer_debug_attempts_total counter
healer_debug_attempts_total 42

[demo] Running sample debug attempt...
[demo] action: fix_applied has envelope: true
```

## LM Studio Bridge (`demo/lmstudio-bridge.js`)

### Features

The LM Studio bridge demonstrates local LLM integration:

```javascript
#!/usr/bin/env node
/*
 LM Studio Bridge Script

 Demonstrates:
 1. Fetch self-healer input schema
 2. Start a chat completion with tool declaration against LM Studio OpenAI-compatible API
 3. Detect tool/function call, execute POST /api/debug/run locally
 4. Send tool result back as follow-up message
*/

const LM_BASE = process.env.LM_BASE || 'http://localhost:1234';
const LM_MODEL = process.env.LM_MODEL || 'openai/gpt-oss-20b';
const HEALER_BASE = process.env.HEALER_BASE || 'http://localhost:8787';
```

### Environment Variables

```bash
# LM Studio configuration
LM_BASE=http://localhost:1234
LM_MODEL=openai/gpt-oss-20b

# Self-healer server
HEALER_BASE=http://localhost:8787
```

### Workflow

1. **Fetch Schema**: Retrieve input schema from self-healer API
2. **Initialize Chat**: Start conversation with tool declarations
3. **Tool Detection**: Monitor for function calls in LLM responses
4. **Execute Tool**: Run debug attempts via local API
5. **Send Results**: Return tool execution results to LLM

### Sample Implementation

```javascript
async function initializeChat() {
  console.log('[bridge] Fetching input schema...');
  const schemaResp = await reqJSON('GET', HEALER_BASE, '/api/schemas/debug.json');

  if (!schemaResp.json) {
    console.error('[bridge] Failed to fetch schema', schemaResp.status);
    process.exit(1);
  }

  const schema = schemaResp.json;

  // Initialize chat with tool
  const chatInit = await reqJSON('POST', LM_BASE, '/v1/chat/completions', {
    model: LM_MODEL,
    messages: [{
      role: 'system',
      content: 'You are a helpful coding assistant with access to debugging tools.'
    }],
    tools: [{
      type: 'function',
      function: {
        name: 'debug_code',
        description: 'Debug and fix code issues using advanced AI techniques',
        parameters: schema
      }
    }]
  });

  return chatInit;
}
```

## Demo Package Configuration

### `demo/package.json`

```json
{
  "name": "code-heals-itself-demo",
  "version": "1.0.0",
  "description": "Interactive demos for the Code Heals Itself debugging system",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "demo": "npx ts-node index.ts",
    "metrics": "node metrics-demo.js",
    "bridge": "node lmstudio-bridge.js"
  },
  "dependencies": {
    "prismjs": "^1.29.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "ts-node": "^10.9.0",
    "typescript": "^5.0.0"
  }
}
```

## Integration Examples

### Running All Demos

```bash
# Install demo dependencies
cd demo
npm install

# Run CLI demo
npm run demo

# Run metrics demo
npm run metrics

# Run LM Studio bridge
npm run bridge
```

### Custom Demo Scenarios

```typescript
// Add custom scenario to CLI demo
const customScenario = {
  name: '🎨 Custom React Error',
  code: `function MyComponent() {
  const [count, setCount] = useState(0);
  return <div onClick={() => setCount(count + 1)}>{count}</div>;
}`,
  description: 'React component with missing import',
  simulatedErrors: [2, 1, 0],
  simulatedConfidence: [0.5, 0.8, 0.95]
};

// Add to scenarios array
scenarios.push(customScenario);
```

### Browser Demo Customization

```javascript
// Add custom preset to browser demo
const customPreset = {
  name: 'Vue.js Error',
  code: `export default {
  data() {
    return {
      message: 'Hello Vue!'
    }
  },
  methods: {
    greet() {
      console.log(this.message)
    }
  }
}`,
  description: 'Vue component missing proper setup'
};

// Add to presets
presets.push(customPreset);
```

## Learning Outcomes

### Key Concepts Demonstrated

1. **Error Gradients**: Tracking improvement over multiple attempts
2. **Confidence Scoring**: Measuring AI certainty and decision-making
3. **Circuit Breakers**: Preventing infinite retry loops and resource waste
4. **Trend Analysis**: Detecting improvement patterns and stagnation
5. **Memory Resilience**: Maintaining state across debugging attempts

### Educational Value

- **Visual Learning**: Browser demo shows real-time progress
- **Interactive Experience**: CLI demo provides step-by-step walkthrough
- **Integration Examples**: Metrics and LM Studio demos show real-world usage
- **Performance Insights**: Demonstrates system efficiency and resource usage

### Best Practices Showcased

- **Error Handling**: Graceful degradation and user feedback
- **Resource Management**: Circuit breakers and timeout handling
- **User Experience**: Clear progress indicators and status updates
- **Extensibility**: Modular design for adding new scenarios

These demo applications provide comprehensive hands-on experience with the self-healing debugging system, making complex concepts accessible through interactive examples and real-world integration scenarios.</content>
<parameter name="filePath">c:\code-heals-itself\docs\demo-applications.md