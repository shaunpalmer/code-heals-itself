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

  /**
   * TODO(API): Expose read-only GET /api/envelopes/:id → PatchEnvelopeJson
   * and optionally GET /api/envelopes (latest N) for agent toolkits.
   */

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

    // Update envelope using helper functions (non-invasive enhancement)
    try {
      // Lazy import (helpers are exported from same module; using require to avoid circular issues if bundler rewrites)
      const {
        appendAttempt,
        markSuccess,
        setEnvelopeTimestamp,
        setEnvelopeHash
      } = require('./envelope');
      const crypto = require('crypto');
      markSuccess(envelope as any, true);
      appendAttempt(envelope as any, {
        success: true,
        note: result.execution_details,
        breakerState: 'CLOSED',
        failureCount: 0
      });
      setEnvelopeTimestamp(envelope as any);
      const sha256Hex = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
      setEnvelopeHash(envelope as any, sha256Hex);
    } catch { /* best-effort; do not break legacy flow */ }

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
  protected onError?: (err: unknown) => void;

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

// ---------------- Envelope Helper Types & Functions (Non-invasive additions) ----------------
// These helpers are additive. They do NOT modify existing class logic. They shape/annotate
// envelope objects for schema-aligned fields: attempts, confidenceComponents, trendMetadata,
// breakerState, cascadeDepth, resourceUsage, flagged_for_developer/developerMessage, success,
// timestamp, envelopeHash.

type BreakerState = "OPEN" | "CLOSED" | "HALF_OPEN";

// Schema-aligned attempt record (distinct from legacy attempts entries in PatchEnvelope)
interface AttemptRecord {
  ts: number;                // epoch seconds
  success: boolean;
  note?: string;
  breaker?: { state: BreakerState; failure_count?: number };
}

interface ConfidenceComponents {
  syntax?: number; // 0..1
  logic?: number;  // 0..1
  risk?: number;   // 0..1
}

interface TrendMetadata {
  errorsDetected: number;
  errorsResolved: number;
  errorTrend: "improving" | "plateauing" | "worsening" | "unknown";
  codeQualityScore?: number;       // 0..1
  improvementVelocity?: number;    // 0..1 (per schema constraint)
  stagnationRisk?: number;         // 0..1
}

interface ResourceUsageSnapshot {
  cpuPercent?: number;        // 0..100
  memoryMB?: number;          // >=0
  executionTimeMs?: number;   // >=0
  sideEffects?: string[];
}

// Generic envelope shape (augmenting existing object). We keep it loose to avoid breaking current class.
interface MutableEnvelope {
  attempts?: AttemptRecord[] | any[]; // tolerate legacy shape
  confidenceComponents?: ConfidenceComponents | Record<string, any>;
  trendMetadata?: TrendMetadata | Record<string, any>;
  breakerState?: BreakerState | string;
  cascadeDepth?: number;
  resourceUsage?: ResourceUsageSnapshot | Record<string, any>;
  flagged_for_developer?: boolean;            // schema snake_case
  developer_message?: string;                 // schema snake_case
  counters?: {
    totalAttempts?: number;
    syntaxAttempts?: number;
    logicAttempts?: number;
    errorsResolvedTotal?: number;
  };
  timeline?: Array<{
    attempt: number;
    ts: string; // ISO
    errorsDetected?: number;
    errorsResolved?: number;
    overallConfidence?: number;
    breakerState?: BreakerState | string;
    action?: string;
  }>;
  developer_flag_reason?: string; // optional structured reason code (not yet in schema)
  // Legacy internal camelCase retained for compatibility
  flaggedForDeveloper?: boolean;
  developerMessage?: string;
  success?: boolean;
  timestamp?: string;
  envelopeHash?: string;
  [k: string]: any; // allow any additional properties (schema allows additionalProperties at object level for some nested objects)
}

