<?php
/**
 * ClassifyHandler - POST /classify
 * Error classification and enrichment
 */

declare(strict_types=1);

require_once __DIR__ . '/../ai-debugging.php';

class ClassifyHandler {
    private AIDebugger $debugger;

    public function __construct() {
        $this->debugger = new AIDebugger();
    }

    public function handle(array $payload): array {
        try {
            // Validate payload
            $this->validatePayload($payload);

            // Get pipeline for classification
            $pipeline = $this->debugger->getHealingPipeline();
            if (!$pipeline) {
                throw new Exception("Pipeline not initialized");
            }

            // Classify the error through Rebanker
            $rebanker = new Rebanker();
            $classification = $rebanker->classifyError(
                errorMessage: $payload['errorMessage'],
                code: $payload['code'] ?? '',
                context: $payload['context'] ?? []
            );

            return [
                'success' => true,
                'data' => [
                    'difficulty' => $classification->difficulty,
                    'confidence' => $classification->confidence,
                    'error_type' => $classification->error_type,
                    'hints' => $classification->hints,
                    'cascade_risk' => $classification->cascade_risk,
                    'planner_directives' => $classification->planner_directives,
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

    private function validatePayload(array $payload): void {
        if (!isset($payload['errorMessage'])) {
            throw new Exception("Missing required field: errorMessage");
        }

        if (!is_string($payload['errorMessage'])) {
            throw new Exception("Field 'errorMessage' must be string");
        }

        if (strlen(trim($payload['errorMessage'])) === 0) {
            throw new Exception("Field 'errorMessage' cannot be empty");
        }
    }
}
