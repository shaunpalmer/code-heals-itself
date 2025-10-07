// ai-debugging.ts
/**
 * TODO(API): Expose AIDebugger via minimal REST/function endpoints for ecosystem integration (LangChain, LlamaIndex, CrewAI).
 *
 * Suggested endpoints (pull-style):
 * - POST /api/debug/run
 *   Input JSON: {
 *     error_type: 'SYNTAX'|'LOGIC'|'RUNTIME'|'PERFORMANCE'|'SECURITY',
 *     message: string,
 *     patch_code: string,
 *     original_code: string,
 *     logits?: number[],
 *     sessionId?: string
 *   }
 *   Response: { action: string; envelope: PatchEnvelopeJson; extras: any }
 *   Notes: Primary entrypoint for LangChain/LlamaIndex/CrewAI function-calling.
 *
 * - GET /api/envelopes/:id
 *   Response: PatchEnvelopeJson (from AIPatchEnvelope/Memory store)
 *
 * - GET /api/history/similar?message=...&code=...
 *   Response: Array<{ envelope: PatchEnvelopeJson; timestamp: string }>
 *
 * - GET /api/openapi.json
 *   Response: OpenAPI spec describing the above routes for OpenAPI toolkits.
 *
 * Push/Bi-directional (optional):
 * - GET /api/chat/:session/stream (SSE) → stream celebration + backoff envelopes
 * - POST /api/chat/:session/message → mirror external agent messages into our memory
 *
 * See: "Fitting in with the crowd.md" for integration patterns and standards.
 */
import {
  UnifiedConfidenceScorer, DualCircuitBreaker, ErrorType, ConfidenceScore
} from "./utils/typescript/confidence_scoring";
import {
  CascadingErrorHandler, SandboxExecution, Environment
} from "./utils/typescript/cascading_error_handler";
import {
  AIPatchEnvelope, PatchEnvelope, MemoryBuffer, ResilientMemoryBuffer,
  appendAttempt,
  mergeConfidence,
  updateTrend,
  setBreakerState,
  setCascadeDepth,
  mergeResourceUsage,
  applyDeveloperFlag,
  markSuccess,
  setEnvelopeTimestamp,
  setEnvelopeHash,
  updateCounters,
  addTimelineEntry,
  MutableEnvelope
} from "./utils/typescript/envelope";
// If running in Node.js, ensure @types/node is installed for type support
import crypto from "crypto";
// If you are targeting the browser, consider using a polyfill like 'crypto-js' or 'webcrypto' and update usages accordingly
import { Debugger, LogAndFixStrategy, RollbackStrategy, SecurityAuditStrategy } from "./utils/typescript/strategy";
import { SeniorDeveloperSimulator } from "./utils/typescript/human_debugging";
import { TrendAwareCircuitBreaker } from "./utils/typescript/trend_aware_circuit_breaker";
import { HangWatchdog, RiskyEditObserver, escalateSuspicion } from "./utils/typescript/observer";
import { PathResolutionObserver } from "./utils/typescript/path_resolution_observer";
import Ajv from "ajv";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { sleep, withJitter, suggestBackoffMs, pauseAndJitterConsult, BackoffPolicy, DefaultBackoffPolicy } from "./utils/typescript/backoff";
import { buildJitterEnvelope, extractProposedPatch, defaultSystemPrompt, LLMAdapter, LLMResponse, PatchResult } from "./utils/typescript/jitter_comms";
import ChatMessageHistoryAdapter from "./utils/typescript/memory_adapter";
import { FinalPolishObserver, createFinalPolishObserver } from "./utils/typescript/final_polish_observer";
import { validateSuccessEnvelope } from "./src/extensions/enable-zod-success-validation";
// Optional lint runners (fail-open if not installed)
import createEnhancedESLintRunner from "./src/extensions/eslint-enhanced-runner";
// Stylelint integration (optional; reporter used for metadata only)
import { createStylelintReporter } from "./src/extensions/stylelint-runner";

/**
 * REBANKER TRUTH-FLOW CONTRACT - Immutability Helpers
 * 
 * These functions enforce the truth-flow contract:
 * - ReBanker diagnostics are immutable ground truth
 * - Hash verification prevents tampering
 * - Error delta calculation measures convergence
 * 
 * Cross-language parity: TypeScript ↔ Python identical behavior
 */

