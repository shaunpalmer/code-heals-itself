<?php
/**
 * Pipeline: CodePreprocessor → Rebanker → Envelope
 * 
 * Complete error analysis workflow:
 * 1. Scan PHP files with glob (milliseconds via tokenizer)
 * 2. Extract errors from preprocessing
 * 3. Classify with Rebanker (EASY/MEDIUM/HARD + cascade risk)
 * 4. Enrich with taxonomy (code, cluster_id, hint, planner directives)
 * 5. Package as healing envelope
 * 
 * Result: Ready-to-heal error packets for the healing loop
 */

declare(strict_types=1);

namespace CodeHealsItself\PhpAgent;

use DateTime;

/**
 * HealingEnvelope: Complete error packet ready for healing
 * 
 * Contains:
 * - Error classification (difficulty, confidence, cascade risk)
 * - Enrichment metadata (code, cluster_id, hint, planner directives)
 * - File/line/column context
 * - Audit trail
 */
class HealingEnvelope {
    public string $id;                      // Unique envelope ID
    public string $patchId;                 // Error classification ID
    public DateTime $timestamp;
    public string $file;
    public int $line;
    public int $column;
    public string $message;
    
    // Classification
    public string $difficulty;              // EASY, MEDIUM, HARD
    public float $confidence;
    public float $cascadeRisk;
    public string $reasoning;
    
    // Enrichment
    public string $code;                    // e.g., PHP_SYNTAX, OOP.PRIVATE_ACCESS
    public array $severity;                 // {label, score}
    public string $clusterId;               // Error family
    public string $hint;                    // Guidance for LLM
    public ?array $planner = null;          // Planner directives
    
    // Metadata
    public array $metadata = [];
    public array $attempts = [];            // Healing attempts log

    public function __construct() {
        $this->id = 'env:' . substr(bin2hex(random_bytes(6)), 0, 12);
        $this->timestamp = new DateTime();
    }

    public function toArray(): array {
        return [
            'id' => $this->id,
            'patch_id' => $this->patchId,
            'timestamp' => $this->timestamp->toIso8601String(),
            'file' => $this->file,
            'line' => $this->line,
            'column' => $this->column,
            'message' => $this->message,
            'difficulty' => $this->difficulty,
            'confidence' => $this->confidence,
            'cascade_risk' => $this->cascadeRisk,
            'reasoning' => $this->reasoning,
            'code' => $this->code,
            'severity' => $this->severity,
            'cluster_id' => $this->clusterId,
            'hint' => $this->hint,
            'planner' => $this->planner,
            'metadata' => $this->metadata,
            'attempts' => $this->attempts,
        ];
    }

