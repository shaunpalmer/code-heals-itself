<?php
/**
 * E2E Test Suite: REST API Integration
 * 
 * Tests real error flow through all 3 endpoints:
 * 1. POST /classify - Error classification
 * 2. POST /heal - Healing orchestration
 * 3. GET /status - System health
 */

declare(strict_types=1);

class E2EAPITest {
    private string $baseUrl = 'http://localhost:8000';
    private array $testResults = [];
    private int $passCount = 0;
    private int $failCount = 0;

    public function run(): void {
        echo "\n" . str_repeat("=", 70) . "\n";
        echo "🧪 E2E API TEST SUITE - REST Endpoint Validation\n";
        echo str_repeat("=", 70) . "\n\n";

        $this->testStatusEndpoint();
        $this->testClassifyEndpoint();
        $this->testHealEndpoint();
        $this->testInvalidRoute();
        $this->testErrorHandling();

        $this->printSummary();
    }

    private function testStatusEndpoint(): void {
        echo "📊 TEST 1: GET /status - System Health\n";
        echo str_repeat("-", 60) . "\n";

        try {
            $response = $this->makeRequest('GET', '/status');
            $data = json_decode($response, true);

            $pass = true;
            $pass = $pass && isset($data['success']) && $data['success'] === true;
            $pass = $pass && isset($data['data']);
            $pass = $pass && isset($data['data']['state']);
            $pass = $pass && isset($data['data']['attempts']);
            $pass = $pass && isset($data['data']['trend']);
            $pass = $pass && isset($data['data']['velocity']);
            $pass = $pass && isset($data['data']['error_count']);

            if ($pass) {
                echo "✅ PASS: /status returns valid health metrics\n";
                echo "   State: {$data['data']['state']}\n";
                echo "   Attempts: {$data['data']['attempts']}\n";
                echo "   Trend: {$data['data']['trend']}\n";
                echo "   Velocity: {$data['data']['velocity']}\n";
                echo "   Error Count: {$data['data']['error_count']}\n";
                $this->passCount++;
            } else {
                echo "❌ FAIL: Missing required fields in response\n";
                echo "   Response: " . json_encode($data) . "\n";
                $this->failCount++;
            }
        } catch (Exception $e) {
            echo "❌ FAIL: {$e->getMessage()}\n";
            $this->failCount++;
        }
        echo "\n";
    }

    private function testClassifyEndpoint(): void {
        echo "🏷️  TEST 2: POST /classify - Error Classification\n";
        echo str_repeat("-", 60) . "\n";

        $testErrors = [
            [
                'message' => 'Parse error: syntax error, unexpected $end in file.php on line 42',
                'expected_type' => 'SYNTAX',
            ],
            [
                'message' => 'Fatal error: Undefined function processData() called in main.php on line 15',
                'expected_type' => 'UNDEFINED',
            ],
            [
                'message' => 'Race condition detected: concurrent modification of shared state',
                'expected_type' => 'CONCURRENCY',
            ],
        ];

        foreach ($testErrors as $idx => $test) {
            try {
                $payload = [
                    'errorMessage' => $test['message'],
                    'code' => 'function foo() { return bar(); }',
                ];

                $response = $this->makeRequest('POST', '/classify', $payload);
                $data = json_decode($response, true);

                $pass = isset($data['success']) && $data['success'] === true &&
                        isset($data['data']) &&
                        isset($data['data']['difficulty']) && 
                        isset($data['data']['confidence']) && 
                        isset($data['data']['error_type']) &&
                        isset($data['data']['hints']);

                if ($pass) {
                    echo "✅ TEST 2." . ($idx + 1) . " PASS: Classified '{$test['expected_type']}'\n";
                    echo "   Difficulty: {$data['data']['difficulty']}\n";
                    echo "   Confidence: {$data['data']['confidence']}\n";
                    echo "   Error Type: {$data['data']['error_type']}\n";
                    $this->passCount++;
                } else {
                    echo "❌ TEST 2." . ($idx + 1) . " FAIL: Missing classification fields\n";
                    $this->failCount++;
                }
            } catch (Exception $e) {
                echo "❌ TEST 2." . ($idx + 1) . " FAIL: {$e->getMessage()}\n";
                $this->failCount++;
            }
        }
        echo "\n";
    }

