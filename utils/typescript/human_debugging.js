"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeniorDeveloperSimulator = exports.MentalSimulationHeuristic = exports.PathAnalysisHeuristic = exports.HumanDebuggingHeuristic = void 0;
var HumanDebuggingHeuristic = /** @class */ (function () {
    function HumanDebuggingHeuristic() {
    }
    return HumanDebuggingHeuristic;
}());
exports.HumanDebuggingHeuristic = HumanDebuggingHeuristic;
var PathAnalysisHeuristic = /** @class */ (function (_super) {
    __extends(PathAnalysisHeuristic, _super);
    function PathAnalysisHeuristic() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    PathAnalysisHeuristic.prototype.analyzeError = function (error, context) {
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
    };
    return PathAnalysisHeuristic;
}(HumanDebuggingHeuristic));
exports.PathAnalysisHeuristic = PathAnalysisHeuristic;
var MentalSimulationHeuristic = /** @class */ (function (_super) {
    __extends(MentalSimulationHeuristic, _super);
    function MentalSimulationHeuristic() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    MentalSimulationHeuristic.prototype.analyzeError = function (error, context) {
        var codeSnippet = context.code_snippet || '';
        if (codeSnippet.includes('if') && !codeSnippet.includes('else')) {
            return {
                heuristic: 'MentalSimulation',
                analysis: 'Missing else clause could cause unexpected behavior',
                suggested_fixes: ['Add else clause', 'Use switch statement', 'Add default case'],
                confidence: 0.7
            };
        }
        return { heuristic: 'MentalSimulation', analysis: 'Code flow appears normal', confidence: 0.5 };
    };
    return MentalSimulationHeuristic;
}(HumanDebuggingHeuristic));
exports.MentalSimulationHeuristic = MentalSimulationHeuristic;
var SeniorDeveloperSimulator = /** @class */ (function () {
    function SeniorDeveloperSimulator() {
        this.heuristics = [
            new PathAnalysisHeuristic(),
            new MentalSimulationHeuristic()
        ];
    }
    SeniorDeveloperSimulator.prototype.debugLikeHuman = function (error, context) {
        var analyses = [];
        for (var _i = 0, _a = this.heuristics; _i < _a.length; _i++) {
            var heuristic = _a[_i];
            var analysis = heuristic.analyzeError(error, context);
            if (analysis.confidence > 0.5) { // Only include confident analyses
                analyses.push(analysis);
            }
        }
        // Senior developer would prioritize highest confidence analysis
        if (analyses.length > 0) {
            analyses.sort(function (a, b) { return b.confidence - a.confidence; });
            var bestAnalysis = analyses[0];
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
    };
    SeniorDeveloperSimulator.prototype.mapToStrategy = function (analysis) {
        if (analysis.analysis.toLowerCase().includes('path')) {
            return 'RollbackStrategy'; // Often safer for path issues
        }
        else if (analysis.analysis.toLowerCase().includes('overflow')) {
            return 'SecurityAuditStrategy';
        }
        else {
            return 'LogAndFixStrategy';
        }
    };
    SeniorDeveloperSimulator.prototype.generateDebugSteps = function (analysis) {
        var steps = ['1. Reproduce the error in isolation'];
        if (analysis.analysis.toLowerCase().includes('path')) {
            steps.push('2. Check all file/directory paths for existence', '3. Verify path constants and environment variables', '4. Test with absolute paths as fallback');
        }
        else if (analysis.analysis.toLowerCase().includes('overflow')) {
            steps.push('2. Add logging for buffer sizes and indices', '3. Implement bounds checking', '4. Consider using safer data structures');
        }
        steps.push('5. Test fix and monitor for regressions');
        return steps;
    };
    return SeniorDeveloperSimulator;
}());
exports.SeniorDeveloperSimulator = SeniorDeveloperSimulator;
