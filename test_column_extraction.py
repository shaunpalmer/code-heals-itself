#!/usr/bin/env python3
"""Test column number extraction from Python syntax errors"""

import subprocess
from pathlib import Path

# Test cases with known column positions
test_cases = [
    {
        "code": "x = [1,2,3",
        "desc": "Missing closing bracket",
        "expected_col": 4  # Position of [
    },
    {
        "code": "def x(: pass",
        "desc": "Invalid function syntax",
        "expected_col": 5  # Position of (
    },
    {
        "code": "print('hello'",
        "desc": "Missing closing quote/paren",
        "expected_col": 6  # Position of '
    }
]

def test_column_extraction():
    """Test that re-banker extracts column numbers from Python errors"""
    rebank_script = Path(__file__).parent / "ops" / "rebank" / "rebank_py.py"
    
    if not rebank_script.exists():
        print(f"❌ Re-banker script not found: {rebank_script}")
        return
    
    print("="*70)
    print("Testing Column Number Extraction")
    print("="*70)
    
    for i, test in enumerate(test_cases, 1):
        print(f"\nTest {i}: {test['desc']}")
        print(f"Code: {test['code']}")
        
        # Generate error from Python
        result = subprocess.run(
            ["python", "-c", test["code"]],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            print(f"  ⚠️  Code executed successfully (expected error)")
            continue
        
        print(f"\nPython error output:")
        print("-"*70)
        print(result.stderr)
        print("-"*70)
        
        # Parse through re-banker
        rebank_result = subprocess.run(
            ["python", str(rebank_script), "--stdin"],
            input=result.stderr,
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if rebank_result.returncode == 0:
            print(f"  ⚠️  Re-banker returned success")
            continue
        
        import json
        try:
            parsed = json.loads(rebank_result.stdout)
            print(f"\nRe-banker parsed:")
            print(f"  File: {parsed.get('file')}")
            print(f"  Line: {parsed.get('line')}")
            print(f"  Column: {parsed.get('column')}")
            print(f"  Message: {parsed.get('message')[:50]}...")
            
            if parsed.get('column') is not None:
                print(f"  ✅ Column extracted: {parsed['column']}")
            else:
                print(f"  ⚠️  Column is None (Python shows ^ pointer but we didn't extract it)")
        
        except json.JSONDecodeError as e:
            print(f"  ❌ JSON parse error: {e}")
    
    print("\n" + "="*70)

if __name__ == "__main__":
    test_column_extraction()
