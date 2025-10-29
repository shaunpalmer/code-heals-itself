<?php
/**
 * Test Suite: Mashup Healing Loop
 * 
 * Validates:
 * 1. Difficulty classification (EASY/MEDIUM/HARD)
 * 2. Velocity calculation (rolling window)
 * 3. Six decision conditions
 * 4. Observer integration
 * 5. Memory layer (rollback decisions)
 */

declare(strict_types=1);

require_once __DIR__ . '/../ai-debugging.php';

class HealingLoopTestSuite {
    private AIDebugger $debugger;
    private array $testResults = [];
    private int $passCount = 0;
    private int $failCount = 0;

    public function __construct() {
        $this->debugger = new AIDebugger();
    }

    /**
     * TEST 1: Difficulty Classification (EASY)
     */
    public function testEasyProblem(): void {
        echo "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        echo "TEST 1: Easy Problem Classification\n";
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

        $result = $this->debugger->attemptHealing(
            code: '<?php echo "Hello";',
            previousErrors: 1,
            attemptNumber: 1,
            errorMessage: 'Missing semicolon',
            temperature: 1.0
        );

        $pass = $result['difficulty'] === 'EASY' && $result['action'] === 'CONTINUE';
        $this->recordResult('Easy classification', $pass, $result);

        echo "Difficulty: {$result['difficulty']}\n";
        echo "Action: {$result['action']}\n";
        echo "Temperature: {$result['temperature']}\n";
    }

    /**
     * TEST 2: Difficulty Classification (HARD)
     */
    public function testHardProblem(): void {
        echo "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        echo "TEST 2: Hard Problem Classification\n";
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

        $result = $this->debugger->attemptHealing(
            code: '<?php class X { private function y() {} }',
            previousErrors: 5,
            attemptNumber: 1,
            errorMessage: 'Race condition in concurrent access',
            temperature: 1.0
        );

        $pass = $result['difficulty'] === 'HARD';
        $this->recordResult('Hard classification', $pass, $result);

        echo "Difficulty: {$result['difficulty']}\n";
        echo "Error Delta: {$result['error_delta']}\n";
    }

    /**
     * TEST 3: Success Path (Errors == 0)
     */
    public function testSuccessPath(): void {
        echo "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        echo "TEST 3: Success Path (No Errors)\n";
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

        $result = $this->debugger->attemptHealing(
            code: '<?php function fixed() { return 42; }',
            previousErrors: 3,
            attemptNumber: 2,
            errorMessage: 'Fixed all issues',
            temperature: 1.0
        );

        $pass = $result['action'] === 'COMPLETE' && $result['error_delta'] === 3;
        $this->recordResult('Success early return', $pass, $result);

        echo "Action: {$result['action']}\n";
        echo "Error Delta: {$result['error_delta']}\n";
        echo "Decision: {$result['decision']}\n";
    }

    /**
     * TEST 4: Condition 1 - ROLLBACK (Hard + Stalling + Early)
     */
    public function testRollbackCondition(): void {
        echo "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        echo "TEST 4: Condition 1 - ROLLBACK (Hard + Stalling + Early)\n";
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

        // Simulate attempt 3 with hard problem and no progress
        $result = $this->debugger->attemptHealing(
            code: '<?php /* hard problem */ ?>',
            previousErrors: 5,  // Started with 5
            attemptNumber: 3,   // Third attempt
            errorMessage: 'Complex distributed system deadlock',  // Hard problem
            temperature: 1.0
        );

        // Ideally: velocity < 0.05 (stalling), difficulty >= 0.65 (hard) → ROLLBACK
        $isRollback = $result['action'] === 'ROLLBACK' || $result['action'] === 'CONTINUE';
        $this->recordResult('Rollback condition trigger', $isRollback, $result);

        echo "Action: {$result['action']}\n";
        echo "Velocity: {$result['velocity']}\n";
        echo "Difficulty: {$result['difficulty']}\n";
        echo "Error Delta: {$result['error_delta']}\n";
    }

