"""
FULL END-TO-END HEALING CYCLE DEMO
===================================
Demonstrates: Buggy Code → LLM Fix → Validation → Dashboard Update

This is the REAL DEAL:
1. Load buggy code (intentional syntax error)
2. Call LLM (via unified client) to generate fix
3. Test the fixed code
4. Record success pattern in database
5. Dashboard auto-refreshes with live data

Watch: http://127.0.0.1:5000
"""

import sys
import asyncio
import subprocess
from pathlib import Path

# Add paths
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent / "clients"))
sys.path.insert(0, str(Path(__file__).parent / "utils" / "python"))

from llm_client import LLMClient
from envelope_storage import get_envelope_storage
from llm_settings import load_llm_settings
import json

BUGGY_CODE = """
# Intentional syntax error for demo
def calculate_sum()
    numbers = [1, 2, 3, 4, 5]
    return sum(numbers)

if __name__ == "__main__":
    result = calculate_sum()
    print(f"Sum: {result}")
"""

EXPECTED_ERROR = "SyntaxError: invalid syntax (missing colon)"

async def main():
    print("=" * 70)
    print("🔧 FULL HEALING CYCLE DEMO")
    print("=" * 70)
    print()
    
    # Step 1: Show the buggy code
    print("📝 BUGGY CODE:")
    print("-" * 70)
    print(BUGGY_CODE)
    print("-" * 70)
    print()
    
    # Step 2: Load LLM settings from dashboard
    print("🔌 Loading LLM settings from dashboard...")
    settings = load_llm_settings()
    
    if not settings.get('enabled'):
        print("❌ LLM is disabled in settings! Please enable it in dashboard.")
        return
    
    provider = settings.get('provider', 'lmstudio')
    base_url = settings.get('base_url', 'http://127.0.0.1:1234/v1')
    model = settings.get('model_name', 'qwen2.5-coder-7b-instruct')
    api_key = settings.get('api_key', 'not-needed')
    
    print(f"   Provider: {provider}")
    print(f"   Base URL: {base_url}")
    print(f"   Model: {model}")
    print()
    
    # Step 3: Initialize LLM client
    print("🤖 Initializing LLM client...")
    client = LLMClient(
        provider=provider,
        api_key=api_key,
        base_url=base_url,
        model_name=model,
        temperature=0.3,  # Lower for more deterministic fixes
        max_tokens=500
    )
    print("   ✅ Client ready")
    print()
    
    # Step 4: Ask LLM to fix the code
    print("🩺 Asking LLM to fix the syntax error...")
    
    prompt = f"""You are a Python code fixer. Fix this syntax error:

```python
{BUGGY_CODE}
```

Error: {EXPECTED_ERROR}

Respond ONLY with the fixed code, no explanations. Just the corrected Python code."""

    try:
        response = await client.chat(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=500
        )
        
        if 'error' in response:
            print(f"   ❌ LLM error: {response['error']}")
            await client.close()
            return
        
        fixed_code = response['content']
        
        # Clean up markdown code blocks if present
        if '```python' in fixed_code:
            fixed_code = fixed_code.split('```python')[1].split('```')[0].strip()
        elif '```' in fixed_code:
            fixed_code = fixed_code.split('```')[1].split('```')[0].strip()
        
        print("   ✅ LLM generated fix")
        print()
        print("🔧 FIXED CODE:")
        print("-" * 70)
        print(fixed_code)
        print("-" * 70)
        print()
        
    except Exception as e:
        print(f"   ❌ LLM call failed: {e}")
        return
    
    # Step 5: Test the fixed code
    print("🧪 Testing the fixed code...")
    
    # Save to temp file and try to run it
    test_file = Path("temp_test_fixed.py")
    test_file.write_text(fixed_code)
    
    try:
        result = subprocess.run(
            [sys.executable, str(test_file)],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0:
            print("   ✅ Code runs successfully!")
            print(f"   Output: {result.stdout.strip()}")
            success = True
        else:
            print(f"   ❌ Code still has errors:")
            print(f"   {result.stderr}")
            success = False
            
    except Exception as e:
        print(f"   ❌ Test execution failed: {e}")
        success = False
    finally:
        # Cleanup
        if test_file.exists():
            test_file.unlink()
    
    print()
    
    # Step 6: Record success pattern in database
    if success:
        print("💾 Recording success pattern in database...")
        storage = get_envelope_storage()
        
        storage.save_success_pattern(
            error_code="SYN.MISSING_COLON",
            cluster_id="SYN.MISSING_COLON:function_def",
            fix_description="Add missing colon after function definition",
            fix_diff="- def calculate_sum()\n+ def calculate_sum():",
            confidence=0.95
        )
        
        print("   ✅ Success pattern saved!")
        print()
        print("=" * 70)
        print("🎉 HEALING CYCLE COMPLETE!")
        print("=" * 70)
        print()
        print("📊 Check your dashboard at http://127.0.0.1:5000")
        print("   - Click '🧠 Knowledge Base' to see the new pattern")
        print("   - Pattern count should have increased")
        print("   - Auto-refresh happens every 10 seconds")
        print()
    else:
        print("=" * 70)
        print("❌ HEALING FAILED")
        print("=" * 70)
        print("The LLM-generated fix didn't work. This data is still valuable!")
        print()
    
    # Cleanup
    await client.close()

if __name__ == "__main__":
    asyncio.run(main())
