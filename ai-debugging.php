<?php
declare(strict_types=1);
namespace CodeHealsItself\PhpAgent;
require_once __DIR__ . '/utils/php/confidence_scoring.php';
require_once __DIR__ . '/utils/php/cascading_error_handler.php';
require_once __DIR__ . '/utils/php/envelope.php';
require_once __DIR__ . '/utils/php/strategy.php';
require_once __DIR__ . '/utils/php/human_debugging.php';
// PHP Agent components
require_once __DIR__ . '/agents/php-agent/CodePreprocessor.php';
require_once __DIR__ . '/agents/php-agent/Classifier.php';
require_once __DIR__ . '/agents/php-agent/HealingPipeline.php';
require_once __DIR__ . '/agents/php-agent/EnvelopeStorage.php';
require_once __DIR__ . '/agents/php-agent/Rebanker.php';
// Schema validation
use Opis\JsonSchema\Validator;
use Opis\JsonSchema\ValidationResult;
use CodeHealsItself\PhpAgent\CodePreprocessor;
use CodeHealsItself\PhpAgent\Classifier;
use CodeHealsItself\PhpAgent\HealingPipeline;
use CodeHealsItself\PhpAgent\EnvelopeStorage;
use CodeHealsItself\PhpAgent\Rebanker;
use CodeHealsItself\PhpAgent\HealingEnvelope;
// ---- Helper functions (parity with Python) ----
// Define as namespaced functions so they can be reused across classes.
if (!function_exists(__NAMESPACE__ . '\\sha256_json')) {
    /**
     * Canonical SHA-256 of a JSON-serializable array (immutability check).
     * Mirrors Python sha256_json().
     */
    function sha256_json(array $obj): string
    {
        // Canonicalize deterministically without relying on JSON_* flags that may be missing
        $normalize = function ($value) use (&$normalize) {
            if (is_array($value)) {
                // Distinguish assoc vs list
                $isAssoc = array_keys($value) !== range(0, count($value) - 1);
                if ($isAssoc) {
                    ksort($value, SORT_STRING);
                    foreach ($value as $k => $v) {
                        $value[$k] = $normalize($v);
                    }
                    return (object)$value; // encode as object
                }
                // list
                return array_map($normalize, $value);
            }
            return $value;
        };
        $normalized = $normalize($obj);
        $canonical = json_encode($normalized, \JSON_UNESCAPED_UNICODE | \JSON_UNESCAPED_SLASHES);
        return hash('sha256', $canonical ?: '');
    }
}
if (!function_exists(__NAMESPACE__ . '\\assert_rebanker_immutable')) {
    /**
     * Enforces the immutable Rebanker packet invariant.
     * Throws if the stored hash doesn’t match the recomputed hash.
     */
    function assert_rebanker_immutable(array $curRaw, string $curHash): void
    {
        $computed = sha256_json($curRaw);
        if ($computed !== $curHash) {
            throw new \RuntimeException(
                "IMMUTABLE REBANKER INVARIANT VIOLATED\n" .
                "expected={$curHash} computed={$computed}"
            );
        }
    }
}
if (!function_exists(__NAMESPACE__ . '\\error_delta')) {
    /**
     * Computes error delta classification between attempts.
     * Mirrors Python error_delta(): first | resolved | same_error | mutated.
     *
     * @return array{kind:string,details:string}
     */
    function error_delta(?array $prevRaw, ?array $curRaw): array
    {
        if ($prevRaw === null) {
            return ['kind' => 'first', 'details' => 'Initial attempt, no previous baseline'];
        }
        // Resolved: no current packet or explicit clean status
        if ($curRaw === null || (($curRaw['status'] ?? null) === 'clean')) {
            return ['kind' => 'resolved', 'details' => 'Error has been fixed'];
        }
        // Same location → same_error (line+file if available)
        $prevLine = $prevRaw['line'] ?? null;
        $prevFile = $prevRaw['file'] ?? null;
        $curLine  = $curRaw['line'] ?? null;
        $curFile  = $curRaw['file'] ?? null;
        if ($prevLine !== null && $curLine !== null && $prevLine === $curLine && $prevFile === $curFile) {
            return ['kind' => 'same_error', 'details' => 'Same error location persists'];
        }
        // Otherwise, mutated (changed location/type/message)
        return ['kind' => 'mutated', 'details' => 'Error signature/location changed'];
    }
}
if (!function_exists(__NAMESPACE__ . '\\parse_php_error_location')) {
    /**
     * Best-effort parse of PHP error message to extract file and line.
     * Looks for patterns like: "in /path/file.php on line 123".
     * Returns [file, line] with sensible defaults when not found.
     * @return array{0:string,1:int}
     */
    function parse_php_error_location(string $message): array
    {
        $file = 'snippet.php';
        $line = 0;
        // Common PHP error format
        if (preg_match('/ in (.+?) on line (\d+)/', $message, $m)) {
            $file = $m[1] ?? $file;
            $line = (int)($m[2] ?? 0);
        }
        return [$file, $line];
    }
}
final class HealerPolicy {
    public float $syntax_conf_floor = 0.9999; // 99.99% - PHP syntax errors are FATAL
    public float $logic_conf_floor  = 0.80;
    public int   $max_syntax_attempts = 3;
    public int   $max_logic_attempts  = 10;
    public float $syntax_error_budget = 0.03; // 3%
    public float $logic_error_budget  = 0.10; // 10%
    public int   $rate_limit_per_min  = 10;
    public string $sandbox_isolation  = 'full';
    public bool $require_human_on_risky = true;
    /** @var string[] */
    public array $risky_keywords = ['database_schema_change','authentication_bypass','production_data_modification'];
}
final class AIDebugger {
    private HealerPolicy $policy;
    private \UnifiedConfidenceScorer $scorer;
    private \DualCircuitBreaker $breaker;
    private \CascadingErrorHandler $cascade;
    private \SandboxExecution $sandbox;
    private \AIPatchEnvelope $enveloper;
    private \MemoryBuffer $memory;
    private \SeniorDeveloperSimulator $human;
    private \Debugger $debugger;
    private HealingPipeline $pipeline;
    private EnvelopeStorage $envelopeStorage;
    /** @var float[] */
    private array $tokens = []; // unix timestamps for simple rate limiting
    public function __construct(?HealerPolicy $policy = null) {
        $this->policy = $policy ?? new HealerPolicy();
        $this->scorer   = new \UnifiedConfidenceScorer(1.0, 1000);
        $this->breaker  = new \DualCircuitBreaker(
            $this->policy->max_syntax_attempts,
            $this->policy->max_logic_attempts,
            $this->policy->syntax_error_budget,
            $this->policy->logic_error_budget
        );
        $this->cascade  = new \CascadingErrorHandler();
        $this->sandbox  = new \SandboxExecution(\Environment::SANDBOX, $this->policy->sandbox_isolation);
        $this->enveloper= new \AIPatchEnvelope();
        $this->memory   = new \MemoryBuffer(500);
        $this->human    = new \SeniorDeveloperSimulator();
        $this->debugger = new \Debugger(new \LogAndFixStrategy());
        // Healing infrastructure (NO OBSERVER - use breaker-based decisions)
        $this->pipeline = new HealingPipeline();
        $this->envelopeStorage = new EnvelopeStorage('/data/envelopes.db');
    }
    /**
     * HEALING LOOP ORCHESTRATION (PARITY WITH PYTHON/TYPESCRIPT)
     * 
     * Architecture: Breaker-based decisions (not observer)
     * Flow: error_delta → velocity → breaker.canAttempt() → decision
     * 
     * Decision Logic (conservative, 4-5 attempts minimum):
     * 1. ROLLBACK: Hard + stalling + early (3-4 attempts)
     * 2. ESCALATE: Hard + stalling + late (5+ attempts)
     * 3. ESCALATE: Extreme (>0.8) at 4+ attempts
     * 4. ESCALATE: Hit 8-attempt limit
     * 5. CONTINUE: Default (making progress)
     * 
     * @param string $code Current code to heal
     * @param int $previousErrors Error count before healing
     * @param int $attemptNumber Current attempt (1-8)
     * @param string $errorMessage Error message for classification
     * @param float $temperature Temperature for LLM exploration (0.8-1.2)
     * @return array<string,mixed> {decision, metrics, reasoning, envelope}
     */
    public function attemptHealing(
        string $code,
        int $previousErrors,
        int $attemptNumber = 1,
        string $errorMessage = '',
        float $temperature = 1.0
    ): array {
        $envelope = new HealingEnvelope();
        // Initialize basic envelope context (file/line parsed from error if present)
        [$errFile, $errLine] = parse_php_error_location($errorMessage ?: '');
        $envelope->file = $errFile;
        $envelope->line = (int)$errLine;
        $envelope->column = 0;
        $envelope->message = $errorMessage;
        // ========================================
        // STEP 1: Classify error difficulty upfront
        // ========================================
        $rebanker = new Rebanker();
        $classification = $rebanker->classifyError(
            errorMessage: $errorMessage ?: 'Unclassified error',
            lang: 'php',
            file: $errFile,
            line: $errLine > 0 ? $errLine : null,
            column: null
        );
        // Fallback taxonomy tag and hint for common PHP parse errors if taxonomy didn't match
        $taxonomyCode = $classification->code ?? 'UNKNOWN.UNKNOWN';
        $hintText = $classification->hint ?? '';
        if ($taxonomyCode === 'UNKNOWN.UNKNOWN' && $errorMessage) {
            if (stripos($errorMessage, 'Parse error') !== false || stripos($errorMessage, 'syntax error') !== false) {
                $taxonomyCode = 'SYN.SYNTAX_ERROR';
                if ($hintText === '') {
                    $hintText = 'PHP syntax error detected. Use php -l to validate; check missing semicolons, quotes, or braces.';
                }
            }
        }
        // Re-banker immutability: capture raw packet + hash and assert
        $reb_raw = [
            'difficulty' => $classification->difficulty ?? 0.5,
            'confidence' => $classification->confidence ?? 0.5,
            'taxonomy'   => $taxonomyCode,
            'hint'       => $hintText ?: null,
            'message'    => $errorMessage,
            'file'       => $errFile,
            'line'       => $errLine,
            'attempt'    => $attemptNumber,
        ];
        $reb_hash = sha256_json($reb_raw);
        if (!isset($envelope->metadata) || !is_array($envelope->metadata)) {
            $envelope->metadata = [];
        }
        $envelope->metadata['rebanker_raw'] = $reb_raw;
        $envelope->metadata['rebanker_hash'] = $reb_hash;
        assert_rebanker_immutable($envelope->metadata['rebanker_raw'], $envelope->metadata['rebanker_hash']);
        $difficulty = is_numeric($classification->difficulty ?? null)
            ? (float)$classification->difficulty
            : 0.5;
        $confidence = (float)($classification->confidence ?? 0.6);
        $envelope->difficulty = match (true) {
            $difficulty < 0.33 => 'EASY',
            $difficulty < 0.66 => 'MEDIUM',
            default => 'HARD',
        };
    $envelope->confidence = $confidence;
    // Attach taxonomy and hint to envelope for downstream consumers
    $envelope->clusterId = $taxonomyCode;
    $envelope->hint = $hintText;
        // ========================================
        // STEP 2: Execute healing attempt in sandbox
        // ========================================
        $result = $this->sandbox->execute_patch([
            'patch_id' => $envelope->id,
            'language' => 'php',
            'patched_code' => $code,
            'original_code' => $code,
        ]);
        $newErrorCount = (int)($result['error_count'] ?? $previousErrors);
        $errorDelta = $previousErrors - $newErrorCount;  // positive = progress
        $envelope->addAttempt($attemptNumber, 'EXECUTE', $result['status'] ?? 'unknown', $errorDelta);
    // Stash metrics onto envelope so storage can observe progress over time (after velocity computed)
    // ========================================
        // STEP 3: Calculate velocity (convergence rate)
        // ========================================
        $velocity = ($attemptNumber > 0) ? ($errorDelta / $attemptNumber) : 0.0;
        // Get rolling window velocity from recent attempts
        try {
            $recentAttempts = $this->envelopeStorage->getRecentEnvelopes(5);
            $velocityTrend = [];
            foreach ($recentAttempts as $recentEnv) {
                if (!empty($recentEnv['attempts'])) {
                    $lastAttempt = end($recentEnv['attempts']);
                    if (isset($lastAttempt['error_delta'])) {
                        $velocityTrend[] = $lastAttempt['error_delta'];
                    }
                }
            }
            if (!empty($velocityTrend)) {
                $velocity = array_sum($velocityTrend) / count($velocityTrend);
            }
        } catch (\Exception $e) {
            // Storage not available - use simple velocity
    }
    $envelope->velocity = $velocity;
    $envelope->errorDelta = $errorDelta;
    $envelope->breakerState = ($this->breaker->get_state_summary()['state'] ?? 'CLOSED');
    $envelope->cascadeDepth = method_exists($this->cascade, 'get_depth') ? $this->cascade->get_depth() : 0;
        // ========================================
        // STEP 4: Success check (early exit)
        // ========================================
        if ($newErrorCount === 0) {
            // SYNTAX VALIDATION: For PHP, syntax errors are FATAL
            // Even if error count is 0, verify no syntax errors remain using linting
            $syntaxErrorsRemaining = $this->validateSyntaxErrorsEliminated($code);
            if ($syntaxErrorsRemaining) {
                // Syntax errors still present - cannot promote, must continue healing
                $envelope->addAttempt($attemptNumber, 'VALIDATE_SYNTAX', 'syntax_errors_remaining', $errorDelta);
            } else {
                try {
                    // Align with EnvelopeStorage signature: (error_code, cluster_id, fix_description, fix_diff, confidence)
                    $this->envelopeStorage->recordSuccessPattern(
                        $taxonomyCode,
                        (string)($classification->cluster_id ?? $taxonomyCode),
                        $code,
                        '',
                        (float)($classification->confidence ?? 0.9)
                    );
                } catch (\Exception $e) {
                    // Storage failure - non-fatal
                }
                // Record success envelope for history
                try { $this->envelopeStorage->addEnvelope($envelope, 'PROMOTE'); } catch (\Throwable $t) {}
                $complete = [
                    'decision' => 'COMPLETE',
                    'attempt' => $attemptNumber,
                    'action' => 'COMPLETE',
                    'metrics' => [
                        'errorDelta' => $errorDelta,
                        'velocity' => $velocity,
                        'difficulty' => $difficulty,
                        'newErrorCount' => $newErrorCount,
                    ],
                    'reasoning' => 'Zero errors detected AND syntax validated - healing complete',
                    'envelope' => $envelope->toArray(),
                    'llm_context' => $this->buildLLMContext(
                        error: $errorMessage,
                        file: $envelope->file ?? 'unknown',
                        line: (int)($envelope->line ?? 0),
                        taxonomy: $taxonomyCode,
                        hint: $hintText,
                        difficultyLabel: $envelope->difficulty ?? 'MEDIUM',
                        confidence: (float)$envelope->confidence,
                        velocity: (float)$velocity,
                        errorDelta: (float)$errorDelta,
                        attempt: $attemptNumber,
                        breakerState: (string)($this->breaker->get_state_summary()['state'] ?? 'CLOSED'),
                        decision: 'COMPLETE',
                        reasoning: 'Zero errors and syntax validated'
                    ),
                    'temperature' => $temperature,
                ];
                $complete['llm_context']['memory'] = $this->getMemoryContextForLLM();
                return $complete;
            }
        }
    // ========================================
    // STEP 5: Gates (Circuit Breaker + Cascade) — parity with Python
    // ========================================
    // Map rebanker classification to ErrorType for circuit breaker
    $errorType = \DualCircuitBreaker::getErrorTypeFromClassification($classification);
    [$canAttempt, $cbReason] = $this->breaker->can_attempt($errorType);
    [$shouldStop, $cascadeReason] = $this->cascade->should_stop_attempting();
    $breakerSummary = $this->breaker->get_state_summary();
    $canContinue = $canAttempt && !$shouldStop;
        // Decision logic (conservative, 4-5 attempts minimum)
        $isStalling = ($velocity < 0.05);
        $isHardProblem = ($difficulty >= 0.65);
        $isExtremeCase = ($difficulty >= 0.80);
        $attemptThreshold = 5;
        $maxAttempts = 8;
        // Decision logic
        $decision = $this->decideNextAction($errorDelta, $velocity, $difficulty, $newErrorCount, $attemptNumber, $canContinue, $envelope);
    // Persist envelope with mapped action so memory/SQLite keep recent attempts
    try { $this->envelopeStorage->addEnvelope($envelope, $decision['action'] ?? 'PENDING'); } catch (\Throwable $t) {}
        // Add stable, drift-resistant context for LLMs
        $decision['llm_context'] = $this->buildLLMContext(
            error: $errorMessage,
            file: $envelope->file ?? 'unknown',
            line: (int)($envelope->line ?? 0),
            taxonomy: $taxonomyCode,
            hint: $hintText,
            difficultyLabel: $envelope->difficulty ?? 'MEDIUM',
            confidence: (float)$envelope->confidence,
            velocity: (float)$velocity,
            errorDelta: (float)$errorDelta,
            attempt: $attemptNumber,
            breakerState: (string)($this->breaker->get_state_summary()['state'] ?? 'CLOSED'),
            decision: (string)($decision['decision'] ?? 'CONTINUE'),
            reasoning: (string)($decision['reasoning'] ?? 'Healing analysis in progress')
        );
        $decision['llm_context']['memory'] = $this->getMemoryContextForLLM();
        return $decision;
    }

