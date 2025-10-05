#!/usr/bin/env python3
"""
Demo: Runtime Error Parsing - BEFORE vs AFTER Fix

BEFORE (broken):
  Runtime error blob → {file: "runtime", line: None, column: None, message: "blob"}
  
AFTER (fixed):
  Runtime error blob → Parse through re-banker → {file: "test.py", line: 10, column: None, message: "NameError: ..."}
"""

import subprocess
import json
from pathlib import Path


def demo_before_vs_after():
    """Show the difference between broken and fixed runtime error handling"""
    
    # Simulate a runtime error blob from sandbox execution
    runtime_error_blob = """Traceback (most recent call last):
  File "calculator.py", line 42, in divide
    result = numerator / denominator
ZeroDivisionError: division by zero"""
    
    print("="*70)
    print("DEMO: Runtime Error Parsing Fix")
    print("="*70)
    print("\nRuntime error from sandbox execution:")
    print("-"*70)
    print(runtime_error_blob)
    print("-"*70)
    
    # BEFORE (broken approach)
    print("\n\n❌ BEFORE (broken - line 177-184 in old code):")
    print("-"*70)
    before_result = {
        "file": "runtime",
        "line": None,
        "column": None,
        "message": runtime_error_blob,
        "code": "RUNTIME_ERROR",
        "severity": "FATAL_RUNTIME"
    }
    print(json.dumps(before_result, indent=2))
    print("\n⚠️  Problem:")
    print("   - file: 'runtime' (not the actual file!)")
    print("   - line: None (lost the line number!)")
    print("   - column: None")
    print("   - message: Full blob (not structured!)")
    print("\n   LLM can't use this! No file path, no line number.")
    
    # AFTER (fixed approach)
    print("\n\n✅ AFTER (fixed - new code with re-banker parsing):")
    print("-"*70)
    rebank_script = Path(__file__).parent / "ops" / "rebank" / "rebank_py.py"
    
    if not rebank_script.exists():
        print(f"Re-banker script not found: {rebank_script}")
        return
    
    try:
        result = subprocess.run(
            ["python", str(rebank_script), "--stdin"],
            input=runtime_error_blob,
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0:
            print("⚠️  Re-banker returned success (expected error)")
        else:
            parsed = json.loads(result.stdout)
            # Override code/severity as done in integration
            parsed["code"] = "RUNTIME_ERROR"
            parsed["severity"] = "FATAL_RUNTIME"
            
            print(json.dumps(parsed, indent=2))
            print("\n✅ Success:")
            print(f"   - file: '{parsed['file']}' (ACTUAL FILE!)")
            print(f"   - line: {parsed['line']} (ACTUAL LINE NUMBER!)")
            print(f"   - column: {parsed.get('column')} (if available)")
            print(f"   - message: '{parsed['message'][:50]}...' (structured!)")
            print(f"   - code: {parsed['code']} (runtime error type)")
            print(f"   - severity: {parsed['severity']}")
            print("\n   LLM can now:")
            print("   • Jump to exact file + line")
            print("   • Understand error type (ZeroDivisionError)")
            print("   • See error in context (divide function)")
            print("   • Make surgical fix at line 42")
    
    except subprocess.TimeoutExpired:
        print("❌ Re-banker timed out")
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON: {e}")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print("\n" + "="*70)
    print("RESULT: Runtime errors now have structured file/line/message!")
    print("        This feeds the delta-gradient circuit breaker correctly.")
    print("        Envelope travels through time with REAL variance data!")
    print("="*70 + "\n")


if __name__ == "__main__":
    demo_before_vs_after()
