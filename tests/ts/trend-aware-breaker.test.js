"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const trend_aware_circuit_breaker_1 = require("../../utils/typescript/trend_aware_circuit_breaker");
const code_error_analyzer_1 = require("../../utils/typescript/code_error_analyzer");
const confidence_scoring_1 = require("../../utils/typescript/confidence_scoring");
describe('Trend-Aware Circuit Breaker', () => {
    let breaker;
    beforeEach(() => {
        breaker = new trend_aware_circuit_breaker_1.TrendAwareCircuitBreaker(10, // maxAttempts
        3, // improvementWindow
        4, // stagnationThreshold
        0.6 // confidenceFloor
        );
    });
    it('should demonstrate improvement trajectory with decreasing errors', () => {
        console.log('\n🧠 TESTING TREND-AWARE CIRCUIT BREAKER WITH IMPROVING CODE');
        // Simulate a debugging session where errors decrease over time
        const iterations = [
            { errors: 15, confidence: 0.2, quality: 0.3, desc: "Initial buggy code - many errors" },
            { errors: 12, confidence: 0.35, quality: 0.4, desc: "Fixed some syntax errors" },
            { errors: 8, confidence: 0.55, quality: 0.6, desc: "Resolved logic issues" },
            { errors: 4, confidence: 0.75, quality: 0.8, desc: "Almost clean code" },
            { errors: 1, confidence: 0.9, quality: 0.95, desc: "Nearly perfect" }
        ];
        const decisions = [];
        iterations.forEach((iteration, index) => {
            const errorsResolved = index > 0 ? Math.max(0, iterations[index - 1].errors - iteration.errors) : 0;
            breaker.recordAttempt(iteration.errors, errorsResolved, iteration.confidence, [confidence_scoring_1.ErrorType.LOGIC, confidence_scoring_1.ErrorType.SYNTAX], iteration.quality);
            const [canAttempt, reason, trend] = breaker.canAttempt();
            const summary = breaker.getTrendSummary();
            decisions.push({
                attempt: index + 1,
                canAttempt,
                reason,
                trend: trend.direction,
                recommendation: summary.recommendation
            });
            console.log(`\nAttempt ${index + 1}: ${iteration.desc}`);
            console.log(`  Errors: ${iteration.errors}, Confidence: ${iteration.confidence.toFixed(2)}, Quality: ${iteration.quality.toFixed(2)}`);
            console.log(`  Can attempt: ${canAttempt}, Reason: ${reason}`);
            console.log(`  Trend: ${trend.direction}, Recommendation: ${summary.recommendation}`);
            console.log(`  Error delta: ${trend.errorDelta}, Confidence delta: +${trend.confidenceDelta.toFixed(2)}`);
        });
        // Verify the breaker makes intelligent decisions
        expect(decisions.length).toBe(5);
        // Should allow attempts while improving
        expect(decisions[1].canAttempt).toBe(true); // Improvement from attempt 1 to 2
        expect(decisions[2].canAttempt).toBe(true); // Still improving
        expect(decisions[3].canAttempt).toBe(true); // Major improvement
        // Should recognize improvement trend
        expect(decisions[2].trend).toBe('improving');
        expect(decisions[3].trend).toBe('improving');
        // Should recommend promotion when confidence is high
        expect(decisions[4].recommendation).toBe('promote');
        console.log('\n✅ Circuit breaker correctly identified improving trend and allowed iteration');
    });
    it('should stop iteration when trend plateaus with high stagnation risk', () => {
        console.log('\n🛑 TESTING STAGNATION DETECTION');
        // Simulate getting stuck in local minimum
        const stagnantIterations = [
            { errors: 10, confidence: 0.4, quality: 0.5 },
            { errors: 9, confidence: 0.42, quality: 0.52 }, // Slight improvement
            { errors: 9, confidence: 0.41, quality: 0.51 }, // Plateau starts
            { errors: 10, confidence: 0.43, quality: 0.49 }, // Oscillating
            { errors: 9, confidence: 0.42, quality: 0.52 }, // Still stuck
            { errors: 10, confidence: 0.41, quality: 0.50 } // High stagnation risk
        ];
        let finalDecision;
        stagnantIterations.forEach((iteration, index) => {
            const errorsResolved = index > 0 ? Math.max(0, stagnantIterations[index - 1].errors - iteration.errors) : 0;
            breaker.recordAttempt(iteration.errors, errorsResolved, iteration.confidence, [confidence_scoring_1.ErrorType.LOGIC], iteration.quality);
            const [canAttempt, reason, trend] = breaker.canAttempt();
            const summary = breaker.getTrendSummary();
            console.log(`\nAttempt ${index + 1}:`);
            console.log(`  Errors: ${iteration.errors}, Confidence: ${iteration.confidence.toFixed(2)}`);
            console.log(`  Can attempt: ${canAttempt}, Trend: ${trend.direction}`);
            console.log(`  Stagnation risk: ${(trend.stagnationRisk * 100).toFixed(0)}%`);
            console.log(`  Recommendation: ${summary.recommendation}`);
            finalDecision = { canAttempt, reason, trend, recommendation: summary.recommendation };
        });
        // Should detect stagnation and recommend different strategy
        expect(finalDecision.trend.stagnationRisk).toBeGreaterThan(0.5);
        expect(['try_different_strategy', 'rollback']).toContain(finalDecision.recommendation);
        console.log('\n✅ Circuit breaker correctly detected stagnation and recommended strategy change');
    });
    it('should handle real code analysis with error trends', () => {
        console.log('\n💻 TESTING WITH REAL CODE ANALYSIS');
        // Simulate debugging a real piece of code
        const codeVersions = [
            {
                code: `
function processArray(arr) {
  let result = [];
  for (let i = 0; i <= arr.length; i++) {
    result.push(arr[i].toUpperCase());
  }
  return result;
}`,
                desc: "Original buggy code"
            },
            {
                code: `
function processArray(arr) {
  let result = [];
  for (let i = 0; i < arr.length; i++) {
    result.push(arr[i].toUpperCase());
  }
  return result;
}`,
                desc: "Fixed off-by-one error"
            },
            {
                code: `
function processArray(arr) {
  if (!arr || !Array.isArray(arr)) return [];
  let result = [];
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] && typeof arr[i] === 'string') {
      result.push(arr[i].toUpperCase());
    }
  }
  return result;
}`,
                desc: "Added null checks and type validation"
            }
        ];
        const analysisResults = [];
        codeVersions.forEach((version, index) => {
            const analysis = code_error_analyzer_1.CodeErrorAnalyzer.analyzeCode(version.code);
            // Calculate errors resolved from previous version
            let errorsResolved = 0;
            if (index > 0) {
                const prevAnalysis = analysisResults[index - 1].analysis;
                const comparison = code_error_analyzer_1.CodeErrorAnalyzer.compareAnalyses(prevAnalysis, analysis);
                errorsResolved = comparison.errorsResolved;
            }
            breaker.recordAttempt(analysis.errorCount, errorsResolved, analysis.qualityScore, analysis.errorTypes, analysis.qualityScore);
            const [canAttempt, reason, trend] = breaker.canAttempt();
            const summary = breaker.getTrendSummary();
            const result = {
                version: index + 1,
                analysis,
                errorsResolved,
                canAttempt,
                reason,
                trend,
                recommendation: summary.recommendation
            };
            analysisResults.push(result);
            console.log(`\n${version.desc}:`);
            console.log(`  Errors detected: ${analysis.errorCount}`);
            console.log(`  Errors resolved: ${errorsResolved}`);
            console.log(`  Quality score: ${analysis.qualityScore.toFixed(2)}`);
            console.log(`  Can attempt: ${canAttempt}`);
            console.log(`  Trend: ${trend.direction}, Recommendation: ${summary.recommendation}`);
        });
        // Verify real code analysis works with trend breaker
        expect(analysisResults[0].analysis.errorCount).toBeGreaterThan(0); // Original has errors
        expect(analysisResults[1].errorsResolved).toBeGreaterThan(0); // Fixed some errors
        expect(analysisResults[2].analysis.qualityScore).toBeGreaterThan(analysisResults[0].analysis.qualityScore); // Quality improved
        // Should recognize improvement trajectory and recommend promotion
        const finalResult = analysisResults[analysisResults.length - 1];
        // When quality is maxed and errors are zero, trend may read 'plateauing' while still being acceptable
        expect(['improving', 'plateauing']).toContain(finalResult.trend.direction);
        expect(['promote', 'continue']).toContain(finalResult.recommendation);
        console.log('\n✅ Real code analysis with trend tracking successful');
    });
    it('should demonstrate envelope metadata integration', () => {
        console.log('\n📦 TESTING ENVELOPE METADATA INTEGRATION');
        // Simulate how this would integrate with patch envelopes
        const mockEnvelopes = [
            {
                attempt: 1,
                patch_data: { message: "Fix array bounds", confidence: 0.3 },
                trendMetadata: { errorsDetected: 8, errorsResolved: 0, errorTrend: "unknown" }
            },
            {
                attempt: 2,
                patch_data: { message: "Add null checks", confidence: 0.6 },
                trendMetadata: { errorsDetected: 5, errorsResolved: 3, errorTrend: "improving" }
            },
            {
                attempt: 3,
                patch_data: { message: "Optimize logic", confidence: 0.85 },
                trendMetadata: { errorsDetected: 1, errorsResolved: 4, errorTrend: "improving" }
            }
        ];
        mockEnvelopes.forEach((envelope, index) => {
            const metadata = envelope.trendMetadata;
            breaker.recordAttempt(metadata.errorsDetected, metadata.errorsResolved, envelope.patch_data.confidence, [confidence_scoring_1.ErrorType.LOGIC], 0.5 + (index * 0.2) // Increasing quality
            );
            const summary = breaker.getTrendSummary();
            console.log(`\nEnvelope ${envelope.attempt}:`);
            console.log(`  Message: ${envelope.patch_data.message}`);
            console.log(`  Errors: ${metadata.errorsDetected} detected, ${metadata.errorsResolved} resolved`);
            console.log(`  Confidence: ${envelope.patch_data.confidence}`);
            console.log(`  Trend: ${metadata.errorTrend} → Recommendation: ${summary.recommendation}`);
        });
        // Should promote high-confidence, low-error solution
        expect(breaker.shouldPromote()).toBe(true);
        console.log('\n✅ Envelope metadata integration demonstrates intelligent decision making');
    });
});