    /**
     * Get recent memory context for LLM injection (hot memory → cold storage).
     */
    private function getMemoryContextForLLM(int $limit = 10): string {
        try {
            return $this->envelopeStorage->getLLMContext($limit);
        } catch (\Throwable $t) {
            return '[Memory context unavailable: ' . $t->getMessage() . ']';
        }
    }

    /**
     * Build a stable, explicit LLM context block to prevent ambiguity and drift
     * @return array<string, mixed>
     */
    private function buildLLMContext(
        string $error,
        string $file,
        int $line,
        string $taxonomy,
        string $hint,
        string $difficultyLabel,
        float $confidence,
        float $velocity,
        float $errorDelta,
        int $attempt,
        string $breakerState,
        string $decision,
        string $reasoning
    ): array {
        return [
            'summary' => [
                'decision' => $decision,
                'reason' => $reasoning,
                'attempt' => $attempt,
            ],
            'error' => [
                'message' => $error,
                'location' => [ 'file' => $file, 'line' => $line, 'column' => 0 ],
                'taxonomy_code' => $taxonomy,
                'hint' => $hint,
            ],
            'confidence' => [
                'difficulty_label' => $difficultyLabel,
                'confidence' => round($confidence, 3),
            ],
            'progress' => [
                'error_delta' => $errorDelta,
                'velocity' => round($velocity, 3),
                'breaker_state' => $breakerState,
            ],
            'next' => $this->suggestNextSteps($taxonomy, $hint, $decision)
        ];
    }

