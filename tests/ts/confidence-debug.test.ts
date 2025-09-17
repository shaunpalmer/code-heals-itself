/**
 * Debug test to understand confidence calculation
 */

import { AIDebugger, HealerPolicy } from '../../ai-debugging';
import { ErrorType } from '../../utils/typescript/confidence_scoring';

describe('Confidence Calculation Debug', () => {
  it('should show actual confidence scores', () => {
    const aiDebugger = new AIDebugger({
      syntax_conf_floor: 0.01, // 1% - extremely low threshold  
      logic_conf_floor: 0.01
    });

    console.log('Testing different confidence levels:');

    const testCases = [
      { name: 'Very High', logits: [0.99, 0.98, 0.97] },
      { name: 'High', logits: [0.95, 0.94, 0.93] },
      { name: 'Medium', logits: [0.85, 0.84, 0.83] },
      { name: 'Low', logits: [0.60, 0.59, 0.58] }
    ];

    testCases.forEach(testCase => {
      try {
        const result = aiDebugger.process_error(
          ErrorType.SYNTAX,
          `Test ${testCase.name}`,
          'console.log("test");',
          'console.log("broken"',
          testCase.logits
        );
        console.log(`${testCase.name} (${testCase.logits}): Action = ${result.action}`);
        if (result.envelope && result.envelope.metadata && result.envelope.metadata.confidence) {
          console.log(`  Confidence: ${JSON.stringify(result.envelope.metadata.confidence)}`);
        }
        if (result.extras) {
          console.log(`  Extras: ${JSON.stringify(result.extras)}`);
        }
      } catch (error) {
        console.log(`${testCase.name} (${testCase.logits}): BLOCKED - ${(error as Error).message}`);
      }
    });

    // This test always passes - it's just for debugging
    expect(true).toBe(true);
  });
});