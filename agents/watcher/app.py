from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import docker
import asyncio
import json
from datetime import datetime
from pathlib import Path
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Watcher MCP",
    description="Container monitoring and healing agent",
    version="1.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Docker client
client = docker.from_env()

DATA_DIR = Path("/data")
DATA_DIR.mkdir(exist_ok=True)
HEALTH_FILE = DATA_DIR / "health.json"
ALERTS_FILE = DATA_DIR / "alerts.jsonl"

class ContainerHealth:
    def __init__(self):
        self.status = {}
        self.load()
    
    def load(self):
        if HEALTH_FILE.exists():
            with open(HEALTH_FILE, "r") as f:
                self.status = json.load(f)
    
    def save(self):
        with open(HEALTH_FILE, "w") as f:
            json.dump(self.status, f, indent=2)

health = ContainerHealth()

def log_alert(container_id, alert_type, message):
    """Log an alert to history"""
    alert = {
        "timestamp": datetime.utcnow().isoformat(),
        "container_id": container_id,
        "type": alert_type,
        "message": message
    }
    with open(ALERTS_FILE, "a") as f:
        f.write(json.dumps(alert) + "\n")
    logger.warning(f"[{alert_type}] {container_id}: {message}")

async def monitor_containers():
    """Monitor all containers for health"""
    try:
        containers = client.containers.list()
        timestamp = datetime.utcnow().isoformat()
        
        for container in containers:
            container_id = container.short_id
            name = container.name
            status = container.status
            
            # Update status
            health.status[name] = {
                "id": container_id,
                "status": status,
                "last_seen": timestamp,
                "image": container.image.tags[0] if container.image.tags else "unknown"
            }
            
            # Check for issues
            if status == "exited":
                log_alert(container_id, "CONTAINER_EXITED", f"Container {name} has exited")
                # Attempt restart
                try:
                    container.restart()
                    log_alert(container_id, "AUTO_RESTART", f"Restarted {name}")
                except Exception as e:
                    log_alert(container_id, "RESTART_FAILED", str(e))
            
            elif status == "paused":
                log_alert(container_id, "CONTAINER_PAUSED", f"Container {name} is paused")
                try:
                    container.unpause()
                    log_alert(container_id, "AUTO_UNPAUSE", f"Unpaused {name}")
                except Exception as e:
                    log_alert(container_id, "UNPAUSE_FAILED", str(e))
        
        health.save()
        logger.info(f"Health check completed: {len(containers)} containers monitored")
    
    except Exception as e:
        logger.error(f"Monitor error: {e}")

@app.get("/")
def root():
    """Health check endpoint"""
    return {
        "name": "Watcher MCP",
        "status": "running",
        "version": "1.0.0",
        "role": "Container monitoring and auto-healing"
    }

@app.get("/status")
def get_status():
    """Get current container status"""
    try:
        containers = client.containers.list(all=True)
        return {
            "status": "success",
            "total_containers": len(containers),
            "containers": [
                {
                    "name": c.name,
                    "status": c.status,
                    "image": c.image.tags[0] if c.image.tags else "unknown",
                    "created": c.attrs["Created"],
                    "id": c.short_id
                }
                for c in containers
            ],
            "monitored_health": health.status
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/health")
def get_health():
    """Get last known health status"""
    try:
        return {
            "status": "success",
            "last_check": health.status,
            "file": str(HEALTH_FILE)
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/alerts")
def get_alerts(limit: int = 100):
    """Get recent alerts"""
    try:
        alerts = []
        if ALERTS_FILE.exists():
            with open(ALERTS_FILE, "r") as f:
                for line in f.readlines()[-limit:]:
                    alerts.append(json.loads(line))
        return {
            "status": "success",
            "count": len(alerts),
            "alerts": alerts
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/monitor")
async def trigger_monitor(background_tasks: BackgroundTasks):
    """Trigger an immediate health check"""
    background_tasks.add_task(monitor_containers)
    return {
        "status": "monitoring_started",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.post("/container/{container_name}/restart")
def restart_container(container_name: str):
    """Manually restart a container"""
    try:
        container = client.containers.get(container_name)
        container.restart()
        log_alert(container.short_id, "MANUAL_RESTART", f"Restarted {container_name}")
        return {
            "status": "restarted",
            "container": container_name,
            "timestamp": datetime.utcnow().isoformat()
        }
    except docker.errors.NotFound:
        return {"status": "error", "message": f"Container '{container_name}' not found"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/container/{container_name}/logs")
def get_container_logs(container_name: str, tail: int = 50):
    """Get recent logs from a container"""
    try:
        container = client.containers.get(container_name)
        logs = container.logs(tail=tail, timestamps=True).decode('utf-8')
        return {
            "status": "success",
            "container": container_name,
            "logs": logs.split("\n")
        }
    except docker.errors.NotFound:
        return {"status": "error", "message": f"Container '{container_name}' not found"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# Periodic monitoring task
async def periodic_monitor():
    """Run health checks periodically"""
    while True:
        await monitor_containers()
        await asyncio.sleep(30)  # Check every 30 seconds

@app.on_event("startup")
async def startup_event():
    """Start background monitoring on app startup"""
    asyncio.create_task(periodic_monitor())
    logger.info("Watcher MCP started - monitoring containers")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8091)
