"use strict";
/**
 * Test suite for MemoryBuffer persistence extensions
 * Tests the save/load functionality added to the core MemoryBuffer class
 */
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
const globals_1 = require("@jest/globals");
const fs = __importStar(require("fs/promises"));
const envelope_1 = require("../../utils/typescript/envelope");
(0, globals_1.describe)('MemoryBuffer Persistence', () => {
    const testFilePath = './test-memory-buffer.json';
    let buffer;
    const sampleEnvelope = new envelope_1.PatchEnvelope('test-patch-001', {
        language: 'typescript',
        patched_code: 'console.log("patched");',
        original_code: 'console.log("original");',
        diff: '+patched\\n-original'
    }, {
        created_at: '2025-09-16T12:00:00Z',
        ai_generated: true,
        service: 'test-service',
        env: 'test'
    }, [
        {
            ts: Date.now(),
            success: false,
            note: 'First attempt failed with syntax error: unexpected token',
            breaker: {
                state: 'CLOSED',
                failure_count: 1
            }
        },
        {
            ts: Date.now() + 1000,
            success: true,
            note: 'Second attempt succeeded',
            breaker: {
                state: 'CLOSED',
                failure_count: 0
            }
        }
    ]);
    (0, globals_1.beforeEach)(() => {
        buffer = new envelope_1.MemoryBuffer(100);
    });
    (0, globals_1.afterEach)(async () => {
        try {
            await fs.unlink(testFilePath);
        }
        catch {
            // File might not exist, ignore
        }
    });
    (0, globals_1.describe)('Basic Memory Operations', () => {
        (0, globals_1.it)('should store and retrieve outcomes', () => {
            buffer.addOutcome(sampleEnvelope.toJson());
            const similar = buffer.getSimilarOutcomes({
                language: 'typescript',
                patched_code: 'console.log("similar");'
            });
            (0, globals_1.expect)(similar).toHaveLength(1);
            (0, globals_1.expect)(similar[0].envelope).toContain('test-patch-001');
        });
        (0, globals_1.it)('should maintain buffer size limit', () => {
            const smallBuffer = new envelope_1.MemoryBuffer(2);
            smallBuffer.addOutcome('{"patch_id": "patch-1"}');
            smallBuffer.addOutcome('{"patch_id": "patch-2"}');
            smallBuffer.addOutcome('{"patch_id": "patch-3"}'); // Should push out the first one
            // Note: getSimilarOutcomes doesn't return everything, but we can test buffer behavior
            const allSimilar = smallBuffer.getSimilarOutcomes({ match: 'everything' });
            (0, globals_1.expect)(allSimilar.length).toBeLessThanOrEqual(2);
        });
        (0, globals_1.it)('should find similar outcomes based on content', () => {
            buffer.addOutcome(sampleEnvelope.toJson());
            // Add another envelope with similar content
            const similarEnvelope = new envelope_1.PatchEnvelope('test-patch-002', {
                language: 'typescript', // Same language
                patched_code: 'console.log("different but similar");',
                original_code: 'console.log("original");' // Same original
            });
            buffer.addOutcome(similarEnvelope.toJson());
            const similar = buffer.getSimilarOutcomes({
                language: 'typescript',
                original_code: 'console.log("original");'
            });
            (0, globals_1.expect)(similar.length).toBeGreaterThan(0);
        });
    });
    (0, globals_1.describe)('Persistence Operations', () => {
        (0, globals_1.it)('should save to file', async () => {
            buffer.addOutcome(sampleEnvelope.toJson());
            await buffer.save(testFilePath);
            // Verify file exists and contains data
            const fileContent = await fs.readFile(testFilePath, 'utf-8');
            const data = JSON.parse(fileContent);
            (0, globals_1.expect)(data.buffer).toHaveLength(1);
            (0, globals_1.expect)(data.buffer[0].envelope).toContain('test-patch-001');
            (0, globals_1.expect)(data.maxSize).toBe(100);
            (0, globals_1.expect)(data.saved_at).toBeDefined();
        });
        (0, globals_1.it)('should load from file', async () => {
            // Create a new buffer and save data
            buffer.addOutcome(sampleEnvelope.toJson());
            await buffer.save(testFilePath);
            // Create another buffer and load the data
            const newBuffer = new envelope_1.MemoryBuffer(100);
            await newBuffer.load(testFilePath);
            const similar = newBuffer.getSimilarOutcomes({
                language: 'typescript',
                patched_code: 'console.log("similar");'
            });
            (0, globals_1.expect)(similar).toHaveLength(1);
            (0, globals_1.expect)(similar[0].envelope).toContain('test-patch-001');
        });
        (0, globals_1.it)('should handle missing file gracefully', async () => {
            const newBuffer = new envelope_1.MemoryBuffer(100);
            // Should not throw when loading non-existent file
            await (0, globals_1.expect)(newBuffer.load('./non-existent-file.json')).resolves.not.toThrow();
            const outcomes = newBuffer.getSimilarOutcomes({ test: true });
            (0, globals_1.expect)(outcomes).toHaveLength(0);
        });
        (0, globals_1.it)('should handle save without file path', async () => {
            buffer.addOutcome(sampleEnvelope.toJson());
            // Should not throw when saving without file path
            await (0, globals_1.expect)(buffer.save()).resolves.not.toThrow();
        });
        (0, globals_1.it)('should handle load without file path', async () => {
            // Should not throw when loading without file path
            await (0, globals_1.expect)(buffer.load()).resolves.not.toThrow();
        });
        (0, globals_1.it)('should preserve data integrity across save/load cycles', async () => {
            // Add multiple outcomes
            buffer.addOutcome(sampleEnvelope.toJson());
            const envelope2 = new envelope_1.PatchEnvelope('patch-002', { test: 'data' });
            buffer.addOutcome(envelope2.toJson());
            // Save and load
            await buffer.save(testFilePath);
            const newBuffer = new envelope_1.MemoryBuffer(100);
            await newBuffer.load(testFilePath);
            // Check both outcomes are preserved
            const similar1 = newBuffer.getSimilarOutcomes({ language: 'typescript' });
            const similar2 = newBuffer.getSimilarOutcomes({ test: 'data' });
            (0, globals_1.expect)(similar1).toHaveLength(1);
            (0, globals_1.expect)(similar2).toHaveLength(1);
        });
    });
    (0, globals_1.describe)('Error Handling', () => {
        (0, globals_1.it)('should handle corrupted save data gracefully', async () => {
            // Write invalid JSON to file
            await fs.writeFile(testFilePath, 'invalid json');
            const newBuffer = new envelope_1.MemoryBuffer(100);
            // Should not throw, but should log error
            await (0, globals_1.expect)(newBuffer.load(testFilePath)).resolves.not.toThrow();
            // Buffer should be empty after failed load
            const outcomes = newBuffer.getSimilarOutcomes({ anything: true });
            (0, globals_1.expect)(outcomes).toHaveLength(0);
        });
        (0, globals_1.it)('should handle save to invalid path gracefully', async () => {
            buffer.addOutcome(sampleEnvelope.toJson());
            // Should not throw even if save fails
            await (0, globals_1.expect)(buffer.save('/invalid/path/file.json')).resolves.not.toThrow();
        });
    });
});
