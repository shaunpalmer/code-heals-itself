<?php
/**
 * PHP Rebanker: Error Classification System
 * 
 * Classifies errors as Easy/Medium/Hard based on error type, context, and taxonomy.
 * Ported from Python (ops/rebank/rebank_py.py) with cross-language parity.
 * 
 * Provides confidence scores and reasoning for error difficulty assessment.
 */

declare(strict_types=1);

namespace CodeHealsItself\PhpAgent;

/**
 * Error classification difficulty levels (matches Python enum)
 */
enum ErrorDifficulty: string {
    case EASY = 'EASY';
    case MEDIUM = 'MEDIUM';
    case HARD = 'HARD';
}

/**
 * Error classification result
 */
class ErrorClassification {
    public ErrorDifficulty $difficulty;
    public float $confidence;       // 0.0-1.0
    public string $reasoning;
    public string $taxonomy;        // e.g., "SYNTAX", "LOGIC", "RUNTIME"
    public float $cascadeRisk;      // 0.0-1.0, likelihood of cascading errors

    public function __construct(
        ErrorDifficulty $difficulty,
        float $confidence,
        string $reasoning,
        string $taxonomy = 'UNKNOWN',
        float $cascadeRisk = 0.0
    ) {
        $this->difficulty = $difficulty;
        $this->confidence = max(0.0, min(1.0, $confidence));  // Clamp to 0-1
        $this->reasoning = $reasoning;
        $this->taxonomy = $taxonomy;
        $this->cascadeRisk = max(0.0, min(1.0, $cascadeRisk));
    }

    /**
     * Convert to array for JSON serialization
     */
    public function toArray(): array {
        return [
            'difficulty' => $this->difficulty->value,
            'confidence' => round($this->confidence, 3),
            'reasoning' => $this->reasoning,
            'taxonomy' => $this->taxonomy,
            'cascade_risk' => round($this->cascadeRisk, 3)
        ];
    }

    /**
     * Convert to JSON
     */
    public function toJson(): string {
        return json_encode($this->toArray(), JSON_UNESCAPED_SLASHES);
    }
}

/**
 * Rebanker: Error Classification Engine
 * 
 * Classifies errors by analyzing:
 * 1. Error message and stack trace
 * 2. Error type (syntax, logic, runtime, etc.)
 * 3. Cascade risk (how likely to spawn more errors)
 * 4. Complexity heuristics (variable scope, recursion, etc.)
 */
final class Rebanker {
    
    // Easy patterns (simple fixes, low cascade risk)
    private const EASY_PATTERNS = [
        'syntax' => [
            '/Missing.*semicolon/',
            '/unexpected token/',
            '/Missing.*bracket/',
            '/Missing.*comma/',
            '/Missing.*quote/',
            '/Unterminated string/',
            '/unmatched.*paren/',
        ],
        'type' => [
            '/Type.*mismatch/',
            '/is not a function/',
            '/Cannot read property/',
            '/undefined is not an object/',
        ]
    ];

    // Medium patterns (moderate complexity, some cascade risk)
    private const MEDIUM_PATTERNS = [
        'scope' => [
            '/Undefined variable/',
            '/out of scope/',
            '/ReferenceError/',
            '/is not defined/',
        ],
        'logic' => [
            '/Logic error/',
            '/Conditional mismatch/',
            '/Loop.*infinite/',
            '/Array out of bounds/',
        ],
        'dependency' => [
            '/Cannot find module/',
            '/Module not found/',
            '/Import error/',
            '/Missing dependency/',
        ]
    ];

    // Hard patterns (complex fixes, high cascade risk)
    private const HARD_PATTERNS = [
        'cascade' => [
            '/Cascade.*error/',
            '/Cascading.*failure/',
            '/Multiple.*dependent/',
            '/Chain reaction/',
        ],
        'concurrency' => [
            '/Race condition/',
            '/Deadlock/',
            '/Thread safety/',
            '/Synchronization/',
        ],
        'architecture' => [
            '/Architectural.*issue/',
            '/Design pattern/',
            '/Refactor.*required/',
            '/Breaking change/',
        ],
        'security' => [
            '/Security.*vulnerability/',
            '/Buffer overflow/',
            '/SQL injection/',
            '/Cross-site.*script/',
        ]
    ];

