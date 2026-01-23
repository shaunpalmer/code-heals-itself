<?php
/**
 * StatusHandler - GET /status
 * System health and circuit breaker status
 */

declare(strict_types=1);

namespace CodeHealsItself\Api\Handlers;

class StatusHandler {
    public function handle(): array {
        try {
            $debugger = new \CodeHealsItself\PhpAgent\AIDebugger();
            $breakerSummary = $debugger->getCircuitBreaker()->get_state_summary();
            $memoryMetrics = null;
            try {
                $memoryMetrics = $debugger->getEnvelopeStorage()->getLLMContext(5);
            } catch (\Throwable $t) {
                $memoryMetrics = null;
            }
            return [
                'success' => true,
                'state' => $breakerSummary['state'] ?? 'CLOSED',
                'attempts' => $breakerSummary['attempts'] ?? 0,
                'trend' => $breakerSummary['trend'] ?? 'stable',
                'velocity' => $breakerSummary['velocity'] ?? 0.0,
                'stagnation_risk' => $breakerSummary['stagnation_risk'] ?? 0.0,
                'latest_confidence' => $breakerSummary['latest_confidence'] ?? 0.0,
                'error_count' => $breakerSummary['error_count'] ?? 0,
                'memory_context' => $memoryMetrics,
                'memory_usage' => memory_get_usage(true),
                'timestamp' => date('c'),
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }
}
