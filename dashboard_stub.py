from flask import Flask, request, jsonify
from flask_cors import CORS
import time

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Mock data
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

@app.route('/extensions/<id>/enable', methods=['POST'])
def enable_extension(id):
    extensions_state[id] = True
    return jsonify({"acknowledged": True})

@app.route('/extensions/<id>/disable', methods=['POST'])
def disable_extension(id):
    extensions_state[id] = False
    return jsonify({"acknowledged": True})

if __name__ == '__main__':
    app.run(port=5000)