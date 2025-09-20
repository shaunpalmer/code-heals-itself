import pytest
import sys, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
from utils.python.envelope_helpers import (
    append_attempt, merge_confidence, update_trend, set_breaker_state,
    set_cascade_depth, merge_resource_usage, apply_developer_flag,
    mark_success, set_envelope_timestamp, compute_stable_envelope_hash,
    set_envelope_hash, update_counters, add_timeline_entry
)


def test_append_attempt_and_counters():
    env = {}
    append_attempt(env, success=True, note="syntax fix", breaker_state="CLOSED", failure_count=0)
    assert len(env['attempts']) == 1
    update_counters(env, kind='syntax', errors_resolved=2)
    assert env['counters']['totalAttempts'] == 1
    assert env['counters']['syntaxAttempts'] == 1
    assert env['counters']['errorsResolvedTotal'] == 2


def test_merge_confidence_clamps():
    env = {}
    merge_confidence(env, syntax=1.5, logic=-0.2, risk=0.4)
    cc = env['confidenceComponents']
    assert cc['syntax'] == 1.0
    assert cc['logic'] == 0.0
    assert cc['risk'] == 0.4


def test_update_trend_and_breaker_state():
    env = {}
    update_trend(env, errors_detected=10, errors_resolved=3, improvement_velocity=0.2)
    assert env['trendMetadata']['errorTrend'] == 'improving'
    set_breaker_state(env, 'OPEN')
    assert env['breakerState'] == 'OPEN'


def test_cascade_and_resource_usage():
    env = {}
    set_cascade_depth(env, 5)
    merge_resource_usage(env, {'cpuPercent': 20, 'memoryMB': 128})
    assert env['cascadeDepth'] == 5
    assert env['resourceUsage']['memoryMB'] == 128


def test_developer_flag_and_success_latch():
    env = {}
    apply_developer_flag(env, flagged=True, message='Risky', reason_code='risk_gate')
    assert env['flagged_for_developer'] is True
    assert env['developer_flag_reason'] == 'risk_gate'
    mark_success(env, True)
    mark_success(env, False)
    assert env['success'] is True


def test_timestamp_and_hash_invariance():
    env = {}
    merge_confidence(env, syntax=0.5)
    set_envelope_timestamp(env)
    set_envelope_hash(env)
    h1 = env['envelopeHash']
    # Changing volatile field (timestamp) should not change hash
    set_envelope_timestamp(env)
    set_envelope_hash(env)
    h2 = env['envelopeHash']
    assert h1 == h2
    # Changing attempts should not change hash
    append_attempt(env, success=False)
    set_envelope_hash(env)
    h3 = env['envelopeHash']
    assert h1 == h3
    # Changing a non-volatile field should change hash
    merge_confidence(env, logic=0.9)
    set_envelope_hash(env)
    assert env['envelopeHash'] != h1


def test_timeline_entry():
    env = {}
    add_timeline_entry(env, attempt=1, breaker_state='CLOSED', action='continue')
    assert len(env['timeline']) == 1
    assert env['timeline'][0]['attempt'] == 1
