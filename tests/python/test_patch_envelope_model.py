import json

from utils.python.envelope import PatchEnvelope
from utils.python.envelope_helpers import (
    append_attempt,
    mark_success,
    set_envelope_timestamp,
    set_envelope_hash,
)


def make_envelope(**overrides):
    base = dict(
        patch_id="patch_123",
        patch_data={"fix": "noop"},
        metadata={"created_at": "2025-09-25T00:00:00Z"},
        attempts=[],
    )
    base.update(overrides)
    return PatchEnvelope(**base)


def test_merge_metadata_and_flags():
    envelope = make_envelope()
    envelope.merge_metadata({"service": "payments"})
    assert envelope.metadata["service"] == "payments"

    envelope.flag_for_developer(message="Needs review", reason="risk_gate")
    assert envelope.flagged_for_developer is True
    assert envelope.developer_message == "Needs review"
    assert envelope.developer_flag_reason == "risk_gate"

    envelope.flagged_for_developer = False
    assert envelope.flagged_for_developer is False
    assert envelope.developer_message == ""
    assert envelope.developer_flag_reason is None


def test_mutable_payload_applies_helpers():
    envelope = make_envelope()

    with envelope.mutable_payload() as payload:
        append_attempt(payload, success=True, note="smoke", breaker_state="CLOSED", failure_count=0)
        mark_success(payload, True)
        set_envelope_timestamp(payload)
        set_envelope_hash(payload)

    assert envelope.success is True
    assert len(envelope.attempts) == 1
    assert "timestamp" in envelope.to_dict()
    assert envelope.envelope_hash is not None


def test_to_json_round_trip():
    envelope = make_envelope(
        confidenceComponents={"syntax": 0.5},
        breakerState="OPEN",
        cascadeDepth=2,
        resourceUsage={"cpuPercent": 10},
        success=True,
    )
    payload = json.loads(envelope.to_json())
    restored = PatchEnvelope.from_json(json.dumps(payload))

    assert restored.patch_id == envelope.patch_id
    assert restored.breakerState == "OPEN"
    assert restored.cascadeDepth == 2
    assert restored.success is True
    assert restored.resourceUsage["cpuPercent"] == 10
