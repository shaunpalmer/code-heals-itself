"""
🔥 PHP Nightmare Test Runner
=============================

Converts the PHP autoload/singleton/null-object nightmare into Python
and feeds it to the AI healing system.

This is a SEMANTIC nightmare - no syntax errors, but:
- Class name mismatch (PaymentsAdapter vs PaymentAdapter)  
- Singleton pattern violated (direct instantiation)
- Null object pattern masking failures
- Mixed data schemas from providers
- Division by zero in aggregation
- Import/module resolution issues

Expected: 3-6 healing attempts
"""

import sys
import os
import json
import subprocess
import tempfile
from datetime import datetime
from typing import Dict, List, Any

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from clients.llm_client import LLMClient
from llm_settings import load_llm_settings


# The buggy code from test_php_nightmare_python.py
BUGGY_CODE = '''"""
PHP Nightmare Scenario converted to Python
"""

from typing import Protocol, List, Dict, Any


class PaymentPort(Protocol):
    def fetch_settlements(self) -> List[Dict[str, Any]]:
        ...


class PaymentsAdapter:
    _instance = None
    
    def __init__(self):
        pass
    
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls.__new__(cls)
        return cls._instance
    
    def fetch_settlements(self) -> List[Dict[str, Any]]:
        return [
            {'amount': 1200, 'currency': 'USD', 'ok': True, 'provider': 'A'},
            {'amount': -120, 'currency': 'USD', 'ok': False, 'provider': 'B'},
            {'amount_cents': 3000, 'currency': 'usd', 'success': True, 'source': 'C'},
        ]


class NullAdapter:
    def fetch_settlements(self) -> List[Dict[str, Any]]:
        return []


class ServiceRegistry:
    @staticmethod
    def payment() -> PaymentPort:
        try:
            from __main__ import PaymentAdapter
            return PaymentAdapter()
        except (ImportError, AttributeError):
            return NullAdapter()


class SettlementAggregator:
    @staticmethod
    def collate(port: PaymentPort) -> Dict[str, Any]:
        rows = port.fetch_settlements()
        
        normalized = []
        for r in rows:
            amount = r.get('amount', r.get('amount_cents', 0))
            if 'amount_cents' in r:
                amount = amount / 100
            ok = r.get('ok', r.get('success', False))
            provider = r.get('provider', r.get('source', 'unknown'))
            currency = r.get('currency', 'USD')
            
            normalized.append({
                'amount': amount,
                'ok': ok,
                'provider': provider,
                'currency': currency
            })
        
        total = sum(item['amount'] for item in normalized)
        denom = len(normalized)
        ok_count = sum(1 for item in normalized if item['ok'])
        ok_ratio = ok_count / denom
        
        return {'total': total, 'ok_ratio': ok_ratio}


def run_payment_aggregation():
    port = ServiceRegistry.payment()
    result = SettlementAggregator.collate(port)
    print(f"TOTAL=${result['total']:.2f} OK_RATIO={result['ok_ratio']:.2%}")
    return result


if __name__ == "__main__":
    result = run_payment_aggregation()
    print(f"Final result: {result}")
'''


def validate_fix(code: str) -> Dict[str, Any]:
    """Run the code and check if it produces correct output"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(code)
        temp_path = f.name
    
    try:
        result = subprocess.run(
            [sys.executable, temp_path],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        output = result.stdout
        error = result.stderr
        
        # Check for expected output pattern
        success = (
            result.returncode == 0 and
            'TOTAL=$' in output and
            'OK_RATIO=' in output and
            'ZeroDivisionError' not in error and
            'ImportError' not in error and
            'AttributeError' not in error
        )
        
        # Expected: TOTAL around $11-40, OK_RATIO around 50-100%
        # (depends on how the fix handles the data)
        
        return {
            'success': success,
            'exit_code': result.returncode,
            'stdout': output,
            'stderr': error,
            'validation': 'Output looks correct' if success else 'Still has errors'
        }
        
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'exit_code': -1,
            'stdout': '',
            'stderr': 'Timeout - possible infinite loop',
            'validation': 'Code timed out'
        }
    except Exception as e:
        return {
            'success': False,
            'exit_code': -1,
            'stdout': '',
            'stderr': str(e),
            'validation': f'Validation error: {e}'
        }
    finally:
        try:
            os.unlink(temp_path)
        except:
            pass


def create_healing_prompt(code: str, attempt_num: int, previous_error: str = "") -> str:
    """Create a detailed prompt for the LLM"""
    
    base_prompt = f"""You are debugging Python code that has SEMANTIC and LOGIC bugs (not syntax errors).