    public function toJson(): string {
        return json_encode($this->toArray(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    }

    public function addAttempt(int $attemptNumber, string $action, string $result, ?float $errorDelta = null): void {
        $this->attempts[] = [
            'attempt' => $attemptNumber,
            'action' => $action,
            'result' => $result,
            'error_delta' => $errorDelta,
            'timestamp' => (new DateTime())->toIso8601String(),
        ];
    }
}

/**
 * Pipeline: Orchestrates the complete error analysis workflow
 */
final class HealingPipeline {
    private CodePreprocessor $preprocessor;
    private Rebanker $rebanker;
    private Classifier $classifier;

    public function __construct(
        ?CodePreprocessor $preprocessor = null,
        ?Rebanker $rebanker = null,
        ?Classifier $classifier = null
    ) {
        $this->preprocessor = $preprocessor ?? new CodePreprocessor();
        $this->rebanker = $rebanker ?? new Rebanker();
        $this->classifier = $classifier ?? new Classifier();
    }

    /**
     * Main pipeline: Files → Preprocessing → Rebanking → Enrichment → Envelopes
     * 
     * @param string $pattern Glob pattern (e.g., "src/**\/*.php")
     * @return list<HealingEnvelope>
     */
    public function analyzeGlob(string $pattern): array {
        // Step 1: Find files matching pattern
        $files = glob($pattern, GLOB_RECURSE);
        if (empty($files)) {
            return [];
        }

        $envelopes = [];

        // Step 2: Process each file
        foreach ($files as $file) {
            if (!is_file($file)) {
                continue;
            }

            $fileEnvelopes = $this->analyzeFile($file);
            $envelopes = array_merge($envelopes, $fileEnvelopes);
        }

        return $envelopes;
    }

    /**
     * Analyze a single PHP file
     * 
     * @return list<HealingEnvelope>
     */
    public function analyzeFile(string $filePath): array {
        // Step 1: Preprocess (extract potential errors via tokenizer - FAST)
        $preprocessReport = $this->preprocessor->scanFile($filePath);

        $envelopes = [];

        // Step 2: Convert preprocessing issues to rebanking
        foreach ($preprocessReport->issues as $issue) {
            $envelope = $this->createEnvelope(
                file: $filePath,
                line: $issue['line'],
                column: $issue['column'],
                message: $issue['message'],
                errorType: $issue['code'],
                severity: $issue['severity']
            );

            if ($envelope) {
                $envelopes[] = $envelope;
            }
        }

        return $envelopes;
    }

    /**
     * Analyze raw code string
     * 
     * @return list<HealingEnvelope>
     */
    public function analyzeCode(string $code, string $fileName = 'unknown.php'): array {
        // Step 1: Preprocess
        $preprocessReport = $this->preprocessor->scanCode($code);

        $envelopes = [];

        // Step 2: Convert to envelopes
        foreach ($preprocessReport->issues as $issue) {
            $envelope = $this->createEnvelope(
                file: $fileName,
                line: $issue['line'],
                column: $issue['column'],
                message: $issue['message'],
                errorType: $issue['code'],
                severity: $issue['severity']
            );

            if ($envelope) {
                $envelopes[] = $envelope;
            }
        }

        return $envelopes;
    }

    /**
     * Create a healing envelope from an error
     * 
     * Pipeline:
     * 1. Rebanker: Classify (EASY/MEDIUM/HARD + cascade risk)
     * 2. Classifier: Enrich (taxonomy metadata, hints, planner directives)
     * 3. Package: Create HealingEnvelope
     */
    private function createEnvelope(
        string $file,
        int $line,
        int $column,
        string $message,
        string $errorType,
        string $severity
    ): ?HealingEnvelope {
        // Step 1: Classify with Rebanker
        $classification = $this->rebanker->classifyError(
            errorMessage: $message,
            errorType: $errorType,
            stackTrace: "File: $file, Line: $line",
            context: null
        );

        // Step 2: Enrich with Classifier (taxonomy, hints, planner)
        $classificationResult = $this->classifier->classifyLines(
            logLines: [$message],
            lang: 'php'
        );

        // Step 3: Create envelope
        $envelope = new HealingEnvelope();
        $envelope->patchId = 'patch:' . substr(bin2hex(random_bytes(6)), 0, 12);
        $envelope->file = $file;
        $envelope->line = $line;
        $envelope->column = $column;
        $envelope->message = $message;

        // From Rebanker
        $envelope->difficulty = $classification->difficulty->value;
        $envelope->confidence = $classification->confidence;
        $envelope->cascadeRisk = $classification->cascadeRisk;
        $envelope->reasoning = $classification->reasoning;

        // From Classifier (if matched)
        if (!empty($classificationResult->errors)) {
            $classified = $classificationResult->errors[0];
            $envelope->code = $classified->code;
            $envelope->severity = $classified->severity;
            $envelope->clusterId = $classified->clusterId;
            $envelope->hint = $classified->hint;
            // TODO: Add planner directives from taxonomy
            $envelope->planner = [
                'prefer' => ['precision'],
                'rails' => ['edit_within_span_only'],
            ];
        } else {
            // Fallback
            $envelope->code = "PHP_" . strtoupper($errorType);
            $envelope->severity = ['label' => 'ERROR', 'score' => 0.6];
            $envelope->clusterId = $envelope->code;
            $envelope->hint = "Review error and context.";
        }

        $envelope->metadata = [
            'language' => 'php',
            'preprocessor_time_ms' => 0.0,
            'severity_label' => $severity,
        ];

        return $envelope;
    }

    /**
     * Get pipeline statistics
     */
    public function getStats(array $envelopes): array {
        $byDifficulty = [];
        $bySeverity = [];
        $byCode = [];

        foreach ($envelopes as $env) {
            $byDifficulty[$env->difficulty] = ($byDifficulty[$env->difficulty] ?? 0) + 1;
            $bySeverity[$env->severity['label']] = ($bySeverity[$env->severity['label']] ?? 0) + 1;
            $byCode[$env->code] = ($byCode[$env->code] ?? 0) + 1;
        }

        $avgConfidence = 0.0;
        $avgCascade = 0.0;
        if (count($envelopes) > 0) {
            $avgConfidence = array_sum(array_map(fn($e) => $e->confidence, $envelopes)) / count($envelopes);
            $avgCascade = array_sum(array_map(fn($e) => $e->cascadeRisk, $envelopes)) / count($envelopes);
        }

        return [
            'total_envelopes' => count($envelopes),
            'by_difficulty' => $byDifficulty,
            'by_severity' => $bySeverity,
            'by_code' => $byCode,
            'avg_confidence' => round($avgConfidence, 3),
            'avg_cascade_risk' => round($avgCascade, 3),
        ];
    }
}

// Example usage
if (php_sapi_name() === 'cli' && basename(__FILE__) === basename($_SERVER['PHP_SELF'] ?? '')) {
    echo "=== Healing Pipeline: PreProcessor → Rebanker → Envelopes ===\n\n";

    $pipeline = new HealingPipeline();

    // Test on actual PHP files in agent directory
    $pattern = __DIR__ . '/*.php';

    echo "Analyzing: $pattern\n";
    $envelopes = $pipeline->analyzeGlob($pattern);
    $stats = $pipeline->getStats($envelopes);

    echo "\nPipeline Results:\n";
    echo json_encode($stats, JSON_PRETTY_PRINT) . "\n";

    if (count($envelopes) > 0) {
        echo "\nFirst envelope:\n";
        echo $envelopes[0]->toJson() . "\n";
    } else {
        echo "\n✅ No errors found in scanned files.\n";
    }
}
