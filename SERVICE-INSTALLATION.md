# Windows Service Installation

Run the dashboard as a Windows service that starts automatically on boot.

## Prerequisites

1. **Download NSSM** (Non-Sucking Service Manager)
   - Visit: https://nssm.cc/download
   - Download the latest version (2.24+)
   - Extract `nssm.exe` from the `win64` folder to this directory

2. **Administrator Access**
   - You must run PowerShell as Administrator

## Installation

1. **Download NSSM**
   ```powershell
   # Place nssm.exe in this folder
   ```

2. **Install Service**
   ```powershell
   # Right-click PowerShell → "Run as Administrator"
   cd c:\code-heals-itself
   .\install-service.ps1
   ```

3. **The script will:**
   - Create a Windows service named "CodeHealsItself"
   - Configure it to start automatically on boot
   - Set up logging to `service.log` and `service-error.log`
   - Optionally start the service immediately

## Service Management

### Start Service
```powershell
net start CodeHealsItself
```

### Stop Service
```powershell
net stop CodeHealsItself
```

### Restart Service
```powershell
net stop CodeHealsItself
net start CodeHealsItself
```

### Check Status
```powershell
Get-Service CodeHealsItself
```

### View Logs
```powershell
Get-Content service.log -Tail 50
Get-Content service-error.log -Tail 50
```

## Uninstallation

```powershell
# Right-click PowerShell → "Run as Administrator"
cd c:\code-heals-itself
.\uninstall-service.ps1
```

## Manual Service Management (GUI)

1. Press `Win + R`
2. Type `services.msc` and press Enter
3. Find "Code Heals Itself Dashboard"
4. Right-click → Properties to configure
5. Right-click → Start/Stop to control

## Troubleshooting

### Service won't start
- Check `service-error.log` for errors
- Verify Python is in system PATH
- Ensure port 5000 is not in use

### Service starts but dashboard unreachable
- Check firewall settings
- Verify LM Studio is running (if using)
- Check `service.log` for connection errors

### Service stops unexpectedly
- Check Windows Event Viewer (Application logs)
- Review `service-error.log`
- Ensure all dependencies are installed

## Configuration

The service uses:
- **Service Name**: CodeHealsItself
- **Display Name**: Code Heals Itself Dashboard
- **Start Type**: Automatic
- **Port**: 5000
- **Logs**: service.log, service-error.log (rotates at 1MB)

## Alternative: Task Scheduler (No NSSM)

If you can't use NSSM, use Windows Task Scheduler:

1. Open Task Scheduler
2. Create Task → General tab:
   - Name: Code Heals Itself
   - Run whether user is logged on or not
   - Run with highest privileges
3. Triggers tab:
   - New → At startup
4. Actions tab:
   - New → Start a program
   - Program: `C:\Python3X\python.exe`
   - Arguments: `dashboard_dev_server.py`
   - Start in: `c:\code-heals-itself`
5. Settings tab:
   - Allow task to be run on demand
   - If task fails, restart every 1 minute
   - Stop task if runs longer than: (unchecked)

## Access Dashboard

Once running as a service:
- Dashboard: http://127.0.0.1:5000
- Health Check: http://127.0.0.1:5000/health
- API: http://127.0.0.1:5000/api/*

The service runs in the background and survives reboots.