    /**
     * Classify an error based on its message and context
     */
    public function classifyError(
        string $errorMessage,
        string $errorType = 'UNKNOWN',
        string $stackTrace = '',
        ?string $context = null
    ): ErrorClassification {
        
        $message = strtolower($errorMessage);
        $trace = strtolower($stackTrace);
        $combined = $message . ' ' . $trace;

        // Step 1: Try pattern matching
        $result = $this->matchPatterns($combined, $errorType);
        if ($result !== null) {
            return $result;
        }

        // Step 2: Heuristic analysis if no pattern matched
        return $this->analyzeHeuristics($errorMessage, $errorType, $stackTrace, $context);
    }

    /**
     * Match error against known patterns
     */
    private function matchPatterns(string $errorText, string $errorType): ?ErrorClassification {
        
        // Check EASY patterns
        foreach (self::EASY_PATTERNS as $category => $patterns) {
            foreach ($patterns as $pattern) {
                if (preg_match($pattern, $errorText)) {
                    return new ErrorClassification(
                        difficulty: ErrorDifficulty::EASY,
                        confidence: 0.85,
                        reasoning: "Pattern match: $category ($pattern)",
                        taxonomy: $errorType,
                        cascadeRisk: 0.1
                    );
                }
            }
        }

        // Check MEDIUM patterns
        foreach (self::MEDIUM_PATTERNS as $category => $patterns) {
            foreach ($patterns as $pattern) {
                if (preg_match($pattern, $errorText)) {
                    return new ErrorClassification(
                        difficulty: ErrorDifficulty::MEDIUM,
                        confidence: 0.75,
                        reasoning: "Pattern match: $category ($pattern)",
                        taxonomy: $errorType,
                        cascadeRisk: 0.4
                    );
                }
            }
        }

        // Check HARD patterns
        foreach (self::HARD_PATTERNS as $category => $patterns) {
            foreach ($patterns as $pattern) {
                if (preg_match($pattern, $errorText)) {
                    return new ErrorClassification(
                        difficulty: ErrorDifficulty::HARD,
                        confidence: 0.80,
                        reasoning: "Pattern match: $category ($pattern)",
                        taxonomy: $errorType,
                        cascadeRisk: 0.75
                    );
                }
            }
        }

        return null;
    }

    /**
     * Analyze error using heuristics when patterns don't match
     */
    private function analyzeHeuristics(
        string $errorMessage,
        string $errorType,
        string $stackTrace,
        ?string $context
    ): ErrorClassification {
        
        $message = strtolower($errorMessage);
        $trace = strtolower($stackTrace);
        
        // Default difficulty based on error type
        $defaultDifficulty = match($errorType) {
            'SYNTAX' => ErrorDifficulty::EASY,
            'RUNTIME' => ErrorDifficulty::MEDIUM,
            'LOGIC' => ErrorDifficulty::MEDIUM,
            'TYPE_MISMATCH' => ErrorDifficulty::EASY,
            'SCOPE' => ErrorDifficulty::MEDIUM,
            'PERFORMANCE' => ErrorDifficulty::HARD,
            'SECURITY' => ErrorDifficulty::HARD,
            default => ErrorDifficulty::MEDIUM,
        };

        // Heuristic 1: Stack trace depth (deeper = harder)
        $traceLines = count(array_filter(explode("\n", $stackTrace)));
        $cascadeRisk = min(1.0, $traceLines / 10.0);  // 10+ lines = high cascade risk

        // Heuristic 2: Message length (very long = possibly complex)
        $messageLength = strlen($errorMessage);
        if ($messageLength > 200) {
            $cascadeRisk = min(1.0, $cascadeRisk + 0.2);
        }

        // Heuristic 3: Repeated keywords (multiple issues = harder)
        $errorKeywords = ['error', 'failed', 'invalid', 'undefined', 'null', 'undefined'];
        $keywordCount = 0;
        foreach ($errorKeywords as $keyword) {
            $keywordCount += substr_count($message, $keyword);
        }
        if ($keywordCount > 3) {
            $cascadeRisk = min(1.0, $cascadeRisk + 0.1);
        }

        // Determine confidence based on heuristics
        $confidence = 0.6;  // Base confidence for heuristic analysis
        if ($keywordCount > 0) {
            $confidence = min(0.8, 0.6 + ($keywordCount * 0.05));
        }

        return new ErrorClassification(
            difficulty: $defaultDifficulty,
            confidence: $confidence,
            reasoning: "Heuristic analysis: $errorType ($traceLines trace lines, $messageLength chars, $keywordCount keywords)",
            taxonomy: $errorType,
            cascadeRisk: $cascadeRisk
        );
    }

