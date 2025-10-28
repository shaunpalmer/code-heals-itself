# Docker MCP Container Architecture for Code-Heals-Itself

## 🏗️ Architecture Overview

This setup containerizes the entire self-healing code system with Model Context Protocol (MCP) agents:

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Network: healing-network           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  LM Studio   │◄───┤ Python Agent │◄───┤  Dashboard   │  │
│  │  (Port 1234) │    │  (Healing)   │    │  (Port 5000) │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         ▲                    ▲                    │         │
│         │                    │                    │         │
│         │            ┌──────────────┐             │         │
│         │            │  Re-Banker   │             │         │
│         │            │  (Analysis)  │             │         │
│         │            └──────────────┘             │         │
│         │                    ▲                    │         │
│         │                    │                    │         │
│         │            ┌──────────────┐             │         │
│         └────────────┤   Watcher    │◄────────────┘         │
│                      │ (Supervisor) │                       │
│                      └──────────────┘                       │
│                                                              │
│  ┌──────────────┐                                           │
│  │  PHP Agent   │ (Optional - future PHP branch)           │
│  │  (Profile)   │                                           │
│  └──────────────┘                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### 1. Start all services
```bash
docker compose up -d
```

### 2. Start specific services
```bash
# Core services only
docker compose up -d lmstudio python-agent dashboard

# With PHP agent
docker compose --profile php up -d

# With monitoring
docker compose --profile monitoring up -d watcher
```

### 3. View logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f python-agent
docker compose logs -f dashboard
```

### 4. Stop services
```bash
docker compose down
```

## 🧠 VS Code Dev Container Integration

### Open in VS Code Container

1. Install VS Code extensions:
   - Docker (ms-azuretools.vscode-docker)
   - Dev Containers (ms-vscode-remote.remote-containers)
   - Remote - WSL (ms-vscode-remote.remote-wsl)

2. Open command palette (`Ctrl+Shift+P`) and run:
   ```
   Dev Containers: Reopen in Container
   ```

3. VS Code will:
   - Build the Python container
   - Start LM Studio and Dashboard services
   - Mount your workspace at `/workspace`
   - Forward ports 5000 (Dashboard) and 1234 (LM Studio)
   - Install all Python dependencies
   - Configure Python linting and formatting

### Benefits
- **Isolated Environment**: All dependencies contained
- **Consistent Setup**: Same environment across machines
- **Visual Debugging**: Full VS Code debugger support inside container
- **Live Reload**: Changes sync automatically
- **Port Forwarding**: Access services on localhost

## 📦 Container Services

### LM Studio (Port 1234)
- **Purpose**: OpenAI-compatible LLM API server
- **Model**: openai/gpt-oss-20b
- **Configuration**: 
  - Context size: 6000 tokens
  - Threads: 8
  - Temperature: 0.4-1.15 (ramped)

### Python Agent
- **Purpose**: Main healing orchestrator
- **Features**:
  - Iterative healing loop
  - Re-banker integration
  - Envelope persistence
  - Success pattern knowledge base

### Dashboard (Port 5000)
- **Purpose**: Real-time monitoring web UI
- **Features**:
  - Live healing status
  - Knowledge base visualization
  - Success pattern analytics
  - Auto-refresh (2s/10s intervals)

### Re-Banker
- **Purpose**: Error analysis and classification
- **Output**: Structured JSON with:
  - Error type (RES.*, SYN.*, LOG.*)
  - Confidence scores
  - Contextual hints
  - Cluster IDs

### Watcher (Optional)
- **Purpose**: Supervisor for all agents
- **Features**:
  - Health checks
  - Auto-restart failed services
  - Log aggregation
  - Performance metrics

### PHP Agent (Optional)
- **Purpose**: PHP branch healing (future)
- **Status**: Profile-based (start with `--profile php`)

## 🔧 Configuration

### Environment Variables
Edit `docker-compose.yml` to customize:

```yaml
environment:
  - LLM_API_URL=http://lmstudio:8080/v1
  - MODEL=/models/your-model.gguf
  - THREADS=8
  - CONTEXT_SIZE=6000
  - FLASK_ENV=development
```

### Volume Mounts
- `./:/workspace` - Code and configs
- `./data:/data` - Logs, envelopes, patterns
- `./envelope_storage.db` - SQLite knowledge base
- `./models:/models` - LLM model files

### Network
All services communicate via `healing-network` bridge:
- Service discovery by name (e.g., `http://lmstudio:8080`)
- Isolated from host network
- Internal DNS resolution

## 🧪 Testing

### Run hello-world
```bash
docker run --rm hello-world
```

### Test healing loop
```bash
docker compose exec python-agent python ai-debugging.py test_mid_range_bug.py
```

### Test dashboard
```bash
curl http://localhost:5000/health
```

### Test LM Studio
```bash
curl http://localhost:1234/v1/models
```

## 📊 Monitoring

### Check container status
```bash
docker compose ps
```

### View resource usage
```bash
docker stats
```

### Inspect logs
```bash
# Last 50 lines
docker compose logs --tail=50

# Follow new logs
docker compose logs -f python-agent

# Search logs
docker compose logs | grep "ERROR"
```

## 🐛 Troubleshooting

### Container won't start
```bash
# Check logs
docker compose logs <service-name>

# Rebuild image
docker compose build --no-cache <service-name>

# Remove and recreate
docker compose down
docker compose up -d
```

### Port already in use
```bash
# Find process using port
netstat -ano | findstr :5000

# Kill process or change port in docker-compose.yml
```

### Permission issues
```bash
# Fix volume permissions (WSL)
sudo chown -R $USER:$USER ./data
```

### Network issues
```bash
# Recreate network
docker compose down
docker network prune
docker compose up -d
```

## 🎯 Next Steps

1. ✅ Verify Docker is running
2. ✅ Build containers: `docker compose build`
3. ✅ Start services: `docker compose up -d`
4. ✅ Open in VS Code Dev Container
5. ✅ Test healing: `python ai-debugging.py test_syntax_error.py`
6. ✅ Monitor dashboard: http://localhost:5000

## 📚 Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [VS Code Dev Containers](https://code.visualstudio.com/docs/devcontainers/containers)
- [Docker for GitHub Copilot](https://www.docker.com/products/github-copilot/)
- [LM Studio API](https://lmstudio.ai/docs)

---

**Built with:** Docker 28.5.1, Python 3.12, Flask, SQLite, LM Studio  
**Architecture:** Envelope-guided, delta-gradient, re-banker powered self-healing
