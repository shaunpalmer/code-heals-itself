<?php
declare(strict_types=1);

require_once __DIR__ . '/confidence_scoring.php';
require_once __DIR__ . '/cascading_error_handler.php';
require_once __DIR__ . '/envelope.php';
require_once __DIR__ . '/strategy.php';
require_once __DIR__ . '/human_debugging.php';

// PHP Agent components
require_once __DIR__ . '/agents/php-agent/HealingPipeline.php';
require_once __DIR__ . '/agents/php-agent/EnvelopeStorage.php';
require_once __DIR__ . '/agents/php-agent/Rebanker.php';

// Schema validation
use Opis\JsonSchema\Validator;
use Opis\JsonSchema\ValidationResult;
use CodeHealsItself\PhpAgent\HealingPipeline;
use CodeHealsItself\PhpAgent\EnvelopeStorage;
use CodeHealsItself\PhpAgent\Rebanker;
use CodeHealsItself\PhpAgent\EscalationObserver;
use CodeHealsItself\PhpAgent\HealingEnvelope;

final class HealerPolicy {
    public float $syntax_conf_floor = 0.98;
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
    private UnifiedConfidenceScorer $scorer;
    private DualCircuitBreaker $breaker;
    private CascadingErrorHandler $cascade;
    private SandboxExecution $sandbox;
    private AIPatchEnvelope $enveloper;
    private MemoryBuffer $memory;
    private SeniorDeveloperSimulator $human;
    private Debugger $debugger;
    private HealingPipeline $pipeline;
    private EnvelopeStorage $envelopeStorage;
    private EscalationObserver $observer;
    /** @var float[] */
    private array $tokens = []; // unix timestamps for simple rate limiting

    public function __construct(?HealerPolicy $policy = null) {
        $this->policy = $policy ?? new HealerPolicy();
        $this->scorer   = new UnifiedConfidenceScorer(1.0, 1000);
        $this->breaker  = new DualCircuitBreaker(
            $this->policy->max_syntax_attempts,
            $this->policy->max_logic_attempts,
            $this->policy->syntax_error_budget,
            $this->policy->logic_error_budget
        );
        $this->cascade  = new CascadingErrorHandler();
        $this->sandbox  = new SandboxExecution(Environment::SANDBOX(), $this->policy->sandbox_isolation);
        $this->enveloper= new AIPatchEnvelope();
        $this->memory   = new MemoryBuffer(500);
        $this->human    = new SeniorDeveloperSimulator();
        $this->debugger = new Debugger(new LogAndFixStrategy());
        
        // NEW: Healing pipeline + memory storage + observer
        $this->pipeline = new HealingPipeline();
        $this->envelopeStorage = new EnvelopeStorage('/data/envelopes.db');
        $this->observer = new EscalationObserver();
        $this->pipeline->setObserver($this->observer);
    }

