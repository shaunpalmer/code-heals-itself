import { Observer, Subject } from './observer';

/**
 * Final Polish Observer - Handles the 95% confidence + zero errors scenario
 * Triggers linting and sends success feedback to the LLM with jitter
 */

export interface FinalPolishResult {
  shouldLint: boolean;
  finalCode?: string;
  successMessage?: string;
  confidence: number;
  errorCount: number;
}

export class FinalPolishObserver extends Observer {
  private readonly CONFIDENCE_THRESHOLD = 0.95; // 95% confidence threshold
  private readonly SUCCESS_MESSAGES = [
    "🎉 Excellent work! Code successfully healed with high confidence.",
    "✨ Perfect execution! All errors resolved with 95%+ confidence.",
    "🚀 Outstanding! Code is now error-free and highly optimized.",
    "🎯 Success achieved! High-confidence solution implemented.",
    "💯 Brilliant! Code healing completed with exceptional quality."
  ];

  constructor(private eslintRunner?: (code: string) => Promise<string>, private zodValidator?: (obj: unknown) => { ok: boolean; errors?: string[] }) {
    super();
  }

  update(subject: Subject, data: Record<string, any>): void {
    // Observer pattern implementation - logs the final polish event
    console.log(`[FinalPolishObserver] ${data.message || 'Final polish triggered'}`);
  }

  /**
   * Check if the patch qualifies for final polishing (95% confidence + zero errors)
   */
  shouldApplyFinalPolish(confidence: number, errorCount: number): boolean {
    return confidence >= this.CONFIDENCE_THRESHOLD && errorCount === 0;
  }

  /**
   * Apply final polish: lint the code and prepare success message
   */
  async applyFinalPolish(
    code: string,
    confidence: number,
    errorCount: number,
    patchId?: string
  ): Promise<FinalPolishResult> {

    if (!this.shouldApplyFinalPolish(confidence, errorCount)) {
      return {
        shouldLint: false,
        confidence,
        errorCount
      };
    }

    console.log(`🎯 Final polish triggered! Confidence: ${(confidence * 100).toFixed(1)}%, Errors: ${errorCount}`);

    let finalCode = code;

    // Apply ESLint if available
    if (this.eslintRunner) {
      try {
        finalCode = await this.eslintRunner(code);
        console.log("✨ Code successfully linted for final polish");
      } catch (error) {
        console.warn("⚠️ Linting failed, using original code:", error);
        finalCode = code;
      }
    }

    // Generate success message with slight randomization
    const successMessage = this.getRandomSuccessMessage();

    return {
      shouldLint: true,
      finalCode,
      successMessage,
      confidence,
      errorCount
    };
  }

  /**
   * Create success envelope for LLM communication with jitter
   */
  createSuccessEnvelope(
    patchId: string,
    confidence: number,
    finalCode: string,
    originalAttempts: number = 1,
    metadata?: Record<string, any>
  ): any {
    const jitterMs = Math.floor(Math.random() * 500) + 200; // 200-700ms jitter

    // Lightweight validator for metadata shape (small, local, no dependency)
    const extractCriticalHints = (md?: Record<string, any>) => {
      if (!md || typeof md !== 'object') return undefined;
      const hints: Record<string, any> = {};
      if (Array.isArray(md.missing_paths) && md.missing_paths.length > 0) {
        hints.missing_paths = md.missing_paths;
      }
      if (Array.isArray(md.risk_flags) && md.risk_flags.length > 0) {
        // Only surface high/medium level flags to keep payload small
        hints.risk_flags = md.risk_flags.filter((f: any) => ['high', 'medium'].includes(f.level ?? ''));
      }
      if (md.watchdog && md.watchdog.triggered) {
        hints.watchdog = { severity: md.watchdog.severity, reason: md.watchdog.reason };
      }
      return Object.keys(hints).length > 0 ? hints : undefined;
    };

    const criticalHints = extractCriticalHints(metadata);

    const payload: any = {
      type: 'success_celebration.v1',
      timestamp: new Date().toISOString(),
      patch_id: patchId,
      success_metrics: {
        final_confidence: confidence,
        error_count: 0,
        attempts_required: originalAttempts,
        quality_threshold_met: true
      },
      message: this.getRandomSuccessMessage(),
      celebration: {
        achievement: 'high_confidence_healing',
        threshold_exceeded: `${(confidence * 100).toFixed(1)}% confidence`,
        jitter_delay_ms: jitterMs
      },
      final_state: {
        code_polished: true,
        linting_applied: Boolean(this.eslintRunner),
        ready_for_deployment: true
      }
    };

    if (criticalHints) payload.hints = criticalHints;

    // If Stylelint metadata is present, attach a compact summary for quick scan
    const st = metadata?.stylelint;
    if (st && typeof st === 'object') {
      const warningCount = Array.isArray(st.warnings) ? st.warnings.length : 0;
      (payload as any).stylelint_summary = { warning_count: warningCount, errored: Boolean(st.errored) };
    }

    return payload;
  }

