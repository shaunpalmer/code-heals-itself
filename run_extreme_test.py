"""
Test runner for extreme difficulty bugs
Uses the iterative healing demo to see how many attempts it takes
"""

import sys
import asyncio
import subprocess
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent / "clients"))

from llm_client import LLMClient
from llm_settings import load_llm_settings

# Load the buggy code
BUGGY_CODE = Path("test_extreme_difficulty.py").read_text()

MAX_ATTEMPTS = 12  # Increase for harder bugs


async def test_code(code: str, attempt_num: int) -> dict:
    """Test if code runs successfully"""
    test_file = Path(f"temp_extreme_test_{attempt_num}.py")
    test_file.write_text(code)
    
    try:
        result = subprocess.run(
            [sys.executable, str(test_file)],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        success = result.returncode == 0
        error = None if success else result.stderr
        
        return {
            "success": success,
            "output": result.stdout.strip() if success else None,
            "error": error,
            "exit_code": result.returncode
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


async def main():
    print("=" * 80)
    print("🔥 EXTREME DIFFICULTY TEST - Can the LLM handle complex bugs?")
    print("=" * 80)
    print()
    
    # Setup LLM
    settings = load_llm_settings()
    if not settings.get('enabled'):
        print("❌ LLM disabled!")
        return
    
    client = LLMClient(
        provider=settings.get('provider', 'lmstudio'),
        api_key=settings.get('api_key', 'not-needed'),
        base_url=settings.get('base_url', 'http://127.0.0.1:1234/v1'),
        model_name=settings.get('model_name', 'qwen2.5-coder-7b-instruct'),
        temperature=0.4,  # Start a bit higher for complex bugs
        max_tokens=settings.get('max_tokens', 5000),  # Use settings value
        timeout=settings.get('timeout', 120)  # Use settings timeout
    )
    
    print("📝 BUGGY CODE HAS:")
    print("   1. Visual confusion (Cl0ck vs Clock)")
    print("   2. Missing colon in for loop")
    print("   3. Indentation error in nested loop")
    print("   4. Type error (string vs int)")
    print("   5. Logic error (wrong divisor)")
    print()
    
    # Test original buggy code
    print("🧪 Testing original buggy code...")
    original_result = await test_code(BUGGY_CODE, 0)
    
    if original_result["success"]:
        print("   ⚠️  Original code works? This shouldn't happen!")
        print(f"   Output: {original_result['output']}")
        await client.close()
        return
    
    print(f"   ❌ Failed as expected")
    # Show first error
    error_lines = original_result['error'].split('\n')
    first_error = next((line for line in error_lines if 'Error' in line), error_lines[-1])
    print(f"   First error: {first_error}")
    print()
    
    # Healing loop
    current_code = BUGGY_CODE
    current_error = original_result['error']
    attempt_history = []
    
    for attempt in range(1, MAX_ATTEMPTS + 1):
        print("=" * 80)
        print(f"🔄 ATTEMPT #{attempt}/{MAX_ATTEMPTS}")
        print("=" * 80)
        
        # Build prompt - give more context for harder bugs
        context = f"This code has multiple bugs including syntax errors, type errors, and logic errors."
        
        if attempt == 1:
            prompt = f"""{context}

Fix ALL the bugs in this Python code:

```python
{current_code}
```

Error when running:
{current_error[:500]}

Important: Look for:
- Class name typos (O vs 0)
- Missing colons
- Indentation errors
- Type mismatches (string vs int)
- Logic errors

Respond with ONLY the fully corrected Python code, no explanations."""
        else:
            previous_errors = "\n".join([f"Attempt {i}: {att['test_result']['error'].split(chr(10))[-1][:100] if att['test_result']['error'] else 'passed'}" 
                                        for i, att in enumerate(attempt_history, 1)])
            
            prompt = f"""Previous {attempt-1} attempts failed. {context}

Current code:
```python
{current_code}
```

Current error:
{current_error[:500]}

Previous attempts had these errors:
{previous_errors}

Respond with ONLY the corrected code."""
        
        # Ask LLM for fix
        max_tokens_setting = settings.get('max_tokens', 5000)
        print(f"🤖 Asking LLM (temp={0.4 + (attempt * 0.1):.2f}, tokens={max_tokens_setting})...")
        
        try:
            response = await client.chat(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.4 + (attempt * 0.1),
                max_tokens=max_tokens_setting
            )
            
            if 'error' in response:
                print(f"   ❌ LLM error: {response['error']}")
                break
            
            fixed_code = response['content']
            
            # Clean markdown
            if '```python' in fixed_code:
                fixed_code = fixed_code.split('```python')[1].split('```')[0].strip()
            elif '```' in fixed_code:
                fixed_code = fixed_code.split('```')[1].split('```')[0].strip()
            
            print("   ✅ LLM generated fix")
            print(f"   Code length: {len(fixed_code)} chars (was {len(current_code)})")
            
        except Exception as e:
            print(f"   ❌ LLM call failed: {e}")
            break
        
        # Test the fix
        print("🧪 Testing fixed code...")
        test_result = await test_code(fixed_code, attempt)
        
        attempt_info = {
            "attempt_num": attempt,
            "timestamp": datetime.now().isoformat(),
            "code_length": len(fixed_code),
            "test_result": test_result
        }
        attempt_history.append(attempt_info)
        
        if test_result["success"]:
            print(f"   ✅ SUCCESS! Code runs correctly!")
            print(f"   Output:")
            for line in test_result['output'].split('\n')[:10]:
                print(f"      {line}")
            print()
            print("=" * 80)
            print("🎉 HEALING COMPLETE!")
            print("=" * 80)
            print()
            print(f"📊 FINAL STATISTICS:")
            print(f"   Total attempts needed: {attempt}")
            print(f"   Final temperature: {0.4 + (attempt * 0.1):.2f}")
            print(f"   Code changes: {len(current_code)} → {len(fixed_code)} chars")
            print()
            
            if attempt == 1:
                print("   ⚡ PERFECT! Fixed on first try despite multiple bugs!")
            elif attempt == 2:
                print("   👍 EXCELLENT! Fixed quickly with one retry")
            elif attempt <= 3:
                print("   👌 GOOD! Needed some iteration but converged")
            elif attempt <= 4:
                print("   ✓ ACCEPTABLE! Complex bugs required several attempts")
            else:
                print("   ⚠️ DIFFICULT! Took many iterations to fix all bugs")
            print()
            
            print("🔍 BUG ANALYSIS:")
            print(f"   Total bugs in original: 6")
            print(f"   Attempts to fix all: {attempt}")
            print(f"   Convergence rate: {6/attempt:.1f} bugs per attempt")
            print()
            
            break
        else:
            print(f"   ❌ Still failing")
            # Show the actual error
            error_lines = test_result['error'].split('\n')
            actual_error = next((line for line in error_lines if 'Error' in line), error_lines[-1])
            print(f"   Error: {actual_error}")
            print()
            
            # Update for next iteration
            current_code = fixed_code
            current_error = test_result['error']
            
            if attempt < MAX_ATTEMPTS:
                print(f"   🔄 Retrying... ({MAX_ATTEMPTS - attempt} attempts remaining)")
                print()
    else:
        # Max attempts reached
        print("=" * 80)
        print("❌ MAX ATTEMPTS REACHED - HEALING FAILED")
        print("=" * 80)
        print(f"Could not fix after {MAX_ATTEMPTS} attempts")
        print()
        print("📊 Attempt History:")
        for i, att in enumerate(attempt_history, 1):
            status = "✅" if att['test_result']['success'] else "❌"
            print(f"   Attempt {i}: {status}")
            if not att['test_result']['success'] and att['test_result']['error']:
                error_line = att['test_result']['error'].split('\n')[-1][:80]
                print(f"      Error: {error_line}")
        print()
        print("💡 INSIGHTS:")
        print("   - These bugs may be too complex for this model")
        print("   - Or the error messages aren't giving enough context")
        print("   - Or there's a semantic issue the LLM can't grasp")
        print("   - This data is valuable! We know the limits!")
    
    await client.close()


if __name__ == "__main__":
    asyncio.run(main())
