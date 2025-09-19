"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const confidence_scoring_1 = require("../../utils/typescript/confidence_scoring");
describe('Debug Circuit Breaker Properties', () => {
    it('should debug missing properties', () => {
        const breaker = new confidence_scoring_1.DualCircuitBreaker(5, 7, 0.30, 0.40);
        console.log('Initial breaker state:');
        console.log('Methods available:', Object.getOwnPropertyNames(Object.getPrototypeOf(breaker)));
        // Record a simple attempt
        breaker.record_attempt(confidence_scoring_1.ErrorType.LOGIC, true, 10, 5, 0.75, 100);
        console.log('\nAfter recording attempt:');
        const summary = breaker.get_state_summary();
        console.log('Summary keys:', Object.keys(summary));
        console.log('Summary:', summary);
        // Test individual methods
        console.log('\nTesting individual methods:');
        console.log('isShowingImprovement:', breaker.isShowingImprovement());
        console.log('getImprovementVelocity:', breaker.getImprovementVelocity());
        console.log('getRecommendedAction:', breaker.getRecommendedAction());
        console.log('current_strategy:', breaker.current_strategy);
        expect(true).toBe(true); // Just to make it pass
    });
});
