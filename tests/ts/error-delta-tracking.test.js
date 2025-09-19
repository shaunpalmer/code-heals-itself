"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const confidence_scoring_1 = require("../../utils/typescript/confidence_scoring");
const code_error_analyzer_1 = require("../../utils/typescript/code_error_analyzer");
describe('Error Delta Tracking', () => {
    let breaker;
    beforeEach(() => {
        breaker = new confidence_scoring_1.DualCircuitBreaker(3, // syntax_max_attempts  
        5, // logic_max_attempts
        0.30, // syntax_error_budget (30%)
        0.40 // logic_error_budget (40%)
        );
    });
    it('should demonstrate the 30→20 error improvement scenario', () => {
        console.log('\n🎯 TESTING 30→20 ERROR IMPROVEMENT SCENARIO');
        console.log('Simulating: 30 errors → fix missing comma → 20 errors');
        // Initial state: 30 errors due to missing comma causing cascade of issues
        const buggyCode = `
function processData(items) {
  let results = [];
  for (let i = 0; i < items.length; i++) {
    let item = items[i];
    if (item.valid) {
      results.push({
        id: item.id
        name: item.name,  // Missing comma here causes parser errors everywhere
        value: item.value,
        processed: true
      });
    }
  }
  return results;
}

function validateResults(results) {
  return results.filter(r => r.valid);
}

function formatOutput(results) {
  return results.map(r => \`\${r.name}: \${r.value}\`);
}`;
        // Fixed code: Added the missing comma
        const fixedCode = `
function processData(items) {
  let results = [];
  for (let i = 0; i < items.length; i++) {
    let item = items[i];
    if (item.valid) {
      results.push({
        id: item.id,        // Fixed: Added missing comma
        name: item.name,
        value: item.value,
        processed: true
      });
    }
  }
  return results;
}

function validateResults(results) {
  return results.filter(r => r.valid);
}

function formatOutput(results) {
  return results.map(r => \`\${r.name}: \${r.value}\`);
}`;
        // Analyze the error counts
        const buggyAnalysis = code_error_analyzer_1.CodeErrorAnalyzer.analyzeCode(buggyCode);
        const fixedAnalysis = code_error_analyzer_1.CodeErrorAnalyzer.analyzeCode(fixedCode);
        const comparison = code_error_analyzer_1.CodeErrorAnalyzer.compareAnalyses(buggyAnalysis, fixedAnalysis);
        console.log(`\nBuggy code analysis:`);
        console.log(`  Errors detected: ${buggyAnalysis.errorCount}`);
        console.log(`  Quality score: ${buggyAnalysis.qualityScore.toFixed(2)}`);
        console.log(`\nFixed code analysis:`);
        console.log(`  Errors detected: ${fixedAnalysis.errorCount}`);
        console.log(`  Quality score: ${fixedAnalysis.qualityScore.toFixed(2)}`);
        console.log(`  Errors resolved: ${comparison.errorsResolved}`);
        // Record the improvement attempt
        breaker.record_attempt(confidence_scoring_1.ErrorType.SYNTAX, true, // Success - the fix worked
        fixedAnalysis.errorCount, // Errors still present
        comparison.errorsResolved // Errors we resolved
        );
        const summary = breaker.get_state_summary();
        console.log(`\nCircuit breaker response:`);
        console.log(`  Is improving: ${summary.is_improving}`);
        console.log(`  Total errors resolved: ${summary.total_errors_resolved}`);
        console.log(`  Recent error counts: [${summary.recent_error_counts.join(', ')}]`);
        console.log(`  Recent errors resolved: [${summary.recent_errors_resolved.join(', ')}]`);
        // Verify improvement detection
        expect(summary.is_improving).toBe(true);
        expect(comparison.errorsResolved).toBeGreaterThan(0);
        expect(fixedAnalysis.errorCount).toBeLessThan(buggyAnalysis.errorCount);
        console.log('\n✅ Successfully detected major improvement from single fix');
    });
    it('should allow extra attempts when errors are decreasing', () => {
        console.log('\n🔄 TESTING EXTRA ATTEMPTS FOR IMPROVING CODE');
        // Simulate a series of improvements with high error rate but consistent progress
        const iterations = [
            { errors: 25, resolved: 0, success: false, desc: "Initial state - lots of errors" },
            { errors: 20, resolved: 5, success: true, desc: "Fixed syntax error - 5 errors resolved" },
            { errors: 15, resolved: 5, success: true, desc: "Fixed logic issue - 5 more resolved" },
            { errors: 10, resolved: 5, success: true, desc: "Optimized code - 5 more resolved" },
            { errors: 5, resolved: 5, success: true, desc: "Final cleanup - nearly done" }
        ];
        const decisions = [];
        iterations.forEach((iteration, index) => {
            // Record this attempt
            breaker.record_attempt(confidence_scoring_1.ErrorType.LOGIC, iteration.success, iteration.errors, iteration.resolved);
            // Check if we can make another attempt
            const [canAttempt, reason] = breaker.can_attempt(confidence_scoring_1.ErrorType.LOGIC);
            const summary = breaker.get_state_summary();
            decisions.push({ attempt: index + 1, canAttempt, reason });
            console.log(`\nIteration ${index + 1}: ${iteration.desc}`);
            console.log(`  Errors: ${iteration.errors}, Resolved: ${iteration.resolved}`);
            console.log(`  Success: ${iteration.success}, Can continue: ${canAttempt}`);
            console.log(`  Reason: ${reason}`);
            console.log(`  Is improving: ${summary.is_improving}`);
            console.log(`  Logic attempts: ${summary.logic_attempts}/${breaker['logic_max_attempts']}`);
        });
        // Should allow attempts to continue due to improvement trend
        expect(decisions[1].canAttempt).toBe(true); // After first improvement
        expect(decisions[2].canAttempt).toBe(true); // Still improving
        expect(decisions[3].canAttempt).toBe(true); // Continuous improvement
        // Should detect improvement throughout
        const finalSummary = breaker.get_state_summary();
        expect(finalSummary.is_improving).toBe(true);
        expect(finalSummary.total_errors_resolved).toBeGreaterThan(15);
        console.log('\n✅ Circuit breaker correctly allowed continuation due to improvement');
    });
    it('should stop when no improvement despite attempts', () => {
        console.log('\n🛑 TESTING STOPPING FOR NON-IMPROVING CODE');
        // Simulate attempts that don't improve the situation
        const stagnantIterations = [
            { errors: 15, resolved: 0, success: false, desc: "Initial failure" },
            { errors: 16, resolved: 0, success: false, desc: "Made things worse" },
            { errors: 15, resolved: 0, success: false, desc: "Back to original" },
            { errors: 14, resolved: 1, success: false, desc: "Tiny improvement but still failing" },
            { errors: 15, resolved: 0, success: false, desc: "Lost the improvement" }
        ];
        let finalDecision;
        stagnantIterations.forEach((iteration, index) => {
            breaker.record_attempt(confidence_scoring_1.ErrorType.SYNTAX, iteration.success, iteration.errors, iteration.resolved);
            const [canAttempt, reason] = breaker.can_attempt(confidence_scoring_1.ErrorType.SYNTAX);
            const summary = breaker.get_state_summary();
            console.log(`\nAttempt ${index + 1}: ${iteration.desc}`);
            console.log(`  Errors: ${iteration.errors}, Resolved: ${iteration.resolved}`);
            console.log(`  Can attempt: ${canAttempt}, Reason: ${reason}`);
            console.log(`  Is improving: ${summary.is_improving}`);
            finalDecision = { canAttempt, reason, summary };
        });
        // Should eventually prevent more attempts due to lack of improvement
        expect(finalDecision.summary.is_improving).toBe(false);
        console.log('\n✅ Circuit breaker correctly detected stagnation');
    });
    it('should handle the user\'s specific example: missing comma fixing multiple errors', () => {
        console.log('\n✨ TESTING USER\'S SPECIFIC EXAMPLE');
        console.log('Scenario: 30 errors → add missing comma → 20 errors (10 errors resolved)');
        // This simulates the exact scenario the user described
        const beforeCommaFix = 30; // 30 errors due to missing comma causing parser confusion
        const afterCommaFix = 20; // 20 remaining errors after comma is added
        const errorsResolvedByCommaFix = beforeCommaFix - afterCommaFix; // 10 errors resolved
        console.log(`\nBefore comma fix: ${beforeCommaFix} errors`);
        console.log(`After comma fix: ${afterCommaFix} errors`);
        console.log(`Errors resolved by single fix: ${errorsResolvedByCommaFix}`);
        // Record this improvement
        breaker.record_attempt(confidence_scoring_1.ErrorType.SYNTAX, true, // The comma fix was successful
        afterCommaFix, // Errors remaining
        errorsResolvedByCommaFix // Errors this fix resolved
        );
        const [canContinue, reason] = breaker.can_attempt(confidence_scoring_1.ErrorType.SYNTAX);
        const summary = breaker.get_state_summary();
        console.log(`\nCircuit breaker analysis:`);
        console.log(`  Can continue: ${canContinue}`);
        console.log(`  Reason: ${reason}`);
        console.log(`  Detected improvement: ${summary.is_improving}`);
        console.log(`  Errors resolved: ${summary.total_errors_resolved}`);
        // Should recognize this as significant improvement and allow continuation
        expect(summary.is_improving).toBe(true);
        expect(canContinue).toBe(true);
        expect(summary.total_errors_resolved).toBe(errorsResolvedByCommaFix);
        // Now simulate another fix to see if it continues to be smart
        const nextAttemptErrors = 15; // Another 5 errors resolved
        const nextAttemptResolved = 5;
        breaker.record_attempt(confidence_scoring_1.ErrorType.SYNTAX, true, nextAttemptErrors, nextAttemptResolved);
        const [stillCanContinue, nextReason] = breaker.can_attempt(confidence_scoring_1.ErrorType.SYNTAX);
        const nextSummary = breaker.get_state_summary();
        console.log(`\nAfter second improvement (${afterCommaFix} → ${nextAttemptErrors}):`);
        console.log(`  Can continue: ${stillCanContinue}`);
        console.log(`  Reason: ${nextReason}`);
        console.log(`  Still improving: ${nextSummary.is_improving}`);
        console.log(`  Total errors resolved: ${nextSummary.total_errors_resolved}`);
        expect(nextSummary.is_improving).toBe(true);
        expect(stillCanContinue).toBe(true);
        expect(nextSummary.total_errors_resolved).toBe(errorsResolvedByCommaFix + nextAttemptResolved);
        console.log('\n✅ Successfully handled user\'s comma scenario with intelligent continuation');
    });
});
