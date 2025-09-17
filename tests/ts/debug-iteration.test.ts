import { AIDebugger } from '../../ai-debugging';
import { ErrorType } from '../../utils/typescript/confidence_scoring';

describe('AI Debugger - Debug Iteration Logic', () => {
  let aiDebugger: AIDebugger;
  let mockSandbox: any;
  let originalExecute: any;

  beforeEach(() => {
    // Create debugger with controlled limits for testing
    aiDebugger = new AIDebugger({
      syntax_conf_floor: 0.1, // Lower thresholds to allow more attempts
      logic_conf_floor: 0.1,
      require_human_on_risky: false
    });

    // Capture original sandbox execute method
    mockSandbox = (aiDebugger as any).sandbox;
    originalExecute = mockSandbox.execute_patch;
  });

  afterEach(() => {
    // Restore original method
    if (originalExecute) {
      mockSandbox.execute_patch = originalExecute;
    }
  });

  it('should debug why everything returns STOP', async () => {
    const testCode = "console.log('test');";
    const patchedCode = "console.log('fixed');";

    // Mock sandbox for success
    mockSandbox.execute_patch = jest.fn(() => ({
      success: true,
      result: "Test success",
      confidence: 0.9
    }));

    // Add debug logging to see what's happening
    const breaker = (aiDebugger as any).breaker;
    const cascade = (aiDebugger as any).cascade;
    const scorer = (aiDebugger as any).scorer;

    console.log('Initial breaker state:', breaker.get_state_summary());
    console.log('Initial cascade length:', cascade.error_chain.length);

    const logits = [0.8, 0.7, 0.9]; // High confidence logits
    const historical = { test: true };

    // Test confidence calculation
    const conf = scorer.calculate_confidence(logits, ErrorType.LOGIC, historical);
    console.log('Calculated confidence:', conf);

    // Test circuit breaker
    const [canAttempt, cbReason] = breaker.can_attempt(ErrorType.LOGIC);
    console.log('Circuit breaker can_attempt:', canAttempt, cbReason);

    // Test cascade
    const [stop, cascadeReason] = cascade.should_stop_attempting();
    console.log('Cascade should_stop:', stop, cascadeReason);

    // Test confidence threshold
    const floor = 0.1; // Same as logic_conf_floor
    const typeConf = conf.logic_confidence;
    console.log('Type confidence vs floor:', typeConf, 'vs', floor, '(passes:', typeConf >= floor, ')');

    const result = aiDebugger.process_error(
      ErrorType.LOGIC,
      "Debug test error",
      patchedCode,
      testCode,
      logits,
      historical
    );

    console.log('Final result:', result);

    // The result should not be STOP if everything is configured correctly
    expect(['PROMOTE', 'RETRY']).toContain(result.action);
  });

  it('should test with very permissive settings', async () => {
    // Create a new debugger with extremely permissive settings
    const permissiveDebugger = new AIDebugger({
      syntax_conf_floor: 0.01, // Almost no threshold
      logic_conf_floor: 0.01,
      require_human_on_risky: false
    });

    const mockSandbox2 = (permissiveDebugger as any).sandbox;
    mockSandbox2.execute_patch = jest.fn(() => ({
      success: true,
      result: "Should succeed",
      confidence: 0.95
    }));

    const result = permissiveDebugger.process_error(
      ErrorType.LOGIC,
      "Permissive test",
      "console.log('fixed');",
      "console.log('broken');",
      [0.9, 0.8, 0.7], // Very high confidence
      {}
    );

    console.log('Permissive result:', result);
    expect(result.action).toBe('PROMOTE');
  });
});