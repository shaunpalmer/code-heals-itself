"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIDebugger = exports.policyPresets = exports.defaultPolicy = void 0;
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
const confidence_scoring_1 = require("./utils/typescript/confidence_scoring");
const cascading_error_handler_1 = require("./utils/typescript/cascading_error_handler");
const envelope_1 = require("./utils/typescript/envelope");
// If running in Node.js, ensure @types/node is installed for type support
const crypto_1 = __importDefault(require("crypto"));
// If you are targeting the browser, consider using a polyfill like 'crypto-js' or 'webcrypto' and update usages accordingly
const strategy_1 = require("./utils/typescript/strategy");
const human_debugging_1 = require("./utils/typescript/human_debugging");
const observer_1 = require("./utils/typescript/observer");
const path_resolution_observer_1 = require("./utils/typescript/path_resolution_observer");
const ajv_1 = __importDefault(require("ajv"));
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const backoff_1 = require("./utils/typescript/backoff");
const jitter_comms_1 = require("./utils/typescript/jitter_comms");
const memory_adapter_1 = __importDefault(require("./utils/typescript/memory_adapter"));
const final_polish_observer_1 = require("./utils/typescript/final_polish_observer");
const enable_zod_success_validation_1 = require("./src/extensions/enable-zod-success-validation");
// Optional lint runners (fail-open if not installed)
const eslint_enhanced_runner_1 = __importDefault(require("./src/extensions/eslint-enhanced-runner"));
// Stylelint integration (optional; reporter used for metadata only)
const stylelint_runner_1 = require("./src/extensions/stylelint-runner");
exports.defaultPolicy = {
    // Mid-tier model settings (realistic for Llama 3, Mistral, older GPT-3.5)
    syntax_conf_floor: 0.30, logic_conf_floor: 0.25, // Lower confidence thresholds 
    max_syntax_attempts: 5, max_logic_attempts: 7, // More attempts before circuit breaker
    syntax_error_budget: 0.10, logic_error_budget: 0.20, // 10% and 20% error budgets
    rate_limit_per_min: 15, sandbox_isolation: "full",
    require_human_on_risky: true,
    risky_keywords: ["database_schema_change", "authentication_bypass", "production_data_modification"],
    enable_zod_validation: false, // Disabled by default for backward compatibility
    enable_enhanced_eslint: false,
    enable_stylelint: false
};
// Predefined policies for different model capability classes
exports.policyPresets = {
    sota: {
        syntax_conf_floor: 0.60, logic_conf_floor: 0.50,
        max_syntax_attempts: 3, max_logic_attempts: 5,
        syntax_error_budget: 0.05, logic_error_budget: 0.10,
        rate_limit_per_min: 10
    },
    midTier: {
        syntax_conf_floor: 0.30, logic_conf_floor: 0.25,
        max_syntax_attempts: 5, max_logic_attempts: 7,
        syntax_error_budget: 0.10, logic_error_budget: 0.20,
        rate_limit_per_min: 15
    },
    localSmall: {
        syntax_conf_floor: 0.20, logic_conf_floor: 0.15,
        max_syntax_attempts: 7, max_logic_attempts: 10,
        syntax_error_budget: 0.20, logic_error_budget: 0.30,
        rate_limit_per_min: 20
    }
};
class AIDebugger {
    constructor(policy = {}) {
        this.scorer = new confidence_scoring_1.UnifiedConfidenceScorer(1.0, 1000);
        this.cascade = new cascading_error_handler_1.CascadingErrorHandler();
        this.enveloper = new envelope_1.AIPatchEnvelope();
        this.memory = new envelope_1.ResilientMemoryBuffer(500, (err) => {
            var _a;
            try {
                console.debug('[memory] error', (_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : String(err));
            }
            catch { }
        }, 7 * 24 * 60 * 60 * 1000); // 7-day TTL
        this.human = new human_debugging_1.SeniorDeveloperSimulator();
        this.debugger = new strategy_1.Debugger(new strategy_1.LogAndFixStrategy());
        this.tokens = [];
        // Optional, pluggable hooks
        this.sanitizer = new PassThroughSanitizer();
        this.telemetry = new ConsoleTelemetrySink();
        this.backoffPolicy = new backoff_1.DefaultBackoffPolicy();
        this.watchdog = new observer_1.HangWatchdog(5000, 90);
        // Clamp confidence floors to schema minimums (0.1)
        const minFloor = 0.1;
        const merged = { ...exports.defaultPolicy, ...policy };
        this.policy = {
            ...merged,
            syntax_conf_floor: Math.max(minFloor, merged.syntax_conf_floor),
            logic_conf_floor: Math.max(minFloor, merged.logic_conf_floor)
        };
        this.breaker = new confidence_scoring_1.DualCircuitBreaker(this.policy.max_syntax_attempts, this.policy.max_logic_attempts, this.policy.syntax_error_budget, this.policy.logic_error_budget);
        this.sandbox = new cascading_error_handler_1.SandboxExecution(cascading_error_handler_1.Environment.SANDBOX, this.policy.sandbox_isolation // Cast to match IsolationLevel type if needed
        );
        this.riskObserver = new observer_1.RiskyEditObserver(this.policy.risky_keywords, 50);
        // Optionally swap in enhanced ESLint runner while keeping fail-open behavior
        const eslintRunner = this.policy.enable_enhanced_eslint
            ? (0, eslint_enhanced_runner_1.default)({ alias: { '@': './src' } })
            : undefined;
        this.finalPolishObserver = (0, final_polish_observer_1.createFinalPolishObserver)(true, // Base ESLint formatting in FinalPolishObserver
        this.policy.enable_zod_validation ? enable_zod_success_validation_1.validateSuccessEnvelope : undefined, eslintRunner);
        this.pathObserver = new path_resolution_observer_1.PathResolutionObserver(process.cwd());
    }
    async process_error(error_type, message, patch_code, original_code, logits, historical = {}, metadata = {}) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5;
        this.enforce_rate_limit();
        const patch = { message, patched_code: patch_code, original_code, language: "typescript" };
        const envelope = this.enveloper.wrapPatch(patch);
        envelope.metadata = { ...envelope.metadata, ...metadata };
        // Freeze current policy thresholds into policySnapshot (auditable, optional fields safeguarded)
        try {
            envelope.policySnapshot = {
                modelClass: 'mid-tier', // could derive from preset selection
                syntax_error_budget: this.policy.syntax_error_budget,
                logic_error_budget: this.policy.logic_error_budget,
                max_syntax_attempts: this.policy.max_syntax_attempts,
                max_logic_attempts: this.policy.max_logic_attempts,
                confidence_floor_syntax: this.policy.syntax_conf_floor,
                confidence_floor_logic: this.policy.logic_conf_floor
            };
        }
        catch { /* non-fatal */ }
        // Evaluate risky edit flags early and attach to metadata
        try {
            const riskFlags = this.riskObserver.evaluate(patch_code, original_code);
            if (riskFlags.length > 0) {
                envelope.metadata.risk_flags = riskFlags;
            }
        }
        catch { /* ignore risk flag errors */ }
        // Evaluate import/asset path resolution (best-effort)
        try {
            const missing = this.pathObserver.evaluate(patch_code, /* sourceFilePath */ undefined);
            if (missing && missing.length > 0) {
                envelope.metadata.missing_paths = missing;
            }
        }
        catch { /* non-fatal: best-effort */ }
        // Populate schema-required fields
        const conf = this.scorer.calculate_confidence(logits, error_type, historical);
        (0, envelope_1.mergeConfidence)(envelope, {
            syntax: conf.syntax_confidence,
            logic: conf.logic_confidence,
            risk: this.is_risky(patch) ? 1 : 0
        });
        // Normalize breaker state for schema: OPEN|CLOSED|HALF_OPEN
        const breakerSummaryForHeader = this.breaker.get_state_summary();
        (0, envelope_1.setBreakerState)(envelope, breakerSummaryForHeader.state);
        // Provide stubs for missing methods if not present
        const cascadeDepthVal = typeof this.cascade.getDepth === "function"
            ? this.cascade.getDepth()
            : this.cascade.cascadeDepth || 0;
        (0, envelope_1.setCascadeDepth)(envelope, cascadeDepthVal);
        const ru = typeof this.sandbox.getResourceUsage === "function"
            ? this.sandbox.getResourceUsage()
            : {};
        (0, envelope_1.mergeResourceUsage)(envelope, ru);
        const plan = this.human.debugLikeHuman(message, { error: message, code_snippet: patch_code });
        this.debugger.setStrategy(this.map_strategy((_a = plan === null || plan === void 0 ? void 0 : plan.recommended_strategy) !== null && _a !== void 0 ? _a : "LogAndFixStrategy"));
        const floor = (error_type === confidence_scoring_1.ErrorType.SYNTAX) ? this.policy.syntax_conf_floor : this.policy.logic_conf_floor;
        const [canAttempt, cbReason] = this.breaker.can_attempt(error_type);
        const [stop, cascadeReason] = this.cascade.should_stop_attempting();
        // --- SCHEMA VALIDATION ---
        const ajv = new ajv_1.default({ addUsedSchema: false, strict: false });
        ajv.addFormat('date-time', true); // Add support for date-time format
        // Use file-relative path for robustness
        const schemaPath = path.resolve(__dirname, 'schemas', 'selfhealing.schema.json');
        let schema;
        try {
            schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
        }
        catch (e) {
            throw new Error("Could not load PatchEnvelope schema: " + (e && e.message ? e.message : String(e)));
        }
        const validate = ajv.compile(schema);
        const envelopeJson = JSON.parse(envelope.toJson());
        if (!validate(envelopeJson)) {
            throw new Error("PatchEnvelope validation failed: " + ajv.errorsText());
        }
        if (this.is_risky(patch) && this.policy.require_human_on_risky) {
            this.record_attempt(envelope, false, "Risk gate → human review");
            (0, envelope_1.applyDeveloperFlag)(envelope, { flagged: true, message: "Risky patch (policy). Human approval required." });
            return this.finalize(envelope, "HUMAN_REVIEW", { cbReason, cascadeReason, floor });
        }
        const typeConf = (error_type === confidence_scoring_1.ErrorType.SYNTAX) ? conf.syntax_confidence : conf.logic_confidence;
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
        try {
            this.watchdog.beginAttempt(attemptKey);
        }
        catch { /* ignore */ }
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
                    const proc = (0, child_process_1.spawn)('node', [rebankScript, '--stdin', '--typescript'], {
                        stdio: ['pipe', 'pipe', 'pipe'],
                        timeout: 5000
                    });
                    let stdout = '';
                    let stderr = '';
                    (_b = proc.stdout) === null || _b === void 0 ? void 0 : _b.on('data', (chunk) => { stdout += chunk.toString(); });
                    (_c = proc.stderr) === null || _c === void 0 ? void 0 : _c.on('data', (chunk) => { stderr += chunk.toString(); });
                    // Send runtime error to stdin
                    (_d = proc.stdin) === null || _d === void 0 ? void 0 : _d.write(runtimeError);
                    (_e = proc.stdin) === null || _e === void 0 ? void 0 : _e.end();
                    await new Promise((resolve) => {
                        proc.on('close', (code) => {
                            try {
                                if (code === 1 && stdout.trim()) {
                                    // Re-banker successfully parsed error
                                    const parsed = JSON.parse(stdout);
                                    parsed.code = 'TS_RUNTIME'; // Override to distinguish from syntax
                                    parsed.severity = 'FATAL_RUNTIME';
                                    envelope.metadata.rebanker_result = parsed;
                                }
                                else {
                                    // Couldn't parse - use raw
                                    envelope.metadata.rebanker_result = {
                                        file: 'unknown',
                                        line: null,
                                        column: null,
                                        message: runtimeError,
                                        code: 'TS_RUNTIME_UNPARSED',
                                        severity: 'FATAL_RUNTIME'
                                    };
                                }
                            }
                            catch (e) {
                                // JSON parse error - use raw
                                envelope.metadata.rebanker_result = {
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
                }
                else {
                    // Priority 2: Static syntax check via re-banker
                    const rebankScript = path.join('.', 'ops', 'rebank', 'rebank_js_ts.mjs');
                    const proc = (0, child_process_1.spawn)('node', [rebankScript, tmpPath, '--quiet'], {
                        stdio: ['pipe', 'pipe', 'pipe'],
                        timeout: 5000
                    });
                    let stdout = '';
                    (_f = proc.stdout) === null || _f === void 0 ? void 0 : _f.on('data', (chunk) => { stdout += chunk.toString(); });
                    await new Promise((resolve) => {
                        proc.on('close', (code) => {
                            try {
                                if (stdout.trim()) {
                                    const result = JSON.parse(stdout);
                                    envelope.metadata.rebanker_result = result;
                                }
                                else {
                                    envelope.metadata.rebanker_result = { status: 'clean' };
                                }
                            }
                            catch (e) {
                                envelope.metadata.rebanker_result = {
                                    status: 'error',
                                    message: `Re-banker parse error: ${e}`
                                };
                            }
                            resolve();
                        });
                    });
                }
            }
            finally {
                // Clean up temp file
                try {
                    fs.unlinkSync(tmpPath);
                }
                catch { /* ignore */ }
            }
        }
        catch (e) {
            // Re-banker integration failed - non-fatal, continue without it
            console.warn(`[Re-banker] Integration error: ${e}`);
        }
        // Update resource usage in envelope from sandbox after execution
        try {
            envelope.resourceUsage = ((_h = (_g = this.sandbox).getResourceUsage) === null || _h === void 0 ? void 0 : _h.call(_g)) || envelope.resourceUsage;
        }
        catch { /* ignore */ }
        // Evaluate watchdog outcome
        try {
            const event = this.watchdog.endAttempt(attemptKey, { sandbox: sbox, resourceUsage: envelope.resourceUsage });
            if (event === null || event === void 0 ? void 0 : event.triggered) {
                // Apply first-level suspicion; deeper escalation occurs in attemptWithBackoff
                envelope.metadata.watchdog = event;
            }
        }
        catch { /* ignore */ }
        const strat = this.debugger.debug({ error: message, vulnerability: message });
        // Extract re-banker results for error delta calculation (fast, already computed)
        const rebankerResult = ((_j = envelope.metadata) === null || _j === void 0 ? void 0 : _j.rebanker_result) || {};
        // Determine current error count from re-banker (structured 5-field JSON)
        // Note: Re-banker returns FIRST error only; if line exists → at least 1 error
        let currentErrors = 0;
        if (rebankerResult.line !== null && rebankerResult.line !== undefined) {
            currentErrors = 1; // At least one error (structured info on first)
        }
        else if (rebankerResult.status === 'clean') {
            currentErrors = 0;
        }
        // Get previous error count from last attempt (if exists)
        const previousErrors = ((_k = envelope.trendMetadata) === null || _k === void 0 ? void 0 : _k.errorsDetected) || 0;
        // Calculate error delta (positive = improvement)
        const errorsResolved = Math.max(0, previousErrors - currentErrors);
        // Calculate lines of code for error density
        const linesOfCode = patch_code.split('\n').length;
        // Record attempt with error delta from re-banker, confidence, and code metrics
        this.breaker.record_attempt(error_type, success, currentErrors, // errors detected by re-banker (blazingly fast ~100ms)
        errorsResolved, // errors resolved from previous version
        conf.overall_confidence, // confidence score for this attempt
        linesOfCode // lines of code for density calculation
        );
        // Create a PatchResult and persist to memory for traceability
        try {
            const pr = new jitter_comms_1.PatchResult(success, errorsResolved, Math.max(0, errorsResolved), (_l = strat.details) !== null && _l !== void 0 ? _l : '');
            (_q = (_o = (_m = this.memory).safeAddOutcome) === null || _o === void 0 ? void 0 : _o.call(_m, JSON.stringify({ kind: 'patch_result', attempt: (_p = metadata === null || metadata === void 0 ? void 0 : metadata.attempt) !== null && _p !== void 0 ? _p : null, patchId: envelope.patchId, result: pr }))) !== null && _q !== void 0 ? _q : this.memory.addOutcome(JSON.stringify({ kind: 'patch_result', attempt: (_r = metadata === null || metadata === void 0 ? void 0 : metadata.attempt) !== null && _r !== void 0 ? _r : null, patchId: envelope.patchId, result: pr }));
        }
        catch { /* best-effort */ }
        // Get the breaker's recommendation for next action
        const breakerSummary = this.breaker.get_state_summary();
        let recommendedAction = breakerSummary.recommended_action;
        // Update envelope with rich trend metadata (using re-banker error counts)
        const localImproving = errorsResolved > 0;
        (0, envelope_1.updateTrend)(envelope, {
            errorsDetected: currentErrors,
            errorsResolved: errorsResolved,
            qualityScore: success ? 1.0 : 0.0, // Binary quality from re-banker (clean vs error)
            improvementVelocity: breakerSummary.improvement_velocity,
            stagnationRisk: breakerSummary.should_continue_attempts ? 0.2 : 0.8
        });
        this.scorer.record_outcome(conf.overall_confidence, success);
        if (!success)
            this.cascade.add_error_to_chain(error_type, message, conf.overall_confidence, 1);
        this.record_attempt(envelope, success, (_s = strat.details) !== null && _s !== void 0 ? _s : "");
        (_v = (_u = (_t = this.memory).safeAddOutcome) === null || _u === void 0 ? void 0 : _u.call(_t, envelope.toJson())) !== null && _v !== void 0 ? _v : this.memory.addOutcome(envelope.toJson());
        // Optional: if oscillation detected, suggest short pause/backoff (caller may choose to call pause())
        const shouldPause = breakerSummary.paused === false &&
            breakerSummary.confidence_improving && !breakerSummary.is_improving;
        const attemptNo = (_w = metadata === null || metadata === void 0 ? void 0 : metadata.attempt) !== null && _w !== void 0 ? _w : 1;
        const watchdogHigh = Boolean(((_y = (_x = envelope.metadata) === null || _x === void 0 ? void 0 : _x.watchdog) === null || _y === void 0 ? void 0 : _y.triggered) && ((_0 = (_z = envelope.metadata) === null || _z === void 0 ? void 0 : _z.watchdog) === null || _0 === void 0 ? void 0 : _0.severity) === 'high');
        if (shouldPause && !(watchdogHigh && attemptNo >= 2)) {
            recommendedAction = 'pause_and_backoff';
            // Do not mutate breaker state automatically; leave pause() to caller if desired
        }
        // Use envelope-guided action instead of simple binary logic
        let action;
        // First-attempt grace: only force rollback on high-severity watchdog from the second attempt onward
        const wdMeta = (_1 = envelope.metadata) === null || _1 === void 0 ? void 0 : _1.watchdog;
        if (watchdogHigh && attemptNo >= 2) {
            action = "ROLLBACK";
        }
        else if (wdMeta === null || wdMeta === void 0 ? void 0 : wdMeta.triggered) {
            // If watchdog triggered at all, avoid promotion on first attempt; suggest pause/backoff
            action = 'PAUSE_AND_BACKOFF';
        }
        else if (success && (recommendedAction === "promote" || recommendedAction === "continue")) {
            // On success, allow promotion when breaker is not explicitly rolling back
            action = "PROMOTE";
        }
        else if (recommendedAction === "rollback") {
            action = "ROLLBACK";
        }
        else if (recommendedAction === 'pause_and_backoff') {
            action = 'PAUSE_AND_BACKOFF';
        }
        else if (recommendedAction === "continue" && this.breaker.can_attempt(error_type)[0]) {
            action = "RETRY";
        }
        else if (recommendedAction === "try_different_strategy") {
            action = "STRATEGY_CHANGE";
        }
        else {
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
                watchdog: (_3 = (_2 = envelope.metadata) === null || _2 === void 0 ? void 0 : _2.watchdog) !== null && _3 !== void 0 ? _3 : null,
                risk_flags: (_5 = (_4 = envelope.metadata) === null || _4 === void 0 ? void 0 : _4.risk_flags) !== null && _5 !== void 0 ? _5 : []
            }
        });
    }
    map_strategy(name) {
        switch (name) {
            case "RollbackStrategy": return new strategy_1.RollbackStrategy();
            case "SecurityAuditStrategy": return new strategy_1.SecurityAuditStrategy();
            default: return new strategy_1.LogAndFixStrategy();
        }
    }
    record_attempt(env, ok, note = "") {
        var _a, _b, _c, _d, _e;
        const b = this.breaker.get_state_summary();
        (0, envelope_1.appendAttempt)(env, {
            success: ok,
            note,
            breakerState: b.state,
            failureCount: b.failure_count
        });
        (0, envelope_1.markSuccess)(env, ok);
        // Update counters (determine kind based on last error type heuristic in note)
        try {
            const lastAttemptIndex = (((_a = env.attempts) === null || _a === void 0 ? void 0 : _a.length) || 1);
            const errorsResolved = (_c = (_b = env.trendMetadata) === null || _b === void 0 ? void 0 : _b.errorsResolved) !== null && _c !== void 0 ? _c : 0;
            const kind = /syntax/i.test(note) ? 'syntax' : (/logic/i.test(note) ? 'logic' : 'other');
            (0, envelope_1.updateCounters)(env, kind, errorsResolved);
            const overallConfidence = (() => {
                const cc = env.confidenceComponents || {};
                const vals = ['syntax', 'logic', 'risk'].map(k => typeof cc[k] === 'number' ? cc[k] : undefined).filter(v => typeof v === 'number');
                if (!vals.length)
                    return undefined;
                return Math.max(0, Math.min(1, vals.reduce((a, b) => a + b, 0) / vals.length));
            })();
            (0, envelope_1.addTimelineEntry)(env, {
                attempt: lastAttemptIndex,
                errorsDetected: (_d = env.trendMetadata) === null || _d === void 0 ? void 0 : _d.errorsDetected,
                errorsResolved: (_e = env.trendMetadata) === null || _e === void 0 ? void 0 : _e.errorsResolved,
                overallConfidence,
                breakerState: b.state,
                action: note ? note.slice(0, 40) : undefined
            });
        }
        catch { /* non-fatal */ }
    }
    finalize(env, action, extras) {
        // Canonical timestamp & hash just before emitting final envelope shape
        (0, envelope_1.setEnvelopeTimestamp)(env);
        try {
            const sha256Hex = (s) => crypto_1.default.createHash("sha256").update(s).digest("hex");
            (0, envelope_1.setEnvelopeHash)(env, sha256Hex);
        }
        catch { /* hash best-effort */ }
        // Check for final polish opportunity (95% confidence + zero errors)
        if (action === 'PROMOTE') {
            this.checkAndApplyFinalPolish(env, extras);
        }
        return { action, envelope: JSON.parse(env.toJson()), extras };
    }
    /**
     * Check if we should apply final polish and send success message to LLM
     */
    async checkAndApplyFinalPolish(env, extras) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        try {
            // Extract confidence and error information from various sources
            const confidence = extras.confidence || ((_a = env.confidenceComponents) === null || _a === void 0 ? void 0 : _a.overall) || 0;
            const errorCount = ((_b = env.trendMetadata) === null || _b === void 0 ? void 0 : _b.errorsDetected) || 0;
            const patchCode = typeof env.patchData === 'string' ? env.patchData :
                (((_c = env.patchData) === null || _c === void 0 ? void 0 : _c.code) || JSON.stringify(env.patchData) || '');
            // Check if we meet the 95% threshold
            if (this.finalPolishObserver.shouldApplyFinalPolish(confidence, errorCount)) {
                // Add to telemetry instead of console logging
                (_e = (_d = this.telemetry).onAttempt) === null || _e === void 0 ? void 0 : _e.call(_d, {
                    envelope: { type: 'final_polish_triggered', confidence, errorCount },
                    breakerSummary: { final_polish: 'conditions_met' },
                    llmReply: null,
                    waitMs: 0,
                    rationale: `95_percent_threshold_met_confidence_${(confidence * 100).toFixed(1)}_errors_${errorCount}`
                });
                // Apply final polish (linting)
                const polishResult = await this.finalPolishObserver.applyFinalPolish(patchCode, confidence, errorCount, env.patchId);
                if (polishResult.shouldLint && polishResult.finalCode) {
                    // Update the envelope with polished code
                    if (typeof env.patchData === 'string') {
                        env.patchData = { code: polishResult.finalCode, polished: true };
                    }
                    else {
                        env.patchData.code = polishResult.finalCode;
                        env.patchData.polished = true;
                    }
                    env.success = true;
                    // Mark that final polish was applied
                    if (!env.metadata)
                        env.metadata = {};
                    env.metadata.finalPolishApplied = true;
                    env.metadata.finalPolishTimestamp = new Date().toISOString();
                    env.metadata.achievedConfidence = confidence;
                    // Optionally run Stylelint reporter and attach results (engage/disengage via policy)
                    if (this.policy.enable_stylelint && this.isCssLike(polishResult.finalCode)) {
                        try {
                            const reporter = (0, stylelint_runner_1.createStylelintReporter)();
                            const stylelintReport = await reporter(polishResult.finalCode, { filename: (env === null || env === void 0 ? void 0 : env.patchId) ? `${env.patchId}.scss` : undefined });
                            env.metadata.stylelint = stylelintReport;
                        }
                        catch (e) {
                            env.metadata.stylelint = { errored: false, warnings: [], note: `[stylelint] integration failed: ${(e === null || e === void 0 ? void 0 : e.message) || String(e)}` };
                        }
                    }
                }
                // Create success envelope for LLM communication
                const successEnvelope = this.finalPolishObserver.createSuccessEnvelope(env.patchId || 'unknown', confidence, polishResult.finalCode || patchCode, ((_f = env.metadata) === null || _f === void 0 ? void 0 : _f.attempt) || 1, env.metadata);
                // Store the success envelope for potential LLM communication
                // (The actual sending will happen in attemptWithBackoff where chat is available)
                extras.successCelebration = successEnvelope;
                extras.finalPolishApplied = true;
                // Send completion telemetry instead of console logging
                (_h = (_g = this.telemetry).onAttempt) === null || _h === void 0 ? void 0 : _h.call(_g, {
                    envelope: { type: 'final_polish_completed', patchId: env.patchId },
                    breakerSummary: { final_polish: 'completed', linting_applied: polishResult.shouldLint },
                    llmReply: 'FINAL_POLISH_READY_FOR_LLM',
                    waitMs: 0,
                    rationale: 'final_polish_completed_success_message_prepared'
                });
            }
        }
        catch (error) {
            // Send error to telemetry instead of console logging
            (_k = (_j = this.telemetry).onAttempt) === null || _k === void 0 ? void 0 : _k.call(_j, {
                envelope: { type: 'final_polish_error', error: error instanceof Error ? error.message : String(error) },
                breakerSummary: { final_polish: 'failed' },
                llmReply: null,
                waitMs: 0,
                rationale: 'final_polish_check_failed'
            });
            // Don't let polish failures break the main flow
        }
    }
    is_risky(patch) {
        const blob = JSON.stringify(patch).toLowerCase();
        return this.policy.risky_keywords.some(k => blob.includes(k));
    }
    enforce_rate_limit() {
        const now = Date.now() / 1000;
        this.tokens = this.tokens.filter(t => now - t < 60);
        if (this.tokens.length >= this.policy.rate_limit_per_min)
            throw new Error("Rate limit exceeded");
        this.tokens.push(now);
    }
    // Persistence methods - extend the existing AIDebugger
    async saveMemory(filePath = './ai-debugger-memory.json') {
        await this.memory.save(filePath);
    }
    async loadMemory(filePath = './ai-debugger-memory.json') {
        await this.memory.load(filePath);
    }
    getMemoryStats() {
        return {
            bufferSize: this.memory.buffer.length,
            maxSize: this.memory.maxSize
        };
    }
    // Orchestrated retry with backoff and minimal patch tweak between attempts
    async attemptWithBackoff(error_type, message, patch_code, original_code, logits, opts = {}) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15;
        const maxAttempts = Math.max(1, (_a = opts.maxAttempts) !== null && _a !== void 0 ? _a : 3);
        const minMs = Math.max(0, (_b = opts.minMs) !== null && _b !== void 0 ? _b : 500);
        const maxMs = Math.max(minMs, (_c = opts.maxMs) !== null && _c !== void 0 ? _c : 1500);
        let currentPatch = patch_code;
        let result = null;
        let consecutiveWatchdogFlags = 0;
        let watchdogAggregate = { watchdog_flag_count: 0 };
        // Optional: set up a chat history adapter for this run
        const chat = (_d = opts.chatAdapter) !== null && _d !== void 0 ? _d : new memory_adapter_1.default(this.memory, opts.sessionId);
        // Log initial system prompt for traceability
        try {
            chat.addMessage('system', jitter_comms_1.defaultSystemPrompt, { phase: 'init' });
        }
        catch { }
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            // Record the start of an attempt as a user message for conversation continuity
            // Include re-banker structured error info from previous attempt if available
            try {
                const userMessage = {
                    type: 'attempt.start',
                    attempt,
                    error_type,
                    message,
                    last_patch: currentPatch,
                    language: 'typescript'
                };
                // On retry attempts, include structured re-banker error from previous envelope
                if (attempt > 1 && ((_e = result === null || result === void 0 ? void 0 : result.envelope) === null || _e === void 0 ? void 0 : _e.metadata)) {
                    const prevRebanker = (_f = result.envelope.metadata) === null || _f === void 0 ? void 0 : _f.rebanker_result;
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
            }
            catch { /* ignore chat errors */ }
            result = this.process_error(error_type, message, currentPatch, original_code, logits, { attempt }, { attempt });
            const summary = ((_g = result.extras) === null || _g === void 0 ? void 0 : _g.trend_analysis) || this.breaker.get_state_summary();
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
                    breaker_recommendation: summary === null || summary === void 0 ? void 0 : summary.recommended_action,
                    improving: !!(summary === null || summary === void 0 ? void 0 : summary.is_improving)
                }, { phase: 'result' });
            }
            catch { /* ignore chat errors */ }
            const wd = (_j = (_h = result === null || result === void 0 ? void 0 : result.extras) === null || _h === void 0 ? void 0 : _h.observers) === null || _j === void 0 ? void 0 : _j.watchdog;
            if (wd === null || wd === void 0 ? void 0 : wd.triggered) {
                consecutiveWatchdogFlags += 1;
                watchdogAggregate.watchdog_flag_count += 1;
                watchdogAggregate.last_event = wd;
                // escalate suspicion on the 3rd and 4th attempt if flags persist
                const currentSusp = ((_k = wd === null || wd === void 0 ? void 0 : wd.suspicion) !== null && _k !== void 0 ? _k : 'suspicious');
                const escalated = (0, observer_1.escalateSuspicion)(currentSusp, attempt, consecutiveWatchdogFlags);
                // Mutate in-place for telemetry/jitter consumers
                if (wd && wd.suspicion !== escalated) {
                    wd.suspicion = escalated;
                }
            }
            else {
                consecutiveWatchdogFlags = 0;
            }
            if (result.action === 'PROMOTE' || result.action === 'ROLLBACK' || result.action === 'HUMAN_REVIEW') {
                // Final decision message + memory metrics snapshot
                try {
                    const metrics = (_m = (_l = this.memory).getMetrics) === null || _m === void 0 ? void 0 : _m.call(_l);
                    chat.addMessage('tool', {
                        type: 'final_decision',
                        decision: result.action,
                        attempt,
                        observers: { watchdog_flag_count: watchdogAggregate.watchdog_flag_count },
                        memory_metrics: metrics !== null && metrics !== void 0 ? metrics : null
                    }, { phase: 'final' });
                }
                catch { /* ignore chat errors */ }
                // 🎉 SEND SUCCESS CELEBRATION TO LLM IF FINAL POLISH WAS APPLIED
                if (result.action === 'PROMOTE' && ((_o = result.extras) === null || _o === void 0 ? void 0 : _o.finalPolishApplied) && ((_p = result.extras) === null || _p === void 0 ? void 0 : _p.successCelebration)) {
                    try {
                        await this.finalPolishObserver.sendSuccessToLLM(chat, result.extras.successCelebration);
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
                        (_r = (_q = this.telemetry).onAttempt) === null || _r === void 0 ? void 0 : _r.call(_q, {
                            envelope: result.extras.successCelebration,
                            breakerSummary: { celebration: 'success', confidence_threshold_met: true },
                            llmReply: 'SUCCESS_CELEBRATION_SENT',
                            waitMs: ((_s = result.extras.successCelebration.celebration) === null || _s === void 0 ? void 0 : _s.jitter_delay_ms) || 300,
                            rationale: 'final_polish_applied_95_percent_confidence'
                        });
                    }
                    catch (error) {
                        // Log error to telemetry instead of console
                        chat.addMessage('tool', {
                            type: 'success_celebration_error',
                            error: error instanceof Error ? error.message : String(error),
                            timestamp: new Date().toISOString()
                        }, { phase: 'error' });
                    }
                }
                // Surface observer aggregates in extras for telemetry
                return { ...result, extras: { ...result.extras, observers: { ...(((_t = result.extras) === null || _t === void 0 ? void 0 : _t.observers) || {}), watchdog_flag_count: watchdogAggregate.watchdog_flag_count } } };
            }
            // Decide backoff
            if (result.action === 'PAUSE_AND_BACKOFF' || result.action === 'RETRY') {
                // Trend-aware tripping: if watchdog flagged twice in a row and no improvement, convert to rollback
                if (consecutiveWatchdogFlags >= 2) {
                    // check trend
                    const trend = (_u = result === null || result === void 0 ? void 0 : result.extras) === null || _u === void 0 ? void 0 : _u.trend_analysis;
                    const improving = Boolean((trend === null || trend === void 0 ? void 0 : trend.is_improving) || ((_w = (_v = result === null || result === void 0 ? void 0 : result.envelope) === null || _v === void 0 ? void 0 : _v.trendMetadata) === null || _w === void 0 ? void 0 : _w.errorTrend) === 'improving');
                    if (!improving) {
                        return { ...result, action: 'ROLLBACK', extras: { ...result.extras, stop_reason: 'watchdog_trend', observers: { ...(((_x = result.extras) === null || _x === void 0 ? void 0 : _x.observers) || {}), watchdog_flag_count: watchdogAggregate.watchdog_flag_count } } };
                    }
                }
                const sb = (_y = result.extras) === null || _y === void 0 ? void 0 : _y.sandbox;
                const failMsg = (sb === null || sb === void 0 ? void 0 : sb.error_message) || (Array.isArray(sb === null || sb === void 0 ? void 0 : sb.test_results) ? (((_z = sb.test_results.find((t) => !t.passed)) === null || _z === void 0 ? void 0 : _z.error_message) || null) : null);
                // Centralized pause+jitter+LLM consult; returns jitter envelope and optional LLM patch
                // Retrieve similar outcomes from long-chain memory (best-effort)
                let similarOutcomes;
                try {
                    similarOutcomes = this.memory.getSimilarOutcomes({ message: failMsg || message, code: original_code });
                }
                catch { /* ignore */ }
                const consult = await (0, backoff_1.pauseAndJitterConsult)({
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
                        request_id: (_1 = (_0 = result === null || result === void 0 ? void 0 : result.envelope) === null || _0 === void 0 ? void 0 : _0.patch_id) !== null && _1 !== void 0 ? _1 : null
                    },
                    backoffPolicy: this.backoffPolicy
                });
                // Persist jitter envelope and reply to long-chain memory for future context
                try {
                    (_4 = (_3 = (_2 = this.memory).safeAddOutcome) === null || _3 === void 0 ? void 0 : _3.call(_2, JSON.stringify({ kind: 'jitter_envelope', envelope: consult.envelope }))) !== null && _4 !== void 0 ? _4 : this.memory.addOutcome(JSON.stringify({ kind: 'jitter_envelope', envelope: consult.envelope }));
                    if (consult.llmReplyText) {
                        const llm = jitter_comms_1.LLMResponse.fromLLMReply(consult.llmReplyText);
                        (_7 = (_6 = (_5 = this.memory).safeAddOutcome) === null || _6 === void 0 ? void 0 : _6.call(_5, JSON.stringify({ kind: 'llm_reply', response: { intent: llm.intent, proposedPatch: llm.proposedPatch, rawText: llm.rawText } }))) !== null && _7 !== void 0 ? _7 : this.memory.addOutcome(JSON.stringify({ kind: 'llm_reply', response: { intent: llm.intent, proposedPatch: llm.proposedPatch, rawText: llm.rawText } }));
                    }
                }
                catch { /* best-effort */ }
                // Also log to chat history: user sends the jitter envelope, AI responds
                try {
                    chat.addMessage('user', consult.envelope, { phase: 'backoff_consult' });
                }
                catch { }
                try {
                    if (consult.llmReplyText)
                        chat.addMessage('ai', consult.llmReplyText, { phase: 'backoff_consult' });
                }
                catch { }
                // Telemetry event for the attempt
                try {
                    (_9 = (_8 = this.telemetry).onAttempt) === null || _9 === void 0 ? void 0 : _9.call(_8, {
                        envelope: consult.envelope,
                        breakerSummary: summary,
                        llmReply: (_10 = consult.llmReplyText) !== null && _10 !== void 0 ? _10 : null,
                        waitMs: consult.waitMs,
                        rationale: (_11 = consult.rationale) !== null && _11 !== void 0 ? _11 : null
                    });
                }
                catch { /* ignore telemetry errors */ }
                if (consult.proposedPatch) {
                    // Sanitize proposed patch before applying
                    const check = this.sanitizer.sanitize(consult.proposedPatch, {
                        max_lines_changed: 50,
                        disallow_keywords: this.policy.risky_keywords
                    });
                    if (check.ok) {
                        currentPatch = (_12 = check.code) !== null && _12 !== void 0 ? _12 : consult.proposedPatch;
                    }
                    else {
                        // Record sanitizer rejection and fall back to minimal tweak
                        try {
                            (_15 = (_14 = (_13 = this.memory).safeAddOutcome) === null || _14 === void 0 ? void 0 : _14.call(_13, JSON.stringify({ kind: 'sanitizer_reject', reason: check.reason, ts: Date.now() }))) !== null && _15 !== void 0 ? _15 : this.memory.addOutcome(JSON.stringify({ kind: 'sanitizer_reject', reason: check.reason, ts: Date.now() }));
                        }
                        catch { /* ignore */ }
                        currentPatch = this.minimalTweak(currentPatch, failMsg || message);
                    }
                }
                else {
                    currentPatch = this.minimalTweak(currentPatch, failMsg || message);
                }
                // Record decision as a tool message in chat history
                try {
                    chat.addMessage('tool', JSON.stringify({ action: 'apply_patch', attempt, reason: consult.rationale || 'backoff_policy' }), { phase: 'decision' });
                }
                catch { }
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
        return result;
    }
    // Very conservative tweak: fix common syntax issues without altering logic
    minimalTweak(code, errorMessage) {
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
    balancePairs(src) {
        // Balance (), {}, [] by counting and adding closing tokens at EOF as a safe no-op try
        const pairs = [["(", ")"], ["{", "}"], ["[", "]"]];
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
    isCssLike(src) {
        if (!src)
            return false;
        const s = src.trim();
        if (s.length < 8)
            return false;
        const hasBraces = /\{[\s\S]*\}/.test(s);
        const hasSelectors = /[#\.]?[a-zA-Z][\w-]*\s*\{/.test(s) || /:\s*[a-zA-Z-]+\s*;/.test(s);
        const scssAt = /@(use|forward|import|mixin|include|function|if|else|for|each|while)\b/.test(s);
        const jsHints = /(function|const|let|var|=>|class\s+[A-Za-z]|import\s+|export\s+)/.test(s);
        return (hasBraces && hasSelectors) || scssAt ? !jsHints : false;
    }
}
exports.AIDebugger = AIDebugger;
class PassThroughSanitizer {
    sanitize(code) {
        // Default: allow all; subclasses can enforce constraints
        return { ok: true, code };
    }
}
class ConsoleTelemetrySink {
    onAttempt(payload) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        try {
            // Keep concise to avoid noise
            const las = ((_a = payload === null || payload === void 0 ? void 0 : payload.envelope) === null || _a === void 0 ? void 0 : _a.last_attempt_status) || {};
            console.debug('[telemetry] attempt', {
                type: (_b = payload === null || payload === void 0 ? void 0 : payload.envelope) === null || _b === void 0 ? void 0 : _b.type,
                decision: (_d = (_c = payload === null || payload === void 0 ? void 0 : payload.breakerSummary) === null || _c === void 0 ? void 0 : _c.recommended_action) !== null && _d !== void 0 ? _d : (_f = (_e = payload === null || payload === void 0 ? void 0 : payload.envelope) === null || _e === void 0 ? void 0 : _e.trend) === null || _f === void 0 ? void 0 : _f.recommended_action,
                waitMs: payload.waitMs,
                replyBytes: payload.llmReply ? payload.llmReply.length : 0,
                rationale: (_g = payload.rationale) !== null && _g !== void 0 ? _g : null,
                request_id: (_k = (_j = (_h = payload === null || payload === void 0 ? void 0 : payload.envelope) === null || _h === void 0 ? void 0 : _h.metadata) === null || _j === void 0 ? void 0 : _j.request_id) !== null && _k !== void 0 ? _k : null,
                loop_attempt: (_o = (_m = (_l = payload === null || payload === void 0 ? void 0 : payload.envelope) === null || _l === void 0 ? void 0 : _l.metadata) === null || _m === void 0 ? void 0 : _m.loop_attempt) !== null && _o !== void 0 ? _o : null,
                errors_resolved: (_p = las.errors_resolved) !== null && _p !== void 0 ? _p : null,
                error_delta: (_q = las.error_delta) !== null && _q !== void 0 ? _q : null
            });
        }
        catch { /* ignore */ }
    }
}
