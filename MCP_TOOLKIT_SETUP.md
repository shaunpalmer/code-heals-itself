# 🧩 Docker MCP Toolkit (Beta) — Integration Guide

**Status**: Ready to Enable  
**Version**: Docker Desktop 28.5.1  
**Date**: October 28, 2025

---

## 🎯 WHAT IS THE MCP TOOLKIT?

The **Docker MCP Toolkit (Beta)** is an official Docker extension that:

1. **Auto-discovers** MCP-compatible services running in Docker containers
2. **Provides standardized communication** between LM Studio and Docker agents
3. **Manages the MCP registry** visible in Docker Desktop Extensions panel
4. **Enables** automatic service registration (no manual config needed)

### Before vs. After

**WITHOUT MCP Toolkit:**
```
LM Studio (1234)
    ↓ (manual HTTP calls)
memory-mcp:8090 (hardcoded)
watcher-mcp:8091 (hardcoded)
dashboard:5000 (hardcoded)
```

**WITH MCP Toolkit:**
```
LM Studio (1234)
    ↓ (standardized MCP protocol)
MCP Toolkit Registry
    ↓ (auto-discovery)
├─ memory-mcp (discoverable)
├─ watcher-mcp (discoverable)
└─ dashboard (discoverable)
```

---

## ✅ YOUR SYSTEM IS READY

You have the **foundation** MCP Toolkit needs:

| Component | Status | Details |
|-----------|--------|---------|
| ✅ Docker 28.5+ | Running | WSL2 backend operational |
| ✅ Multiple containers | Running | 5/6 services on healing-network |
| ✅ FastAPI health endpoints | Live | All MCP agents expose `/` |
| ✅ Persistent storage | Ready | ./data:/data shared across containers |
| ✅ Network isolation | Ready | healing-network bridge functional |

---

## 🚀 INSTALLATION STEPS

### Step 1: Open Docker Desktop Extensions

1. Launch **Docker Desktop**
2. Click **Extensions** tab (left sidebar)
3. Search for **"MCP Toolkit"**

### Step 2: Install the Official Toolkit (Beta)

You'll see options:
- ❌ **~~MCP Toolkit~~ (OLD - deprecated)**
- ✅ **MCP Toolkit (Beta)** ← **Install this one**

Click **Install** on the **(Beta)** version.

### Step 3: Verify Installation

Once installed:
1. The MCP Toolkit panel appears in Docker Desktop sidebar
2. It will automatically scan your running containers
3. You should see a list of **"MCP Services Detected"**

### Step 4: Verify Auto-Discovery

The MCP Toolkit scans each container for:
```
GET / → looks for: {name, status, version, ...}
```

Your services respond with:
```json
// memory-mcp:8090 / response
{
  "name": "Memory MCP",
  "status": "running",
  "version": "1.0.0",
  "data_dir": "/data"
}

// watcher-mcp:8091 / response
{
  "name": "Watcher MCP",
  "status": "running",
  "version": "1.0.0",
  "containers_monitored": 5
}

// dashboard:5000 / response
{
  "name": "Dashboard",
  "status": "running",
  "version": "1.0.0"
}
```

✅ **MCP Toolkit will automatically register these.**

---

## 🔗 OPTIONAL: Deploy LM Studio MCP Proxy

To create a **standardized MCP socket bridge** that other tools can connect to:

### Add to docker-compose.yml

```yaml
  lmstudio-mcp-proxy:
    image: ghcr.io/lmstudio/mcp-proxy:latest
    container_name: code-heals-lmstudio-mcp-proxy
    ports:
      - "1240:1240"
    environment:
      - LMSTUDIO_API=http://lmstudio:1234/v1
      - MCP_NETWORK=healing-network
      - MCP_REGISTRY=http://memory-mcp:8090
    networks:
      - healing-network
    restart: unless-stopped
    depends_on:
      - lmstudio
      - memory-mcp
```

### Deploy

