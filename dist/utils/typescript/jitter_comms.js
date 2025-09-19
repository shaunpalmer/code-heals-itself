"use strict";
// Jitter-based communication envelope for LLM-guided retries
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatchResult = exports.LLMResponse = exports.defaultSystemPrompt = void 0;
exports.buildJitterEnvelope = buildJitterEnvelope;
exports.extractProposedPatch = extractProposedPatch;
function buildJitterEnvelope(params) {
    const { errorMessage, originalCode, lastPatch, language = 'typescript', breakerSummary = {}, lastEnvelopeJson, maxLinesChange = 25, disallow = ['database_schema_change', 'authentication_bypass', 'production_data_modification'], metadata = {}, widerContext, syntaxBalance } = params;
    const env = {
        type: 'jitter.request.v1',
        ts: new Date().toISOString(),
        instructions: [
            'Step 1: Read the error and summarize the concrete root cause in one sentence.',
            'Step 2: Read a wider context of the likely function/block to ensure local consistency.',
            'Step 3: Run mental syntax checks: paren/brace/bracket balance and trailing semicolons where idiomatic.',
            'Step 4: Propose a minimal, logically sound patch for a new attempt (avoid unrelated edits).',
            'Step 5: Return only the corrected code or a JSON object with {"patched_code"}. Keep the diff small.'
        ],
        context: {
            error_message: errorMessage,
            original_code: originalCode,
            last_patch_code: lastPatch,
            language,
            wider_context: widerContext,
            syntax_balance: syntaxBalance
        },
        trend: breakerSummary || {},
        last_attempt_status: (() => {
            try {
                const counts = Array.isArray(breakerSummary.recent_error_counts)
                    ? breakerSummary.recent_error_counts
                    : [];
                const resolvedArr = Array.isArray(breakerSummary.recent_errors_resolved)
                    ? breakerSummary.recent_errors_resolved
                    : [];
                const errors_resolved = resolvedArr.length > 0 ? resolvedArr[resolvedArr.length - 1] : 0;
                let error_delta = 0;
                if (counts.length >= 2) {
                    const prev = counts[counts.length - 2];
                    const curr = counts[counts.length - 1];
                    // Positive delta means improvement (drop in errors)
                    error_delta = Math.max(0, prev - curr);
                }
                else {
                    // Fallback: use errors_resolved if only one data point
                    error_delta = Math.max(0, errors_resolved);
                }
                return { errors_resolved, error_delta };
            }
            catch {
                return { errors_resolved: 0, error_delta: 0 };
            }
        })(),
        last_envelope: lastEnvelopeJson,
        constraints: {
            max_lines_changed: maxLinesChange,
            disallow_keywords: disallow
        },
        metadata
    };
    return env;
}
// Naive extraction of a proposed patch from an LLM response text.
function extractProposedPatch(text) {
    if (!text)
        return '';
    // Try to extract from fenced code block first
    const fence = text.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
    if (fence && fence[1])
        return fence[1].trim();
    // Try JSON field "patched_code"
    try {
        const json = JSON.parse(text);
        if (json && typeof json.patched_code === 'string')
            return json.patched_code;
    }
    catch { /* ignore */ }
    // Fallback to raw text
    return text.trim();
}
exports.defaultSystemPrompt = ('You are a senior engineer performing hyper-focused patching. ' +
    'Respond with the minimal corrected code (or JSON with {"patched_code"}) only. Avoid commentary unless requested.');
/**
 * TODO(API): Provide JSON Schema / OpenAPI snippets for function-calling
 * - Function: debugCode({ error_type, message, patch_code, original_code, logits?, sessionId? }) → { action, envelope, extras }
 * - Endpoint: GET /api/openapi.json → aggregate spec
 * Consumers: LangChain OpenAPI Toolkit, LlamaIndex tool calling, CrewAI MCP.
 */
// Structured container for LLM replies for persistence and intent classification
class LLMResponse {
    constructor(rawText, proposedPatch, intent = 'other') {
        this.rawText = rawText;
        this.proposedPatch = proposedPatch;
        this.intent = intent;
    }
    static fromLLMReply(llmReplyText) {
        const proposed = extractProposedPatch(llmReplyText);
        const intent = proposed
            ? 'patch'
            : /need more info|cannot proceed|insufficient context/i.test(llmReplyText)
                ? 'request_more_info'
                : 'other';
        return new LLMResponse(llmReplyText, proposed, intent);
    }
}
exports.LLMResponse = LLMResponse;
// Encapsulated result of a patch attempt for clear feedback loops
class PatchResult {
    constructor(success, errorsResolved, errorDelta, message = '') {
        this.success = success;
        this.errorsResolved = errorsResolved;
        this.errorDelta = errorDelta;
        this.message = message;
    }
}
exports.PatchResult = PatchResult;
