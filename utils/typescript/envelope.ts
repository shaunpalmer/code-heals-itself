class PatchEnvelope {
  public success: boolean;
  public flaggedForDeveloper: boolean;
  public developerMessage: string;
  public confidenceComponents: Record<string, number>;
  public breakerState: string;
  public cascadeDepth: number;
  public resourceUsage: Record<string, any>;
  public trendMetadata: {
    errorsDetected: number;
    errorsResolved: number;
    errorTrend: "improving" | "plateauing" | "worsening" | "unknown";
    codeQualityScore?: number;
    improvementVelocity?: number;
    stagnationRisk?: number;
  };

  constructor(
    public patchId: string,
    public patchData: Record<string, any>,
    public metadata: Record<string, any> = {},
    public attempts: Record<string, any>[] = [],
    confidenceComponents: Record<string, number> = {},
    breakerState: string = "CLOSED",
    cascadeDepth: number = 0,
    resourceUsage: Record<string, any> = {}
  ) {
    this.metadata = {
      created_at: new Date().toISOString(),
      language: "typescript",
      ai_generated: true,
      ...metadata
    };
    this.attempts = attempts;
    this.confidenceComponents = confidenceComponents;
    this.breakerState = breakerState;
    this.cascadeDepth = cascadeDepth;
    this.resourceUsage = resourceUsage;
    this.success = false;
    this.flaggedForDeveloper = false;
    this.developerMessage = "";
    this.trendMetadata = {
      errorsDetected: 0,
      errorsResolved: 0,
      errorTrend: "unknown"
    };
  }

  toJson(): string {
    return JSON.stringify({
      patch_id: this.patchId,
      patch_data: this.patchData,
      metadata: this.metadata,
      attempts: this.attempts,
      confidenceComponents: this.confidenceComponents,
      breakerState: this.breakerState,
      cascadeDepth: this.cascadeDepth,
      resourceUsage: this.resourceUsage,
      trendMetadata: this.trendMetadata,
      success: this.success,
      flagged_for_developer: this.flaggedForDeveloper,
      developer_message: this.developerMessage,
      timestamp: new Date().toISOString()
    }, null, 2);
  }

  static fromJson(jsonStr: string): PatchEnvelope {
    const data = JSON.parse(jsonStr);
    const envelope = new PatchEnvelope(
      data.patch_id,
      data.patch_data,
      data.metadata,
      data.attempts,
      data.confidenceComponents || {},
      data.breakerState || "CLOSED",
      data.cascadeDepth || 0,
      data.resourceUsage || {}
    );
    envelope.success = data.success || false;
    envelope.flaggedForDeveloper = data.flagged_for_developer || false;
    envelope.developerMessage = data.developer_message || "";
    return envelope;
  }
}

abstract class PatchWrapper {
  abstract wrapPatch(patch: Record<string, any>): PatchEnvelope;
  abstract unwrapAndExecute(envelope: PatchEnvelope): Record<string, any>;
}

class AIPatchEnvelope extends PatchWrapper {
  private envelopes: Map<string, PatchEnvelope>;

  constructor() {
    super();
    this.envelopes = new Map();
  }

