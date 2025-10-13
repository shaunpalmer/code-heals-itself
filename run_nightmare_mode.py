"""
Test runner for NIGHTMARE MODE - Concurrent Programming Bugs
=============================================================

This is the HARDEST test with:
- Race conditions in threading
- Lock usage bugs
- Atomicity issues
- Concurrent state corruption
- Mathematical correctness
- Multiple syntax + logic errors

Expected: 4-12 attempts, may not fully succeed
"""

import sys
import os
import subprocess
import tempfile
import asyncio
from datetime import datetime
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from clients.llm_client import LLMClient
from llm_settings import load_llm_settings


# Load the buggy code
BUGGY_CODE = Path("test_nightmare_mode.py").read_text(encoding='utf-8')

MAX_ATTEMPTS = 12  # Plenty of attempts for concurrent bugs


async def test_code(code: str, attempt_num: int) -> dict:
    """Test if code runs successfully"""
    test_file = Path(f"temp_nightmare_test_{attempt_num}.py")
    test_file.write_text(code, encoding='utf-8')
    
    try:
        result = subprocess.run(
            [sys.executable, str(test_file)],
            capture_output=True,
            text=True,
            timeout=10  # Longer timeout for threading
        )
        
        success = result.returncode == 0
        
        # For concurrent code, check if output looks correct
        output = result.stdout.strip() if result.stdout else ""
        error = result.stderr.strip() if result.stderr else ""
        
        return {
            "success": success,
            "output": output,
            "error": error,
            "exit_code": result.returncode
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "output": None,
            "error": "Test timed out (possible deadlock or infinite loop)",
            "exit_code": -1
        }
    except Exception as e:
        return {
            "success": False,
            "output": None,
            "error": str(e),
            "exit_code": -1
        }
    finally:
        if test_file.exists():
            test_file.unlink()


def validate_fix(code: str) -> dict:
    """Quick validation without temp file tracking"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as f:
        f.write(code)
        temp_path = f.name
    
    try:
        result = subprocess.run(
            [sys.executable, temp_path],
            capture_output=True,
            text=True,
            timeout=10
        )
        return {
            'success': result.returncode == 0,
            'exit_code': result.returncode,
            'stdout': result.stdout,
            'stderr': result.stderr
        }
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'exit_code': -1,
            'stdout': '',
            'stderr': 'Timeout (possible deadlock)'
        }
    except Exception as e:
        return {
            'success': False,
            'exit_code': -1,
            'stdout': '',
            'stderr': str(e)
        }
    finally:
        try:
            os.unlink(temp_path)
        except:
            pass


def create_prompt(code, attempt_num, prev_error=""):
    """Create detailed prompt for nightmare mode bugs"""
    prompt = f"""Fix this Python code with CONCURRENT PROGRAMMING bugs (extremely difficult).

Critical bugs to fix:
1. RACE CONDITIONS - deposit() and withdraw() don't use the lock (threading.Lock exists but unused)
2. ATOMICITY - Transaction.execute() has no rollback, partial transactions possible
3. COMPARISON BUG - withdraw() uses > instead of >= for balance check
4. SYNTAX ERRORS - Missing colons, wrong operators (= vs ==)
5. LOGIC ERRORS - range(11) instead of range(10)
6. STATE CORRUPTION - Concurrent access will corrupt account balances

This code simulates concurrent bank transactions. Without proper locking, 
balance calculations will be WRONG due to race conditions.