    /**
     * MASHUP HEALING LOOP: Copilot's structure + Agent's logic
     * 
     * Implements intelligent rollback-before-escalate strategy:
     * 1. Classify error difficulty upfront
     * 2. Track velocity (error delta / attempt) over rolling window
     * 3. Integrate Observer with difficulty + velocity together
     * 4. Rollback if stalled + difficulty high (not immediate escalation)
     * 5. Only escalate after rollback attempts exhausted
     * 6. Record success patterns for future reference
     * 
     * Philosophy: "Shift gears like a car" - adapt intelligently, don't just escalate
     * 
     * @param string $code Current code to heal
     * @param int $previousErrors Error count before healing
     * @param int $attemptNumber Current attempt (1-8, not 3-4)
     * @param string $errorMessage Error message for classification
     * @param float $temperature Temperature for LLM exploration (0.8-1.2)
     * @return array<string,mixed> {attempt, action, error_delta, velocity, decision, envelope}
     */
    public function attemptHealing(
        string $code,
        int $previousErrors,
        int $attemptNumber = 1,
        string $errorMessage = '',
        float $temperature = 1.0
    ): array {
        $envelope = new HealingEnvelope();
        
        // ========================================
        // STEP 1: Classify error difficulty upfront
        // ========================================
        $rebanker = new Rebanker();
        $classification = $rebanker->classifyError(
            errorMessage: $errorMessage ?: 'Unclassified error',
            errorType: 'UNKNOWN',
            stackTrace: 'Code healing attempt #' . $attemptNumber
        );
        
        $difficulty = match($classification->difficulty->value ?? 'MEDIUM') {
            'EASY' => 0.33,
            'MEDIUM' => 0.66,
            'HARD' => 0.85,
            default => 0.5,
        };
        $confidence = $classification->confidence ?? 0.6;
        $cascadeRisk = $classification->cascadeRisk ?? 0.0;
        
        $envelope->difficulty = match (true) {
            $difficulty < 0.33 => 'EASY',
            $difficulty < 0.66 => 'MEDIUM',
            default => 'HARD',
        };
        $envelope->confidence = $confidence;
        $envelope->cascadeRisk = $cascadeRisk;
        
        // ========================================
        // STEP 2: Execute healing attempt
        // ========================================
        $result = $this->sandbox->execute_patch([
            'patch_id' => $envelope->id,
            'language' => 'php',
            'patched_code' => $code,
            'original_code' => $code,  // Will be replaced by actual original
        ]);
        
        $newErrorCount = (int)($result['error_count'] ?? $previousErrors);
        $errorDelta = $previousErrors - $newErrorCount;  // positive = progress
        $envelope->addAttempt($attemptNumber, 'EXECUTE', $result['status'] ?? 'unknown', $errorDelta);
        
        // ========================================
        // STEP 3: Calculate velocity (convergence rate)
        // ========================================
        // Velocity = error_delta / attempt_number (simplified)
        // More sophisticated: rolling window over last 5 attempts
        $velocity = ($attemptNumber > 0) ? ($errorDelta / $attemptNumber) : 0.0;
        
        // Retrieve recent attempts for velocity trend
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
        
        // Compute rolling velocity
        if (!empty($velocityTrend)) {
            $velocity = array_sum($velocityTrend) / count($velocityTrend);
        }
        
        // ========================================
        // STEP 4: Success check (shortcut)
        // ========================================
        if ($newErrorCount === 0) {
            // IMMEDIATE SUCCESS - record pattern and return
            $this->envelopeStorage->recordSuccessPattern(
                errorCode: substr($errorMessage, 0, 50),
                clusterId: $envelope->clusterId ?? 'unknown',
                fixDescription: $code,
                tags: ['GOLD_STANDARD']
            );
            
            return [
                'attempt' => $attemptNumber,
                'action' => 'COMPLETE',
                'error_delta' => $errorDelta,
                'velocity' => $velocity,
                'difficulty' => $envelope->difficulty,
                'decision' => 'SUCCESS',
                'envelope' => $envelope->toArray(),
                'temperature' => $temperature,
            ];
        }
        
        // ========================================
        // STEP 5: Integrate Observer (difficulty + velocity)
        // ========================================
        // This is the KEY: Feed difficulty and velocity together to Observer
        $escalationHint = $this->observer->evaluateEscalation(
            difficulty: $difficulty,
            velocity: $velocity,
            attemptNumber: $attemptNumber,
            circuitState: $this->breaker->get_state_summary()['state'] ?? 'CLOSED'
        );
        
        // ========================================
        // STEP 6: ROLLBACK-BEFORE-ESCALATE Logic
        // ========================================
        // Conservative thresholds (User insight from Phase 8):
        // - Don't escalate prematurely
        // - Give model time for softmax convergence (4-5 attempts minimum)
        // - Stalling = velocity < 0.05 (not enough progress per attempt)
        
        $isStalling = ($velocity < 0.05);
        $isHardProblem = ($difficulty >= 0.65);
        $isExtremeCase = ($difficulty >= 0.80);
        $attemptThreshold = 5;  // Don't escalate before attempt 5
        $maxAttempts = 8;       // Hard limit at 8 attempts
        
        // Condition 1: Hard + stalling + enough attempts given
        if ($isHardProblem && $isStalling && $attemptNumber >= 3 && $attemptNumber < $attemptThreshold) {
            // ROLLBACK: Try reverting to best previous state + increase exploration
            $bestAttempt = $this->envelopeStorage->getBestRecentAttempt(5);
            
            if ($bestAttempt) {
                return [
                    'attempt' => $attemptNumber,
                    'action' => 'ROLLBACK',
                    'error_delta' => $errorDelta,
                    'velocity' => $velocity,
                    'difficulty' => $envelope->difficulty,
                    'decision' => 'ROLLBACK_TO_BEST_STATE',
                    'reason' => 'Hard problem stalling - reverting to best state and increasing exploration',
                    'temperature' => $temperature + 0.2,  // More exploration
                    'envelope' => $envelope->toArray(),
                ];
            }
        }
        
        // Condition 2: Hard + stalling + attempts exhausted → ESCALATE
        if ($isHardProblem && $isStalling && $attemptNumber >= $attemptThreshold) {
            return [
                'attempt' => $attemptNumber,
                'action' => 'ESCALATE',
                'error_delta' => $errorDelta,
                'velocity' => $velocity,
                'difficulty' => $envelope->difficulty,
                'decision' => 'ESCALATE_TO_LARGER_MODEL',
                'reason' => 'Hard problem stalling after ' . $attemptThreshold . ' attempts - need bigger model',
                'escalation_hint' => $escalationHint ? $escalationHint->toArray() : null,
                'temperature' => $temperature + 0.3,  // Significant boost for exploration
                'envelope' => $envelope->toArray(),
            ];
        }
        
        // Condition 3: Extreme case detected early → ESCALATE NOW
        if ($isExtremeCase && $attemptNumber >= 4) {
            return [
                'attempt' => $attemptNumber,
                'action' => 'ESCALATE',
                'error_delta' => $errorDelta,
                'velocity' => $velocity,
                'difficulty' => $envelope->difficulty,
                'decision' => 'IMMEDIATE_ESCALATION_EXTREME_CASE',
                'reason' => 'Extreme difficulty detected - immediate model escalation',
                'escalation_hint' => $escalationHint ? $escalationHint->toArray() : null,
                'temperature' => 1.2,  // Max exploration
                'envelope' => $envelope->toArray(),
            ];
        }
        
        // Condition 4: Hit attempt limit
        if ($attemptNumber >= $maxAttempts) {
            return [
                'attempt' => $attemptNumber,
                'action' => 'ESCALATE',
                'error_delta' => $errorDelta,
                'velocity' => $velocity,
                'difficulty' => $envelope->difficulty,
                'decision' => 'ATTEMPT_LIMIT_REACHED',
                'reason' => 'Reached maximum of ' . $maxAttempts . ' attempts',
                'temperature' => $temperature,
                'envelope' => $envelope->toArray(),
            ];
        }
        
        // Condition 5: Circuit breaker says stop
        [$canAttempt, $cbReason] = $this->breaker->can_attempt(match($attemptNumber % 2) {
            0 => ErrorType::SYNTAX(),
            default => ErrorType::LOGIC(),
        });
        
        if (!$canAttempt) {
            return [
                'attempt' => $attemptNumber,
                'action' => 'STOP',
                'error_delta' => $errorDelta,
                'velocity' => $velocity,
                'difficulty' => $envelope->difficulty,
                'decision' => 'CIRCUIT_BREAKER_OPEN',
                'reason' => $cbReason,
                'envelope' => $envelope->toArray(),
            ];
        }
        
        // ========================================
        // STEP 7: Continue healing (default)
        // ========================================
        // Problem not solved, not stalling, within limits → try again
        
        $this->envelopeStorage->addEnvelope($envelope);
        
        return [
            'attempt' => $attemptNumber,
            'action' => 'CONTINUE',
            'error_delta' => $errorDelta,
            'velocity' => $velocity,
            'difficulty' => $envelope->difficulty,
            'decision' => 'TRY_AGAIN',
            'reason' => match(true) {
                $errorDelta > 0 => 'Making progress - continue',
                default => 'Plateau detected - prepare escalation',
            },
            'temperature' => $temperature,
            'envelope' => $envelope->toArray(),
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
        $envelope = $this->enveloper->wrap_patch($patch);
        if ($metadata) { $envelope->metadata = array_merge($envelope->metadata, $metadata); }

        // Populate schema-required fields
        $conf = $this->scorer->calculate_confidence($logits, $error_type, $historical ?? []);
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
        $result = $validator->schemaValidation($envelopeJson, $schema);
        if (!$result->isValid()) {
            throw new RuntimeException("PatchEnvelope validation failed: " . json_encode($result->getErrors()));
        }

        // Human heuristics → initial strategy
        $plan = $this->human->debug_like_human($message, ['error'=>$message,'code_snippet'=>$patch_code]);
        $this->debugger->set_strategy($this->map_strategy($plan['recommended_strategy'] ?? 'LogAndFixStrategy'));

        // Confidence
        $conf = $this->scorer->calculate_confidence($logits, $error_type, $historical ?? []);
        $floor = ($error_type === ErrorType::SYNTAX()) ? $this->policy->syntax_conf_floor : $this->policy->logic_conf_floor;

        // Gates
        [$canAttempt,$cbReason] = $this->breaker->can_attempt($error_type);
        [$stop,$cascadeReason]  = $this->cascade->should_stop_attempting();

        if ($this->is_risky($patch) && $this->policy->require_human_on_risky) {
            $this->record_attempt($envelope, false, "Risk gate → human review");
            $envelope->flagged_for_developer = true;
            $envelope->developer_message = "Risky patch (policy). Human approval required.";
            return $this->finalize($envelope, 'HUMAN_REVIEW', compact('cbReason','cascadeReason','floor'));
        }

        $typeConf = ($error_type === ErrorType::SYNTAX()) ? $conf->syntax_confidence : $conf->logic_confidence;
        if (!$canAttempt || $stop || $typeConf < $floor) {
            $this->record_attempt($envelope, false, "Gate blocked");
            return $this->finalize($envelope, 'STOP', compact('cbReason','cascadeReason','floor'));
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
        return $this->finalize($envelope, $action, ['sandbox'=>$sbox,'strategy'=>$strat,'floor'=>$floor]);
    }

    private function map_strategy(string $name): DebuggingStrategy {
        return match($name) {
            'RollbackStrategy' => new RollbackStrategy(),
            'SecurityAuditStrategy' => new SecurityAuditStrategy(),
            default => new LogAndFixStrategy(),
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
        return ['action'=>$action,'envelope'=>json_decode($env->to_json(), true),'extras'=>$extras];
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
    public function getEscalationObserver(): EscalationObserver {
        return $this->observer;
    }
    
    /**
     * Get the circuit breaker instance
     */
    public function getCircuitBreaker(): DualCircuitBreaker {
        return $this->breaker;
    }
}
