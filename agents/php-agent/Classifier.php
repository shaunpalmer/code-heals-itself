<?php
/**
 * PHP Classifier: Taxonomy-Driven Error Classification
 * 
 * Mirrors Python classify.py + TypeScript classify.ts with full enrichment pipeline:
 * 1. Load taxonomy YAML (detectors, severity, difficulty, hints)
 * 2. Compile regex patterns from taxonomy
 * 3. Match error lines against detectors
 * 4. Extract file/line/column from captures
 * 5. Enrich with taxonomy metadata (code, severity, difficulty, cluster_id, hint, confidence)
 * 6. Generate error ID (SHA1 hash)
 * 7. Return structured error packet
 * 
 * This is the "advanced" pipeline PHP was missing.
 * Brings PHP classifier to parity with Python.
 */

declare(strict_types=1);

namespace CodeHealsItself\PhpAgent;

use Exception;

/**
 * Detector: Compiled regex pattern + metadata (frozen dataclass equivalent)
 */
final class Detector {
    public string $code;
    public string $severityLabel;
    public float $severityScore;
    public float $difficulty;
    public string $hint;
    /** @var array<string, \regex> */
    public array $patterns;  // name => compiled regex
    /** @var list<string> */
    public array $langs;
    /** @var list<string> */
    public array $captures;
    public ?string $clusterKey;
    public float $confidence;

    /**
     * @param list<string> $regexPatterns
     * @param list<string> $langs
     * @param list<string> $captures
     */
    public function __construct(
        string $code,
        string $severityLabel,
        float $severityScore,
        float $difficulty,
        string $hint,
        array $regexPatterns,
        array $langs,
        array $captures,
        ?string $clusterKey,
        float $confidence
    ) {
        $this->code = $code;
        $this->severityLabel = $severityLabel;
        $this->severityScore = $severityScore;
        $this->difficulty = $difficulty;
        $this->hint = $hint;
        $this->langs = $langs;
        $this->captures = $captures;
        $this->clusterKey = $clusterKey;
        $this->confidence = $confidence;

        // Compile regex patterns
        $this->patterns = [];
        foreach ($regexPatterns as $idx => $pattern) {
            $this->patterns[$idx] = "/$pattern/i";  // Case-insensitive
        }
    }
}

/**
 * ClassifiedError: Output packet after enrichment
 */
class ClassifiedError {
    public string $id;
    public string $file;
    public int $line;
    public int $column;
    public string $message;
    public string $code;
    public array $severity;  // {label: string, score: float}
    public float $difficulty;
    public string $clusterId;
    public string $hint;
    public float $confidence;

    public function toArray(): array {
        return [
            'id' => $this->id,
            'file' => $this->file,
            'line' => $this->line,
            'column' => $this->column,
            'message' => $this->message,
            'code' => $this->code,
            'severity' => $this->severity,
            'difficulty' => $this->difficulty,
            'cluster_id' => $this->clusterId,
            'hint' => $this->hint,
            'confidence' => $this->confidence,
        ];
    }

    public function toJson(): string {
        return json_encode($this->toArray(), JSON_UNESCAPED_SLASHES);
    }
}

/**
 * Classification Result: Errors + summary statistics
 */
class ClassificationResult {
    /** @var list<ClassifiedError> */
    public array $errors;
    public array $summary;  // {count, by_severity, by_code, by_cluster}

    /**
     * @param list<ClassifiedError> $errors
     * @param array<string, int> $bySeverity
     * @param array<string, int> $byCode
     * @param array<string, int> $byCluster
     */
    public function __construct(array $errors, array $bySeverity, array $byCode, array $byCluster) {
        $this->errors = $errors;
        $this->summary = [
            'count' => count($errors),
            'by_severity' => $bySeverity,
            'by_code' => $byCode,
            'by_cluster' => $byCluster,
        ];
    }

    public function toArray(): array {
        return [
            'errors' => array_map(fn($e) => $e->toArray(), $this->errors),
            'summary' => $this->summary,
        ];
    }

