<?php
/**
 * ErrorEnricher: Integration Bridge
 * 
 * Combines Rebanker (classification) + Classifier (enrichment)
 * to create full error analysis pipeline.
 * 
 * Pipeline:
 * 1. Rebanker: Raw error message → classify into EASY/MEDIUM/HARD
 * 2. Classifier: Apply taxonomy enrichment → add code, cluster_id, hint, etc.
 * 3. Result: Fully enriched error packet matching Python output
 */

declare(strict_types=1);

namespace CodeHealsItself\PhpAgent;

/**
 * Enriched error combining Rebanker + Classifier output
 */
class EnrichedError {
    // From Rebanker (classification)
    public string $difficulty;        // EASY, MEDIUM, HARD
    public float $confidence;
    public string $reasoning;
    public float $cascadeRisk;

    // From Classifier (enrichment)
    public string $id;               // SHA1 hash
    public string $code;             // PHP_SYNTAX, PHP_RUNTIME, etc.
    public array $severity;          // {label, score}
    public string $clusterId;        // Error family
    public string $hint;             // Remediation suggestion
    public ?string $file = null;
    public ?int $line = null;
    public ?int $column = null;

    public function toArray(): array {
        return [
            'id' => $this->id ?? '',
            'file' => $this->file,
            'line' => $this->line,
            'column' => $this->column,
            'message' => $this->reasoning,  // Use reasoning as message
            'code' => $this->code,
            'severity' => $this->severity,
            'difficulty' => $this->difficulty,
            'cluster_id' => $this->clusterId,
            'hint' => $this->hint,
            'confidence' => $this->confidence,
            'cascade_risk' => $this->cascadeRisk,
        ];
    }

    public function toJson(): string {
        return json_encode($this->toArray(), JSON_UNESCAPED_SLASHES);
    }
}

/**
 * ErrorEnricher: Integrate Rebanker + Classifier
 * 
 * Takes error message → runs both classifiers → returns enriched packet
 */
final class ErrorEnricher {
    private Rebanker $rebanker;
    private Classifier $classifier;

    public function __construct(
        ?Rebanker $rebanker = null,
        ?Classifier $classifier = null
    ) {
        $this->rebanker = $rebanker ?? new Rebanker();
        $this->classifier = $classifier ?? new Classifier();
    }

    /**
     * Enrich a single error message
     * 
     * Steps:
     * 1. Use Rebanker to classify (EASY/MEDIUM/HARD)
     * 2. Use Classifier to enrich (taxonomy metadata)
     * 3. Merge results into single enriched packet
     * 
     * @return EnrichedError
     */
    public function enrichError(
        string $errorMessage,
        string $errorType = 'UNKNOWN',
        string $stackTrace = '',
        ?string $context = null,
        string $language = 'php'
    ): EnrichedError {
        // Step 1: Classify error (EASY/MEDIUM/HARD + cascade risk)
        $classification = $this->rebanker->classifyError(
            errorMessage: $errorMessage,
            errorType: $errorType,
            stackTrace: $stackTrace,
            context: $context
        );

        // Step 2: Enrich using taxonomy (code, cluster_id, hint, etc.)
        $classificationResult = $this->classifier->classifyLines(
            logLines: [$errorMessage],
            lang: $language
        );

        // Step 3: Merge results
        $enriched = new EnrichedError();
        
        // From Rebanker
        $enriched->difficulty = $classification->difficulty->value;
        $enriched->confidence = $classification->confidence;
        $enriched->reasoning = $classification->reasoning;
        $enriched->cascadeRisk = $classification->cascadeRisk;

        // From Classifier (if matched)
        if (!empty($classificationResult->errors)) {
            $classifiedError = $classificationResult->errors[0];
            $enriched->id = $classifiedError->id;
            $enriched->code = $classifiedError->code;
            $enriched->severity = $classifiedError->severity;
            $enriched->clusterId = $classifiedError->clusterId;
            $enriched->hint = $classifiedError->hint;
            $enriched->file = $classifiedError->file !== 'unknown' ? $classifiedError->file : null;
            $enriched->line = $classifiedError->line > 0 ? $classifiedError->line : null;
            $enriched->column = $classifiedError->column > 0 ? $classifiedError->column : null;
        } else {
            // Fallback: Create basic enrichment without taxonomy match
            $enriched->id = 'e:' . substr(sha1($errorMessage), 0, 12);
            $enriched->code = "PHP_" . strtoupper($errorType);
            $enriched->severity = ['label' => 'ERROR', 'score' => 0.6];
            $enriched->clusterId = $enriched->code;
            $enriched->hint = "Review error message; no taxonomy match found.";
        }

        return $enriched;
    }

