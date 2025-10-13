from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import time
import os
import sys
import json
import asyncio
import threading
import signal
from pathlib import Path
from collections import deque
from datetime import datetime
import traceback
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('dashboard.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

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
from envelope_storage import get_envelope_storage

# Global shutdown flag
shutdown_flag = threading.Event()

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

# Enable CORS with explicit configuration for Chrome/Firefox compatibility
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:5000", "http://127.0.0.1:5000", "http://[::1]:5000"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
        "expose_headers": ["Content-Type"],
        "supports_credentials": True,
        "max_age": 3600
    }
})

# Error handler for 404
@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

# Error handler for 500
@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {error}")
    return jsonify({"error": "Internal server error"}), 500

# Global exception handler
@app.errorhandler(Exception)
def handle_exception(e):
    logger.error(f"Unhandled exception: {e}")
    logger.error(traceback.format_exc())
    return jsonify({
        "error": "An unexpected error occurred",
        "type": type(e).__name__,
        "message": str(e)
    }), 500

# Health check endpoint
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for monitoring"""
    try:
        storage = get_envelope_storage()
        storage_ok = True
    except Exception as e:
        storage_ok = False
        logger.warning(f"Storage health check failed: {e}")
    
    return jsonify({
        "status": "healthy" if storage_ok else "degraded",
        "storage": "ok" if storage_ok else "error",
        "timestamp": datetime.now().isoformat(),
        "uptime": time.time() - app.config.get('START_TIME', time.time())
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
    """Get healing metrics from storage"""
    try:
        storage = get_envelope_storage()
        real_metrics = storage.get_metrics()
        return jsonify(real_metrics)
    except Exception as e:
        logger.error(f"Error getting metrics: {e}\n{traceback.format_exc()}")
        # Fallback to safe default
        return jsonify({
            "healingSuccess": 0,
            "breakerStatus": "unknown",
            "pendingReviews": 0,
            "error": "Storage unavailable"
        }), 503

@app.route('/envelopes/latest', methods=['GET'])
def get_envelopes():
    """Get latest envelopes from storage"""
    try:
        storage = get_envelope_storage()
        limit = request.args.get('limit', 20, type=int)
        real_envelopes = storage.get_latest_envelopes(limit=min(limit, 100))
        return jsonify({"envelopes": real_envelopes})
    except Exception as e:
        logger.error(f"Error getting envelopes: {e}\n{traceback.format_exc()}")
        return jsonify({
            "envelopes": [],
            "error": "Storage unavailable"
        }), 503

@app.route('/debug/run', methods=['POST'])
def trigger_heal():
    return jsonify({"acknowledged": True})

@app.route('/api/success-patterns/stats', methods=['GET'])
def get_success_patterns_stats():
    """Get success patterns knowledge base statistics"""
    try:
        storage = get_envelope_storage()
        
        # Get overall stats
        stats = storage.get_success_stats()
        
        # Get patterns by family
        with storage._get_connection() as conn:
            cursor = conn.execute("""
                SELECT 
                    SUBSTR(error_code, 1, INSTR(error_code, '.') - 1) as family,
                    COUNT(*) as pattern_count,
                    SUM(success_count) as total_successes
                FROM success_patterns
                WHERE error_code LIKE '%.%'
                GROUP BY family
                ORDER BY total_successes DESC
            """)
            by_family = [
                {
                    "family": row[0] if row[0] else "OTHER",
                    "pattern_count": row[1],
                    "total_successes": row[2]
                }
                for row in cursor.fetchall()
            ]
            
            # Get top patterns
            cursor = conn.execute("""
                SELECT error_code, cluster_id, fix_description, 
                       success_count, avg_confidence, tags
                FROM success_patterns
                ORDER BY success_count DESC, avg_confidence DESC
                LIMIT 10
            """)
            top_patterns = [
                {
                    "error_code": row[0],
                    "cluster_id": row[1],
                    "fix_description": row[2],
                    "success_count": row[3],
                    "avg_confidence": row[4],
                    "tags": row[5]
                }
                for row in cursor.fetchall()
            ]
            
            # Get recent patterns (last 24 hours)
            cursor = conn.execute("""
                SELECT error_code, cluster_id, fix_description, 
                       success_count, avg_confidence, last_success_at
                FROM success_patterns
                WHERE datetime(last_success_at) >= datetime('now', '-24 hours')
                ORDER BY last_success_at DESC
                LIMIT 10
            """)
            recent_patterns = [
                {
                    "error_code": row[0],
                    "cluster_id": row[1],
                    "fix_description": row[2],
                    "success_count": row[3],
                    "avg_confidence": row[4],
                    "last_success": row[5]
                }
                for row in cursor.fetchall()
            ]
        
        return jsonify({
            "stats": stats,
            "by_family": by_family,
            "top_patterns": top_patterns,
            "recent_patterns": recent_patterns
        })
    except Exception as e:
        logger.error(f"Error getting success patterns stats: {e}\n{traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/healing/status', methods=['GET'])
def get_healing_status():
    """Get current healing status (if active)"""
    try:
        storage = get_envelope_storage()
        
        # Get latest envelope to determine if healing is active
        latest = storage.get_latest_envelopes(limit=1)
        
        if latest:
            last_envelope = latest[0]
            last_time = datetime.fromisoformat(last_envelope['timestamp'].replace('Z', '+00:00'))
            age_seconds = (datetime.now(last_time.tzinfo) - last_time).total_seconds()
            
            # Consider "active" if last envelope was within 30 seconds
            is_active = age_seconds < 30
            
            # Get patterns that might be in use
            patterns_in_use = []
            if 'metadata' in last_envelope and 'rebanker_raw' in last_envelope.get('metadata', {}):
                rebanker = last_envelope['metadata']['rebanker_raw']
                error_code = rebanker.get('code')
                cluster_id = rebanker.get('cluster_id')
                
                if error_code:
                    patterns = storage.get_similar_success_patterns(
                        error_code=error_code,
                        cluster_id=cluster_id,
                        limit=3
                    )
                    patterns_in_use = patterns
            
            return jsonify({
                "active": is_active,
                "last_heal": last_envelope['timestamp'],
                "age_seconds": round(age_seconds, 1),
                "last_status": last_envelope.get('status'),
                "last_error": last_envelope.get('metadata', {}).get('rebanker_raw', {}).get('code'),
                "patterns_available": len(patterns_in_use),
                "patterns": patterns_in_use[:3] if patterns_in_use else []
            })
        else:
            return jsonify({
                "active": False,
                "last_heal": None,
                "message": "No healing runs recorded yet"
            })
    except Exception as e:
        logger.error(f"Error getting healing status: {e}\n{traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500

@app.route('/status/heartbeat', methods=['POST'])
def heartbeat():
    data = request.get_json()
    timestamp = data.get('timestamp', time.time())
    return jsonify({
        "status": "ok",
        "timestamp": timestamp
    })

@app.route('/keepalive', methods=['GET'])
def server_keepalive():
    """Simple server ping endpoint (use /api/keepalive/status for LLM Keep-Alive status)"""
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

@app.route('/api/llm/defaults', methods=['GET'])
def get_llm_defaults():
    """Get default LLM settings from config.default.json"""
    try:
        config_file = Path(__file__).parent / "config.default.json"
        if config_file.exists():
            with open(config_file, "r") as f:
                config = json.load(f)
                if "llm" in config:
                    return jsonify(config["llm"])
        
        # Fallback to built-in defaults
        from llm_settings import DEFAULT_SETTINGS
        return jsonify(DEFAULT_SETTINGS)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Keep-Alive Background Thread
async def keepalive_loop(stop_event, interval):
    """Background loop that pings LLM provider to keep connection alive"""
    global keepalive_state
    import aiohttp
    
    # Set status to running when loop starts
    keepalive_state["running"] = True
    keepalive_state["status"] = "running"
    keepalive_state["start_time"] = datetime.now().isoformat()
    print(f"[Keep-Alive] Loop started, state updated - running={keepalive_state['running']}, status={keepalive_state['status']}, id={id(keepalive_state)}")
    
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
                # Avoid duplicating version segments (e.g. /v1/v1/models)
                if base_url.endswith(("/v1", "/v2", "/v3")):
                    ping_url = f"{base_url}/models"
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


def _start_keepalive_internal(interval=None):
    """Internal function to start Keep-Alive thread (used by API and heartbeat)"""
    if interval is None:
        settings = load_llm_settings()
        interval = settings.get("keep_alive_interval", 300)
    
    stop_event = threading.Event()
    thread = threading.Thread(
        target=run_keepalive_thread,
        args=(interval,),
        daemon=True,
        name="KeepAliveThread"
    )
    
    # Store thread and stop_event references
    keepalive_state["thread"] = thread
    keepalive_state["stop_event"] = stop_event
    
    # Thread will set running=True, status="running", start_time when loop starts
    thread.start()
    
    return interval


@app.route('/api/keepalive/start', methods=['POST'])
def start_keepalive():
    """Start the keep-alive background thread"""
    if keepalive_state["running"]:
        return jsonify({
            "ok": False,
            "error": "Keep-alive already running",
            "status": keepalive_state["status"]
        }), 400
    
    try:
        interval = _start_keepalive_internal()
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
    # DEBUG: Log the current state
    print(f"[DEBUG] get_keepalive_status called - state: running={keepalive_state['running']}, status={keepalive_state['status']}, logs_count={len(keepalive_state['logs'])}, id={id(keepalive_state)}")
    
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


def heartbeat_monitor():
    """Monitor and auto-restart Keep-Alive if it stops unexpectedly."""
    logger.info("Heartbeat monitor started (30s interval)")
    
    while not shutdown_flag.is_set():
        try:
            time.sleep(30)
            
            settings = load_llm_settings()
            should_run = settings.get('enabled') and settings.get('keep_alive')
            
            if should_run:
                is_running = keepalive_state.get("running", False)
                thread = keepalive_state.get("thread")
                thread_alive = thread and thread.is_alive() if thread else False
                
                if not is_running or not thread_alive:
                    logger.warning("Keep-Alive stopped unexpectedly - restarting...")
                    
                    if keepalive_state.get("stop_event"):
                        keepalive_state["stop_event"].set()
                    
                    _start_keepalive_internal()
                    logger.info("Keep-Alive restarted")
                else:
                    logger.debug("Keep-Alive healthy")
            else:
                logger.debug("Keep-Alive disabled")
                
        except Exception as e:
            logger.error(f"Heartbeat monitor error: {e}")
            continue


if __name__ == '__main__':
    import sys
    
    # Set start time for health check
    app.config['START_TIME'] = time.time()
    
    # Start heartbeat monitor
    logger.info("Starting heartbeat monitor...")
    heartbeat_thread = threading.Thread(
        target=heartbeat_monitor,
        daemon=True,
        name="HeartbeatMonitor"
    )
    heartbeat_thread.start()
    
    # Initial auto-start of Keep-Alive
    try:
        settings = load_llm_settings()
        if settings.get('enabled') and settings.get('keep_alive'):
            logger.info("Auto-starting Keep-Alive...")
            interval = _start_keepalive_internal()
            logger.info(f"Keep-Alive started ({interval}s interval)")
    except Exception as e:
        logger.warning(f"Could not auto-start Keep-Alive: {e}")
        logger.info("Heartbeat will attempt restart in 30 seconds")
    
    # Setup graceful shutdown
    def signal_handler(sig, frame):
        logger.info("Shutdown signal received, cleaning up...")
        shutdown_flag.set()
        
        # Stop keep-alive if running
        if keepalive_state["running"] and keepalive_state["stop_event"]:
            keepalive_state["stop_event"].set()
        
        logger.info("Shutdown complete")
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    logger.info("Dashboard Development Server Starting")
    logger.info("Dashboard UI: http://127.0.0.1:5000")
    logger.info("API endpoints ready on port 5000")
    logger.info("Health check: http://127.0.0.1:5000/health")
    logger.info("Auto-restart enabled - server will recover from crashes")
    
    # Auto-restart loop with better error handling
    restart_count = 0
    max_restarts = 10
    restart_window = 60  # seconds
    restart_times = deque(maxlen=max_restarts)
    
    while not shutdown_flag.is_set():
        try:
            # Check if we're restarting too frequently
            now = time.time()
            restart_times.append(now)
            
            if len(restart_times) >= max_restarts:
                time_span = now - restart_times[0]
                if time_span < restart_window:
                    logger.error(f"Too many restarts ({max_restarts} in {restart_window}s)")
                    logger.error("Server appears to be in a crash loop. Exiting.")
                    sys.exit(1)
            
            # Run server with timeout handling
            app.run(
                host='127.0.0.1',
                port=5000,
                threaded=True,
                use_reloader=False,
                debug=False
            )
            break  # Normal shutdown
            
        except KeyboardInterrupt:
            logger.info("\nServer stopped by user")
            shutdown_flag.set()
            sys.exit(0)
            
        except OSError as e:
            if "address already in use" in str(e).lower():
                logger.error("Port 5000 is already in use")
                logger.error("Kill the other process or choose a different port")
                sys.exit(1)
            else:
                restart_count += 1
                logger.error(f"OS Error (restart #{restart_count}): {e}")
                logger.error(traceback.format_exc())
                
        except Exception as e:
            restart_count += 1
            logger.error(f"Server crashed (restart #{restart_count}): {e}")
            logger.error(traceback.format_exc())
        
        if not shutdown_flag.is_set():
            logger.info("Restarting in 3 seconds...")
            time.sleep(3)
            logger.info("Server restarting...\n")
