# Load Defaults Feature

## What It Does

Added a "📥 Load Defaults" button to the Settings page that populates all LLM configuration fields with pre-configured defaults from `config.default.json`.

## User Experience

1. **Go to Settings tab** in the dashboard
2. **Click "📥 Load Defaults"** button
3. **All fields populate instantly** with:
   - Provider: LM Studio
   - Base URL: http://127.0.0.1:1234/v1
   - Model: qwen2.5-coder-7b-instruct
   - Keep-Alive: Enabled (5 minutes)
   - All other sensible defaults
4. **Click "💾 Save Settings"** to apply

## Why It's Useful

- **First-time setup**: Get working config in 2 clicks instead of typing everything
- **Reset to known-good**: When things break, quickly reset to defaults
- **3rd+ time convenience**: As you mentioned - for repeated setups, this saves tons of time

## Technical Details

### Files Modified

1. **dashboard/index.html**
   - Added "Load Defaults" button to settings panel (line ~486)

2. **dashboard_dev_server.py**
   - Added `/api/llm/defaults` endpoint that serves `config.default.json`
   - Falls back to built-in defaults if file doesn't exist

3. **dashboard/assets/app.js**
   - Added `API.getLLMDefaults()` function
   - Added button handler that:
     - Fetches defaults from API
     - Populates ALL form fields (provider, URL, model, timeouts, keep-alive, etc.)
     - Updates UI based on provider type
     - Shows success message

### API Endpoint

```
GET /api/llm/defaults
```

Returns the `llm` section from `config.default.json` or built-in defaults.

## Testing

1. Server running at http://127.0.0.1:5000
2. Go to Settings tab
3. Click "Load Defaults"
4. Verify all fields populate
5. Click "Save Settings" to apply

## Future Enhancements

Could add:
- Multiple preset profiles (development, production, testing)
- "Export Current Settings" to save your own presets
- Preset selector dropdown