    /**
     * Provide crisp next-step guidance for the LLM based on taxonomy/hint.
     * @return list<string>
     */
    private function suggestNextSteps(string $taxonomy, string $hint, string $decision): array {
        $steps = [];
        if ($decision === 'COMPLETE') {
            return ['No further action required.'];
        }
        if (stripos($taxonomy, 'SYN') === 0) {
            $steps[] = 'Run php -l on the snippet to locate exact syntax issues.';
            $steps[] = 'Check for missing semicolons, quotes, or braces.';
        }
        if ($hint) {
            $steps[] = $hint;
        }
        if (empty($steps)) {
            $steps[] = 'Review error message and recent diff. Propose a minimal, reversible change addressing the exact line.';
        }
        return $steps;
    }
    /**
     * Validate that syntax errors are completely eliminated using PHP linting
     * PHP SYNTAX ERRORS ARE FATAL - must achieve 100% syntax correctness
     *
     * @param string $code The PHP code to validate
     * @return bool True if syntax errors remain, false if eliminated
     */
    private function validateSyntaxErrorsEliminated(string $code): bool {
        // Use PHP's built-in linter for reliable syntax checking
        $tempFile = tempnam(sys_get_temp_dir(), 'php_syntax_check_');
        file_put_contents($tempFile, $code);

        try {
            // Run php -l (lint) to check syntax without executing
            $command = "php -l \"$tempFile\" 2>&1";
            $output = shell_exec($command);

            // Clean up temp file
            unlink($tempFile);

            // PHP lint returns "No syntax errors detected" on success
            // Any other output indicates syntax errors
            if (strpos($output, 'No syntax errors detected') === false) {
                return true; // Syntax errors detected
            }

            return false; // No syntax errors
        } catch (\Exception $e) {
            // If linting fails, assume syntax errors remain (conservative approach)
            unlink($tempFile);
            return true;
        }
    }
    /**
     * attemptWithBackoff — parity with Python retry loop
     * Executes attemptHealing with exponential backoff until a terminal decision.
     *
     * @param string $code
     * @param int $initialErrors
     * @param string $errorMessage
     * @param int $maxAttempts
     * @param int $initialDelayMs
     * @return array<string,mixed>
     */
    public function attemptWithBackoff(
        string $code,
        int $initialErrors,
        string $errorMessage,
        int $maxAttempts = 6,
        int $minDelayMs = 500,
        int $maxDelayMs = 1500,
        array $gearboxModels = [],
        int $maxCycles = 2
    ): array {
        $attempt = 1;
        $prevErrors = $initialErrors;
        $temperature = 1.0;
        $currentCode = $code;
        $prevRaw = null;
        $lastResult = null;
        $nonImprovingStreak = 0;
        $modelIndex = 0;
        $cycle = 1;
        $currentModel = $gearboxModels[$modelIndex] ?? 'local';
        while ($attempt <= $maxAttempts) {
            $result = $this->attemptHealing($currentCode, $prevErrors, $attempt, $errorMessage, $temperature);
            // Immutability + delta tracking per attempt
            $env = $result['envelope'] ?? null;
            if (is_array($env)) {
                $meta = $env['metadata'] ?? [];
                if (isset($meta['rebanker_raw'], $meta['rebanker_hash'])) {
                    assert_rebanker_immutable($meta['rebanker_raw'], $meta['rebanker_hash']);
                }
                $curRaw = $meta['rebanker_raw'] ?? null;
                if (is_array($curRaw)) {
                    if (is_array($prevRaw)) {
                        $result['envelope']['metadata']['rebanker_prev'] = $prevRaw;
                    }
                    $delta = error_delta($prevRaw, $curRaw);
                    $result['envelope']['metadata']['delta_from_prev'] = $delta;
                    $prevRaw = $curRaw;
                }
            }
            $result['extras'] = $result['extras'] ?? [];
            $action = $result['action'] ?? 'RETRY';
            $trendSnapshot = $result['extras']['trend_analysis'] ?? $this->breaker->get_state_summary();
            $result['extras']['observers'] = array_merge(
                $result['extras']['observers'] ?? [],
                [
                    'trend_snapshot' => $trendSnapshot,
                    'gearbox_recommended' => !empty($result['extras']['gearbox'])
                ]
            );
            // Gearbox signal: if trend is worsening or flat, recommend model escalation
            $metrics = $result['metrics'] ?? [];
            $errorDelta = (float)($metrics['errorDelta'] ?? 0.0);
            if ($errorDelta <= 0) {
                $nonImprovingStreak += 1;
            } else {
                $nonImprovingStreak = 0;
            }
            if (($attempt >= 2 && $nonImprovingStreak >= 2) || $attempt >= 6) {
                $result['extras']['gearbox'] = [
                    'recommendation' => 'ESCALATE_MODEL',
                    'reason' => $nonImprovingStreak >= 2 ? 'Delta not improving' : 'Max attempts on small model',
                    'attempt' => $attempt,
                    'errorDelta' => $errorDelta,
                    'model' => $currentModel,
                    'cycle' => $cycle,
                ];
                if (getenv('GEARBOX_FORCE_ESCALATE') === '1') {
                    $result['action'] = 'ESCALATE';
                    $result['decision'] = 'ESCALATE';
                    return $result;
                }
            }
            // Auto-restart cycle with next model (gearbox upshift)
            if (!empty($result['extras']['gearbox']) && $attempt >= $maxAttempts && ($modelIndex + 1) < count($gearboxModels) && $cycle < $maxCycles) {
                $modelIndex += 1;
                $cycle += 1;
                $currentModel = $gearboxModels[$modelIndex];
                $result['extras']['gearbox']['switched'] = true;
                $result['extras']['gearbox']['next_model'] = $currentModel;
                $attempt = 1;
                $nonImprovingStreak = 0;
                $prevRaw = null;
                continue;
            }
            if (in_array($action, ['PROMOTE','ROLLBACK','HUMAN_REVIEW'], true)) {
                return $result;
            }
            // Update state and backoff
            $prevErrors = (int)($metrics['newErrorCount'] ?? $prevErrors);
            $temperature = (float)($result['temperature'] ?? $temperature);
            if (in_array($action, ['RETRY','PAUSE_AND_BACKOFF'], true)) {
                $backoffMs = min($maxDelayMs, $minDelayMs * (2 ** ($attempt - 1)));
                $jitter = 0.8 + (mt_rand() / mt_getrandmax()) * 0.4;
                $waitMs = (int)round($backoffMs * $jitter);
                usleep($waitMs * 1000);
                $currentCode = $this->minimalTweak($currentCode, $errorMessage);
            }
            $lastResult = $result;
            $attempt += 1;
        }
        return $lastResult ?? [
            'decision' => 'ESCALATE',
            'attempt' => $maxAttempts,
            'action' => 'ESCALATE',
            'reasoning' => 'Max attempts reached in backoff loop',
        ];
    }
    /**
     * Process error (original method - kept for backward compatibility)
     * @param string $message
     * @param string $patch_code
     * @param string $original_code
     * @param float[] $logits
     * @param array<string,mixed>|null $historical
     * @param array<string,mixed>|null $metadata
     * @return array<string,mixed>
     */
    public function process_error(
        $error_type,
        string $message,
        string $patch_code,
        string $original_code,
        array $logits,
        ?array $historical = null,
        ?array $metadata = null
    ): array {
        $this->enforce_rate_limit();
        $patch = [
            'message'=>$message,'patched_code'=>$patch_code,'original_code'=>$original_code,'language'=>'php'
        ];
        $envelope = $this->enveloper->wrapPatch($patch);
        if ($metadata) { $envelope->metadata = array_merge($envelope->metadata, $metadata); }
        $envelope->metadata['attempt'] = (int)($metadata['attempt'] ?? 1);
        $envelope->metadata['error_type'] = (string)$error_type;
        // Rebanker immutability + taxonomy difficulty parity (Python)
        [$errFile, $errLine] = parse_php_error_location($message);
        $classification = null;
        $taxonomyDifficulty = null;
        $taxonomyCode = 'UNKNOWN.UNKNOWN';
        $hintText = '';
        $rebankerResult = null;
        try {
            $rebanker = new Rebanker();
            $classification = $rebanker->classifyError(
                errorMessage: $message ?: 'Unclassified error',
                lang: 'php',
                file: $errFile,
                line: $errLine > 0 ? $errLine : null,
                column: null
            );
            if ($classification) {
                $taxonomyCode = $classification->code ?? $taxonomyCode;
                $hintText = $classification->hint ?? '';
                $taxonomyDifficulty = is_numeric($classification->difficulty ?? null)
                    ? (float)$classification->difficulty
                    : null;
                $envelope->clusterId = $taxonomyCode;
                $rebankerResult = method_exists($classification, 'toArray')
                    ? $classification->toArray()
                    : (array)$classification;
                $envelope->metadata['rebanker_result'] = $rebankerResult;
            }
        } catch (\Throwable $t) {
            // Best-effort only
        }

        $rebRaw = [
            'difficulty' => $taxonomyDifficulty ?? 0.5,
            'confidence' => (float)($classification->confidence ?? 0.5),
            'taxonomy'   => $taxonomyCode,
            'hint'       => $hintText ?: null,
            'message'    => $rebankerResult['message'] ?? $message,
            'file'       => $rebankerResult['file'] ?? $errFile,
            'line'       => $rebankerResult['line'] ?? $errLine,
            'attempt'    => (int)($metadata['attempt'] ?? 1),
            'cluster_id' => $rebankerResult['cluster_id'] ?? ($classification->cluster_id ?? null),
            'severity'   => $rebankerResult['severity'] ?? ($classification->severity ?? null),
        ];
        $envelope->metadata['rebanker_raw'] = $rebRaw;
        $envelope->metadata['rebanker_hash'] = sha256_json($rebRaw);
        $envelope->metadata['rebanker_interpreted'] = null;
        assert_rebanker_immutable($envelope->metadata['rebanker_raw'], $envelope->metadata['rebanker_hash']);
        // Success pattern context (attempt 1 only)
        if ((int)($metadata['attempt'] ?? 1) === 1 && $taxonomyCode !== 'UNKNOWN.UNKNOWN') {
            $envelope->metadata['success_patterns'] = $this->getSuccessPatternsContext($taxonomyCode);
        }
        if (!empty($envelope->metadata['rebanker_prev']) && is_array($envelope->metadata['rebanker_prev'])) {
            $envelope->metadata['delta_from_prev'] = error_delta($envelope->metadata['rebanker_prev'], $rebRaw);
        }
        // Populate schema-required fields
        $conf = $this->scorer->calculate_confidence($logits, $error_type, $historical ?? [], $taxonomyDifficulty);
        $envelope->confidenceComponents = [
            'syntax' => $conf->syntax_confidence,
            'logic' => $conf->logic_confidence,
            'risk' => $this->is_risky($patch) ? 1.0 : 0.0
        ];
        $envelope->breakerState = $this->breaker->get_state_summary()['state'];
        $envelope->cascadeDepth = $this->cascade->get_depth ? $this->cascade->get_depth() : 0;
        $envelope->resourceUsage = $this->sandbox->get_resource_usage ? $this->sandbox->get_resource_usage() : [];
        $envelope->flagged_for_developer = false;
        $envelope->developer_message = '';
        $envelope->success = false;
        // --- SCHEMA VALIDATION ---
        $schemaPath = __DIR__ . '/schemas/patch-envelope.schema.json';
        $schema = json_decode(file_get_contents($schemaPath), true);
        if ($schema === null) {
            throw new RuntimeException("Could not load PatchEnvelope schema");
        }
        $validator = new Validator();
        $envelopeJson = json_decode($envelope->to_json(), true);
        $result = $validator->validate($envelopeJson, $schema);
        if (!$result->isValid()) {
            throw new RuntimeException("PatchEnvelope validation failed: " . json_encode($result->getErrors()));
        }
        // Human heuristics → initial strategy
        $plan = $this->human->debug_like_human($message, ['error'=>$message,'code_snippet'=>$patch_code]);
        $this->debugger->set_strategy($this->map_strategy($plan['recommended_strategy'] ?? 'LogAndFixStrategy'));
        // Confidence
        $conf = $this->scorer->calculate_confidence($logits, $error_type, $historical ?? [], $taxonomyDifficulty);
        $floor = ($error_type === ErrorType::SYNTAX) ? $this->policy->syntax_conf_floor : $this->policy->logic_conf_floor;
        // Gates
        [$canAttempt,$cbReason] = $this->breaker->can_attempt($error_type);
        [$stop,$cascadeReason]  = $this->cascade->should_stop_attempting();
        $envelope->metadata['cb_reason'] = $cbReason;
        $envelope->metadata['cascade_reason'] = $cascadeReason;
        $envelope->metadata['policy_floor'] = $floor;
        if ($this->is_risky($patch) && $this->policy->require_human_on_risky) {
            $this->record_attempt($envelope, false, "Risk gate → human review");
            $envelope->flagged_for_developer = true;
            $envelope->developer_message = "Risky patch (policy). Human approval required.";
            return $this->finalize($envelope, 'HUMAN_REVIEW', array_merge(compact('cbReason','cascadeReason','floor'), [
                'trend_analysis' => $this->breaker->get_state_summary()
            ]));
        }
        $typeConf = ($error_type === ErrorType::SYNTAX) ? $conf->syntax_confidence : $conf->logic_confidence;
        if (!$canAttempt || $stop || $typeConf < $floor) {
            $this->record_attempt($envelope, false, "Gate blocked");
            return $this->finalize($envelope, 'STOP', array_merge(compact('cbReason','cascadeReason','floor'), [
                'trend_analysis' => $this->breaker->get_state_summary()
            ]));
        }
        // Sandbox exec
        $sbox = $this->sandbox->execute_patch([
            'patch_id'=>$envelope->patch_id,'language'=>'php','patched_code'=>$patch_code,'original_code'=>$original_code
        ]);
        $success = (bool)$sbox['success'];
        // Strategy follow-up
        $strat = $this->debugger->debug(['error'=>$message,'vulnerability'=>$message]);
        // Update state
        $this->breaker->record_attempt($error_type, $success);
        $this->scorer->record_outcome($conf->overall_confidence, $success);
        if (!$success) { $this->cascade->add_error_to_chain($error_type, $message, $conf->overall_confidence, 1); }
        $this->record_attempt($envelope, $success, $strat['details'] ?? '');
        $this->memory->add_outcome($envelope->to_json());
        $action = $success ? 'PROMOTE' : ($this->breaker->can_attempt($error_type)[0] ? 'RETRY' : 'ROLLBACK');
        return $this->finalize($envelope, $action, [
            'sandbox'=>$sbox,
            'strategy'=>$strat,
            'floor'=>$floor,
            'trend_analysis' => $this->breaker->get_state_summary()
        ]);
    }
    private function decideNextAction($errorDelta, $velocity, $difficulty, $newErrorCount, int $attemptNumber, $canContinue, $envelope): array {
        $isStalling = ($velocity < 0.05);
        $isHardProblem = ($difficulty >= 0.65);
        $isExtremeCase = ($difficulty >= 0.80);
        $attemptThreshold = 5;
        $maxAttempts = 8;
        if ($isHardProblem && $isStalling && $attemptNumber >= 3 && $attemptNumber < $attemptThreshold) {
            return $this->makeDecision('ROLLBACK', $attemptNumber, $errorDelta, $velocity, $difficulty, $newErrorCount,
                "Hard problem stalling at attempt {$attemptNumber}. Reverting.", 0.2, $envelope);
        }
        if ($isHardProblem && $isStalling && $attemptNumber >= $attemptThreshold) {
            return $this->makeDecision('ESCALATE', $attemptNumber, $errorDelta, $velocity, $difficulty, $newErrorCount,
                "Hard problem stalling after {$attemptThreshold} attempts.", 0.3, $envelope);
        }
        if ($isExtremeCase && $attemptNumber >= 4) {
            return $this->makeDecision('ESCALATE', $attemptNumber, $errorDelta, $velocity, $difficulty, $newErrorCount,
                "Extreme difficulty at attempt {$attemptNumber}.", 1.2, $envelope);
        }
        if ($attemptNumber >= $maxAttempts) {
            return $this->makeDecision('ESCALATE', $attemptNumber, $errorDelta, $velocity, $difficulty, $newErrorCount,
                "Maximum attempts ({$maxAttempts}) reached.", 1.0, $envelope);
        }
        if (!$canContinue) {
            return $this->makeDecision('STOP', $attemptNumber, $errorDelta, $velocity, $difficulty, $newErrorCount,
                'Circuit breaker OPEN.', 1.0, $envelope);
        }
        return $this->makeDecision('CONTINUE', $attemptNumber, $errorDelta, $velocity, $difficulty, $newErrorCount,
            'Making progress.', 1.0, $envelope);
    }

