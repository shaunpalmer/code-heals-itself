/**
 * ErrorSignature - Language-agnostic error fingerprinting
 * 
 * Normalizes JavaScript/TypeScript errors into consistent signatures
 * to prevent duplicate retry attempts on identical failures.
 */

export interface IErrorSignature {
  signature: string;
  type: string;
  message: string;
  hash: string;
}

export class ErrorSignature {
  /**
   * Normalize a JavaScript Error into a consistent signature
   * @param err - The Error object to normalize
   * @returns Normalized error signature string
   */
  static normalize(err: Error | any): string {
    const type = err?.name || err?.constructor?.name || "UnknownError";
    const message = (err?.message || String(err) || "").split("\n")[0].trim();

    // Remove file paths and line numbers to focus on the error content
    const cleanMessage = message
      .replace(/\s+at\s+.*:\d+:\d+/g, '') // Remove "at file:line:col"
      .replace(/\s+\(.*:\d+:\d+\)/g, '') // Remove "(file:line:col)"
      .replace(/\s+in\s+\/.*$/g, '') // Remove file paths
      .trim();

    return `${type}:${cleanMessage}`;
  }

  /**
   * Create a detailed error signature object
   * @param err - The Error object to analyze
   * @returns Detailed error signature with metadata
   */
  static create(err: Error | any): IErrorSignature {
    const type = err?.name || err?.constructor?.name || "UnknownError";
    const message = (err?.message || String(err) || "").split("\n")[0].trim();
    const signature = this.normalize(err);

    // Simple hash for deduplication (not cryptographic)
    const hash = this.simpleHash(signature);

    return {
      signature,
      type,
      message,
      hash
    };
  }

  /**
   * Check if two errors have the same signature
   * @param err1 - First error
   * @param err2 - Second error
   * @returns True if errors have identical signatures
   */
  static areSame(err1: Error | any, err2: Error | any): boolean {
    return this.normalize(err1) === this.normalize(err2);
  }

  /**
   * Simple string hash function for error deduplication
   * @param str - String to hash
   * @returns Simple hash value
   */
  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

/**
 * Tracks seen error signatures to prevent duplicate retries
 */
export class ErrorTracker {
  private seenErrors = new Set<string>();
  private errorHistory: IErrorSignature[] = [];

  /**
   * Check if an error has been seen before
   * @param err - Error to check
   * @returns True if this error signature was already seen
   */
  hasSeen(err: Error | any): boolean {
    const signature = ErrorSignature.normalize(err);
    return this.seenErrors.has(signature);
  }

  /**
   * Record a new error occurrence
   * @param err - Error to record
   * @returns The error signature that was recorded
   */
  record(err: Error | any): IErrorSignature {
    const errorSig = ErrorSignature.create(err);
    this.seenErrors.add(errorSig.signature);
    this.errorHistory.push(errorSig);
    return errorSig;
  }

  /**
   * Get all unique error signatures seen so far
   * @returns Array of unique error signatures
   */
  getUniqueErrors(): IErrorSignature[] {
    const unique = new Map<string, IErrorSignature>();
    for (const err of this.errorHistory) {
      if (!unique.has(err.signature)) {
        unique.set(err.signature, err);
      }
    }
    return Array.from(unique.values());
  }

  /**
   * Clear all tracked errors
   */
  clear(): void {
    this.seenErrors.clear();
    this.errorHistory.length = 0;
  }

  /**
   * Get count of how many times each error was seen
   * @returns Map of error signature to count
   */
  getErrorCounts(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const err of this.errorHistory) {
      counts.set(err.signature, (counts.get(err.signature) || 0) + 1);
    }
    return counts;
  }
}