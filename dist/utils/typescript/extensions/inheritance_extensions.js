"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Extensions = exports.ExtendedCodeErrorAnalyzer = exports.AdaptivePatchEnvelope = exports.ResilientMemoryBuffer = void 0;
// Inheritance-based extensions that build on existing tools without rewriting core logic
const envelope_1 = require("../envelope");
const code_error_analyzer_1 = require("../code_error_analyzer");
// 1) Memory extension: adds safe writes and optional onError callback, keeping base behavior intact
class ResilientMemoryBuffer extends envelope_1.MemoryBuffer {
    constructor(maxSize = 100, onError) {
        super(maxSize, onError);
    }
    // Non-throwing add that returns a boolean indicating success
    safeAddOutcome(envelopeJson) {
        try {
            super.addOutcome(envelopeJson);
            return true;
        }
        catch (err) {
            if (this.onError)
                this.onError(err);
            return false;
        }
    }
    // Override save/load to surface errors via callback rather than console only
    async save(filePath) {
        try {
            await super.save(filePath);
        }
        catch (err) {
            if (this.onError)
                this.onError(err);
        }
    }
    async load(filePath) {
        try {
            await super.load(filePath);
        }
        catch (err) {
            if (this.onError)
                this.onError(err);
        }
    }
}
exports.ResilientMemoryBuffer = ResilientMemoryBuffer;
// 2) Envelope extension: attaches continuity metadata and constraints consistently
class AdaptivePatchEnvelope extends envelope_1.AIPatchEnvelope {
    constructor() {
        super(...arguments);
        this.lastPatchId = null;
    }
    wrapPatch(patch) {
        var _a, _b, _c, _d;
        const envelope = super.wrapPatch(patch);
        // Attach continuity metadata and conservative default constraints if missing
        envelope.metadata = {
            previous_patch_id: this.lastPatchId,
            max_lines_changed: (_b = (_a = envelope === null || envelope === void 0 ? void 0 : envelope.metadata) === null || _a === void 0 ? void 0 : _a.max_lines_changed) !== null && _b !== void 0 ? _b : 25,
            disallow_keywords: (_d = (_c = envelope === null || envelope === void 0 ? void 0 : envelope.metadata) === null || _c === void 0 ? void 0 : _c.disallow_keywords) !== null && _d !== void 0 ? _d : [
                'database_schema_change',
                'authentication_bypass',
                'production_data_modification'
            ],
            ...envelope.metadata
        };
        this.lastPatchId = envelope.patchId;
        return envelope;
    }
}
exports.AdaptivePatchEnvelope = AdaptivePatchEnvelope;
// 3) Analyzer extension: inherits base heuristics and adds a small extra syntax check
class ExtendedCodeErrorAnalyzer extends code_error_analyzer_1.CodeErrorAnalyzer {
    // Add a light heuristic: line ending with a binary operator often implies a missing continuation token
    static analyzeCode(code, language = 'typescript') {
        const base = super.analyzeCode(code, language);
        const lines = base.rawLines || code.split('\n');
        const trailingOperator = /[+\-*/%&|^]$/;
        let added = 0;
        lines.forEach((line, idx) => {
            var _a, _b;
            const t = line.trim();
            if (t.length > 0 && trailingOperator.test(t)) {
                base.errors.push({
                    line: idx + 1,
                    type: (_b = (_a = base.ErrorType) === null || _a === void 0 ? void 0 : _a.SYNTAX) !== null && _b !== void 0 ? _b : 0,
                    severity: 'error',
                    message: 'Line ends with operator; likely missing operand or line continuation'
                });
                added++;
            }
        });
        if (added > 0) {
            base.errorCount += added;
            // Slightly reduce quality score proportional to added errors
            base.qualityScore = Math.max(0, base.qualityScore - added * 0.05);
        }
        return base;
    }
}
exports.ExtendedCodeErrorAnalyzer = ExtendedCodeErrorAnalyzer;
exports.default = {
    ResilientMemoryBuffer,
    AdaptivePatchEnvelope,
    ExtendedCodeErrorAnalyzer
};
/**
 * Extendable Hooks
 *
 * Small, discoverable place for optional hooks/extensions such as schema
 * validation (Zod) or custom enrichment of outgoing payloads. Keep these
 * local and optional so consumers can opt-in.
 *
 * Example usage (pseudo-code):
 *
 * // import { z } from 'zod';
 * // const CelebrationSchema = z.object({ type: z.string(), patch_id: z.string(), success_metrics: z.object({ final_confidence: z.number() }) });
 * // function validateCelebration(payload) { return CelebrationSchema.safeParse(payload); }
 *
 * To keep runtime small we provide a tiny local validator that checks only
 * the minimal shape and can be swapped for a Zod-based validator in
 * production. Consumers can override/replace this function via import.
 */
exports.Extensions = {
    // Minimal runtime validator - returns true if payload loosely matches expected shape
    validateSuccessCelebration(payload) {
        if (!payload || typeof payload !== 'object')
            return false;
        if (typeof payload.type !== 'string')
            return false;
        if (typeof payload.patch_id !== 'string')
            return false;
        if (!payload.success_metrics || typeof payload.success_metrics.final_confidence !== 'number')
            return false;
        return true;
    }
};
