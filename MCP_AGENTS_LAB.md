# 🧠 MCP Agents Lab - Code-Heals-Itself

## Overview

Your self-healing code system now includes dedicated **Model Context Protocol (MCP) agents** that run in isolated Docker containers, each with specific responsibilities:

```
┌─────────────────────────────────────────────────────────────┐
│                 MCP Agents Network (healing-network)        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  LM Studio   │  │   Memory     │  │   Watcher    │      │
│  │  (Port 1234) │  │   MCP        │  │   MCP        │      │
│  │              │  │  (Port 8090) │  │  (Port 8091) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         ▲                 ▲                  ▲               │
│         │                 │                  │               │
│         └─────────────────┴──────────────────┘               │
│                      Healing Network                         │
│                                                              │
│  Services persist memory → track container health → fix     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 🧬 Agent Architecture

### 1. Memory MCP (Port 8090)
**Purpose**: Persistent memory storage for LLM agents across sessions

**Features**:
- Store/retrieve key-value pairs (JSON backend)
- Timestamped entries with metadata
- Operation history logging
- CORS-enabled for LM Studio integration

**Endpoints**:
```bash
# Store memory
POST http://localhost:8090/memory
{
  "key": "error_patterns",
  "value": "{ importErrors: 5, typeErrors: 3 }",
  "metadata": { "source": "python-agent" }
}

# Retrieve memory
POST http://localhost:8090/memory
{
  "key": "error_patterns"
}

# Get all memory
GET http://localhost:8090/memory/all

# View operation history
GET http://localhost:8090/memory/history?limit=50

# Delete entry
DELETE http://localhost:8090/memory/error_patterns

# Clear all (destructive)
POST http://localhost:8090/memory/clear
```

**Data Storage**:
- `./data/memory.json` — Main persistent memory
- `./data/memory_history.jsonl` — Audit trail of all operations

### 2. Watcher MCP (Port 8091)
**Purpose**: Monitor container health and auto-heal failures

**Features**:
- Real-time container status monitoring
- Auto-restart failed containers
- Persistent health snapshots
- Alert logging with actions taken

**Endpoints**:
```bash
# Health check
GET http://localhost:8091/

# Get all container status
GET http://localhost:8091/status

# Get last known health snapshot
GET http://localhost:8091/health

# View recent alerts
GET http://localhost:8091/alerts?limit=100

# Trigger immediate health check
POST http://localhost:8091/monitor

# Restart specific container
POST http://localhost:8091/container/{name}/restart

# Get container logs
POST http://localhost:8091/container/{name}/logs?tail=50
```

**Data Storage**:
- `./data/health.json` — Current health snapshot
- `./data/alerts.jsonl` — Alert history with timestamps

## 🚀 Quick Start

### Build MCP Agents
```bash
cd C:\code-heals-itself

# Build specific agents
docker compose build memory-mcp watcher-mcp

# Or build everything
docker compose build
```

### Start All Services
```bash
# Start LM Studio + Dashboard + MCP agents
docker compose up -d

# Verify services
docker compose ps
```

### Access MCP Agents
```bash
# Memory MCP status
curl http://localhost:8090/

# Watcher MCP status
curl http://localhost:8091/

# Check container health
curl http://localhost:8091/status

# Store memory entry
curl -X POST http://localhost:8090/memory \
  -H "Content-Type: application/json" \
  -d '{"key": "test", "value": "hello"}'

# Retrieve memory
curl -X POST http://localhost:8090/memory \
  -H "Content-Type: application/json" \
  -d '{"key": "test"}'
```

## 🧩 MCP Agent Configuration

### Memory MCP
```yaml
service: memory-mcp
image: code-heals-itself/memory-mcp:latest
ports:
  - "8090:8090"
volumes:
  - ./data:/data
environment: {}
```

### Watcher MCP
```yaml
service: watcher-mcp
image: code-heals-itself/watcher-mcp:latest
ports:
  - "8091:8091"
volumes:
  - ./data:/data
  - /var/run/docker.sock:/var/run/docker.sock:ro  # Docker access
environment: {}
```

## 🔗 Integration with LM Studio

### Add Memory MCP to LM Studio

1. Open **LM Studio** settings
2. Go to **MCP Connections** or **Server Connections**
3. Add new connection:
   ```
   Name: Memory MCP
   URL: http://localhost:8090
   Type: REST/JSON
   ```
4. Test connection:
   ```bash
   curl http://localhost:8090/
   ```

### Query Memory from LLM Prompt
```
You are a self-healing code system. 
Before fixing code, check memory for similar errors.

Use this endpoint:
POST http://memory-mcp:8090/memory
{"key": "similar_errors"}