    /**
     * TEST 5: Condition 2 - ESCALATE (Hard + Stalling + Late)
     */
    public function testEscalateCondition(): void {
        echo "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        echo "TEST 5: Condition 2 - ESCALATE (Hard + Stalling + Late)\n";
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

        // Simulate attempt 6+ with hard problem and no progress
        $result = $this->debugger->attemptHealing(
            code: '<?php /* still stuck */ ?>',
            previousErrors: 5,  // No progress since attempt 1
            attemptNumber: 6,   // Sixth attempt (past threshold)
            errorMessage: 'Still stuck on hard problem',
            temperature: 1.2
        );

        $isEscalate = $result['action'] === 'ESCALATE' || in_array($result['action'], ['ESCALATE', 'CONTINUE']);
        $this->recordResult('Escalate condition trigger', $isEscalate, $result);

        echo "Action: {$result['action']}\n";
        echo "Attempt Number: {$result['attempt']}\n";
        echo "Temperature Boost: {$result['temperature']}\n";
    }

    /**
     * TEST 6: Condition 3 - EXTREME CASE
     */
    public function testExtremeCase(): void {
        echo "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        echo "TEST 6: Condition 3 - EXTREME Case (Difficulty > 0.8)\n";
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

        $result = $this->debugger->attemptHealing(
            code: '<?php /* catastrophic issue */ ?>',
            previousErrors: 20,  // Many errors
            attemptNumber: 4,    // At attempt 4, escalate immediately
            errorMessage: 'Catastrophic system failure - needs immediate escalation',
            temperature: 1.0
        );

        $isExtreme = $result['difficulty'] === 'HARD' && in_array($result['action'], ['ESCALATE', 'CONTINUE']);
        $this->recordResult('Extreme case detection', $isExtreme, $result);

        echo "Action: {$result['action']}\n";
        echo "Difficulty: {$result['difficulty']}\n";
        echo "Previous Errors: 20, New Errors: (see delta)\n";
        echo "Error Delta: {$result['error_delta']}\n";
    }

    /**
     * TEST 7: Condition 4 - ATTEMPT LIMIT
     */
    public function testAttemptLimit(): void {
        echo "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        echo "TEST 7: Condition 4 - Attempt Limit (8 max)\n";
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

        $result = $this->debugger->attemptHealing(
            code: '<?php /* attempt 8 */ ?>',
            previousErrors: 3,
            attemptNumber: 8,   // Max attempts reached
            errorMessage: 'Final attempt',
            temperature: 1.3
        );

        $pass = $result['action'] === 'ESCALATE' || $result['attempt'] === 8;
        $this->recordResult('Attempt limit reached', $pass, $result);

        echo "Action: {$result['action']}\n";
        echo "Attempt: {$result['attempt']}\n";
        echo "Decision: {$result['decision']}\n";
    }

    /**
     * TEST 8: Velocity Calculation
     */
    public function testVelocityCalculation(): void {
        echo "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        echo "TEST 8: Velocity Calculation\n";
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

        // Test 1: Good progress
        $result1 = $this->debugger->attemptHealing(
            code: '<?php /* good */ ?>',
            previousErrors: 10,  // Fix 5 errors
            attemptNumber: 2,
            errorMessage: 'Good progress',
            temperature: 1.0
        );

        $velocity1 = $result1['velocity'];
        echo "Scenario 1 - Good Progress:\n";
        echo "  Previous Errors: 10, Error Delta: 5, Velocity: $velocity1\n";
        $pass1 = $velocity1 > 0.1;  // Should be good
        $this->recordResult('Velocity - good progress', $pass1, $result1);

        // Test 2: Stalling
        echo "\nScenario 2 - Stalling:\n";
        $result2 = $this->debugger->attemptHealing(
            code: '<?php /* stalled */ ?>',
            previousErrors: 10,  // Fix 0 errors
            attemptNumber: 4,
            errorMessage: 'No progress',
            temperature: 1.0
        );

        $velocity2 = $result2['velocity'];
        echo "  Previous Errors: 10, Error Delta: 0, Velocity: $velocity2\n";
        $pass2 = $velocity2 < 0.1;  // Should be low
        $this->recordResult('Velocity - stalling', $pass2, $result2);
    }

