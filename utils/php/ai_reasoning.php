<?php

class PatternLearner {
    private array $patterns;

    public function __construct() {
        $this->patterns = [];
    }

    public function learnFromOutcome(string $patternType, bool $success, float $executionTime): void {
        if (!isset($this->patterns[$patternType])) {
            $this->patterns[$patternType] = [
                'success_count' => 0,
                'failure_count' => 0,
                'avg_time' => 0.0
            ];
        }

        $this->patterns[$patternType]['success_count'] += $success ? 1 : 0;
        $this->patterns[$patternType]['failure_count'] += $success ? 0 : 1;

        // Update rolling average
        $currentAvg = $this->patterns[$patternType]['avg_time'];
        $count = $this->patterns[$patternType]['success_count'] + $this->patterns[$patternType]['failure_count'];
        $this->patterns[$patternType]['avg_time'] = ($currentAvg * ($count - 1) + $executionTime) / $count;
    }

    public function getBestPattern(array $availablePatterns): string {
        $bestPattern = '';
        $bestScore = -1;

        foreach ($availablePatterns as $pattern) {
            if (!isset($this->patterns[$pattern])) {
                continue;
            }

            $stats = $this->patterns[$pattern];
            $total = $stats['success_count'] + $stats['failure_count'];
            if ($total === 0) {
                continue;
            }

            $successRate = $stats['success_count'] / $total;
            if ($successRate > $bestScore) {
                $bestScore = $successRate;
                $bestPattern = $pattern;
            }
        }

        return $bestPattern ?: ($availablePatterns[0] ?? 'LogAndFixStrategy');
    }

    public function getPatternStats(): array {
        return $this->patterns;
    }
}

class AIReasoningEngine {
    private PatternLearner $learner;
    private ?MemoryBuffer $memoryBuffer;
    private array $decisionLog;

    public function __construct(PatternLearner $learner, ?MemoryBuffer $memoryBuffer = null) {
        $this->learner = $learner;
        $this->memoryBuffer = $memoryBuffer;
        $this->decisionLog = [];
    }

    public function reasonAboutPatch(array $context): array {
        $errorType = $context['error_type'] ?? 'unknown';
        $availableStrategies = ['LogAndFixStrategy', 'RollbackStrategy', 'SecurityAuditStrategy'];

        $bestStrategy = $this->learner->getBestPattern($availableStrategies);

        // Check memory buffer for similar past outcomes
        $similarOutcomes = [];
        if ($this->memoryBuffer) {
            $similarOutcomes = $this->memoryBuffer->getSimilarOutcomes($context);
        }

        $reasoning = [
            'error_analysis' => "Detected {$errorType} error",
            'historical_performance' => $this->learner->getPatternStats(),
            'recommended_strategy' => $bestStrategy,
            'confidence' => $this->calculateConfidence($bestStrategy),
            'alternative_strategies' => array_filter($availableStrategies, fn($s) => $s !== $bestStrategy),
            'similar_past_outcomes' => count($similarOutcomes),
            'learning_insights' => $this->extractInsights($similarOutcomes)
        ];

        $this->decisionLog[] = [
            'context' => $context,
            'reasoning' => $reasoning,
            'timestamp' => date('c')
        ];

        return $reasoning;
    }

    private function calculateConfidence(string $strategy): float {
        $stats = $this->learner->getPatternStats()[$strategy] ?? ['success_count' => 0, 'failure_count' => 0];
        $total = $stats['success_count'] + $stats['failure_count'];
        if ($total === 0) {
            return 0.5; // Neutral confidence for new strategies
        }
        return $stats['success_count'] / $total;
    }

    private function extractInsights(array $similarOutcomes): array {
        if (empty($similarOutcomes)) {
            return ['insights' => 'No similar past outcomes found'];
        }

        $successCount = 0;
        foreach ($similarOutcomes as $outcome) {
            $envelopeData = json_decode($outcome['envelope'], true);
            if (($envelopeData['success'] ?? false)) {
                $successCount++;
            }
        }

        $successRate = $successCount / count($similarOutcomes);

        return [
            'success_rate_in_similar_cases' => $successRate,
            'recommendation' => $successRate < 0.7 ? 'Proceed with caution' : 'High confidence',
            'patterns_to_avoid' => $this->identifyFailurePatterns($similarOutcomes)
        ];
    }

    private function identifyFailurePatterns(array $outcomes): array {
        $failurePatterns = [];
        foreach ($outcomes as $outcome) {
            $envelopeData = json_decode($outcome['envelope'], true);
            if (!($envelopeData['success'] ?? false)) {
                if ($envelopeData['flagged_for_developer'] ?? false) {
                    $failurePatterns[] = 'Flagged for developer - complex issue';
                }
                if (isset($envelopeData['simulation_details']['circuit_breaker_tripped'])) {
                    $failurePatterns[] = 'Circuit breaker tripped - potential infinite loop';
                }
            }
        }
        return array_unique($failurePatterns);
    }
}

class AIEnhancedStrategy extends DebuggingStrategy {
    private DebuggingStrategy $baseStrategy;
    private AIReasoningEngine $reasoningEngine;
    private ?AIPatchEnvelope $envelopeWrapper;

    public function __construct(
        DebuggingStrategy $baseStrategy,
        AIReasoningEngine $reasoningEngine,
        ?AIPatchEnvelope $envelopeWrapper = null
    ) {
        $this->baseStrategy = $baseStrategy;
        $this->reasoningEngine = $reasoningEngine;
        $this->envelopeWrapper = $envelopeWrapper;
    }

    public function execute(array $context): array {
        $reasoning = $this->reasoningEngine->reasonAboutPatch($context);
        $baseOutcome = $this->baseStrategy->execute($context);

        // Wrap in envelope if available
        if ($this->envelopeWrapper) {
            $envelope = $this->envelopeWrapper->wrapPatch($context);
            $envelopeResult = $this->envelopeWrapper->unwrapAndExecute($envelope);

            $enhancedOutcome = array_merge($baseOutcome, [
                'ai_reasoning' => $reasoning,
                'envelope_result' => $envelopeResult,
                'strategy' => 'AIEnhanced' . get_class($this->baseStrategy)
            ]);
        } else {
            $enhancedOutcome = array_merge($baseOutcome, [
                'ai_reasoning' => $reasoning,
                'strategy' => 'AIEnhanced' . get_class($this->baseStrategy)
            ]);
        }

        return $enhancedOutcome;
    }
}

?>