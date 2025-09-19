import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { FinalPolishObserver, createFinalPolishObserver } from '../../utils/typescript/final_polish_observer';

describe('Final Polish Observer - 95% Confidence + Zero Errors', () => {
  let observer: FinalPolishObserver;
  let mockESLintRunner: any;
  let mockChatAdapter: any;

  beforeEach(() => {
    mockESLintRunner = jest.fn().mockImplementation((code: any) => {
      // Mock ESLint formatting
      return Promise.resolve(String(code).replace(/\s+/g, ' ').trim() + '\n');
    });

    observer = new FinalPolishObserver(mockESLintRunner as any);

    mockChatAdapter = {
      addMessage: jest.fn().mockImplementation(() => Promise.resolve())
    };
  });

  test('should trigger final polish when confidence >= 95% and errors = 0', () => {
    expect(observer.shouldApplyFinalPolish(0.95, 0)).toBe(true);
    expect(observer.shouldApplyFinalPolish(0.97, 0)).toBe(true);
    expect(observer.shouldApplyFinalPolish(1.0, 0)).toBe(true);
  });

  test('should NOT trigger final polish when confidence < 95%', () => {
    expect(observer.shouldApplyFinalPolish(0.94, 0)).toBe(false);
    expect(observer.shouldApplyFinalPolish(0.80, 0)).toBe(false);
    expect(observer.shouldApplyFinalPolish(0.50, 0)).toBe(false);
  });

  test('should NOT trigger final polish when errors > 0', () => {
    expect(observer.shouldApplyFinalPolish(0.95, 1)).toBe(false);
    expect(observer.shouldApplyFinalPolish(0.98, 2)).toBe(false);
    expect(observer.shouldApplyFinalPolish(1.0, 5)).toBe(false);
  });

  test('should apply ESLint when conditions are met', async () => {
    const testCode = 'const    x   =   42   ;';
    const result = await observer.applyFinalPolish(testCode, 0.96, 0, 'test-patch-123');

    expect(result.shouldLint).toBe(true);
    expect(result.finalCode).toBe('const x = 42 ;\n');
    expect(result.confidence).toBe(0.96);
    expect(result.errorCount).toBe(0);
    expect(result.successMessage).toBeDefined();
    expect(mockESLintRunner).toHaveBeenCalledWith(testCode);
  });

  test('should create success envelope with proper structure', () => {
    const envelope = observer.createSuccessEnvelope('patch-456', 0.97, 'const x = 42;', 3);

    expect(envelope.type).toBe('success_celebration.v1');
    expect(envelope.patch_id).toBe('patch-456');
    expect(envelope.success_metrics.final_confidence).toBe(0.97);
    expect(envelope.success_metrics.error_count).toBe(0);
    expect(envelope.success_metrics.attempts_required).toBe(3);
    expect(envelope.success_metrics.quality_threshold_met).toBe(true);
    expect(envelope.celebration.achievement).toBe('high_confidence_healing');
    expect(envelope.celebration.threshold_exceeded).toBe('97.0% confidence');
    expect(envelope.final_state.code_polished).toBe(true);
    expect(envelope.final_state.ready_for_deployment).toBe(true);
  });

  test('should send success message to LLM with jitter', async () => {
    const successEnvelope = {
      type: 'success_celebration.v1',
      message: '🎉 Test success!',
      celebration: { jitter_delay_ms: 100 }
    };

    await observer.sendSuccessToLLM(mockChatAdapter, successEnvelope, 100);

    expect(mockChatAdapter.addMessage).toHaveBeenCalledTimes(2);

    // First call should be the success celebration (use objectContaining to avoid duplicate-key literal)
    expect(mockChatAdapter.addMessage).toHaveBeenNthCalledWith(1, 'tool', expect.objectContaining({
      type: 'success_celebration',
      message: '🎉 Test success!',
      phase: 'celebration'
    }));

    // Second call should be acknowledgment request
    expect(mockChatAdapter.addMessage).toHaveBeenNthCalledWith(2, 'system',
      expect.objectContaining({
        type: 'success_acknowledgment_request',
        message: 'The debugging process completed successfully. Please acknowledge this achievement.'
      })
    );
  });

  test('should handle ESLint failures gracefully', async () => {
    const failingESLint: any = jest.fn().mockImplementation(() => Promise.reject(new Error('ESLint failed')));
    const observerWithFailingLint = new FinalPolishObserver(failingESLint as any);

    const result = await observerWithFailingLint.applyFinalPolish('const x = 42;', 0.96, 0);

    expect(result.shouldLint).toBe(true);
    expect(result.finalCode).toBe('const x = 42;'); // Should return original code on lint failure
    expect(failingESLint).toHaveBeenCalled();
  });

  test('should generate random success messages', () => {
    const message1 = observer['getRandomSuccessMessage']();
    const message2 = observer['getRandomSuccessMessage']();

    expect(message1).toBeDefined();
    expect(typeof message1).toBe('string');
    expect(message1.length).toBeGreaterThan(0);

    // While messages could be the same due to randomness, they should be valid
    expect(['🎉', '✨', '🚀', '🎯', '💯'].some(emoji => message1.includes(emoji))).toBe(true);
  });

  test('createFinalPolishObserver factory should work', () => {
    const observer1 = createFinalPolishObserver(true);
    const observer2 = createFinalPolishObserver(false);

    expect(observer1).toBeInstanceOf(FinalPolishObserver);
    expect(observer2).toBeInstanceOf(FinalPolishObserver);
  });
});

describe('Integration - Final Polish in AI Debugging Flow', () => {
  test('should demonstrate the complete 95% confidence flow', async () => {
    // This test demonstrates how the final polish integrates with the main flow
    const mockTelemetry: any[] = [];
    const mockChat = {
      addMessage: jest.fn().mockImplementation((role, data, meta) => {
        mockTelemetry.push({ role, data, meta });
      })
    };

    const observer = createFinalPolishObserver(true);

    // Simulate the conditions that trigger final polish
    const confidence = 0.97; // 97% confidence
    const errorCount = 0;     // Zero errors
    const patchCode = 'function hello() { return "world"; }';

    // Check if polish should be applied
    const shouldApply = observer.shouldApplyFinalPolish(confidence, errorCount);
    expect(shouldApply).toBe(true);

    // Apply final polish
    const result = await observer.applyFinalPolish(patchCode, confidence, errorCount, 'integration-test');
    expect(result.shouldLint).toBe(true);

    // Create success envelope
    const envelope = observer.createSuccessEnvelope('integration-test', confidence, result.finalCode!, 2);

    // Send to LLM
    await observer.sendSuccessToLLM(mockChat, envelope);

    // Verify the complete flow
    expect(mockChat.addMessage).toHaveBeenCalledTimes(2);
    expect(mockTelemetry.length).toBe(2);

    // Verify success celebration was sent
    expect(mockTelemetry[0].data.type).toBe('success_celebration');
    expect(mockTelemetry[1].data.type).toBe('success_acknowledgment_request');

    console.log('🎯 Integration test passed - LLM received success feedback!');
  });
});