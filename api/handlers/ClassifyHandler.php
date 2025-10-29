<?php
/**
 * ClassifyHandler - POST /classify
 * Error classification and enrichment
 */

declare(strict_types=1);

namespace CodeHealsItself\Api\Handlers;

use CodeHealsItself\PhpAgent\Rebanker;

class ClassifyHandler {
    public function handle(array $payload): array {
        try {
            // Validate payload — accept 'errorMessage' or 'error_message'
            $errorMessage = $payload['errorMessage'] ?? $payload['error_message'] ?? null;
            
            if (empty($errorMessage)) {
                return [
                    'success' => false,
                    'error' => 'Missing required field: errorMessage',
                ];
            }

            // Create Rebanker and classify the error
            $rebanker = new Rebanker();
            $classification = $rebanker->classifyError(
                errorMessage: $errorMessage,
                errorType: 'UNKNOWN', // Will be inferred from message
                stackTrace: '',
                context: null
            );

            // Transform ErrorClassification to response structure
            // Convert difficulty enum to numeric value
            $difficultyMap = [
                'EASY' => 0.35,
                'MEDIUM' => 0.65,
                'HARD' => 0.85,
            ];
            $difficultyNumeric = $difficultyMap[$classification->difficulty->value] ?? 0.65;

            return [
                'success' => true,
                'difficulty' => $difficultyNumeric,
                'confidence' => $classification->confidence,
                'error_type' => $classification->taxonomy,
                'hints' => $classification->reasoning,
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }
}
