"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuccessCelebrationSchema = void 0;
exports.validateSuccessEnvelope = validateSuccessEnvelope;
exports.buildZodSuccessEnvelope = buildZodSuccessEnvelope;
/*
  Optional Zod-based validator for FinalPolishObserver success envelopes.
  Usage (opt-in):
    import { validateSuccessEnvelope, buildZodSuccessEnvelope } from 'src/extensions/enable-zod-success-validation';
    const ok = validateSuccessEnvelope(envelope);

  Keep this file lightweight and optional. No runtime behavior changes unless imported and used.
*/
const zod_1 = require("zod");
// Schema shaped to match FinalPolishObserver.createSuccessEnvelope output
exports.SuccessCelebrationSchema = zod_1.z.object({
    type: zod_1.z.string().optional(),
    timestamp: zod_1.z.string().optional(),
    patch_id: zod_1.z.string(),
    success_metrics: zod_1.z.object({
        final_confidence: zod_1.z.number().min(0).max(1),
        error_count: zod_1.z.number().int().nonnegative(),
        attempts_required: zod_1.z.number().int().positive(),
        quality_threshold_met: zod_1.z.boolean().optional()
    }).optional(),
    message: zod_1.z.string().optional(),
    celebration: zod_1.z.object({
        achievement: zod_1.z.string().optional(),
        threshold_exceeded: zod_1.z.string().optional(),
        jitter_delay_ms: zod_1.z.number().int().nonnegative().optional()
    }).optional(),
    final_state: zod_1.z.object({
        code_polished: zod_1.z.boolean().optional(),
        linting_applied: zod_1.z.boolean().optional(),
        ready_for_deployment: zod_1.z.boolean().optional()
    }).optional(),
    hints: zod_1.z.any().optional(),
    // Allow unknown extra keys to keep forward compatibility
}).passthrough();
function validateSuccessEnvelope(obj) {
    var _a;
    try {
        const parsed = exports.SuccessCelebrationSchema.safeParse(obj);
        if (!parsed.success) {
            const errors = parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
            return { ok: false, errors };
        }
        return { ok: true };
    }
    catch (e) {
        return { ok: false, errors: [String((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e)] };
    }
}
function buildZodSuccessEnvelope(payload) {
    // Return a validated and type-safe envelope. Throws on failure.
    return exports.SuccessCelebrationSchema.parse(payload);
}
exports.default = {
    SuccessCelebrationSchema: exports.SuccessCelebrationSchema,
    validateSuccessEnvelope,
    buildZodSuccessEnvelope
};
