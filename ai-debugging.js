"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIDebugger = exports.defaultPolicy = void 0;
// ai-debugging.ts
var confidence_scoring_1 = require("./utils/typescript/confidence_scoring");
var cascading_error_handler_1 = require("./utils/typescript/cascading_error_handler");
var envelope_1 = require("./utils/typescript/envelope");
var strategy_1 = require("./utils/typescript/strategy");
var human_debugging_1 = require("./utils/typescript/human_debugging");
var ajv_1 = require("ajv");
var fs = require("fs");
var path = require("path");
exports.defaultPolicy = {
    syntax_conf_floor: 0.98, logic_conf_floor: 0.80,
    max_syntax_attempts: 3, max_logic_attempts: 10,
    syntax_error_budget: 0.03, logic_error_budget: 0.10,
    rate_limit_per_min: 10, sandbox_isolation: "full",
    require_human_on_risky: true,
    risky_keywords: ["database_schema_change", "authentication_bypass", "production_data_modification"]
};
var AIDebugger = /** @class */ (function () {
    function AIDebugger(policy) {
        if (policy === void 0) { policy = {}; }
        this.scorer = new confidence_scoring_1.UnifiedConfidenceScorer(1.0, 1000);
        this.cascade = new cascading_error_handler_1.CascadingErrorHandler();
        this.enveloper = new envelope_1.AIPatchEnvelope();
        this.memory = new envelope_1.MemoryBuffer(500);
        this.human = new human_debugging_1.SeniorDeveloperSimulator();
        this.debugger = new strategy_1.Debugger(new strategy_1.LogAndFixStrategy());
        this.tokens = [];
        this.policy = __assign(__assign({}, exports.defaultPolicy), policy);
        this.breaker = new confidence_scoring_1.DualCircuitBreaker(this.policy.max_syntax_attempts, this.policy.max_logic_attempts, this.policy.syntax_error_budget, this.policy.logic_error_budget);
        this.sandbox = new cascading_error_handler_1.SandboxExecution(cascading_error_handler_1.Environment.SANDBOX, this.policy.sandbox_isolation // Cast to match IsolationLevel type if needed
        );
    }
    AIDebugger.prototype.process_error = function (error_type, message, patch_code, original_code, logits, historical, metadata) {
        var _a, _b;
        if (historical === void 0) { historical = {}; }
        if (metadata === void 0) { metadata = {}; }
        this.enforce_rate_limit();
        var patch = { message: message, patched_code: patch_code, original_code: original_code, language: "typescript" };
        var envelope = this.enveloper.wrapPatch(patch);
        envelope.metadata = __assign(__assign({}, envelope.metadata), metadata);
        // Populate schema-required fields
        var conf = this.scorer.calculate_confidence(logits, error_type, historical);
        envelope.confidenceComponents = {
            syntax: conf.syntax_confidence,
            logic: conf.logic_confidence,
            risk: this.is_risky(patch) ? 1 : 0
        };
        envelope.breakerState = this.breaker.get_state_summary().state;
        // Provide stubs for missing methods if not present
        envelope.cascadeDepth = typeof this.cascade.getDepth === "function"
            ? this.cascade.getDepth()
            : this.cascade.cascadeDepth || 0;
        envelope.resourceUsage = typeof this.sandbox.getResourceUsage === "function"
            ? this.sandbox.getResourceUsage()
            : {};
        var plan = this.human.debugLikeHuman(message, { error: message, code_snippet: patch_code });
        this.debugger.setStrategy(this.map_strategy((_a = plan === null || plan === void 0 ? void 0 : plan.recommended_strategy) !== null && _a !== void 0 ? _a : "LogAndFixStrategy"));
        var floor = (error_type === confidence_scoring_1.ErrorType.SYNTAX) ? this.policy.syntax_conf_floor : this.policy.logic_conf_floor;
        var _c = this.breaker.can_attempt(error_type), canAttempt = _c[0], cbReason = _c[1];
        var _d = this.cascade.should_stop_attempting(), stop = _d[0], cascadeReason = _d[1];
        // --- SCHEMA VALIDATION ---
        var ajv = new ajv_1.default({ addUsedSchema: false, strict: false });
        ajv.addFormat('date-time', true); // Add support for date-time format
        // Use file-relative path for robustness
        var schemaPath = path.resolve(__dirname, 'schemas', 'selfhealing.schema.json');
        var schema;
        try {
            schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
        }
        catch (e) {
            throw new Error("Could not load PatchEnvelope schema: " + (e && e.message ? e.message : String(e)));
        }
        var validate = ajv.compile(schema);
        var envelopeJson = JSON.parse(envelope.toJson());
        if (!validate(envelopeJson)) {
            throw new Error("PatchEnvelope validation failed: " + ajv.errorsText(validate.errors));
        }
        if (this.is_risky(patch) && this.policy.require_human_on_risky) {
            this.record_attempt(envelope, false, "Risk gate → human review");
            envelope.flaggedForDeveloper = true;
            envelope.developerMessage = "Risky patch (policy). Human approval required.";
            return this.finalize(envelope, "HUMAN_REVIEW", { cbReason: cbReason, cascadeReason: cascadeReason, floor: floor });
        }
        var typeConf = (error_type === confidence_scoring_1.ErrorType.SYNTAX) ? conf.syntax_confidence : conf.logic_confidence;
        if (!canAttempt || stop || typeConf < floor) {
            this.record_attempt(envelope, false, "Gate blocked");
            return this.finalize(envelope, "STOP", { cbReason: cbReason, cascadeReason: cascadeReason, floor: floor });
        }
        var sbox = this.sandbox.execute_patch({
            patchId: envelope.patchId, language: "typescript", patched_code: patch_code,
            original_code: original_code
        });
        var success = Boolean(sbox.success);
        var strat = this.debugger.debug({ error: message, vulnerability: message });
        this.breaker.record_attempt(error_type, success);
        this.scorer.record_outcome(conf.overall_confidence, success);
        if (!success)
            this.cascade.add_error_to_chain(error_type, message, conf.overall_confidence, 1);
        this.record_attempt(envelope, success, (_b = strat.details) !== null && _b !== void 0 ? _b : "");
        this.memory.addOutcome(envelope.toJson());
        var action = success ? "PROMOTE" : (this.breaker.can_attempt(error_type)[0] ? "RETRY" : "ROLLBACK");
        return this.finalize(envelope, action, { sandbox: sbox, strategy: strat, floor: floor });
    };
    AIDebugger.prototype.map_strategy = function (name) {
        switch (name) {
            case "RollbackStrategy": return new strategy_1.RollbackStrategy();
            case "SecurityAuditStrategy": return new strategy_1.SecurityAuditStrategy();
            default: return new strategy_1.LogAndFixStrategy();
        }
    };
    AIDebugger.prototype.record_attempt = function (env, ok, note) {
        if (note === void 0) { note = ""; }
        env.attempts.push({ ts: Date.now() / 1000, success: ok, note: note, breaker: this.breaker.get_state_summary() });
        env.success = env.success || ok;
    };
    AIDebugger.prototype.finalize = function (env, action, extras) {
        return { action: action, envelope: JSON.parse(env.toJson()), extras: extras };
    };
    AIDebugger.prototype.is_risky = function (patch) {
        var blob = JSON.stringify(patch).toLowerCase();
        return this.policy.risky_keywords.some(function (k) { return blob.includes(k); });
    };
    AIDebugger.prototype.enforce_rate_limit = function () {
        var now = Date.now() / 1000;
        this.tokens = this.tokens.filter(function (t) { return now - t < 60; });
        if (this.tokens.length >= this.policy.rate_limit_per_min)
            throw new Error("Rate limit exceeded");
        this.tokens.push(now);
    };
    // Persistence methods - extend the existing AIDebugger
    AIDebugger.prototype.saveMemory = function () {
        return __awaiter(this, arguments, void 0, function (filePath) {
            if (filePath === void 0) { filePath = './ai-debugger-memory.json'; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.memory.save(filePath)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AIDebugger.prototype.loadMemory = function () {
        return __awaiter(this, arguments, void 0, function (filePath) {
            if (filePath === void 0) { filePath = './ai-debugger-memory.json'; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.memory.load(filePath)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AIDebugger.prototype.getMemoryStats = function () {
        return {
            bufferSize: this.memory.buffer.length,
            maxSize: this.memory.maxSize
        };
    };
    return AIDebugger;
}());
exports.AIDebugger = AIDebugger;