// Utility: clamp 0..1
const clamp01 = (n: number | undefined): number | undefined =>
  typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : undefined;

const nowIso = (): string => new Date().toISOString();
const nowEpochSec = (): number => Math.floor(Date.now() / 1000);

// 1) Append an attempt (schema-aligned) — does not mutate legacy attempt objects already present.
function appendAttempt(env: MutableEnvelope, payload: {
  ts?: number;
  success: boolean;
  note?: string;
  breakerState?: BreakerState;
  failureCount?: number;
}): MutableEnvelope {
  if (!Array.isArray(env.attempts)) env.attempts = [];
  const attempt: AttemptRecord = {
    ts: payload.ts ?? nowEpochSec(),
    success: !!payload.success,
    note: payload.note,
    breaker: payload.breakerState ? { state: payload.breakerState, ...(typeof payload.failureCount === 'number' ? { failure_count: payload.failureCount } : {}) } : undefined
  };
  (env.attempts as AttemptRecord[]).push(attempt);
  return env;
}

// 2) Merge confidence components (clamp 0..1). Only touches provided keys.
function mergeConfidence(env: MutableEnvelope, comp: { syntax?: number; logic?: number; risk?: number }): MutableEnvelope {
  const existing = (env.confidenceComponents ?? {}) as ConfidenceComponents;
  const merged: ConfidenceComponents = { ...existing };
  if (typeof comp.syntax === 'number') merged.syntax = clamp01(comp.syntax);
  if (typeof comp.logic === 'number') merged.logic = clamp01(comp.logic);
  if (typeof comp.risk === 'number') merged.risk = clamp01(comp.risk);
  env.confidenceComponents = merged;
  return env;
}

// 3) Update trend metadata (overwrites with fresh snapshot). Preserves "unknown" if insufficient signal.
function updateTrend(env: MutableEnvelope, data: {
  errorsDetected: number;
  errorsResolved: number;
  qualityScore?: number;
  improvementVelocity?: number;
  stagnationRisk?: number;
}): MutableEnvelope {
  const errorsDetected = Math.max(0, data.errorsDetected);
  const errorsResolved = Math.max(0, data.errorsResolved);
  let errorTrend: TrendMetadata['errorTrend'] = 'unknown';
  if (errorsResolved > 0 && errorsDetected >= 0) {
    errorTrend = 'improving';
  } else if (data.improvementVelocity !== undefined) {
    // Heuristic: negative velocity => worsening, else plateauing
    errorTrend = data.improvementVelocity < 0 ? 'worsening' : 'plateauing';
  }
  const snapshot: TrendMetadata = {
    errorsDetected,
    errorsResolved,
    errorTrend,
    codeQualityScore: clamp01(data.qualityScore),
    improvementVelocity: typeof data.improvementVelocity === 'number' ? clamp01(data.improvementVelocity) : undefined,
    stagnationRisk: clamp01(data.stagnationRisk)
  };
  env.trendMetadata = snapshot;
  return env;
}

// 4) Set breaker state (enum). Does not validate transitions here.
function setBreakerState(env: MutableEnvelope, state: BreakerState): MutableEnvelope {
  if (state === 'OPEN' || state === 'CLOSED' || state === 'HALF_OPEN') {
    env.breakerState = state;
  }
  return env;
}

// 5) Mirror cascade depth (non-negative integer).
function setCascadeDepth(env: MutableEnvelope, depth: number): MutableEnvelope {
  const safe = Number.isFinite(depth) ? Math.max(0, Math.floor(depth)) : 0;
  env.cascadeDepth = safe;
  return env;
}

// 6) Merge resource usage snapshot (shallow merge only).
function mergeResourceUsage(env: MutableEnvelope, usage: ResourceUsageSnapshot): MutableEnvelope {
  if (!env.resourceUsage) env.resourceUsage = {};
  env.resourceUsage = { ...(env.resourceUsage as object), ...(usage || {}) };
  return env;
}