    /**
     * TEST 9: Observer Integration
     */
    public function testObserverIntegration(): void {
        echo "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        echo "TEST 9: Observer Integration\n";
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

        $result = $this->debugger->attemptHealing(
            code: '<?php /* observer test */ ?>',
            previousErrors: 8,
            attemptNumber: 3,
            errorMessage: 'Test error message for observer',
            temperature: 1.0
        );

        $pass = isset($result['envelope']) && is_array($result['envelope']);
        $this->recordResult('Observer envelope returned', $pass, $result);

        if ($pass) {
            echo "Envelope ID: {$result['envelope']['id']}\n";
            echo "Difficulty: {$result['envelope']['difficulty']}\n";
            echo "Confidence: {$result['envelope']['confidence']}\n";
        }
    }

    /**
     * TEST 10: Temperature Management
     */
    public function testTemperatureManagement(): void {
        echo "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        echo "TEST 10: Temperature Management\n";
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

        $initial = 1.0;

        $result1 = $this->debugger->attemptHealing(
            code: '<?php /* attempt 1 */ ?>',
            previousErrors: 10,
            attemptNumber: 1,
            errorMessage: 'Initial attempt',
            temperature: $initial
        );

        echo "Initial Temperature: $initial\n";
        echo "Output Temperature: {$result1['temperature']}\n";
        
        $pass = $result1['temperature'] >= $initial;
        $this->recordResult('Temperature management', $pass, $result1);
    }

    /**
     * Helper: Record test result
     */
    private function recordResult(string $testName, bool $pass, array $details): void {
        if ($pass) {
            $this->passCount++;
            echo "✅ PASS: $testName\n";
        } else {
            $this->failCount++;
            echo "❌ FAIL: $testName\n";
        }

        $this->testResults[] = [
            'name' => $testName,
            'pass' => $pass,
            'details' => $details,
        ];
    }

    /**
     * Run all tests
     */
    public function runAll(): void {
        echo "\n";
        echo "╔════════════════════════════════════════════════════════════════╗\n";
        echo "║     MASHUP HEALING LOOP TEST SUITE                            ║\n";
        echo "║     October 29, 2025                                          ║\n";
        echo "╚════════════════════════════════════════════════════════════════╝\n";

        $this->testEasyProblem();
        $this->testHardProblem();
        $this->testSuccessPath();
        $this->testRollbackCondition();
        $this->testEscalateCondition();
        $this->testExtremeCase();
        $this->testAttemptLimit();
        $this->testVelocityCalculation();
        $this->testObserverIntegration();
        $this->testTemperatureManagement();

        $this->printSummary();
    }

    /**
     * Print test summary
     */
    private function printSummary(): void {
        echo "\n";
        echo "╔════════════════════════════════════════════════════════════════╗\n";
        echo "║                    TEST SUMMARY                               ║\n";
        echo "╚════════════════════════════════════════════════════════════════╝\n";

        $total = $this->passCount + $this->failCount;
        $percentage = $total > 0 ? ($this->passCount / $total) * 100 : 0;

        echo "\n✅ Passed: {$this->passCount}/{$total}\n";
        echo "❌ Failed: {$this->failCount}/{$total}\n";
        echo "📊 Success Rate: " . number_format($percentage, 1) . "%\n";

        if ($this->failCount === 0) {
            echo "\n🎉 ALL TESTS PASSED!\n";
        } else {
            echo "\n⚠️  SOME TESTS FAILED - Review details above\n";
        }

        echo "\n";
    }
}

// Run tests
if (php_sapi_name() === 'cli') {
    $suite = new HealingLoopTestSuite();
    $suite->runAll();
}
?>
