import { DualCircuitBreaker, ErrorType } from '../../utils/typescript/confidence_scoring';

describe('Debug Circuit Breaker Properties', () => {
  it('should debug missing properties', () => {
    const breaker = new DualCircuitBreaker(5, 7, 0.30, 0.40);

    console.log('Initial breaker state:');
    console.log('Methods available:', Object.getOwnPropertyNames(Object.getPrototypeOf(breaker)));

    // Record a simple attempt
    breaker.record_attempt(ErrorType.LOGIC, true, 10, 5, 0.75, 100);

    console.log('\nAfter recording attempt:');
    const summary = breaker.get_state_summary();
    console.log('Summary keys:', Object.keys(summary));
    console.log('Summary:', summary);

    // Test individual methods
    console.log('\nTesting individual methods:');
    console.log('isShowingImprovement:', (breaker as any).isShowingImprovement());
    console.log('getImprovementVelocity:', (breaker as any).getImprovementVelocity());
    console.log('getRecommendedAction:', (breaker as any).getRecommendedAction());
    console.log('current_strategy:', (breaker as any).current_strategy);

    expect(true).toBe(true); // Just to make it pass
  });
});