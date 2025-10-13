"""
Mid-range Healing Demo
Tests division by zero bug - more complex than syntax errors
"""

import os
import sys
import asyncio
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from clients.llm_client import LLMClient
from llm_settings import load_llm_settings
from envelope_storage import save_success_pattern


def print_section(title):
    print("\n" + "="*70)
    print(f"🔧 {title}")
    print("="*70)


def print_code(code, title="CODE"):
    print(f"\n📝 {title}:")
    print("-"*70)
    print(code)
    print("-"*70)


async def main():
    print_section("MID-RANGE COMPLEXITY HEALING DEMO")
    
    # The buggy code with division by zero
    buggy_code = '''def normalize_row(row):
    """Normalize heterogeneous data rows"""
    amount = row.get("amount") or (row.get("amount_cents", 0) // 100)
    ok = row.get("ok") or row.get("success", False)
    ccy = (row.get("currency") or "USD").upper()
    provider = row.get("provider") or row.get("source", "unknown")
    return {"amount": int(amount), "ok": bool(ok), "ccy": ccy, "provider": provider}


def collate(rows):
    """Aggregate normalized rows - BUG: No guard for empty input"""
    norm = [normalize_row(r) for r in rows]
    total = sum(r["amount"] for r in norm)
    n = len(norm)
    ok_count = sum(1 for r in norm if r["ok"])
    ok_ratio = ok_count / n  # BUG: Division by zero when rows is empty
    return {"total": total, "ok_ratio": ok_ratio, "n": n}


def test_collate_empty():
    """This will crash with division by zero"""
    result = collate([])  # Empty list causes division by zero
    print("Empty result:", result)
    return result


if __name__ == "__main__":
    test_collate_empty()'''
    
    print_code(buggy_code, "BUGGY CODE")
    
    # Load LLM settings
    print("\n🔌 Loading LLM settings from dashboard...")
    settings = load_llm_settings()
    print(f"   Provider: {settings['provider']}")
    print(f"   Base URL: {settings['base_url']}")
    print(f"   Model: {settings['model_name']}")
    
    # Initialize LLM client
    print("\n🤖 Initializing LLM client...")
    client = LLMClient(
        provider=settings["provider"],
        api_key=settings.get("api_key"),
        base_url=settings.get("base_url"),
        model_name=settings["model_name"],
        temperature=settings.get("temperature", 0.7),
        max_tokens=settings.get("max_tokens", 2000),
        timeout=settings.get("timeout", 60)
    )
    print("   ✅ Client ready")
    
    # Create healing prompt
    print("\n🩺 Asking LLM to fix the division by zero error...")
    
    error_message = "ZeroDivisionError: division by zero at line: ok_ratio = ok_count / n"
    
    prompt = f"""You are a code healing system. Fix this Python code that has a runtime error.

ERROR: {error_message}

BUGGY CODE:
{buggy_code}

Please provide ONLY the fixed code with proper guard clauses to handle empty input. 
The fix should prevent division by zero when the input list is empty.
Return only the corrected Python code, no explanations."""
    
    messages = [
        {"role": "user", "content": prompt}
    ]
    
    # Get LLM response
    response = await client.chat(messages)
    
    if "error" in response:
        print(f"   ❌ LLM error: {response['error']}")
        return False
    
    print("   ✅ LLM generated fix")
    
    # Extract fixed code
    fixed_code = response.get("content", "").strip()
    
    # Clean up the response (remove markdown if present)
    if "```python" in fixed_code:
        fixed_code = fixed_code.split("```python")[1].split("```")[0].strip()
    elif "```" in fixed_code:
        fixed_code = fixed_code.split("```")[1].split("```")[0].strip()
    
    print_code(fixed_code, "FIXED CODE")
    
    # Test the fixed code
    print("\n🧪 Testing the fixed code...")
    try:
        # Write fixed code to temporary file and test it
        with open("temp_fixed_code.py", "w") as f:
            f.write(fixed_code)
        
        # Import and test
        import importlib.util
        spec = importlib.util.spec_from_file_location("temp_fixed", "temp_fixed_code.py")
        temp_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(temp_module)
        
        # Test with empty input (should not crash now)
        result = temp_module.test_collate_empty()
        print(f"   ✅ Code runs successfully!")
        print(f"   Output: {result}")
        
        # Clean up
        os.remove("temp_fixed_code.py")
        
        # Save success pattern
        print("\n💾 Recording success pattern in database...")
        pattern_data = {
            "error_type": "ZeroDivisionError",
            "error_message": error_message,
            "original_code": buggy_code[:200] + "..." if len(buggy_code) > 200 else buggy_code,
            "fixed_code": fixed_code[:200] + "..." if len(fixed_code) > 200 else fixed_code,
            "fix_description": "Added guard clause for empty input to prevent division by zero",
            "complexity": "mid-range",
            "model_used": settings["model_name"]
        }
        
        success = save_success_pattern(pattern_data)
        if success:
            print("   ✅ Success pattern saved!")
        else:
            print("   ⚠️ Could not save success pattern")
        
        print_section("HEALING CYCLE COMPLETE!")
        print("\n📊 Check your dashboard at http://127.0.0.1:5000")
        print("   - Click '🧠 Knowledge Base' to see the new pattern")
        print("   - Pattern count should have increased")
        print("   - Auto-refresh happens every 10 seconds")
        
        return True
        
    except Exception as e:
        print(f"   ❌ Fixed code still has issues: {e}")
        if os.path.exists("temp_fixed_code.py"):
            os.remove("temp_fixed_code.py")
        return False


if __name__ == "__main__":
    asyncio.run(main())