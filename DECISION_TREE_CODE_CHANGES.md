# DECISION TREE: Code Changes for Each Option

## CURRENT STATE (Your System Now)

```yaml
# docker-compose.yml - Current

lmstudio:
  image: ghcr.io/ggerganov/llama.cpp:server
  container_name: code-heals-lmstudio
  ports:
    - "1234:8080"
  # ... (crashes every 22 seconds)

python-agent:
  environment:
    - LLM_API_URL=http://lmstudio:8080/v1  # Points to broken container
    # (This is why system is degraded)
```

**Status**: Container keeps crashing, system falls back to degraded mode

---

## OPTION A: CLEAN SYSTEM

### Changes needed:

**File: docker-compose.yml**

```diff
- lmstudio:
-   image: ghcr.io/ggerganov/llama.cpp:server
-   container_name: code-heals-lmstudio
-   ports:
-     - "1234:8080"
-   volumes:
-     - ./models:/models
-   # ... entire section commented out or removed

  python-agent:
+   environment:
+     - LLM_API_URL=http://host.docker.internal:1234/v1

  rebanker:
+   environment:
+     - LLM_API_URL=http://host.docker.internal:1234/v1

  dashboard:
+   environment:
+     - LLM_API_URL=http://host.docker.internal:1234/v1
```

### Result:
```
✅ docker-compose up -d
✅ No container errors
✅ All services use LOCAL LM Studio
✅ All 14 models available
```

### Decision tree flow:
```
Check LOCAL (1234)
  ✅ Found (your LM Studio running)
  → Use it
  → Done
```

---

## OPTION B: HYBRID (RECOMMENDED)

### Changes needed:

**File: docker-compose.yml**

```diff
  lmstudio:
    image: ghcr.io/ggerganov/llama.cpp:server
    container_name: code-heals-lmstudio
    ports:
      - "1234:8080"
    # ... (keep as-is, will be backup)

  python-agent:
    environment:
+     - LLM_API_URL=http://host.docker.internal:1234/v1

  rebanker:
    environment:
+     - LLM_API_URL=http://host.docker.internal:1234/v1

  dashboard:
    environment:
+     - LLM_API_URL=http://host.docker.internal:1234/v1
```

### That's it! Just add those env vars.

### Result:
```
✅ docker-compose up -d
✅ Uses LOCAL LM Studio (all 14 models)
✅ Container runs in background (as backup)
⚠️  Container crashes visible in logs (ignored)
```

### Decision tree flow:
```
Check LOCAL (1234)
  ✅ Found (your LM Studio running)
  → Use it
  
(If LOCAL ever crashes:)
  Check CONTAINER (8080)
    ✅ Available (backup)
    → Switch to it
```

---

## OPTION C: CONTAINERIZED ONLY

### Changes needed:

**Step 1: Get the model file**

```bash
# Copy openai/gpt-oss-20b model (you have 14 models)
# Assume it's in: G:\LMStudio_Models\models\openai--gpt-oss-20b

# Copy to Docker location:
mkdir -p .\models\7B
copy "G:\LMStudio_Models\models\openai--gpt-oss-20b\*.gguf" .\models\7B\ggml-model-f16.gguf

# (Or just reference it in docker-compose)
```

**Step 2: Update docker-compose.yml**

```diff
  lmstudio:
    image: ghcr.io/ggerganov/llama.cpp:server
    container_name: code-heals-lmstudio
    ports:
      - "1234:8080"
    volumes:
      - ./models:/models
+     - "G:/LMStudio_Models/models/openai--gpt-oss-20b:/models/model"
    command:
      - /app/llama-server
      - --port
      - "8080"
      - --host
      - "0.0.0.0"
+     - --model
+     - /models/model/ggml-model-f16.gguf
    restart: unless-stopped

  python-agent:
    environment:
-     - LLM_API_URL=http://lmstudio:8080/v1
+     - LLM_API_URL=http://host.docker.internal:8080/v1
      # (change from :8080 if you want internal docker routing)

  rebanker:
    environment:
-     - LLM_API_URL=http://lmstudio:8080/v1
+     - LLM_API_URL=http://host.docker.internal:8080/v1

  dashboard:
    environment:
-     - LLM_API_URL=http://lmstudio:8080/v1
+     - LLM_API_URL=http://host.docker.internal:8080/v1
```

### Result:
```
✅ docker-compose up -d
✅ Container starts with model loaded
✅ Services use container LM Studio
❌ Only ONE model available (not 14)
❌ Lost LM Studio GUI
```

### Decision tree flow:
```
Check LOCAL (1234)
  ❌ Not running (you closed it)
  
Check CONTAINER (8080)
  ✅ Found (model loaded)
  → Use it
```

---

## SUMMARY: What Changes?

### Option A (CLEAN)
**Changes**: Remove lmstudio service, add env vars  
**Lines changed**: ~5-10  
**Complexity**: Low  
**Break chance**: None (local already works)  

### Option B (HYBRID)
**Changes**: Add env vars only  
**Lines changed**: ~3  
**Complexity**: Minimal  
**Break chance**: None (just adding fallback)  

### Option C (CONTAINERIZED)
**Changes**: Mount model, update command, update env vars  
**Lines changed**: ~10-15  
**Complexity**: Medium  
**Break chance**: High (if model path wrong or file missing)  

---

## DECISION TREE HANDLES ALL THREE

```
Your config decides which option:

OPTION A configured?
  → Tree finds LOCAL ✅ → Uses it

OPTION B configured?
  → Tree finds LOCAL ✅ → Uses it
  → Container available as backup

OPTION C configured?
  → Tree checks LOCAL ❌ → Not found
  → Tree checks CONTAINER ✅ → Uses it

Tree is same for all three.
Your configuration changes the behavior.
```

---

## RECOMMENDED NEXT STEP

**Implement Option B (3 lines of code):**

1. Open `docker-compose.yml`
2. Find `python-agent` section
3. Add to environment:
   ```yaml
   environment:
     - LLM_API_URL=http://host.docker.internal:1234/v1
   ```
4. Find `rebanker` section
5. Add to environment:
   ```yaml
   environment:
     - LLM_API_URL=http://host.docker.internal:1234/v1
   ```
6. Find `dashboard` section
7. Add to environment:
   ```yaml
   environment:
     - LLM_API_URL=http://host.docker.internal:1234/v1
   ```
8. Save and run:
   ```bash
   docker compose up -d
   ```

**Result**: System uses your LOCAL LM Studio (all 14 models), container stays as fallback.

Ready to do this?
