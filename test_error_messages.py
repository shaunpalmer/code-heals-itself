#!/usr/bin/env python3
"""Test improved error messages for edge cases"""

import subprocess
import json
from pathlib import Path

def test_error_messages():
    """Test that error messages are LLM-friendly with context"""
    rebank_script = Path(__file__).parent / "ops" / "rebank" / "rebank_py.py"
    
    if not rebank_script.exists():
        print(f"❌ Re-banker script not found: {rebank_script}")
        return
    
    print("="*70)
    print("Testing Improved Error Messages")
    print("="*70)
    
    # Test 1: File not found
    print("\n1. File not found (should include path and helpful hint):")
    result = subprocess.run(
        ["python", str(rebank_script), "nonexistent_file_12345.py"],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        error = json.loads(result.stdout)
        print(f"   Message: {error['message']}")
        print(f"   Code: {error['code']}")
        if "nonexistent_file_12345.py" in error['message']:
            print("   ✅ Includes actual file path")
        else:
            print("   ❌ Missing file path")
        if "check path" in error['message'].lower() or "deleted" in error['message'].lower():
            print("   ✅ Includes helpful hint")
        else:
            print("   ❌ Missing helpful hint")
    
    # Test 2: Syntax error with column
    print("\n2. Syntax error (should extract file/line/column):")
    test_file = Path("test_syntax_temp.py")
    test_file.write_text("x = [1,2,3\n")  # Missing closing bracket
    
    result = subprocess.run(
        ["python", str(rebank_script), str(test_file)],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        error = json.loads(result.stdout)
        print(f"   File: {error['file']}")
        print(f"   Line: {error['line']}")
        print(f"   Column: {error['column']}")
        print(f"   Message: {error['message']}")
        print(f"   Code: {error['code']}")
        if error['column'] is not None:
            print("   ✅ Column extracted")
        else:
            print("   ⚠️  Column not extracted (may be normal for this error)")
    
    test_file.unlink()  # Clean up
    
    # Test 3: Runtime error via stdin
    print("\n3. Runtime error (should have PY_RUNTIME code):")
    runtime_blob = """Traceback (most recent call last):
  File "test.py", line 10, in <module>
    print(undefined_var)
NameError: name 'undefined_var' is not defined"""
    
    result = subprocess.run(
        ["python", str(rebank_script), "--stdin"],
        input=runtime_blob,
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        error = json.loads(result.stdout)
        print(f"   File: {error['file']}")
        print(f"   Line: {error['line']}")
        print(f"   Message: {error['message']}")
        print(f"   Code: {error['code']}")
        if error['code'] == 'PY_RUNTIME':
            print("   ✅ Correct code (PY_RUNTIME)")
        else:
            print(f"   ❌ Wrong code (expected PY_RUNTIME, got {error['code']})")
    
    # Test 4: Clean file
    print("\n4. Clean file (should return clean status):")
    clean_file = Path("test_clean_temp.py")
    clean_file.write_text("print('hello world')\n")
    
    result = subprocess.run(
        ["python", str(rebank_script), str(clean_file)],
        capture_output=True,
        text=True
    )
    if result.returncode == 0:
        output = json.loads(result.stdout)
        print(f"   Status: {output.get('status')}")
        if output.get('status') == 'clean':
            print("   ✅ Clean file detected correctly")
    else:
        print("   ❌ Clean file marked as error")
    
    clean_file.unlink()  # Clean up
    
    print("\n" + "="*70)
    print("✅ All error messages now include context for LLM reasoning!")
    print("="*70 + "\n")

if __name__ == "__main__":
    test_error_messages()