  /**
   * Send celebration message to LLM with jitter delay
   */
  async sendSuccessToLLM(
    chatAdapter: any,
    envelope: any,
    jitterMs?: number
  ): Promise<void> {
    const delay = jitterMs || envelope.celebration?.jitter_delay_ms || 300;

    // Apply jitter delay
    await new Promise(resolve => setTimeout(resolve, delay));

    // Optional Zod validation before sending
    if (this.zodValidator) {
      const validation = this.zodValidator(envelope);
      if (!validation.ok) {
        console.warn("⚠️ Zod validation failed for success envelope:", validation.errors);
        // Continue sending anyway - validation failure shouldn't block success celebration
      } else {
        console.log("✅ Success envelope validated with Zod");
      }
    }

    try {
      // Send the success message to the LLM. Spread the envelope first and then
      // override the type so that version suffixes (e.g. .v1) do not leak to the
      // receiver's expected canonical type.
      const celebrationPayload = {
        ...envelope,
        type: 'success_celebration',
        phase: 'celebration'
      };

      await chatAdapter.addMessage('tool', celebrationPayload);

      // Follow up with a brief acknowledgment request. Use optional chaining
      // for success_metrics so missing fields don't throw.
      const ackPayload = {
        type: 'success_acknowledgment_request',
        message: "The debugging process completed successfully. Please acknowledge this achievement.",
        confidence_achieved: envelope?.success_metrics?.final_confidence ?? null,
        timestamp: new Date().toISOString()
      };

      await chatAdapter.addMessage('system', ackPayload);

      console.log(`🎉 Success message sent to LLM with ${delay}ms jitter`);
    } catch (error) {
      // Keep the failure non-fatal and log details for telemetry/debugging
      console.warn("Failed to send success message to LLM:", error);
    }
  }

  private getRandomSuccessMessage(): string {
    const randomIndex = Math.floor(Math.random() * this.SUCCESS_MESSAGES.length);
    return this.SUCCESS_MESSAGES[randomIndex];
  }

  /**
   * Run ESLint on the provided code
   */
  async runESLint(code: string): Promise<string> {
    // This is a placeholder - in practice, you'd integrate with actual ESLint
    try {
      // Mock ESLint processing
      console.log("Running ESLint for final polish...");

      // Basic formatting improvements
      let polished = code
        .replace(/;\s*\n\s*\n/g, ';\n\n') // Normalize double line breaks
        .replace(/,\s*\n\s*\n/g, ',\n\n')  // Normalize comma line breaks
        .replace(/\s+$/gm, '')             // Remove trailing whitespace
        .replace(/\n{3,}/g, '\n\n');       // Limit consecutive line breaks

      return polished;
    } catch (error) {
      console.warn("ESLint processing failed:", error);
      return code;
    }
  }
}

/**
 * Factory function to create a pre-configured FinalPolishObserver
 */
export function createFinalPolishObserver(
  withESLint: boolean = true,
  zodValidator?: (obj: unknown) => { ok: boolean; errors?: string[] },
  overrideEslintRunner?: (code: string) => Promise<string>
): FinalPolishObserver {
  const defaultRunner = withESLint ?
    (code: string) => new FinalPolishObserver().runESLint(code) :
    undefined;

  const eslintRunner = overrideEslintRunner ?? defaultRunner;

  return new FinalPolishObserver(eslintRunner, zodValidator);
}