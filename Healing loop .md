Yo Shaun — spot on diagnosis. The observer can “see” stall velocity but not the ReBanker difficulty, so it can’t escalate early. Let’s wire them together cleanly in PHP without blowing up your stack.

# Plan (architecture-first)

We’ll add a tiny decision policy that merges three signals:

1. `difficulty_score` from ReBanker (0–1)
2. `velocity` (Δfails per attempt) + last N deltas
3. `circuit_state` (CLOSED / HALF_OPEN / OPEN)

## Files (drop-in, no Composer)

* `agents/php-agent/src/Domain/Signals/DifficultySource.php` (fetches difficulty once at start)
* `agents/php-agent/src/Domain/Observer/EscalationPolicy.php` (pure rules)
* `agents/php-agent/src/Domain/Observer/HealingObserver.php` (stores rolling metrics, emits decisions)
* `agents/php-agent/src/Domain/Circuit/CircuitBreaker.php` (existing: expose `getState()`)
* `agents/php-agent/public/ai-debugging.php` (main loop: wire calls)
* `agents/php-agent/src/Infra/Http/Http.php` (very small cURL wrapper)

> Naming stays “ays / code-heals” style-friendly; change paths if you’ve already got a structure.

---

# Escalation Rules (PHP parity of your Python logic)

* If `difficulty_score >= 0.75` **AND** `attempt >= 4` **AND** `velocity < 0.2` → escalate to 20B now
* If `circuit_state == OPEN` for ≥2 consecutive attempts → escalate
* If `consecutive_no_progress >= 3` → escalate
* Optional: after one escalation, add +0.1 temp/budget, then reassess

Thresholds as constants so they’re easy to tune.

---

# Code — tiny, focused, productiony

### 1) `Http.php`

```php
<?php
// agents/php-agent/src/Infra/Http/Http.php
declare(strict_types=1);

namespace CodeHeals\Infra\Http;

final class Http {
    public static function get(string $url, array $headers = [], int $timeout = 2): array {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_HTTPHEADER => $headers
        ]);
        $body = curl_exec($ch);
        $err  = curl_error($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        return ['ok' => ($err === '' && $code >= 200 && $code < 300), 'code' => $code, 'body' => $body, 'err' => $err];
    }

    public static function postJson(string $url, array $json, array $headers = [], int $timeout = 10): array {
        $headers[] = 'Content-Type: application/json';
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($json),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_HTTPHEADER => $headers
        ]);
        $body = curl_exec($ch);
        $err  = curl_error($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        return ['ok' => ($err === '' && $code >= 200 && $code < 300), 'code' => $code, 'body' => $body, 'err' => $err];
    }
}
```

### 2) `DifficultySource.php`

```php
<?php
// agents/php-agent/src/Domain/Signals/DifficultySource.php
declare(strict_types=1);

namespace CodeHeals\Domain\Signals;

use CodeHeals\Infra\Http\Http;

final class DifficultySource {
    public function __construct(private readonly string $rebankerUrl) {} // e.g. http://rebanker-mcp:8093

    /** Returns float 0..1 (default 0.5 if unknown) */
    public function fetchForEnvelope(string $envelopeId): float {
        $url = rtrim($this->rebankerUrl, '/').'/classify/'.$envelopeId;
        $res = Http::get($url);
        if (!$res['ok']) return 0.5;
        $data = json_decode($res['body'], true) ?: [];
        return isset($data['difficulty']) ? max(0.0, min(1.0, (float)$data['difficulty'])) : 0.5;
    }
}
```

### 3) `EscalationPolicy.php`

