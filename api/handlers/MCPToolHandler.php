<?php
/**
 * MCPToolHandler - POST /mcp/tool
 * Minimal MCP-style shim so LLMs can call a tool (debug.run) that forwards to the PHP healer
 *
 * Expected payload:
 * {
 *   "tool": "debug.run",
 *   "arguments": {
 *     "code": "<?php echo 'Hi'; ?>",
 *     "error_count": 0,
 *     "attemptNumber": 1,
 *     "errorMessage": "",
 *     "temperature": 1.0
 *   }
 * }
 */

declare(strict_types=1);

namespace CodeHealsItself\Api\Handlers;

use CodeHealsItself\PhpAgent\AIDebugger;

class MCPToolHandler {
    /**
     * Best-effort fetch of LM Studio models list (OpenAI-compatible).
     * @return string[]
     */
    private function getLmStudioModels(): array {
        $base = getenv('LM_STUDIO_BASE') ?: 'http://localhost:1234';
        $url = rtrim($base, '/') . '/v1/models';
        $ctx = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => 2,
                'header' => "Accept: application/json\r\n",
            ]
        ]);
        try {
            $raw = @file_get_contents($url, false, $ctx);
            if (!$raw) return [];
            $json = json_decode($raw, true);
            $data = $json['data'] ?? [];
            $ids = [];
            foreach ($data as $row) {
                if (!empty($row['id'])) $ids[] = (string)$row['id'];
            }
            return $ids;
        } catch (\Throwable $t) {
            return [];
        }
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public function handle(array $payload): array {
        try {
            $tool = (string)($payload['tool'] ?? '');
            if ($tool !== 'debug.run') {
                return [
                    'success' => false,
                    'error' => 'Unsupported tool',
                    'supported' => ['debug.run']
                ];
            }

            $args = (array)($payload['arguments'] ?? []);
            // Accept PHP-style or TS-style payloads
            $code           = (string)($args['code'] ?? $args['patch_code'] ?? '');
            $hasPatchCode   = array_key_exists('patch_code', $args);
            $hasOriginal    = array_key_exists('original_code', $args);
            $hasLogits      = array_key_exists('logits', $args);
            $hasErrorType   = array_key_exists('error_type', $args);
            $patchCode      = (string)($args['patch_code'] ?? $code);
            $originalCode   = (string)($args['original_code'] ?? $code);
            $errorCount     = (int)($args['error_count'] ?? $args['previousErrors'] ?? 0);
            $attemptNumber  = (int)($args['attemptNumber'] ?? $args['attempt'] ?? 1);
            $errorMessage   = (string)($args['errorMessage'] ?? $args['message'] ?? '');
            $temperature    = isset($args['temperature']) ? (float)$args['temperature'] : 1.0;
            $logits         = is_array($args['logits'] ?? null) ? $args['logits'] : [];
            $errorType      = strtolower((string)($args['error_type'] ?? ''));
            $maxAttempts    = (int)($args['maxAttempts'] ?? 1);
            $minDelayMs     = (int)($args['minMs'] ?? 500);
            $maxDelayMs     = (int)($args['maxMs'] ?? 1500);
            $maxCycles      = (int)($args['maxCycles'] ?? 2);
            $gearboxModels  = is_array($args['gearboxModels'] ?? null) ? $args['gearboxModels'] : [];

            if ($code === '' && $patchCode === '') {
                return [
                    'success' => false,
                    'error' => 'Missing arguments.code'
                ];
            }

            $debugger = new AIDebugger();
            // Prefer full debug.run shape if provided (TS/Python style)
            if ($hasPatchCode || $hasOriginal || $hasLogits || $hasErrorType) {
                $metadata = ['attempt' => $attemptNumber];
                try {
                    $recent = $debugger->getEnvelopeStorage()->getRecentEnvelopes(1);
                    if (!empty($recent[0]['envelope']['metadata']['rebanker_raw'])) {
                        $metadata['rebanker_prev'] = $recent[0]['envelope']['metadata']['rebanker_raw'];
                    }
                } catch (\Throwable $t) {
                    // best-effort only
                }
                $useBackoff = $maxAttempts > 1 || !empty($gearboxModels);
                if ($useBackoff) {
                    if (empty($gearboxModels)) {
                        $gearboxModels = $this->getLmStudioModels();
                    }
                    $healingResult = $debugger->attemptWithBackoff(
                        $patchCode ?: $code,
                        $errorCount,
                        $errorMessage,
                        $maxAttempts,
                        $minDelayMs,
                        $maxDelayMs,
                        $gearboxModels,
                        $maxCycles
                    );
                } else {
                    $healingResult = $debugger->process_error(
                        $errorType ?: 'syntax',
                        $errorMessage,
                        $patchCode ?: $code,
                        $originalCode ?: $code,
                        $logits,
                        ['attempt' => $attemptNumber],
                        $metadata
                    );
                }
            } else {
                // Fallback: positional args for maximum compatibility
                if ($maxAttempts > 1 || !empty($gearboxModels)) {
                    if (empty($gearboxModels)) {
                        $gearboxModels = $this->getLmStudioModels();
                    }
                    $healingResult = $debugger->attemptWithBackoff(
                        $code,
                        (int)$errorCount,
                        $errorMessage,
                        $maxAttempts,
                        $minDelayMs,
                        $maxDelayMs,
                        $gearboxModels,
                        $maxCycles
                    );
                } else {
                    $healingResult = $debugger->attemptHealing(
                        $code,
                        (int)$errorCount,
                        (int)$attemptNumber,
                        $errorMessage,
                        (float)$temperature
                    );
                }
            }

            return [
                'success' => true,
                'tool' => $tool,
                'result' => $healingResult
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'error' => 'Unhandled exception',
                'details' => [
                    'message' => $e->getMessage(),
                    'file' => $e->getFile(),
                    'line' => $e->getLine(),
                ]
            ];
        }
    }
}