  wrapPatch(patch: Record<string, any>): PatchEnvelope {
    const patchId = `patch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const envelope = new PatchEnvelope(patchId, patch);

    this.envelopes.set(patchId, envelope);
    return envelope;
  }

  unwrapAndExecute(envelope: PatchEnvelope): Record<string, any> {
    // Check if this is a "big error" that should be flagged
    if (this.isBigError(envelope.patchData)) {
      envelope.flaggedForDeveloper = true;
      envelope.developerMessage = this.generateDeveloperMessage(envelope.patchData);
      return {
        success: false,
        flagged: true,
        message: "Patch flagged for developer review - potential critical issue",
        envelope: envelope.toJson()
      };
    }

    // Simulate successful execution
    const result = {
      success: true,
      patch_id: envelope.patchId,
      execution_details: "Patch executed successfully",
      envelope: envelope.toJson()
    };

    // Update envelope
    envelope.success = true;
    envelope.attempts.push({
      timestamp: new Date().toISOString(),
      result: "success",
      details: result.execution_details
    });

    return result;
  }

  private isBigError(patchData: Record<string, any>): boolean {
    const errorIndicators = [
      patchData.database_schema_change,
      patchData.authentication_bypass,
      patchData.critical_security_vulnerability,
      patchData.production_data_modification,
      JSON.stringify(patchData).length > 1000 // Large/complex patches
    ];
    return errorIndicators.some(indicator => indicator);
  }

  private generateDeveloperMessage(patchData: Record<string, any>): string {
    if (patchData.database_schema_change) {
      return "Database schema modification detected. Please review for data integrity and migration implications.";
    } else if (patchData.authentication_bypass) {
      return "Authentication-related changes detected. Critical security review required.";
    } else if (patchData.production_data_modification) {
      return "Production data modification detected. Please verify backup and rollback procedures.";
    } else {
      return "Complex patch detected requiring manual review before deployment.";
    }
  }
}

// Pluggable memory store interface for persistence and retrieval
interface MemoryStore {
  addOutcome(envelopeJson: string): void;
  getSimilarOutcomes(patchData: Record<string, any>): Array<{ envelope: string; timestamp: string }>;
  save(filePath?: string): Promise<void>;
  load(filePath?: string): Promise<void>;
}

class MemoryBuffer implements MemoryStore {
  private buffer: Array<{ envelope: string, timestamp: string }>;
  private maxSize: number;
  private onError?: (err: unknown) => void;

  constructor(maxSize: number = 100, onError?: (err: unknown) => void) {
    this.buffer = [];
    this.maxSize = maxSize;
    this.onError = onError;
  }

  addOutcome(envelopeJson: string): void {
    try {
      this.buffer.push({
        envelope: envelopeJson,
        timestamp: new Date().toISOString()
      });
      if (this.buffer.length > this.maxSize) {
        this.buffer.shift();
      }
    } catch (err) {
      if (this.onError) this.onError(err);
      else throw err;
    }
  }

  getSimilarOutcomes(patchData: Record<string, any>): Array<{ envelope: string, timestamp: string }> {
    const similar: Array<{ envelope: string, timestamp: string }> = [];
    for (const item of this.buffer) {
      const envelope = PatchEnvelope.fromJson(item.envelope);
      if (this.isSimilar(envelope.patchData, patchData)) {
        similar.push(item);
      }
    }
    return similar.slice(-5);
  }

  private isSimilar(pastPatch: Record<string, any>, currentPatch: Record<string, any>): boolean {
    if (!pastPatch || !currentPatch) return false;
    const pastStr = (JSON.stringify(pastPatch) || '').toLowerCase();
    const currentStr = (JSON.stringify(currentPatch) || '').toLowerCase();
    const pastWords = pastStr.split(/[^a-zA-Z0-9]+/).filter(word => word.length > 0);
    const currentWords = currentStr.split(/[^a-zA-Z0-9]+/).filter(word => word.length > 0);
    if (pastWords.length === 0 || currentWords.length === 0) return false;
    const set = new Set(currentWords);
    let matches = 0;
    for (const w of pastWords) {
      if (set.has(w)) { matches++; if (matches >= 1) break; }
    }
    return matches >= 1;
  }

  async save(filePath?: string): Promise<void> {
    if (!filePath) return;
    const fs = await import('fs/promises');
    const path = await import('path');
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const data = { buffer: this.buffer, maxSize: this.maxSize, saved_at: new Date().toISOString() };
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (err: any) {
      if (this.onError) this.onError(err);
      else console.error('Memory save failed:', err?.message ?? String(err));
    }
  }

  async load(filePath?: string): Promise<void> {
    if (!filePath) return;
    const fs = await import('fs/promises');
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      if (data.buffer && Array.isArray(data.buffer)) {
        this.buffer = data.buffer;
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        if (this.onError) this.onError(err);
        else console.error('Memory load failed:', err?.message ?? String(err));
      }
    }
  }
}

// Simple transmission record for telemetry
interface Transmission {
  patch_id: string;
  language: string;
  error_classification: {
    error_type: 'syntax' | 'logic' | 'runtime' | 'performance' | 'security';
    severity: 'critical' | 'high' | 'medium' | 'low';
  };
  confidence_scoring: {
    overall_confidence: number;
  };
  timestamp: string;
  error_signature?: {
    signature_hash: string;
    normalized_error: string;
  };
  original_error?: {
    message: string;
    stack_trace?: string;
  };
}

export { PatchEnvelope, PatchWrapper, AIPatchEnvelope, MemoryBuffer, Transmission, MemoryStore };

// A resilient, bounded memory buffer with TTL eviction and safe writes
class ResilientMemoryBuffer implements MemoryStore {
  private buffer: Array<{ envelope: string; timestamp: string }> = [];
  private evictions = 0;
  private failures = 0;
  private lastError: string | null = null;

  constructor(
    private maxSize: number = 100,
    private onError?: (err: unknown, payload?: string) => void,
    private ttlMs?: number
  ) { }

  // Backward-compatible addOutcome (throws if no onError provided)
  addOutcome(envelopeJson: string): void {
    const ok = this.safeAddOutcome(envelopeJson);
    if (!ok && !this.onError && this.lastError) {
      throw new Error(this.lastError);
    }
  }

  // Safe write: never throws; returns success boolean
  safeAddOutcome(envelopeJson: string): boolean {
    try {
      this.pruneTTL();
      this.buffer.push({ envelope: envelopeJson, timestamp: new Date().toISOString() });
      this.pruneSize();
      return true;
    } catch (err) {
      this.failures += 1;
      this.lastError = (err as any)?.message ?? String(err);
      try { this.onError?.(err, envelopeJson); } catch { /* swallow onError failures */ }
      return false;
    }
  }

  getSimilarOutcomes(patchData: Record<string, any>): Array<{ envelope: string; timestamp: string }> {
    this.pruneTTL();
    const similar: Array<{ envelope: string; timestamp: string }> = [];
    for (const item of this.buffer) {
      try {
        const envelope = PatchEnvelope.fromJson(item.envelope);
        if (this.isSimilar(envelope.patchData, patchData)) {
          similar.push(item);
        }
      } catch { /* skip malformed entries */ }
    }
    return similar.slice(-5);
  }

  async save(filePath?: string): Promise<void> {
    if (!filePath) return;
    const fs = await import('fs/promises');
    const path = await import('path');
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const data = {
        buffer: this.buffer,
        maxSize: this.maxSize,
        ttlMs: this.ttlMs ?? null,
        evictions: this.evictions,
        failures: this.failures,
        saved_at: new Date().toISOString()
      };
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (err: any) {
      this.failures += 1;
      this.lastError = err?.message ?? String(err);
      if (this.onError) this.onError(err);
      else console.error('Memory save failed:', this.lastError);
    }
  }

  async load(filePath?: string): Promise<void> {
    if (!filePath) return;
    const fs = await import('fs/promises');
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      if (data.buffer && Array.isArray(data.buffer)) this.buffer = data.buffer;
      if (typeof data.maxSize === 'number') this.maxSize = data.maxSize;
      if (typeof data.ttlMs === 'number') this.ttlMs = data.ttlMs;
      // Do not load evictions/failures counters from disk; keep runtime-only
      this.pruneTTL();
      this.pruneSize();
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        this.failures += 1;
        this.lastError = err?.message ?? String(err);
        if (this.onError) this.onError(err);
        else console.error('Memory load failed:', this.lastError);
      }
    }
  }

  // Lightweight metrics for observability
  getMetrics(): { size: number; maxSize: number; evictions: number; failures: number; lastError: string | null } {
    return { size: this.buffer.length, maxSize: this.maxSize, evictions: this.evictions, failures: this.failures, lastError: this.lastError };
  }

  private pruneSize(): void {
    while (this.buffer.length > this.maxSize) {
      this.buffer.shift();
      this.evictions += 1;
    }
  }

  private pruneTTL(): void {
    if (!this.ttlMs) return;
    const cutoff = Date.now() - this.ttlMs;
    const before = this.buffer.length;
    this.buffer = this.buffer.filter(item => {
      const ts = Date.parse(item.timestamp);
      return isFinite(ts) ? ts >= cutoff : true;
    });
    this.evictions += Math.max(0, before - this.buffer.length);
  }

  private isSimilar(pastPatch: Record<string, any>, currentPatch: Record<string, any>): boolean {
    if (!pastPatch || !currentPatch) return false;
    const pastStr = (JSON.stringify(pastPatch) || '').toLowerCase();
    const currentStr = (JSON.stringify(currentPatch) || '').toLowerCase();
    const pastWords = pastStr.split(/[^a-zA-Z0-9]+/).filter(w => w.length > 0);
    const currentWords = new Set(currentStr.split(/[^a-zA-Z0-9]+/).filter(w => w.length > 0));
    for (const w of pastWords) { if (currentWords.has(w)) return true; }
    return false;
  }
}

export { ResilientMemoryBuffer };