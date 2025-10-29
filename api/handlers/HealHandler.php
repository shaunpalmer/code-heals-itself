<?php
/**
 * HealHandler - POST /heal
 * Main healing orchestration endpoint
 */

declare(strict_types=1);

require_once __DIR__ . '/../ai-debugging.php';

class HealHandler {
    private AIDebugger $debugger;

    public function __construct() {
        $this->debugger = new AIDebugger();
    }

    public function handle(array $payload): array {
        try {
            // Validate payload
            $this->validatePayload($payload);

            // Execute healing attempt
            $result = $this->debugger->attemptHealing(
                code: $payload['code'],
                previousErrors: $payload['previousErrors'],
                attemptNumber: $payload['attemptNumber'],
                errorMessage: $payload['errorMessage'] ?? '',
                temperature: $payload['temperature'] ?? 1.0
            );

            return [
                'success' => true,
                'data' => $result,
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

    private function validatePayload(array $payload): void {
        $required = ['code', 'previousErrors', 'attemptNumber'];
        foreach ($required as $field) {
            if (!isset($payload[$field])) {
                throw new Exception("Missing required field: {$field}");
            }
        }

        if (!is_string($payload['code'])) {
            throw new Exception("Field 'code' must be string");
        }

        if (!is_int($payload['previousErrors']) || $payload['previousErrors'] < 0) {
            throw new Exception("Field 'previousErrors' must be non-negative integer");
        }

        if (!is_int($payload['attemptNumber']) || $payload['attemptNumber'] < 1) {
            throw new Exception("Field 'attemptNumber' must be positive integer");
        }
    }
}
