"""
ITERATIVE HEALING DEMO - Shows retry loop with attempt tracking
================================================================

This demo intentionally uses a HARDER bug that might require multiple attempts:
- Runtime error (NameError) - missing import
- Forces LLM to iterate if first fix isn't perfect

Tracks:
- Attempt count
- What LLM tried each iteration
- Success/failure of each attempt
- Final convergence
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

# Harder bug - missing import AND logic error
BUGGY_CODE = """
import sys

def process_data():
    # Bug 1: Using pandas without importing it
    df = pandas.DataFrame({'x': [1, 2, 3]})
    return df

def calculate_stats(data):
    # Bug 2: Wrong method name
    return data.summ()  # Should be sum()

if __name__ == "__main__":
    data = process_data()
    result = calculate_stats(data)
    print(f"Total: {result}")
"""

MAX_ATTEMPTS = 5

async def test_code(code: str, attempt_num: int) -> dict:
    """Test if code runs successfully"""
    test_file = Path(f"temp_test_attempt_{attempt_num}.py")
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
    print("=" * 70)
    print("🔄 ITERATIVE HEALING DEMO - Retry Loop with Tracking")
    print("=" * 70)
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
        temperature=0.3,
        max_tokens=1000
    )
    
    print("📝 BUGGY CODE:")
    print("-" * 70)
    print(BUGGY_CODE)
    print("-" * 70)
    print()
    
    # Test original buggy code
    print("🧪 Testing original buggy code...")
    original_result = await test_code(BUGGY_CODE, 0)
    if original_result["success"]:
        print("   ⚠️  Original code works? This shouldn't happen!")
        return
    
    print(f"   ❌ Failed as expected")
    print(f"   Error: {original_result['error'][:200]}")
    print()
    
    # Healing loop
    current_code = BUGGY_CODE
    current_error = original_result['error']
    attempt_history = []
    
    for attempt in range(1, MAX_ATTEMPTS + 1):
        print("=" * 70)
        print(f"🔄 ATTEMPT #{attempt}")
        print("=" * 70)
        
        # Build prompt with context
        if attempt == 1:
            prompt = f"""Fix this Python code that has errors:

```python
{current_code}
```

Error when running:
{current_error}

Respond with ONLY the corrected Python code, no explanations."""
        else:
            # Include previous attempts in context
            prompt = f"""Previous attempt didn't work. Fix this code:

```python
{current_code}
```

Current error:
{current_error}

Previous attempts: {attempt - 1}
Respond with ONLY the corrected code."""
        
        # Ask LLM for fix
        print(f"🤖 Asking LLM for fix (attempt {attempt})...")
        
        try:
            response = await client.chat(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3 + (attempt * 0.1),  # Increase temp on retries
                max_tokens=1000
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
            print()
            print("   Fixed code preview:")
            lines = fixed_code.split('\n')
            for i, line in enumerate(lines[:10], 1):
                print(f"      {i:2d} | {line}")
            if len(lines) > 10:
                print(f"      ... ({len(lines) - 10} more lines)")
            print()
            
        except Exception as e:
            print(f"   ❌ LLM call failed: {e}")
            break
        
        # Test the fix
        print("🧪 Testing fixed code...")
        test_result = await test_code(fixed_code, attempt)
        
        attempt_info = {
            "attempt_num": attempt,
            "timestamp": datetime.now().isoformat(),
            "llm_response_length": len(fixed_code),
            "test_result": test_result
        }
        attempt_history.append(attempt_info)
        
        if test_result["success"]:
            print(f"   ✅ SUCCESS! Code runs correctly!")
            print(f"   Output: {test_result['output']}")
            print()
            print("=" * 70)
            print("🎉 HEALING COMPLETE!")
            print("=" * 70)
            print()
            print(f"📊 Statistics:")
            print(f"   Total attempts: {attempt}")
            print(f"   Final temperature: {0.3 + (attempt * 0.1):.2f}")
            print(f"   Success rate: {1}/{attempt} = {100/attempt:.1f}%")
            print()
            print("📝 Attempt History:")
            for i, att in enumerate(attempt_history, 1):
                status = "✅ SUCCESS" if att['test_result']['success'] else "❌ FAILED"
                print(f"   Attempt {i}: {status}")
                if not att['test_result']['success'] and att['test_result']['error']:
                    error_preview = att['test_result']['error'].split('\n')[-1][:60]
                    print(f"      Error: {error_preview}")
            print()
            
            # Show the convergence
            print("🔍 Convergence Analysis:")
            print(f"   Attempts needed: {attempt}")
            if attempt == 1:
                print("   ⚡ Perfect! Fixed on first try!")
            elif attempt <= 2:
                print("   👍 Good! Fixed quickly with minimal iteration")
            elif attempt <= 3:
                print("   👌 Acceptable! Some iteration needed")
            else:
                print("   ⚠️  Took several tries - complex fix or ambiguous error")
            print()
            
            break
        else:
            print(f"   ❌ Still failing")
            print(f"   Error: {test_result['error'][:200]}")
            print()
            
            # Update for next iteration
            current_code = fixed_code
            current_error = test_result['error']
            
            if attempt < MAX_ATTEMPTS:
                print(f"   🔄 Retrying with updated context... ({MAX_ATTEMPTS - attempt} attempts left)")
                print()
    else:
        # Max attempts reached
        print("=" * 70)
        print("❌ MAX ATTEMPTS REACHED")
        print("=" * 70)
        print(f"Failed to fix after {MAX_ATTEMPTS} attempts")
        print()
        print("📝 Attempt History:")
        for i, att in enumerate(attempt_history, 1):
            print(f"   Attempt {i}: ❌ FAILED")
            if att['test_result']['error']:
                error_line = att['test_result']['error'].split('\n')[-1]
                print(f"      {error_line}")
        print()
        print("💡 This data is still valuable! We learned what DOESN'T work.")
        print("   Could be: complex bug, ambiguous error, or LLM limitations")
    
    await client.close()


if __name__ == "__main__":
    asyncio.run(main())
