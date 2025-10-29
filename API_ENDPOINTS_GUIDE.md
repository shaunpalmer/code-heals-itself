# REST API Endpoints Guide

**Date**: October 30, 2025  
**Version**: 1.0  
**Status**: Production Ready  
**Base URL**: `http://localhost:8000/api`

---

## Overview

Three RESTful endpoints for error healing orchestration:

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| `/heal` | POST | Execute healing attempt | {action, difficulty, velocity, ...} |
| `/status` | GET | System health & state | {state, health, error_count, ...} |
| `/classify` | POST | Error classification | {difficulty, confidence, hints, ...} |

---

## 1. POST /heal — Execute Healing

**Purpose**: Main healing orchestration endpoint  
**Input**: Error envelope with context  
**Output**: Healing decision + metadata

### Request

```bash
curl -X POST http://localhost:8000/api/heal \
  -H "Content-Type: application/json" \
  -d '{
    "code": "<?php echo \"Hello\";",
    "previousErrors": 3,
    "attemptNumber": 2,
    "errorMessage": "Missing semicolon on line 1",
    "temperature": 1.0
  }'
```

### Request Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | PHP/JS/TS code being healed |
| `previousErrors` | integer | Yes | Error count before healing |
| `attemptNumber` | integer | Yes | Healing attempt number (1-8) |
| `errorMessage` | string | No | Description of the error |
| `temperature` | float | No | LLM creativity (0.0-2.0), default: 1.0 |

### Response (Success)

```json
{
  "success": true,
  "data": {
    "action": "CONTINUE",
    "difficulty": "EASY",
    "velocity": 2.5,
    "temperature": 1.0,
    "error_delta": 1,
    "reasoning": "Error fixed by adding semicolon",
    "timestamp": "2025-10-30T02:15:33Z"
  },
  "timestamp": "2025-10-30T02:15:34Z"
}
```

### Response (Error)

```json
{
  "success": false,
  "error": "Missing required field: code",
  "timestamp": "2025-10-30T02:15:34Z"
}
```

### Possible Actions

- **CONTINUE** — Healing working, make another attempt
- **ROLLBACK** — Revert to previous state + adjust strategy
- **ESCALATE** — Problem too hard, switch to larger model
- **COMPLETE** — All errors fixed, done!
- **STOP** — Circuit breaker open, must wait

---

## 2. GET /status — System Health

**Purpose**: Check system state and circuit breaker status  
**Input**: None  
**Output**: Real-time system metrics

### Request

```bash
curl http://localhost:8000/api/status
```

### Response (Success)

```json
{
  "success": true,
  "data": {
    "state": "CLOSED",
    "health": "GOOD",
    "error_count": 2,
    "success_count": 15,
    "velocity": 1.8,
    "last_healing": "2025-10-30T02:15:30Z",
    "memory_usage": 5242880,
    "uptime": 3600000
  },
  "timestamp": "2025-10-30T02:15:35Z"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `state` | string | Circuit breaker state: OPEN, CLOSED |
| `health` | string | System health: GOOD, DEGRADED |
| `error_count` | integer | Unresolved errors |
| `success_count` | integer | Successfully healed errors |
| `velocity` | float | Healing progress rate (errors/attempt) |
| `last_healing` | string | ISO timestamp of last healing attempt |
| `memory_usage` | integer | Bytes of memory in use |
| `uptime` | integer | Milliseconds since startup |

---

## 3. POST /classify — Error Classification

**Purpose**: Classify and enrich error analysis  
**Input**: Error message and code context  
**Output**: Structured error classification

### Request

```bash
curl -X POST http://localhost:8000/api/classify \
  -H "Content-Type: application/json" \
  -d '{
    "errorMessage": "Undefined variable: $name on line 5",
    "code": "<?php echo $name;",
    "context": {
      "file": "test.php",
      "line": 5
    }
  }'
