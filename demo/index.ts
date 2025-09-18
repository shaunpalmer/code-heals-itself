#!/usr/bin/env node

/**
 * Code Heals Itself - Interactive Demo CLI
 *
 * This is the main demonstration entry point for the Code Heals Itself system.
 * Run this to see gradient-based debugging concepts in action!
 *
 * Usage:
 *   npm run demo
 *   or
 *   npx ts-node demo/index.ts
 */

import { TrendAwareCircuitBreaker } from '../utils/typescript/trend_aware_circuit_breaker';
import { ErrorType } from '../utils/typescript/confidence_scoring';

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

  async runDemo() {
    console.log('🚀 Code Heals Itself - Interactive Demo');
    console.log('='.repeat(50));
    console.log('');
    console.log('🎯 Demonstrating Gradient-Based Debugging Concepts');
    console.log('');

    // Demo scenarios
    const scenarios = [
      {
        name: '🔧 Null Check Missing',
        code: `function processUser(user) {\n  return user.name.toUpperCase();\n}`,
        description: 'Missing null check causing potential runtime error',
        simulatedErrors: [5, 3, 1, 0], // errors decreasing (improving)
        simulatedConfidence: [0.3, 0.6, 0.8, 0.95] // confidence increasing
      },
      {
        name: '📝 Semicolon Missing',
        code: `function calculate(x, y) {\n  const result = x + y\n  return result\n}`,
        description: 'Missing semicolon causing syntax issues',
        simulatedErrors: [3, 2, 2, 2], // plateauing (not improving)
        simulatedConfidence: [0.4, 0.5, 0.5, 0.45] // confidence plateauing
      },
      {
        name: '🔄 Complex Logic Error',
        code: `function complexLogic(data) {\n  if (data.value > 0) {\n    return data.value * 2;\n  } else {\n    return "invalid";\n  }\n}`,
        description: 'Complex logic requiring multiple refinements',
        simulatedErrors: [8, 6, 4, 2, 1, 0], // steady improvement
        simulatedConfidence: [0.2, 0.4, 0.6, 0.8, 0.9, 0.97] // steady confidence growth
      }
    ];

    for (const scenario of scenarios) {
      await this.runScenario(scenario);
      console.log('');
      console.log('⏳ Waiting 3 seconds before next demo...');
      await this.delay(3000);
    }

    console.log('🎉 Demo complete! The system shows:');
    console.log('   📈 Error gradients (improvement tracking)');
    console.log('   🎯 Confidence scoring');
    console.log('   🔌 Circuit breaker logic');
    console.log('   📊 Trend analysis');
    console.log('');
    console.log('Try the interactive mode: npx ts-node demo/index.ts --interactive');
  }

  public async runScenario(scenario: any) {
    console.log(`🎯 ${scenario.name}`);
    console.log(`📝 ${scenario.description}`);
    console.log('');
    console.log('📄 Original Code:');
    console.log('-'.repeat(40));
    console.log(scenario.code);
    console.log('-'.repeat(40));
    console.log('');

    // Simulate the debugging process
    console.log('🤖 Running Gradient-Based Analysis...');
    console.log('');

    for (let attempt = 0; attempt < scenario.simulatedErrors.length; attempt++) {
      const errors = scenario.simulatedErrors[attempt];
      const confidence = scenario.simulatedConfidence[attempt];

      console.log(`🔄 Attempt ${attempt + 1}:`);
      console.log(`   📊 Errors Detected: ${errors}`);
      console.log(`   🎯 Confidence Score: ${(confidence * 100).toFixed(1)}%`);

      // Record attempt in circuit breaker
      this.breaker.recordAttempt(
        errors,
        attempt > 0 ? scenario.simulatedErrors[attempt - 1] - errors : 0,
        confidence,
        [ErrorType.SYNTAX], // simplified
        attempt + 1
      );

      // Show improvement trend
      if (attempt > 0) {
        const prevErrors = scenario.simulatedErrors[attempt - 1];
        const errorDelta = prevErrors - errors;
        const confidenceDelta = confidence - scenario.simulatedConfidence[attempt - 1];

        console.log(`   📈 Error Delta: ${errorDelta > 0 ? '+' : ''}${errorDelta}`);
        console.log(`   📊 Confidence Delta: ${(confidenceDelta * 100).toFixed(1)}%`);

        if (errorDelta > 0) {
          console.log(`   ✅ IMPROVEMENT: ${errorDelta} fewer errors!`);
        } else if (errorDelta === 0) {
          console.log(`   ⚠️  PLATEAU: No improvement detected`);
        } else {
          console.log(`   ❌ REGRESSION: ${Math.abs(errorDelta)} more errors`);
        }
      }

      console.log('');
      await this.delay(1000);
    }

    // Show final analysis
    console.log('📊 Final Analysis:');
    console.log('-'.repeat(30));

    const finalErrors = scenario.simulatedErrors[scenario.simulatedErrors.length - 1];
    const finalConfidence = scenario.simulatedConfidence[scenario.simulatedConfidence.length - 1];

    if (finalErrors === 0) {
      console.log('✅ SUCCESS: All errors resolved!');
    } else {
      console.log(`⚠️  PARTIAL: ${finalErrors} errors remaining`);
    }

    console.log(`🎯 Final Confidence: ${(finalConfidence * 100).toFixed(1)}%`);

    // Show trend analysis
    const [canContinue, reason, trend] = this.breaker.canAttempt();
    console.log(`📈 Overall Trend: ${trend.direction.toUpperCase()}`);
    console.log(`⚡ Improvement Velocity: ${(trend.velocityScore * 100).toFixed(1)}%`);
    console.log(`🎲 Stagnation Risk: ${(trend.stagnationRisk * 100).toFixed(1)}%`);
    console.log(`🔄 Can Continue: ${canContinue ? 'YES' : 'NO'} - ${reason}`);

    console.log('');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Interactive mode for custom code
async function runInteractive() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('🎮 Interactive Mode');
  console.log('Enter a description of your code issue (press Enter when done):');
  console.log('');

  rl.question('> ', async (description: string) => {
    rl.close();

    if (description.trim()) {
      const demo = new DemoRunner();
      await demo.runScenario({
        name: '🎮 Your Custom Scenario',
        code: `// Your code would go here\nfunction example() {\n  // Simulating your issue\n}`,
        description: description.trim(),
        simulatedErrors: [4, 2, 1, 0],
        simulatedConfidence: [0.3, 0.7, 0.9, 0.98]
      });
    } else {
      console.log('No description provided. Exiting...');
    }
  });
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--interactive') || args.includes('-i')) {
    await runInteractive();
  } else {
    const demo = new DemoRunner();
    await demo.runDemo();
  }
}

// Handle errors gracefully
main().catch(error => {
  console.error('💥 Demo failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});