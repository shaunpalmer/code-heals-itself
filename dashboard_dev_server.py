from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import time
import os
import sys
import asyncio
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from llm_settings import (
    load_llm_settings,
    save_llm_settings,
    get_llm_settings_for_api,
    get_llm_settings_for_client,
    validate_settings,
    LM_STUDIO_MODELS
)
from clients.llm_client import LLMClient

app = Flask(__name__)

# Enable CORS with explicit configuration for development
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "expose_headers": ["Content-Type"],
        "supports_credentials": False
    }
})

# Dashboard static files directory
DASHBOARD_DIR = os.path.join(os.path.dirname(__file__), 'dashboard')

# Mock data for development
metrics = {
    "healingSuccess": 78,
    "breakerStatus": "steady",
    "pendingReviews": 3
}

envelopes = [
    {
        "summary": "Envelope #4315 (python)",
        "status": "PROMOTED",
        "timestamp": "2025-09-25T02:12:49Z",
        "confidence": 0.82,
        "breaker": "trend-aware: ok",
        "payload": {
            "envelope_id": "4315",
            "outcome": "PROMOTED",
            "attempts": 3,
            "stable_hash": "abc123"
        }
    },
    {
        "summary": "Envelope #4314 (ts)",
        "status": "RETRY",
        "timestamp": "2025-09-25T01:47:02Z",
        "confidence": 0.46,
        "breaker": "breaker hold",
        "payload": {
            "envelope_id": "4314",
            "outcome": "RETRY",
            "reason": "integration tests failing"
        }
    }
]

extensions_state = {
    "eslint-enhanced-runner": True,
    "npm-audit-runner": False,
    "stylelint-runner": True
}

# Serve dashboard UI
@app.route('/')
def serve_dashboard():
    return send_from_directory(DASHBOARD_DIR, 'index.html')

@app.route('/assets/<path:filename>')
def serve_assets(filename):
    assets_dir = os.path.join(DASHBOARD_DIR, 'assets')
    return send_from_directory(assets_dir, filename)

# API endpoints for dashboard
@app.route('/status/metrics', methods=['GET'])
def get_metrics():
    return jsonify(metrics)

@app.route('/envelopes/latest', methods=['GET'])
def get_envelopes():
    return jsonify(envelopes)

@app.route('/debug/run', methods=['POST'])
def trigger_heal():
    return jsonify({"acknowledged": True})

@app.route('/status/heartbeat', methods=['POST'])
def heartbeat():
    data = request.get_json()
    timestamp = data.get('timestamp', time.time())
    return jsonify({
        "status": "ok",
        "timestamp": timestamp
    })

@app.route('/keepalive', methods=['GET'])
def keepalive():
    """Keepalive endpoint to prevent server timeout"""
    return jsonify({"alive": True, "timestamp": time.time()})

@app.route('/extensions/<id>/enable', methods=['POST'])
def enable_extension(id):
    extensions_state[id] = True
    return jsonify({"acknowledged": True})

@app.route('/extensions/<id>/disable', methods=['POST'])
def disable_extension(id):
    extensions_state[id] = False
    return jsonify({"acknowledged": True})

# LLM Settings API endpoints
@app.route('/api/llm/settings', methods=['GET'])
def get_llm_settings():
    """Get current LLM settings (API key masked)"""
    try:
        settings = get_llm_settings_for_api()
        return jsonify(settings)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/llm/settings', methods=['POST'])
def update_llm_settings():
    """Update LLM settings"""
    try:
        data = request.get_json()
        
        # Validate settings
        valid, error = validate_settings(data)
        if not valid:
            return jsonify({"error": error}), 400
        
        # Save settings (will encrypt API key)
        success = save_llm_settings(data)
        if not success:
            return jsonify({"error": "Failed to save settings"}), 500
        
        return jsonify({"success": True, "message": "Settings saved successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/llm/test', methods=['GET'])
def test_llm_connection():
    """Test connection to configured LLM provider"""
    try:
        # Get settings with decrypted API key
        settings = get_llm_settings_for_client()
        
        # Create client
        client = LLMClient(
            provider=settings["provider"],
            api_key=settings.get("api_key", ""),
            base_url=settings["base_url"],
            model_name=settings["model_name"],
            timeout=settings.get("timeout", 30)
        )
        
        # Run ping in async context
        async def run_test():
            try:
                ping_result = await client.ping()
                
                # Try to get models if ping succeeded
                models = []
                if ping_result.get("ok"):
                    try:
                        models = await client.models()
                    except:
                        pass
                
                return {
                    "ping": ping_result,
                    "models": models[:10] if models else []  # Limit to 10 models
                }
            finally:
                await client.close()
        
        result = asyncio.run(run_test())
        return jsonify(result)
    except Exception as e:
        return jsonify({
            "ping": {"ok": False, "error": str(e)},
            "models": []
        }), 500

@app.route('/api/llm/models', methods=['GET'])
def get_llm_models():
    """Get available models from configured provider"""
    try:
        # Get settings with decrypted API key
        settings = get_llm_settings_for_client()
        
        # Create client
        client = LLMClient(
            provider=settings["provider"],
            api_key=settings.get("api_key", ""),
            base_url=settings["base_url"],
            model_name=settings["model_name"],
            timeout=settings.get("timeout", 30)
        )
        
        # Get models in async context
        async def fetch_models():
            try:
                models = await client.models()
                return models
            finally:
                await client.close()
        
        models = asyncio.run(fetch_models())
        return jsonify({"models": models})
    except Exception as e:
        return jsonify({"error": str(e), "models": []}), 500

@app.route('/api/llm/presets', methods=['GET'])
def get_llm_presets():
    """Get LM Studio model presets"""
    return jsonify({
        "lmstudio": LM_STUDIO_MODELS,
        "providers": [
            {"name": "LM Studio", "value": "lmstudio", "requiresKey": False},
            {"name": "OpenAI", "value": "openai", "requiresKey": True},
            {"name": "Anthropic", "value": "anthropic", "requiresKey": True},
            {"name": "Ollama", "value": "ollama", "requiresKey": False},
            {"name": "Meta Llama", "value": "llama", "requiresKey": False},
            {"name": "Azure OpenAI", "value": "azure", "requiresKey": True},
            {"name": "Google Gemini", "value": "gemini", "requiresKey": True},
            {"name": "Custom", "value": "custom", "requiresKey": False}
        ]
    })

if __name__ == '__main__':
    import sys
    
    print("🚀 Starting Dashboard Development Server")
    print("📊 Dashboard UI: http://127.0.0.1:5000")
    print("🔌 API endpoints ready on port 5000")
    print("♾️  Auto-restart enabled - server will recover from crashes")
    
    # Auto-restart loop
    restart_count = 0
    while True:
        try:
            app.run(port=5000, threaded=True, use_reloader=False)
            break  # Normal shutdown
        except KeyboardInterrupt:
            print("\n👋 Server stopped by user")
            sys.exit(0)
        except Exception as e:
            restart_count += 1
            print(f"\n⚠️  Server crashed (restart #{restart_count}): {e}")
            print("🔄 Restarting in 3 seconds...")
            import time
            time.sleep(3)
            print("✨ Server restarting...\n")
