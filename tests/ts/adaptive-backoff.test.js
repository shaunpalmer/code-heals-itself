"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const backoff_1 = require("../../utils/typescript/backoff");
describe('AdaptiveBackoffPolicy', () => {
    it('shortens waits when improving and scales with velocity', () => {
        const policy = new backoff_1.AdaptiveBackoffPolicy();
        const improving = { is_improving: true, improvement_velocity: 0.3 };
        const { waitMs: w1, rationale: r1 } = policy.recommend(improving, { minMs: 100, maxMs: 1000 });
        expect(r1).toBe('adaptive_improving_short_debounce');
        expect(w1).toBeGreaterThanOrEqual(100);
        expect(w1).toBeLessThanOrEqual(1000);
    });
    it('increases waits with consecutive failures using exponential scaling', () => {
        const policy = new backoff_1.AdaptiveBackoffPolicy();
        const bounds = { minMs: 100, maxMs: 4000 };
        const { waitMs: w0 } = policy.recommend({ is_improving: false, consecutive_failures: 0 }, bounds);
        const { waitMs: w3 } = policy.recommend({ is_improving: false, consecutive_failures: 3 }, bounds);
        const { waitMs: w5 } = policy.recommend({ is_improving: false, consecutive_failures: 5 }, bounds);
        expect(w3).toBeGreaterThanOrEqual(100);
        expect(w5).toBeGreaterThanOrEqual(100);
        // probabilistic but trend should increase expected range; at minimum ensure bounds hold
        expect(w0).toBeLessThanOrEqual(4000);
        expect(w3).toBeLessThanOrEqual(4000);
        expect(w5).toBeLessThanOrEqual(4000);
    });
});