    /**
     * Conservative tweak between retries (PHP-focused).
     */
    private function minimalTweak(string $code, string $errorMessage = ''): string {
        $out = $code;
        $msg = strtolower($errorMessage);

        // Balance brackets when parse errors indicate unexpected end/unmatched
        if (str_contains($msg, 'unexpected end') || str_contains($msg, 'unmatched') || str_contains($msg, 'parse error')) {
            $pairs = [['(', ')'], ['{', '}'], ['[', ']']];
            foreach ($pairs as [$open, $close]) {
                $openCount = substr_count($out, $open);
                $closeCount = substr_count($out, $close);
                $missing = max(0, $openCount - $closeCount);
                if ($missing > 0) {
                    $out .= str_repeat($close, $missing);
                }
            }
        }

        // Add missing semicolons on simple statements (echo/return/assignment)
        $lines = explode("\n", $out);
        foreach ($lines as $i => $line) {
            $trim = trim($line);
            if ($trim === '' || str_ends_with($trim, ';') || str_ends_with($trim, '{') || str_ends_with($trim, '}') || str_starts_with($trim, '<?')) {
                continue;
            }
            if (preg_match('/^(echo|return)\b/i', $trim) || preg_match('/\$\w+\s*=/', $trim)) {
                $lines[$i] = rtrim($line) . ';';
            }
        }
        $out = implode("\n", $lines);

        return $out;
    }
    /**
     * Helper to produce a consistent decision payload for the healing loop
     * @return array<string,mixed>
     */
    private function makeDecision(
        string $action,
        int $attemptNumber,
        float $errorDelta,
        float $velocity,
        float $difficulty,
        int $newErrorCount,
        string $reason,
        float $temperature,
        HealingEnvelope $envelope
    ): array {
        return [
            'decision' => $action,
            'action' => $action,
            'attempt' => $attemptNumber,
            'metrics' => [
                'errorDelta' => $errorDelta,
                'velocity' => $velocity,
                'difficulty' => $difficulty,
                'newErrorCount' => $newErrorCount,
            ],
            'reasoning' => $reason,
            'envelope' => $envelope->toArray(),
            'temperature' => $temperature,
        ];
    }

