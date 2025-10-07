# 🤖 LLM Integration System

## Overview

The **code-heals-itself** project now includes a complete LLM evaluation framework that allows you to test different AI models against real error streams. This system supports multiple providers including local models (LM Studio, Ollama) and cloud providers (OpenAI, Anthropic, Google Gemini, Azure).

## Features

### ✨ Multi-Provider Support
- **LM Studio** (Local) - Run models on your machine
- **OpenAI** - GPT-3.5, GPT-4, etc.
- **Anthropic** - Claude 3 family
- **Ollama** (Local) - Open source models
- **Meta Llama** (Local) - Llama 2, Llama 3
- **Azure OpenAI** - Enterprise cloud
- **Google Gemini** - Gemini Pro
- **Custom** - Any OpenAI-compatible endpoint

### 🔒 Secure API Key Storage
- API keys encrypted with Fernet (AES-128)
- Keys stored in `artifacts/llm_settings.json`
- Encryption key stored separately in `artifacts/.llm_key`
- Restrictive file permissions (600)

### 🎛️ Dashboard Settings UI
- Beautiful glassmorphic design
- Provider selector with emoji icons
- Masked API key input with show/hide toggle
- Model selector (preconfigured for LM Studio)
- Temperature slider (0-2)
- Max tokens input
- Keep-alive ping configuration
- Test connection button
- Fetch models button
- Real-time feedback

### 🔌 API Endpoints

#### `GET /api/llm/settings`
Returns current settings (API key masked)

#### `POST /api/llm/settings`
Save new settings (validates and encrypts API key)

```json
{
  "provider": "lmstudio",
  "api_key": "",
  "base_url": "http://127.0.0.1:1234/v1",
  "model_name": "qwen3-32b",
  "temperature": 0.7,
  "max_tokens": 2000,
  "keep_alive": true,
  "keep_alive_interval": 300,
  "timeout": 30,
  "enabled": true
}
```

#### `GET /api/llm/test`
Test connection to configured provider

Returns:
```json
{
  "ping": {
    "ok": true,
    "provider": "lmstudio",
    "latency_ms": 12.34,
    "timestamp": "2025-10-08T02:00:00Z"
  },
  "models": ["qwen3-32b", "qwen2-33b", "llama-13b", ...]
}
```

#### `GET /api/llm/models`
Fetch available models from provider

#### `GET /api/llm/presets`
Get preconfigured model presets and provider list

## Architecture

### Files Structure

```
code-heals-itself/
├── clients/
│   └── llm_client.py          # Unified LLM client interface
├── llm_settings.py            # Settings storage with encryption
├── dashboard_dev_server.py    # Flask server with LLM endpoints
├── dashboard/
│   ├── index.html             # Settings tab UI
│   └── assets/
│       ├── app.js             # Settings tab JavaScript
│       └── style.css          # Settings form styles
└── artifacts/
    ├── llm_settings.json      # Encrypted settings
    └── .llm_key               # Encryption key (never commit!)
```

### LLMClient Class

The `LLMClient` class provides a unified interface for all providers:

```python
from clients.llm_client import LLMClient

# Create client
client = LLMClient(
    provider="lmstudio",
    base_url="http://127.0.0.1:1234/v1",
    model_name="qwen3-32b",
    temperature=0.7,
    max_tokens=2000
)

# Chat completion
messages = [
    {"role": "system", "content": "You are a helpful coding assistant."},
    {"role": "user", "content": "Fix this Python error: TypeError: 'int' object is not subscriptable"}
]
response = await client.chat(messages)
print(response["content"])

# Fetch models
models = await client.models()
print(models)

# Ping provider
ping = await client.ping()
print(f"Latency: {ping['latency_ms']}ms")

# Clean up
await client.close()
```

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

Required packages:
- `flask` - Web server
- `flask-cors` - CORS support
- `cryptography` - API key encryption
- `aiohttp` - Async HTTP client

### 2. Start the Dashboard Server

```bash
python dashboard_dev_server.py
```

Server starts on `http://127.0.0.1:5000`

### 3. Configure Your LLM Provider

