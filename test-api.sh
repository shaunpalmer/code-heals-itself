#!/bin/bash
# API Endpoint Tests

BASE_URL="http://localhost:8000/api"

echo "=========================================="
echo "Testing REST API Endpoints"
echo "=========================================="
echo ""

# Test 1: GET /status
echo "TEST 1: GET /status"
echo "---"
curl -s -X GET "$BASE_URL/status" | jq .
echo ""
echo ""

# Test 2: POST /classify
echo "TEST 2: POST /classify"
echo "---"
curl -s -X POST "$BASE_URL/classify" \
  -H "Content-Type: application/json" \
  -d '{
    "errorMessage": "Undefined variable: $name",
    "code": "<?php echo $name;",
    "context": {"file": "test.php", "line": 1}
  }' | jq .
echo ""
echo ""

# Test 3: POST /heal (Simple)
echo "TEST 3: POST /heal"
echo "---"
curl -s -X POST "$BASE_URL/heal" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "<?php echo \"hello\";",
    "previousErrors": 1,
    "attemptNumber": 1,
    "errorMessage": "Missing semicolon",
    "temperature": 1.0
  }' | jq .
echo ""
echo ""

# Test 4: Error handling (missing field)
echo "TEST 4: Error Handling (Missing field)"
echo "---"
curl -s -X POST "$BASE_URL/heal" \
  -H "Content-Type: application/json" \
  -d '{"code": "test"}' | jq .
echo ""
echo ""

# Test 5: 404 Not Found
echo "TEST 5: 404 Not Found"
echo "---"
curl -s -X GET "$BASE_URL/nonexistent" | jq .
echo ""
echo ""

echo "=========================================="
echo "All tests complete"
echo "=========================================="
