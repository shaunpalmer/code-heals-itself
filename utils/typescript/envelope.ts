interface PatchEnvelopeState {
  patchId: string;
  patchData: Record<string, any>;
  metadata: Record<string, any>;
  attempts: Record<string, any>[];
  confidenceComponents: Record<string, number>;
  breakerState: string;
  cascadeDepth: number;
  resourceUsage: Record<string, any>;
  trendMetadata: TrendMetadata;
  success: boolean;
  flaggedForDeveloper: boolean;
  flagged_for_developer: boolean;
  developerMessage: string;
  developer_message: string;
  counters?: {
    totalAttempts?: number;
    syntaxAttempts?: number;
    logicAttempts?: number;
    errorsResolvedTotal?: number;
  };
  timeline?: Array<{
    attempt: number;
    ts: string;
    errorsDetected?: number;
    errorsResolved?: number;
    overallConfidence?: number;
    breakerState?: BreakerState | string;
    action?: string;
  }>;
  policySnapshot?: Record<string, any>;
  developer_flag_reason?: string;
  envelopeHash?: string;
  timestamp?: string;
  [key: string]: any;
}

type PatchEnvelopeJson = {
  patch_id: string;
  patch_data: Record<string, any>;
  metadata: Record<string, any>;
  attempts: Record<string, any>[];
  confidenceComponents: Record<string, number>;
  breakerState: string;
  cascadeDepth: number;
  resourceUsage: Record<string, any>;
  trendMetadata: TrendMetadata;
  success: boolean;
  flagged_for_developer: boolean;
  developer_message: string;
  timestamp: string;
  envelopeHash?: string;
  [key: string]: any;
};

class PatchEnvelope {
  protected readonly state: PatchEnvelopeState;

  constructor(
    patchId: string,
    patchData: Record<string, any>,
    metadata: Record<string, any> = {},
    attempts: Record<string, any>[] = [],
    confidenceComponents: Record<string, number> = {},
    breakerState: string = "CLOSED",
    cascadeDepth: number = 0,
    resourceUsage: Record<string, any> = {}
  ) {
    this.state = {
      patchId,
      patchData,
      metadata: {
        created_at: new Date().toISOString(),
        language: "typescript",
        ai_generated: true,
        ...metadata
      },
      attempts: Array.isArray(attempts) ? [...attempts] : [],
      confidenceComponents: { ...confidenceComponents },
      breakerState,
      cascadeDepth,
      resourceUsage: { ...resourceUsage },
      trendMetadata: {
        errorsDetected: 0,
        errorsResolved: 0,
        errorTrend: "unknown"
      },
      success: false,
      flaggedForDeveloper: false,
      flagged_for_developer: false,
      developerMessage: "",
      developer_message: ""
    };
    this.normalizeAliases();
  }

  get patchId(): string { return this.state.patchId; }

  get patchData(): Record<string, any> { return this.state.patchData; }
  set patchData(value: Record<string, any>) { this.state.patchData = value; }

  get metadata(): Record<string, any> { return this.state.metadata; }
  set metadata(value: Record<string, any>) {
    this.state.metadata = value ?? {};
  }

  get attempts(): Record<string, any>[] { return this.state.attempts; }
  set attempts(value: Record<string, any>[]) {
    this.state.attempts = Array.isArray(value) ? value : [];
  }

  get confidenceComponents(): Record<string, number> { return this.state.confidenceComponents; }
  set confidenceComponents(value: Record<string, number>) {
    this.state.confidenceComponents = value ?? {};
  }

  get breakerState(): string { return this.state.breakerState; }
  set breakerState(value: string) {
    this.state.breakerState = value ?? "CLOSED";
  }

  get cascadeDepth(): number { return this.state.cascadeDepth; }
  set cascadeDepth(value: number) {
    const safe = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    this.state.cascadeDepth = safe;
  }

  get resourceUsage(): Record<string, any> { return this.state.resourceUsage; }
  set resourceUsage(value: Record<string, any>) {
    this.state.resourceUsage = value ?? {};
  }

  get trendMetadata(): TrendMetadata { return this.state.trendMetadata; }
  set trendMetadata(value: TrendMetadata) {
    this.state.trendMetadata = value ?? this.state.trendMetadata;
  }

  get success(): boolean { return this.state.success; }
  set success(value: boolean) {
    this.state.success = value === true;
  }

  get flaggedForDeveloper(): boolean { return this.state.flaggedForDeveloper; }
  set flaggedForDeveloper(value: boolean) {
    const flagged = value === true;
    this.state.flaggedForDeveloper = flagged;
    this.state.flagged_for_developer = flagged;
  }

  get flagged_for_developer(): boolean { return this.state.flagged_for_developer; }
  set flagged_for_developer(value: boolean) {
    this.flaggedForDeveloper = value;
  }

  get developerMessage(): string { return this.state.developerMessage; }
  set developerMessage(value: string) {
    const msg = value ?? "";
    this.state.developerMessage = msg;
    this.state.developer_message = msg;
  }

  get developer_message(): string { return this.state.developer_message; }
  set developer_message(value: string) {
    this.developerMessage = value;
  }

  get developer_flag_reason(): string | undefined { return this.state.developer_flag_reason; }
  set developer_flag_reason(value: string | undefined) {
    this.state.developer_flag_reason = value;
  }

  get counters(): PatchEnvelopeState['counters'] { return this.state.counters; }
  set counters(value: PatchEnvelopeState['counters']) {
    this.state.counters = value;
  }

