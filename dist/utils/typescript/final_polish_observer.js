"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinalPolishObserver = void 0;
exports.createFinalPolishObserver = createFinalPolishObserver;
const observer_1 = require("./observer");
class FinalPolishObserver extends observer_1.Observer {
    constructor(eslintRunner, zodValidator) {
        super();
        this.eslintRunner = eslintRunner;
        this.zodValidator = zodValidator;
        this.CONFIDENCE_THRESHOLD = 0.95; // 95% confidence threshold
        this.SUCCESS_MESSAGES = [
            "🎉 Excellent work! Code successfully healed with high confidence.",
            "✨ Perfect execution! All errors resolved with 95%+ confidence.",
            "🚀 Outstanding! Code is now error-free and highly optimized.",
            "🎯 Success achieved! High-confidence solution implemented.",
            "💯 Brilliant! Code healing completed with exceptional quality."
        ];
    }
    update(subject, data) {
        // Observer pattern implementation - logs the final polish event
        console.log(`[FinalPolishObserver] ${data.message || 'Final polish triggered'}`);
    }
    /**
     * Check if the patch qualifies for final polishing (95% confidence + zero errors)
     */
    shouldApplyFinalPolish(confidence, errorCount) {
        return confidence >= this.CONFIDENCE_THRESHOLD && errorCount === 0;
    }
    /**
     * Apply final polish: lint the code and prepare success message
     */
    async applyFinalPolish(code, confidence, errorCount, patchId) {
        if (!this.shouldApplyFinalPolish(confidence, errorCount)) {
            return {
                shouldLint: false,
                confidence,
                errorCount
            };
        }
        console.log(`🎯 Final polish triggered! Confidence: ${(confidence * 100).toFixed(1)}%, Errors: ${errorCount}`);
        let finalCode = code;
        // Apply ESLint if available
        if (this.eslintRunner) {
            try {
                finalCode = await this.eslintRunner(code);
                console.log("✨ Code successfully linted for final polish");
            }
            catch (error) {
                console.warn("⚠️ Linting failed, using original code:", error);
                finalCode = code;
            }
        }
        // Generate success message with slight randomization
        const successMessage = this.getRandomSuccessMessage();
        return {
            shouldLint: true,
            finalCode,
            successMessage,
            confidence,
            errorCount
        };
    }
    /**
     * Create success envelope for LLM communication with jitter
     */
    createSuccessEnvelope(patchId, confidence, finalCode, originalAttempts = 1, metadata) {
        const jitterMs = Math.floor(Math.random() * 500) + 200; // 200-700ms jitter
        // Lightweight validator for metadata shape (small, local, no dependency)
        const extractCriticalHints = (md) => {
            if (!md || typeof md !== 'object')
                return undefined;
            const hints = {};
            if (Array.isArray(md.missing_paths) && md.missing_paths.length > 0) {
                hints.missing_paths = md.missing_paths;
            }
            if (Array.isArray(md.risk_flags) && md.risk_flags.length > 0) {
                // Only surface high/medium level flags to keep payload small
                hints.risk_flags = md.risk_flags.filter((f) => { var _a; return ['high', 'medium'].includes((_a = f.level) !== null && _a !== void 0 ? _a : ''); });
            }
            if (md.watchdog && md.watchdog.triggered) {
                hints.watchdog = { severity: md.watchdog.severity, reason: md.watchdog.reason };
            }
            return Object.keys(hints).length > 0 ? hints : undefined;
        };
        const criticalHints = extractCriticalHints(metadata);
        const payload = {
            type: 'success_celebration.v1',
            timestamp: new Date().toISOString(),
            patch_id: patchId,
            success_metrics: {
                final_confidence: confidence,
                error_count: 0,
                attempts_required: originalAttempts,
                quality_threshold_met: true
            },
            message: this.getRandomSuccessMessage(),
            celebration: {
                achievement: 'high_confidence_healing',
                threshold_exceeded: `${(confidence * 100).toFixed(1)}% confidence`,
                jitter_delay_ms: jitterMs
            },
            final_state: {
                code_polished: true,
                linting_applied: Boolean(this.eslintRunner),
                ready_for_deployment: true
            }
        };
        if (criticalHints)
            payload.hints = criticalHints;
        // If Stylelint metadata is present, attach a compact summary for quick scan
        const st = metadata === null || metadata === void 0 ? void 0 : metadata.stylelint;
        if (st && typeof st === 'object') {
            const warningCount = Array.isArray(st.warnings) ? st.warnings.length : 0;
            payload.stylelint_summary = { warning_count: warningCount, errored: Boolean(st.errored) };
        }
        return payload;
    }
    /**
     * Send celebration message to LLM with jitter delay
     */
    async sendSuccessToLLM(chatAdapter, envelope, jitterMs) {
        var _a, _b, _c;
        const delay = jitterMs || ((_a = envelope.celebration) === null || _a === void 0 ? void 0 : _a.jitter_delay_ms) || 300;
        // Apply jitter delay
        await new Promise(resolve => setTimeout(resolve, delay));
        // Optional Zod validation before sending
        if (this.zodValidator) {
            const validation = this.zodValidator(envelope);
            if (!validation.ok) {
                console.warn("⚠️ Zod validation failed for success envelope:", validation.errors);
                // Continue sending anyway - validation failure shouldn't block success celebration
            }
            else {
                console.log("✅ Success envelope validated with Zod");
            }
        }
        try {
            // Send the success message to the LLM. Spread the envelope first and then
            // override the type so that version suffixes (e.g. .v1) do not leak to the
            // receiver's expected canonical type.
            const celebrationPayload = {
                ...envelope,
                type: 'success_celebration',
                phase: 'celebration'
            };
            await chatAdapter.addMessage('tool', celebrationPayload);
            // Follow up with a brief acknowledgment request. Use optional chaining
            // for success_metrics so missing fields don't throw.
            const ackPayload = {
                type: 'success_acknowledgment_request',
                message: "The debugging process completed successfully. Please acknowledge this achievement.",
                confidence_achieved: (_c = (_b = envelope === null || envelope === void 0 ? void 0 : envelope.success_metrics) === null || _b === void 0 ? void 0 : _b.final_confidence) !== null && _c !== void 0 ? _c : null,
                timestamp: new Date().toISOString()
            };
            await chatAdapter.addMessage('system', ackPayload);
            console.log(`🎉 Success message sent to LLM with ${delay}ms jitter`);
        }
        catch (error) {
            // Keep the failure non-fatal and log details for telemetry/debugging
            console.warn("Failed to send success message to LLM:", error);
        }
    }
    getRandomSuccessMessage() {
        const randomIndex = Math.floor(Math.random() * this.SUCCESS_MESSAGES.length);
        return this.SUCCESS_MESSAGES[randomIndex];
    }
    /**
     * Run ESLint on the provided code
     */
    async runESLint(code) {
        // This is a placeholder - in practice, you'd integrate with actual ESLint
        try {
            // Mock ESLint processing
            console.log("Running ESLint for final polish...");
            // Basic formatting improvements
            let polished = code
                .replace(/;\s*\n\s*\n/g, ';\n\n') // Normalize double line breaks
                .replace(/,\s*\n\s*\n/g, ',\n\n') // Normalize comma line breaks
                .replace(/\s+$/gm, '') // Remove trailing whitespace
                .replace(/\n{3,}/g, '\n\n'); // Limit consecutive line breaks
            return polished;
        }
        catch (error) {
            console.warn("ESLint processing failed:", error);
            return code;
        }
    }
}
exports.FinalPolishObserver = FinalPolishObserver;
/**
 * Factory function to create a pre-configured FinalPolishObserver
 */
function createFinalPolishObserver(withESLint = true, zodValidator, overrideEslintRunner) {
    const defaultRunner = withESLint ?
        (code) => new FinalPolishObserver().runESLint(code) :
        undefined;
    const eslintRunner = overrideEslintRunner !== null && overrideEslintRunner !== void 0 ? overrideEslintRunner : defaultRunner;
    return new FinalPolishObserver(eslintRunner, zodValidator);
}
