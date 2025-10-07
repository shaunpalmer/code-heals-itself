# 🎯 Quick Start Guide: How to Start Keep-Alive

## Where to Find the Controls

The Keep-Alive controls are in the **Settings tab**. Here's the exact location:

```
Dashboard Home Page (http://127.0.0.1:5000)
│
├── Left Sidebar Navigation:
│   ├── Overview
│   ├── Envelopes
│   ├── Extensions
│   ├── Heartbeat
│   ├── Testing
│   └── ⚙️ Settings  <--- CLICK HERE
│       │
│       └── Scroll down to find:
│           │
│           ├── Provider Configuration (collapsed/expanded)
│           ├── Model Parameters (collapsed/expanded)
│           ├── Advanced Options (collapsed)
│           ├── [Test Connection] [Fetch Models] [Save Settings] buttons
│           ├── Connection Test Results (collapsed)
│           │
│           ├── 🔄 Keep-Alive Control  <--- THIS IS WHAT YOU NEED
│           │   │
│           │   ├── Status Bar:
│           │   │   ├── 🔴 Not Running
│           │   │   └── Uptime: (empty)
│           │   │
│           │   ├── Buttons:
│           │   │   ├── ▶️ Start Keep-Alive   <--- CLICK THIS TO START
│           │   │   ├── ⏸️ Stop Keep-Alive    (disabled until started)
│           │   │   └── 🔄 Refresh Status
│           │   │
│           │   └── Last Ping: No pings yet
│           │
│           └── Keep-Alive Logs (Last 20) (collapsed)
```

## Step-by-Step Instructions

### **1. Open the Dashboard**
```
Open your browser and go to:
http://127.0.0.1:5000
```

### **2. Click Settings Tab**
Look at the **left sidebar** and click the last item: **"⚙️ Settings"**

### **3. Scroll Down**
Scroll down past these sections:
- ✅ Provider Configuration
- ✅ Model Parameters  
- ✅ Advanced Options
- ✅ Three buttons (Test Connection, Fetch Models, Save Settings)
- ✅ Connection Test Results

### **4. Find "🔄 Keep-Alive Control"**
You'll see a collapsible panel with this title. If it's collapsed, click it to expand.

### **5. Click the Green Button**
Click: **▶️ Start Keep-Alive**

### **6. Watch the Magic**
You'll see:
- Status changes from 🔴 **Not Running** → 🟢 **Running**
- Top bar indicator changes from 🔴 **Disconnected** → 🟢 **Connected**
- Uptime counter starts: "0 min 1 sec"
- After a few seconds, "Last Ping" shows results with latency
- Logs panel starts filling with ping entries

## What Each Button Does

### **▶️ Start Keep-Alive** (Green)
- Starts background thread that pings your LLM provider
- Interval: Every 5 minutes (configurable in Advanced Options)
- Shows real-time latency and connection status
- Auto-refresh every 10 seconds

### **⏸️ Stop Keep-Alive** (Red)
- Stops the background thread
- Only enabled when keep-alive is running
- Gracefully shuts down without data loss

### **🔄 Refresh Status** (Gray)
- Manually refreshes status from server
- Shows current uptime and last ping
- Useful if auto-refresh is slow

## Visual Status Indicators

### **Top Bar (Global)**
- 🔴 **Disconnected** - Keep-alive not running
- 🟡 **Connecting** - Keep-alive starting
- 🟢 **Connected** - Keep-alive running successfully
- 🔴 **Error** - Keep-alive encountered an error

### **Keep-Alive Control Panel**
- 🔴 **Not Running** - Stopped
- 🟡 **Starting...** - Initializing
- 🟢 **Running** - Active and pinging
- 🔴 **Error** - Failed (shows error message)

## Troubleshooting

### **Can't Find Settings Tab**
- Make sure server is running: `python dashboard_dev_server.py`
- Refresh browser page (F5)
- Check left sidebar - it's the last item with ⚙️ icon

### **Button is Grayed Out**
- If "Start" is disabled: Keep-alive is already running
- If "Stop" is disabled: Keep-alive is not running
- Click "Refresh Status" to update

### **No Pings Showing**
- Check if LM Studio is running at http://127.0.0.1:1234
- Or configure a different provider (OpenAI, Anthropic, etc.)
- Check browser console (F12) for JavaScript errors

### **"Connection Failed" Error**
- Verify LLM provider is running:
  - LM Studio: Start local server
  - OpenAI: Check API key is valid
  - Ollama: Start ollama server
- Check base URL in Provider Configuration
- Test connection first with "Test Connection" button

## Expected Behavior

### **When You Click Start:**
1. Button shows "▶️ Start Keep-Alive"
2. You click it
3. Status changes to 🟡 "Starting..."
4. Within 1-2 seconds: 🟢 "Running"
5. Uptime counter starts: "0 min 2 sec"
6. First ping happens immediately
7. "Last Ping" shows: "✅ lmstudio (12.34ms) at 2:45:32 PM"
8. Logs panel shows entry with timestamp
9. Every 5 minutes, new ping happens
10. Status auto-refreshes every 10 seconds

### **When You Click Stop:**
1. Status changes to 🔴 "Not Running"
2. Top bar changes to 🔴 "Disconnected"
3. Logs stop updating
4. Last ping remains visible
5. Uptime counter stops

## Quick Test

Want to test right now?

1. **Start Flask server** (if not running):
   ```bash
   python dashboard_dev_server.py
   ```

2. **Open browser**:
   ```
   http://127.0.0.1:5000
   ```

3. **Navigate**: Sidebar → ⚙️ Settings → Scroll to "🔄 Keep-Alive Control"

4. **Click**: ▶️ Start Keep-Alive

5. **Watch**: Status should change to 🟢 within 2 seconds

## API Endpoints (if you want to test programmatically)

```bash
# Start keep-alive
curl -X POST http://127.0.0.1:5000/api/keepalive/start

# Check status
curl http://127.0.0.1:5000/api/keepalive/status

# Stop keep-alive
curl -X POST http://127.0.0.1:5000/api/keepalive/stop

# Get full logs
curl http://127.0.0.1:5000/api/keepalive/logs
```

---

## Screenshots (Text Description)

### **Before Starting:**
```
┌─────────────────────────────────────────────┐
│ 🔄 Keep-Alive Control                       │
├─────────────────────────────────────────────┤
│ Status: 🔴 Not Running                      │
│ Uptime:                                     │
│                                             │
│ [▶️ Start Keep-Alive]                       │
│ [⏸️ Stop Keep-Alive] (grayed out)          │
│ [🔄 Refresh Status]                         │
│                                             │
│ Last Ping: No pings yet                     │
└─────────────────────────────────────────────┘
```

### **After Starting:**
```
┌─────────────────────────────────────────────┐
│ 🔄 Keep-Alive Control                       │
├─────────────────────────────────────────────┤
│ Status: 🟢 Running                          │
│ Uptime: 2 min 34 sec                        │
│                                             │
│ [▶️ Start Keep-Alive] (grayed out)          │
│ [⏸️ Stop Keep-Alive]                        │
│ [🔄 Refresh Status]                         │
│                                             │
│ Last Ping: ✅ lmstudio (12.34ms)            │
│            at 2:45:32 PM                    │
└─────────────────────────────────────────────┘
```

---

**TL;DR**: 
1. Open http://127.0.0.1:5000
2. Click **⚙️ Settings** (left sidebar, last item)
3. Scroll down to **🔄 Keep-Alive Control**
4. Click **▶️ Start Keep-Alive** (green button)
5. Done! Watch it work in real-time.
