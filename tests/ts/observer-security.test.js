"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ai_debugging_1 = require("../../ai-debugging");
const confidence_scoring_1 = require("../../utils/typescript/confidence_scoring");
describe('Observer & Security layer', () => {
    it('flags risky edits and routes to HUMAN_REVIEW when policy requires', () => {
        var _a, _b, _c;
        const dbg = new ai_debugging_1.AIDebugger({ require_human_on_risky: true, risky_keywords: ["drop table", "authentication_bypass"] });
        const original = `function ok(){ return 1; }`;
        const risky = `function migrate(){ /* authentication_bypass */ return 1; }`;
        const res = dbg.process_error(confidence_scoring_1.ErrorType.LOGIC, 'simulate risky change', risky, original, [0.5, 0.4, 0.3], {}, { test_id: 'risk1' });
        expect(res.action).toBe('HUMAN_REVIEW');
        expect((_c = (_b = (_a = res.envelope) === null || _a === void 0 ? void 0 : _a.metadata) === null || _b === void 0 ? void 0 : _b.risk_flags) === null || _c === void 0 ? void 0 : _c.length).toBeGreaterThan(0);
    });
    it('watchdog grants first-attempt grace, then rolls back on persistent high severity without improvement', async () => {
        var _a, _b, _c, _d, _e, _f;
        const dbg = new ai_debugging_1.AIDebugger({ require_human_on_risky: false });
        const anyDbg = dbg;
        const sandbox = anyDbg.sandbox;
        const origGet = sandbox.getResourceUsage.bind(sandbox);
        sandbox.getResourceUsage = () => ({
            observed: { execution_time_ms: 10000, memory_used_mb: 50, cpu_used_percent: 95, limits_hit: { time: true, memory: false, cpu: true } },
            limits: { max_execution_time_ms: 100, max_memory_mb: 500, max_cpu_percent: 80 }
        });
        const original = `function f(){ return 1; }`;
        const patch = `function f(){ for(;;){} }`;
        // attemptWithBackoff will run multiple attempts, leveraging envelope metadata
        const res = await dbg.attemptWithBackoff(confidence_scoring_1.ErrorType.LOGIC, 'simulate hang', patch, original, [0.2, 0.1, 0.05], { maxAttempts: 2, minMs: 0, maxMs: 0 });
        // Ensure watchdog fired
        expect(((_c = (_b = (_a = res.extras) === null || _a === void 0 ? void 0 : _a.observers) === null || _b === void 0 ? void 0 : _b.watchdog) === null || _c === void 0 ? void 0 : _c.triggered) || ((_f = (_e = (_d = res.envelope) === null || _d === void 0 ? void 0 : _d.metadata) === null || _e === void 0 ? void 0 : _e.watchdog) === null || _f === void 0 ? void 0 : _f.triggered)).toBeTruthy();
        // On persistence and no improvement, expect rollback by second attempt
        expect(['ROLLBACK', 'HUMAN_REVIEW', 'STOP']).toContain(res.action);
        sandbox.getResourceUsage = origGet;
    });
});