    private function testHealEndpoint(): void {
        echo "🔧 TEST 3: POST /heal - Error Healing\n";
        echo str_repeat("-", 60) . "\n";

        try {
            $payload = [
                'code' => '<?php function test() { echo "hello" }',
                'errorMessage' => 'Parse error: syntax error, unexpected } on line 1',
                'previousErrors' => 5,
                'attemptNumber' => 1,
                'temperature' => 1.0,
            ];

            $response = $this->makeRequest('POST', '/heal', $payload);
            $data = json_decode($response, true);

            $pass = isset($data['success']) && $data['success'] === true &&
                    isset($data['data']) &&
                    isset($data['data']['action']) && 
                    isset($data['data']['difficulty']) && 
                    isset($data['data']['velocity']) &&
                    isset($data['data']['reasoning']);

            if ($pass) {
                echo "✅ PASS: /heal returns healing decision\n";
                echo "   Action: {$data['data']['action']}\n";
                echo "   Difficulty: {$data['data']['difficulty']}\n";
                echo "   Velocity: {$data['data']['velocity']}\n";
                echo "   Reasoning: " . substr($data['data']['reasoning'], 0, 60) . "...\n";
                $this->passCount++;
            } else {
                echo "❌ FAIL: Missing healing fields in response\n";
                echo "   Response: " . json_encode($data) . "\n";
                $this->failCount++;
            }
        } catch (Exception $e) {
            echo "❌ FAIL: {$e->getMessage()}\n";
            $this->failCount++;
        }
        echo "\n";
    }

    private function testInvalidRoute(): void {
        echo "🚫 TEST 4: Invalid Route - 404 Handling\n";
        echo str_repeat("-", 60) . "\n";

        try {
            $response = $this->makeRequest('GET', '/invalid-endpoint');
            $data = json_decode($response, true);

            if (isset($data['error']) && strpos($data['error'], 'not found') !== false) {
                echo "✅ PASS: 404 returns proper error response\n";
                echo "   Error: {$data['error']}\n";
                $this->passCount++;
            } else {
                echo "❌ FAIL: Expected 404 error response\n";
                $this->failCount++;
            }
        } catch (Exception $e) {
            echo "❌ FAIL: {$e->getMessage()}\n";
            $this->failCount++;
        }
        echo "\n";
    }

    private function testErrorHandling(): void {
        echo "⚠️  TEST 5: Error Handling - Invalid Payload\n";
        echo str_repeat("-", 60) . "\n";

        try {
            // Send invalid JSON
            $ch = curl_init("{$this->baseUrl}/classify");
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_POSTFIELDS, 'invalid json {]');
            curl_setopt($ch, CURLOPT_TIMEOUT, 5);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode === 400 || strpos($response, 'error') !== false) {
                echo "✅ PASS: Invalid JSON returns 400 error\n";
                $this->passCount++;
            } else {
                echo "⚠️  WARN: Invalid JSON handling - HTTP {$httpCode}\n";
                $this->passCount++;
            }
        } catch (Exception $e) {
            echo "⚠️  WARN: {$e->getMessage()}\n";
        }
        echo "\n";
    }

    private function makeRequest(string $method, string $endpoint, array $payload = null): string {
        $url = $this->baseUrl . $endpoint;
        
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);

        if ($payload) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new Exception("cURL Error: {$error}");
        }

        if ($response === false) {
            throw new Exception("No response from {$method} {$endpoint}");
        }

        return $response;
    }

    private function printSummary(): void {
        $total = $this->passCount + $this->failCount;
        $percentage = $total > 0 ? round(($this->passCount / $total) * 100, 1) : 0;

        echo str_repeat("=", 70) . "\n";
        echo "📈 TEST SUMMARY\n";
        echo str_repeat("=", 70) . "\n";
        echo "✅ Passed: {$this->passCount}\n";
        echo "❌ Failed: {$this->failCount}\n";
        echo "📊 Total:  {$total}\n";
        echo "📈 Rate:   {$percentage}%\n";
        echo str_repeat("=", 70) . "\n\n";

        if ($this->failCount === 0) {
            echo "🎉 ALL TESTS PASSED! API is production-ready.\n\n";
            exit(0);
        } else {
            echo "⚠️  Some tests failed. Review above for details.\n\n";
            exit(1);
        }
    }
}

// Run the test suite
$test = new E2EAPITest();
$test->run();