    /**
     * Summarize recent success patterns for a given taxonomy code.
     * @return array<string,mixed>
     */
    private function getSuccessPatternsContext(string $taxonomyCode): array {
        try {
            $patterns = $this->envelopeStorage->getSuccessPatterns($taxonomyCode);
            return [
                'count' => count($patterns),
                'items' => array_slice($patterns, 0, 5)
            ];
        } catch (\Throwable $t) {
            return [
                'count' => 0,
                'items' => [],
                'error' => $t->getMessage()
            ];
        }
    }
    private function map_strategy(string $name): DebuggingStrategy {
        return match($name) {
            'RollbackStrategy' => new \RollbackStrategy(),
            'SecurityAuditStrategy' => new \SecurityAuditStrategy(),
            default => new \LogAndFixStrategy(),
        };
    }
    private function record_attempt(PatchEnvelope $env, bool $ok, string $note=''): void {
        $env->attempts[] = [
            'ts'=>microtime(true),'success'=>$ok,'note'=>$note,'breaker'=>$this->breaker->get_state_summary()
        ];
        $env->success = $env->success || $ok;
    }
    /** @return array<string,mixed> */
    private function finalize(PatchEnvelope $env, string $action, array $extras): array {
        $decision = $this->map_action_to_decision($action);
        $metrics = [
            'breakerState' => $env->breakerState ?? ($this->breaker->get_state_summary()['state'] ?? null),
            'cascadeDepth' => $env->cascadeDepth ?? null,
            'floor' => $extras['floor'] ?? null,
        ];
        $result = [
            'decision' => $decision,
            'action' => $action,
            'metrics' => $metrics,
            'envelope' => json_decode($env->to_json(), true),
            'extras' => $extras
        ];
        $result['llm_context'] = [
            'memory' => $this->getMemoryContextForLLM()
        ];
        return $result;
    }
    private function map_action_to_decision(string $action): string {
        return match($action) {
            'PROMOTE' => 'COMPLETE',
            'HUMAN_REVIEW' => 'STOP',
            'STOP' => 'STOP',
            'RETRY' => 'CONTINUE',
            'ROLLBACK' => 'ROLLBACK',
            default => 'CONTINUE',
        };
    }
    /** @param array<string,mixed> $patch */
    private function is_risky(array $patch): bool {
        $blob = strtolower(json_encode($patch) ?: '');
        foreach ($this->policy->risky_keywords as $k) { if (str_contains($blob, $k)) return true; }
        return false;
    }
    private function enforce_rate_limit(): void {
        $now = microtime(true);
        $this->tokens = array_values(array_filter($this->tokens, fn($t)=> ($now - $t) < 60.0));
        if (count($this->tokens) >= $this->policy->rate_limit_per_min) {
            throw new RuntimeException('Rate limit exceeded for patch attempts');
        }
        $this->tokens[] = $now;
    }
    // ========================================
    // ACCESSOR METHODS (for integration)
    // ========================================
    /**
     * Get the healing pipeline instance
     */
    public function getHealingPipeline(): HealingPipeline {
        return $this->pipeline;
    }
    /**
     * Get the envelope storage instance
     */
    public function getEnvelopeStorage(): EnvelopeStorage {
        return $this->envelopeStorage;
    }
    /**
     * Get the escalation observer instance
     */
    // Observer pattern intentionally removed for Python parity
    // public function getEscalationObserver(): EscalationObserver { return $this->observer; }
    /**
     * Get the circuit breaker instance
     */
    public function getCircuitBreaker(): \DualCircuitBreaker {
        return $this->breaker;
    }
}