1. Open dashboard: http://127.0.0.1:5000
2. Click **"⚙️ Settings"** tab
3. Select your provider (LM Studio is preconfigured)
4. Enter API key if required (local providers don't need keys)
5. Adjust base URL if needed
6. Select model
7. Set temperature and max tokens
8. Click **"🔍 Test Connection"** to verify
9. Click **"💾 Save Settings"**

### 4. (Optional) Set Up LM Studio

1. Download LM Studio: https://lmstudio.ai
2. Install one or more models (recommended: qwen3-32b, llama-13b)
3. Start local server (default: http://127.0.0.1:1234)
4. Use Settings tab to configure

## LM Studio Recommended Models

### 💎 Premium Tier (Best Quality)
- **Qwen 3 32B** (17.33GB) - Excellent coding & reasoning
- **Qwen 2 33B** (17.25GB) - Strong all-around performance
- **GPT-OSS 20B** (12.11GB) - Fast & capable

### ⚡ Standard Tier (Balanced)
- **Llama 13B** (7.41GB) - Good quality, reasonable speed
- **Llama 12B** (7.48GB) - Solid performance
- **Gemma2 9.2B** (5.76GB) - Efficient and accurate

### 🚀 Fast Tier (Quick Responses)
- **Llama 8B** (4.92GB) - Fast inference
- **Qwen 2 7B** (4.68GB) - Good speed/quality balance
- **Llama 7B** (4.08GB) - Lightweight

## Security Considerations

### API Key Encryption
- Uses Fernet (symmetric encryption with AES-128)
- Unique encryption key generated per installation
- Key file has restrictive permissions (owner read/write only)

### Never Commit:
- `artifacts/.llm_key` - Encryption key
- `artifacts/llm_settings.json` - May contain encrypted keys

### .gitignore Entries
```
artifacts/.llm_key
artifacts/llm_settings.json
```

## Usage Examples

### Test Connection from Python

```python
import asyncio
from clients.llm_client import LLMClient

async def test():
    client = LLMClient(
        provider="lmstudio",
        base_url="http://127.0.0.1:1234/v1",
        model_name="qwen3-32b"
    )
    
    try:
        # Ping
        result = await client.ping()
        print(f"Ping: {result}")
        
        # Get models
        models = await client.models()
        print(f"Models: {models}")
        
        # Chat
        response = await client.chat([
            {"role": "user", "content": "Hello!"}
        ])
        print(f"Response: {response['content']}")
    finally:
        await client.close()

asyncio.run(test())
```

### Load Settings from Storage

```python
from llm_settings import get_llm_settings_for_client

# Get settings with decrypted API key
settings = get_llm_settings_for_client()
print(settings)
```

### Save New Settings

```python
from llm_settings import save_llm_settings

settings = {
    "provider": "openai",
    "api_key": "sk-...",  # Will be encrypted
    "base_url": "https://api.openai.com/v1",
    "model_name": "gpt-3.5-turbo",
    "temperature": 0.7,
    "max_tokens": 2000
}

success = save_llm_settings(settings)
print(f"Saved: {success}")
```

## Future Enhancements

### Planned Features
- [ ] Live error stream testing
- [ ] Model performance benchmarking
- [ ] Cost tracking per provider
- [ ] Response time analytics
- [ ] A/B testing framework
- [ ] Automatic model selection
- [ ] Retry logic with fallback providers
- [ ] Rate limiting
- [ ] Request caching
- [ ] Streaming responses
- [ ] Token usage tracking
- [ ] Cost estimation

### Vision
The LLM integration system will evolve into a complete evaluation framework that:
1. Generates synthetic error streams
2. Sends them to multiple LLM providers
3. Compares responses for quality, speed, cost
4. Validates healing success rates
5. Provides recommendations on best models for different error types

## Troubleshooting

### "Connection Failed" Error
- Verify server is running (Flask on :5000)
- Check provider URL is correct
- For LM Studio: Ensure local server is started
- Check firewall/network settings

### "No Models Found"
- LM Studio: Start local server, load at least one model
- OpenAI/Anthropic: Verify API key is valid
- Check provider base URL

### "Failed to Save Settings"
- Check `artifacts/` directory exists and is writable
- Verify form validation (all required fields filled)
- Check browser console for errors

### API Key Not Persisting
- Ensure server has write permissions to `artifacts/`
- Check `llm_settings.json` exists and is readable
- Verify encryption key file `.llm_key` exists

## Support

For issues, questions, or contributions:
- GitHub Issues: https://github.com/shaunpalmer/code-heals-itself/issues
- Documentation: https://github.com/shaunpalmer/code-heals-itself/tree/main/docs

## License

MIT License - See LICENSE file for details