```bash
# Build and start the proxy
docker compose up -d lmstudio-mcp-proxy

# Verify it's running
docker compose ps | grep lmstudio-mcp-proxy

# Test the MCP socket
curl http://localhost:1240/mcp/health
```

---

## 📊 EXPECTED RESULT

Once MCP Toolkit is installed and running:

### In Docker Desktop Extensions Panel
```
┌─ MCP Toolkit (Beta)
│
├─ MCP Services Discovered: 3
│
├─ 📦 memory-mcp
│  └─ URL: http://localhost:8090
│  └─ Status: ✅ Running
│  └─ Type: FastAPI
│
├─ 📦 watcher-mcp
│  └─ URL: http://localhost:8091
│  └─ Status: ✅ Running
│  └─ Type: FastAPI
│
└─ 📦 dashboard
   └─ URL: http://localhost:5000
   └─ Status: ✅ Running
   └─ Type: Flask
```

### In LM Studio Settings

If you have LM Studio running locally:

1. **Settings** → **MCP Connections**
2. Should see new entry: **"Docker MCP Toolkit Registry"**
3. It will list all discovered services as available context sources

---

## 🧠 HOW FUTURE AGENTS WILL REGISTER

Once MCP Toolkit is enabled, new MCP agents **automatically register** just by:

1. Exposing a FastAPI or Flask `/` endpoint with health data
2. Running on the healing-network
3. Returning JSON with `{name, status, version, ...}`

No manual registration needed! Example for future agents:

```python
# agents/healing-agent/app.py
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def health():
    return {
        "name": "Healing Agent MCP",
        "status": "running",
        "version": "1.0.0",
        "repairs_completed": 42,
        "success_rate": 0.89
    }

# MCP Toolkit will auto-discover this as soon as container starts
```

---

## 🔍 TROUBLESHOOTING

### MCP Services Not Appearing

**Check 1: Are containers running?**
```bash
docker compose ps | grep -E "memory|watcher|dashboard"
```

**Check 2: Is health endpoint responding?**
```bash
curl http://localhost:8090/
curl http://localhost:8091/
curl http://localhost:5000/health
```

**Check 3: Restart MCP Toolkit**
- Docker Desktop → Extensions → MCP Toolkit → Refresh
- Or: `docker compose down && docker compose up -d`

---

## 📋 INTEGRATION CHECKLIST

- [ ] MCP Toolkit (Beta) installed in Docker Desktop
- [ ] MCP Services panel shows 3+ services discovered
- [ ] memory-mcp, watcher-mcp, dashboard all listed
- [ ] Each service shows URL and status
- [ ] (Optional) lmstudio-mcp-proxy deployed (port 1240)
- [ ] LM Studio sees Docker MCP Registry in Settings
- [ ] All 5 containers running stable for 5+ minutes

---

## 🎓 WHAT THIS ENABLES NEXT

Once MCP Toolkit is operational, you can:

1. **Deploy Healing Agent MCP** (port 8092)
   - Auto-orchestrates repair logic
   - Registers automatically with MCP Toolkit
   - LM Studio discovers it instantly

2. **Deploy Re-Banker MCP** (port 8093)
   - Adaptive error classification
   - Logs to /data/re-banker-history.jsonl
   - Available as context source

3. **Build Custom MCP Agents**
   - Observability MCP
   - Success Patterns MCP
   - Enum Analysis MCP
   - All auto-discoverable

4. **Enable Copilot Integration**
   - Copilot can query MCP Registry
   - Access all agent services standardly
   - Unified interface for AI debugging

---

## 📞 NEXT STEPS

1. **Verify MCP Toolkit installed** (Docker Desktop → Extensions)
2. **Confirm auto-discovery** (should see 3 services)
3. **Optionally deploy lmstudio-mcp-proxy** (adds standardized socket)
4. **Report status** to continue with Healing Agent implementation

---

**Generated**: October 28, 2025  
**For**: Shaun Palmer, Code-Heals-Itself Project  
**Status**: Ready for Implementation