    /**
     * Batch classify multiple errors
     * @param array[] $errors Array of [message, type, stackTrace, context]
     * @return ErrorClassification[]
     */
    public function classifyBatch(array $errors): array {
        $results = [];
        foreach ($errors as $error) {
            $results[] = $this->classifyError(
                errorMessage: $error['message'] ?? '',
                errorType: $error['type'] ?? 'UNKNOWN',
                stackTrace: $error['stackTrace'] ?? '',
                context: $error['context'] ?? null
            );
        }
        return $results;
    }

    /**
     * Get difficulty statistics (for monitoring)
     */
    public function getDifficultyStats(array $classifications): array {
        $stats = [
            'EASY' => 0,
            'MEDIUM' => 0,
            'HARD' => 0,
            'total' => count($classifications),
            'avg_confidence' => 0.0,
            'avg_cascade_risk' => 0.0
        ];

        $totalConfidence = 0.0;
        $totalCascade = 0.0;

        foreach ($classifications as $c) {
            $stats[$c->difficulty->value]++;
            $totalConfidence += $c->confidence;
            $totalCascade += $c->cascadeRisk;
        }

        if (count($classifications) > 0) {
            $stats['avg_confidence'] = round($totalConfidence / count($classifications), 3);
            $stats['avg_cascade_risk'] = round($totalCascade / count($classifications), 3);
        }

        return $stats;
    }
}

// Example usage
if (php_sapi_name() === 'cli' && basename(__FILE__) === basename($_SERVER['PHP_SELF'] ?? '')) {
    echo "=== PHP Rebanker Example ===\n\n";

    $rebanker = new Rebanker();

    // Test Case 1: Easy syntax error
    $easy = $rebanker->classifyError(
        errorMessage: "Unexpected token } at line 5",
        errorType: 'SYNTAX'
    );
    echo "Test 1 (Easy):\n";
    echo $easy->toJson() . "\n\n";

    // Test Case 2: Medium scope error
    $testVar = 'undefined_var';
    $medium = $rebanker->classifyError(
        errorMessage: "Undefined variable: " . $testVar,
        errorType: 'SCOPE'
    );
    echo "Test 2 (Medium):\n";
    echo $medium->toJson() . "\n\n";

    // Test Case 3: Hard security issue
    $hard = $rebanker->classifyError(
        errorMessage: "Potential SQL injection vulnerability detected in query",
        errorType: 'SECURITY'
    );
    echo "Test 3 (Hard):\n";
    echo $hard->toJson() . "\n\n";

    // Batch classification
    $errors = [
        ['message' => 'Missing semicolon', 'type' => 'SYNTAX'],
        ['message' => 'Undefined function call', 'type' => 'RUNTIME'],
        ['message' => 'Buffer overflow in C extension', 'type' => 'SECURITY'],
    ];

    $classifications = $rebanker->classifyBatch($errors);
    $stats = $rebanker->getDifficultyStats($classifications);

    echo "Batch Results:\n";
    echo json_encode($stats, JSON_PRETTY_PRINT) . "\n";
}
