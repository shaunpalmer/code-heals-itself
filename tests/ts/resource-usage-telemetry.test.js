"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ai_debugging_1 = require("../../ai-debugging");
const confidence_scoring_1 = require("../../utils/typescript/confidence_scoring");
describe('Sandbox resource usage wiring', () => {
    it('populates resourceUsage on envelope with limits and observed fields', async () => {
        const dbg = new ai_debugging_1.AIDebugger({ sandbox_isolation: 'full' });
        const res = await dbg.attemptWithBackoff(confidence_scoring_1.ErrorType.SYNTAX, 'Missing parenthesis', 'console.log("hello"', 'console.log("hello");', [0.1, 0.2, 0.3], { maxAttempts: 1 });
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
