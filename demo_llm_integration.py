"""
Quick demo of the LLM integration system
Tests connection to LM Studio and sends a sample chat request
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from clients.llm_client import LLMClient
from llm_settings import get_llm_settings_for_client, save_llm_settings, load_llm_settings


async def demo_lm_studio():
    """Demo: Test LM Studio connection and send a chat request"""
    print("=" * 80)
    print("LLM INTEGRATION DEMO - LM Studio")
    print("=" * 80)
    
    # Create client for LM Studio
    client = LLMClient(
        provider="lmstudio",
        base_url="http://127.0.0.1:1234/v1",
        model_name="qwen3-32b",  # Use your installed model
        temperature=0.7,
        max_tokens=500
    )
    
    try:
        # Test 1: Ping the server
        print("\n[1] Testing connection...")
        ping_result = await client.ping()
        
        if ping_result['ok']:
            print(f"✅ Connection successful!")
            print(f"   Provider: {ping_result['provider']}")
            print(f"   Latency: {ping_result.get('latency_ms', 'N/A')}ms")
        else:
            print(f"❌ Connection failed: {ping_result.get('error')}")
            return
        
        # Test 2: Fetch available models
        print("\n[2] Fetching available models...")
        models = await client.models()
        
        if models:
            print(f"✅ Found {len(models)} models:")
            for model in models[:5]:  # Show first 5
                print(f"   - {model}")
            if len(models) > 5:
                print(f"   ... and {len(models) - 5} more")
        else:
            print("⚠️  No models found or fetch failed")
        
        # Test 3: Send a chat request
        print("\n[3] Sending chat request...")
        messages = [
            {
                "role": "system",
                "content": "You are a helpful Python debugging assistant. Provide concise, accurate fixes."
            },
            {
                "role": "user",
                "content": """I'm getting this error in my Python code:

TypeError: 'int' object is not subscriptable

The code is:
x = 42
print(x[0])

What's wrong and how do I fix it?"""
            }
        ]
        
        print("   Waiting for response...")
        response = await client.chat(messages)
        
        if 'error' in response:
            print(f"❌ Chat failed: {response['error']}")
        else:
            print(f"✅ Got response!")
            print(f"   Model: {response.get('model', 'unknown')}")
            print(f"   Tokens: {response.get('usage', {})}")
            print("\n" + "─" * 80)
            print("RESPONSE:")
            print("─" * 80)
            print(response['content'])
            print("─" * 80)
    
    except Exception as e:
        print(f"\n❌ Demo failed: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        await client.close()
        print("\n✅ Client closed")


async def demo_settings():
    """Demo: Test settings storage and encryption"""
    print("\n" + "=" * 80)
    print("SETTINGS DEMO - Storage & Encryption")
    print("=" * 80)
    
    # Load current settings
    print("\n[1] Loading current settings...")
    settings = load_llm_settings()
    print(f"✅ Loaded settings:")
    print(f"   Provider: {settings['provider']}")
    print(f"   Base URL: {settings['base_url']}")
    print(f"   Model: {settings['model_name']}")
    print(f"   Temperature: {settings['temperature']}")
    print(f"   Max Tokens: {settings['max_tokens']}")
    
    # Test encryption (if API key present)
    if settings.get('api_key'):
        print(f"\n[2] API Key Storage:")
        print(f"   Encrypted: {settings['api_key'][:20]}...")
        
        # Get decrypted version
        decrypted_settings = get_llm_settings_for_client()
        print(f"   Decrypted: {decrypted_settings['api_key'][:10]}...")
    else:
        print(f"\n[2] No API key stored (not needed for local providers)")


def print_instructions():
    """Print setup instructions"""
    print("\n" + "=" * 80)
    print("SETUP INSTRUCTIONS")
    print("=" * 80)
    print("""
To run this demo:

1. Make sure LM Studio is installed and running:
   - Download: https://lmstudio.ai
   - Load a model (recommended: qwen3-32b, llama-13b, or llama-8b)
   - Start the local server (default: http://127.0.0.1:1234)

2. Update the model name in this script if needed:
   - Line 20: model_name="qwen3-32b"  # Change to your model

3. Run this script:
   - python demo_llm_integration.py

4. Or use the dashboard:
   - Start server: python dashboard_dev_server.py
   - Open: http://127.0.0.1:5000
   - Go to Settings tab (⚙️)
   - Test connection and configure settings

For other providers (OpenAI, Anthropic, etc.):
- Change provider parameter
- Add your API key
- Update base_url if needed
""")


async def main():
    """Run all demos"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Demo LLM integration system")
    parser.add_argument('--skip-chat', action='store_true', help='Skip chat demo (only test connection)')
    args = parser.parse_args()
    
    try:
        # Run LM Studio demo
        if args.skip_chat:
            print("Skipping chat demo (connection test only)")
        
        await demo_lm_studio()
        
        # Run settings demo
        await demo_settings()
        
        print("\n" + "=" * 80)
        print("DEMO COMPLETE")
        print("=" * 80)
        print("\n✅ All tests passed!")
        print("\nNext steps:")
        print("- Open dashboard: http://127.0.0.1:5000")
        print("- Configure settings in Settings tab")
        print("- Test different providers and models")
        print("- Build error stream evaluation framework")
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Demo interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Demo failed: {e}")
        import traceback
        traceback.print_exc()
        print_instructions()


if __name__ == "__main__":
    # Print instructions first
    print_instructions()
    
    # Run demo
    print("\nStarting demo in 3 seconds...")
    import time
    time.sleep(3)
    
    asyncio.run(main())
