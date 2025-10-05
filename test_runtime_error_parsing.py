#!/usr/bin/env python3
"""
Test runtime error parsing through re-banker --stdin mode
"""

import subprocess
from pathlib import Path

# Simulate Python runtime error output
RUNTIME_ERRORS = [
    # NameError
    """Traceback (most recent call last):
  File "test.py", line 10, in <module>
    print(undefined_var)
NameError: name 'undefined_var' is not defined""",
    
    # ZeroDivisionError
    """Traceback (most recent call last):
  File "calculator.py", line 5, in divide
    result = a / b
ZeroDivisionError: division by zero""",
    
    # TypeError
    """Traceback (most recent call last):
  File "app.py", line 15, in process
    value = int(data) + "string"
TypeError: unsupported operand type(s) for +: 'int' and 'str'""",
    
    # AttributeError
    """Traceback (most recent call last):
  File "models.py", line 23, in __init__
    self.name = obj.missing_attr
AttributeError: 'dict' object has no attribute 'missing_attr'"""
]


def test_runtime_error_parsing():
    """Test that re-banker can parse runtime errors from stdin"""
    rebank_script = Path(__file__).parent / "ops" / "rebank" / "rebank_py.py"
    
    if not rebank_script.exists():
        print(f"❌ Re-banker script not found: {rebank_script}")
        return False
    
    print("Testing runtime error parsing through re-banker --stdin:\n")
    
    for i, error_blob in enumerate(RUNTIME_ERRORS, 1):
        print(f"Test {i}:")
        print(f"Input (first line): {error_blob.split(chr(10))[0][:60]}...")
        
        try:
            result = subprocess.run(
                ["python", str(rebank_script), "--stdin"],
                input=error_blob,
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0:
                print(f"  ⚠️  Re-banker returned success (expected error)")
                print(f"  Output: {result.stdout}")
            else:
                # Parse JSON output
                import json
                parsed = json.loads(result.stdout)
                
                # Check structure
                required_fields = ["file", "line", "message", "code", "severity"]
                missing = [f for f in required_fields if f not in parsed]
                
                if missing:
                    print(f"  ❌ Missing fields: {missing}")
                else:
                    print(f"  ✅ Parsed successfully:")
                    print(f"     File: {parsed['file']}")
                    print(f"     Line: {parsed['line']}")
                    print(f"     Message: {parsed['message'][:60]}...")
                    print(f"     Code: {parsed['code']}")
                    print(f"     Severity: {parsed['severity']}")
        
        except subprocess.TimeoutExpired:
            print(f"  ❌ Re-banker timed out")
        except json.JSONDecodeError as e:
            print(f"  ❌ Invalid JSON: {e}")
            print(f"  Output: {result.stdout}")
        except Exception as e:
            print(f"  ❌ Error: {e}")
        
        print()
    
    return True


if __name__ == "__main__":
    test_runtime_error_parsing()