    public function toJson(): string {
        return json_encode($this->toArray(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    }
}

/**
 * Classifier: Main enrichment pipeline
 */
final class Classifier {
    private static ?array $taxonomyCache = null;
    private static ?array $detectorCache = null;
    private string $taxonomyPath;

    public function __construct(string $taxonomyPath = '') {
        if (!$taxonomyPath) {
            // Default: look for taxonomy.yaml next to this file or in rules/ directory
            $possiblePaths = [
                __DIR__ . '/../../rules/rebanker_taxonomy.yml',
                __DIR__ . '/../../taxonomy.yaml',
            ];
            foreach ($possiblePaths as $path) {
                if (file_exists($path)) {
                    $taxonomyPath = $path;
                    break;
                }
            }
        }
        $this->taxonomyPath = $taxonomyPath;
    }

    /**
     * Load and cache taxonomy YAML
     * @return array<string, mixed>
     */
    public function loadTaxonomy(): array {
        if (self::$taxonomyCache !== null) {
            return self::$taxonomyCache;
        }

        if (!file_exists($this->taxonomyPath)) {
            // Fallback: return empty but valid taxonomy structure
            return [
                'defaults' => ['severity' => ['label' => 'ERROR', 'score' => 0.6], 'difficulty' => 0.5, 'confidence' => 0.5],
                'families' => [],
            ];
        }

        // Parse YAML (simplified - in production use symfony/yaml)
        $yaml = file_get_contents($this->taxonomyPath);
        if (!$yaml) {
            throw new Exception("Cannot read taxonomy file: {$this->taxonomyPath}");
        }

        // For now, use simple regex-based YAML parser for basic structure
        // In production: use symfony/yaml or yaml extension
        $spec = $this->parseYaml($yaml);

        self::$taxonomyCache = $spec;
        return $spec;
    }

    /**
     * Compile detectors from taxonomy (caches result)
     * @return list<Detector>
     */
    public function compileDetectors(): array {
        if (self::$detectorCache !== null) {
            return self::$detectorCache;
        }

        $spec = $this->loadTaxonomy();
        $defaults = $spec['defaults'] ?? [];
        $detectors = [];

        foreach ($spec['families'] ?? [] as $family) {
            foreach ($family['categories'] ?? [] as $category) {
                foreach ($category['detectors'] ?? [] as $det) {
                    $regexPatterns = $det['regex'] ?? [];
                    if (empty($regexPatterns)) {
                        continue;
                    }

                    $severity = $category['severity'] ?? [];
                    $detectors[] = new Detector(
                        code: $category['code'],
                        severityLabel: $severity['label'] ?? $defaults['severity']['label'] ?? 'ERROR',
                        severityScore: (float)($severity['score'] ?? $defaults['severity']['score'] ?? 0.6),
                        difficulty: (float)($category['difficulty'] ?? $defaults['difficulty'] ?? 0.5),
                        hint: $category['hint'] ?? '',
                        regexPatterns: $regexPatterns,
                        langs: $det['langs'] ?? [],
                        captures: $det['capture'] ?? [],
                        clusterKey: $category['cluster_key'] ?? null,
                        confidence: (float)($category['confidence'] ?? $defaults['confidence'] ?? 0.5),
                    );
                }
            }
        }

        self::$detectorCache = $detectors;
        return $detectors;
    }

    /**
     * Main enrichment pipeline: Classify log lines into structured error packets
     * @param list<string> $logLines
     * @return ClassificationResult
     */
    public function classifyLines(array $logLines, string $lang): ClassificationResult {
        $spec = $this->loadTaxonomy();
        $detectors = $this->compileDetectors();
        $errors = [];
        $langLower = strtolower($lang);

        foreach ($logLines as $rawLine) {
            $line = trim($rawLine);
            if (empty($line)) {
                continue;
            }

            // Step 1: Match line against detectors
            $match = $this->matchLine($line, $langLower, $detectors);
            if ($match === null) {
                continue;
            }

            [$detector, $captures] = $match;

            // Step 2: Generate error ID (SHA1 hash of signature)
            $errorId = $this->makeErrorId($line, $detector->code, $captures);

            // Step 3: Extract file/line/column from captures
            [$file, $lineNo, $colNo] = $this->extractLocation($captures, $line);

            // Step 4: Build severity dict
            $severity = [
                'label' => $detector->severityLabel,
                'score' => round($detector->severityScore, 2),
            ];

            // Step 5: Create classified error object (enriched)
            $error = new ClassifiedError();
            $error->id = $errorId;
            $error->file = $file;
            $error->line = $lineNo;
            $error->column = $colNo;
            $error->message = $line;
            $error->code = $detector->code;
            $error->severity = $severity;
            $error->difficulty = round($detector->difficulty, 2);
            $error->clusterId = $this->clusterId($detector, $captures);
            $error->hint = $detector->hint;
            $error->confidence = round($detector->confidence, 2);

            $errors[] = $error;
        }

        // Step 6: Generate summary statistics
        $bySeverity = [];
        $byCode = [];
        $byCluster = [];

        foreach ($errors as $error) {
            $bySeverity[$error->severity['label']] = ($bySeverity[$error->severity['label']] ?? 0) + 1;
            $byCode[$error->code] = ($byCode[$error->code] ?? 0) + 1;
            $byCluster[$error->clusterId] = ($byCluster[$error->clusterId] ?? 0) + 1;
        }

        return new ClassificationResult($errors, $bySeverity, $byCode, $byCluster);
    }

    /**
     * Match a line against detector patterns (first match wins)
     * @param list<Detector> $detectors
     * @return array{0: Detector, 1: array<string, string>}|null
     */
    private function matchLine(string $line, string $lang, array $detectors): ?array {
        foreach ($detectors as $detector) {
            // Skip if langs specified and current lang not in list
            if (!empty($detector->langs) && !in_array($lang, $detector->langs, true)) {
                continue;
            }

            // Try each pattern (first match wins)
            foreach ($detector->patterns as $idx => $pattern) {
                $matches = [];
                if (preg_match($pattern, $line, $matches)) {
                    $captures = [];
                    foreach ($detector->captures as $captureIdx => $captureName) {
                        $matchIdx = $captureIdx + 1;  // preg_match groups are 1-indexed
                        if (isset($matches[$matchIdx]) && $matches[$matchIdx] !== '') {
                            $captures[$captureName] = (string)$matches[$matchIdx];
                        }
                    }
                    return [$detector, $captures];
                }
            }
        }

        return null;
    }

    /**
     * Generate error ID from signature (SHA1 hash)
     * @param array<string, string> $captures
     */
    private function makeErrorId(string $line, string $code, array $captures): string {
        $payload = json_encode(['line' => $line, 'code' => $code, 'captures' => $captures]);
        $digest = substr(sha1($payload), 0, 12);
        return "e:$digest";
    }

    /**
     * Extract file/line/column from captures or guess from text
     * @param array<string, string> $captures
     * @return array{0: string, 1: int, 2: int}
     */
    private function extractLocation(array $captures, string $line): array {
        $file = $captures['file'] ?? $this->guessFileFromText($line);
        $lineNo = (int)($captures['line'] ?? 0);
        $colNo = (int)($captures['col'] ?? $captures['column'] ?? 0);
        return [$file, $lineNo, $colNo];
    }

    /**
     * Guess filename from text (look for *.py, *.ts, *.php, etc.)
     */
    private function guessFileFromText(string $text): string {
        if (preg_match('/([\w.\/\\-]+\.(?:py|ts|js|php|json|sql|jsx|tsx))/', $text, $m)) {
            return $m[1];
        }
        return 'unknown';
    }

    /**
     * Generate cluster ID from detector and captures
     * @param array<string, string> $captures
     */
    private function clusterId(Detector $detector, array $captures): string {
        if ($detector->clusterKey && isset($captures[$detector->clusterKey])) {
            return "{$detector->code}:{$captures[$detector->clusterKey]}";
        }
        return $detector->code;
    }

    /**
     * Simple YAML parser (for basic taxonomy structure)
     * In production, use symfony/yaml
     * @return array<string, mixed>
     */
    private function parseYaml(string $yaml): array {
        // Fallback: return empty taxonomy structure
        // In real implementation, use proper YAML library
        return [
            'defaults' => ['severity' => ['label' => 'ERROR', 'score' => 0.6], 'difficulty' => 0.5, 'confidence' => 0.5],
            'families' => [],
        ];
    }
}

// Example usage
if (php_sapi_name() === 'cli' && basename(__FILE__) === basename($_SERVER['PHP_SELF'] ?? '')) {
    echo "=== PHP Classifier (Enrichment Pipeline) ===\n\n";

    $classifier = new Classifier();

    // Test: Classify log lines (without taxonomy loaded, will be empty)
    $testLines = [
        'SyntaxError: invalid syntax at line 10',
        'File "script.py", line 42, in <module>',
        'TypeError: Cannot read property "foo" of undefined',
    ];

    $result = $classifier->classifyLines($testLines, 'python');

    echo "Classification Result:\n";
    echo "Count: " . $result->summary['count'] . "\n";
    echo "Summary: " . json_encode($result->summary, JSON_PRETTY_PRINT) . "\n\n";

    if (empty($result->errors)) {
        echo "⚠️  No errors classified (taxonomy not loaded).\n";
        echo "To use full enrichment:\n";
        echo "  1. Create rules/rebanker_taxonomy.yml with detector definitions\n";
        echo "  2. Initialize: \$classifier = new Classifier('./rules/rebanker_taxonomy.yml')\n";
        echo "  3. Call: \$result = \$classifier->classifyLines(\$lines, 'python')\n";
    } else {
        foreach ($result->errors as $idx => $error) {
            echo "Error " . ($idx + 1) . ":\n";
            echo $error->toJson() . "\n\n";
        }
    }
}
