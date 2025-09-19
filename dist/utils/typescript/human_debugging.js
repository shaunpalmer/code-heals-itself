"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeniorDeveloperSimulator = exports.MentalSimulationHeuristic = exports.PathAnalysisHeuristic = exports.HumanDebuggingHeuristic = void 0;
class HumanDebuggingHeuristic {
}
exports.HumanDebuggingHeuristic = HumanDebuggingHeuristic;
class PathAnalysisHeuristic extends HumanDebuggingHeuristic {
    analyzeError(error, context) {
        if (error.toLowerCase().includes('undefined')) {
            return {
                heuristic: 'PathAnalysis',
                analysis: 'Likely a path resolution issue',
                suggested_fixes: ['Check file paths', 'Use absolute paths', 'Verify constants'],
                confidence: 0.8
            };
        }
        else if (error.toLowerCase().includes('overflow')) {
            return {
                heuristic: 'PathAnalysis',
                analysis: 'Buffer or stack overflow detected',
                suggested_fixes: ['Add bounds checking', 'Use safer data structures', 'Implement circuit breaker'],
                confidence: 0.9
            };
        }
        return { heuristic: 'PathAnalysis', analysis: 'Unknown pattern', confidence: 0.1 };
    }
}
exports.PathAnalysisHeuristic = PathAnalysisHeuristic;
class MentalSimulationHeuristic extends HumanDebuggingHeuristic {
    analyzeError(error, context) {
        const codeSnippet = context.code_snippet || '';
        if (codeSnippet.includes('if') && !codeSnippet.includes('else')) {
            return {
                heuristic: 'MentalSimulation',
                analysis: 'Missing else clause could cause unexpected behavior',
                suggested_fixes: ['Add else clause', 'Use switch statement', 'Add default case'],
                confidence: 0.7
            };
        }
        return { heuristic: 'MentalSimulation', analysis: 'Code flow appears normal', confidence: 0.5 };
    }
}
exports.MentalSimulationHeuristic = MentalSimulationHeuristic;
class SeniorDeveloperSimulator {
    constructor() {
        this.heuristics = [
            new PathAnalysisHeuristic(),
            new MentalSimulationHeuristic()
        ];
    }
    debugLikeHuman(error, context) {
        const analyses = [];
        for (const heuristic of this.heuristics) {
            const analysis = heuristic.analyzeError(error, context);
            if (analysis.confidence > 0.5) { // Only include confident analyses
                analyses.push(analysis);
            }
        }
        // Senior developer would prioritize highest confidence analysis
        if (analyses.length > 0) {
            analyses.sort((a, b) => b.confidence - a.confidence);
            const bestAnalysis = analyses[0];
            return {
                human_debugging_approach: true,
                primary_analysis: bestAnalysis,
                all_analyses: analyses,
                recommended_strategy: this.mapToStrategy(bestAnalysis),
                debugging_steps: this.generateDebugSteps(bestAnalysis)
            };
        }
        else {
            return {
                human_debugging_approach: true,
                analysis: 'Unable to apply known heuristics',
                fallback: 'Use general debugging strategy'
            };
        }
    }
    mapToStrategy(analysis) {
        if (analysis.analysis.toLowerCase().includes('path')) {
            return 'RollbackStrategy'; // Often safer for path issues
        }
        else if (analysis.analysis.toLowerCase().includes('overflow')) {
            return 'SecurityAuditStrategy';
        }
        else {
            return 'LogAndFixStrategy';
        }
    }
    generateDebugSteps(analysis) {
        const steps = ['1. Reproduce the error in isolation'];
        if (analysis.analysis.toLowerCase().includes('path')) {
            steps.push('2. Check all file/directory paths for existence', '3. Verify path constants and environment variables', '4. Test with absolute paths as fallback');
        }
        else if (analysis.analysis.toLowerCase().includes('overflow')) {
            steps.push('2. Add logging for buffer sizes and indices', '3. Implement bounds checking', '4. Consider using safer data structures');
        }
        steps.push('5. Test fix and monitor for regressions');
        return steps;
    }
}
exports.SeniorDeveloperSimulator = SeniorDeveloperSimulator;
