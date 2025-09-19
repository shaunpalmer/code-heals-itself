# CrewAI Integration

This guide shows how to register the Self-Healing Debugger as a CrewAI Tool so agents can invoke patch attempts when they detect code issues.

## Minimal Tool Class

```python
# tools/self_heal_tool.py
from crewai import Tool
import requests

class SelfHealTool(Tool):
    name = "run_debug_attempt"
    description = "Attempt to self-heal a code fragment by applying patch_code to original_code and analyzing outcome."

    def _run(self, error_type: str, message: str, patch_code: str, original_code: str, maxAttempts: int = 1, sessionId: str | None = None):
        base = self.metadata.get("base_url", "http://localhost:8787")
        body = {
            "error_type": error_type,
            "message": message,
            "patch_code": patch_code,
            "original_code": original_code,
            "maxAttempts": maxAttempts
        }
        if sessionId:
            body["sessionId"] = sessionId
        r = requests.post(f"{base}/api/debug/run", json=body, timeout=60)
        r.raise_for_status()
        data = r.json()
        # Compact return for LLM token efficiency
        return {
            "action": data.get("action"),
            "patch_id": (data.get("envelope") or {}).get("patch_id"),
            "has_envelope": bool(data.get("envelope")),
            "extras_keys": list((data.get("extras") or {}).keys())
        }
```

## Register in a Crew

```python
from crewai import Agent, Crew
from tools.self_heal_tool import SelfHealTool

self_heal = SelfHealTool(metadata={"base_url": "http://localhost:8787"})

debug_agent = Agent(
    role="Code Healer",
    goal="Stabilize broken code by applying safe patches",
    backstory="You are cautious and roll back risky changes",
    tools=[self_heal],
    allow_delegation=False
)

crew = Crew(agents=[debug_agent])
```

## Invocation Pattern

LLM prompt example:
```
User: There's a syntax error: const x=1 (missing semicolon). Attempt a fix.
Assistant (thinks): I should call run_debug_attempt with SYNTAX and proposed patch.
```

Tool call arguments should always include:
- error_type (SYNTAX|LOGIC|RUNTIME|PERFORMANCE|SECURITY)
- message
- patch_code
- original_code

Optional:
- maxAttempts (default 1)
- sessionId (to group related conversations)

## Error Handling
- 400: Missing required fields → regenerate arguments
- 500: Transient failure → consider exponential backoff then one retry

## Observability
- List recent envelopes: `GET /api/envelopes?limit=20`
- Fetch a specific envelope: `GET /api/envelopes/{patch_id}`
- Metrics: `GET /health?format=prom`

## Advanced: Similar History Lookup
Use `GET /api/history/similar?message=...&code=...` for few-shot style retrieval before proposing a patch.

## Security
Run the self-healer behind a firewall or localhost-only if CrewAI agents are untrusted. Consider an API key header guard for external exposure.

---
See also `docs/function-manifest.md` for unified schema references and `docs/integration-lmstudio.md` for OpenAI-compatible function calling.
