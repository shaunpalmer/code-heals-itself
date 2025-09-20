import crypto from 'crypto';
import {
  appendAttempt,
  mergeConfidence,
  updateTrend,
  setBreakerState,
  setCascadeDepth,
  mergeResourceUsage,
  applyDeveloperFlag,
  markSuccess,
  setEnvelopeTimestamp,
  computeStableEnvelopeHash,
  setEnvelopeHash,
  updateCounters,
  addTimelineEntry,
  MutableEnvelope
} from '../../utils/typescript/envelope';

describe('envelope helpers', () => {
  const sha256Hex = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
  let env: MutableEnvelope;
  beforeEach(() => { env = {}; });

  test('mergeConfidence clamps values', () => {
    mergeConfidence(env, { syntax: 1.2, logic: -0.1, risk: 0.5 });
    expect(env.confidenceComponents).toEqual({ syntax: 1, logic: 0, risk: 0.5 });
  });

  test('updateTrend sets improving when errorsResolved > 0', () => {
    updateTrend(env, { errorsDetected: 3, errorsResolved: 1 });
    expect(env.trendMetadata?.errorTrend).toBe('improving');
  });

  test('appendAttempt creates array and pushes', () => {
    appendAttempt(env, { success: true, note: 'ok', breakerState: 'CLOSED', failureCount: 0 });
    expect(Array.isArray(env.attempts)).toBe(true);
    expect(env.attempts!.length).toBe(1);
    expect(env.attempts![0].success).toBe(true);
  });

  test('breaker/cascade/resource merge & timestamp/hash', () => {
    setBreakerState(env, 'CLOSED');
    setCascadeDepth(env, 2);
    mergeResourceUsage(env, { cpuPercent: 10, memoryMB: 50 });
    setEnvelopeTimestamp(env);
    setEnvelopeHash(env, sha256Hex);
    expect(env.breakerState).toBe('CLOSED');
    expect(env.cascadeDepth).toBe(2);
    expect(env.resourceUsage).toMatchObject({ cpuPercent: 10, memoryMB: 50 });
    expect(typeof env.timestamp).toBe('string');
    expect(env.envelopeHash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('developer flag with reason', () => {
    applyDeveloperFlag(env, { flagged: true, message: 'Risky', reasonCode: 'POLICY_RISK' });
    expect(env.flagged_for_developer).toBe(true);
    expect(env.developer_flag_reason).toBe('POLICY_RISK');
  });

  test('success latch', () => {
    markSuccess(env, false);
    expect(env.success).toBe(false);
    markSuccess(env, true);
    expect(env.success).toBe(true);
    markSuccess(env, false);
    expect(env.success).toBe(true); // latched
  });

  test('counters & timeline', () => {
    mergeConfidence(env, { syntax: 0.4, logic: 0.6 });
    updateTrend(env, { errorsDetected: 5, errorsResolved: 2 });
    appendAttempt(env, { success: true, breakerState: 'CLOSED' });
    updateCounters(env, 'syntax', 2);
    addTimelineEntry(env, { attempt: 1, errorsDetected: 5, errorsResolved: 2, overallConfidence: 0.5, breakerState: 'CLOSED', action: 'test' });
    expect(env.counters?.totalAttempts).toBe(1);
    expect(env.counters?.syntaxAttempts).toBe(1);
    expect(env.counters?.errorsResolvedTotal).toBe(2);
    expect(env.timeline?.length).toBe(1);
  });

  test('stable hash excludes attempts/timestamp', () => {
    mergeConfidence(env, { syntax: 0.2 });
    setEnvelopeTimestamp(env, '2025-09-20T00:00:00.000Z');
    const h1 = computeStableEnvelopeHash(env, sha256Hex);
    appendAttempt(env, { success: true, breakerState: 'CLOSED' });
    setEnvelopeTimestamp(env, '2025-09-21T00:00:00.000Z');
    const h2 = computeStableEnvelopeHash(env, sha256Hex);
    expect(h1).toBe(h2); // unchanged because volatile fields excluded
  });
});
