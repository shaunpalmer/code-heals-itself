from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os
from datetime import datetime
from pathlib import Path

app = FastAPI(
    title="Memory MCP",
    description="Persistent memory agent for self-healing code system",
    version="1.0.0"
)

# Enable CORS for LM Studio and other services
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path("/data")
DATA_DIR.mkdir(exist_ok=True)
MEMORY_FILE = DATA_DIR / "memory.json"
HISTORY_FILE = DATA_DIR / "memory_history.jsonl"

class MemoryRequest(BaseModel):
    key: str
    value: str | None = None
    metadata: dict | None = None

class MemoryResponse(BaseModel):
    status: str
    key: str
    value: str | None = None
    timestamp: str
    metadata: dict | None = None

def load_memory():
    """Load memory from persistent storage"""
    if MEMORY_FILE.exists():
        with open(MEMORY_FILE, "r") as f:
            return json.load(f)
    return {}

def save_memory(data):
    """Save memory to persistent storage"""
    with open(MEMORY_FILE, "w") as f:
        json.dump(data, f, indent=2)

def log_history(key, action, value=None, metadata=None):
    """Log memory operations to history file"""
    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "key": key,
        "action": action,
        "value": value,
        "metadata": metadata
    }
    with open(HISTORY_FILE, "a") as f:
        f.write(json.dumps(entry) + "\n")

@app.get("/")
def root():
    """Health check endpoint"""
    return {
        "name": "Memory MCP",
        "status": "running",
        "version": "1.0.0",
        "data_dir": str(DATA_DIR)
    }

@app.post("/memory", response_model=MemoryResponse)
def memory(req: MemoryRequest):
    """Store or retrieve memory entries"""
    timestamp = datetime.utcnow().isoformat()
    
    try:
        memory_data = load_memory()
        
        if req.value is not None:
            # Store operation
            memory_data[req.key] = {
                "value": req.value,
                "stored_at": timestamp,
                "metadata": req.metadata or {}
            }
            save_memory(memory_data)
            log_history(req.key, "STORE", req.value, req.metadata)
            
            return MemoryResponse(
                status="stored",
                key=req.key,
                value=req.value,
                timestamp=timestamp,
                metadata=req.metadata
            )
        else:
            # Retrieve operation
            if req.key in memory_data:
                entry = memory_data[req.key]
                log_history(req.key, "RETRIEVE", entry.get("value"), entry.get("metadata"))
                
                return MemoryResponse(
                    status="retrieved",
                    key=req.key,
                    value=entry.get("value"),
                    timestamp=entry.get("stored_at", timestamp),
                    metadata=entry.get("metadata")
                )
            else:
                raise HTTPException(status_code=404, detail=f"Key '{req.key}' not found")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/memory/all")
def get_all_memory():
    """Get all memory entries"""
    try:
        memory_data = load_memory()
        return {
            "status": "success",
            "count": len(memory_data),
            "data": memory_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/memory/history")
def get_history(limit: int = 100):
    """Get memory operation history"""
    try:
        history = []
        if HISTORY_FILE.exists():
            with open(HISTORY_FILE, "r") as f:
                for line in f.readlines()[-limit:]:
                    history.append(json.loads(line))
        return {
            "status": "success",
            "count": len(history),
            "history": history
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/memory/{key}")
def delete_memory(key: str):
    """Delete a memory entry"""
    try:
        memory_data = load_memory()
        if key in memory_data:
            del memory_data[key]
            save_memory(memory_data)
            log_history(key, "DELETE")
            
            return {
                "status": "deleted",
                "key": key,
                "timestamp": datetime.utcnow().isoformat()
            }
        else:
            raise HTTPException(status_code=404, detail=f"Key '{key}' not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/memory/clear")
def clear_memory():
    """Clear all memory (with confirmation via header)"""
    try:
        save_memory({})
        log_history("*", "CLEAR_ALL")
        
        return {
            "status": "cleared",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8090)
