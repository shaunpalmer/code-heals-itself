# 🎬 QUICK START: MCP Toolkit Installation Guide

**Current Status**: 5/6 containers running, all MCP endpoints ready for auto-discovery  
**Objective**: Install Docker MCP Toolkit (Beta) and auto-register your services  
**Time**: 2-3 minutes

---

## ✅ YOUR SYSTEM RIGHT NOW

```
🟢 memory-mcp (8090)      ✅ Running & responding
🟢 watcher-mcp (8091)     ✅ Running & responding  
🟢 dashboard (5000)       ✅ Running & responding
🟢 python-agent           ✅ Running & responsive
🟡 lmstudio               ⏳ Restarting (model loading)
🔴 lmstudio-mcp-proxy    ⏸️ Image unavailable (beta)
```

Network: `healing-network` ✅ All services interconnected

---

## 🚀 STEP-BY-STEP: Install MCP Toolkit

### STEP 1️⃣ — Open Docker Desktop

- Click Docker Desktop in system tray
- Wait for it to fully load (you'll see "Docker Desktop is running")

### STEP 2️⃣ — Go to Extensions Tab

1. Click the **Extensions** tab (on the left sidebar)
2. You'll see an "Extensions Marketplace" view

### STEP 3️⃣ — Search for "MCP Toolkit"

1. In the search box, type: **`MCP Toolkit`**
2. You'll see results

### STEP 4️⃣ — Install the BETA Version

⚠️ **IMPORTANT**: Click on **"MCP Toolkit (Beta)"** (NOT the deprecated older one)

You'll see:
- **MCP Toolkit** (old, deprecated) ← ❌ Don't install this
- **MCP Toolkit (Beta)** ← ✅ **INSTALL THIS ONE**

Click the **"Install"** button on the Beta version.

### STEP 5️⃣ — Wait for Installation

- It will download and install (30-60 seconds)
- You'll see a **checkmark** when complete
- A new panel called "MCP Toolkit" appears in the left sidebar

### STEP 6️⃣ — Open the MCP Toolkit Panel

Click on the **MCP Toolkit** icon/panel in the left sidebar (looks like 🧩).

You should see something like:

```
┌────────────────────────────────────┐
│  MCP Toolkit (Beta)                │
├────────────────────────────────────┤
│ MCP Services Discovered: 3         │
│                                    │
│ 📦 memory-mcp                      │
│  ✅ Status: Running                │
│  🔗 http://localhost:8090         │
│  📝 Type: FastAPI                 │
│                                    │
│ 📦 watcher-mcp                     │
│  ✅ Status: Running                │
│  🔗 http://localhost:8091         │
│  📝 Type: FastAPI                 │
│                                    │
│ 📦 dashboard                       │
│  ✅ Status: Running                │
│  🔗 http://localhost:5000         │
│  📝 Type: Flask                    │
│                                    │
│ 🔄 Refresh | ⚙️ Settings           │
└────────────────────────────────────┘
```

---

## ✅ SUCCESS CRITERIA

Once MCP Toolkit is open, you should see:

- ✅ **"MCP Services Discovered: 3"**
- ✅ **memory-mcp** listed (Status: Running)
- ✅ **watcher-mcp** listed (Status: Running)
- ✅ **dashboard** listed (Status: Running)

---

## 🔍 VERIFICATION: Check LM Studio Settings

Once the MCP Toolkit panel shows your 3 services:

1. Open **LM Studio** locally (if installed)
2. Go to **Settings** → **MCP Connections**
3. You should see a new section: **"Docker MCP Toolkit Registry"**
4. It will list the 3 services as available context sources

---

## 🎯 WHAT THIS MEANS

Once you see those 3 services in the MCP Toolkit panel:

✅ **Auto-discovery working** — MCP Toolkit found your containers automatically  
✅ **Network registration complete** — Services are discoverable on healing-network  
✅ **Ready for next phase** — Can deploy Healing Agent (8092) and Re-Banker (8093)  
✅ **Copilot integration ready** — LM Studio can now query your MCP endpoints standardly

---

## ⏭️ NEXT ACTIONS (After Toolkit is Installed)

1. **Confirm** the 3 services appear in the MCP Toolkit panel
2. **Check** LM Studio Settings → MCP Connections
3. **Report back**: "MCP Toolkit installed and services discovered ✅"
4. **Then deploy**: Healing Agent MCP (port 8092)

---

## 🆘 TROUBLESHOOTING

### "I don't see MCP Toolkit in Extensions"

1. Restart Docker Desktop completely
2. Go to Extensions → Search again
3. Make sure you're searching for **(Beta)** version

### "I see 3 services but they show as 'Not Running'"

1. In a terminal, run: `docker compose ps`
2. Verify all 5 containers show **"Up"** status
3. MCP Toolkit should refresh automatically (or click Refresh button)

### "LM Studio doesn't show the Docker registry"

1. Verify LM Studio is running (local or container)
2. Go to Settings → MCP Connections
3. Click "Add Connection" if needed
4. Select "Docker MCP Toolkit Registry"

---

## 📞 READY?

When you've installed the MCP Toolkit and confirmed you see the 3 services in the panel, message back and we'll proceed to **Phase 5: Deploy Healing Agent + Re-Banker MCPs** 🚀

---

**Time to complete**: 2-3 minutes  
**Difficulty**: Very easy  
**Next milestone**: Healing Agent (8092) + Re-Banker (8093) MCP deployment
