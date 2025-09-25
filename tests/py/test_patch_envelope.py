import json
import os
import pytest  # type: ignore
from jsonschema import validate, ValidationError

# Load patch envelope schema
patch_schema_path = os.path.join(os.path.dirname(__file__), "../../schemas/patch-envelope.schema.json")
if not os.path.exists(patch_schema_path):
    pytest.skip(f"patch envelope schema missing at {patch_schema_path}", allow_module_level=True)

with open(patch_schema_path, "r") as f:
    patch_schema = json.load(f)

# Load transmission schema
transmission_schema_path = os.path.join(os.path.dirname(__file__), "../../schemas/transmission.json")
with open(transmission_schema_path, "r") as f:
    transmission_schema = json.load(f)

# Load patch envelope test fixtures
patch_valid_fixture_path = os.path.join(os.path.dirname(__file__), "../../schemas/fixtures/patchEnvelope.valid.json")
patch_invalid_fixture_path = os.path.join(os.path.dirname(__file__), "../../schemas/fixtures/patchEnvelope.invalid.json")

with open(patch_valid_fixture_path, "r") as f:
    patch_valid_envelope = json.load(f)

with open(patch_invalid_fixture_path, "r") as f:
    patch_invalid_envelope = json.load(f)

# Load transmission test fixtures
transmission_valid_fixture_path = os.path.join(os.path.dirname(__file__), "../../schemas/fixtures/transmission.valid.json")
transmission_invalid_fixture_path = os.path.join(os.path.dirname(__file__), "../../schemas/fixtures/transmission.invalid.json")

with open(transmission_valid_fixture_path, "r") as f:
    transmission_valid_record = json.load(f)

with open(transmission_invalid_fixture_path, "r") as f:
    transmission_invalid_record = json.load(f)

def test_valid_patch_envelope():
    """Test that valid patch envelope passes validation"""
    validate(instance=patch_valid_envelope, schema=patch_schema)

def test_invalid_patch_envelope():
    """Test that invalid patch envelope fails validation"""
    try:
        validate(instance=patch_invalid_envelope, schema=patch_schema)
        assert False, "Expected validation to fail"
    except ValidationError:
        pass  # Expected

def test_valid_transmission_record():
    """Test that valid transmission record passes validation"""
    validate(instance=transmission_valid_record, schema=transmission_schema)

def test_invalid_transmission_record():
    """Test that invalid transmission record fails validation"""
    try:
        validate(instance=transmission_invalid_record, schema=transmission_schema)
        assert False, "Expected validation to fail"
    except ValidationError:
        pass  # Expected
