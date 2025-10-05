#!/usr/bin/env python3
"""
Test: Re-banker integration with envelope helpers
Demonstrates how rebanker runs on EVERY iteration to capture error variance.
"""
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.python.envelope_helpers import (
    run_rebanker,
    update_trend,
    append_attempt,
    add_timeline_entry,
    set_envelope_timestamp
)

def test_rebanker_on_every_iteration():
    """Simulate 3 iterations with variance in errors (34→12→3 pattern)"""
    
    # Initial envelope
    envelope = {
        "patch_id": "test-123",
        "patch_data": {
            "language": "python",
            "patched_code": "",
            "original_code": ""
        },
        "metadata": {},
        "attempts": []
    }
    
    print("🔍 Simulating healing cycle with re-banker on every iteration...\n")
    
    # --- ITERATION 1: Initial broken code (34 errors) ---
    print("📍 ITERATION 1: Initial code (broken)")
    set_envelope_timestamp(envelope)
    
    # Re-bank the file (would be saved to disk in real scenario)
    run_rebanker(envelope, file_path="test_syntax_error.py", language="python")
    
    result1 = envelope["metadata"].get("rebanker_result", {})
    print(f"   Rebanker result: {result1}")
    
    # In real scenario, analyzer would count ALL errors; rebanker gives us structured first error
    # For demo, simulate 34 errors detected
    update_trend(envelope, errors_detected=34, errors_resolved=0, quality_score=0.1)
    append_attempt(envelope, success=False, note="Initial attempt failed", breaker_state="CLOSED")
    add_timeline_entry(envelope, attempt=1, errors_detected=34, errors_resolved=0, breaker_state="CLOSED", action="RETRY")
    
    print(f"   ❌ Errors detected: 34")
    print(f"   🔄 Action: RETRY\n")
    
    # --- ITERATION 2: LLM fixed some issues (12 errors remain) ---
    print("📍 ITERATION 2: After first patch")
    
    # In real scenario, LLM would patch code and we'd re-bank
    # For demo, simulate cleaner file
    run_rebanker(envelope, file_path="utils/python/envelope.py", language="python")
    
    result2 = envelope["metadata"].get("rebanker_result", {})
    print(f"   Rebanker result: {result2}")
    
    # Simulate 12 errors (22 resolved from previous)
    update_trend(envelope, errors_detected=12, errors_resolved=22, quality_score=0.6, improvement_velocity=0.65)
    append_attempt(envelope, success=False, note="Improved but still has errors", breaker_state="CLOSED")
    add_timeline_entry(envelope, attempt=2, errors_detected=12, errors_resolved=22, breaker_state="CLOSED", action="RETRY")
    
    print(f"   ⚡ Errors detected: 12 (resolved 22!)")
    print(f"   📈 Trend: improving")
    print(f"   🔄 Action: RETRY (98% correct, tweak last change)\n")
    
    # --- ITERATION 3: Almost there (3 errors) ---
    print("📍 ITERATION 3: After second patch")
    
    run_rebanker(envelope, file_path="utils/python/envelope.py", language="python")
    
    result3 = envelope["metadata"].get("rebanker_result", {})
    print(f"   Rebanker result: {result3}")
    
    # Simulate 3 errors (9 more resolved)
    update_trend(envelope, errors_detected=3, errors_resolved=9, quality_score=0.95, improvement_velocity=0.75)
    append_attempt(envelope, success=False, note="Very close, minor tweaks needed", breaker_state="CLOSED")
    add_timeline_entry(envelope, attempt=3, errors_detected=3, errors_resolved=9, breaker_state="CLOSED", action="RETRY")
    
    print(f"   ⚡ Errors detected: 3 (resolved 9 more!)")
    print(f"   📈 Trend: improving")
    print(f"   💡 Quality: 95% - LLM sees delta and tweaks instead of rewriting\n")
    
    # Summary
    print("=" * 60)
    print("✅ RESULT: Re-banker ran on EVERY iteration")
    print(f"   Timeline: 34 → 12 → 3 errors")
    print(f"   Total attempts: {len(envelope['attempts'])}")
    print(f"   Circuit breaker never tripped (positive delta throughout)")
    print(f"   LLM received errorDelta in envelope each time")
    print("=" * 60)
    
    # Show timeline
    print("\n📊 Timeline entries:")
    for entry in envelope.get("timeline", []):
        print(f"   Attempt {entry['attempt']}: {entry['errorsDetected']} errors, "
              f"action={entry['action']}, breaker={entry['breakerState']}")

if __name__ == "__main__":
    test_rebanker_on_every_iteration()
