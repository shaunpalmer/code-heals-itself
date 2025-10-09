"""
Live Healing Runner - Executes buggy_test.py and triggers AI healing on errors
Watch the dashboard at http://127.0.0.1:5000 to see live updates!
"""
import subprocess
import sys
import traceback
import os
import importlib.util

# Import ai-debugging module (has hyphen in name)
spec = importlib.util.spec_from_file_location("ai_debugging", "ai-debugging.py")
ai_debugging = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ai_debugging)

AIDebugger = ai_debugging.AIDebugger

# Import ErrorType from utils
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from utils.python.confidence_scoring import ErrorType

print("=" * 60)
print("🔧 LIVE HEALING DEMO - Watch dashboard for real-time updates!")
print("=" * 60)
print()

# Try to run buggy_test.py and capture errors
try:
    print("📝 Running buggy_test.py...")
    result = subprocess.run(
        [sys.executable, "buggy_test.py"],
        capture_output=True,
        text=True,
        timeout=10
    )
    
    if result.returncode != 0:
        print(f"\n❌ Script failed with exit code {result.returncode}")
        print(f"\n📋 STDERR:\n{result.stderr}")
        
        # Parse the error and trigger healing
        stderr_lines = result.stderr.strip().split('\n')
        error_message = None
        error_line = None
        
        for line in stderr_lines:
            if 'SyntaxError' in line or 'NameError' in line or 'AttributeError' in line:
                error_message = line.strip()
            if 'File "' in line and 'line' in line:
                parts = line.split('line')
                if len(parts) > 1:
                    try:
                        error_line = int(parts[1].strip().split()[0].rstrip(','))
                    except:
                        pass
        
        if error_message:
            print(f"\n🩺 Detected error: {error_message}")
            print(f"🔍 Triggering AI healing...")
            
            # Determine error type
            if 'SyntaxError' in error_message:
                error_type = ErrorType.SYNTAX
            elif 'NameError' in error_message:
                error_type = ErrorType.RESOLUTION
            elif 'AttributeError' in error_message:
                error_type = ErrorType.LOGIC
            else:
                error_type = ErrorType.RESOLUTION
            
            # Read the buggy code
            with open('buggy_test.py', 'r') as f:
                buggy_code = f.read()
            
            # Trigger AI healing
            debugger = AIDebugger()
            result = debugger.process_error(
                error_type=error_type,
                message=error_message,
                patch_code=buggy_code,
                original_code=buggy_code,
                logits=[0.8, 0.15, 0.05],
                historical={
                    "success_rate": 0.0,
                    "pattern_similarity": 0.0,
                    "test_coverage": 0.0
                },
                metadata={
                    "service": "live_healing_demo",
                    "env": "development",
                    "script": "buggy_test.py",
                    "error_line": error_line
                }
            )
            
            print(f"\n✅ Healing attempt completed!")
            print(f"📊 Check dashboard at http://127.0.0.1:5000")
            print(f"   - Click '🧠 Knowledge Base' to see patterns")
            print(f"   - Watch 'Healing Status' widget for activity")
            print()
            print("💡 TIP: Run this script multiple times to see patterns accumulate!")
        else:
            print("\n⚠️  Could not parse error from output")
    else:
        print("\n✅ Script ran successfully (no errors to heal)")
        print(result.stdout)
        
except Exception as e:
    print(f"\n💥 Runner failed: {e}")
    traceback.print_exc()

print("\n" + "=" * 60)
