"use strict";
// Lightweight backoff helpers: sleep, jitter, and suggestion based on breaker summary
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdaptiveBackoffPolicy = exports.DefaultBackoffPolicy = void 0;
exports.sleep = sleep;
exports.withJitter = withJitter;
exports.suggestBackoffMs = suggestBackoffMs;
exports.pauseAndJitterConsult = pauseAndJitterConsult;
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
}
function withJitter(ms, ratio = 0.3) {
    const base = Math.max(0, ms);
    const jitter = base * Math.max(0, Math.min(1, ratio));
    const delta = (Math.random() * 2 - 1) * jitter; // [-jitter, +jitter]
    return Math.max(0, Math.round(base + delta));
}
function suggestBackoffMs(summary, defaults = { short: 800, medium: 2500, long: 8000 }) {
    if (!summary)
        return defaults.short;
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
// Default policy wraps suggestBackoffMs() + withJitter(), preserving existing behavior
class DefaultBackoffPolicy {
    recommend(summary, bounds) {
        const { minMs, maxMs, defaults } = bounds;
        const suggested = suggestBackoffMs(summary, defaults !== null && defaults !== void 0 ? defaults : {
            short: Math.max(0, minMs),
            medium: Math.min(5000, Math.max(minMs, maxMs) * 2),
            long: Math.min(15000, Math.max(minMs, maxMs) * 5)
        });
        const clamped = Math.min(Math.max(minMs, suggested), Math.max(minMs, maxMs));
        const wait = withJitter(clamped, 0.25);
        return { waitMs: wait, rationale: 'default_suggestion_with_jitter' };
    }
}
exports.DefaultBackoffPolicy = DefaultBackoffPolicy;
// Adaptive policy: exponential with decorrelated jitter, scaled by recent trend
class AdaptiveBackoffPolicy {
    recommend(summary, bounds) {
        const { minMs, maxMs } = bounds;
        const improving = !!(summary === null || summary === void 0 ? void 0 : summary.is_improving);
        const failures = Number((summary === null || summary === void 0 ? void 0 : summary.consecutive_failures) || (summary === null || summary === void 0 ? void 0 : summary.failure_count) || 0);
        const paused = !!(summary === null || summary === void 0 ? void 0 : summary.paused);
        const velocity = Number((summary === null || summary === void 0 ? void 0 : summary.improvement_velocity) || 0);
        // If paused already, respect remaining time if provided
        if (paused && typeof (summary === null || summary === void 0 ? void 0 : summary.pause_remaining_ms) === 'number' && summary.pause_remaining_ms > 0) {
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
exports.AdaptiveBackoffPolicy = AdaptiveBackoffPolicy;
// Unified pause + jitter + LLM consult (optional). Returns the actual wait, the built envelope,
// and any proposed patch from the LLM's reply (if adapter provided).
const jitter_comms_1 = require("./jitter_comms");
const context_extractor_1 = require("./context_extractor");
async function pauseAndJitterConsult(args) {
    const { summary, minMs, maxMs, errorMessage, originalCode, lastPatch, language = 'typescript', lastEnvelopeJson, sessionId, llmAdapter, extraMetadata, backoffPolicy } = args;
    const policy = backoffPolicy !== null && backoffPolicy !== void 0 ? backoffPolicy : new DefaultBackoffPolicy();
    const { waitMs: wait, rationale } = policy.recommend(summary, {
        minMs,
        maxMs,
        defaults: { short: Math.max(0, minMs), medium: Math.min(5000, Math.max(minMs, maxMs) * 2), long: Math.min(15000, Math.max(minMs, maxMs) * 5) }
    });
    const jitterEnv = (0, jitter_comms_1.buildJitterEnvelope)({
        errorMessage,
        originalCode,
        lastPatch,
        language,
        breakerSummary: summary,
        lastEnvelopeJson,
        metadata: { session: sessionId, ...(extraMetadata || {}) },
        widerContext: (() => {
            const ctx = (0, context_extractor_1.extractFunctionContext)(originalCode, lastPatch);
            return {
                function_name: ctx.functionName,
                function_code: ctx.functionCode,
                surrounding: ctx.surrounding
            };
        })(),
        syntaxBalance: (0, context_extractor_1.basicBalanceScan)(lastPatch)
    });
    let llmReplyText = null;
    let proposedPatch = null;
    if (llmAdapter) {
        const [_, reply] = await Promise.all([
            sleep(wait),
            llmAdapter(JSON.stringify(jitterEnv), jitter_comms_1.defaultSystemPrompt).catch(() => ({ text: '' }))
        ]);
        llmReplyText = (reply === null || reply === void 0 ? void 0 : reply.text) || '';
        const patch = (0, jitter_comms_1.extractProposedPatch)(llmReplyText);
        proposedPatch = patch && patch.length > 0 ? patch : null;
    }
    else {
        await sleep(wait);
    }
    return { waitMs: wait, rationale, envelope: jitterEnv, llmReplyText, proposedPatch };
}
