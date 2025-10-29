"""
Multi-Attempt Logic Test Runner
================================
Tests complex logic bugs that should require multiple healing attempts

WITH DYNAMIC MODEL ESCALATION:
- Monitors circuit breaker signals during healing
- Auto-escalates to smarter models when stuck
- Observer pattern notifies of escalations
"""

import sys
import os
import subprocess
import tempfile
import asyncio

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from clients.llm_client import LLMClient
from llm_settings import load_llm_settings
from utils.model_escalation import ModelEscalationDecider, ModelEscalationObserver

# Read the buggy code
with open('test_multi_attempt_logic.py', 'r') as f:
    BUGGY_CODE = f.read()


def validate_fix(code):
    """Run the code and check if all tests pass"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(code)
        temp_path = f.name
    
    try:
        result = subprocess.run(
            [sys.executable, temp_path],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        stdout = result.stdout
        stderr = result.stderr
        
        # Success means exit code 0 and "TOTAL FAILURES: 0"
        success = (
            result.returncode == 0 and
            'TOTAL FAILURES: 0' in stdout
        )
        
        # Count failures
        failures = 0
        if 'TOTAL FAILURES:' in stdout:
            try:
                failures = int(stdout.split('TOTAL FAILURES:')[1].strip().split()[0])
            except:
                pass
        
        return {
            'success': success,
            'exit_code': result.returncode,
            'stdout': stdout,
            'stderr': stderr,
            'failures': failures
        }
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'exit_code': -1,
            'stdout': '',
            'stderr': 'Timeout',
            'failures': 999
        }
    except Exception as e:
        return {
            'success': False,
            'exit_code': -1,
            'stdout': '',
            'stderr': str(e),
            'failures': 999
        }
    finally:
        try:
            os.unlink(temp_path)
        except:
            pass


def create_prompt(code, attempt_num, prev_result=None):
    """Create healing prompt - minimal hints"""
    
    prompt = f"""Fix the logic bugs in this Python code. The code has built-in tests that are currently failing.

CODE:
```python
{code}
```
"""
    
    if attempt_num > 1 and prev_result:
        prompt += f"""

ATTEMPT {attempt_num}: Previous attempt had {prev_result.get('failures', '?')} test failures.

Previous output:
{prev_result.get('stdout', '')[:500]}

Previous errors:
{prev_result.get('stderr', '')[:500]}

