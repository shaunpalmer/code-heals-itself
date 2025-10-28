<?php
/**
 * PHP Envelope Storage Layer - Hot Memory + Cold SQLite
 * 
 * Mirrors Python envelope_storage.py with native PHP PDO SQLite
 * 
 * Two-tier architecture:
 * - Hot Memory: InMemoryEnvelopeQueue (20 items, O(1) access)
 * - Cold Storage: SQLite (persistent, searchable)
 * 
 * Used by: HealingPipeline for remembering attempts and learning patterns
 */

declare(strict_types=1);

namespace CodeHealsItself\PhpAgent;

use PDO;
use Exception;

/**
 * Circular buffer for recent envelopes in machine RAM
 * 1000x faster than SQLite for recent access
 */
class InMemoryEnvelopeQueue {
    private array $queue = [];
    private int $max_size;

    public function __construct(int $max_size = 20) {
        $this->max_size = $max_size;
    }

    /**
     * Add envelope to memory (auto-evicts oldest if full)
     * 
     * @param array $envelope HealingEnvelope as array
     * @param string $action PROMOTE|REJECT|RETRY|PENDING
     */
    public function push(array $envelope, string $action): void {
        $entry = [
            'envelope' => $envelope,
            'action' => $action,
            'status' => $this->mapActionToStatus($action),
            'timestamp' => date('c'),
            'added_at' => microtime(true)
        ];

        $this->queue[] = $entry;

        // Evict oldest if over max size
        if (count($this->queue) > $this->max_size) {
            array_shift($this->queue);
        }
    }

    /**
     * Get recent envelopes (newest first)
     * 
     * @param int $limit Number of items to return
     * @return array List of envelope entries
     */
    public function getRecent(int $limit = 20): array {
        $recent = array_reverse($this->queue);
        return array_slice($recent, 0, $limit);
    }

    /**
     * Get metrics from in-memory envelopes (fast)
     * 
     * @return array|null Metrics dict or null if empty
     */
    public function getMetrics(): ?array {
        if (empty($this->queue)) {
            return null;
        }

        $total = count($this->queue);
        $promoted = count(array_filter($this->queue, fn($e) => $e['status'] === 'PROMOTED'));
        $pending = count(array_filter($this->queue, fn($e) => $e['status'] === 'RETRY'));

        $healing_success = $total > 0 ? intval(($promoted / $total) * 100) : 0;

        // Get latest breaker status
        $latest = end($this->queue);
        $breaker_status = $latest['envelope']['breaker_state'] ?? 'steady';

        return [
            'healing_success' => $healing_success,
            'breaker_status' => strtolower($breaker_status),
            'pending_reviews' => $pending,
            'total_attempts' => $total,
            'source' => 'memory'
        ];
    }

    /**
     * Generate LLM-friendly context from recent attempts
     * 
     * Gives LLM "memory" of what just happened - helps it learn and adapt
     * 
     * @param int $limit Number of recent attempts to include
     * @return string Context string for LLM
     */
    public function getLLMContext(int $limit = 10): string {
        if (empty($this->queue)) {
            return "No recent healing attempts in memory.";
        }

        $recent = array_reverse($this->queue);
        $lines = ["=== RECENT HEALING CONTEXT (Your Recent Memory) ===\n"];

        // Summary statistics
        $total = count($recent);
        $promoted = count(array_filter($recent, fn($e) => $e['status'] === 'PROMOTED'));
        $rejected = count(array_filter($recent, fn($e) => $e['status'] === 'REJECTED'));
        $retry = count(array_filter($recent, fn($e) => $e['status'] === 'RETRY'));

        $success_rate = $total > 0 ? intval(($promoted / $total) * 100) : 0;

        $lines[] = "Success Rate: {$success_rate}% ({$promoted}/{$total} promoted)";
        $lines[] = "Status Breakdown: {$promoted} PROMOTED, {$rejected} REJECTED, {$retry} RETRY\n";

        // Individual attempt summaries
        $lines[] = "Recent Attempts (newest first):";
        foreach (array_slice($recent, 0, $limit) as $i => $entry) {
            $envelope = $entry['envelope'];
            $status = $entry['status'];

            $patch_id = $envelope['patch_id'] ?? 'unknown';
            $confidence = $envelope['confidence'] ?? 0;
            $breaker = $envelope['breaker_state'] ?? 'unknown';
            $message = substr($envelope['message'] ?? '', 0, 80);

            $lines[] = "\n" . ($i + 1) . ". [{$status}] {$patch_id}";
            $lines[] = "   Confidence: " . number_format($confidence, 2) . " | Breaker: {$breaker}";
            if ($message) {
                $lines[] = "   Error: {$message}";
            }
        }

        $lines[] = "\n=== END CONTEXT ===";

        return implode("\n", $lines);
    }

    /**
     * Get current size of queue
     */
    public function size(): int {
        return count($this->queue);
    }

    /**
     * Clear all in-memory envelopes
     */
    public function clear(): void {
        $this->queue = [];
    }

