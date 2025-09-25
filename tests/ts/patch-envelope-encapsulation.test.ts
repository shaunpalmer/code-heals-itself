import crypto from 'crypto';
import {
  PatchEnvelope,
  withMutableEnvelope,
  applyDeveloperFlag,
  markSuccess,
  setEnvelopeTimestamp,
  setEnvelopeHash,
  appendAttempt
} from '../../utils/typescript/envelope';

describe('PatchEnvelope encapsulation', () => {
  it('keeps flag aliases and success in sync when helpers mutate state', () => {
    const envelope = new PatchEnvelope('patch-123', { change: 'refactor' }, { origin: 'unit-test' });

    expect(envelope.flaggedForDeveloper).toBe(false);
    expect(envelope.flagged_for_developer).toBe(false);
    expect(envelope.developerMessage).toBe('');

    withMutableEnvelope(envelope, (draft) => {
      applyDeveloperFlag(draft, { flagged: true, message: 'Manual review required', reasonCode: 'risk_gate' });
      markSuccess(draft, true);
      appendAttempt(draft, { success: true, note: 'initial attempt', breakerState: 'HALF_OPEN', failureCount: 0 });
    });

    expect(envelope.flaggedForDeveloper).toBe(true);
    expect(envelope.flagged_for_developer).toBe(true);
    expect(envelope.developerMessage).toBe('Manual review required');
    expect(envelope.developer_message).toBe('Manual review required');
    expect(envelope.developer_flag_reason).toBe('risk_gate');
    expect(envelope.success).toBe(true);
    expect(envelope.attempts.length).toBe(1);
  });

  it('round-trips through JSON without losing counters, timeline, or hash', () => {
    const envelope = new PatchEnvelope('patch-456', { fix: 'bounds-check' }, { subsystem: 'safety' });
    const ts = '2025-09-25T12:34:56.000Z';

    envelope.counters = { totalAttempts: 2, syntaxAttempts: 1, errorsResolvedTotal: 3 };
    envelope.timeline = [
      { attempt: 1, ts, errorsDetected: 5, errorsResolved: 3, overallConfidence: 0.66, breakerState: 'CLOSED', action: 'PROMOTE' }
    ];
    envelope.policySnapshot = { syntax_error_budget: 0.1, logic_error_budget: 0.2 };
    envelope.developer_flag_reason = 'watchdog';

    withMutableEnvelope(envelope, (draft) => {
      setEnvelopeTimestamp(draft, ts);
      const sha256Hex = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
      setEnvelopeHash(draft, sha256Hex);
    });

    const serialized = envelope.toJson();
    const restored = PatchEnvelope.fromJson(serialized);

    expect(restored.counters).toEqual(envelope.counters);
    expect(restored.timeline).toEqual(envelope.timeline);
    expect(restored.policySnapshot).toEqual(envelope.policySnapshot);
    expect(restored.developer_flag_reason).toBe('watchdog');
    expect(restored.envelopeHash).toBe(envelope.envelopeHash);
    expect(restored.timestamp).toBe(ts);
  });

  it('clone produces an independent copy', () => {
    const envelope = new PatchEnvelope('patch-789', { change: 'optimize-loop' });
    envelope.metadata = { created_at: 'override', language: 'typescript', ai_generated: true, feature: 'encapsulation' };

    const clone = envelope.clone();
    expect(clone).not.toBe(envelope);
    expect(clone.patchId).toBe(envelope.patchId);
    expect(clone.patchData).toEqual(envelope.patchData);

    withMutableEnvelope(clone, (draft) => {
      applyDeveloperFlag(draft, { flagged: true, message: 'Clone mutated' });
    });

    expect(envelope.flaggedForDeveloper).toBe(false);
    expect(clone.flaggedForDeveloper).toBe(true);
  });
});
