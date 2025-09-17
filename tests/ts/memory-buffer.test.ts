/**
 * Test suite for MemoryBuffer persistence extensions
 * Tests the save/load functionality added to the core MemoryBuffer class
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs/promises';
import { MemoryBuffer, PatchEnvelope } from '../../utils/typescript/envelope';

describe('MemoryBuffer Persistence', () => {
  const testFilePath = './test-memory-buffer.json';
  let buffer: MemoryBuffer;

  const sampleEnvelope = new PatchEnvelope(
    'test-patch-001',
    {
      language: 'typescript',
      patched_code: 'console.log("patched");',
      original_code: 'console.log("original");',
      diff: '+patched\\n-original'
    },
    {
      created_at: '2025-09-16T12:00:00Z',
      ai_generated: true,
      service: 'test-service',
      env: 'test'
    },
    [
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
    ]
  );

  beforeEach(() => {
    buffer = new MemoryBuffer(100);
  });

  afterEach(async () => {
    try {
      await fs.unlink(testFilePath);
    } catch {
      // File might not exist, ignore
    }
  });

  describe('Basic Memory Operations', () => {
    it('should store and retrieve outcomes', () => {
      buffer.addOutcome(sampleEnvelope.toJson());

      const similar = buffer.getSimilarOutcomes({
        language: 'typescript',
        patched_code: 'console.log("similar");'
      });

      expect(similar).toHaveLength(1);
      expect(similar[0].envelope).toContain('test-patch-001');
    });

    it('should maintain buffer size limit', () => {
      const smallBuffer = new MemoryBuffer(2);

      smallBuffer.addOutcome('{"patch_id": "patch-1"}');
      smallBuffer.addOutcome('{"patch_id": "patch-2"}');
      smallBuffer.addOutcome('{"patch_id": "patch-3"}'); // Should push out the first one

      // Note: getSimilarOutcomes doesn't return everything, but we can test buffer behavior
      const allSimilar = smallBuffer.getSimilarOutcomes({ match: 'everything' });
      expect(allSimilar.length).toBeLessThanOrEqual(2);
    });

    it('should find similar outcomes based on content', () => {
      buffer.addOutcome(sampleEnvelope.toJson());

      // Add another envelope with similar content
      const similarEnvelope = new PatchEnvelope(
        'test-patch-002',
        {
          language: 'typescript', // Same language
          patched_code: 'console.log("different but similar");',
          original_code: 'console.log("original");' // Same original
        }
      );
      buffer.addOutcome(similarEnvelope.toJson());

      const similar = buffer.getSimilarOutcomes({
        language: 'typescript',
        original_code: 'console.log("original");'
      });

      expect(similar.length).toBeGreaterThan(0);
    });
  });

  describe('Persistence Operations', () => {
    it('should save to file', async () => {
      buffer.addOutcome(sampleEnvelope.toJson());
      await buffer.save(testFilePath);

      // Verify file exists and contains data
      const fileContent = await fs.readFile(testFilePath, 'utf-8');
      const data = JSON.parse(fileContent);

      expect(data.buffer).toHaveLength(1);
      expect(data.buffer[0].envelope).toContain('test-patch-001');
      expect(data.maxSize).toBe(100);
      expect(data.saved_at).toBeDefined();
    });

    it('should load from file', async () => {
      // Create a new buffer and save data
      buffer.addOutcome(sampleEnvelope.toJson());
      await buffer.save(testFilePath);

      // Create another buffer and load the data
      const newBuffer = new MemoryBuffer(100);
      await newBuffer.load(testFilePath);

      const similar = newBuffer.getSimilarOutcomes({
        language: 'typescript',
        patched_code: 'console.log("similar");'
      });

      expect(similar).toHaveLength(1);
      expect(similar[0].envelope).toContain('test-patch-001');
    });

    it('should handle missing file gracefully', async () => {
      const newBuffer = new MemoryBuffer(100);

      // Should not throw when loading non-existent file
      await expect(newBuffer.load('./non-existent-file.json')).resolves.not.toThrow();

      const outcomes = newBuffer.getSimilarOutcomes({ test: true });
      expect(outcomes).toHaveLength(0);
    });

    it('should handle save without file path', async () => {
      buffer.addOutcome(sampleEnvelope.toJson());

      // Should not throw when saving without file path
      await expect(buffer.save()).resolves.not.toThrow();
    });

    it('should handle load without file path', async () => {
      // Should not throw when loading without file path
      await expect(buffer.load()).resolves.not.toThrow();
    });

    it('should preserve data integrity across save/load cycles', async () => {
      // Add multiple outcomes
      buffer.addOutcome(sampleEnvelope.toJson());

      const envelope2 = new PatchEnvelope('patch-002', { test: 'data' });
      buffer.addOutcome(envelope2.toJson());

      // Save and load
      await buffer.save(testFilePath);
      const newBuffer = new MemoryBuffer(100);
      await newBuffer.load(testFilePath);

      // Check both outcomes are preserved
      const similar1 = newBuffer.getSimilarOutcomes({ language: 'typescript' });
      const similar2 = newBuffer.getSimilarOutcomes({ test: 'data' });

      expect(similar1).toHaveLength(1);
      expect(similar2).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupted save data gracefully', async () => {
      // Write invalid JSON to file
      await fs.writeFile(testFilePath, 'invalid json');

      const newBuffer = new MemoryBuffer(100);

      // Should not throw, but should log error
      await expect(newBuffer.load(testFilePath)).resolves.not.toThrow();

      // Buffer should be empty after failed load
      const outcomes = newBuffer.getSimilarOutcomes({ anything: true });
      expect(outcomes).toHaveLength(0);
    });

    it('should handle save to invalid path gracefully', async () => {
      buffer.addOutcome(sampleEnvelope.toJson());

      // Should not throw even if save fails
      await expect(buffer.save('/invalid/path/file.json')).resolves.not.toThrow();
    });
  });
});