Then store successful fixes:
POST http://memory-mcp:8090/memory
{"key": "successful_fixes", "value": "..."}
```

## 📊 Monitoring & Debugging

### View Container Logs
```bash
# Memory MCP
docker compose logs -f memory-mcp

# Watcher MCP
docker compose logs -f watcher-mcp

# All services
docker compose logs -f
```

### Enter Agent Container
```bash
# Access Memory MCP shell
docker compose exec memory-mcp bash

# Access Watcher MCP shell
docker compose exec watcher-mcp bash
```

### Check Memory Storage
```bash
# View all stored memory
docker compose exec memory-mcp cat /data/memory.json

# View operation history
docker compose exec memory-mcp tail -f /data/memory_history.jsonl
```

### Monitor Container Health
```bash
# View health snapshot
docker compose exec watcher-mcp cat /data/health.json

# View alerts
docker compose exec watcher-mcp tail -f /data/alerts.jsonl

# Check active containers
docker compose exec watcher-mcp docker ps
```

## 🛠️ Future MCP Agents

### 3. Code MCP (Planned)
```
Purpose: Analyze code, suggest refactors, detect anti-patterns
Ports: 8092
Features:
  - AST parsing
  - Complexity analysis
  - Code smell detection
  - Auto-fix suggestions
```

### 4. Web MCP (Planned)
```
Purpose: Scrape web pages, fetch documentation, search Stack Overflow
Ports: 8093
Features:
  - HTML scraping
  - Markdown conversion
  - Documentation caching
  - Answer retrieval
```

### 5. Git MCP (Planned)
```
Purpose: Git repository analysis, commit history, blame integration
Ports: 8094
Features:
  - Commit history
  - Author analysis
  - Hotspot identification
  - Revert suggestions
```

## 📈 Architecture Benefits

| Aspect | Benefit |
|--------|---------|
| **Isolation** | Each agent runs independently; failure doesn't cascade |
| **Persistence** | Memory survives across restarts |
| **Scalability** | Add new agents without modifying core system |
| **Observability** | Centralized logging and alerting |
| **Flexibility** | Mix languages (Python, Node, PHP) as needed |
| **Testability** | Each agent can be tested in isolation |

## 🧪 Testing Workflow

### Test Memory MCP
```bash
# 1. Start services
docker compose up -d memory-mcp

# 2. Store a value
curl -X POST http://localhost:8090/memory \
  -H "Content-Type: application/json" \
  -d '{"key": "test_error", "value": "NameError: undefined_var"}'

# 3. Retrieve it
curl -X POST http://localhost:8090/memory \
  -H "Content-Type: application/json" \
  -d '{"key": "test_error"}'

# 4. View history
curl http://localhost:8090/memory/history

# 5. Clean up
curl -X DELETE http://localhost:8090/memory/test_error
```

### Test Watcher MCP
```bash
# 1. Start services
docker compose up -d watcher-mcp

# 2. Check container status
curl http://localhost:8091/status

# 3. Trigger health check
curl -X POST http://localhost:8091/monitor

# 4. View alerts
curl http://localhost:8091/alerts

# 5. Check specific container logs
curl -X POST http://localhost:8091/container/code-heals-python/logs?tail=20
```

## 🔒 Security Considerations

- **CORS Enabled**: All MCP agents allow cross-origin requests (development only)
- **Docker Socket**: Watcher has read-only access to Docker socket
- **Data Directory**: Shared volume `/data` should be backed up regularly
- **Production**: Restrict CORS origins and add authentication

## 📝 Logging & Audit Trail

All operations are logged to persistent files:

- `./data/memory.json` — Current state
- `./data/memory_history.jsonl` — All memory operations (immutable)
- `./data/health.json` — Container health snapshots
- `./data/alerts.jsonl` — All system alerts (immutable)

## 🚨 Troubleshooting

### Memory MCP won't start
```bash
# Check logs
docker compose logs memory-mcp

# Verify data directory exists
ls -la ./data/

# Rebuild
docker compose build --no-cache memory-mcp
```

### Watcher MCP can't access Docker socket
```bash
# Fix permissions (on WSL)
sudo chown $USER:$USER /var/run/docker.sock

# Or run with elevated privileges
docker compose down
docker compose up -d watcher-mcp
```

### Memory operations fail
```bash
# Check data directory
docker compose exec memory-mcp ls -la /data/

# Verify file permissions
docker compose exec memory-mcp chmod 755 /data/

# Rebuild volume
docker compose down -v
docker compose up -d memory-mcp
```

---

**Next**: Run `docker compose up -d` to start all MCP agents, then test with the endpoints above!