This code attempts to:
1. Implement a singleton pattern for PaymentsAdapter
2. Use a service registry to resolve dependencies
3. Aggregate payment settlements from multiple providers with different data schemas
4. Calculate totals and success ratios

Known bug types in this code:
- CLASS NAMING: Class name doesn't match what's being imported
- SINGLETON VIOLATION: Direct instantiation instead of using get_instance()
- NULL OBJECT SHADOWING: Silent fallback to NullAdapter masks real failures
- DATA NORMALIZATION: Mixed schemas (amount vs amount_cents, ok vs success, provider vs source)
- CURRENCY HANDLING: Case sensitivity (USD vs usd)
- DIVISION BY ZERO: When NullAdapter returns empty list
- IMPORT/MODULE: Trying to import PaymentAdapter when class is PaymentsAdapter

BUGGY CODE:
```python
{code}
```
"""

    if attempt_num > 1 and previous_error:
        base_prompt += f"""

ATTEMPT {attempt_num}: Previous attempt failed with:
{previous_error}

Please analyze the REMAINING bugs and provide a MORE COMPLETE fix.
"""
    
    base_prompt += """

Provide ONLY the complete fixed Python code, no explanations.
Fix ALL the issues:
1. Class name should match import (PaymentAdapter everywhere OR PaymentsAdapter everywhere)
2. Make singleton constructor private (prefix with _) and use get_instance()
3. Add logging when falling back to NullAdapter
4. Properly normalize data (convert cents, uppercase currency, handle both field names)
5. Guard against division by zero in aggregation
6. Ensure imports work correctly
"""
    
    return base_prompt


def run_php_nightmare_test():
    """Main test execution"""
    
    print("=" * 70)
    print("PHP NIGHTMARE TEST - Semantic/Logic Bug Cascade")
    print("=" * 70)
    print("\nBug Summary:")
    print("  1. Class name mismatch (PaymentsAdapter vs PaymentAdapter)")
    print("  2. Singleton pattern violated (direct __init__ call)")
    print("  3. NullAdapter silently masks import failures")
    print("  4. Mixed data schemas across 3 providers")
    print("  5. Division by zero when NullAdapter active")
    print("  6. Currency case inconsistency (USD vs usd)")
    print("  7. Cents not converted to dollars properly")
    print("  8. Import system semantics")
    print("\n" + "=" * 70)
    
    # Configuration
    MAX_ATTEMPTS = 6
    BASE_TEMPERATURE = 0.5
    MAX_TOKENS = 2500
    
    # Load LLM settings
    settings = load_llm_settings()
    provider = settings.get('provider', 'lmstudio')
    api_key = settings.get('api_key', 'not-needed')
    base_url = settings.get('base_url', 'http://127.0.0.1:1234/v1')
    model = settings.get('model', 'qwen2.5-coder-7b-instruct')
    
    # Initialize
    llm_client = LLMClient(
        provider=provider,
        api_key=api_key,
        base_url=base_url,
        model_name=model,
        temperature=BASE_TEMPERATURE,
        max_tokens=MAX_TOKENS
    )
    attempts_history: List[Dict[str, Any]] = []
    
    current_code = BUGGY_CODE
    previous_error = ""
    
    print(f"\n🧪 Testing with LM Studio on http://127.0.0.1:1234")
    print(f"📊 Max attempts: {MAX_ATTEMPTS}, Starting temperature: {BASE_TEMPERATURE}")
    print(f"🎯 Target: Fix all 8+ bugs")
    print("=" * 70)
    
    # First validation (should fail)
    print("\n🔍 INITIAL VALIDATION:")
    initial_result = validate_fix(BUGGY_CODE)
    print(f"   Status: {'✅ PASS' if initial_result['success'] else '❌ FAIL'}")
    print(f"   Exit code: {initial_result['exit_code']}")
    if initial_result['stderr']:
        print(f"   Error: {initial_result['stderr'][:200]}")
    if initial_result['stdout']:
        print(f"   Output: {initial_result['stdout'][:200]}")
    
    # Healing loop
    for attempt in range(1, MAX_ATTEMPTS + 1):
        print(f"\n{'=' * 70}")
        print(f"🔧 ATTEMPT {attempt}/{MAX_ATTEMPTS}")
        print(f"{'=' * 70}")
        
        # Adjust temperature
        temperature = BASE_TEMPERATURE + (attempt - 1) * 0.1
        print(f"🌡️  Temperature: {temperature:.2f}")
        
        # Create prompt
        prompt = create_healing_prompt(current_code, attempt, previous_error)
        
        # Call LLM
        print(f"📡 Sending to LLM... (code length: {len(current_code)} chars)")
        
        try:
            response = llm_client.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
                max_tokens=MAX_TOKENS
            )
            
            fixed_code = response.strip()
            
            # Extract code from markdown if needed
            if '```python' in fixed_code:
                fixed_code = fixed_code.split('```python')[1].split('```')[0].strip()
            elif '```' in fixed_code:
                fixed_code = fixed_code.split('```')[1].split('```')[0].strip()
            
            print(f"✅ LLM responded ({len(fixed_code)} chars)")
            
            # Validate
            print(f"🧪 Validating fix...")
            test_result = validate_fix(fixed_code)
            
            # Record attempt
            attempt_record = {
                'attempt_num': attempt,
                'timestamp': datetime.now().isoformat(),
                'temperature': temperature,
                'code_length': len(fixed_code),
                'test_result': test_result
            }
            attempts_history.append(attempt_record)
            
            # Display result
            print(f"\n📊 VALIDATION RESULT:")
            print(f"   Success: {'✅ YES' if test_result['success'] else '❌ NO'}")
            print(f"   Exit code: {test_result['exit_code']}")
            
            if test_result['stdout']:
                print(f"   Output: {test_result['stdout'][:300]}")
            
            if test_result['stderr']:
                print(f"   Errors: {test_result['stderr'][:300]}")
            
            if test_result['success']:
                print(f"\n{'=' * 70}")
                print(f"🎉 SUCCESS ON ATTEMPT {attempt}!")
                print(f"{'=' * 70}")
                
                if attempt == 1:
                    print("\n⚡ PERFECT! Fixed on first try despite semantic complexity!")
                else:
                    print(f"\n✨ Converged after {attempt} attempts")
                
                print(f"\n📈 FINAL STATS:")
                print(f"   Total attempts: {attempt}")
                print(f"   Final temperature: {temperature:.2f}")
                print(f"   Code size: {len(BUGGY_CODE)} → {len(fixed_code)} chars")
                
                return {
                    'success': True,
                    'attempts': attempt,
                    'history': attempts_history,
                    'fixed_code': fixed_code
                }
            
            # Update for next iteration
            current_code = fixed_code
            previous_error = test_result['stderr'] if test_result['stderr'] else test_result.get('validation', '')
            
            print(f"\n⏭️  Will retry with adjusted approach...")
            
        except Exception as e:
            print(f"\n❌ LLM Error: {e}")
            attempt_record = {
                'attempt_num': attempt,
                'timestamp': datetime.now().isoformat(),
                'temperature': temperature,
                'error': str(e)
            }
            attempts_history.append(attempt_record)
    
    # All attempts exhausted
    print(f"\n{'=' * 70}")
    print(f"⚠️  EXHAUSTED ALL {MAX_ATTEMPTS} ATTEMPTS")
    print(f"{'=' * 70}")
    print(f"\n📊 This test proved too difficult - found the limits!")
    
    return {
        'success': False,
        'attempts': MAX_ATTEMPTS,
        'history': attempts_history,
        'message': 'All attempts exhausted - bugs too complex'
    }


if __name__ == "__main__":
    result = run_php_nightmare_test()
    
    print(f"\n{'=' * 70}")
    print("📋 FINAL SUMMARY")
    print(f"{'=' * 70}")
    print(json.dumps(result, indent=2, default=str))