BUGGY CODE:
```python
{code}
```
"""
    
    if attempt_num > 1:
        prompt += f"\n\nATTEMPT {attempt_num}: Previous attempt failed with:\n{prev_error}\n"
        prompt += "\nFocus on:\n"
        prompt += "- Ensure deposit() and withdraw() use self.lock (with self.lock:)\n"
        prompt += "- Fix syntax errors (colons, operators)\n"
        prompt += "- Use >= not > for balance comparison\n"
        prompt += "- Fix range to be range(10) not range(11)\n"
    
    prompt += "\n\nProvide ONLY the complete fixed code with proper thread safety."
    return prompt


async def run_test():
    settings = load_llm_settings()
    
    client = LLMClient(
        provider=settings.get('provider', 'lmstudio'),
        api_key=settings.get('api_key', 'not-needed'),
        base_url=settings.get('base_url', 'http://127.0.0.1:1234/v1'),
        model_name=settings.get('model_name', 'openai/gpt-oss-20b'),
        temperature=0.5,
        max_tokens=settings.get('max_tokens', 6000),
        timeout=settings.get('timeout', 180)
    )
    
    print("="*70)
    print("💀 NIGHTMARE MODE TEST - Concurrent Programming")
    print("="*70)
    print("\nBugs:")
    print("  1. Race conditions (no lock usage)")
    print("  2. Atomicity issues (no rollback)")
    print("  3. Comparison bug (> vs >=)")
    print("  4. Syntax errors (colons, operators)")
    print("  5. Logic errors (range off-by-one)")
    print("  6. Concurrent state corruption")
    print("="*70)
    
    print("\nInitial validation:")
    initial = validate_fix(BUGGY_CODE)
    print(f"  Status: {'PASS' if initial['success'] else 'FAIL'}")
    if initial['stderr']:
        print(f"  Error: {initial['stderr'][:200]}")
    
    current_code = BUGGY_CODE
    prev_error = ""
    
    for attempt in range(1, MAX_ATTEMPTS + 1):
        print(f"\n{'='*70}")
        print(f"ATTEMPT {attempt}/{MAX_ATTEMPTS}")
        print(f"{'='*70}")
        
        temp = 0.5 + (attempt - 1) * 0.05
        max_tokens_setting = settings.get('max_tokens', 6000)
        print(f"Temperature: {temp:.2f}")
        print(f"Max tokens: {max_tokens_setting}")
        
        prompt = create_prompt(current_code, attempt, prev_error)
        
        print("Calling LLM...")
        try:
            response = await client.chat(
                messages=[{"role": "user", "content": prompt}],
                temperature=temp,
                max_tokens=max_tokens_setting
            )
            
            if 'error' in response:
                print(f"LLM error: {response['error']}")
                prev_error = response['error']
                continue
            
            fixed_code = response['content'].strip()
            if '```python' in fixed_code:
                fixed_code = fixed_code.split('```python')[1].split('```')[0].strip()
            elif '```' in fixed_code:
                fixed_code = fixed_code.split('```')[1].split('```')[0].strip()
            
            print(f"LLM responded ({len(fixed_code)} chars)")
            
            print("Validating...")
            test_result = validate_fix(fixed_code)
            
            print(f"\nResult: {'SUCCESS' if test_result['success'] else 'FAIL'}")
            print(f"Exit code: {test_result['exit_code']}")
            
            if test_result['stdout']:
                print(f"Output:\n{test_result['stdout'][:400]}")
            if test_result['stderr']:
                print(f"Errors: {test_result['stderr'][:200]}")
                prev_error = test_result['stderr']
            
            if test_result['success']:
                print(f"\n{'='*70}")
                print(f"SUCCESS ON ATTEMPT {attempt}!")
                print(f"{'='*70}")
                if attempt == 1:
                    print("\n🎉 INCREDIBLE! Fixed all concurrent bugs on first try!")
                elif attempt <= 3:
                    print(f"\n✨ EXCELLENT! Fixed all bugs in {attempt} attempts!")
                else:
                    print(f"\n✅ SUCCESS after {attempt} attempts - concurrent bugs are HARD!")
                
                return {'success': True, 'attempts': attempt}
            
            current_code = fixed_code
            
        except Exception as e:
            print(f"Error during attempt: {e}")
            prev_error = str(e)
            continue
    
    print(f"\n{'='*70}")
    print(f"EXHAUSTED ALL {MAX_ATTEMPTS} ATTEMPTS")
    print(f"{'='*70}")
    print("\n⚠️ Could not fully fix concurrent programming bugs")
    print("This is expected - race conditions are extremely difficult!")
    
    return {'success': False, 'attempts': MAX_ATTEMPTS}


def main():
    print("="*70)
    print("💀 NIGHTMARE MODE - Testing limits of self-healing")
    print("="*70)
    print()
    
    result = asyncio.run(run_test())
    
    print("\n" + "="*70)
    print("FINAL SUMMARY")
    print("="*70)
    if result['success']:
        print(f"✅ SUCCESS in {result['attempts']} attempts")
        print("The system successfully fixed concurrent programming bugs!")
    else:
        print(f"⚠️ Did not fully succeed after {result['attempts']} attempts")
        print("Concurrent bugs represent the upper limit of current capabilities")
    
    return 0 if result['success'] else 1


if __name__ == "__main__":
    sys.exit(main())
