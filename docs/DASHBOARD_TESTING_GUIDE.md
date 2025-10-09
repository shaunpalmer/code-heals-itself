# Dashboard Testing Guide

## Quick Start

### 1. Start the Dashboard
```powershell
cd C:\code-heals-itself
python dashboard_dev_server.py
```

**Expected Output:**
```
2025-10-09 19:33:15 [INFO] Dashboard Development Server Starting
2025-10-09 19:33:15 [INFO] Dashboard UI: http://127.0.0.1:5000
2025-10-09 19:33:15 [INFO] API endpoints ready on port 5000
2025-10-09 19:33:15 [INFO] Health check: http://127.0.0.1:5000/health
2025-10-09 19:33:15 [INFO] Auto-restart enabled
 * Running on http://127.0.0.1:5000
```

### 2. Open Dashboard
**Chrome:** http://127.0.0.1:5000  
**Firefox:** http://127.0.0.1:5000

### 3. Open DevTools (F12)
Check the Console tab for:
- `Dashboard Enhancements Module Loaded` ✅
- `Initializing dashboard enhancements...` ✅
- `Dashboard enhancements initialized ✓` ✅
- `Auto-refresh started: Healing (2s), Knowledge Base (10s)` ✅

## What to Test

### ✅ Navigation
1. Click each navigation item:
   - Overview ✓
   - 🧠 Knowledge Base ✓
   - Envelopes ✓
   - Extensions ✓
   - Heartbeat ✓
   - Testing ✓
   - ⚙️ Settings ✓

### ✅ Overview Panel
**Widgets (top row):**
1. Healing Success - should show percentage
2. Breaker Status - should show status text
3. Pending Reviews - should show number
4. **Healing Status** (NEW) - should show ⚪ Idle or 🟢 Active
5. **Knowledge Base** (NEW) - should show pattern count

**Real-Time Healing Flow Panel (NEW):**
- Status indicator with pulse animation
- Flow status message
- Patterns list (if healing active)
- Auto-updates every 2 seconds

### ✅ Knowledge Base View (NEW)
**Stats Cards:**
- Total Patterns
- Gold Standard (≥0.9)
- Average Confidence
- Total Successes

**Top Patterns Panel:**
- Shows patterns sorted by success count
- Gold badge (⭐) for GOLD_STANDARD patterns
- Success count badges (e.g., `10×`)
- Confidence percentages
- Tags displayed

**Recent Patterns Panel:**
- Shows patterns from last 24 hours
- Time ago format (e.g., "2h ago")
- Success counts and confidence

**Patterns by Family Panel:**
- Error families (RES, LOG, SYN, etc.)
- Pattern count per family
- Total successes per family

### ✅ Auto-Refresh Testing
**Network Tab (F12 → Network):**
1. Watch for requests every 2 seconds:
   - `GET /api/healing/status` ✓
2. Watch for requests every 10 seconds:
   - `GET /api/success-patterns/stats` ✓

**Should see:**
- Status 200 OK for all requests
- Response sizes:
  - healing/status: ~200-500 bytes
  - success-patterns/stats: ~2-10 KB

### ✅ Tab Visibility Test
1. Switch to another tab
2. Wait 5 seconds
3. Switch back
4. **Expected:** Auto-refresh should resume
5. **Check DevTools Console:**
   - `Auto-refresh stopped` (when tab hidden)
   - `Auto-refresh started` (when tab visible)

### ✅ Error Handling Test
1. Stop the dashboard server (Ctrl+C)
2. **Expected in browser:**
   - Healing Status: 🔴 Error
   - Flow panel: "Connection Error"
   - Knowledge Base: Shows last cached data
3. **Check DevTools Console:**
   - Should see error messages (not crashes)
   - UI should remain responsive

## API Endpoint Testing

### Health Check
```powershell
curl http://127.0.0.1:5000/health
```
**Expected:**
```json
{
  "status": "healthy",
  "storage": "ok",
  "timestamp": "2025-10-09T19:33:15.123456",
  "uptime": 123.45
}
```

### Healing Status
```powershell
curl http://127.0.0.1:5000/api/healing/status
```
**Expected (no active healing):**
```json
{
  "active": false,
  "last_heal": null,
  "message": "No healing runs recorded yet"
}
```

**Expected (active healing):**
```json
{
  "active": true,
  "last_heal": "2025-10-09T19:35:00Z",
  "age_seconds": 2.3,
  "last_status": "PROMOTED",
  "last_error": "RES.NAME_ERROR",
  "patterns_available": 3,
  "patterns": [
    {
      "error_code": "RES.NAME_ERROR",
      "cluster_id": "RES.NAME_ERROR:requests",
      "fix_description": "Import requests library",
      "success_count": 10,
      "avg_confidence": 0.94,
      "fallback_level": "cluster"
    }
  ]
}
```

