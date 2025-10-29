/**
 * TypeScript Healing Pipeline - Error Analysis Orchestrator
 * 
 * Mirrors PHP HealingPipeline.php
 * 
 * Flow: Preprocess → Classify → Enrich → Execute
 * 
 * Coordinates between:
 * - CodePreprocessor (sanitize, normalize)
 * - Rebanker (error taxonomy classification)
 * - Classifier (confidence scoring, hints)
 * - HealingEnvelope (envelope construction)
 */

import { Rebanker, ErrorClassification } from "./rebanker";
import { EnvelopeStorage } from "./envelope_storage";

interface HealingRequest {
  error_message: string;
  code?: string;
  context?: string;
  attempt_number?: number;
  previous_attempts?: any[];
}

interface ProcessedError {
  message: string;
  code: string;
  context: string;
  normalized: boolean;
}

interface EnrichedEnvelope {
  message: string;
  code: string;
  difficulty: string;
  confidence: number;
  hints: string[];
  error_type: string;
  cascade_risk: number;
  context: string;
  planner_directives: string[];
  attempt_number: number;
  created_at: string;
}

/**
 * Normalize and sanitize error messages
 */
class CodePreprocessor {
  /**
   * Clean error message
   */
  static normalize(message: string): string {
    if (!message) return "Unknown error";

    // Remove file paths
    let cleaned = message.replace(/[A-Za-z]:\\[^:]+:/g, "");
    cleaned = cleaned.replace(/\/[^:]+:/g, "");

    // Remove line numbers
    cleaned = cleaned.replace(/:\d+/g, "");

    // Remove common cruft
    cleaned = cleaned.replace(/in .*\(.*\)/g, "");
    cleaned = cleaned.trim();

    return cleaned;
  }

  /**
   * Extract context from code snippet
   */
  static extractContext(code: string): string {
    if (!code) return "";

    const lines = code.split("\n");
    return lines
      .slice(0, 5)
      .map((line) => line.trim())
      .join("\n");
  }

  /**
   * Process raw error into normalized form
   */
  static process(error: HealingRequest): ProcessedError {
    return {
      message: this.normalize(error.error_message),
      code: error.code || "",
      context: this.extractContext(error.code || error.context || ""),
      normalized: true,
    };
  }
}

/**
 * Main healing orchestrator
 */
class HealingPipeline {
  private rebanker: Rebanker;
  private storage: EnvelopeStorage;

  constructor(storage: EnvelopeStorage) {
    this.rebanker = new Rebanker();
    this.storage = storage;
  }

  /**
   * Full pipeline: analyze → classify → enrich → construct envelope
   */
  async analyze(request: HealingRequest): Promise<EnrichedEnvelope> {
    // Step 1: Preprocess
    const processed = CodePreprocessor.process(request);

    // Step 2: Classify (via Rebanker)
    const classification = this.rebanker.classifyError(
      processed.message,
      processed.code
    );

    // Step 3: Enrich with additional context
    const enriched = this.enrich(processed, classification, request);

    // Step 4: Return healing envelope
    return enriched;
  }

  /**
   * Just classify (lightweight)
   */
  classify(errorMessage: string, code?: string): ErrorClassification {
    const processed = CodePreprocessor.normalize(errorMessage);
    return this.rebanker.classifyError(processed, code);
  }

  /**
   * Enrich processed error with classification + context
   */
  private enrich(
    processed: ProcessedError,
    classification: ErrorClassification,
    request: HealingRequest
  ): EnrichedEnvelope {
    // Get recent history for pattern matching
    const recentContext = this.storage.getContext();

    // Map difficulty to confidence
    const difficultyToConfidence: { [key: string]: number } = {
      EASY: 0.85,
      MEDIUM: 0.65,
      HARD: 0.35,
    };

    const confidence = difficultyToConfidence[classification.difficulty] || 0.5;

    // Calculate cascade risk (harder = riskier to auto-fix)
    const cascadeRisk =
      classification.difficulty === "HARD"
        ? 0.7
        : classification.difficulty === "MEDIUM"
          ? 0.4
          : 0.1;

    // Generate planner directives
    const directives = this.generateDirectives(classification);

    return {
      message: processed.message,
      code: processed.code,
      difficulty: classification.difficulty,
      confidence,
      hints: classification.hints,
      error_type: classification.error_type,
      cascade_risk: cascadeRisk,
      context: recentContext,
      planner_directives: directives,
      attempt_number: request.attempt_number || 1,
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Generate directives for LLM planner
   */
  private generateDirectives(classification: ErrorClassification): string[] {
    const directives: string[] = [];

    // Add difficulty-based directives
    if (classification.difficulty === "EASY") {
      directives.push("AUTO_FIX: Try automatic resolution first");
      directives.push("VALIDATE: Run tests after fix");
    } else if (classification.difficulty === "MEDIUM") {
      directives.push("REVIEW: Request human review before apply");
      directives.push("ESCALATE: Monitor for regression");
    } else {
      directives.push("ESCALATE: Mark for manual investigation");
      directives.push("QUARANTINE: Disable auto-healing for this pattern");
    }

    // Add cascade warnings
    if (classification.cascade_risk && classification.cascade_risk > 0.5) {
      directives.push("CAUTION: High cascade risk - test thoroughly");
    }

    // Add hint-based directives
    if (
      classification.hints &&
      classification.hints.some((h) => h.includes("infinite"))
    ) {
      directives.push("TIMEOUT: Set strict timeout limits");
    }

    return directives;
  }

  /**
   * Execute healing (store envelope, return action recommendation)
   */
  async execute(envelope: EnrichedEnvelope): Promise<string> {
    // Store in history for learning
    const id = this.storage.store(envelope, "PENDING");

    // Return action recommendation
    if (envelope.confidence > 0.75) {
      return "PROMOTE";
    } else if (envelope.confidence > 0.5) {
      return "RETRY";
    } else {
      return "ESCALATE";
    }
  }

  /**
   * Full analysis → action loop
   */
  async healingCycle(request: HealingRequest): Promise<{
    action: string;
    envelope: EnrichedEnvelope;
  }> {
    const envelope = await this.analyze(request);
    const action = await this.execute(envelope);

    return { action, envelope };
  }

  /**
   * Get escalation history
   */
  getEscalationHistory(): any[] {
    return this.rebanker.getEscalationHistory();
  }

  /**
   * Get escalation summary
   */
  getEscalationSummary(): any {
    return this.rebanker.getEscalationSummary();
  }
}

export { HealingPipeline, CodePreprocessor };
export type { HealingRequest, ProcessedError, EnrichedEnvelope };
