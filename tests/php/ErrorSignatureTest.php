<?php
/**
 * Test ErrorSignature consistency across languages.
 * 
 * These tests verify that the PHP ErrorSignature implementation
 * produces consistent results for common error patterns.
 */

require_once __DIR__ . '/../../utils/php/ErrorSignature.php';

function test_normalize_basic_exceptions() {
    echo "Testing basic exception normalization...\n";
    
    // Test common PHP exceptions
    $valueError = new InvalidArgumentException("invalid argument provided");
    $typeError = new TypeError("Argument must be of type string");
    $nameError = new Error("Undefined variable: x");
    
    $result1 = ErrorSignature::normalize($valueError);
    $result2 = ErrorSignature::normalize($typeError);
    $result3 = ErrorSignature::normalize($nameError);
    
    assert($result1 === "InvalidArgumentException:invalid argument provided");
    assert($result2 === "TypeError:Argument must be of type string");
    assert($result3 === "Error:Undefined variable: x");
    
    echo "✓ Basic exception normalization passed\n";
}

function test_normalize_removes_file_paths() {
    echo "Testing file path removal...\n";
    
    // Simulate errors with file path references
    $errorWithPath = new Exception("Something went wrong in /path/to/file.php on line 10");
    $normalized = ErrorSignature::normalize($errorWithPath);
    
    assert($normalized === "Exception:Something went wrong");
    echo "✓ File path removal passed\n";
}

function test_create_detailed_signature() {
    echo "Testing detailed signature creation...\n";
    
    $error = new ValueError("test error message");
    $signature = ErrorSignature::create($error);
    
    assert($signature->type === "ValueError");
    assert($signature->message === "test error message");
    assert($signature->signature === "ValueError:test error message");
    assert(strlen($signature->hash) === 8); // MD5 first 8 chars
    
    echo "✓ Detailed signature creation passed\n";
}

function test_are_same() {
    echo "Testing error comparison...\n";
    
    $error1 = new ValueError("same message");
    $error2 = new ValueError("same message");
    $error3 = new TypeError("same message");
    
    assert(ErrorSignature::areSame($error1, $error2) === true);
    assert(ErrorSignature::areSame($error1, $error3) === false);
    
    echo "✓ Error comparison passed\n";
}

function test_error_tracker() {
    echo "Testing ErrorTracker functionality...\n";
    
    $tracker = new ErrorTracker();
    $error1 = new ValueError("duplicate error");
    $error2 = new ValueError("duplicate error");
    $error3 = new TypeError("different error");
    
    // Initially no errors seen
    assert($tracker->hasSeen($error1) === false);
    
    // Record first error
    $sig1 = $tracker->record($error1);
    assert($tracker->hasSeen($error1) === true);
    assert($sig1->type === "ValueError");
    
    // Record duplicate - should be recognized
    assert($tracker->hasSeen($error2) === true);
    $tracker->record($error2);
    
    // Record different error
    $tracker->record($error3);
    
    // Check counts
    $counts = $tracker->getErrorCounts();
    assert($counts["ValueError:duplicate error"] === 2);
    assert($counts["TypeError:different error"] === 1);
    
    // Check unique errors
    $unique = $tracker->getUniqueErrors();
    assert(count($unique) === 2);
    
    // Check most frequent
    $frequent = $tracker->getMostFrequentErrors(1);
    assert($frequent[0][1] === 2); // Count of most frequent error
    
    echo "✓ ErrorTracker functionality passed\n";
}

function test_cross_language_consistency() {
    echo "Testing cross-language consistency patterns...\n";
    
    // These error patterns should normalize similarly across languages
    $refError = new Error("x is not defined");
    $typeError = new TypeError("Cannot read property of undefined");
    
    // PHP equivalents of common JS errors
    assert(ErrorSignature::normalize($refError) === "Error:x is not defined");
    assert(ErrorSignature::normalize($typeError) === "TypeError:Cannot read property of undefined");
    
    echo "✓ Cross-language consistency passed\n";
}

// Custom ValueError class for testing
class ValueError extends Exception {}

// Run all tests
try {
    test_normalize_basic_exceptions();
    test_normalize_removes_file_paths();
    test_create_detailed_signature();
    test_are_same();
    test_error_tracker();
    test_cross_language_consistency();
    
    echo "\n🎉 All PHP ErrorSignature tests passed!\n";
} catch (AssertionError $e) {
    echo "\n❌ Test failed: " . $e->getMessage() . "\n";
    exit(1);
} catch (Exception $e) {
    echo "\n❌ Unexpected error: " . $e->getMessage() . "\n";
    exit(1);
}

?>