// 7) Apply developer flag & message (keeps internal + schema naming in sync).
function applyDeveloperFlag(env: MutableEnvelope, opts: { flagged: boolean; message?: string; reasonCode?: string }): MutableEnvelope {
  const flagged = !!opts.flagged;
  env.flagged_for_developer = flagged;
  env.flaggedForDeveloper = flagged; // keep legacy internal camelCase
  if (flagged && opts.message) {
    env.developer_message = opts.message;
    env.developerMessage = opts.message;
  }
  if (flagged && opts.reasonCode) {
    env.developer_flag_reason = opts.reasonCode;
  }
  return env;
}

// 8) Mark top-level success (latching true once set to true).
function markSuccess(env: MutableEnvelope, success: boolean): MutableEnvelope {
  env.success = env.success === true ? true : !!success;
  return env;
}

// 9) Set canonical ISO 8601 timestamp.
function setEnvelopeTimestamp(env: MutableEnvelope, isoString?: string): MutableEnvelope {
  env.timestamp = isoString ?? nowIso();
  return env;
}

// 10) Compute stable hash (excluding volatile fields) — pure.
function computeStableEnvelopeHash(env: MutableEnvelope, sha256Hex: (s: string) => string): string {
  const { attempts, timestamp, envelopeHash, developer_message, developerMessage, developer_flag_reason, timeline, ...rest } = env;
  // Sort keys deterministically
  const orderedKeys = Object.keys(rest).sort();
  const canonical = JSON.stringify(rest, orderedKeys);
  return sha256Hex(canonical);
}

// 11) Set envelopeHash (delegates to computeStableEnvelopeHash)
function setEnvelopeHash(env: MutableEnvelope, sha256Hex: (s: string) => string): MutableEnvelope {
  env.envelopeHash = computeStableEnvelopeHash(env, sha256Hex);
  return env;
}

// 12) Update counters (initialize lazily) — kind helps future budgets.
function updateCounters(env: MutableEnvelope, kind: 'syntax' | 'logic' | 'other', errorsResolved: number): MutableEnvelope {
  if (!env.counters) env.counters = {};
  env.counters.totalAttempts = (env.counters.totalAttempts ?? 0) + 1;
  if (kind === 'syntax') env.counters.syntaxAttempts = (env.counters.syntaxAttempts ?? 0) + 1;
  if (kind === 'logic') env.counters.logicAttempts = (env.counters.logicAttempts ?? 0) + 1;
  env.counters.errorsResolvedTotal = (env.counters.errorsResolvedTotal ?? 0) + Math.max(0, errorsResolved);
  return env;
}

// 13) Add timeline entry snapshot (coarse story per attempt)
function addTimelineEntry(env: MutableEnvelope, payload: { attempt: number; errorsDetected?: number; errorsResolved?: number; overallConfidence?: number; breakerState?: BreakerState | string; action?: string }): MutableEnvelope {
  if (!Array.isArray(env.timeline)) env.timeline = [];
  env.timeline.push({
    attempt: payload.attempt,
    ts: nowIso(),
    errorsDetected: payload.errorsDetected,
    errorsResolved: payload.errorsResolved,
    overallConfidence: payload.overallConfidence,
    breakerState: payload.breakerState,
    action: payload.action
  });
  return env;
}

// Export new helpers without altering existing exports above.
export {
  BreakerState,
  AttemptRecord,
  ConfidenceComponents,
  TrendMetadata,
  ResourceUsageSnapshot,
  MutableEnvelope,
  appendAttempt,
  mergeConfidence,
  updateTrend,
  setBreakerState,
  setCascadeDepth,
  mergeResourceUsage,
  applyDeveloperFlag,
  markSuccess,
  setEnvelopeTimestamp,
  computeStableEnvelopeHash,
  setEnvelopeHash,
  updateCounters,
  addTimelineEntry
};

export { ResilientMemoryBuffer };