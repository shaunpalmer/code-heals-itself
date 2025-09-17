<?php

abstract class HumanDebuggingHeuristic {
    abstract public function analyzeError(string $error, array $context): array;
}

class PathAnalysisHeuristic extends HumanDebuggingHeuristic {
    public function analyzeError(string $error, array $context): array {
        if (stripos($error, 'undefined') !== false) {
            return [
                'heuristic' => 'PathAnalysis',
                'analysis' => 'Likely a path resolution issue',
                'suggested_fixes' => ['Check file paths', 'Use absolute paths', 'Verify constants'],
                'confidence' => 0.8
            ];
        } elseif (stripos($error, 'overflow') !== false) {
            return [
                'heuristic' => 'PathAnalysis',
                'analysis' => 'Buffer or stack overflow detected',
                'suggested_fixes' => ['Add bounds checking', 'Use safer data structures', 'Implement circuit breaker'],
                'confidence' => 0.9
            ];
        }
        return ['heuristic' => 'PathAnalysis', 'analysis' => 'Unknown pattern', 'confidence' => 0.1];
    }
}

class MentalSimulationHeuristic extends HumanDebuggingHeuristic {
    public function analyzeError(string $error, array $context): array {
        $codeSnippet = $context['code_snippet'] ?? '';
        if (strpos($codeSnippet, 'if') !== false && strpos($codeSnippet, 'else') === false) {
            return [
                'heuristic' => 'MentalSimulation',
                'analysis' => 'Missing else clause could cause unexpected behavior',
                'suggested_fixes' => ['Add else clause', 'Use switch statement', 'Add default case'],
                'confidence' => 0.7
            ];
        }
        return ['heuristic' => 'MentalSimulation', 'analysis' => 'Code flow appears normal', 'confidence' => 0.5];
    }
}

class SeniorDeveloperSimulator {
    private array $heuristics;

    public function __construct() {
        $this->heuristics = [
            new PathAnalysisHeuristic(),
            new MentalSimulationHeuristic()
        ];
    }

    public function debugLikeHuman(string $error, array $context): array {
        $analyses = [];
        foreach ($this->heuristics as $heuristic) {
            $analysis = $heuristic->analyzeError($error, $context);
            if ($analysis['confidence'] > 0.5) { // Only include confident analyses
                $analyses[] = $analysis;
            }
        }

        // Senior developer would prioritize highest confidence analysis
        if (!empty($analyses)) {
            usort($analyses, fn($a, $b) => $b['confidence'] <=> $a['confidence']);
            $bestAnalysis = $analyses[0];
            return [
                'human_debugging_approach' => true,
                'primary_analysis' => $bestAnalysis,
                'all_analyses' => $analyses,
                'recommended_strategy' => $this->mapToStrategy($bestAnalysis),
                'debugging_steps' => $this->generateDebugSteps($bestAnalysis)
            ];
        } else {
            return [
                'human_debugging_approach' => true,
                'analysis' => 'Unable to apply known heuristics',
                'fallback' => 'Use general debugging strategy'
            ];
        }
    }

    private function mapToStrategy(array $analysis): string {
        if (stripos($analysis['analysis'], 'path') !== false) {
            return 'RollbackStrategy'; // Often safer for path issues
        } elseif (stripos($analysis['analysis'], 'overflow') !== false) {
            return 'SecurityAuditStrategy';
        } else {
            return 'LogAndFixStrategy';
        }
    }

    private function generateDebugSteps(array $analysis): array {
        $steps = ['1. Reproduce the error in isolation'];
        if (stripos($analysis['analysis'], 'path') !== false) {
            $steps = array_merge($steps, [
                '2. Check all file/directory paths for existence',
                '3. Verify path constants and environment variables',
                '4. Test with absolute paths as fallback'
            ]);
        } elseif (stripos($analysis['analysis'], 'overflow') !== false) {
            $steps = array_merge($steps, [
                '2. Add logging for buffer sizes and indices',
                '3. Implement bounds checking',
                '4. Consider using safer data structures'
            ]);
        }
        $steps[] = '5. Test fix and monitor for regressions';
        return $steps;
    }
}

?>