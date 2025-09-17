<?php
declare(strict_types=1);

require_once __DIR__ . '/confidence_scoring.php';
require_once __DIR__ . '/cascading_error_handler.php';
require_once __DIR__ . '/envelope.php';
require_once __DIR__ . '/strategy.php';
require_once __DIR__ . '/human_debugging.php';

// Schema validation
use Opis\JsonSchema\Validator;
use Opis\JsonSchema\ValidationResult;

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
    }

    /**
     * @param ErrorType $error_type
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
}
