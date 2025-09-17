// Jitter-based communication envelope for LLM-guided retries

export type LLMAdapter = (prompt: string, systemPrompt?: string) => Promise<{ text: string }>;

export interface JitterEnvelope {
  type: string; // 'jitter.request.v1'
  ts: string; // ISO timestamp
  session?: string;
  instructions: string[];
  context: {
    error_message: string;
    original_code: string;
    last_patch_code: string;
    language: string;
    wider_context?: {
      function_name?: string;
      function_code?: string;
      surrounding?: string;
    };
    syntax_balance?: {
      paren: { open: number; close: number; missingClose: number };
      brace: { open: number; close: number; missingClose: number };
      bracket: { open: number; close: number; missingClose: number };
      semicolonHeuristicMissing: number;
    };
  };
  trend: Record<string, any>;
  last_attempt_status?: {
    success?: boolean;
    message?: string;
    errors_resolved?: number;
    // Positive means improvement (fewer errors than previous attempt)
    error_delta?: number;
  };
  last_envelope?: any;
  constraints?: {
    max_lines_changed?: number;
    disallow_keywords?: string[];
  };
  metadata?: Record<string, any>;
}

export function buildJitterEnvelope(params: {
  errorMessage: string;
  originalCode: string;
  lastPatch: string;
  language?: string;
  breakerSummary?: Record<string, any>;
  lastEnvelopeJson?: any;
  maxLinesChange?: number;
  disallow?: string[];
  metadata?: Record<string, any>;
  widerContext?: {
    function_name?: string;
    function_code?: string;
    surrounding?: string;
  };
  syntaxBalance?: {
    paren: { open: number; close: number; missingClose: number };
    brace: { open: number; close: number; missingClose: number };
    bracket: { open: number; close: number; missingClose: number };
    semicolonHeuristicMissing: number;
  };
}): JitterEnvelope {
  const {
    errorMessage,
    originalCode,
    lastPatch,
    language = 'typescript',
    breakerSummary = {},
    lastEnvelopeJson,
    maxLinesChange = 25,
    disallow = ['database_schema_change', 'authentication_bypass', 'production_data_modification'],
    metadata = {},
    widerContext,
    syntaxBalance
  } = params;

  const env: JitterEnvelope = {
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
        const counts = Array.isArray((breakerSummary as any).recent_error_counts)
          ? (breakerSummary as any).recent_error_counts as number[]
          : [];
        const resolvedArr = Array.isArray((breakerSummary as any).recent_errors_resolved)
          ? (breakerSummary as any).recent_errors_resolved as number[]
          : [];
        const errors_resolved = resolvedArr.length > 0 ? resolvedArr[resolvedArr.length - 1] : 0;
        let error_delta = 0;
        if (counts.length >= 2) {
          const prev = counts[counts.length - 2];
          const curr = counts[counts.length - 1];
          // Positive delta means improvement (drop in errors)
          error_delta = Math.max(0, prev - curr);
        } else {
          // Fallback: use errors_resolved if only one data point
          error_delta = Math.max(0, errors_resolved);
        }
        return { errors_resolved, error_delta };
      } catch {
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
export function extractProposedPatch(text: string): string {
  if (!text) return '';
  // Try to extract from fenced code block first
  const fence = text.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
  if (fence && fence[1]) return fence[1].trim();
  // Try JSON field "patched_code"
  try {
    const json = JSON.parse(text);
    if (json && typeof json.patched_code === 'string') return json.patched_code;
  } catch { /* ignore */ }
  // Fallback to raw text
  return text.trim();
}

export const defaultSystemPrompt = (
  'You are a senior engineer performing hyper-focused patching. ' +
  'Respond with the minimal corrected code (or JSON with {"patched_code"}) only. Avoid commentary unless requested.'
);

// Structured container for LLM replies for persistence and intent classification
export class LLMResponse {
  readonly rawText: string;
  readonly proposedPatch: string;
  readonly intent: 'patch' | 'request_more_info' | 'other';

  constructor(rawText: string, proposedPatch: string, intent: 'patch' | 'request_more_info' | 'other' = 'other') {
    this.rawText = rawText;
    this.proposedPatch = proposedPatch;
    this.intent = intent;
  }

  static fromLLMReply(llmReplyText: string): LLMResponse {
    const proposed = extractProposedPatch(llmReplyText);
    const intent: 'patch' | 'request_more_info' | 'other' = proposed
      ? 'patch'
      : /need more info|cannot proceed|insufficient context/i.test(llmReplyText)
        ? 'request_more_info'
        : 'other';
    return new LLMResponse(llmReplyText, proposed, intent);
  }
}

// Encapsulated result of a patch attempt for clear feedback loops
export class PatchResult {
  readonly success: boolean;
  readonly errorsResolved: number;
  // errorDelta mirrors errorsResolved in our current analyzer; kept explicit for clarity
  readonly errorDelta: number;
  readonly message: string;

  constructor(success: boolean, errorsResolved: number, errorDelta: number, message: string = '') {
    this.success = success;
    this.errorsResolved = errorsResolved;
    this.errorDelta = errorDelta;
    this.message = message;
  }
}
