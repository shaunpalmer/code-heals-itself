# 🔌 WIRE MCP SERVERS TO LM STUDIO — Configuration Guide

**Status**: Configuration files created ✅  
**Next**: Wire into LM Studio + VS Code

---

## 📋 WHAT WE CREATED

### File 1: `.lmstudio-mcp-config.json`
**Location**: `c:\code-heals-itself\.lmstudio-mcp-config.json`  
**Purpose**: LM Studio MCP server configuration

Registers:
- ✅ MCP_DOCKER — gateway via stdio
- ✅ MCP_MEMORY — memory-mcp HTTP endpoint
- ✅ MCP_WATCHER — watcher-mcp HTTP endpoint
- ✅ MCP_DASHBOARD — dashboard HTTP endpoint
- ✅ MCP_API_GATEWAY — API gateway via docker mcp client
- ✅ MCP_DESKTOP_COMMANDER — desktop operations HTTP

### File 2: `.vscode/settings-mcp.json`
**Location**: `c:\code-heals-itself\.vscode\settings-mcp.json`  
**Purpose**: VS Code + Copilot MCP configuration

Same servers, optimized for VS Code format.

---

## 🔧 STEP 1: CONFIGURE LM STUDIO

### Option A: CLI Configuration (Recommended)

```bash
# Tell LM Studio where to find the config
$env:LM_STUDIO_MCP_CONFIG = "c:\code-heals-itself\.lmstudio-mcp-config.json"

# Then start LM Studio (if running as service)
# Or set it in LM Studio settings
```

### Option B: Manual Configuration in LM Studio UI

1. **Open LM Studio**
2. **Settings** → **Developer** → **Model Context Protocol**
3. Click **"Add MCP Server"**
4. For each server, add:

   ```json
   {
     "name": "MCP_DOCKER",
     "type": "stdio",
     "command": "docker",
     "args": ["mcp", "gateway", "run"]
   }
   ```

   Then add:
   ```json
   {
     "name": "MCP_MEMORY",
     "type": "http",
     "url": "http://localhost:8090"
   }
   ```

   And so on for each server.

---

## 🔧 STEP 2: CONFIGURE VS CODE + COPILOT

### Option A: Import MCP Settings to VS Code

1. **VS Code** → **Settings** (Ctrl+,)
2. Search: **"mcp"**
3. Find: **"Experimental: Model Context Protocol"**
4. Toggle: **ON** ✅
5. Find: **"MCP Servers"**
6. Click: **"Edit in settings.json"**
7. Paste from `.vscode/settings-mcp.json`:

```json
"mcp": {
  "servers": {
    "MCP_DOCKER": {
      "type": "stdio",
      "command": "docker",
      "args": ["mcp", "gateway", "run"],
      "disabled": false
    },
    "MCP_MEMORY": {
      "type": "http",
      "url": "http://localhost:8090",
      "disabled": false
    },
    ...
  }
}
```

### Option B: Use Extension Configuration

If using Docker for GitHub Copilot:

1. **Extensions** → **Docker for GitHub Copilot** → **Settings**
2. Check: **"Enable MCP Integration"** ✅
3. Add servers from Docker MCP Toolkit

---

## 🧪 STEP 3: TEST THE SETUP

### Test 1: Verify Servers Connected in LM Studio

1. **LM Studio** → **Settings** → **Model Context Protocol**
2. Should show:
   ```
   ✅ MCP_DOCKER        (connected)
   ✅ MCP_MEMORY        (connected)
   ✅ MCP_WATCHER       (connected)
   ✅ MCP_DESKTOP_COMMANDER (connected)
   ✅ MCP_API_GATEWAY   (connected)
   ```

### Test 2: Ask LM Studio via MCP

In LM Studio chat:
```
Question: What memory keys are stored?

Expected Flow:
LM Studio → MCP_MEMORY server (8090)
→ memory-mcp container receives request
→ queries /data/memory.json
→ returns stored keys
→ LM Studio shows result
```

### Test 3: Use Docker MCP