```

### Request Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `errorMessage` | string | Yes | Error message from error log |
| `code` | string | No | Relevant code snippet |
| `context` | object | No | Additional context (file, line, etc) |

### Response (Success)

```json
{
  "success": true,
  "data": {
    "difficulty": "EASY",
    "confidence": 0.95,
    "error_type": "VAR.UNDEFINED",
    "hints": ["Initialize variable before use", "Check variable scope"],
    "cascade_risk": 0.1,
    "planner_directives": ["prefer_initialization", "check_scope"]
  },
  "timestamp": "2025-10-30T02:15:36Z"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `difficulty` | string | EASY, MEDIUM, HARD, EXTREME |
| `confidence` | float | 0.0-1.0 classification confidence |
| `error_type` | string | Taxonomy error type (SYN.*, VAR.*, LOG.*) |
| `hints` | array | Suggested fixes |
| `cascade_risk` | float | Probability of cascading failures (0.0-1.0) |
| `planner_directives` | array | Instructions for LLM planner |

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Valid request processed |
| 400 | Bad Request | Missing required field, invalid JSON |
| 404 | Not Found | Unknown endpoint |
| 405 | Method Not Allowed | GET on POST-only endpoint |
| 500 | Server Error | Unexpected exception |

### Error Response Format

```json
{
  "success": false,
  "error": "Description of what went wrong",
  "timestamp": "2025-10-30T02:15:37Z"
}
```

---

## Examples

### Example 1: Simple Syntax Error

**Request**:
```bash
curl -X POST http://localhost:8000/api/heal \
  -H "Content-Type: application/json" \
  -d '{
    "code": "function test() { console.log(\"hello\" }",
    "previousErrors": 1,
    "attemptNumber": 1,
    "errorMessage": "Unexpected token }"
  }'
```

**Response**:
```json
{
  "success": true,
  "data": {
    "action": "CONTINUE",
    "difficulty": "EASY",
    "error_delta": 1,
    "velocity": 1.0
  }
}
```

### Example 2: Hard Problem (Multiple Attempts)

**Request (Attempt 5)**:
```bash
curl -X POST http://localhost:8000/api/heal \
  -H "Content-Type: application/json" \
  -d '{
    "code": "...",
    "previousErrors": 5,
    "attemptNumber": 5,
    "errorMessage": "Race condition in async code"
  }'
```

**Response**:
```json
{
  "success": true,
  "data": {
    "action": "ESCALATE",
    "difficulty": "HARD",
    "velocity": 0.02,
    "temperature": 1.3,
    "reasoning": "Stalled for 5 attempts, escalating to larger model"
  }
}
```

### Example 3: Check System Health

**Request**:
```bash
curl http://localhost:8000/api/status
```

**Response**:
```json
{
  "success": true,
  "data": {
    "state": "CLOSED",
    "health": "GOOD",
    "error_count": 0,
    "success_count": 42,
    "velocity": 2.3,
    "last_healing": "2025-10-30T02:14:22Z"
  }
}
```

---

## Integration Examples

### JavaScript/Fetch

```javascript
const response = await fetch('http://localhost:8000/api/heal', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    code: myCode,
    previousErrors: 3,
    attemptNumber: 2,
    errorMessage: 'Syntax error'
  })
});

const result = await response.json();
if (result.success) {
  console.log('Action:', result.data.action);
}
```

### Python/Requests

```python
import requests

response = requests.post('http://localhost:8000/api/heal', json={
    'code': my_code,
    'previousErrors': 3,
    'attemptNumber': 2,
    'errorMessage': 'Syntax error'
})

data = response.json()
if data['success']:
    print(f"Action: {data['data']['action']}")
```

### cURL (Shell)

```bash
#!/bin/bash

# Check status
curl http://localhost:8000/api/status | jq .

# Send healing request
curl -X POST http://localhost:8000/api/heal \
  -H "Content-Type: application/json" \
  -d @payload.json | jq .

# Classify error
curl -X POST http://localhost:8000/api/classify \
  -H "Content-Type: application/json" \
  -d '{"errorMessage":"Undefined variable"}'
```

---

## Testing Checklist

- [ ] POST /heal returns correct action
- [ ] GET /status returns circuit breaker state
- [ ] POST /classify returns difficulty + confidence
- [ ] All endpoints return JSON with timestamp
- [ ] 400 error on missing required fields
- [ ] 404 error on unknown endpoint
- [ ] 500 error on server exception

---

**API Version**: 1.0  
**Last Updated**: October 30, 2025  
**Status**: Production Ready
