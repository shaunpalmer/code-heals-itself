import { AIDebugger } from '../../ai-debugging';
import { ErrorType } from '../../utils/typescript/confidence_scoring';

describe('Sandbox resource usage wiring', () => {
  it('populates resourceUsage on envelope with limits and observed fields', async () => {
    const dbg = new AIDebugger({ sandbox_isolation: 'full' });
    const res = await dbg.attemptWithBackoff(
      ErrorType.SYNTAX,
      'Missing parenthesis',
      'console.log("hello"',
      'console.log("hello");',
      [0.1, 0.2, 0.3],
      { maxAttempts: 1 }
    );

    const env = res.envelope;
    expect(env).toBeTruthy();
    expect(env.resourceUsage).toBeTruthy();
    expect(env.resourceUsage.limits).toBeTruthy();
    expect(typeof env.resourceUsage.limits.max_execution_time_ms).toBe('number');
    expect(typeof env.resourceUsage.limits.max_memory_mb).toBe('number');
    expect(typeof env.resourceUsage.limits.max_cpu_percent).toBe('number');
    expect(env.resourceUsage.observed).toBeTruthy();
    expect(typeof env.resourceUsage.observed.execution_time_ms).toBe('number');
  });
});
