/**
 * TypeScript Rebanker - Error Classification & Taxonomy
 * 
 * Mirrors PHP Rebanker.php
 * 
 * Classifies errors into difficulty tiers:
 * - EASY: Obvious fix, low risk (syntax, imports, typos)
 * - MEDIUM: Requires context understanding, moderate risk
 * - HARD: Deep reasoning needed, high risk (race conditions, architecture)
 * 
 * Integrates with EscalationObserver for difficulty + velocity tracking
 */

interface ErrorClassification {
  difficulty: "EASY" | "MEDIUM" | "HARD";
  error_type: string;
  confidence: number;
  hints: string[];
  cascade_risk: number;
  reason: string;
}

interface EscalationLevel {
  level: number;
  description: string;
  actions: string[];
}

/**
 * Escalation observer watches error patterns
 */
class EscalationObserver {
  private difficulty_scores: number[] = [];
  private velocity_samples: number[] = [];
  private max_samples: number = 100;

  /**
   * Record a difficulty observation
   */
  recordDifficulty(difficulty: string): void {
    const scores: { [key: string]: number } = {
      EASY: 1,
      MEDIUM: 2,
      HARD: 3,
    };

    const score = scores[difficulty] || 1;
    this.difficulty_scores.push(score);

    if (this.difficulty_scores.length > this.max_samples) {
      this.difficulty_scores.shift();
    }
  }

  /**
   * Record a velocity observation (errors per minute)
   */
  recordVelocity(velocity: number): void {
    this.velocity_samples.push(velocity);

    if (this.velocity_samples.length > this.max_samples) {
      this.velocity_samples.shift();
    }
  }

  /**
   * Get average difficulty (1-3 scale)
   */
  getAverageDifficulty(): number {
    if (this.difficulty_scores.length === 0) return 1;
    const sum = this.difficulty_scores.reduce((a, b) => a + b, 0);
    return sum / this.difficulty_scores.length;
  }

  /**
   * Get current velocity (errors per minute)
   */
  getVelocity(): number {
    if (this.velocity_samples.length === 0) return 0;
    const sum = this.velocity_samples.reduce((a, b) => a + b, 0);
    return sum / this.velocity_samples.length;
  }

  /**
   * Detect escalation level
   */
  getEscalationLevel(): EscalationLevel {
    const difficulty = this.getAverageDifficulty();
    const velocity = this.getVelocity();

    // Combined escalation score
    const score = difficulty * velocity;

    if (score < 1.0) {
      return {
        level: 1,
        description: "NORMAL: Steady state",
        actions: ["AUTO_FIX", "MONITOR"],
      };
    } else if (score < 3.0) {
      return {
        level: 2,
        description: "ELEVATED: Difficulty or velocity increasing",
        actions: ["REVIEW", "ESCALATE"],
      };
    } else {
      return {
        level: 3,
        description: "CRITICAL: High difficulty AND high velocity",
        actions: ["STOP", "MANUAL_REVIEW", "ESCALATE"],
      };
    }
  }

  /**
   * Clear history
   */
  clear(): void {
    this.difficulty_scores = [];
    this.velocity_samples = [];
  }
}

/**
 * Main error classifier
 */
class Rebanker {
  private escalation: EscalationObserver;
  private history: ErrorClassification[] = [];

  constructor() {
    this.escalation = new EscalationObserver();
  }

  /**
   * Classify error based on taxonomy
   */
  classifyError(
    errorMessage: string,
    code?: string
  ): ErrorClassification {
    const lower = errorMessage.toLowerCase();

    // EASY errors (syntax, typos, imports)
    if (this.isEasyError(lower, code)) {
      const classification: ErrorClassification = {
        difficulty: "EASY",
        error_type: this.getEasyErrorType(lower),
        confidence: 0.85,
        hints: this.getEasyHints(lower),
        cascade_risk: 0.1,
        reason: "Syntax or import error - straightforward fix",
      };

      this.escalation.recordDifficulty("EASY");
      this.history.push(classification);
      return classification;
    }

    // HARD errors (logic, architecture, race conditions)
    if (this.isHardError(lower, code)) {
      const classification: ErrorClassification = {
        difficulty: "HARD",
        error_type: this.getHardErrorType(lower),
        confidence: 0.35,
        hints: this.getHardHints(lower),
        cascade_risk: 0.7,
        reason: "Complex error requiring deep analysis",
      };

      this.escalation.recordDifficulty("HARD");
      this.history.push(classification);
      return classification;
    }

    // MEDIUM errors (default)
    const classification: ErrorClassification = {
      difficulty: "MEDIUM",
      error_type: this.getMediumErrorType(lower),
      confidence: 0.65,
      hints: this.getMediumHints(lower),
      cascade_risk: 0.4,
      reason: "Contextual error requiring moderate analysis",
    };

    this.escalation.recordDifficulty("MEDIUM");
    this.history.push(classification);
    return classification;
  }

