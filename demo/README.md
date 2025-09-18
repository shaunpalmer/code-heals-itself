# Code Heals Itself - Demo Environment

This demo directory provides hands-on ways to experience the gradient-based debugging system in action.

## 🎯 Available Demos

### 1. CLI Demo (`index.ts`)
A command-line interface that simulates the debugging process with realistic scenarios.

**Features:**
- Simulated gradient debugging with error tracking
- Circuit breaker demonstrations
- Trend analysis visualization
- Confidence scoring metrics

**Usage:**
```bash
cd demo
npx ts-node index.ts
```

### 2. Browser Demo (`index.html`)
An interactive web interface for exploring the debugging system visually.

**Features:**
- Live code input with preset scenarios
- Real-time metrics dashboard
- Animated progress indicators
- Attempt history with status tracking
- Visual trend analysis

**Usage:**
- Open `demo/index.html` in your web browser
- Paste buggy code or use preset examples
- Click "Run Gradient Debugger" to see the analysis

## 🚀 Quick Start

1. **CLI Experience:**
   ```bash
   cd demo
   npx ts-node index.ts
   ```

2. **Browser Experience:**
   - Open `demo/index.html` in your browser
   - Try the preset scenarios or paste your own code
   - Watch the live analysis and metrics

## 📊 Demo Scenarios

The demos showcase these key concepts:

- **Error Gradients**: Tracking improvement over attempts
- **Confidence Scoring**: Measuring AI certainty levels
- **Circuit Breakers**: Preventing infinite retry loops
- **Trend Analysis**: Detecting improvement patterns
- **Memory Resilience**: Handling state across attempts

## 🎮 Interactive Features

### Browser Demo Presets:
- **Null Check Missing**: Common runtime error scenario
- **Semicolon Missing**: Syntax error example
- **Async/Await Missing**: Promise handling issues
- **Complex Logic**: Multi-step refinement process

### CLI Demo Features:
- Simulated debugging attempts
- Real-time progress updates
- Circuit breaker status
- Final analysis summary

## 🔧 Technical Notes

- Both demos use simulated data for demonstration
- Real implementation would integrate with actual AI models
- The system demonstrates envelope-guided retries and memory mirroring
- Trend-aware circuit breakers prevent resource waste

## 📈 Learning Outcomes

After running the demos, you'll understand:
- How gradient-based debugging improves code iteratively
- The role of confidence scoring in decision making
- Circuit breaker patterns for resilient systems
- Trend analysis for optimization strategies

---

*Ready to contribute? Check out the main README.md for development setup and contribution guidelines!*