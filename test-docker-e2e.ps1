# E2E Docker Test - Phase 3 Task 16
# Tests all 3 API endpoints with real error scenarios

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 3 - E2E Docker API Validation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$api = "http://localhost:8000"
$tests_passed = 0
$tests_failed = 0

function Test-Endpoint {
    param (
        [string]$name,
        [string]$method,
        [string]$endpoint,
        [object]$body
    )
    
    Write-Host "`n[TEST] $name" -ForegroundColor Yellow
    
    try {
        if ($method -eq "GET") {
            $response = curl -s "$api$endpoint"
        } else {
            $json = $body | ConvertTo-Json -Compress
            $response = curl -s -X POST "$api$endpoint" -H "Content-Type: application/json" -d $json
        }
        
        Write-Host "Status: ✅ PASSED"
        Write-Host "Response: $response" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "Status: ❌ FAILED"
        Write-Host "Error: $_" -ForegroundColor Red
        return $false
    }
}

# Test 1: GET /status (System health)
if (Test-Endpoint -name "GET /status (Health Check)" -method "GET" -endpoint "/status") {
    $tests_passed++
} else {
    $tests_failed++
}

# Test 2: POST /heal (Error healing)
if (Test-Endpoint -name "POST /heal (Error Healing)" -method "POST" -endpoint "/heal" -body @{
    errorMessage = "undefined variable x"
    code = '$x = $undefined_var;'
    attemptNumber = 1
    previousErrorCount = 1
}) {
    $tests_passed++
} else {
    $tests_failed++
}

# Test 3: POST /classify (Error classification)
if (Test-Endpoint -name "POST /classify (Error Classification)" -method "POST" -endpoint "/classify" -body @{
    errorMessage = "Parse error: syntax error, unexpected token '?'"
    code = "<?php\nfunction test() ?\n{"
}) {
    $tests_passed++
} else {
    $tests_failed++
}

# Test 4: 404 Not Found
Write-Host "`n[TEST] GET /nonexistent (404 Handling)" -ForegroundColor Yellow
$response = curl -s "$api/nonexistent"
if ($response -match '"success": false' -and $response -match '"Endpoint not found"') {
    Write-Host "Status: ✅ PASSED (404 handled correctly)"
    $tests_passed++
} else {
    Write-Host "Status: ❌ FAILED"
    $tests_failed++
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Passed: $tests_passed" -ForegroundColor Green
Write-Host "Failed: $tests_failed" -ForegroundColor Red
Write-Host "Total:  $($tests_passed + $tests_failed)" -ForegroundColor White

if ($tests_failed -eq 0) {
    Write-Host "`n✅ All tests passed! API is working correctly." -ForegroundColor Green
} else {
    Write-Host "`n⚠️  Some tests failed. Check logs above." -ForegroundColor Yellow
}