  private isEasyError(lower: string, code?: string): boolean {
    const easyPatterns = [
      // Syntax errors
      /syntax error|parse error|unexpected token|unexpected identifier|invalid syntax/i,
      /unexpected end of file|premature end of file/i,
      /missing semicolon|missing colon|missing bracket|missing brace|missing parenthesis/i,

      // Import/require errors
      /cannot find module|no such file or directory|module not found/i,
      /undefined variable|undefined function|undefined method/i,
      /undefined reference|not declared|no matching function|no matching method/i,

      // Type errors
      /type error|is not a function|is not a method/i,
      /cannot read property|cannot assign to read-only|const reassignment/i,

      // Simple string/array issues
      /string index out of range|list index out of range|array index out of bounds/i,
      /length property not found/i,

      // Common typos
      /console\.log|debugger|alert\(|print\(/i,
    ];

    return easyPatterns.some((pattern) => pattern.test(lower));
  }

  private isHardError(lower: string, code?: string): boolean {
    const hardPatterns = [
      // Concurrency issues
      /race condition|deadlock|mutex|semaphore|critical section/i,
      /concurrent|thread safety|atomic operation|memory barrier/i,

      // Memory/pointer issues
      /segmentation fault|access violation|null pointer|buffer overflow/i,
      /memory leak|dangling pointer|use after free/i,

      // Complex logic
      /infinite loop|infinite recursion|stack overflow|too deep|recursive|recursion/i,
      /circular dependency|cyclic import|circular reference/i,

      // Timing/async issues
      /timeout|async|await|promise|callback|event|listener/i,
      /race condition|timing|time-dependent|timing window/i,

      // Architecture issues
      /architecture|design pattern|refactor|restructure/i,
      /microservices|distributed|scalability|performance/i,
    ];

    return hardPatterns.some((pattern) => pattern.test(lower));
  }

  private getEasyErrorType(lower: string): string {
    if (/syntax|parse|unexpected|token/i.test(lower)) return "SYNTAX";
    if (/cannot find|module|import|require/i.test(lower)) return "IMPORT";
    if (/undefined|not declared/i.test(lower)) return "UNDEFINED";
    if (/type error|is not a/i.test(lower)) return "TYPE";
    if (/index out|out of range/i.test(lower)) return "INDEXING";
    return "SYNTAX";
  }

  private getHardErrorType(lower: string): string {
    if (/race|deadlock|mutex|thread/i.test(lower)) return "CONCURRENCY";
    if (/segmentation|access violation|pointer|buffer/i.test(lower))
      return "MEMORY";
    if (/infinite|recursion|stack overflow/i.test(lower)) return "RECURSION";
    if (/timeout|async|promise/i.test(lower)) return "ASYNC";
    if (/circular/i.test(lower)) return "CIRCULAR_DEPENDENCY";
    return "LOGIC";
  }

  private getMediumErrorType(lower: string): string {
    if (/null|nil|none|undefined/i.test(lower)) return "NULL_CHECK";
    if (/value error|key error/i.test(lower)) return "VALUE_ERROR";
    if (/permission|access|denied|unauthorized/i.test(lower))
      return "PERMISSION";
    if (/connection|network|timeout|offline/i.test(lower)) return "NETWORK";
    if (/database|query|sql/i.test(lower)) return "DATABASE";
    if (/file|i\/o|read|write/i.test(lower)) return "IO";
    return "CONTEXTUAL";
  }

  private getEasyHints(lower: string): string[] {
    const hints: string[] = [];

    if (/syntax|parse/i.test(lower)) {
      hints.push("Check for missing punctuation (semicolons, brackets, braces)");
      hints.push("Review recent code changes for typos");
    }

    if (/import|require|module/i.test(lower)) {
      hints.push("Verify file path and extension");
      hints.push("Check if package is installed");
      hints.push("Review import statement syntax");
    }

    if (/undefined|not declared/i.test(lower)) {
      hints.push("Define the variable or function");
      hints.push("Check for typos in variable name");
      hints.push("Verify scope (global vs local)");
    }

    if (/type error/i.test(lower)) {
      hints.push("Check expected type vs actual type");
      hints.push("Add explicit type conversion");
    }

    if (hints.length === 0) {
      hints.push("Straightforward fix - check syntax and imports");
    }

    return hints;
  }

  private getHardHints(lower: string): string[] {
    const hints: string[] = [];

    if (/race|concurrent/i.test(lower)) {
      hints.push("Add synchronization primitives (locks, mutexes)");
      hints.push("Review critical sections");
      hints.push("Consider atomic operations");
    }

    if (/memory|pointer|buffer|segmentation/i.test(lower)) {
      hints.push("Review memory allocation and deallocation");
      hints.push("Use memory profiler to identify leaks");
      hints.push("Add bounds checking");
    }

    if (/infinite|recursion|stack/i.test(lower)) {
      hints.push("Add termination condition");
      hints.push("Check recursion depth limits");
      hints.push("Consider iterative approach");
    }

    if (/circular/i.test(lower)) {
      hints.push("Break circular dependency");
      hints.push("Consider dependency injection");
      hints.push("Review module structure");
    }

    if (hints.length === 0) {
      hints.push("Complex error - deep analysis required");
      hints.push("Request human code review");
      hints.push("Add logging and monitoring");
    }

    return hints;
  }

  private getMediumHints(lower: string): string[] {
    const hints: string[] = [];

    if (/null|nil|none|undefined/i.test(lower)) {
      hints.push("Add null/nil checks before use");
      hints.push("Use safe navigation operators");
      hints.push("Consider default values");
    }

    if (/database|query|sql/i.test(lower)) {
      hints.push("Verify SQL syntax");
      hints.push("Check database connection");
      hints.push("Review query parameters");
    }

    if (/network|connection|timeout/i.test(lower)) {
      hints.push("Add retry logic with exponential backoff");
      hints.push("Increase timeout duration");
      hints.push("Check network connectivity");
    }

    if (/file|io|read|write/i.test(lower)) {
      hints.push("Verify file path and permissions");
      hints.push("Add error handling for IO operations");
      hints.push("Check disk space");
    }

    if (hints.length === 0) {
      hints.push("Review error context");
      hints.push("Add logging for debugging");
    }

    return hints;
  }

  /**
   * Get escalation history
   */
  getEscalationHistory(): any[] {
    return this.history.slice(-20); // Last 20
  }

  /**
   * Get escalation summary
   */
  getEscalationSummary(): any {
    const easy = this.history.filter(
      (h) => h.difficulty === "EASY"
    ).length;
    const medium = this.history.filter(
      (h) => h.difficulty === "MEDIUM"
    ).length;
    const hard = this.history.filter(
      (h) => h.difficulty === "HARD"
    ).length;
    const total = easy + medium + hard;

    return {
      total_classified: total,
      easy_count: easy,
      medium_count: medium,
      hard_count: hard,
      easy_percent: total > 0 ? ((easy / total) * 100).toFixed(1) : 0,
      medium_percent: total > 0 ? ((medium / total) * 100).toFixed(1) : 0,
      hard_percent: total > 0 ? ((hard / total) * 100).toFixed(1) : 0,
      average_difficulty: this.escalation.getAverageDifficulty().toFixed(2),
      current_velocity: this.escalation.getVelocity().toFixed(2),
      escalation_level: this.escalation.getEscalationLevel(),
    };
  }

  /**
   * Clear history
   */
  clear(): void {
    this.history = [];
    this.escalation.clear();
  }
}

export { Rebanker, EscalationObserver };
export type { ErrorClassification, EscalationLevel };