```php
<?php
// agents/php-agent/src/Domain/Observer/EscalationPolicy.php
declare(strict_types=1);

namespace CodeHeals\Domain\Observer;

final class EscalationPolicy {
    public function __construct(
        private readonly float $difficultThreshold = 0.75,
        private readonly int   $minAttemptForHard = 4,
        private readonly float $minVelocity       = 0.20,
        private readonly int   $openCircuitTimes  = 2,
        private readonly int   $noProgressMax     = 3
    ) {}

    /**
     * @param float  $difficulty 0..1
     * @param int    $attempt
     * @param float  $velocity   reductions/attempt (0..1+)
     * @param string $circuit    CLOSED|HALF_OPEN|OPEN
     * @param int    $noProgressConsecutive
     */
    public function shouldEscalate(
        float $difficulty, int $attempt, float $velocity, string $circuit, int $noProgressConsecutive, int $openCircuitStreak
    ): array {
        // Rule 1: early upgrade for hard tasks stalling
        if ($difficulty >= $this->difficultThreshold && $attempt >= $this->minAttemptForHard && $velocity < $this->minVelocity) {
            return ['escalate' => true, 'reason' => 'HARD+STALL', 'tier' => '20B'];
        }
        // Rule 2: circuit open repeatedly
        if ($openCircuitStreak >= $this->openCircuitTimes) {
            return ['escalate' => true, 'reason' => 'CIRCUIT_OPEN', 'tier' => '20B'];
        }
        // Rule 3: no measurable progress N times
        if ($noProgressConsecutive >= $this->noProgressMax) {
            return ['escalate' => true, 'reason' => 'NO_PROGRESS', 'tier' => '20B'];
        }
        return ['escalate' => false, 'reason' => 'NONE', 'tier' => null];
    }
}
```

### 4) `HealingObserver.php`

```php
<?php
// agents/php-agent/src/Domain/Observer/HealingObserver.php
declare(strict_types=1);

namespace CodeHeals\Domain\Observer;

final class HealingObserver {
    private array $deltas = []; // last N fail reductions
    private int   $noProgressConsecutive = 0;
    private int   $openCircuitStreak = 0;

    public function __construct(private readonly EscalationPolicy $policy, private readonly int $window = 5) {}

    /** Call this after each attempt */
    public function recordAttempt(int $attempt, int $prevFails, int $currFails, string $circuit): void {
        $delta = max(0, $prevFails - $currFails); // fixes this attempt
        $this->deltas[] = $delta;
        if (count($this->deltas) > $this->window) array_shift($this->deltas);

        $this->noProgressConsecutive = ($delta === 0) ? ($this->noProgressConsecutive + 1) : 0;
        $this->openCircuitStreak     = ($circuit === 'OPEN') ? ($this->openCircuitStreak + 1) : 0;
    }

    /** velocity = avg delta in window */
    public function velocity(): float {
        if (!$this->deltas) return 0.0;
        return array_sum($this->deltas) / count($this->deltas);
    }

    public function getNoProgressConsecutive(): int { return $this->noProgressConsecutive; }
    public function getOpenCircuitStreak(): int     { return $this->openCircuitStreak; }

    public function decide(float $difficulty, int $attempt, string $circuit): array {
        return $this->policy->shouldEscalate(
            difficulty: $difficulty,
            attempt: $attempt,
            velocity: $this->velocity(),
            circuit: $circuit,
            noProgressConsecutive: $this->noProgressConsecutive,
            openCircuitStreak: $this->openCircuitStreak
        );
    }
}
```

### 5) Integrate in your main loop: `ai-debugging.php`