  get timeline(): PatchEnvelopeState['timeline'] { return this.state.timeline; }
  set timeline(value: PatchEnvelopeState['timeline']) {
    this.state.timeline = value ?? undefined;
  }

  get policySnapshot(): Record<string, any> | undefined { return this.state.policySnapshot; }
  set policySnapshot(value: Record<string, any> | undefined) {
    this.state.policySnapshot = value;
  }

  get timestamp(): string | undefined { return this.state.timestamp; }
  set timestamp(value: string | undefined) {
    this.state.timestamp = value;
  }

  get envelopeHash(): string | undefined { return this.state.envelopeHash; }
  set envelopeHash(value: string | undefined) {
    this.state.envelopeHash = value;
  }

  protected getMutableState(): MutableEnvelope {
    return this.state as unknown as MutableEnvelope;
  }

  public withMutable<T>(mutator: (draft: MutableEnvelope) => T): T {
    const result = mutator(this.getMutableState());
    this.normalizeAliases();
    return result;
  }

  private normalizeAliases(): void {
    const flagged = this.state.flaggedForDeveloper || this.state.flagged_for_developer || false;
    this.state.flaggedForDeveloper = flagged;
    this.state.flagged_for_developer = flagged;
    const msg = this.state.developerMessage || this.state.developer_message || "";
    this.state.developerMessage = msg;
    this.state.developer_message = msg;
  }

  toObject(): PatchEnvelopeJson {
    const timestamp = this.state.timestamp ?? new Date().toISOString();
    return {
      patch_id: this.state.patchId,
      patch_data: this.state.patchData,
      metadata: this.state.metadata,
      attempts: this.state.attempts,
      confidenceComponents: this.state.confidenceComponents,
      breakerState: this.state.breakerState,
      cascadeDepth: this.state.cascadeDepth,
      resourceUsage: this.state.resourceUsage,
      trendMetadata: this.state.trendMetadata,
      success: this.state.success,
      flagged_for_developer: this.state.flagged_for_developer,
      developer_message: this.state.developer_message,
      timestamp,
      envelopeHash: this.state.envelopeHash,
      counters: this.state.counters,
      timeline: this.state.timeline,
      policySnapshot: this.state.policySnapshot,
      developer_flag_reason: this.state.developer_flag_reason
    };
  }

  toJson(pretty: boolean = true): string {
    return JSON.stringify(this.toObject(), null, pretty ? 2 : 0);
  }

  toJSON(): PatchEnvelopeJson {
    return this.toObject();
  }

  static fromJson(payload: string | PatchEnvelopeJson): PatchEnvelope {
    const data: PatchEnvelopeJson = typeof payload === 'string' ? JSON.parse(payload) : payload;
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
    envelope.trendMetadata = data.trendMetadata || envelope.trendMetadata;
    envelope.success = data.success || false;
    envelope.flagged_for_developer = data.flagged_for_developer || false;
    envelope.developer_message = data.developer_message || "";
    envelope.timestamp = data.timestamp;
    if (data.envelopeHash) envelope.envelopeHash = data.envelopeHash;
    envelope.withMutable((draft) => {
      if (data.counters) (draft.counters = data.counters);
      if (data.timeline) (draft.timeline = data.timeline);
      if ((data as any).policySnapshot) (draft.policySnapshot = (data as any).policySnapshot);
      if ((data as any).developer_flag_reason) (draft.developer_flag_reason = (data as any).developer_flag_reason);
    });
    return envelope;
  }

  static create(state: PatchEnvelopeState): PatchEnvelope {
    const envelope = new PatchEnvelope(
      state.patchId,
      state.patchData,
      state.metadata,
      state.attempts,
      state.confidenceComponents,
      state.breakerState,
      state.cascadeDepth,
      state.resourceUsage
    );
    envelope.trendMetadata = state.trendMetadata;
    envelope.success = state.success;
    envelope.flagged_for_developer = state.flagged_for_developer;
    envelope.developer_message = state.developer_message;
    envelope.counters = state.counters;
    envelope.timeline = state.timeline;
    envelope.policySnapshot = state.policySnapshot;
    envelope.developer_flag_reason = state.developer_flag_reason;
    envelope.timestamp = state.timestamp;
    envelope.envelopeHash = state.envelopeHash;
    envelope.withMutable((draft) => {
      for (const key of Object.keys(state)) {
        if (!(key in draft)) {
          (draft as any)[key] = (state as any)[key];
        }
      }
    });
    return envelope;
  }

  clone(): PatchEnvelope {
    return PatchEnvelope.fromJson(this.toObject());
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
        setEnvelopeHash,
        withMutableEnvelope
      } = require('./envelope');
      const crypto = require('crypto');
      const sha256Hex = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
      withMutableEnvelope(envelope, (draft: any) => {
        markSuccess(draft, true);
        appendAttempt(draft, {
          success: true,
          note: result.execution_details,
          breakerState: 'CLOSED',
          failureCount: 0
        });
        setEnvelopeTimestamp(draft);
        setEnvelopeHash(draft, sha256Hex);
      });
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

function withMutableEnvelope<T>(envelope: PatchEnvelope | MutableEnvelope, mutator: (draft: MutableEnvelope) => T): T {
  if (envelope instanceof PatchEnvelope) {
    return envelope.withMutable(mutator);
  }
  return mutator(envelope);
}

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
  withMutableEnvelope,
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

export type { PatchEnvelopeJson };