function sha256Json(obj: any): string {
  const canonical = JSON.stringify(obj, Object.keys(obj).sort());
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function assertRebankerImmutable(envelopeMetadata: any): void {
  const raw = envelopeMetadata?.rebanker_raw;
  const storedHash = envelopeMetadata?.rebanker_hash;

  if (raw && storedHash) {
    const computed = sha256Json(raw);
    if (computed !== storedHash) {
      throw new Error(
        `🚨 IMMUTABLE REBANKER INVARIANT VIOLATED 🚨\n` +
        `Expected hash: ${storedHash}\n` +
        `Computed hash: ${computed}\n` +
        `Ground truth packet was tampered with! Aborting retry chain.`
      );
    }
  }
}

function errorDelta(prevRaw: any, curRaw: any): any {
  if (!prevRaw) {
    return { kind: 'first', details: 'Initial attempt, no previous baseline' };
  }

  if (!curRaw || curRaw.status === 'clean') {
    return {
      kind: 'resolved',
      details: 'Error eliminated - zero gradient achieved',
      from_line: prevRaw.line,
      from_code: prevRaw.code
    };
  }

  if (prevRaw.code === curRaw.code) {
    const moved = prevRaw.line !== curRaw.line || prevRaw.file !== curRaw.file;
    const progressNote = moved ? ` (moved from line ${prevRaw.line})` : ' (same location)';
    return {
      kind: 'same_error',
      moved,
      details: `Error persists at line ${curRaw.line}${progressNote}`,
      prev_line: prevRaw.line,
      cur_line: curRaw.line
    };
  }

  return {
    kind: 'mutated',
    from: prevRaw.code,
    to: curRaw.code,
    details: `Error changed from ${prevRaw.code} to ${curRaw.code}`,
    prev_line: prevRaw.line,
    cur_line: curRaw.line
  };
}

export interface HealerPolicy {
  syntax_conf_floor: number;
  logic_conf_floor: number;
  max_syntax_attempts: number;
  max_logic_attempts: number;
  syntax_error_budget: number; // 0.03
  logic_error_budget: number;  // 0.10
  rate_limit_per_min: number;
  sandbox_isolation: "full" | "partial" | "none";
  require_human_on_risky: boolean;
  risky_keywords: string[];
  /**
   * Engage: true → run Zod validation on success envelopes before sending to LLM
   * Disengage: false/undefined → skip validation (default, lightweight)
   */
  enable_zod_validation?: boolean;
  /**
   * Engage: true → use enhanced ESLint runner (import + security plugins) during final polish
   * Disengage: false/undefined → use lightweight built-in formatter only
   */
  enable_enhanced_eslint?: boolean;
  /**
   * Engage: true → collect Stylelint findings and attach compact report to envelope.metadata.stylelint
   * Disengage: false/undefined → do not run Stylelint (default)
   */
  enable_stylelint?: boolean;
}
export const defaultPolicy: HealerPolicy = {
  // Mid-tier model settings (realistic for Llama 3, Mistral, older GPT-3.5)
  syntax_conf_floor: 0.30, logic_conf_floor: 0.25, // Lower confidence thresholds 
  max_syntax_attempts: 5, max_logic_attempts: 7,     // More attempts before circuit breaker
  syntax_error_budget: 0.10, logic_error_budget: 0.20, // 10% and 20% error budgets
  rate_limit_per_min: 15, sandbox_isolation: "full",
  require_human_on_risky: true,
  risky_keywords: ["database_schema_change", "authentication_bypass", "production_data_modification"],
  enable_zod_validation: false, // Disabled by default for backward compatibility
  enable_enhanced_eslint: false,
  enable_stylelint: false
};

// Predefined policies for different model capability classes
export const policyPresets = {
  sota: { // GPT-4/5, Claude 3, Gemini 1.5 - high capability
    syntax_conf_floor: 0.60, logic_conf_floor: 0.50,
    max_syntax_attempts: 3, max_logic_attempts: 5,
    syntax_error_budget: 0.05, logic_error_budget: 0.10,
    rate_limit_per_min: 10
  },
  midTier: { // Llama 3, Mistral, older GPT-3.5 - moderate capability  
    syntax_conf_floor: 0.30, logic_conf_floor: 0.25,
    max_syntax_attempts: 5, max_logic_attempts: 7,
    syntax_error_budget: 0.10, logic_error_budget: 0.20,
    rate_limit_per_min: 15
  },
  localSmall: { // 7B/13B models - need breathing room
    syntax_conf_floor: 0.20, logic_conf_floor: 0.15,
    max_syntax_attempts: 7, max_logic_attempts: 10,
    syntax_error_budget: 0.20, logic_error_budget: 0.30,
    rate_limit_per_min: 20
  }
};

export class AIDebugger {
  private policy: HealerPolicy;
  private scorer = new UnifiedConfidenceScorer(1.0, 1000);
  private breaker: DualCircuitBreaker;
  private cascade = new CascadingErrorHandler();
  private sandbox: SandboxExecution;
  private enveloper = new AIPatchEnvelope();
  private memory: MemoryBuffer | ResilientMemoryBuffer = new ResilientMemoryBuffer(500, (err) => {
    try { console.debug('[memory] error', (err as any)?.message ?? String(err)); } catch { }
  }, 7 * 24 * 60 * 60 * 1000); // 7-day TTL
  private human = new SeniorDeveloperSimulator();
  private debugger = new Debugger(new LogAndFixStrategy());
  private tokens: number[] = [];
  // Optional, pluggable hooks
  private sanitizer: PatchSanitizer = new PassThroughSanitizer();
  private telemetry: TelemetrySink = new ConsoleTelemetrySink();
  private backoffPolicy: BackoffPolicy = new DefaultBackoffPolicy();
  private watchdog: HangWatchdog = new HangWatchdog(5000, 90);
  private riskObserver: RiskyEditObserver;
  private pathObserver: PathResolutionObserver;
  private finalPolishObserver: FinalPolishObserver;

  constructor(policy: Partial<HealerPolicy> = {}) {
    // Clamp confidence floors to schema minimums (0.1)
    const minFloor = 0.1;
    const merged = { ...defaultPolicy, ...policy };
    this.policy = {
      ...merged,
      syntax_conf_floor: Math.max(minFloor, merged.syntax_conf_floor),
      logic_conf_floor: Math.max(minFloor, merged.logic_conf_floor)
    };
    this.breaker = new DualCircuitBreaker(
      this.policy.max_syntax_attempts,
      this.policy.max_logic_attempts,
      this.policy.syntax_error_budget,
      this.policy.logic_error_budget
    );
    this.sandbox = new SandboxExecution(
      Environment.SANDBOX,
      this.policy.sandbox_isolation as any // Cast to match IsolationLevel type if needed
    );
    this.riskObserver = new RiskyEditObserver(this.policy.risky_keywords, 50);
    // Optionally swap in enhanced ESLint runner while keeping fail-open behavior
    const eslintRunner = this.policy.enable_enhanced_eslint
      ? createEnhancedESLintRunner({ alias: { '@': './src' } })
      : undefined;

    this.finalPolishObserver = createFinalPolishObserver(
      true, // Base ESLint formatting in FinalPolishObserver
      this.policy.enable_zod_validation ? validateSuccessEnvelope : undefined,
      eslintRunner
    );
    this.pathObserver = new PathResolutionObserver(process.cwd());
  }

  async process_error(
    error_type: ErrorType,
    message: string,
    patch_code: string,
    original_code: string,
    logits: number[],
    historical: Record<string, any> = {},
    metadata: Record<string, any> = {}
  ) {
    this.enforce_rate_limit();

    const patch = { message, patched_code: patch_code, original_code, language: "typescript" };
    const envelope = this.enveloper.wrapPatch(patch);
    envelope.metadata = { ...envelope.metadata, ...metadata };

    // Freeze current policy thresholds into policySnapshot (auditable, optional fields safeguarded)
    try {
      (envelope as unknown as MutableEnvelope).policySnapshot = {
        modelClass: 'mid-tier', // could derive from preset selection
        syntax_error_budget: this.policy.syntax_error_budget,
        logic_error_budget: this.policy.logic_error_budget,
        max_syntax_attempts: this.policy.max_syntax_attempts,
        max_logic_attempts: this.policy.max_logic_attempts,
        confidence_floor_syntax: this.policy.syntax_conf_floor,
        confidence_floor_logic: this.policy.logic_conf_floor
      };
    } catch { /* non-fatal */ }

    // Evaluate risky edit flags early and attach to metadata
    try {
      const riskFlags = this.riskObserver.evaluate(patch_code, original_code);
      if (riskFlags.length > 0) {
        (envelope.metadata as any).risk_flags = riskFlags;
      }
    } catch { /* ignore risk flag errors */ }

    // Evaluate import/asset path resolution (best-effort)
    try {
      const missing = this.pathObserver.evaluate(patch_code, /* sourceFilePath */ undefined);
      if (missing && missing.length > 0) {
        (envelope.metadata as any).missing_paths = missing;
      }
    } catch { /* non-fatal: best-effort */ }

    // Populate schema-required fields
    // Extract taxonomy difficulty if available from rebanker enrichment
    let taxonomyDifficulty: number | null = null;
    if (metadata && metadata.rebanker_result) {
      const rebankerResult = metadata.rebanker_result;
      if (typeof rebankerResult === 'object' && rebankerResult !== null && 'difficulty' in rebankerResult) {
        taxonomyDifficulty = rebankerResult.difficulty;
      }
    }

    const conf: ConfidenceScore = this.scorer.calculate_confidence(
      logits, error_type, historical, taxonomyDifficulty
    );
    mergeConfidence(envelope as unknown as MutableEnvelope, {
      syntax: conf.syntax_confidence,
      logic: conf.logic_confidence,
      risk: this.is_risky(patch) ? 1 : 0
    });
    // Normalize breaker state for schema: OPEN|CLOSED|HALF_OPEN
    const breakerSummaryForHeader = this.breaker.get_state_summary();
    setBreakerState(envelope as unknown as MutableEnvelope, breakerSummaryForHeader.state as any);
    // Provide stubs for missing methods if not present
    const cascadeDepthVal = typeof (this.cascade as any).getDepth === "function"
      ? (this.cascade as any).getDepth()
      : (this.cascade as any).cascadeDepth || 0;
    setCascadeDepth(envelope as unknown as MutableEnvelope, cascadeDepthVal);
    const ru = typeof (this.sandbox as any).getResourceUsage === "function"
      ? (this.sandbox as any).getResourceUsage()
      : {};
    mergeResourceUsage(envelope as unknown as MutableEnvelope, ru);

    const plan = this.human.debugLikeHuman(message, { error: message, code_snippet: patch_code });
    this.debugger.setStrategy(this.map_strategy(plan?.recommended_strategy ?? "LogAndFixStrategy"));

    const floor = (error_type === ErrorType.SYNTAX) ? this.policy.syntax_conf_floor : this.policy.logic_conf_floor;
    const [canAttempt, cbReason] = this.breaker.can_attempt(error_type);
    const [stop, cascadeReason] = this.cascade.should_stop_attempting();

    // --- SCHEMA VALIDATION ---
    const ajv = new Ajv({ addUsedSchema: false, strict: false });
    ajv.addFormat('date-time', true); // Add support for date-time format
    // Use file-relative path for robustness
    const schemaPath = path.resolve(__dirname, 'schemas', 'selfhealing.schema.json');
    let schema;
    try {
      schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    } catch (e: any) {
      throw new Error("Could not load PatchEnvelope schema: " + (e && e.message ? e.message : String(e)));
    }
    const validate = ajv.compile(schema);
    const envelopeJson = JSON.parse(envelope.toJson());
    if (!validate(envelopeJson)) {
      throw new Error("PatchEnvelope validation failed: " + ajv.errorsText());
    }

    if (this.is_risky(patch) && this.policy.require_human_on_risky) {
      this.record_attempt(envelope, false, "Risk gate → human review");
      applyDeveloperFlag(envelope as unknown as MutableEnvelope, { flagged: true, message: "Risky patch (policy). Human approval required." });
      return this.finalize(envelope, "HUMAN_REVIEW", { cbReason, cascadeReason, floor });
    }

    const typeConf = (error_type === ErrorType.SYNTAX) ? conf.syntax_confidence : conf.logic_confidence;
    // Gate handling: distinguish circuit-breaker rollback vs hard STOP gates
    if (!canAttempt) {
      this.record_attempt(envelope, false, "Circuit breaker blocked");
      return this.finalize(envelope, "ROLLBACK", { cbReason, cascadeReason, floor });
    }
    if (stop || typeConf < floor) {
      this.record_attempt(envelope, false, "Gate blocked");
      return this.finalize(envelope, "STOP", { cbReason, cascadeReason, floor });
    }

    // Start hang watchdog
    const attemptKey = `${envelope.patchId}`;
    try { this.watchdog.beginAttempt(attemptKey); } catch { /* ignore */ }

    const sbox = this.sandbox.execute_patch({
      patchId: envelope.patchId, language: "typescript", patched_code: patch_code, original_code
    });
    const success = Boolean(sbox.success);

    // Re-banker integration: Extract structured error data (5-field JSON)
    // Priority 1: Parse runtime error if sandbox failed
    // Priority 2: Run static syntax check if no runtime error
    try {
      const tmpPath = path.join('.', `.tmp_rebank_${Date.now()}.ts`);
      fs.writeFileSync(tmpPath, patch_code, 'utf-8');

      try {
        const runtimeError = sbox.error_message;

        if (runtimeError && runtimeError.trim()) {
          // Priority 1: Parse runtime error through re-banker stdin mode
          const rebankScript = path.join('.', 'ops', 'rebank', 'rebank_js_ts.mjs');

          const proc = spawn('node', [rebankScript, '--stdin', '--typescript'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 5000
          });

          let stdout = '';
          let stderr = '';
          proc.stdout?.on('data', (chunk: any) => { stdout += chunk.toString(); });
          proc.stderr?.on('data', (chunk: any) => { stderr += chunk.toString(); });

          // Send runtime error to stdin
          proc.stdin?.write(runtimeError);
          proc.stdin?.end();

          await new Promise<void>((resolve) => {
            proc.on('close', (code: number | null) => {
              try {
                if (code === 1 && stdout.trim()) {
                  // Re-banker successfully parsed error
                  const parsed = JSON.parse(stdout);
                  parsed.code = 'TS_RUNTIME';  // Override to distinguish from syntax
                  parsed.severity = 'FATAL_RUNTIME';
                  (envelope.metadata as any).rebanker_result = parsed;
                } else {
                  // Couldn't parse - use raw
                  (envelope.metadata as any).rebanker_result = {
                    file: 'unknown',
                    line: null,
                    column: null,
                    message: runtimeError,
                    code: 'TS_RUNTIME_UNPARSED',
                    severity: 'FATAL_RUNTIME'
                  };
                }
              } catch (e) {
                // JSON parse error - use raw
                (envelope.metadata as any).rebanker_result = {
                  file: 'unknown',
                  line: null,
                  column: null,
                  message: `Parse error: ${e}\n${runtimeError}`,
                  code: 'TS_RUNTIME_UNPARSED',
                  severity: 'FATAL_RUNTIME'
                };
              }
              resolve();
            });
          });
        } else {
          // Priority 2: Static syntax check via re-banker
          const rebankScript = path.join('.', 'ops', 'rebank', 'rebank_js_ts.mjs');

          const proc = spawn('node', [rebankScript, tmpPath, '--quiet'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 5000
          });

          let stdout = '';
          proc.stdout?.on('data', (chunk: any) => { stdout += chunk.toString(); });

          await new Promise<void>((resolve) => {
            proc.on('close', (code: number | null) => {
              try {
                if (stdout.trim()) {
                  const result = JSON.parse(stdout);
                  (envelope.metadata as any).rebanker_result = result;
                } else {
                  (envelope.metadata as any).rebanker_result = { status: 'clean' };
                }
              } catch (e) {
                (envelope.metadata as any).rebanker_result = {
                  status: 'error',
                  message: `Re-banker parse error: ${e}`
                };
              }
              resolve();
            });
          });
        }
      } finally {
        // Clean up temp file
        try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
      }
    } catch (e) {
      // Re-banker integration failed - non-fatal, continue without it
      console.warn(`[Re-banker] Integration error: ${e}`);
    }

    // 🔒 TRUTH-FLOW: Convert to immutable packet with hash
    try {
      const rebankerResult = (envelope.metadata as any)?.rebanker_result;
      if (rebankerResult) {
        // Rename to rebanker_raw (immutable ground truth)
        (envelope.metadata as any).rebanker_raw = rebankerResult;
        (envelope.metadata as any).rebanker_hash = sha256Json(rebankerResult);
        (envelope.metadata as any).rebanker_interpreted = null;  // LLM can write here

        // Remove old field name for clarity
        delete (envelope.metadata as any).rebanker_result;
      }
    } catch (e) {
      console.warn(`[Truth-Flow] Failed to convert rebanker packet: ${e}`);
    }

    // Update resource usage in envelope from sandbox after execution
    try {
      envelope.resourceUsage = (this.sandbox as any).getResourceUsage?.() || envelope.resourceUsage;
    } catch { /* ignore */ }

    // Evaluate watchdog outcome
    try {
      const event = this.watchdog.endAttempt(attemptKey, { sandbox: sbox, resourceUsage: envelope.resourceUsage });
      if (event?.triggered) {
        // Apply first-level suspicion; deeper escalation occurs in attemptWithBackoff
        (envelope.metadata as any).watchdog = event;
      }
    } catch { /* ignore */ }

    const strat = this.debugger.debug({ error: message, vulnerability: message });

    // Extract re-banker results for error delta calculation (fast, already computed)
    const rebankerRaw = (envelope.metadata as any)?.rebanker_raw || {};

    // Determine current error count from re-banker (structured 5-field JSON)
    // Note: Re-banker returns FIRST error only; if line exists → at least 1 error
    let currentErrors = 0;
    if (rebankerRaw.line !== null && rebankerRaw.line !== undefined) {
      currentErrors = 1; // At least one error (structured info on first)
    } else if (rebankerRaw.status === 'clean') {
      currentErrors = 0;
    }

    // Get previous error count from last attempt (if exists)
    const previousErrors = (envelope.trendMetadata as any)?.errorsDetected || 0;

    // Calculate error delta (positive = improvement)
    const errorsResolved = Math.max(0, previousErrors - currentErrors);

    // Calculate lines of code for error density
    const linesOfCode = patch_code.split('\n').length;

    // Record attempt with error delta from re-banker, confidence, and code metrics
    this.breaker.record_attempt(
      error_type,
      success,
      currentErrors,        // errors detected by re-banker (blazingly fast ~100ms)
      errorsResolved,       // errors resolved from previous version
      conf.overall_confidence,     // confidence score for this attempt
      linesOfCode                  // lines of code for density calculation
    );

    // Create a PatchResult and persist to memory for traceability
    try {
      const pr = new PatchResult(success, errorsResolved, Math.max(0, errorsResolved), strat.details ?? '');
      (this.memory as any).safeAddOutcome?.(JSON.stringify({ kind: 'patch_result', attempt: (metadata as any)?.attempt ?? null, patchId: envelope.patchId, result: pr }))
        ?? this.memory.addOutcome(JSON.stringify({ kind: 'patch_result', attempt: (metadata as any)?.attempt ?? null, patchId: envelope.patchId, result: pr }));
    } catch { /* best-effort */ }

    // Get the breaker's recommendation for next action
    const breakerSummary = this.breaker.get_state_summary();
    let recommendedAction = breakerSummary.recommended_action as string;

    // Update envelope with rich trend metadata (using re-banker error counts)
    const localImproving = errorsResolved > 0;
    updateTrend(envelope as unknown as MutableEnvelope, {
      errorsDetected: currentErrors,
      errorsResolved: errorsResolved,
      qualityScore: success ? 1.0 : 0.0, // Binary quality from re-banker (clean vs error)
      improvementVelocity: breakerSummary.improvement_velocity,
      stagnationRisk: breakerSummary.should_continue_attempts ? 0.2 : 0.8
    });
    this.scorer.record_outcome(conf.overall_confidence, success);
    if (!success) this.cascade.add_error_to_chain(error_type, message, conf.overall_confidence, 1);
    this.record_attempt(envelope, success, strat.details ?? "");
    (this.memory as any).safeAddOutcome?.(envelope.toJson()) ?? this.memory.addOutcome(envelope.toJson());

    // Optional: if oscillation detected, suggest short pause/backoff (caller may choose to call pause())
    const shouldPause = (breakerSummary as any).paused === false &&
      (breakerSummary as any).confidence_improving && !breakerSummary.is_improving;
    const attemptNo: number = (metadata as any)?.attempt ?? 1;
    const watchdogHigh = Boolean((envelope.metadata as any)?.watchdog?.triggered && (envelope.metadata as any)?.watchdog?.severity === 'high');
    if (shouldPause && !(watchdogHigh && attemptNo >= 2)) {
      recommendedAction = 'pause_and_backoff';
      // Do not mutate breaker state automatically; leave pause() to caller if desired
    }

    // Use envelope-guided action instead of simple binary logic
    let action: string;
    // First-attempt grace: only force rollback on high-severity watchdog from the second attempt onward
    const wdMeta: any = (envelope.metadata as any)?.watchdog;
    if (watchdogHigh && attemptNo >= 2) {
      action = "ROLLBACK";
    } else if (wdMeta?.triggered) {
      // If watchdog triggered at all, avoid promotion on first attempt; suggest pause/backoff
      action = 'PAUSE_AND_BACKOFF';
    } else if (success && (recommendedAction === "promote" || recommendedAction === "continue")) {
      // On success, allow promotion when breaker is not explicitly rolling back
      action = "PROMOTE";
    } else if (recommendedAction === "rollback") {
      action = "ROLLBACK";
    } else if (recommendedAction === 'pause_and_backoff') {
      action = 'PAUSE_AND_BACKOFF';
    } else if (recommendedAction === "continue" && this.breaker.can_attempt(error_type)[0]) {
      action = "RETRY";
    } else if (recommendedAction === "try_different_strategy") {
      action = "STRATEGY_CHANGE";
    } else {
      // Fallback to original logic
      action = success ? "PROMOTE" : (this.breaker.can_attempt(error_type)[0] ? "RETRY" : "ROLLBACK");
    }

    return this.finalize(envelope, action, {
      sandbox: sbox,
      strategy: strat,
      floor,
      breaker_recommendation: recommendedAction,
      trend_analysis: breakerSummary,
      pause_hint: shouldPause ? { suggested: true, reason: 'oscillation_or_noisy_confidence' } : { suggested: false },
      observers: {
        watchdog: (envelope.metadata as any)?.watchdog ?? null,
        risk_flags: (envelope.metadata as any)?.risk_flags ?? []
      }
    });
  }

  private map_strategy(name: string) {
    switch (name) {
      case "RollbackStrategy": return new RollbackStrategy();
      case "SecurityAuditStrategy": return new SecurityAuditStrategy();
      default: return new LogAndFixStrategy();
    }
  }
  private record_attempt(env: PatchEnvelope, ok: boolean, note = "") {
    const b = this.breaker.get_state_summary();
    appendAttempt(env as unknown as MutableEnvelope, {
      success: ok,
      note,
      breakerState: b.state as any,
      failureCount: b.failure_count
    });
    markSuccess(env as unknown as MutableEnvelope, ok);
    // Update counters (determine kind based on last error type heuristic in note)
    try {
      const lastAttemptIndex = (env.attempts?.length || 1);
      const errorsResolved = (env.trendMetadata as any)?.errorsResolved ?? 0;
      const kind: 'syntax' | 'logic' | 'other' = /syntax/i.test(note) ? 'syntax' : (/logic/i.test(note) ? 'logic' : 'other');
      updateCounters(env as unknown as MutableEnvelope, kind, errorsResolved);
      const overallConfidence = (() => {
        const cc: any = (env as any).confidenceComponents || {};
        const vals = ['syntax', 'logic', 'risk'].map(k => typeof cc[k] === 'number' ? cc[k] : undefined).filter(v => typeof v === 'number') as number[];
        if (!vals.length) return undefined; return Math.max(0, Math.min(1, vals.reduce((a, b) => a + b, 0) / vals.length));
      })();
      addTimelineEntry(env as unknown as MutableEnvelope, {
        attempt: lastAttemptIndex,
        errorsDetected: (env.trendMetadata as any)?.errorsDetected,
        errorsResolved: (env.trendMetadata as any)?.errorsResolved,
        overallConfidence,
        breakerState: b.state,
        action: note ? note.slice(0, 40) : undefined
      });
    } catch { /* non-fatal */ }
  }
  private finalize(env: PatchEnvelope, action: string, extras: Record<string, any>) {
    // Canonical timestamp & hash just before emitting final envelope shape
    setEnvelopeTimestamp(env as unknown as MutableEnvelope);
    try {
      const sha256Hex = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
      setEnvelopeHash(env as unknown as MutableEnvelope, sha256Hex);
    } catch { /* hash best-effort */ }
    // Check for final polish opportunity (95% confidence + zero errors)
    if (action === 'PROMOTE') {
      this.checkAndApplyFinalPolish(env, extras);
    }

    return { action, envelope: JSON.parse(env.toJson()), extras };
  }

  /**
   * Check if we should apply final polish and send success message to LLM
   */
  private async checkAndApplyFinalPolish(env: PatchEnvelope, extras: Record<string, any>): Promise<void> {
    try {
      // Extract confidence and error information from various sources
      const confidence = extras.confidence || env.confidenceComponents?.overall || 0;
      const errorCount = env.trendMetadata?.errorsDetected || 0;
      const patchCode = typeof env.patchData === 'string' ? env.patchData :
        (env.patchData?.code || JSON.stringify(env.patchData) || '');

      // Check if we meet the 95% threshold
      if (this.finalPolishObserver.shouldApplyFinalPolish(confidence, errorCount)) {
        // Add to telemetry instead of console logging
        this.telemetry.onAttempt?.({
          envelope: { type: 'final_polish_triggered', confidence, errorCount },
          breakerSummary: { final_polish: 'conditions_met' },
          llmReply: null,
          waitMs: 0,
          rationale: `95_percent_threshold_met_confidence_${(confidence * 100).toFixed(1)}_errors_${errorCount}`
        });

        // Apply final polish (linting)
        const polishResult = await this.finalPolishObserver.applyFinalPolish(
          patchCode,
          confidence,
          errorCount,
          env.patchId
        );

        if (polishResult.shouldLint && polishResult.finalCode) {
          // Update the envelope with polished code
          if (typeof env.patchData === 'string') {
            env.patchData = { code: polishResult.finalCode, polished: true };
          } else {
            env.patchData.code = polishResult.finalCode;
            env.patchData.polished = true;
          }
          env.success = true;

          // Mark that final polish was applied
          if (!env.metadata) env.metadata = {};
          (env.metadata as any).finalPolishApplied = true;
          (env.metadata as any).finalPolishTimestamp = new Date().toISOString();
          (env.metadata as any).achievedConfidence = confidence;

          // Optionally run Stylelint reporter and attach results (engage/disengage via policy)
          if (this.policy.enable_stylelint && this.isCssLike(polishResult.finalCode)) {
            try {
              const reporter = createStylelintReporter();
              const stylelintReport = await reporter(polishResult.finalCode, { filename: env?.patchId ? `${env.patchId}.scss` : undefined });
              (env.metadata as any).stylelint = stylelintReport;
            } catch (e) {
              (env.metadata as any).stylelint = { errored: false, warnings: [], note: `[stylelint] integration failed: ${(e as any)?.message || String(e)}` };
            }
          }
        }

        // Create success envelope for LLM communication
        const successEnvelope = this.finalPolishObserver.createSuccessEnvelope(
          env.patchId || 'unknown',
          confidence,
          polishResult.finalCode || patchCode,
          (env.metadata as any)?.attempt || 1,
          env.metadata
        );

        // Store the success envelope for potential LLM communication
        // (The actual sending will happen in attemptWithBackoff where chat is available)
        extras.successCelebration = successEnvelope;
        extras.finalPolishApplied = true;

        // Send completion telemetry instead of console logging
        this.telemetry.onAttempt?.({
          envelope: { type: 'final_polish_completed', patchId: env.patchId },
          breakerSummary: { final_polish: 'completed', linting_applied: polishResult.shouldLint },
          llmReply: 'FINAL_POLISH_READY_FOR_LLM',
          waitMs: 0,
          rationale: 'final_polish_completed_success_message_prepared'
        });
      }
    } catch (error) {
      // Send error to telemetry instead of console logging
      this.telemetry.onAttempt?.({
        envelope: { type: 'final_polish_error', error: error instanceof Error ? error.message : String(error) },
        breakerSummary: { final_polish: 'failed' },
        llmReply: null,
        waitMs: 0,
        rationale: 'final_polish_check_failed'
      });
      // Don't let polish failures break the main flow
    }
  }
  private is_risky(patch: Record<string, any>) {
    const blob = JSON.stringify(patch).toLowerCase();
    return this.policy.risky_keywords.some(k => blob.includes(k));
  }
  private enforce_rate_limit() {
    const now = Date.now() / 1000;
    this.tokens = this.tokens.filter(t => now - t < 60);
    if (this.tokens.length >= this.policy.rate_limit_per_min) throw new Error("Rate limit exceeded");
    this.tokens.push(now);
  }

  // Persistence methods - extend the existing AIDebugger
  async saveMemory(filePath: string = './ai-debugger-memory.json'): Promise<void> {
    await this.memory.save(filePath);
  }

  async loadMemory(filePath: string = './ai-debugger-memory.json'): Promise<void> {
    await this.memory.load(filePath);
  }

  getMemoryStats(): { bufferSize: number; maxSize: number } {
    return {
      bufferSize: (this.memory as any).buffer.length,
      maxSize: (this.memory as any).maxSize
    };
  }

  // Orchestrated retry with backoff and minimal patch tweak between attempts
  async attemptWithBackoff(
    error_type: ErrorType,
    message: string,
    patch_code: string,
    original_code: string,
    logits: number[],
    opts: { maxAttempts?: number; minMs?: number; maxMs?: number; llmAdapter?: LLMAdapter; sessionId?: string; chatAdapter?: ChatMessageHistoryAdapter } = {}
  ): Promise<{ action: string; envelope: any; extras: any }> {
    const maxAttempts = Math.max(1, opts.maxAttempts ?? 3);
    const minMs = Math.max(0, opts.minMs ?? 500);
    const maxMs = Math.max(minMs, opts.maxMs ?? 1500);

    let currentPatch = patch_code;
    let result: any = null;
    let consecutiveWatchdogFlags = 0;
    let watchdogAggregate = { watchdog_flag_count: 0 } as { watchdog_flag_count: number; last_event?: any };

    // Optional: set up a chat history adapter for this run
    const chat = opts.chatAdapter ?? new ChatMessageHistoryAdapter(this.memory as any, opts.sessionId);
    // Log initial system prompt for traceability
    try { chat.addMessage('system', defaultSystemPrompt, { phase: 'init' }); } catch { }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Record the start of an attempt as a user message for conversation continuity
      // Include re-banker structured error info from previous attempt if available
      try {
        const userMessage: any = {
          type: 'attempt.start',
          attempt,
          error_type,
          message,
          last_patch: currentPatch,
          language: 'typescript'
        };

        // On retry attempts, include structured re-banker error from previous envelope
        if (attempt > 1 && result?.envelope?.metadata) {
          const prevRebanker = (result.envelope.metadata as any)?.rebanker_result;
          if (prevRebanker && prevRebanker.line !== null) {
            userMessage.rebanker_previous = {
              file: prevRebanker.file,
              line: prevRebanker.line,
              column: prevRebanker.column,
              error_code: prevRebanker.code,
              error_message: prevRebanker.message,
              severity: prevRebanker.severity,
              hint: `Previous patch failed at line ${prevRebanker.line}${prevRebanker.column ? `, column ${prevRebanker.column}` : ''}: ${prevRebanker.message}`
            };
          }
        }

        chat.addMessage('user', userMessage, { phase: 'attempt' });
      } catch { /* ignore chat errors */ }

      result = this.process_error(
        error_type,
        message,
        currentPatch,
        original_code,
        logits,
        { attempt },
        { attempt }
      );

      const summary = result.extras?.trend_analysis || this.breaker.get_state_summary();

      // Stream envelope JSON and trend snapshot to chat for full LC-style comms
      try {
        chat.addMessage('tool', {
          type: 'patch_envelope',
          action: result.action,
          envelope: result.envelope,
          attempt
        }, { phase: 'result' });
        chat.addMessage('tool', {
          type: 'trend_snapshot',
          summary,
          breaker_recommendation: summary?.recommended_action,
          improving: !!summary?.is_improving
        }, { phase: 'result' });
      } catch { /* ignore chat errors */ }

      const wd = result?.extras?.observers?.watchdog;
      if (wd?.triggered) {
        consecutiveWatchdogFlags += 1;
        watchdogAggregate.watchdog_flag_count += 1;
        watchdogAggregate.last_event = wd;
        // escalate suspicion on the 3rd and 4th attempt if flags persist
        const currentSusp = (wd?.suspicion ?? 'suspicious') as 'none' | 'suspicious' | 'danger' | 'extreme';
        const escalated = escalateSuspicion(currentSusp, attempt, consecutiveWatchdogFlags);
        // Mutate in-place for telemetry/jitter consumers
        if (wd && wd.suspicion !== escalated) {
          wd.suspicion = escalated;
        }
      } else {
        consecutiveWatchdogFlags = 0;
      }

      if (result.action === 'PROMOTE' || result.action === 'ROLLBACK' || result.action === 'HUMAN_REVIEW') {
        // Final decision message + memory metrics snapshot
        try {
          const metrics = (this.memory as any).getMetrics?.();
          chat.addMessage('tool', {
            type: 'final_decision',
            decision: result.action,
            attempt,
            observers: { watchdog_flag_count: watchdogAggregate.watchdog_flag_count },
            memory_metrics: metrics ?? null
          }, { phase: 'final' });
        } catch { /* ignore chat errors */ }

        // 🎉 SEND SUCCESS CELEBRATION TO LLM IF FINAL POLISH WAS APPLIED
        if (result.action === 'PROMOTE' && result.extras?.finalPolishApplied && result.extras?.successCelebration) {
          try {
            await this.finalPolishObserver.sendSuccessToLLM(
              chat,
              result.extras.successCelebration
            );

            // Send success telemetry to LLM via chat instead of console logging
            chat.addMessage('tool', {
              type: 'success_celebration_complete',
              confidence_achieved: result.extras.successCelebration.success_metrics.final_confidence,
              polish_applied: true,
              achievement: 'high_confidence_healing_with_polish',
              message: result.extras.successCelebration.message,
              timestamp: new Date().toISOString()
            }, { phase: 'celebration' });

            // Also add to telemetry sink for structured logging
            this.telemetry.onAttempt?.({
              envelope: result.extras.successCelebration,
              breakerSummary: { celebration: 'success', confidence_threshold_met: true },
              llmReply: 'SUCCESS_CELEBRATION_SENT',
              waitMs: result.extras.successCelebration.celebration?.jitter_delay_ms || 300,
              rationale: 'final_polish_applied_95_percent_confidence'
            });

          } catch (error) {
            // Log error to telemetry instead of console
            chat.addMessage('tool', {
              type: 'success_celebration_error',
              error: error instanceof Error ? error.message : String(error),
              timestamp: new Date().toISOString()
            }, { phase: 'error' });
          }
        }

        // Surface observer aggregates in extras for telemetry
        return { ...result, extras: { ...result.extras, observers: { ...(result.extras?.observers || {}), watchdog_flag_count: watchdogAggregate.watchdog_flag_count } } };
      }

      // Decide backoff
      if (result.action === 'PAUSE_AND_BACKOFF' || result.action === 'RETRY') {
        // Trend-aware tripping: if watchdog flagged twice in a row and no improvement, convert to rollback
        if (consecutiveWatchdogFlags >= 2) {
          // check trend
          const trend = result?.extras?.trend_analysis;
          const improving = Boolean(trend?.is_improving || result?.envelope?.trendMetadata?.errorTrend === 'improving');
          if (!improving) {
            return { ...result, action: 'ROLLBACK', extras: { ...result.extras, stop_reason: 'watchdog_trend', observers: { ...(result.extras?.observers || {}), watchdog_flag_count: watchdogAggregate.watchdog_flag_count } } };
          }
        }
        const sb = result.extras?.sandbox;
        const failMsg = (sb?.error_message) || (Array.isArray(sb?.test_results) ? (sb.test_results.find((t: any) => !t.passed)?.error_message || null) : null);

        // Centralized pause+jitter+LLM consult; returns jitter envelope and optional LLM patch
        // Retrieve similar outcomes from long-chain memory (best-effort)
        let similarOutcomes: any[] | undefined;
        try {
          similarOutcomes = this.memory.getSimilarOutcomes({ message: failMsg || message, code: original_code });
        } catch { /* ignore */ }

        const consult = await pauseAndJitterConsult({
          summary,
          minMs,
          maxMs,
          errorMessage: failMsg || message,
          originalCode: original_code,
          lastPatch: currentPatch,
          language: 'typescript',
          lastEnvelopeJson: result.envelope,
          sessionId: opts.sessionId,
          llmAdapter: opts.llmAdapter,
          extraMetadata: {
            ...(similarOutcomes ? { similar_outcomes_sample: similarOutcomes.slice(-3) } : {}),
            loop_attempt: attempt,
            request_id: result?.envelope?.patch_id ?? null
          },
          backoffPolicy: this.backoffPolicy
        });

        // Persist jitter envelope and reply to long-chain memory for future context
        try {
          (this.memory as any).safeAddOutcome?.(JSON.stringify({ kind: 'jitter_envelope', envelope: consult.envelope })) ?? this.memory.addOutcome(JSON.stringify({ kind: 'jitter_envelope', envelope: consult.envelope }));
          if (consult.llmReplyText) {
            const llm = LLMResponse.fromLLMReply(consult.llmReplyText);
            (this.memory as any).safeAddOutcome?.(JSON.stringify({ kind: 'llm_reply', response: { intent: llm.intent, proposedPatch: llm.proposedPatch, rawText: llm.rawText } })) ?? this.memory.addOutcome(JSON.stringify({ kind: 'llm_reply', response: { intent: llm.intent, proposedPatch: llm.proposedPatch, rawText: llm.rawText } }));
          }
        } catch { /* best-effort */ }

        // Also log to chat history: user sends the jitter envelope, AI responds
        try { chat.addMessage('user', consult.envelope, { phase: 'backoff_consult' }); } catch { }
        try { if (consult.llmReplyText) chat.addMessage('ai', consult.llmReplyText, { phase: 'backoff_consult' }); } catch { }

        // Telemetry event for the attempt
        try {
          this.telemetry.onAttempt?.({
            envelope: consult.envelope,
            breakerSummary: summary,
            llmReply: consult.llmReplyText ?? null,
            waitMs: consult.waitMs,
            rationale: (consult as any).rationale ?? null
          });
        } catch { /* ignore telemetry errors */ }

        if (consult.proposedPatch) {
          // Sanitize proposed patch before applying
          const check = this.sanitizer.sanitize(consult.proposedPatch, {
            max_lines_changed: 50,
            disallow_keywords: this.policy.risky_keywords
          });
          if (check.ok) {
            currentPatch = check.code ?? consult.proposedPatch;
          } else {
            // Record sanitizer rejection and fall back to minimal tweak
            try {
              (this.memory as any).safeAddOutcome?.(JSON.stringify({ kind: 'sanitizer_reject', reason: check.reason, ts: Date.now() })) ?? this.memory.addOutcome(JSON.stringify({ kind: 'sanitizer_reject', reason: check.reason, ts: Date.now() }));
            } catch { /* ignore */ }
            currentPatch = this.minimalTweak(currentPatch, failMsg || message);
          }
        } else {
          currentPatch = this.minimalTweak(currentPatch, failMsg || message);
        }

        // Record decision as a tool message in chat history
        try { chat.addMessage('tool', JSON.stringify({ action: 'apply_patch', attempt, reason: consult.rationale || 'backoff_policy' }), { phase: 'decision' }); } catch { }
        continue;
      }

      // Try different strategy next
      if (result.action === 'STRATEGY_CHANGE') {
        currentPatch = this.minimalTweak(currentPatch, message);
        continue;
      }

      // Fallback: return whatever we got
      return result;
    }

    return result as any;
  }

  // Very conservative tweak: fix common syntax issues without altering logic
  private minimalTweak(code: string, errorMessage?: string): string {
    let out = code;
    const msg = (errorMessage || '').toLowerCase();

    // Missing comma in object literals
    out = out.replace(/(\w+\s*:\s*[^,\n]+)\n(\s*\w+\s*:)/g, '$1,\n$2');
    // Unmatched parentheses: try closing a missing ) at end of console.log lines
    out = out.replace(/console\.log\(([^)]*)$/gm, 'console.log($1)');
    // Add missing semicolons for simple let/const/return lines
    out = out.replace(/^(\s*(?:let|const|return)\b[^;\n]*)$/gm, '$1;');
    // Basic quote balance: replace stray single-quote logs with double quotes
    out = out.replace(/console\.log\('\s*([^']*)\s*'\)/g, 'console.log("$1")');

    // If parser hints missing ) or Unexpected end of input, attempt to balance (), {}, [] globally
    if (/missing \)|unexpected end of input|unmatched|unexpected token/.test(msg)) {
      out = this.balancePairs(out);
    }
    return out;
  }

  private balancePairs(src: string): string {
    // Balance (), {}, [] by counting and adding closing tokens at EOF as a safe no-op try
    const pairs: Array<[string, string]> = [["(", ")"], ["{", "}"], ["[", "]"]];
    let out = src;
    for (const [open, close] of pairs) {
      const openCount = (out.match(new RegExp(`\\${open}`, 'g')) || []).length;
      const closeCount = (out.match(new RegExp(`\\${close}`, 'g')) || []).length;
      const missing = Math.max(0, openCount - closeCount);
      if (missing > 0) {
        out = out + close.repeat(missing);
      }
    }
    return out;
  }

  // Heuristic: consider code CSS/SCSS-like if it contains selectors/braces without JS keywords,
  // or common SCSS at-rules. Very lightweight and conservative.
  private isCssLike(src?: string): boolean {
    if (!src) return false;
    const s = src.trim();
    if (s.length < 8) return false;
    const hasBraces = /\{[\s\S]*\}/.test(s);
    const hasSelectors = /[#\.]?[a-zA-Z][\w-]*\s*\{/.test(s) || /:\s*[a-zA-Z-]+\s*;/.test(s);
    const scssAt = /@(use|forward|import|mixin|include|function|if|else|for|each|while)\b/.test(s);
    const jsHints = /(function|const|let|var|=>|class\s+[A-Za-z]|import\s+|export\s+)/.test(s);
    return (hasBraces && hasSelectors) || scssAt ? !jsHints : false;
  }
}