```php
<?php
// agents/php-agent/public/ai-debugging.php
declare(strict_types=1);

use CodeHeals\Infra\Http\Http;
use CodeHeals\Domain\Signals\DifficultySource;
use CodeHeals\Domain\Observer\EscalationPolicy;
use CodeHeals\Domain\Observer\HealingObserver;
// use CodeHeals\Domain\Circuit\CircuitBreaker; // your existing class

require __DIR__ . '/../src/Infra/Http/Http.php';
require __DIR__ . '/../src/Domain/Signals/DifficultySource.php';
require __DIR__ . '/../src/Domain/Observer/EscalationPolicy.php';
require __DIR__ . '/../src/Domain/Observer/HealingObserver.php';

$rebankerUrl = getenv('REBANKER_URL') ?: 'http://rebanker-mcp:8093';
$llmPrimary  = getenv('PRIMARY_URL')  ?: 'http://lmstudio:8080/v1';
$llmFallback = getenv('FALLBACK_URL') ?: 'http://host.docker.internal:1234/v1';

$envelopeId  = $_GET['envelope'] ?? 'default';
$diff = (new DifficultySource($rebankerUrl))->fetchForEnvelope($envelopeId);

$policy   = new EscalationPolicy();          // thresholds tunable here
$observer = new HealingObserver($policy, 5); // last 5 attempts window
$model    = 'php-7b';                        // start small; your mapping controls the real backend model
$attempts = (int)($_GET['max_attempts'] ?? 8);

$prevFails = get_initial_fail_count();       // ← your existing probe
for ($attempt = 1; $attempt <= $attempts; $attempt++) {
    // run one healing attempt using current $model (talk to LM via PRIMARY/FALLBACK)
    $circuit = get_circuit_state(); // 'CLOSED' | 'HALF_OPEN' | 'OPEN'

    $currFails = run_healing_attempt_and_count_failures($model, $llmPrimary, $llmFallback);
    $observer->recordAttempt($attempt, $prevFails, $currFails, $circuit);

    // DECISION: merge difficulty + velocity + circuit
    $decision = $observer->decide(difficulty: $diff, attempt: $attempt, circuit: $circuit);
    if ($decision['escalate'] === true) {
        log_event('[MODEL_ESCALATION]', [
            'attempt'    => $attempt,
            'reason'     => $decision['reason'],
            'from_model' => $model,
            'to_tier'    => $decision['tier'],
            'difficulty' => $diff,
            'velocity'   => $observer->velocity(),
            'circuit'    => $circuit
        ]);
        $model = escalate_model($model, $decision['tier']); // 7B -> 20B -> 32B
    }

    // done?
    if ($currFails === 0) {
        log_event('[HEAL_SUCCESS]', ['attempt' => $attempt, 'model' => $model]);
        break;
    }
    $prevFails = $currFails;
}

echo json_encode([
    'status' => 'ok',
    'envelope' => $envelopeId,
    'difficulty' => $diff,
    'final_model' => $model,
    'final_fail_count' => $currFails ?? $prevFails,
    'velocity' => $observer->velocity(),
]);
exit;

// ----- helpers (sketches; wire to your real code) -----
function get_initial_fail_count(): int { /* ... */ return 5; }
function get_circuit_state(): string { /* ... */ return 'CLOSED'; }
function run_healing_attempt_and_count_failures(string $model, string $primary, string $fallback): int {
    // Call LM via $primary; if unhealthy/timeouts, use $fallback (same pattern as Python)
    // Return updated fail count after the attempt.
    return max(0, random_int(0, 5) - 1); // stub
}
function escalate_model(string $current, ?string $tier): string {
    // Map tiers to your LM Studio served models or proxy IDs
    if ($tier === '20B') return 'php-20b';
    if ($tier === '32B') return 'php-32b';
    return $current;
}
function log_event(string $type, array $data): void {
    $line = json_encode(['ts'=>date('c'),'type'=>$type] + $data);
    @file_put_contents(__DIR__ . '/../data/events.jsonl', $line . PHP_EOL, FILE_APPEND);
}
```

---

# Where this “lives” and how to run it

* **Where**: the new classes go under `agents/php-agent/src/...` and you require them in `public/ai-debugging.php`.
* **Docker**: ensure php-agent container has `REBANKER_URL`, `PRIMARY_URL`, `FALLBACK_URL` envs; it’s already on `healing-network`.
* **Activate**: hit `http://localhost:8085/ai-debugging.php?envelope=abc&max_attempts=8` and watch escalations appear when hard+stall conditions trigger.
* **MCP**: expose `/status`, `/heal`, `/events` endpoints (or keep this as the `/heal` action) so MCP Toolkit can list capabilities.

---

# Why this approach

* **Minimal patch**: one policy file + one observer; your loop stays your loop.
* **Deterministic**: thresholds are constants; no magic.
* **Paritised**: mirrors your Python logic (difficulty + velocity + breaker).
* **Extensible**: you can later plug the Watcher MCP to flip a global “LM healthy” flag that your PHP agent reads.

Want me to prep a small PR-style patch diff for your repo paths so you can paste & go?
