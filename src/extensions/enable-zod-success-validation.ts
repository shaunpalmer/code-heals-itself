/*
  Optional Zod-based validator for FinalPolishObserver success envelopes.
  Usage (opt-in):
    import { validateSuccessEnvelope, buildZodSuccessEnvelope } from 'src/extensions/enable-zod-success-validation';
    const ok = validateSuccessEnvelope(envelope);

  Keep this file lightweight and optional. No runtime behavior changes unless imported and used.
*/
import { z } from 'zod';

// Schema shaped to match FinalPolishObserver.createSuccessEnvelope output
export const SuccessCelebrationSchema = z.object({
  type: z.string().optional(),
  timestamp: z.string().optional(),
  patch_id: z.string(),
  success_metrics: z.object({
    final_confidence: z.number().min(0).max(1),
    error_count: z.number().int().nonnegative(),
    attempts_required: z.number().int().positive(),
    quality_threshold_met: z.boolean().optional()
  }).optional(),
  message: z.string().optional(),
  celebration: z.object({
    achievement: z.string().optional(),
    threshold_exceeded: z.string().optional(),
    jitter_delay_ms: z.number().int().nonnegative().optional()
  }).optional(),
  final_state: z.object({
    code_polished: z.boolean().optional(),
    linting_applied: z.boolean().optional(),
    ready_for_deployment: z.boolean().optional()
  }).optional(),
  hints: z.any().optional(),
  // Allow unknown extra keys to keep forward compatibility
}).passthrough();

export function validateSuccessEnvelope(obj: unknown): { ok: boolean; errors?: string[] } {
  try {
    const parsed = SuccessCelebrationSchema.safeParse(obj);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`);
      return { ok: false, errors };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, errors: [String(e?.message ?? e)] };
  }
}

export function buildZodSuccessEnvelope(payload: z.infer<typeof SuccessCelebrationSchema>) {
  // Return a validated and type-safe envelope. Throws on failure.
  return SuccessCelebrationSchema.parse(payload);
}

export default {
  SuccessCelebrationSchema,
  validateSuccessEnvelope,
  buildZodSuccessEnvelope
};
