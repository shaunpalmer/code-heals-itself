// Inheritance-based extensions that build on existing tools without rewriting core logic
import { AIPatchEnvelope, PatchEnvelope, MemoryBuffer } from "../envelope";
import { CodeErrorAnalyzer } from "../code_error_analyzer";

// 1) Memory extension: adds safe writes and optional onError callback, keeping base behavior intact
export class ResilientMemoryBuffer extends MemoryBuffer {
  constructor(maxSize: number = 100, onError?: (err: unknown) => void) {
    super(maxSize, onError);
  }

  // Non-throwing add that returns a boolean indicating success
  safeAddOutcome(envelopeJson: string): boolean {
    try {
      super.addOutcome(envelopeJson);
      return true;
    } catch (err) {
      if (this.onError) this.onError(err);
      return false;
    }
  }

  // Override save/load to surface errors via callback rather than console only
  override async save(filePath?: string): Promise<void> {
    try {
      await super.save(filePath);
    } catch (err) {
      if (this.onError) this.onError(err);
    }
  }

  override async load(filePath?: string): Promise<void> {
    try {
      await super.load(filePath);
    } catch (err) {
      if (this.onError) this.onError(err);
    }
  }
}

// 2) Envelope extension: attaches continuity metadata and constraints consistently
export class AdaptivePatchEnvelope extends AIPatchEnvelope {
  private lastPatchId: string | null = null;

  wrapPatch(patch: Record<string, any>): PatchEnvelope {
    const envelope = super.wrapPatch(patch);
    // Attach continuity metadata and conservative default constraints if missing
    envelope.metadata = {
      previous_patch_id: this.lastPatchId,
      max_lines_changed: envelope?.metadata?.max_lines_changed ?? 25,
      disallow_keywords: envelope?.metadata?.disallow_keywords ?? [
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

// 3) Analyzer extension: inherits base heuristics and adds a small extra syntax check
export class ExtendedCodeErrorAnalyzer extends CodeErrorAnalyzer {
  // Add a light heuristic: line ending with a binary operator often implies a missing continuation token
  static override analyzeCode(code: string, language: string = 'typescript') {
    const base = super.analyzeCode(code, language);
    const lines = base.rawLines || code.split('\n');
    const trailingOperator = /[+\-*/%&|^]$/;
    let added = 0;
    lines.forEach((line, idx) => {
      const t = line.trim();
      if (t.length > 0 && trailingOperator.test(t)) {
        base.errors.push({
          line: idx + 1,
          type: (base as any).ErrorType?.SYNTAX ?? 0,
          severity: 'error',
          message: 'Line ends with operator; likely missing operand or line continuation'
        } as any);
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

export default {
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

export const Extensions = {
  // Minimal runtime validator - returns true if payload loosely matches expected shape
  validateSuccessCelebration(payload: any): boolean {
    if (!payload || typeof payload !== 'object') return false;
    if (typeof payload.type !== 'string') return false;
    if (typeof payload.patch_id !== 'string') return false;
    if (!payload.success_metrics || typeof payload.success_metrics.final_confidence !== 'number') return false;
    return true;
  }
};