Analyze the test failures and fix the remaining bugs.
"""
    
    prompt += "\n\nProvide ONLY the complete fixed Python code, no explanations."
    return prompt


async def run_test():
    print("=" * 70)
    print("MULTI-ATTEMPT LOGIC TEST WITH DYNAMIC MODEL ESCALATION")
    print("=" * 70)
    print("\nThis code has 7+ logic bugs (no syntax errors):")
    print("  - FX cache key/TTL issues")
    print("  - Rounding accumulation errors")
    print("  - Off-by-one comparisons")
    print("  - Timezone/datetime handling")
    print("  - String vs numeric sorting")
    print("  - Truthiness traps")
    print("  - Division by zero")
    print("\n🧠 System will auto-escalate to smarter models if circuit breaker signals stagnation")
    print("=" * 70)
    
    MAX_ATTEMPTS = 6
    BASE_TEMP = 0.4
    
    settings = load_llm_settings()
    # Start with 32B model (from phase 6 optimization)
    base_model_name = settings.get('model_name', 'qwen3-32b')
    if base_model_name in ['qwen2.5-coder-7b-instruct']:
        base_model_name = 'qwen3-32b'
    
    # Initialize escalation observer and decider
    observer = ModelEscalationObserver()
    escalation_decider = ModelEscalationDecider(observer)
    current_model = base_model_name
    
    client = LLMClient(
        provider=settings.get('provider', 'lmstudio'),
        api_key=settings.get('api_key', 'not-needed'),
        base_url=settings.get('base_url', 'http://127.0.0.1:1234/v1'),
        model_name=current_model,
        temperature=BASE_TEMP,
        max_tokens=3000,
        timeout=120  # Longer timeout for bigger models
    )
    
    print("\nInitial validation:")
    initial = validate_fix(BUGGY_CODE)
    print(f"  Status: {'PASS' if initial['success'] else 'FAIL'}")
    print(f"  Failures: {initial['failures']}/7 tests")
    if initial['stdout']:
        lines = initial['stdout'].split('\n')
        for line in lines[:15]:
            if line.strip():
                print(f"  {line}")
    
    current_code = BUGGY_CODE
    prev_result = initial
    attempts_log = []
    
    for attempt in range(1, MAX_ATTEMPTS + 1):
        print(f"\n{'=' * 70}")
        print(f"ATTEMPT {attempt}/{MAX_ATTEMPTS}")
        print(f"{'=' * 70}")
        
        temp = BASE_TEMP + (attempt - 1) * 0.15
        print(f"Temperature: {temp:.2f}")
        print(f"Previous failures: {prev_result.get('failures', '?')}/7")
        
        prompt = create_prompt(current_code, attempt, prev_result)
        
        print(f"\nSending to LLM ({len(current_code)} chars)...")
        
        try:
            response = await client.chat(
                messages=[{"role": "user", "content": prompt}],
                temperature=temp,
                max_tokens=3000
            )
            
            if 'error' in response:
                print(f"LLM error: {response['error']}")
                if response.get('error_type'):
                    print(f"LLM error type: {response['error_type']}")
                if response.get('traceback'):
                    print("LLM traceback (truncated):")
                    print(response['traceback'][:500])
                if response['error'] == "":
                    print(f"LLM full error payload: {response}")
                attempts_log.append({
                    'attempt': attempt,
                    'temp': temp,
                    'error': response['error'],
                    'error_type': response.get('error_type')
                })
                continue
            
            fixed_code = response['content']
            
            if '```python' in fixed_code:
                fixed_code = fixed_code.split('```python')[1].split('```')[0].strip()
            elif '```' in fixed_code:
                fixed_code = fixed_code.split('```')[1].split('```')[0].strip()
            
            print(f"LLM responded ({len(fixed_code)} chars)")
            
            print("Validating fix...")
            test_result = validate_fix(fixed_code)
            
            print(f"\nResult: {'SUCCESS' if test_result['success'] else 'PARTIAL FIX'}")
            print(f"Exit code: {test_result['exit_code']}")
            print(f"Test failures: {test_result['failures']}/7")
            
            if test_result['stdout']:
                lines = test_result['stdout'].split('\n')
                for line in lines[:15]:
                    if '[PASS]' in line or '[FAIL]' in line or 'TOTAL' in line:
                        print(f"  {line}")
            
            attempts_log.append({
                'attempt': attempt,
                'temp': temp,
                'failures': test_result['failures'],
                'success': test_result['success']
            })
            
            if test_result['success']:
                print(f"\n{'=' * 70}")
                print(f"SUCCESS ON ATTEMPT {attempt}!")
                print(f"{'=' * 70}")
                
                if attempt == 1:
                    print("\nAmazing! Fixed all 7+ logic bugs on first try!")
                elif attempt == 2:
                    print("\nGreat! Converged on second attempt.")
                else:
                    print(f"\nConverged after {attempt} attempts - iterative healing worked!")
                
                print(f"\nConvergence path:")
                for log in attempts_log:
                    print(f"  Attempt {log['attempt']} (T={log['temp']:.2f}): {log.get('failures', '?')} failures")
                
                await client.close()
                return {
                    'success': True,
                    'attempts': attempt,
                    'convergence': attempts_log
                }
            
            # Check if we're making progress
            improvement = prev_result.get('failures', 999) - test_result.get('failures', 999)
            if improvement > 0:
                print(f"Progress: Fixed {improvement} more bug(s)")
            elif improvement < 0:
                print(f"Warning: Regression - {abs(improvement)} more failures")
            else:
                print("No progress this iteration")
            
            # ===== DYNAMIC MODEL ESCALATION =====
            # Simulate circuit breaker state (in real system, would come from rebanker)
            # For now, we use simple heuristics: lack of progress = circuit breaker signal
            breaker_summary = {
                'circuit_state': 'OPEN' if improvement < 1 and attempt > 2 else 'CLOSED',
                'is_improving': improvement > 0,
                'improvement_velocity': improvement / max(attempt, 1),  # Errors fixed per attempt
                'total_attempts': attempt,
                'current_confidence': 1.0 - (test_result.get('failures', 7) / 7.0)
            }
            
            # Check if we should escalate model
            should_escalate, escalation_reason, next_model = escalation_decider.should_escalate(
                attempt_num=attempt,
                current_model=current_model,
                breaker_summary=breaker_summary,
                prev_error_count=prev_result.get('failures', 999),
                current_error_count=test_result.get('failures', 999)
            )
            
            if should_escalate and next_model:
                print(f"\n🚀 MODEL ESCALATION TRIGGERED!")
                print(f"   Reason: {escalation_reason}")
                print(f"   Escalating: {current_model} → {next_model}")
                print(f"   Circuit breaker state: {breaker_summary['circuit_state']}")
                print(f"   Improvement velocity: {breaker_summary['improvement_velocity']:.2f}")
                
                # Update model and client for next attempt
                current_model = next_model
                client.model_name = next_model  # Update client
                
                # Optionally boost temperature for exploration after escalation
                temp += 0.1  # Give it more room to explore
                
                attempts_log[-1]['model'] = current_model
                attempts_log[-1]['escalation'] = {
                    'reason': escalation_reason,
                    'to_model': next_model
                }
            else:
                attempts_log[-1]['model'] = current_model
            
            current_code = fixed_code
            prev_result = test_result
            
        except Exception as e:
            print(f"ERROR: {e}")
            import traceback
            traceback.print_exc()
            attempts_log.append({
                'attempt': attempt,
                'temp': temp,
                'error': str(e),
                'model': current_model
            })
    
    print(f"\n{'=' * 70}")
    print(f"EXHAUSTED ALL {MAX_ATTEMPTS} ATTEMPTS")
    print(f"{'=' * 70}")
    print(f"Final state: {prev_result.get('failures', '?')}/7 tests still failing")
    print("\nThis test successfully found the LLM's limits!")
    
    print("\n📊 HEALING PROGRESSION (with model escalations):")
    for log in attempts_log:
        status = "SUCCESS" if log.get('success') else f"{log.get('failures', '?')} fails"
        model = log.get('model', 'unknown')
        print(f"  Attempt {log['attempt']} (T={log.get('temp', 0):.2f}, Model={model}): {status}")
        
        # Show escalation if it happened
        if log.get('escalation'):
            escalation = log['escalation']
            print(f"    ↳ 🚀 ESCALATION: {escalation['reason']}")
            print(f"    ↳    To model: {escalation['to_model']}")
    
    print(f"\n🧠 Model escalation summary:")
    print(f"  Total escalations: {escalation_decider.get_escalation_count()}")
    if escalation_decider.get_escalation_history():
        for esc in escalation_decider.get_escalation_history():
            print(f"  - Attempt {esc['attempt']}: {esc['from']} → {esc['to']} ({esc['reason']})")
    
    await client.close()
    return {
        'success': False,
        'attempts': MAX_ATTEMPTS,
        'convergence': attempts_log,
        'final_failures': prev_result.get('failures', 999),
        'escalations': escalation_decider.get_escalation_history()
    }


def main():
    result = asyncio.run(run_test())
    
    print(f"\n{'=' * 70}")
    print("FINAL SUMMARY")
    print(f"{'=' * 70}")
    if result['success']:
        print(f"Status: SUCCESS ✅")
        print(f"Attempts needed: {result['attempts']}")
        print(f"Temperature range: 0.40 -> {0.40 + (result['attempts']-1)*0.15:.2f}")
    else:
        print(f"Status: LIMITS REACHED ⚠️")
        print(f"Attempts: {result['attempts']}")
        print(f"Remaining bugs: {result.get('final_failures', '?')}")
    
    escalations = result.get('escalations', [])
    if escalations:
        print(f"\n🧠 MODEL ESCALATION EVENTS: {len(escalations)}")
        for esc in escalations:
            print(f"  ├─ Attempt {esc['attempt']}: {esc['from']} → {esc['to']}")
            print(f"  │  Reason: {esc['reason']}")
    else:
        print(f"\n🧠 No model escalations needed (model handled it)")
    
    return result


if __name__ == "__main__":
    result = main()
