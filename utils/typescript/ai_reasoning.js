"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIEnhancedStrategy = exports.AIReasoningEngine = exports.PatternLearner = void 0;
class PatternLearner {
    constructor() {
        this.patterns = new Map();
    }
    learnFromOutcome(patternType, success, executionTime) {
        if (!this.patterns.has(patternType)) {
            this.patterns.set(patternType, {
                success_count: 0,
                failure_count: 0,
                avg_time: 0
            });
        }
        const stats = this.patterns.get(patternType);
        stats.success_count += success ? 1 : 0;
        stats.failure_count += success ? 0 : 1;
        // Update rolling average
        const currentAvg = stats.avg_time;
        const count = stats.success_count + stats.failure_count;
        stats.avg_time = (currentAvg * (count - 1) + executionTime) / count;
    }
    getBestPattern(availablePatterns) {
        let bestPattern = "";
        let bestScore = -1;
        for (const pattern of availablePatterns) {
            const stats = this.patterns.get(pattern);
            if (!stats)
                continue;
            const total = stats.success_count + stats.failure_count;
            if (total === 0)
                continue;
            const successRate = stats.success_count / total;
            if (successRate > bestScore) {
                bestScore = successRate;
                bestPattern = pattern;
            }
        }
        return bestPattern || (availablePatterns[0] || "LogAndFixStrategy");
    }
    getPatternStats() {
        const result = {};
        for (const [key, value] of this.patterns) {
            result[key] = value;
        }
        return result;
    }
}
exports.PatternLearner = PatternLearner;
class AIReasoningEngine {
    constructor(learner, memoryBuffer = null) {
        this.learner = learner;
        this.memoryBuffer = memoryBuffer;
        this.decisionLog = [];
    }
    reasonAboutPatch(context) {
        const errorType = context.error_type || "unknown";
        const availableStrategies = ["LogAndFixStrategy", "RollbackStrategy", "SecurityAuditStrategy"];
        const bestStrategy = this.learner.getBestPattern(availableStrategies);
        // Check memory buffer for similar past outcomes
        let similarOutcomes = [];
        if (this.memoryBuffer) {
            similarOutcomes = this.memoryBuffer.getSimilarOutcomes(context);
        }
        const reasoning = {
            error_analysis: `Detected ${errorType} error`,
            historical_performance: this.learner.getPatternStats(),
            recommended_strategy: bestStrategy,
            confidence: this.calculateConfidence(bestStrategy),
            alternative_strategies: availableStrategies.filter(s => s !== bestStrategy),
            similar_past_outcomes: similarOutcomes.length,
            learning_insights: this.extractInsights(similarOutcomes)
        };
        this.decisionLog.push({
            context: context,
            reasoning: reasoning,
            timestamp: new Date().toISOString()
        });
        return reasoning;
    }
    calculateConfidence(strategy) {
        const stats = this.learner.getPatternStats()[strategy];
        if (!stats)
            return 0.5; // Neutral confidence for new strategies
        const total = stats.success_count + stats.failure_count;
        if (total === 0)
            return 0.5;
        return stats.success_count / total;
    }
    extractInsights(similarOutcomes) {
        if (similarOutcomes.length === 0) {
            return { insights: "No similar past outcomes found" };
        }
        let successCount = 0;
        for (const outcome of similarOutcomes) {
            const envelopeData = JSON.parse(outcome.envelope);
            if (envelopeData.success) {
                successCount++;
            }
        }
        const successRate = successCount / similarOutcomes.length;
        return {
            success_rate_in_similar_cases: successRate,
            recommendation: successRate < 0.7 ? "Proceed with caution" : "High confidence",
            patterns_to_avoid: this.identifyFailurePatterns(similarOutcomes)
        };
    }
    identifyFailurePatterns(outcomes) {
        var _a;
        const failurePatterns = [];
        for (const outcome of outcomes) {
            const envelopeData = JSON.parse(outcome.envelope);
            if (!envelopeData.success) {
                if (envelopeData.flagged_for_developer) {
                    failurePatterns.push("Flagged for developer - complex issue");
                }
                if ((_a = envelopeData.simulation_details) === null || _a === void 0 ? void 0 : _a.circuit_breaker_tripped) {
                    failurePatterns.push("Circuit breaker tripped - potential infinite loop");
                }
            }
        }
        return [...new Set(failurePatterns)]; // Remove duplicates
    }
}
exports.AIReasoningEngine = AIReasoningEngine;
class DebuggingStrategy {
}
class AIEnhancedStrategy extends DebuggingStrategy {
    constructor(baseStrategy, reasoningEngine, envelopeWrapper = null) {
        super();
        this.baseStrategy = baseStrategy;
        this.reasoningEngine = reasoningEngine;
        this.envelopeWrapper = envelopeWrapper;
    }
    execute(context) {
        const reasoning = this.reasoningEngine.reasonAboutPatch(context);
        const baseOutcome = this.baseStrategy.execute(context);
        // Wrap in envelope if available
        if (this.envelopeWrapper) {
            const envelope = this.envelopeWrapper.wrapPatch(context);
            const envelopeResult = this.envelopeWrapper.unwrapAndExecute(envelope);
            return {
                ...baseOutcome,
                ai_reasoning: reasoning,
                envelope_result: envelopeResult,
                strategy: `AIEnhanced${this.baseStrategy.constructor.name}`
            };
        }
        else {
            return {
                ...baseOutcome,
                ai_reasoning: reasoning,
                strategy: `AIEnhanced${this.baseStrategy.constructor.name}`
            };
        }
    }
}
exports.AIEnhancedStrategy = AIEnhancedStrategy;
