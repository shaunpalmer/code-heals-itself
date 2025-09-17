// Clean minimal integration tests for AIDebugger behavior
import { AIDebugger, HealerPolicy } from '../../ai-debugging';
import { ErrorType } from '../../utils/typescript/confidence_scoring';

describe('AIDebugger integration (minimal)', () => {
  let aiDebugger: AIDebugger;

  beforeEach(() => {
    const testPolicy: Partial<HealerPolicy> = {
      max_syntax_attempts: 3,
      max_logic_attempts: 5,
      syntax_error_budget: 0.05,
      logic_error_budget: 0.10,
      syntax_conf_floor: 0.30,
      logic_conf_floor: 0.20,
    };
    aiDebugger = new AIDebugger(testPolicy);
  });

  it('process_error returns an envelope and action', () => {
    const result = aiDebugger.process_error(
      ErrorType.SYNTAX,
      'SyntaxError: missing ) after argument list',
      'console.log("fixed");',
      'console.log("broken"',
      [0.99, 0.98, 0.97]
    );

    expect(result).toBeDefined();
    expect(result.envelope).toBeDefined();
    expect(typeof result.action).toBe('string');
  });

  it('persists memory across instances', async () => {
    aiDebugger.process_error(
      ErrorType.LOGIC,
      'TypeError: Cannot read properties of undefined',
      'if (obj) { console.log(obj.a); }',
      'console.log(obj.a)',
      [0.85, 0.82, 0.80]
    );

    const path = './test-integration-memory.json';
    await aiDebugger.saveMemory(path);
    const stats = aiDebugger.getMemoryStats();
    expect(stats.bufferSize).toBeGreaterThan(0);

    const newDebugger = new AIDebugger();
    await newDebugger.loadMemory(path);
    const newStats = newDebugger.getMemoryStats();
    expect(newStats.bufferSize).toBe(stats.bufferSize);

    // Cleanup best-effort
    try {
      const fs = await import('fs/promises');
      await fs.unlink(path);
    } catch {
      // ignore
    }
  });
});