    /**
     * Batch enrich multiple errors
     * @param array<array> $errors Each: {message, type, stackTrace, context}
     * @return list<EnrichedError>
     */
    public function enrichBatch(array $errors, string $language = 'php'): array {
        $enriched = [];
        foreach ($errors as $error) {
            $enriched[] = $this->enrichError(
                errorMessage: $error['message'] ?? '',
                errorType: $error['type'] ?? 'UNKNOWN',
                stackTrace: $error['stackTrace'] ?? '',
                context: $error['context'] ?? null,
                language: $language
            );
        }
        return $enriched;
    }

    /**
     * Generate error summary from enriched errors
     */
    public function getSummary(array $enrichedErrors): array {
        $bySeverity = [];
        $byCode = [];
        $byCluster = [];
        $byDifficulty = [];

        foreach ($enrichedErrors as $error) {
            $label = $error->severity['label'] ?? 'UNKNOWN';
            $bySeverity[$label] = ($bySeverity[$label] ?? 0) + 1;
            $byCode[$error->code] = ($byCode[$error->code] ?? 0) + 1;
            $byCluster[$error->clusterId] = ($byCluster[$error->clusterId] ?? 0) + 1;
            $byDifficulty[$error->difficulty] = ($byDifficulty[$error->difficulty] ?? 0) + 1;
        }

        // Calculate average confidence and cascade risk
        $avgConfidence = 0.0;
        $avgCascadeRisk = 0.0;
        if (count($enrichedErrors) > 0) {
            $totalConfidence = array_sum(array_map(fn($e) => $e->confidence, $enrichedErrors));
            $totalCascadeRisk = array_sum(array_map(fn($e) => $e->cascadeRisk, $enrichedErrors));
            $avgConfidence = round($totalConfidence / count($enrichedErrors), 3);
            $avgCascadeRisk = round($totalCascadeRisk / count($enrichedErrors), 3);
        }

        return [
            'count' => count($enrichedErrors),
            'by_severity' => $bySeverity,
            'by_code' => $byCode,
            'by_cluster' => $byCluster,
            'by_difficulty' => $byDifficulty,
            'avg_confidence' => $avgConfidence,
            'avg_cascade_risk' => $avgCascadeRisk,
        ];
    }
}

// Example usage
if (php_sapi_name() === 'cli' && basename(__FILE__) === basename($_SERVER['PHP_SELF'] ?? '')) {
    echo "=== PHP ErrorEnricher (Rebanker + Classifier Integration) ===\n\n";

    $enricher = new ErrorEnricher();

    // Test cases
    $testErrors = [
        [
            'message' => 'SyntaxError: Unexpected token } at line 10',
            'type' => 'SYNTAX',
            'stackTrace' => 'File: script.php, Line 10',
        ],
        [
            'message' => 'Undefined variable: $undefined_var',
            'type' => 'SCOPE',
            'stackTrace' => 'Called from context: function_name()',
        ],
        [
            'message' => 'SQL injection vulnerability detected in query builder',
            'type' => 'SECURITY',
            'stackTrace' => '',
        ],
    ];

    // Enrich all errors
    $enriched = $enricher->enrichBatch($testErrors);
    $summary = $enricher->getSummary($enriched);

    echo "Enriched Errors:\n";
    foreach ($enriched as $idx => $error) {
        echo "\nError " . ($idx + 1) . ":\n";
        echo $error->toJson() . "\n";
    }

    echo "\n\nSummary:\n";
    echo json_encode($summary, JSON_PRETTY_PRINT) . "\n";
}
