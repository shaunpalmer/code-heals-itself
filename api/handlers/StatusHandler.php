<?php
/**
 * StatusHandler - GET /status
 * System health and circuit breaker status
 */

declare(strict_types=1);

require_once __DIR__ . '/../ai-debugging.php';

class StatusHandler {
    private AIDebugger $debugger;

    public function __construct() {
        $this->debugger = new AIDebugger();
    }

    public function handle(): array {
        try {
            $breaker = $this->debugger->getCircuitBreaker();
            $storage = $this->debugger->getEnvelopeStorage();
            $pipeline = $this->debugger->getHealingPipeline();

            $summary = $breaker->get_state_summary();

            return [
                'success' => true,
                'data' => [
                    'state' => $summary['state'],
                    'health' => $summary['health'],
                    'error_count' => $summary['error_count'],
                    'success_count' => $summary['success_count'],
                    'velocity' => $summary['velocity'] ?? 0.0,
                    'last_healing' => $summary['timestamp'] ?? null,
                    'memory_usage' => $storage ? memory_get_usage(true) : null,
                    'uptime' => $this->getUptime(),
                ],
                'timestamp' => date('c'),
            ];
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'timestamp' => date('c'),
            ];
        }
    }

    private function getUptime(): int {
        // Simple uptime: time since process started
        return (int)(microtime(true) * 1000);
    }
}
