"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ai_debugging_1 = require("../../ai-debugging");
const confidence_scoring_1 = require("../../utils/typescript/confidence_scoring");
describe('AIDebugger.attemptWithBackoff smoke', () => {
    it('retries with small backoff and returns a result', async () => {
        const dbg = new ai_debugging_1.AIDebugger({ max_syntax_attempts: 3, max_logic_attempts: 3, syntax_conf_floor: 0.2, logic_conf_floor: 0.2 });
        const original = 'console.log("start")';
        const patch = 'console.log("start"'; // missing ) to trigger tweak/balance
        const logits = [0.3, 0.25, 0.2];
        const res = await dbg.attemptWithBackoff(confidence_scoring_1.ErrorType.SYNTAX, 'SyntaxError: missing )', patch, original, logits, { maxAttempts: 2, minMs: 10, maxMs: 20 });
        expect(res).toBeDefined();
        expect(typeof res.action).toBe('string');
        expect(res.envelope).toBeDefined();
    });
});