### Success Patterns Stats
```powershell
curl http://127.0.0.1:5000/api/success-patterns/stats
```
**Expected:**
```json
{
  "stats": {
    "total_patterns": 15,
    "gold_standard": 3,
    "high_confidence": 7,
    "verified": 12,
    "avg_confidence": 0.847,
    "total_successes": 142
  },
  "by_family": [
    {
      "family": "RES",
      "pattern_count": 8,
      "total_successes": 95
    }
  ],
  "top_patterns": [...],
  "recent_patterns": [...]
}
```

## Browser Compatibility Testing

### Chrome DevTools
1. Open DevTools (F12)
2. Check **Console** tab:
   - No red errors ✓
   - Module loaded messages ✓
3. Check **Network** tab:
   - All requests 200 OK ✓
   - CORS headers present ✓
4. Check **Application** tab:
   - No localStorage errors ✓

### Firefox DevTools
1. Open DevTools (F12)
2. Check **Console** tab:
   - No red errors ✓
   - Module loaded messages ✓
3. Check **Network** tab:
   - All requests 200 OK ✓
   - CORS headers present ✓
4. **Check CORS specifically:**
   - Look for `Access-Control-Allow-Origin` headers
   - Should be: `http://127.0.0.1:5000` (not `*`)

## Performance Testing

### Memory Usage
**DevTools → Performance → Memory:**
1. Start recording
2. Let dashboard run for 5 minutes
3. Stop recording
4. **Expected:**
   - No memory leaks
   - Heap size should stabilize
   - GC should happen periodically

### Network Usage
**DevTools → Network (5 minute test):**
- Healing status requests: ~30 requests (2s interval)
- Pattern stats requests: ~30 requests (10s interval)
- Total data transferred: ~1-2 MB
- **Expected:** Minimal bandwidth usage

## Common Issues & Solutions

### Issue: Server won't start (Port in use)
**Solution:**
```powershell
# Kill existing Python processes
Get-Process python | Stop-Process -Force
# Or use different port (edit dashboard_dev_server.py)
```

### Issue: CORS errors in browser
**Symptoms:** `Cross-Origin Request Blocked` in console
**Solution:**
- Check URL is exactly `http://127.0.0.1:5000` (not `localhost`)
- Verify CORS headers in Network tab
- Restart server

### Issue: Auto-refresh not working
**Check:**
1. DevTools Console for JavaScript errors
2. Network tab - are requests being made?
3. Try manually calling: `DashboardEnhancements.startAutoRefresh()`

### Issue: Knowledge Base shows "Loading..."
**Check:**
1. Is server running?
2. Network tab - is `/api/success-patterns/stats` returning 200?
3. DevTools Console - any errors?
4. Try: `DashboardEnhancements.updateKnowledgeBase()`

### Issue: Healing Status stuck on "Idle"
**This is normal!** Healing status only shows "Active" when:
- An error occurred within last 30 seconds
- AND an envelope was created

**To test active healing:**
```powershell
# Run a healing attempt (in separate terminal)
python ai-debugging.py <some_file_with_error.py>
```

## Manual Testing Checklist

- [ ] Server starts without errors
- [ ] Dashboard loads in Chrome
- [ ] Dashboard loads in Firefox
- [ ] All navigation items work
- [ ] Overview widgets display data
- [ ] Healing Status widget updates
- [ ] Knowledge Base view loads
- [ ] Stats cards show numbers
- [ ] Top patterns panel shows patterns
- [ ] Recent patterns panel shows patterns
- [ ] Family distribution panel shows families
- [ ] Auto-refresh working (Network tab)
- [ ] Tab visibility detection working
- [ ] Server shutdown graceful (Ctrl+C)
- [ ] Health endpoint returns 200
- [ ] No JavaScript errors in console
- [ ] No CORS errors
- [ ] Memory usage stable
- [ ] Network usage reasonable

## Success Criteria

✅ **Server Stability:**
- Starts without errors
- Auto-restarts on crashes
- Graceful shutdown works
- No crash loops

✅ **Dashboard Functionality:**
- All views accessible
- All panels display data
- Auto-refresh working
- No JavaScript errors

✅ **Performance:**
- < 200ms API response times
- Stable memory usage
- < 50 KB/min network usage
- Smooth UI interactions

✅ **Cross-Browser:**
- Works in Chrome
- Works in Firefox
- CORS configured correctly
- No console errors

## Next Steps After Testing

1. **If all tests pass:**
   - Mark todo item complete ✅
   - Consider testing with real healing runs
   - Document any browser-specific issues

2. **If issues found:**
   - Document the issue
   - Check DevTools Console for errors
   - Review Network tab responses
   - Check server logs (dashboard.log)

3. **For production deployment:**
   - Switch from development server to production WSGI
   - Add authentication
   - Configure proper CORS origins
   - Set up monitoring and logging

---

**Testing Duration:** ~15-20 minutes  
**Required Tools:** Chrome/Firefox, PowerShell  
**Server:** http://127.0.0.1:5000
