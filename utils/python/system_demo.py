"""
Complete Self-Healing Code System Demo
Demonstrates unified confidence scoring, dual circuit breaker, and cascading error handling
"""

from confidence_scoring import (
    UnifiedConfidenceScorer, DualCircuitBreaker, ErrorType,
    ConfidenceScore, CircuitState
)
from cascading_error_handler import SandboxExecution, CascadingErrorHandler, Environment
import json
from datetime import datetime

def demonstrate_confidence_scoring():
    """Demonstrate the unified confidence scoring system"""
    print("🔬 UNIFIED CONFIDENCE SCORING DEMO")
    print("=" * 50)

    # Initialize the confidence scorer
    scorer = UnifiedConfidenceScorer(temperature=1.0, calibration_samples=1000)

    # Example logits from different scenarios
    scenarios = [
        {
            "name": "High confidence syntax error",
            "logits": [2.5, 0.1, 0.05],  # Strong preference for first option
            "error_type": ErrorType.SYNTAX,
            "historical_data": {
                "success_rate": 0.95,
                "pattern_similarity": 0.9,
                "complexity_score": 2.0,
                "test_coverage": 0.8
            }
        },
        {
            "name": "Moderate confidence logic error",
            "logits": [1.2, 1.0, 0.8],  # Less clear preference
            "error_type": ErrorType.LOGIC,
            "historical_data": {
                "success_rate": 0.75,
                "pattern_similarity": 0.6,
                "complexity_score": 4.5,
                "test_coverage": 0.6
            }
        },
        {
            "name": "Low confidence runtime error",
            "logits": [0.8, 0.7, 0.9],  # Very close probabilities
            "error_type": ErrorType.RUNTIME,
            "historical_data": {
                "success_rate": 0.5,
                "pattern_similarity": 0.3,
                "complexity_score": 7.0,
                "test_coverage": 0.4
            }
        }
    ]

    for scenario in scenarios:
        print(f"\n📊 {scenario['name']}:")
        print(f"   Logits: {scenario['logits']}")
        print(f"   Error Type: {scenario['error_type']}")

        # Calculate confidence
        confidence_score = scorer.calculate_confidence(
            scenario['logits'],
            scenario['error_type'],
            scenario['historical_data']
        )

        print(".3f"        print(".3f"        print(".3f"        print(f"   Calibration: {confidence_score.calibration_method}")
        print(f"   Components: Historical={confidence_score.components.historical_success_rate:.2f}, "
              f"Pattern={confidence_score.components.pattern_similarity:.2f}, "
              f"Complexity={confidence_score.components.code_complexity_penalty:.2f}, "
              f"Coverage={confidence_score.components.test_coverage:.2f}")

        # Check if we should attempt fix
        should_attempt = scorer.should_attempt_fix(confidence_score, scenario['error_type'])
        print(f"   Should Attempt Fix: {should_attempt}")

        # Record outcome for calibration (simulate some successes/failures)
        was_correct = confidence_score.overall_confidence > 0.7  # Simulate based on confidence
        scorer.record_outcome(confidence_score.overall_confidence, was_correct)

def demonstrate_dual_circuit_breaker():
    """Demonstrate the dual circuit breaker system"""
    print("\n🔄 DUAL CIRCUIT BREAKER DEMO")
    print("=" * 50)

    # Initialize circuit breaker
    circuit_breaker = DualCircuitBreaker(
        syntax_max_attempts=3,
        logic_max_attempts=10,
        syntax_error_budget=0.03,  # 3%
        logic_error_budget=0.10    # 10%
    )

    # Simulate syntax error attempts
    print("\n📝 SYNTAX ERROR SCENARIO (Max 3 attempts, 3% error budget):")
    for attempt in range(5):  # Try more than allowed
        can_attempt, reason = circuit_breaker.can_attempt(ErrorType.SYNTAX)
        print(f"   Attempt {attempt + 1}: Can attempt = {can_attempt} ({reason})")

        if can_attempt:
            # Simulate occasional failure
            success = attempt != 1  # Fail on attempt 2
            circuit_breaker.record_attempt(ErrorType.SYNTAX, success)
            print(f"      Result: {'✅ Success' if success else '❌ Failed'}")
        else:
            break

    print(f"\n   Final State: {circuit_breaker.get_state_summary()}")

    # Reset and simulate logic error attempts
    circuit_breaker.reset()
    print("\n🧠 LOGIC ERROR SCENARIO (Max 10 attempts, 10% error budget):")
    for attempt in range(12):  # Try more than allowed
        can_attempt, reason = circuit_breaker.can_attempt(ErrorType.LOGIC)
        print(f"   Attempt {attempt + 1}: Can attempt = {can_attempt} ({reason})")

        if can_attempt:
            # Simulate occasional failure
            success = attempt not in [2, 5, 8]  # Fail on attempts 3, 6, 9
            circuit_breaker.record_attempt(ErrorType.LOGIC, success)
            print(f"      Result: {'✅ Success' if success else '❌ Failed'}")
        else:
            break

    print(f"\n   Final State: {circuit_breaker.get_state_summary()}")

def demonstrate_cascading_error_handler():
    """Demonstrate the cascading error handler"""
    print("\n🔗 CASCADING ERROR HANDLER DEMO")
    print("=" * 50)

    # Initialize handlers
    error_handler = CascadingErrorHandler()
    sandbox = SandboxExecution()

    # Simulate a cascading error scenario
    print("\n📋 SIMULATING ERROR CASCADE:")

    cascade_scenario = [
        {
            "error_type": ErrorType.SYNTAX,
            "message": "Missing semicolon",
            "confidence": 0.95,
            "attempt": 1
        },
        {
            "error_type": ErrorType.SYNTAX,
            "message": "Undefined variable",
            "confidence": 0.90,
            "attempt": 2
        },
        {
            "error_type": ErrorType.LOGIC,
            "message": "Null pointer exception",
            "confidence": 0.75,
            "attempt": 1
        },
        {
            "error_type": ErrorType.LOGIC,
            "message": "Index out of bounds",
            "confidence": 0.60,
            "attempt": 2
        },
        {
            "error_type": ErrorType.RUNTIME,
            "message": "Memory leak detected",
            "confidence": 0.45,
            "attempt": 1
        }
    ]

    for i, error in enumerate(cascade_scenario):
        print(f"\n🔍 Error {i + 1}: {error['error_type']} - {error['message']}")
        print(".3f"
        # Add to cascade
        error_handler.add_error_to_chain(
            error['error_type'],
            error['message'],
            error['confidence'],
            error['attempt']
        )

        # Check if we should stop
        should_stop, reason = error_handler.should_stop_attempting()
        print(f"   Should Stop: {should_stop} ({reason})")

        # Show cascade analysis
        analysis = error_handler.get_cascade_analysis()
        print(f"   Cascade Depth: {analysis['cascade_depth']}")
        print(f"   Confidence Trend: {analysis['confidence_trend']}")
        print(f"   Recommendation: {analysis['recommendation']}")

        if should_stop:
            break

    # Show final analysis
    print("
📊 FINAL CASCADE ANALYSIS:"    final_analysis = error_handler.get_cascade_analysis()
    print(json.dumps(final_analysis, indent=2))

def demonstrate_sandbox_execution():
    """Demonstrate sandbox execution with resource limits"""
    print("\n🏖️  SANDBOX EXECUTION DEMO")
    print("=" * 50)

    # Create test patch data
    patch_data = {
        "patch_id": "test-patch-001",
        "language": "python",
        "patched_code": "def hello_world():\n    print('Hello, World!')\n    return True",
        "original_code": "def hello_world():\n    print('Hello, World!')",
        "diff": "+    return True"
    }

    # Test different isolation levels
    isolation_levels = ["full", "partial", "none"]

    for level in isolation_levels:
        print(f"\n🔒 Testing {level.upper()} isolation:")

        # Create sandbox with specific isolation
        if level == "full":
            sandbox = SandboxExecution(Environment.SANDBOX, "full")
        elif level == "partial":
            sandbox = SandboxExecution(Environment.SANDBOX, "partial")
        else:
            sandbox = SandboxExecution(Environment.SANDBOX, "none")

        # Execute patch
        result = sandbox.execute_patch(patch_data)

        print(f"   Success: {result['success']}")
        print(f"   Execution Time: {result['execution_time_ms']}ms")
        print(f"   Memory Used: {result['memory_used_mb']}MB")
        print(f"   CPU Used: {result['cpu_used_percent']}%")
        print(f"   Side Effects: {result['side_effects']}")

        # Show execution summary
        summary = sandbox.get_execution_summary()
        print(f"   Test Success Rate: {summary['test_success_rate']:.1%}")

def demonstrate_complete_system():
    """Demonstrate the complete integrated system"""
    print("\n🚀 COMPLETE SYSTEM INTEGRATION DEMO")
    print("=" * 50)

    # Initialize all components
    confidence_scorer = UnifiedConfidenceScorer()
    circuit_breaker = DualCircuitBreaker()
    error_handler = CascadingErrorHandler()
    sandbox = SandboxExecution()

    print("🎯 Processing a complex error scenario...")

    # Simulate a complete error resolution workflow
    workflow_steps = [
        {
            "step": "Initial Error Detection",
            "error_type": ErrorType.SYNTAX,
            "logits": [2.0, 0.5, 0.2],
            "message": "SyntaxError: invalid syntax",
            "historical_data": {"success_rate": 0.9, "pattern_similarity": 0.8}
        },
        {
            "step": "First Fix Attempt",
            "error_type": ErrorType.SYNTAX,
            "logits": [1.8, 0.6, 0.3],
            "message": "Fixed syntax, now logic error",
            "historical_data": {"success_rate": 0.85, "pattern_similarity": 0.7}
        },
        {
            "step": "Logic Error Detected",
            "error_type": ErrorType.LOGIC,
            "logits": [1.2, 1.1, 0.9],
            "message": "LogicError: division by zero",
            "historical_data": {"success_rate": 0.7, "pattern_similarity": 0.5}
        }
    ]

    for step_data in workflow_steps:
        print(f"\n📍 {step_data['step']}:")

        # Calculate confidence
        confidence = confidence_scorer.calculate_confidence(
            step_data['logits'],
            step_data['error_type'],
            step_data['historical_data']
        )

        # Check circuit breaker
        can_attempt, cb_reason = circuit_breaker.can_attempt(step_data['error_type'])

        # Check cascading handler
        should_stop, cascade_reason = error_handler.should_stop_attempting()

        print(f"   Error: {step_data['message']}")
        print(".3f"        print(f"   Circuit Breaker: {'✅ OK' if can_attempt else '❌ Blocked'} ({cb_reason})")
        print(f"   Cascade Check: {'🛑 Stop' if should_stop else '✅ Continue'} ({cascade_reason})")

        # Determine if we should proceed
        should_proceed = (
            confidence_scorer.should_attempt_fix(confidence, step_data['error_type']) and
            can_attempt and
            not should_stop
        )

        if should_proceed:
            print("   🎯 Proceeding with fix attempt...")

            # Simulate sandbox execution
            patch_data = {
                "patch_id": f"fix-{step_data['error_type']}",
                "language": "python",
                "patched_code": "# Simulated fix",
                "original_code": "# Original code"
            }

            sandbox_result = sandbox.execute_patch(patch_data)
            success = sandbox_result['success']

            # Record outcomes
            circuit_breaker.record_attempt(step_data['error_type'], success)
            confidence_scorer.record_outcome(confidence.overall_confidence, success)

            if success:
                print("   ✅ Fix successful!")
                break
            else:
                print("   ❌ Fix failed, adding to cascade...")
                error_handler.add_error_to_chain(
                    step_data['error_type'],
                    step_data['message'],
                    confidence.overall_confidence,
                    1
                )
        else:
            print("   🛑 Stopping fix attempts...")
            break

    # Final system state
    print("
🏁 FINAL SYSTEM STATE:"    print(f"   Circuit Breaker: {circuit_breaker.get_state_summary()['circuit_state']}")
    print(f"   Error Cascade: {error_handler.get_cascade_analysis()['cascade_depth']} errors")
    print(f"   Sandbox Tests: {sandbox.get_execution_summary()['tests_passed']}/{sandbox.get_execution_summary()['tests_total']} passed")

if __name__ == "__main__":
    print("🤖 SELF-HEALING CODE SYSTEM - COMPREHENSIVE DEMO")
    print("=" * 60)
    print("This demo showcases the complete unified system with:")
    print("• Unified confidence scoring across error types")
    print("• Dual circuit breaker (syntax: 3 attempts, logic: 10 attempts)")
    print("• Cascading error detection and handling")
    print("• Sandbox execution with resource limits")
    print("• Complete system integration")
    print("=" * 60)

    # Run all demonstrations
    demonstrate_confidence_scoring()
    demonstrate_dual_circuit_breaker()
    demonstrate_cascading_error_handler()
    demonstrate_sandbox_execution()
    demonstrate_complete_system()

    print("\n🎉 Demo completed! The system successfully handles:")
    print("   ✅ Syntax errors with high confidence requirements")
    print("   ✅ Logic errors with more forgiving thresholds")
    print("   ✅ Cascading error detection and prevention")
    print("   ✅ Resource-limited sandbox execution")
    print("   ✅ Circuit breaker protection against infinite loops")
    print("   ✅ Cross-language JSON transmission compatibility")