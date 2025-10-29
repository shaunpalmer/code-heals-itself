<?php
/**
 * ClassifyHandler - POST /classify
 * Error classification and enrichment
 */

declare(strict_types=1);

namespace CodeHealsItself\Api\Handlers;

class ClassifyHandler {
    public function handle(array $payload): array {
        try {
            // Validate payload
            if (empty($payload['error_message'])) {
                return [
                    'success' => false,
                    'error' => 'Missing required field: error_message',
                ];
            }

            // For now, return a mock classification response
            // In production, this would call Rebanker
            return [
                'success' => true,
                'classification' => [
                    'difficulty' => 'MEDIUM',
                    'confidence' => 0.75,
                    'error_type' => 'LogicError',
                    'cascade_risk' => 0.3,
                ],
                'hint' => 'Check variable initialization in conditional branches',
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }
}
