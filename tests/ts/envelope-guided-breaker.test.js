"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const confidence_scoring_1 = require("../../utils/typescript/confidence_scoring");
const ai_debugging_1 = require("../../ai-debugging");
describe('Envelope-Guided Circuit Breaker', () => {
    let breaker;
    let aiDebugger;
    beforeEach(() => {
        breaker = new confidence_scoring_1.DualCircuitBreaker(5, // syntax_max_attempts  
        7, // logic_max_attempts
        0.30, // syntax_error_budget (30%)
        0.40 // logic_error_budget (40%)
        );
        aiDebugger = new ai_debugging_1.AIDebugger({
            max_syntax_attempts: 5,
            max_logic_attempts: 7,
            syntax_error_budget: 0.30,
            logic_error_budget: 0.40,
            syntax_conf_floor: 0.25,
            logic_conf_floor: 0.20
        });
    });
    it('should demonstrate the 34→12→3 error improvement scenario', () => {
        console.log('\n🎯 TESTING THE 34→12→3 ERROR IMPROVEMENT TRAJECTORY');
        console.log('Simulating: Large codebase with cascading fixes that reduce error density');
        // Simulate debugging a large codebase (1200 lines) with systematic improvements
        const debuggingSession = [
            {
                attempt: 1,
                errorsDetected: 34,
                errorsResolved: 0,
                confidence: 0.40,
                linesOfCode: 1200,
                description: "Initial scan - many errors found"
            },
            {
                attempt: 2,
                errorsDetected: 22,
                errorsResolved: 12,
                confidence: 0.55,
                linesOfCode: 1200,
                description: "Fixed import statements - resolved many undefined reference errors"
            },
            {
                attempt: 3,
                errorsDetected: 12,
                errorsResolved: 10,
                confidence: 0.70,
                linesOfCode: 1200,
                description: "Added type annotations - caught type mismatches"
            },
            {
                attempt: 4,
                errorsDetected: 6,
                errorsResolved: 6,
                confidence: 0.82,
                linesOfCode: 1200,
                description: "Fixed async/await patterns - eliminated race conditions"
            },
            {
                attempt: 5,
                errorsDetected: 3,
                errorsResolved: 3,
                confidence: 0.91,
                linesOfCode: 1200,
                description: "Final cleanup - minor syntax issues"
            }
        ];
        const decisions = [];
        debuggingSession.forEach((session, index) => {
            // Record this debugging attempt
            breaker.record_attempt(confidence_scoring_1.ErrorType.LOGIC, true, // Each attempt was successful
            session.errorsDetected, session.errorsResolved, session.confidence, session.linesOfCode);
            // Get circuit breaker analysis
            const [canAttempt, reason] = breaker.can_attempt(confidence_scoring_1.ErrorType.LOGIC);
            const summary = breaker.get_state_summary();
            const errorDensity = (session.errorsDetected / session.linesOfCode) * 100; // errors per 100 lines
            decisions.push({
                attempt: session.attempt,
                canAttempt,
                recommendedAction: summary.recommended_action,
                strategy: summary.current_strategy,
                errorDensity: errorDensity,
                improvementVelocity: summary.improvement_velocity
            });
            console.log(`\nAttempt ${session.attempt}: ${session.description}`);
            console.log(`  Errors: ${session.errorsDetected}/${session.linesOfCode} lines (${errorDensity.toFixed(2)}% density)`);
            console.log(`  Resolved: ${session.errorsResolved}, Confidence: ${session.confidence.toFixed(2)}`);
            console.log(`  Can continue: ${canAttempt}, Recommended: ${summary.recommended_action || 'undefined'}`);
            console.log(`  Strategy: ${summary.current_strategy || 'undefined'}, Velocity: ${(summary.improvement_velocity || 0).toFixed(2)}`);
            console.log(`  Is improving: ${summary.is_improving}, Net positive: ${summary.net_positive_progress}`);
            // Debug: Show raw summary for first attempt
            if (index === 0) {
                console.log(`  Debug - Full summary:`, summary);
            }
        });
        // Verify that the circuit breaker recognized the improvement trajectory
        expect(decisions[1].canAttempt).toBe(true); // Should continue after first improvement
        expect(decisions[2].canAttempt).toBe(true); // Should continue with strong improvement
        expect(decisions[3].canAttempt).toBe(true); // Should continue with high confidence
        // Should recognize improving trend throughout
        const finalSummary = breaker.get_state_summary();
        expect(finalSummary.is_improving).toBe(true);
        // With sliding window of 3, velocity uses last 3 error counts (12→6→3) => (12-3)/3 = 3
        expect(finalSummary.improvement_velocity).toBeGreaterThanOrEqual(3);
        expect(finalSummary.recommended_action).toBe('promote'); // High confidence + improving = promote
        // Should detect the density improvement (34/1200 → 3/1200)
        expect(finalSummary.error_density_improving).toBe(true);
        expect(finalSummary.confidence_improving).toBe(true);
        expect(finalSummary.net_positive_progress).toBe(true);
        console.log('\n✅ Circuit breaker correctly tracked error density improvement over large codebase');
    });
    it('should use envelope metadata to make intelligent rollback decisions', () => {
        console.log('\n🔄 TESTING ENVELOPE-GUIDED ROLLBACK VS CONTINUE DECISIONS');
        // Simulate code where we're making things worse despite trying
        const failingSession = [
            { errors: 8, resolved: 0, confidence: 0.60, success: true, desc: "Initial working code" },
            { errors: 12, resolved: 0, confidence: 0.45, success: false, desc: "Introduced new bugs" },
            { errors: 15, resolved: 0, confidence: 0.30, success: false, desc: "Made it worse" },
            { errors: 14, resolved: 1, confidence: 0.25, success: false, desc: "Tiny improvement but still broken" }
        ];
        let finalDecision;
        failingSession.forEach((session, index) => {
            breaker.record_attempt(confidence_scoring_1.ErrorType.SYNTAX, session.success, session.errors, session.resolved, session.confidence, 500 // 500 lines of code
            );
            const summary = breaker.get_state_summary();
            finalDecision = summary;
            console.log(`\nAttempt ${index + 1}: ${session.desc}`);
            console.log(`  Errors: ${session.errors}, Resolved: ${session.resolved}`);
            console.log(`  Confidence: ${session.confidence}, Success: ${session.success}`);
            console.log(`  Recommended action: ${summary.recommended_action}`);
            console.log(`  Should continue: ${summary.should_continue_attempts}`);
            console.log(`  Error density improving: ${summary.error_density_improving}`);
            console.log(`  Net positive progress: ${summary.net_positive_progress}`);
        });
        // Should recommend rollback when things get worse
        expect(finalDecision.recommended_action).toBe('rollback');
        expect(finalDecision.should_continue_attempts).toBe(false);
        expect(finalDecision.error_density_improving).toBe(false);
        console.log('\n✅ Circuit breaker correctly recommended rollback when trend worsened');
    });
    it('should demonstrate full AIDebugger integration with envelope guidance', () => {
        var _a, _b;
        console.log('\n🤖 TESTING FULL AI DEBUGGER WITH ENVELOPE-GUIDED DECISIONS');
        // Test the comma fix scenario you described
        const originalBuggyCode = `
function processItems(items) {
  let results = [];
  for (let i = 0; i < items.length; i++) {
    results.push({
      id: items[i].id
      name: items[i].name,  // Missing comma causes cascade of parser errors
      value: calculate(items[i])
    });
  }
  return results;
}

function calculate(item) {
  return item.base * item.multiplier;
}

function validateResults(results) {
  return results.filter(r => r.valid);
}`;
        const fixedCode = `
function processItems(items) {
  let results = [];
  for (let i = 0; i < items.length; i++) {
    results.push({
      id: items[i].id,      // Fixed: Added missing comma
      name: items[i].name,
      value: calculate(items[i])
    });
  }
  return results;
}

function calculate(item) {
  return item.base * item.multiplier;
}

function validateResults(results) {
  return results.filter(r => r.valid);
}`;
        // Process the error with AI debugger
        const result = aiDebugger.process_error(confidence_scoring_1.ErrorType.SYNTAX, 'SyntaxError: Unexpected token - missing comma in object literal', fixedCode, originalBuggyCode, [0.85, 0.80, 0.75], // Good confidence - knows this is likely a comma issue
        { attempt_number: 1 }, { codebase_size: "medium", error_context: "object_literal" });
        console.log('\nAI Debugger Result:');
        console.log(`  Action: ${result.action}`);
        console.log(`  Breaker recommendation: ${result.extras.breaker_recommendation}`);
        console.log(`  Trend analysis:`, result.extras.trend_analysis);
        // Check the envelope metadata
        const envelope = result.envelope;
        console.log('\nEnvelope Trend Metadata:');
        console.log(`  Errors detected: ${envelope.trendMetadata.errorsDetected}`);
        console.log(`  Errors resolved: ${envelope.trendMetadata.errorsResolved}`);
        console.log(`  Error trend: ${envelope.trendMetadata.errorTrend}`);
        console.log(`  Code quality score: ${(_a = envelope.trendMetadata.codeQualityScore) === null || _a === void 0 ? void 0 : _a.toFixed(2)}`);
        console.log(`  Improvement velocity: ${(_b = envelope.trendMetadata.improvementVelocity) === null || _b === void 0 ? void 0 : _b.toFixed(2)}`);
        // Should recognize this as an improvement and recommend continuation
        expect(result.action).toBe('PROMOTE');
        expect(envelope.trendMetadata.errorsResolved).toBeGreaterThan(0);
        expect(envelope.trendMetadata.errorTrend).toBe('improving');
        console.log('\n✅ AI Debugger successfully used envelope metadata for intelligent decisions');
    });
    it('should demonstrate strategy switching based on envelope trends', () => {
        console.log('\n⚡ TESTING STRATEGY SWITCHING: SIMULATION → ROLLBACK → PROMOTE');
        const scenarios = [
            { phase: "simulation", errors: 20, resolved: 0, confidence: 0.30, desc: "Experimental fix - high risk" },
            { phase: "simulation", errors: 15, resolved: 5, confidence: 0.50, desc: "Showing promise - continue in sandbox" },
            { phase: "rollback", errors: 18, resolved: 0, confidence: 0.20, desc: "Regression - should trigger rollback" },
            { phase: "simulation", errors: 10, resolved: 8, confidence: 0.70, desc: "Back on track - try again" },
            { phase: "promote", errors: 3, resolved: 7, confidence: 0.90, desc: "High confidence - ready for production" }
        ];
        scenarios.forEach((scenario, index) => {
            breaker.record_attempt(confidence_scoring_1.ErrorType.LOGIC, scenario.confidence > 0.60, // Success if confidence is good
            scenario.errors, scenario.resolved, scenario.confidence, 800 // 800 lines of code
            );
            const summary = breaker.get_state_summary();
            console.log(`\n${scenario.phase.toUpperCase()} Phase - ${scenario.desc}`);
            console.log(`  Errors: ${scenario.errors}, Resolved: ${scenario.resolved}`);
            console.log(`  Confidence: ${scenario.confidence}, Strategy: ${summary.current_strategy}`);
            console.log(`  Recommended action: ${summary.recommended_action}`);
            console.log(`  Should continue: ${summary.should_continue_attempts}`);
            // Verify strategy matches expected phase
            if (scenario.phase === "promote" && scenario.confidence >= 0.85) {
                expect(summary.recommended_action).toBe('promote');
            }
            else if (scenario.phase === "rollback" && scenario.confidence < 0.30) {
                expect(['rollback', 'try_different_strategy']).toContain(summary.recommended_action);
            }
        });
        console.log('\n✅ Circuit breaker correctly switched strategies based on envelope trends');
    });
});
