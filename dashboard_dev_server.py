from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import time
import os
import sys
import asyncio
import threading
from pathlib import Path
from collections import deque
from datetime import datetime

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

# Keep-alive state management
keepalive_state = {
    "running": False,
    "thread": None,
    "stop_event": None,
    "last_ping": None,
    "status": "stopped",  # stopped, running, error
    "error": None,
    "logs": deque(maxlen=100),  # Circular buffer for last 100 pings
    "start_time": None
}

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

# Keep-Alive Background Thread
async def keepalive_loop(stop_event, interval):
    """Background loop that pings LLM provider to keep connection alive"""
    import aiohttp
    
    while not stop_event.is_set():
        try:
            settings = get_llm_settings_for_client()
            
            # Determine ping endpoint based on provider
            provider = settings.get("provider", "lmstudio")
            base_url = settings.get("base_url", "").rstrip("/")
            
            if provider == "ollama":
                ping_url = f"{base_url}/api/tags"
            elif provider == "anthropic":
                # Anthropic doesn't have ping endpoint - skip
                log_entry = {
                    "timestamp": datetime.now().isoformat(),
                    "status": "skipped",
                    "provider": provider,
                    "message": "Provider doesn't support ping"
                }
                keepalive_state["logs"].append(log_entry)
                keepalive_state["last_ping"] = log_entry
                await asyncio.sleep(interval)
                continue
            else:
                ping_url = f"{base_url}/v1/models"
            
            # Perform ping
            start_time = time.time()
            async with aiohttp.ClientSession() as session:
                headers = {}
                api_key = settings.get("api_key", "")
                if api_key and provider not in ["lmstudio", "ollama", "llama"]:
                    if provider == "anthropic":
                        headers["x-api-key"] = api_key
                    else:
                        headers["Authorization"] = f"Bearer {api_key}"
                
                async with session.get(ping_url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    latency = (time.time() - start_time) * 1000
                    status_ok = response.status == 200
                    
                    log_entry = {
                        "timestamp": datetime.now().isoformat(),
                        "status": "ok" if status_ok else "error",
                        "provider": provider,
                        "model": settings.get("model_name", "unknown"),
                        "latency_ms": round(latency, 2),
                        "http_status": response.status
                    }
                    
                    keepalive_state["logs"].append(log_entry)
                    keepalive_state["last_ping"] = log_entry
                    keepalive_state["status"] = "running"
                    keepalive_state["error"] = None
                    
                    print(f"[{datetime.now().strftime('%X')}] Keep-Alive ping: {provider} {'OK' if status_ok else 'FAIL'} ({latency:.2f}ms)")
        
        except Exception as e:
            log_entry = {
                "timestamp": datetime.now().isoformat(),
                "status": "error",
                "provider": settings.get("provider", "unknown") if 'settings' in locals() else "unknown",
                "error": str(e)
            }
            keepalive_state["logs"].append(log_entry)
            keepalive_state["last_ping"] = log_entry
            keepalive_state["status"] = "error"
            keepalive_state["error"] = str(e)
            
            print(f"[{datetime.now().strftime('%X')}] Keep-Alive error: {e}")
        
        # Wait for next interval or stop event
        try:
            await asyncio.wait_for(asyncio.Event().wait(), timeout=interval)
        except asyncio.TimeoutError:
            pass  # Normal - timeout means continue loop
        
        if stop_event.is_set():
            break
    
    keepalive_state["status"] = "stopped"
    print("[Keep-Alive] Loop stopped")


def run_keepalive_thread(interval):
    """Run keep-alive loop in asyncio"""
    stop_event = threading.Event()
    keepalive_state["stop_event"] = stop_event
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        loop.run_until_complete(keepalive_loop(stop_event, interval))
    finally:
        loop.close()


@app.route('/api/keepalive/start', methods=['POST'])
def start_keepalive():
    """Start the keep-alive background thread"""
    global keepalive_state
    
    if keepalive_state["running"]:
        return jsonify({
            "ok": False,
            "error": "Keep-alive already running",
            "status": keepalive_state["status"]
        }), 400
    
    try:
        # Get interval from settings
        settings = get_llm_settings_for_client()
        interval = settings.get("keep_alive_interval", 300)  # Default 5 minutes
        
        # Create and start thread
        keepalive_state["running"] = True
        keepalive_state["status"] = "starting"
        keepalive_state["start_time"] = datetime.now().isoformat()
        keepalive_state["stop_event"] = None
        
        thread = threading.Thread(target=run_keepalive_thread, args=(interval,), daemon=True)
        thread.start()
        
        keepalive_state["thread"] = thread
        
        return jsonify({
            "ok": True,
            "message": f"Keep-alive started with {interval}s interval",
            "interval": interval,
            "start_time": keepalive_state["start_time"]
        })
    except Exception as e:
        keepalive_state["running"] = False
        keepalive_state["status"] = "error"
        keepalive_state["error"] = str(e)
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route('/api/keepalive/stop', methods=['POST'])
def stop_keepalive():
    """Stop the keep-alive background thread"""
    global keepalive_state
    
    if not keepalive_state["running"]:
        return jsonify({
            "ok": False,
            "error": "Keep-alive not running"
        }), 400
    
    try:
        # Signal thread to stop
        if keepalive_state["stop_event"]:
            keepalive_state["stop_event"].set()
        
        keepalive_state["running"] = False
        keepalive_state["status"] = "stopped"
        
        return jsonify({
            "ok": True,
            "message": "Keep-alive stopped"
        })
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route('/api/keepalive/status', methods=['GET'])
def get_keepalive_status():
    """Get keep-alive status and recent logs"""
    uptime = None
    if keepalive_state["start_time"] and keepalive_state["running"]:
        start = datetime.fromisoformat(keepalive_state["start_time"])
        uptime_seconds = (datetime.now() - start).total_seconds()
        uptime = f"{int(uptime_seconds // 60)} min {int(uptime_seconds % 60)} sec"
    
    return jsonify({
        "running": keepalive_state["running"],
        "status": keepalive_state["status"],
        "error": keepalive_state["error"],
        "last_ping": keepalive_state["last_ping"],
        "start_time": keepalive_state["start_time"],
        "uptime": uptime,
        "logs": list(keepalive_state["logs"])[-20:]  # Last 20 entries
    })


@app.route('/api/keepalive/logs', methods=['GET'])
def get_keepalive_logs():
    """Get full keep-alive log history"""
    return jsonify({
        "logs": list(keepalive_state["logs"])
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