    /**
     * Map action string to status
     */
    private function mapActionToStatus(string $action): string {
        return match ($action) {
            'PROMOTE' => 'PROMOTED',
            'REJECT' => 'REJECTED',
            'RETRY' => 'RETRY',
            default => 'PENDING'
        };
    }
}

/**
 * Dual-layer storage: In-memory queue (fast) + SQLite (persistent)
 * 
 * Strategy:
 * - Write to memory first (instant)
 * - Also write to SQLite (background/persistent)
 * - Read from memory if available (recent items)
 * - Fall back to SQLite for history
 */
class EnvelopeStorage {
    private InMemoryEnvelopeQueue $memory;
    private string $db_path;
    private PDO $pdo;

    /**
     * @param string $db_path Path to SQLite database (default: /data/envelopes.db)
     * @param int $memory_size Maximum items to keep in RAM (default: 20)
     */
    public function __construct(string $db_path = '/data/envelopes.db', int $memory_size = 20) {
        $this->db_path = $db_path;
        $this->memory = new InMemoryEnvelopeQueue($memory_size);

        // Ensure directory exists
        $dir = dirname($db_path);
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }

        // Connect to SQLite
        try {
            $this->pdo = new PDO('sqlite:' . $db_path);
            $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            // Enable foreign keys
            $this->pdo->exec('PRAGMA foreign_keys = ON');
        } catch (Exception $e) {
            throw new Exception("Failed to connect to SQLite database at {$db_path}: " . $e->getMessage());
        }

