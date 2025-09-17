// Lightweight backoff helpers: sleep, jitter, and suggestion based on breaker summary

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
}

export function withJitter(ms: number, ratio: number = 0.3): number {
  const base = Math.max(0, ms);
  const jitter = base * Math.max(0, Math.min(1, ratio));
  const delta = (Math.random() * 2 - 1) * jitter; // [-jitter, +jitter]
  return Math.max(0, Math.round(base + delta));
}

export function suggestBackoffMs(
  summary: Record<string, any>,
  defaults: { short: number; medium: number; long: number } = { short: 800, medium: 2500, long: 8000 }
): number {
  if (!summary) return defaults.short;

  // If already paused, respect remaining time
  if (summary.paused && typeof summary.pause_remaining_ms === 'number' && summary.pause_remaining_ms > 0) {
    return summary.pause_remaining_ms;
  }

  // Oscillation/noisy confidence: short pause
  if (summary.confidence_improving && !summary.is_improving) {
    return defaults.short;
  }

  // Not improving and should not continue: medium backoff
  if (!summary.is_improving && summary.should_continue_attempts === false) {
    return defaults.medium;
  }

  // Default: small debounce
  return defaults.short;
}

// Backoff policy interface to customize delay selection
export interface BackoffPolicy {
  recommend(
    summary: Record<string, any>,
    bounds: { minMs: number; maxMs: number; defaults?: { short: number; medium: number; long: number } }
  ): { waitMs: number; rationale?: string };
}

// Default policy wraps suggestBackoffMs() + withJitter(), preserving existing behavior
export class DefaultBackoffPolicy implements BackoffPolicy {
  recommend(
    summary: Record<string, any>,
    bounds: { minMs: number; maxMs: number; defaults?: { short: number; medium: number; long: number } }
  ): { waitMs: number; rationale?: string } {
    const { minMs, maxMs, defaults } = bounds;
    const suggested = suggestBackoffMs(
      summary,
      defaults ?? {
        short: Math.max(0, minMs),
        medium: Math.min(5000, Math.max(minMs, maxMs) * 2),
        long: Math.min(15000, Math.max(minMs, maxMs) * 5)
      }
    );
    const clamped = Math.min(Math.max(minMs, suggested), Math.max(minMs, maxMs));
    const wait = withJitter(clamped, 0.25);
    return { waitMs: wait, rationale: 'default_suggestion_with_jitter' };
  }
}

// Adaptive policy: exponential with decorrelated jitter, scaled by recent trend
export class AdaptiveBackoffPolicy implements BackoffPolicy {
  recommend(
    summary: Record<string, any>,
    bounds: { minMs: number; maxMs: number; defaults?: { short: number; medium: number; long: number } }
  ): { waitMs: number; rationale?: string } {
    const { minMs, maxMs } = bounds;
    const improving = !!summary?.is_improving;
    const failures = Number(summary?.consecutive_failures || summary?.failure_count || 0);
    const paused = !!summary?.paused;
    const velocity = Number(summary?.improvement_velocity || 0);

    // If paused already, respect remaining time if provided
    if (paused && typeof summary?.pause_remaining_ms === 'number' && summary.pause_remaining_ms > 0) {
      return { waitMs: Math.min(Math.max(minMs, summary.pause_remaining_ms), Math.max(minMs, maxMs)), rationale: 'respect_existing_pause' };
    }

    // Base backoff window
    const base = improving
      ? Math.max(minMs, Math.floor(minMs * 0.6))
      : Math.min(Math.max(minMs, maxMs), Math.max(minMs, Math.floor(minMs * Math.pow(2, Math.min(6, failures)))));

    // Scale by velocity: stronger improvements reduce debounce, worsening increases it slightly
    const velocityScale = improving ? Math.max(0.5, 1 - Math.min(0.4, Math.abs(velocity))) : 1.2 + Math.min(0.8, Math.abs(velocity));
    const target = Math.min(Math.max(minMs, Math.floor(base * velocityScale)), Math.max(minMs, maxMs));

    // Decorrelated jitter per AWS backoff guidance: random between min and 3/2 * target
    const upper = Math.min(Math.max(minMs, Math.floor(target * 1.5)), Math.max(minMs, maxMs));
    const wait = Math.floor(Math.random() * (upper - minMs + 1)) + minMs;

    const rationale = improving
      ? 'adaptive_improving_short_debounce'
      : failures > 0
        ? `adaptive_exponential_backoff_failures_${failures}`
        : 'adaptive_default_debounce';

    return { waitMs: wait, rationale };
  }
}

// Unified pause + jitter + LLM consult (optional). Returns the actual wait, the built envelope,
// and any proposed patch from the LLM's reply (if adapter provided).
import { buildJitterEnvelope, extractProposedPatch, defaultSystemPrompt, LLMAdapter } from './jitter_comms';
import { extractFunctionContext, basicBalanceScan } from './context_extractor';

export async function pauseAndJitterConsult(args: {
  summary: Record<string, any>;
  minMs: number;
  maxMs: number;
  errorMessage: string;
  originalCode: string;
  lastPatch: string;
  language?: string;
  lastEnvelopeJson?: any;
  sessionId?: string;
  llmAdapter?: LLMAdapter;
  extraMetadata?: Record<string, any>;
  backoffPolicy?: BackoffPolicy;
}): Promise<{
  waitMs: number;
  rationale?: string;
  envelope: any;
  llmReplyText?: string | null;
  proposedPatch?: string | null;
}> {
  const { summary, minMs, maxMs, errorMessage, originalCode, lastPatch, language = 'typescript', lastEnvelopeJson, sessionId, llmAdapter, extraMetadata, backoffPolicy } = args;

  const policy = backoffPolicy ?? new DefaultBackoffPolicy();
  const { waitMs: wait, rationale } = policy.recommend(summary, {
    minMs,
    maxMs,
    defaults: { short: Math.max(0, minMs), medium: Math.min(5000, Math.max(minMs, maxMs) * 2), long: Math.min(15000, Math.max(minMs, maxMs) * 5) }
  });

  const jitterEnv = buildJitterEnvelope({
    errorMessage,
    originalCode,
    lastPatch,
    language,
    breakerSummary: summary,
    lastEnvelopeJson,
    metadata: { session: sessionId, ...(extraMetadata || {}) },
    widerContext: (() => {
      const ctx = extractFunctionContext(originalCode, lastPatch);
      return {
        function_name: ctx.functionName,
        function_code: ctx.functionCode,
        surrounding: ctx.surrounding
      };
    })(),
    syntaxBalance: basicBalanceScan(lastPatch)
  });

  let llmReplyText: string | null = null;
  let proposedPatch: string | null = null;

  if (llmAdapter) {
    const [_, reply] = await Promise.all([
      sleep(wait),
      llmAdapter(JSON.stringify(jitterEnv), defaultSystemPrompt).catch(() => ({ text: '' }))
    ]);
    llmReplyText = reply?.text || '';
    const patch = extractProposedPatch(llmReplyText);
    proposedPatch = patch && patch.length > 0 ? patch : null;
  } else {
    await sleep(wait);
  }

  return { waitMs: wait, rationale, envelope: jitterEnv, llmReplyText, proposedPatch };
}
