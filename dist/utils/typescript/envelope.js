"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResilientMemoryBuffer = exports.MemoryBuffer = exports.AIPatchEnvelope = exports.PatchWrapper = exports.PatchEnvelope = void 0;
exports.withMutableEnvelope = withMutableEnvelope;
exports.appendAttempt = appendAttempt;
exports.mergeConfidence = mergeConfidence;
exports.updateTrend = updateTrend;
exports.setBreakerState = setBreakerState;
exports.setCascadeDepth = setCascadeDepth;
exports.mergeResourceUsage = mergeResourceUsage;
exports.applyDeveloperFlag = applyDeveloperFlag;
exports.markSuccess = markSuccess;
exports.setEnvelopeTimestamp = setEnvelopeTimestamp;
exports.computeStableEnvelopeHash = computeStableEnvelopeHash;
exports.setEnvelopeHash = setEnvelopeHash;
exports.updateCounters = updateCounters;
exports.addTimelineEntry = addTimelineEntry;
class PatchEnvelope {
    constructor(patchId, patchData, metadata = {}, attempts = [], confidenceComponents = {}, breakerState = "CLOSED", cascadeDepth = 0, resourceUsage = {}) {
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
    get patchId() { return this.state.patchId; }
    get patchData() { return this.state.patchData; }
    set patchData(value) { this.state.patchData = value; }
    get metadata() { return this.state.metadata; }
    set metadata(value) {
        this.state.metadata = value !== null && value !== void 0 ? value : {};
    }
    get attempts() { return this.state.attempts; }
    set attempts(value) {
        this.state.attempts = Array.isArray(value) ? value : [];
    }
    get confidenceComponents() { return this.state.confidenceComponents; }
    set confidenceComponents(value) {
        this.state.confidenceComponents = value !== null && value !== void 0 ? value : {};
    }
    get breakerState() { return this.state.breakerState; }
    set breakerState(value) {
        this.state.breakerState = value !== null && value !== void 0 ? value : "CLOSED";
    }
    get cascadeDepth() { return this.state.cascadeDepth; }
    set cascadeDepth(value) {
        const safe = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
        this.state.cascadeDepth = safe;
    }
    get resourceUsage() { return this.state.resourceUsage; }
    set resourceUsage(value) {
        this.state.resourceUsage = value !== null && value !== void 0 ? value : {};
    }
    get trendMetadata() { return this.state.trendMetadata; }
    set trendMetadata(value) {
        this.state.trendMetadata = value !== null && value !== void 0 ? value : this.state.trendMetadata;
    }
    get success() { return this.state.success; }
    set success(value) {
        this.state.success = value === true;
    }
    get flaggedForDeveloper() { return this.state.flaggedForDeveloper; }
    set flaggedForDeveloper(value) {
        const flagged = value === true;
        this.state.flaggedForDeveloper = flagged;
        this.state.flagged_for_developer = flagged;
    }
    get flagged_for_developer() { return this.state.flagged_for_developer; }
    set flagged_for_developer(value) {
        this.flaggedForDeveloper = value;
    }
    get developerMessage() { return this.state.developerMessage; }
    set developerMessage(value) {
        const msg = value !== null && value !== void 0 ? value : "";
        this.state.developerMessage = msg;
        this.state.developer_message = msg;
    }
    get developer_message() { return this.state.developer_message; }
    set developer_message(value) {
        this.developerMessage = value;
    }
    get developer_flag_reason() { return this.state.developer_flag_reason; }
    set developer_flag_reason(value) {
        this.state.developer_flag_reason = value;
    }
    get counters() { return this.state.counters; }
    set counters(value) {
        this.state.counters = value;
    }
    get timeline() { return this.state.timeline; }
    set timeline(value) {
        this.state.timeline = value !== null && value !== void 0 ? value : undefined;
    }
    get policySnapshot() { return this.state.policySnapshot; }
    set policySnapshot(value) {
        this.state.policySnapshot = value;
    }
    get timestamp() { return this.state.timestamp; }
    set timestamp(value) {
        this.state.timestamp = value;
    }
    get envelopeHash() { return this.state.envelopeHash; }
    set envelopeHash(value) {
        this.state.envelopeHash = value;
    }
    getMutableState() {
        return this.state;
    }
    withMutable(mutator) {
        const result = mutator(this.getMutableState());
        this.normalizeAliases();
        return result;
    }
    normalizeAliases() {
        const flagged = this.state.flaggedForDeveloper || this.state.flagged_for_developer || false;
        this.state.flaggedForDeveloper = flagged;
        this.state.flagged_for_developer = flagged;
        const msg = this.state.developerMessage || this.state.developer_message || "";
        this.state.developerMessage = msg;
        this.state.developer_message = msg;
    }
    toObject() {
        var _a;
        const timestamp = (_a = this.state.timestamp) !== null && _a !== void 0 ? _a : new Date().toISOString();
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
    toJson(pretty = true) {
        return JSON.stringify(this.toObject(), null, pretty ? 2 : 0);
    }
    toJSON() {
        return this.toObject();
    }
    static fromJson(payload) {
        const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
        const envelope = new PatchEnvelope(data.patch_id, data.patch_data, data.metadata, data.attempts, data.confidenceComponents || {}, data.breakerState || "CLOSED", data.cascadeDepth || 0, data.resourceUsage || {});
        envelope.trendMetadata = data.trendMetadata || envelope.trendMetadata;
        envelope.success = data.success || false;
        envelope.flagged_for_developer = data.flagged_for_developer || false;
        envelope.developer_message = data.developer_message || "";
        envelope.timestamp = data.timestamp;
        if (data.envelopeHash)
            envelope.envelopeHash = data.envelopeHash;
        envelope.withMutable((draft) => {
            if (data.counters)
                (draft.counters = data.counters);
            if (data.timeline)
                (draft.timeline = data.timeline);
            if (data.policySnapshot)
                (draft.policySnapshot = data.policySnapshot);
            if (data.developer_flag_reason)
                (draft.developer_flag_reason = data.developer_flag_reason);
        });
        return envelope;
    }
    static create(state) {
        const envelope = new PatchEnvelope(state.patchId, state.patchData, state.metadata, state.attempts, state.confidenceComponents, state.breakerState, state.cascadeDepth, state.resourceUsage);
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
                    draft[key] = state[key];
                }
            }
        });
        return envelope;
    }
    clone() {
        return PatchEnvelope.fromJson(this.toObject());
    }
}
exports.PatchEnvelope = PatchEnvelope;
class PatchWrapper {
}
exports.PatchWrapper = PatchWrapper;
class AIPatchEnvelope extends PatchWrapper {
    constructor() {
        super();
        this.envelopes = new Map();
    }
    wrapPatch(patch) {
        const patchId = `patch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const envelope = new PatchEnvelope(patchId, patch);
        this.envelopes.set(patchId, envelope);
        return envelope;
    }
    /**
     * TODO(API): Expose read-only GET /api/envelopes/:id → PatchEnvelopeJson
     * and optionally GET /api/envelopes (latest N) for agent toolkits.
     */
    unwrapAndExecute(envelope) {
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
            const { appendAttempt, markSuccess, setEnvelopeTimestamp, setEnvelopeHash, withMutableEnvelope } = require('./envelope');
            const crypto = require('crypto');
            const sha256Hex = (s) => crypto.createHash('sha256').update(s).digest('hex');
            withMutableEnvelope(envelope, (draft) => {
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
        }
        catch { /* best-effort; do not break legacy flow */ }
        return result;
    }
    isBigError(patchData) {
        const errorIndicators = [
            patchData.database_schema_change,
            patchData.authentication_bypass,
            patchData.critical_security_vulnerability,
            patchData.production_data_modification,
            JSON.stringify(patchData).length > 1000 // Large/complex patches
        ];
        return errorIndicators.some(indicator => indicator);
    }
    generateDeveloperMessage(patchData) {
        if (patchData.database_schema_change) {
            return "Database schema modification detected. Please review for data integrity and migration implications.";
        }
        else if (patchData.authentication_bypass) {
            return "Authentication-related changes detected. Critical security review required.";
        }
        else if (patchData.production_data_modification) {
            return "Production data modification detected. Please verify backup and rollback procedures.";
        }
        else {
            return "Complex patch detected requiring manual review before deployment.";
        }
    }
}
exports.AIPatchEnvelope = AIPatchEnvelope;
class MemoryBuffer {
    constructor(maxSize = 100, onError) {
        this.buffer = [];
        this.maxSize = maxSize;
        this.onError = onError;
    }
    addOutcome(envelopeJson) {
        try {
            this.buffer.push({
                envelope: envelopeJson,
                timestamp: new Date().toISOString()
            });
            if (this.buffer.length > this.maxSize) {
                this.buffer.shift();
            }
        }
        catch (err) {
            if (this.onError)
                this.onError(err);
            else
                throw err;
        }
    }
    getSimilarOutcomes(patchData) {
        const similar = [];
        for (const item of this.buffer) {
            const envelope = PatchEnvelope.fromJson(item.envelope);
            if (this.isSimilar(envelope.patchData, patchData)) {
                similar.push(item);
            }
        }
        return similar.slice(-5);
    }
    isSimilar(pastPatch, currentPatch) {
        if (!pastPatch || !currentPatch)
            return false;
        const pastStr = (JSON.stringify(pastPatch) || '').toLowerCase();
        const currentStr = (JSON.stringify(currentPatch) || '').toLowerCase();
        const pastWords = pastStr.split(/[^a-zA-Z0-9]+/).filter(word => word.length > 0);
        const currentWords = currentStr.split(/[^a-zA-Z0-9]+/).filter(word => word.length > 0);
        if (pastWords.length === 0 || currentWords.length === 0)
            return false;
        const set = new Set(currentWords);
        let matches = 0;
        for (const w of pastWords) {
            if (set.has(w)) {
                matches++;
                if (matches >= 1)
                    break;
            }
        }
        return matches >= 1;
    }
    async save(filePath) {
        var _a;
        if (!filePath)
            return;
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const path = await Promise.resolve().then(() => __importStar(require('path')));
        try {
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            const data = { buffer: this.buffer, maxSize: this.maxSize, saved_at: new Date().toISOString() };
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        }
        catch (err) {
            if (this.onError)
                this.onError(err);
            else
                console.error('Memory save failed:', (_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : String(err));
        }
    }
    async load(filePath) {
        var _a;
        if (!filePath)
            return;
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const data = JSON.parse(content);
            if (data.buffer && Array.isArray(data.buffer)) {
                this.buffer = data.buffer;
            }
        }
        catch (err) {
            if (err.code !== 'ENOENT') {
                if (this.onError)
                    this.onError(err);
                else
                    console.error('Memory load failed:', (_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : String(err));
            }
        }
    }
}
exports.MemoryBuffer = MemoryBuffer;
// A resilient, bounded memory buffer with TTL eviction and safe writes
class ResilientMemoryBuffer {
    constructor(maxSize = 100, onError, ttlMs) {
        this.maxSize = maxSize;
        this.onError = onError;
        this.ttlMs = ttlMs;
        this.buffer = [];
        this.evictions = 0;
        this.failures = 0;
        this.lastError = null;
    }
    // Backward-compatible addOutcome (throws if no onError provided)
    addOutcome(envelopeJson) {
        const ok = this.safeAddOutcome(envelopeJson);
        if (!ok && !this.onError && this.lastError) {
            throw new Error(this.lastError);
        }
    }
    // Safe write: never throws; returns success boolean
    safeAddOutcome(envelopeJson) {
        var _a, _b;
        try {
            this.pruneTTL();
            this.buffer.push({ envelope: envelopeJson, timestamp: new Date().toISOString() });
            this.pruneSize();
            return true;
        }
        catch (err) {
            this.failures += 1;
            this.lastError = (_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : String(err);
            try {
                (_b = this.onError) === null || _b === void 0 ? void 0 : _b.call(this, err, envelopeJson);
            }
            catch { /* swallow onError failures */ }
            return false;
        }
    }
    getSimilarOutcomes(patchData) {
        this.pruneTTL();
        const similar = [];
        for (const item of this.buffer) {
            try {
                const envelope = PatchEnvelope.fromJson(item.envelope);
                if (this.isSimilar(envelope.patchData, patchData)) {
                    similar.push(item);
                }
            }
            catch { /* skip malformed entries */ }
        }
        return similar.slice(-5);
    }
    async save(filePath) {
        var _a, _b;
        if (!filePath)
            return;
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const path = await Promise.resolve().then(() => __importStar(require('path')));
        try {
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            const data = {
                buffer: this.buffer,
                maxSize: this.maxSize,
                ttlMs: (_a = this.ttlMs) !== null && _a !== void 0 ? _a : null,
                evictions: this.evictions,
                failures: this.failures,
                saved_at: new Date().toISOString()
            };
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        }
        catch (err) {
            this.failures += 1;
            this.lastError = (_b = err === null || err === void 0 ? void 0 : err.message) !== null && _b !== void 0 ? _b : String(err);
            if (this.onError)
                this.onError(err);
            else
                console.error('Memory save failed:', this.lastError);
        }
    }
    async load(filePath) {
        var _a;
        if (!filePath)
            return;
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const data = JSON.parse(content);
            if (data.buffer && Array.isArray(data.buffer))
                this.buffer = data.buffer;
            if (typeof data.maxSize === 'number')
                this.maxSize = data.maxSize;
            if (typeof data.ttlMs === 'number')
                this.ttlMs = data.ttlMs;
            // Do not load evictions/failures counters from disk; keep runtime-only
            this.pruneTTL();
            this.pruneSize();
        }
        catch (err) {
            if (err.code !== 'ENOENT') {
                this.failures += 1;
                this.lastError = (_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : String(err);
                if (this.onError)
                    this.onError(err);
                else
                    console.error('Memory load failed:', this.lastError);
            }
        }
    }
    // Lightweight metrics for observability
    getMetrics() {
        return { size: this.buffer.length, maxSize: this.maxSize, evictions: this.evictions, failures: this.failures, lastError: this.lastError };
    }
    pruneSize() {
        while (this.buffer.length > this.maxSize) {
            this.buffer.shift();
            this.evictions += 1;
        }
    }
    pruneTTL() {
        if (!this.ttlMs)
            return;
        const cutoff = Date.now() - this.ttlMs;
        const before = this.buffer.length;
        this.buffer = this.buffer.filter(item => {
            const ts = Date.parse(item.timestamp);
            return isFinite(ts) ? ts >= cutoff : true;
        });
        this.evictions += Math.max(0, before - this.buffer.length);
    }
    isSimilar(pastPatch, currentPatch) {
        if (!pastPatch || !currentPatch)
            return false;
        const pastStr = (JSON.stringify(pastPatch) || '').toLowerCase();
        const currentStr = (JSON.stringify(currentPatch) || '').toLowerCase();
        const pastWords = pastStr.split(/[^a-zA-Z0-9]+/).filter(w => w.length > 0);
        const currentWords = new Set(currentStr.split(/[^a-zA-Z0-9]+/).filter(w => w.length > 0));
        for (const w of pastWords) {
            if (currentWords.has(w))
                return true;
        }
        return false;
    }
}
exports.ResilientMemoryBuffer = ResilientMemoryBuffer;
// ---------------- Envelope Helper Types & Functions (Non-invasive additions) ----------------
// These helpers are additive. They do NOT modify existing class logic. They shape/annotate
// envelope objects for schema-aligned fields: attempts, confidenceComponents, trendMetadata,
// breakerState, cascadeDepth, resourceUsage, flagged_for_developer/developerMessage, success,
// timestamp, envelopeHash.
function withMutableEnvelope(envelope, mutator) {
    if (envelope instanceof PatchEnvelope) {
        return envelope.withMutable(mutator);
    }
    return mutator(envelope);
}
// Utility: clamp 0..1
const clamp01 = (n) => typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : undefined;
const nowIso = () => new Date().toISOString();
const nowEpochSec = () => Math.floor(Date.now() / 1000);
// 1) Append an attempt (schema-aligned) — does not mutate legacy attempt objects already present.
function appendAttempt(env, payload) {
    var _a;
    if (!Array.isArray(env.attempts))
        env.attempts = [];
    const attempt = {
        ts: (_a = payload.ts) !== null && _a !== void 0 ? _a : nowEpochSec(),
        success: !!payload.success,
        note: payload.note,
        breaker: payload.breakerState ? { state: payload.breakerState, ...(typeof payload.failureCount === 'number' ? { failure_count: payload.failureCount } : {}) } : undefined
    };
    env.attempts.push(attempt);
    return env;
}
// 2) Merge confidence components (clamp 0..1). Only touches provided keys.
function mergeConfidence(env, comp) {
    var _a;
    const existing = ((_a = env.confidenceComponents) !== null && _a !== void 0 ? _a : {});
    const merged = { ...existing };
    if (typeof comp.syntax === 'number')
        merged.syntax = clamp01(comp.syntax);
    if (typeof comp.logic === 'number')
        merged.logic = clamp01(comp.logic);
    if (typeof comp.risk === 'number')
        merged.risk = clamp01(comp.risk);
    env.confidenceComponents = merged;
    return env;
}
// 3) Update trend metadata (overwrites with fresh snapshot). Preserves "unknown" if insufficient signal.
function updateTrend(env, data) {
    const errorsDetected = Math.max(0, data.errorsDetected);
    const errorsResolved = Math.max(0, data.errorsResolved);
    let errorTrend = 'unknown';
    if (errorsResolved > 0 && errorsDetected >= 0) {
        errorTrend = 'improving';
    }
    else if (data.improvementVelocity !== undefined) {
        // Heuristic: negative velocity => worsening, else plateauing
        errorTrend = data.improvementVelocity < 0 ? 'worsening' : 'plateauing';
    }
    const snapshot = {
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
function setBreakerState(env, state) {
    if (state === 'OPEN' || state === 'CLOSED' || state === 'HALF_OPEN') {
        env.breakerState = state;
    }
    return env;
}
// 5) Mirror cascade depth (non-negative integer).
function setCascadeDepth(env, depth) {
    const safe = Number.isFinite(depth) ? Math.max(0, Math.floor(depth)) : 0;
    env.cascadeDepth = safe;
    return env;
}
// 6) Merge resource usage snapshot (shallow merge only).
function mergeResourceUsage(env, usage) {
    if (!env.resourceUsage)
        env.resourceUsage = {};
    env.resourceUsage = { ...env.resourceUsage, ...(usage || {}) };
    return env;
}
// 7) Apply developer flag & message (keeps internal + schema naming in sync).
function applyDeveloperFlag(env, opts) {
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
function markSuccess(env, success) {
    env.success = env.success === true ? true : !!success;
    return env;
}
// 9) Set canonical ISO 8601 timestamp.
function setEnvelopeTimestamp(env, isoString) {
    env.timestamp = isoString !== null && isoString !== void 0 ? isoString : nowIso();
    return env;
}
// 10) Compute stable hash (excluding volatile fields) — pure.
function computeStableEnvelopeHash(env, sha256Hex) {
    const { attempts, timestamp, envelopeHash, developer_message, developerMessage, developer_flag_reason, timeline, ...rest } = env;
    // Sort keys deterministically
    const orderedKeys = Object.keys(rest).sort();
    const canonical = JSON.stringify(rest, orderedKeys);
    return sha256Hex(canonical);
}
// 11) Set envelopeHash (delegates to computeStableEnvelopeHash)
function setEnvelopeHash(env, sha256Hex) {
    env.envelopeHash = computeStableEnvelopeHash(env, sha256Hex);
    return env;
}
// 12) Update counters (initialize lazily) — kind helps future budgets.
function updateCounters(env, kind, errorsResolved) {
    var _a, _b, _c, _d;
    if (!env.counters)
        env.counters = {};
    env.counters.totalAttempts = ((_a = env.counters.totalAttempts) !== null && _a !== void 0 ? _a : 0) + 1;
    if (kind === 'syntax')
        env.counters.syntaxAttempts = ((_b = env.counters.syntaxAttempts) !== null && _b !== void 0 ? _b : 0) + 1;
    if (kind === 'logic')
        env.counters.logicAttempts = ((_c = env.counters.logicAttempts) !== null && _c !== void 0 ? _c : 0) + 1;
    env.counters.errorsResolvedTotal = ((_d = env.counters.errorsResolvedTotal) !== null && _d !== void 0 ? _d : 0) + Math.max(0, errorsResolved);
    return env;
}
// 13) Add timeline entry snapshot (coarse story per attempt)
function addTimelineEntry(env, payload) {
    if (!Array.isArray(env.timeline))
        env.timeline = [];
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
