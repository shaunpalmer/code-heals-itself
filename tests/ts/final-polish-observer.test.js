"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const final_polish_observer_1 = require("../../utils/typescript/final_polish_observer");
(0, globals_1.describe)('Final Polish Observer - 95% Confidence + Zero Errors', () => {
    let observer;
    let mockESLintRunner;
    let mockChatAdapter;
    (0, globals_1.beforeEach)(() => {
        mockESLintRunner = globals_1.jest.fn().mockImplementation((code) => {
            // Mock ESLint formatting
            return Promise.resolve(String(code).replace(/\s+/g, ' ').trim() + '\n');
        });
        observer = new final_polish_observer_1.FinalPolishObserver(mockESLintRunner);
        mockChatAdapter = {
            addMessage: globals_1.jest.fn().mockImplementation(() => Promise.resolve())
        };
    });
    (0, globals_1.test)('should trigger final polish when confidence >= 95% and errors = 0', () => {
        (0, globals_1.expect)(observer.shouldApplyFinalPolish(0.95, 0)).toBe(true);
        (0, globals_1.expect)(observer.shouldApplyFinalPolish(0.97, 0)).toBe(true);
        (0, globals_1.expect)(observer.shouldApplyFinalPolish(1.0, 0)).toBe(true);
    });
    (0, globals_1.test)('should NOT trigger final polish when confidence < 95%', () => {
        (0, globals_1.expect)(observer.shouldApplyFinalPolish(0.94, 0)).toBe(false);
        (0, globals_1.expect)(observer.shouldApplyFinalPolish(0.80, 0)).toBe(false);
        (0, globals_1.expect)(observer.shouldApplyFinalPolish(0.50, 0)).toBe(false);
    });
    (0, globals_1.test)('should NOT trigger final polish when errors > 0', () => {
        (0, globals_1.expect)(observer.shouldApplyFinalPolish(0.95, 1)).toBe(false);
        (0, globals_1.expect)(observer.shouldApplyFinalPolish(0.98, 2)).toBe(false);
        (0, globals_1.expect)(observer.shouldApplyFinalPolish(1.0, 5)).toBe(false);
    });
    (0, globals_1.test)('should apply ESLint when conditions are met', async () => {
        const testCode = 'const    x   =   42   ;';
        const result = await observer.applyFinalPolish(testCode, 0.96, 0, 'test-patch-123');
        (0, globals_1.expect)(result.shouldLint).toBe(true);
        (0, globals_1.expect)(result.finalCode).toBe('const x = 42 ;\n');
        (0, globals_1.expect)(result.confidence).toBe(0.96);
        (0, globals_1.expect)(result.errorCount).toBe(0);
        (0, globals_1.expect)(result.successMessage).toBeDefined();
        (0, globals_1.expect)(mockESLintRunner).toHaveBeenCalledWith(testCode);
    });
    (0, globals_1.test)('should create success envelope with proper structure', () => {
        const envelope = observer.createSuccessEnvelope('patch-456', 0.97, 'const x = 42;', 3);
        (0, globals_1.expect)(envelope.type).toBe('success_celebration.v1');
        (0, globals_1.expect)(envelope.patch_id).toBe('patch-456');
        (0, globals_1.expect)(envelope.success_metrics.final_confidence).toBe(0.97);
        (0, globals_1.expect)(envelope.success_metrics.error_count).toBe(0);
        (0, globals_1.expect)(envelope.success_metrics.attempts_required).toBe(3);
        (0, globals_1.expect)(envelope.success_metrics.quality_threshold_met).toBe(true);
        (0, globals_1.expect)(envelope.celebration.achievement).toBe('high_confidence_healing');
        (0, globals_1.expect)(envelope.celebration.threshold_exceeded).toBe('97.0% confidence');
        (0, globals_1.expect)(envelope.final_state.code_polished).toBe(true);
        (0, globals_1.expect)(envelope.final_state.ready_for_deployment).toBe(true);
    });
    (0, globals_1.test)('should send success message to LLM with jitter', async () => {
        const successEnvelope = {
            type: 'success_celebration.v1',
            message: '🎉 Test success!',
            celebration: { jitter_delay_ms: 100 }
        };
        await observer.sendSuccessToLLM(mockChatAdapter, successEnvelope, 100);
        (0, globals_1.expect)(mockChatAdapter.addMessage).toHaveBeenCalledTimes(2);
        // First call should be the success celebration (use objectContaining to avoid duplicate-key literal)
        (0, globals_1.expect)(mockChatAdapter.addMessage).toHaveBeenNthCalledWith(1, 'tool', globals_1.expect.objectContaining({
            type: 'success_celebration',
            message: '🎉 Test success!',
            phase: 'celebration'
        }));
        // Second call should be acknowledgment request
        (0, globals_1.expect)(mockChatAdapter.addMessage).toHaveBeenNthCalledWith(2, 'system', globals_1.expect.objectContaining({
            type: 'success_acknowledgment_request',
            message: 'The debugging process completed successfully. Please acknowledge this achievement.'
        }));
    });
    (0, globals_1.test)('should handle ESLint failures gracefully', async () => {
        const failingESLint = globals_1.jest.fn().mockImplementation(() => Promise.reject(new Error('ESLint failed')));
        const observerWithFailingLint = new final_polish_observer_1.FinalPolishObserver(failingESLint);
        const result = await observerWithFailingLint.applyFinalPolish('const x = 42;', 0.96, 0);
        (0, globals_1.expect)(result.shouldLint).toBe(true);
        (0, globals_1.expect)(result.finalCode).toBe('const x = 42;'); // Should return original code on lint failure
        (0, globals_1.expect)(failingESLint).toHaveBeenCalled();
    });
    (0, globals_1.test)('should generate random success messages', () => {
        const message1 = observer['getRandomSuccessMessage']();
        const message2 = observer['getRandomSuccessMessage']();
        (0, globals_1.expect)(message1).toBeDefined();
        (0, globals_1.expect)(typeof message1).toBe('string');
        (0, globals_1.expect)(message1.length).toBeGreaterThan(0);
        // While messages could be the same due to randomness, they should be valid
        (0, globals_1.expect)(['🎉', '✨', '🚀', '🎯', '💯'].some(emoji => message1.includes(emoji))).toBe(true);
    });
    (0, globals_1.test)('createFinalPolishObserver factory should work', () => {
        const observer1 = (0, final_polish_observer_1.createFinalPolishObserver)(true);
        const observer2 = (0, final_polish_observer_1.createFinalPolishObserver)(false);
        (0, globals_1.expect)(observer1).toBeInstanceOf(final_polish_observer_1.FinalPolishObserver);
        (0, globals_1.expect)(observer2).toBeInstanceOf(final_polish_observer_1.FinalPolishObserver);
    });
});
(0, globals_1.describe)('Integration - Final Polish in AI Debugging Flow', () => {
    (0, globals_1.test)('should demonstrate the complete 95% confidence flow', async () => {
        // This test demonstrates how the final polish integrates with the main flow
        const mockTelemetry = [];
        const mockChat = {
            addMessage: globals_1.jest.fn().mockImplementation((role, data, meta) => {
                mockTelemetry.push({ role, data, meta });
            })
        };
        const observer = (0, final_polish_observer_1.createFinalPolishObserver)(true);
        // Simulate the conditions that trigger final polish
        const confidence = 0.97; // 97% confidence
        const errorCount = 0; // Zero errors
        const patchCode = 'function hello() { return "world"; }';
        // Check if polish should be applied
        const shouldApply = observer.shouldApplyFinalPolish(confidence, errorCount);
        (0, globals_1.expect)(shouldApply).toBe(true);
        // Apply final polish
        const result = await observer.applyFinalPolish(patchCode, confidence, errorCount, 'integration-test');
        (0, globals_1.expect)(result.shouldLint).toBe(true);
        // Create success envelope
        const envelope = observer.createSuccessEnvelope('integration-test', confidence, result.finalCode, 2);
        // Send to LLM
        await observer.sendSuccessToLLM(mockChat, envelope);
        // Verify the complete flow
        (0, globals_1.expect)(mockChat.addMessage).toHaveBeenCalledTimes(2);
        (0, globals_1.expect)(mockTelemetry.length).toBe(2);
        // Verify success celebration was sent
        (0, globals_1.expect)(mockTelemetry[0].data.type).toBe('success_celebration');
        (0, globals_1.expect)(mockTelemetry[1].data.type).toBe('success_acknowledgment_request');
        console.log('🎯 Integration test passed - LLM received success feedback!');
    });
});
