<?php
/**
 * Focused tests for gearbox and delta trend metadata in attemptWithBackoff.
 */

declare(strict_types=1);

require_once __DIR__ . '/../ai-debugging.php';

echo "\n=== Gearbox + Delta Trend Tests ===\n";

$base = getenv('API_BASE_URL') ?: 'http://127.0.0.1:8010';
$payload = [
    'tool' => 'debug.run',
    'arguments' => [
        'patch_code' => '<?php echo "oops" ?>',
        'original_code' => '<?php echo "oops" ?>',
        'error_type' => 'SYNTAX',
        'message' => 'Parse error: syntax error, unexpected end of file',
        'error_count' => 3,
        'logits' => [0.1, 0.2, 0.3],
        'maxAttempts' => 6,
        'minMs' => 10,
        'maxMs' => 20,
        'gearboxModels' => ['local-7b', 'qwen-32b'],
        'maxCycles' => 2,
    ]
];

$ch = curl_init($base . '/mcp/tool');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_CONNECTTIMEOUT => 3,
    CURLOPT_TIMEOUT => 12,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
    CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_SLASHES),
]);
$body = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE) ?: 0;
curl_close($ch);

if ($status < 200 || $status >= 300) {
    echo "❌ MCP call failed: HTTP {$status}\n";
    echo $body . "\n";
    exit(1);
}

$json = json_decode((string)$body, true);
$data = $json['data'] ?? $json;
$result = $data['result'] ?? [];

$extras = $result['extras'] ?? [];
$gearbox = $extras['gearbox'] ?? null;
$delta = $result['envelope']['metadata']['delta_from_prev'] ?? null;

if ($gearbox) {
    echo "✅ Gearbox recommendation present\n";
} else {
    echo "❌ Gearbox recommendation missing\n";
}

if ($delta) {
    echo "✅ Delta-from-prev present\n";
} else {
    echo "❌ Delta-from-prev missing\n";
}

echo "=== Done ===\n";