// --- Extension hooks (Tier-1) ---
export interface PatchSanitizer {
  sanitize(code: string, constraints: { max_lines_changed?: number; disallow_keywords?: string[] }): { ok: boolean; reason?: string; code?: string };
}

class PassThroughSanitizer implements PatchSanitizer {
  sanitize(code: string): { ok: boolean; reason?: string; code?: string } {
    // Default: allow all; subclasses can enforce constraints
    return { ok: true, code };
  }
}

export interface TelemetrySink {
  onAttempt?(payload: { envelope: any; breakerSummary: any; llmReply: string | null; waitMs: number; rationale?: string }): void;
}

class ConsoleTelemetrySink implements TelemetrySink {
  onAttempt(payload: { envelope: any; breakerSummary: any; llmReply: string | null; waitMs: number; rationale?: string }): void {
    try {
      // Keep concise to avoid noise
      const las = payload?.envelope?.last_attempt_status || {};
      console.debug('[telemetry] attempt', {
        type: payload?.envelope?.type,
        decision: payload?.breakerSummary?.recommended_action ?? payload?.envelope?.trend?.recommended_action,
        waitMs: payload.waitMs,
        replyBytes: payload.llmReply ? payload.llmReply.length : 0,
        rationale: payload.rationale ?? null,
        request_id: payload?.envelope?.metadata?.request_id ?? null,
        loop_attempt: payload?.envelope?.metadata?.loop_attempt ?? null,
        errors_resolved: las.errors_resolved ?? null,
        error_delta: las.error_delta ?? null
      });
    } catch { /* ignore */ }
  }
}