        $this->initDatabase();
    }

    /**
     * Create tables if they don't exist
     */
    private function initDatabase(): void {
        try {
            // Table 1: Healing envelopes (attempt history)
            $this->pdo->exec(<<<'SQL'
                CREATE TABLE IF NOT EXISTS envelopes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    patch_id TEXT UNIQUE NOT NULL,
                    status TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    confidence REAL,
                    breaker_state TEXT,
                    cascade_depth INTEGER DEFAULT 0,
                    error_delta REAL DEFAULT 0.0,
                    velocity REAL DEFAULT 0.0,
                    envelope_json TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE INDEX IF NOT EXISTS idx_envelopes_timestamp 
                ON envelopes(timestamp DESC);
                
                CREATE INDEX IF NOT EXISTS idx_envelopes_status 
                ON envelopes(status);
                
                CREATE INDEX IF NOT EXISTS idx_envelopes_patch_id 
                ON envelopes(patch_id);
            SQL);

            // Table 2: Success patterns (knowledge base)
            $this->pdo->exec(<<<'SQL'
                CREATE TABLE IF NOT EXISTS success_patterns (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    error_code TEXT NOT NULL,
                    cluster_id TEXT,
                    fix_description TEXT,
                    fix_diff TEXT,
                    success_count INTEGER DEFAULT 1,
                    avg_confidence REAL,
                    tags TEXT,
                    last_success_at TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(error_code, cluster_id, fix_description)
                );
                
                CREATE INDEX IF NOT EXISTS idx_patterns_error_code 
                ON success_patterns(error_code);
                
                CREATE INDEX IF NOT EXISTS idx_patterns_cluster_id 
                ON success_patterns(cluster_id);
                
                CREATE INDEX IF NOT EXISTS idx_patterns_tags 
                ON success_patterns(tags);
            SQL);
        } catch (Exception $e) {
            throw new Exception("Failed to initialize database: " . $e->getMessage());
        }
    }

    /**
     * Add envelope to both memory and disk
     * 
     * @param HealingEnvelope $envelope
     * @param string $action PROMOTE|REJECT|RETRY|PENDING
     */
    public function addEnvelope(HealingEnvelope $envelope, string $action = 'PENDING'): void {
        // Write to memory
        $envelope_array = $envelope->toArray();
        $this->memory->push($envelope_array, $action);

        // Write to SQLite
        $status = $this->mapActionToStatus($action);

        try {
            $stmt = $this->pdo->prepare(<<<'SQL'
                INSERT INTO envelopes 
                (patch_id, status, timestamp, confidence, breaker_state, cascade_depth, error_delta, velocity, envelope_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            SQL);

            $stmt->execute([
                $envelope->id,
                $status,
                $envelope->timestamp ?? date('c'),
                $envelope->confidence ?? 0.5,
                $envelope->breakerState ?? 'CLOSED',
                $envelope->cascadeDepth ?? 0,
                $envelope->errorDelta ?? 0.0,
                $envelope->velocity ?? 0.0,
                $envelope->toJson()
            ]);
        } catch (Exception $e) {
            error_log("Failed to add envelope to storage: " . $e->getMessage());
        }
    }

    /**
     * Get recent envelopes from memory (fast)
     * 
     * @param int $limit Number of items to return
     * @return array List of envelope entries
     */
    public function getRecentEnvelopes(int $limit = 20): array {
        return $this->memory->getRecent($limit);
    }

    /**
     * Get LLM context from recent attempts
     * 
     * @param int $limit Number of recent attempts to include
     * @return string Context string for LLM
     */
    public function getLLMContext(int $limit = 10): string {
        return $this->memory->getLLMContext($limit);
    }

    /**
     * Get success patterns for given error code
     * 
     * @param string $error_code e.g., "SYNTAX_ERROR", "NAME_ERROR"
     * @return array List of success patterns
     */
    public function getSuccessPatterns(string $error_code): array {
        try {
            $stmt = $this->pdo->prepare(
                'SELECT * FROM success_patterns WHERE error_code = ? ORDER BY success_count DESC, last_success_at DESC LIMIT 10'
            );
            $stmt->execute([$error_code]);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            error_log("Failed to get success patterns: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Get gold standard patterns (95%+ success)
     * 
     * @param string $error_code
     * @return array|null Best pattern or null
     */
    public function getGoldStandardPattern(string $error_code): ?array {
        try {
            $stmt = $this->pdo->prepare(
                'SELECT * FROM success_patterns WHERE error_code = ? AND tags LIKE ? ORDER BY success_count DESC LIMIT 1'
            );
            $stmt->execute([$error_code, '%GOLD_STANDARD%']);
            return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
        } catch (Exception $e) {
            error_log("Failed to get gold standard: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Record successful fix pattern
     * 
     * @param string $error_code
     * @param string $cluster_id
     * @param string $fix_description
     * @param string $fix_diff
     * @param float $confidence
     */
    public function recordSuccessPattern(
        string $error_code,
        string $cluster_id,
        string $fix_description,
        string $fix_diff,
        float $confidence
    ): void {
        try {
            // Check if pattern exists
            $existing = $this->pdo->prepare(
                'SELECT id, success_count, avg_confidence FROM success_patterns WHERE error_code = ? AND cluster_id = ? AND fix_description = ?'
            );
            $existing->execute([$error_code, $cluster_id, $fix_description]);
            $row = $existing->fetch(PDO::FETCH_ASSOC);

            if ($row) {
                // Update existing pattern
                $new_count = $row['success_count'] + 1;
                $new_avg = (($row['avg_confidence'] * $row['success_count']) + $confidence) / $new_count;

                $stmt = $this->pdo->prepare(
                    'UPDATE success_patterns SET success_count = ?, avg_confidence = ?, last_success_at = ? WHERE id = ?'
                );
                $stmt->execute([$new_count, $new_avg, date('c'), $row['id']]);

                // Mark as GOLD_STANDARD if success_count > 10
                if ($new_count > 10) {
                    $tag_stmt = $this->pdo->prepare(
                        'UPDATE success_patterns SET tags = COALESCE(tags, "") || ",GOLD_STANDARD" WHERE id = ? AND tags NOT LIKE ?'
                    );
                    $tag_stmt->execute([$row['id'], '%GOLD_STANDARD%']);
                }
            } else {
                // Insert new pattern
                $stmt = $this->pdo->prepare(
                    'INSERT INTO success_patterns (error_code, cluster_id, fix_description, fix_diff, avg_confidence, last_success_at) VALUES (?, ?, ?, ?, ?, ?)'
                );
                $stmt->execute([$error_code, $cluster_id, $fix_description, $fix_diff, $confidence, date('c')]);
            }
        } catch (Exception $e) {
            error_log("Failed to record success pattern: " . $e->getMessage());
        }
    }

    /**
     * Get best attempt from recent history
     * Used for rollback decision
     * 
     * @param int $limit How many recent to check
     * @return ?array Envelope with lowest error count, or null
     */
    public function getBestRecentAttempt(int $limit = 5): ?array {
        $recent = $this->memory->getRecent($limit);

        if (empty($recent)) {
            return null;
        }

        $best = null;
        $best_error_count = PHP_INT_MAX;

        foreach ($recent as $entry) {
            $env = $entry['envelope'];
            $error_count = $env['error_count'] ?? PHP_INT_MAX;

            if ($error_count < $best_error_count) {
                $best_error_count = $error_count;
                $best = $env;
            }
        }

        return $best;
    }

    /**
     * Get memory metrics
     * 
     * @return array|null Metrics dict or null
     */
    public function getMetrics(): ?array {
        return $this->memory->getMetrics();
    }

    /**
     * Get total envelope count from database
     * 
     * @return int
     */
    public function getTotalCount(): int {
        try {
            $stmt = $this->pdo->query('SELECT COUNT(*) as cnt FROM envelopes');
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            return (int)($row['cnt'] ?? 0);
        } catch (Exception $e) {
            return 0;
        }
    }

    /**
     * Map action to status string
     */
    private function mapActionToStatus(string $action): string {
        return match ($action) {
            'PROMOTE' => 'PROMOTED',
            'REJECT' => 'REJECTED',
            'RETRY' => 'RETRY',
            default => 'PENDING'
        };
    }

    /**
     * Close database connection
     */
    public function close(): void {
        $this->pdo = null;
    }
}

?>
