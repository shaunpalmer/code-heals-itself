"""
PHP Nightmare Test Runner - Semantic/Logic Bug Cascade
=======================================================

Python version of the PHP nightmare scenario:
- Class name mismatch (PaymentsAdapter vs PaymentAdapter)  
- Singleton pattern violated (direct instantiation)
- Null object pattern masking failures
- Mixed data schemas from providers
- Division by zero in aggregation

Expected: Multiple healing attempts needed
"""

import sys
import os
import subprocess
import tempfile
import asyncio
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from clients.llm_client import LLMClient
from llm_settings import load_llm_settings


BUGGY_CODE = '''
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
            normalized.append({'amount': amount, 'ok': ok, 'provider': provider, 'currency': currency})
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
    print(f"Final: {result}")
'''


def validate_fix(code):
    """Run code and check if it works"""
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
        
        success = (
            result.returncode == 0 and
            'TOTAL=$' in result.stdout and
            'ZeroDivisionError' not in result.stderr
        )
        
        return {
            'success': success,
            'exit_code': result.returncode,
            'stdout': result.stdout,
            'stderr': result.stderr
        }
    except Exception as e:
        return {'success': False, 'exit_code': -1, 'stdout': '', 'stderr': str(e)}
    finally:
        try:
            os.unlink(temp_path)
        except:
            pass


def create_prompt(code, attempt_num, prev_error=""):
    prompt = f"""Debug this Python code with SEMANTIC bugs (not syntax errors).

Bugs to fix:
1. Class name mismatch - PaymentsAdapter vs PaymentAdapter
2. Singleton violated - direct __init__ instead of get_instance()
3. NullAdapter silently masks failures
4. Mixed schemas - amount vs amount_cents, ok vs success
5. Division by zero when empty list
6. Currency case - USD vs usd

BUGGY CODE:
```python
{code}
```
"""
    
    if attempt_num > 1:
        prompt += f"\nATTEMPT {attempt_num}: Previous error:\n{prev_error}\n"
    
    prompt += "\nProvide ONLY the complete fixed code, no explanations."
    return prompt


def main():
    print("="*70)
    print("PHP NIGHTMARE TEST - Semantic Bug Cascade")
    print("="*70)
    print("\nBugs:")
    print("  1. Class name mismatch")
    print("  2. Singleton pattern violated") 
    print("  3. NullAdapter masks failures")
    print("  4. Mixed data schemas")
    print("  5. Division by zero")
    print("  6. Import issues")
    print("="*70)
    
    asyncio.run(run_test())


async def run_test():
    MAX_ATTEMPTS = 12
    settings = load_llm_settings()
    
    client = LLMClient(
        provider=settings.get('provider', 'lmstudio'),
        api_key=settings.get('api_key', 'not-needed'),
        base_url=settings.get('base_url', 'http://127.0.0.1:1234/v1'),
        model_name=settings.get('model_name', 'qwen2.5-coder-7b-instruct'),
        temperature=0.5,
        max_tokens=settings.get('max_tokens', 4000),
        timeout=settings.get('timeout', 120)
    )
    
    print("\nInitial validation:")
    initial = validate_fix(BUGGY_CODE)
    print(f"  Status: {'PASS' if initial['success'] else 'FAIL'}")
    if initial['stderr']:
        print(f"  Error: {initial['stderr'][:150]}")
    
    current_code = BUGGY_CODE
    prev_error = ""
    
    for attempt in range(1, MAX_ATTEMPTS + 1):
        print(f"\n{'='*70}")
        print(f"ATTEMPT {attempt}/{MAX_ATTEMPTS}")
        print(f"{'='*70}")
        
        temp = 0.5 + (attempt - 1) * 0.1
        print(f"Temperature: {temp:.2f}")
        
        prompt = create_prompt(current_code, attempt, prev_error)
        
        print("Calling LLM...")
        try:
            response = await client.chat(
                messages=[{"role": "user", "content": prompt}],
                temperature=temp,
                max_tokens=2500
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
                print(f"Output: {test_result['stdout'][:200]}")
            if test_result['stderr']:
                print(f"Errors: {test_result['stderr'][:200]}")
            
            if test_result['success']:
                print(f"\n{'='*70}")
                print(f"SUCCESS ON ATTEMPT {attempt}!")
                print(f"{'='*70}")
                if attempt == 1:
                    print("\nPERFECT! Fixed all semantic bugs on first try!")
                else:
                    print(f"\nConverged after {attempt} attempts")
                await client.close()
                return {'success': True, 'attempts': attempt}
            
            current_code = fixed_code
            prev_error = test_result['stderr'] or 'Failed validation'
            
        except Exception as e:
            print(f"ERROR: {e}")
            prev_error = str(e)
    
    print(f"\n{'='*70}")
    print(f"EXHAUSTED ALL {MAX_ATTEMPTS} ATTEMPTS")
    print(f"{'='*70}")
    await client.close()
    return {'success': False, 'attempts': MAX_ATTEMPTS}


if __name__ == "__main__":
    result = main()
    print(f"\nFinal: {result}")
