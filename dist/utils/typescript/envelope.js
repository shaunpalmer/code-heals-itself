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
class PatchEnvelope {
    constructor(patchId, patchData, metadata = {}, attempts = [], confidenceComponents = {}, breakerState = "CLOSED", cascadeDepth = 0, resourceUsage = {}) {
        this.patchId = patchId;
        this.patchData = patchData;
        this.metadata = metadata;
        this.attempts = attempts;
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
    toJson() {
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
    static fromJson(jsonStr) {
        const data = JSON.parse(jsonStr);
        const envelope = new PatchEnvelope(data.patch_id, data.patch_data, data.metadata, data.attempts, data.confidenceComponents || {}, data.breakerState || "CLOSED", data.cascadeDepth || 0, data.resourceUsage || {});
        envelope.success = data.success || false;
        envelope.flaggedForDeveloper = data.flagged_for_developer || false;
        envelope.developerMessage = data.developer_message || "";
        return envelope;
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
        // Update envelope
        envelope.success = true;
        envelope.attempts.push({
            timestamp: new Date().toISOString(),
            result: "success",
            details: result.execution_details
        });
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