In LM Studio:
```
Question: List my running Docker containers

Expected Flow:
LM Studio → MCP_DOCKER (stdio gateway)
→ docker mcp gateway routes to docker server
→ lists containers
→ returns to LM Studio
```

### Test 4: Monitor in Docker Desktop

1. **Docker Desktop** → **MCP Toolkit** panel
2. Watch for:
   - ✅ Servers listed
   - ✅ Status: "running"
   - ✅ Connected clients counter increasing
3. Click on each server to see:
   - Active requests
   - Response times
   - Error logs

### Test 5: Check Container Logs

```bash
# Memory MCP logs
docker logs code-heals-memory-mcp -f

# Watcher MCP logs
docker logs code-heals-watcher-mcp -f

# Watch for incoming requests
```

Expected log output:
```
INFO: POST /memory HTTP/1.1
INFO: GET /memory/all HTTP/1.1
INFO: Response: 200 OK
```

---

## 🔄 REQUEST FLOW DIAGRAM

```
User Question (in LM Studio)
        ↓
LM Studio identifies MCP tool needed
        ↓
Routes to appropriate MCP server:
    ├─ MCP_MEMORY? → http://localhost:8090 → memory-mcp container
    ├─ MCP_WATCHER? → http://localhost:8091 → watcher-mcp container
    ├─ MCP_DOCKER? → docker mcp gateway → docker server
    └─ MCP_DESKTOP_COMMANDER? → http://localhost:8095 → desktop-commander
        ↓
MCP Server processes request
        ↓
Container executes logic (query memory, get status, etc.)
        ↓
Response returned to MCP server
        ↓
MCP server returns to LM Studio
        ↓
LM Studio formats response for user
        ↓
User sees answer
```

---

## ✅ COMPLETE CHECKLIST

- [ ] **Step 1**: `.lmstudio-mcp-config.json` created ✅
- [ ] **Step 2**: `.vscode/settings-mcp.json` created ✅
- [ ] **Step 3**: Docker containers running (5 services) ✅
- [ ] **Step 4**: MCP servers registered (docker mcp server ls) ✅
- [ ] **Step 5**: Start Docker MCP Gateway
  ```bash
  docker mcp gateway run
  ```
- [ ] **Step 6**: Open LM Studio, check MCP Connections tab
- [ ] **Step 7**: Try: "What memory keys are stored?"
- [ ] **Step 8**: Check Docker Desktop MCP Toolkit panel
- [ ] **Step 9**: Verify logs in container terminals
- [ ] **Step 10**: Test from VS Code Copilot Chat

---

## 🚀 IMMEDIATE NEXT ACTIONS

### Action 1: Start MCP Gateway (Right Now)

```bash
cd c:\code-heals-itself
docker mcp gateway run
```

Watch output for:
```
MCP Gateway listening on port 3000
Registered services: 5
Clients connected: 0
```

### Action 2: Open LM Studio Settings

While gateway runs, open LM Studio and check:
- Settings → Developer → Model Context Protocol
- Should auto-detect servers

### Action 3: Ask a Question

Try asking:
```
"Using MCP, what data is stored in the memory service?"
```

Watch the Docker Desktop MCP Toolkit panel as the request flows through.

---

## 🧠 WHAT'S HAPPENING

When you ask LM Studio a question:

1. **LM Studio parses** the question
2. **Identifies** which MCP tools are relevant (memory, watcher, docker, etc.)
3. **Calls** the appropriate MCP server via HTTP or stdio
4. **Container** processes the request (queries memory.json, checks container status, etc.)
5. **Response** flows back through MCP server to LM Studio
6. **LM Studio** formats answer for you

**This is the complete MCP integration pipeline.**

---

## 🎯 READY?

**Next step: Run `docker mcp gateway run` and watch what happens.**

The gateway is the central routing hub that ties everything together.

---

Generated: October 28, 2025  
For: Shaun Palmer, Code-Heals-Itself  
Status: **WIRING COMPLETE — READY FOR ACTIVATION**
