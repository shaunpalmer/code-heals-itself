/**
 * Debug test to see PatchEnvelope JSON output
 */

import { PatchEnvelope } from '../../utils/typescript/envelope';
import { ErrorType } from '../../utils/typescript/confidence_scoring';

describe('PatchEnvelope JSON Debug', () => {
  it('should show JSON structure', () => {
    const envelope = new PatchEnvelope(
      'test-123',
      {
        original_code: 'console.log("broken"',
        patched_code: 'console.log("fixed");',
        error_message: 'SyntaxError test',
        patch_type: 'SYNTAX_FIX'
      }
    );

    // Simulate setting confidence as AIDebugger would
    envelope.metadata.confidence = {
      overall: 0.95,
      syntax: 0.97,
      logic: 0.85,
      components: {
        syntactic_correctness: 0.98,
        semantic_coherence: 0.92,
        contextual_relevance: 0.90
      }
    };

    const json = envelope.toJson();
    console.log('PatchEnvelope JSON:');
    console.log(json);

    const parsed = JSON.parse(json);
    console.log('\nParsed properties:');
    console.log(Object.keys(parsed));

    console.log('\nMetadata properties:');
    if (parsed.metadata) {
      console.log(Object.keys(parsed.metadata));
    }

    expect(true).toBe(true);
  });
});