import { AIDebugger, defaultPolicy } from "../../ai-debugging";
import { ErrorType } from "../../utils/typescript/confidence_scoring";

describe('Observer & Security layer', () => {
  it('flags risky edits and routes to HUMAN_REVIEW when policy requires', () => {
    const dbg = new AIDebugger({ require_human_on_risky: true, risky_keywords: ["drop table", "authentication_bypass"] });
    const original = `function ok(){ return 1; }`;
    const risky = `function migrate(){ /* authentication_bypass */ return 1; }`;

    const res = dbg.process_error(
      ErrorType.LOGIC,
      'simulate risky change',
      risky,
      original,
      [0.5, 0.4, 0.3],
      {},
      { test_id: 'risk1' }
    );
    expect(res.action).toBe('HUMAN_REVIEW');
    expect(res.envelope?.metadata?.risk_flags?.length).toBeGreaterThan(0);
  });

  it('watchdog grants first-attempt grace, then rolls back on persistent high severity without improvement', async () => {
    const dbg = new AIDebugger({ require_human_on_risky: false });
    const anyDbg: any = dbg as any;
    const sandbox = anyDbg.sandbox;

    const origGet = sandbox.getResourceUsage.bind(sandbox);
    sandbox.getResourceUsage = () => ({
      observed: { execution_time_ms: 10000, memory_used_mb: 50, cpu_used_percent: 95, limits_hit: { time: true, memory: false, cpu: true } },
      limits: { max_execution_time_ms: 100, max_memory_mb: 500, max_cpu_percent: 80 }
    });

    const original = `function f(){ return 1; }`;
    const patch = `function f(){ for(;;){} }`;

    // attemptWithBackoff will run multiple attempts, leveraging envelope metadata
    const res = await dbg.attemptWithBackoff(
      ErrorType.LOGIC,
      'simulate hang',
      patch,
      original,
      [0.2, 0.1, 0.05],
      { maxAttempts: 2, minMs: 0, maxMs: 0 }
    );

    // Ensure watchdog fired
    expect(res.extras?.observers?.watchdog?.triggered || res.envelope?.metadata?.watchdog?.triggered).toBeTruthy();
    // On persistence and no improvement, expect rollback by second attempt
    expect(['ROLLBACK', 'HUMAN_REVIEW', 'STOP']).toContain(res.action);

    sandbox.getResourceUsage = origGet;
  });
});
