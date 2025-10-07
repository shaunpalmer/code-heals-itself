#!/usr/bin/env python3
"""
Taxonomy Integration Test Suite

Validates that:
1. Both Python and JS ReBankers load the shared taxonomy
2. Errors are enriched with severity/difficulty/cluster/hint/confidence
3. Output schema includes all taxonomy fields
4. Hash stability: rebanker_raw unchanged → rebanker_hash unchanged
5. Parity: identical input → structurally equivalent output across runtimes
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict

import pytest

# Resolve paths
REPO_ROOT = Path(__file__).resolve().parent.parent
PYTHON_REBANKER = REPO_ROOT / "ops" / "rebank" / "rebank_py.py"
JS_REBANKER = REPO_ROOT / "ops" / "rebank" / "rebank_js_ts.mjs"
TAXONOMY_PATH = REPO_ROOT / "rules" / "rebanker_taxonomy.yml"

# Import taxonomy loader
sys.path.insert(0, str(REPO_ROOT))
from rebanker.classify import load_taxonomy, classify_lines


@pytest.fixture
def taxonomy() -> Dict[str, Any]:
    """Load shared taxonomy fixture."""
    return load_taxonomy(TAXONOMY_PATH)


@pytest.fixture
def sample_python_error() -> str:
    """Sample Python syntax error output."""
    return '''  File "demo.py", line 5
    print("missing paren"
    ^
SyntaxError: '(' was never closed'''


@pytest.fixture
def sample_js_error() -> str:
    """Sample JavaScript syntax error output."""
    return '''demo.js:5
const x = [1,2,3

SyntaxError: Unexpected end of input'''


@pytest.fixture
def sample_ts_error() -> str:
    """Sample TypeScript compiler error output."""
    return "demo.ts(10,5): error TS2304: Cannot find name 'undefinedVar'."


# ─────────────────────────────────────────────────────────────────────────────
# Test 1: Taxonomy Classifier (Python)
# ─────────────────────────────────────────────────────────────────────────────

def test_classify_python_error(taxonomy: Dict[str, Any], sample_python_error: str):
    """Verify Python classifier enriches errors with taxonomy metadata."""
    result = classify_lines([sample_python_error], "py", taxonomy)
    
    assert "errors" in result
    assert "summary" in result
    assert result["summary"]["count"] > 0
    
    error = result["errors"][0]
    
    # Required taxonomy fields
    assert "code" in error, "Missing error code"
    assert "severity" in error, "Missing severity"
    assert "difficulty" in error, "Missing difficulty"
    assert "cluster_id" in error, "Missing cluster_id"
    assert "hint" in error, "Missing hint"
    assert "confidence" in error, "Missing confidence"
    
    # Severity is structured
    assert isinstance(error["severity"], dict)
    assert "label" in error["severity"]
    assert "score" in error["severity"]
    assert 0 <= error["severity"]["score"] <= 1
    
    # Numeric fields are normalized
    assert isinstance(error["difficulty"], (int, float))
    assert isinstance(error["confidence"], (int, float))
    assert 0 <= error["difficulty"] <= 1
    assert 0 <= error["confidence"] <= 1


def test_classify_js_error(taxonomy: Dict[str, Any], sample_js_error: str):
    """Verify JS classifier enriches errors with taxonomy metadata."""
    result = classify_lines([sample_js_error], "js", taxonomy)
    
    assert result["summary"]["count"] > 0
    error = result["errors"][0]
    
    assert error["code"] in ["SYN.UNMATCHED_BRACE", "SYN.UNCLOSED_PAREN", "SYN.UNEXPECTED_TOKEN", "UNK.UNKNOWN"]
    assert error["severity"]["label"] in ["FATAL_SYNTAX", "ERROR", "WARNING"]
    assert 0 <= error["difficulty"] <= 1


def test_classify_ts_error(taxonomy: Dict[str, Any], sample_ts_error: str):
    """Verify TS classifier enriches errors with taxonomy metadata."""
    result = classify_lines([sample_ts_error], "ts", taxonomy)
    
    assert result["summary"]["count"] > 0
    error = result["errors"][0]
    
    assert error["code"]  # Will match TS2304 or fall back to UNK.UNKNOWN
    assert "label" in error["severity"]
    assert error["difficulty"] >= 0


# ─────────────────────────────────────────────────────────────────────────────
# Test 2: Python ReBanker End-to-End
# ─────────────────────────────────────────────────────────────────────────────

def test_python_rebanker_enrichment(tmp_path: Path):
    """Verify Python ReBanker outputs enriched JSON with taxonomy fields."""
    # Create a broken Python file
    test_file = tmp_path / "broken.py"
    test_file.write_text("def foo():\n    print('missing paren'\n")
    
    # Run Python ReBanker
    proc = subprocess.run(
        [sys.executable, str(PYTHON_REBANKER), str(test_file)],
        capture_output=True,
        text=True,
        timeout=10,
    )
    
    # Should exit non-zero (error detected)
    assert proc.returncode == 1, f"Expected error exit, got {proc.returncode}"
    
    # Parse JSON output
    output = json.loads(proc.stdout)
    
    # Verify enriched fields
    assert output["code"] != "PY_SYNTAX", "Should have taxonomy code, not fallback"
    assert isinstance(output["severity"], dict), "Severity should be structured"
    assert "label" in output["severity"]
    assert "score" in output["severity"]
    assert "difficulty" in output
    assert "cluster_id" in output
    assert "hint" in output
    assert "confidence" in output
    
    # Verify numeric precision (2 decimal places)
    assert isinstance(output["difficulty"], float)
    assert len(str(output["difficulty"]).split(".")[-1]) <= 2


# ─────────────────────────────────────────────────────────────────────────────
# Test 3: JavaScript ReBanker End-to-End
# ─────────────────────────────────────────────────────────────────────────────

def test_js_rebanker_enrichment(tmp_path: Path):
    """Verify JS ReBanker outputs enriched JSON with taxonomy fields."""
    # Create a broken JS file
    test_file = tmp_path / "broken.js"
    test_file.write_text("const x = [1,2,3\n")
    
    # Run JS ReBanker
    proc = subprocess.run(
        ["node", str(JS_REBANKER), str(test_file)],
        capture_output=True,
        text=True,
        timeout=10,
    )
    
    assert proc.returncode == 1, f"Expected error exit, got {proc.returncode}"
    
    output = json.loads(proc.stdout)
    
    # Verify enriched fields
    assert "code" in output
    assert isinstance(output["severity"], dict)
    assert "difficulty" in output
    assert "cluster_id" in output
    assert "hint" in output
    assert "confidence" in output


# ─────────────────────────────────────────────────────────────────────────────
# Test 4: Schema Parity (Python vs JS)
# ─────────────────────────────────────────────────────────────────────────────

def test_schema_parity(tmp_path: Path):
    """Verify Python and JS ReBankers produce structurally identical output."""
    # Create identical broken files
    py_file = tmp_path / "broken.py"
    py_file.write_text("def foo():\n    print('test'\n")
    
    js_file = tmp_path / "broken.js"
    js_file.write_text("function foo() {\n    console.log('test'\n")
    
    # Run both ReBankers
    py_proc = subprocess.run(
        [sys.executable, str(PYTHON_REBANKER), str(py_file)],
        capture_output=True,
        text=True,
        timeout=10,
    )
    js_proc = subprocess.run(
        ["node", str(JS_REBANKER), str(js_file)],
        capture_output=True,
        text=True,
        timeout=10,
    )
    
    py_output = json.loads(py_proc.stdout)
    js_output = json.loads(js_proc.stdout)
    
    # Verify identical schema (keys, types, structure)
    py_keys = set(py_output.keys())
    js_keys = set(js_output.keys())
    
    assert py_keys == js_keys, f"Schema mismatch: {py_keys ^ js_keys}"
    
    # Both should have structured severity
    assert isinstance(py_output["severity"], dict)
    assert isinstance(js_output["severity"], dict)
    
    # Both should have numeric difficulty/confidence
    for key in ["difficulty", "confidence"]:
        assert isinstance(py_output[key], (int, float))
        assert isinstance(js_output[key], (int, float))


# ─────────────────────────────────────────────────────────────────────────────
# Test 5: Hash Stability (Truth-Flow Contract)
# ─────────────────────────────────────────────────────────────────────────────

def test_hash_stability_same_input(tmp_path: Path):
    """Verify identical input produces identical hash (deterministic enrichment)."""
    test_file = tmp_path / "stable.py"
    test_file.write_text("def foo():\n    print('test'\n")
    
    # Run twice
    proc1 = subprocess.run(
        [sys.executable, str(PYTHON_REBANKER), str(test_file)],
        capture_output=True,
        text=True,
        timeout=10,
    )
    proc2 = subprocess.run(
        [sys.executable, str(PYTHON_REBANKER), str(test_file)],
        capture_output=True,
        text=True,
        timeout=10,
    )
    
    output1 = json.loads(proc1.stdout)
    output2 = json.loads(proc2.stdout)
    
    # Core fields should be identical
    assert output1["code"] == output2["code"]
    assert output1["severity"] == output2["severity"]
    assert output1["difficulty"] == output2["difficulty"]
    assert output1["cluster_id"] == output2["cluster_id"]


def test_hash_stability_different_input(tmp_path: Path):
    """Verify different input produces different hash (sensitive to changes)."""
    file1 = tmp_path / "error1.py"
    file1.write_text("def foo():\n    print('test'\n")  # Missing paren
    
    file2 = tmp_path / "error2.py"
    file2.write_text("def foo():\n    x = \n")  # Missing value
    
    proc1 = subprocess.run(
        [sys.executable, str(PYTHON_REBANKER), str(file1)],
        capture_output=True,
        text=True,
        timeout=10,
    )
    proc2 = subprocess.run(
        [sys.executable, str(PYTHON_REBANKER), str(file2)],
        capture_output=True,
        text=True,
        timeout=10,
    )
    
    output1 = json.loads(proc1.stdout)
    output2 = json.loads(proc2.stdout)
    
    # Error codes or messages should differ
    assert (output1["code"] != output2["code"]) or (output1["message"] != output2["message"])


# ─────────────────────────────────────────────────────────────────────────────
# Test 6: Clean File Handling
# ─────────────────────────────────────────────────────────────────────────────

def test_clean_file_no_enrichment(tmp_path: Path):
    """Verify clean files pass through without unnecessary enrichment."""
    clean_file = tmp_path / "clean.py"
    clean_file.write_text("def foo():\n    print('hello')\n    return True\n")
    
    proc = subprocess.run(
        [sys.executable, str(PYTHON_REBANKER), str(clean_file)],
        capture_output=True,
        text=True,
        timeout=10,
    )
    
    # Should exit 0 (clean)
    assert proc.returncode == 0
    
    output = json.loads(proc.stdout)
    assert output["status"] == "clean"


# ─────────────────────────────────────────────────────────────────────────────
# Test 7: Taxonomy Coverage
# ─────────────────────────────────────────────────────────────────────────────

def test_taxonomy_loads_all_families(taxonomy: Dict[str, Any]):
    """Verify taxonomy YAML contains all expected families."""
    families = taxonomy.get("families", [])
    family_names = [f["name"] for f in families]
    
    # Core-24 families (examples from actual taxonomy)
    expected_families = ["Syntax", "Type", "Import", "Async", "Database"]
    
    for expected in expected_families:
        assert any(expected in name for name in family_names), \
            f"Missing family: {expected}"


def test_taxonomy_detectors_have_regex(taxonomy: Dict[str, Any]):
    """Verify all detectors have valid regex patterns."""
    families = taxonomy.get("families", [])
    
    for family in families:
        for category in family.get("categories", []):
            for detector in category.get("detectors", []):
                assert "regex" in detector, f"Missing regex in {category['code']}"
                assert len(detector["regex"]) > 0, f"Empty regex list in {category['code']}"


# ─────────────────────────────────────────────────────────────────────────────
# Run Tests
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
