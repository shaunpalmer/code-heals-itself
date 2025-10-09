"""
Integration test for Success Patterns Knowledge Base

Tests the complete flow:
1. Error occurs → ReBanker classifies
2. Query knowledge base (empty initially)
3. LLM fixes error → PROMOTE
4. Save to knowledge base
5. Same error again → Query finds pattern
6. LLM applies proven solution → Faster fix
7. Garbage collection prunes one-offs

Common patterns tested:
- Import errors (most common)
- None comparison bugs
- Array index errors
- Missing brackets/syntax errors
"""

import pytest
import sys
import os
from pathlib import Path
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import only what we need
from envelope_storage import EnvelopeStorage

# Test database path (separate from production)
TEST_DB_PATH = "artifacts/test_envelopes.db"


class TestSuccessPatternsIntegration:
    """Integration tests for success patterns knowledge base"""
    
    @pytest.fixture(autouse=True)
    def setup_teardown(self):
        """Setup test database, teardown after each test"""
        # Clean up old test DB
        if os.path.exists(TEST_DB_PATH):
            os.remove(TEST_DB_PATH)
        
        # Create fresh storage for each test
        self.storage = EnvelopeStorage(db_path=TEST_DB_PATH, memory_size=20)
        
        yield
        
        # Cleanup
        if os.path.exists(TEST_DB_PATH):
            os.remove(TEST_DB_PATH)
    
    def test_common_import_error_pattern(self):
        """
        Test: Import error (RES.NAME_ERROR) - most common pattern
        
        Flow:
        1. First occurrence → No patterns in DB
        2. Fix succeeds → Save pattern
        3. Second occurrence → Pattern found with success_count=1
        4. Third occurrence → Pattern has success_count=2, rising confidence
        """
        # Simulate first import error
        error_code = "RES.NAME_ERROR"
        cluster_id = "RES.NAME_ERROR:requests"
        
        # Query knowledge base (should be empty)
        patterns = self.storage.get_similar_success_patterns(
            error_code=error_code,
            cluster_id=cluster_id,
            min_confidence=0.7
        )
        assert len(patterns) == 0, "Knowledge base should be empty initially"
        
        # Simulate successful fix (PROMOTE)
        envelope_data = {
            "patch_id": "test_001",
            "timestamp": datetime.now().isoformat(),
            "metadata": {
                "rebanker_raw": {
                    "code": error_code,
                    "cluster_id": cluster_id,
                    "message": "name 'requests' is not defined"
                },
                "confidence": {"overall": 0.94}
            },
            "patch": {
                "description": "Import requests library",
                "diff": "+ import requests"
            }
        }
        
        self.storage.save_envelope(envelope_data, action="PROMOTE")
        
        # Query again - should find the saved pattern
        patterns = self.storage.get_similar_success_patterns(
            error_code=error_code,
            cluster_id=cluster_id,
            min_confidence=0.7
        )
        assert len(patterns) == 1, "Should find 1 pattern after first fix"
        assert patterns[0]["success_count"] == 1
        assert patterns[0]["avg_confidence"] == 0.94
        assert "GOLD_STANDARD" in patterns[0]["tags"]
        assert patterns[0]["fallback_level"] == "cluster"
        
        # Simulate second occurrence - same error
        envelope_data["patch_id"] = "test_002"
        envelope_data["metadata"]["confidence"]["overall"] = 0.95
        self.storage.save_envelope(envelope_data, action="PROMOTE")
        
        # Pattern should now have success_count=2
        patterns = self.storage.get_similar_success_patterns(
            error_code=error_code,
            cluster_id=cluster_id
        )
        assert patterns[0]["success_count"] == 2
        assert patterns[0]["avg_confidence"] == 0.945  # Running average
        
        print(f"✅ Import error pattern test passed!")
        print(f"   Pattern: {cluster_id}")
        print(f"   Success count: {patterns[0]['success_count']}")
        print(f"   Avg confidence: {patterns[0]['avg_confidence']:.3f}")
    
    def test_fallback_cascade(self):
        """
        Test: Fallback cascade (cluster → error_code → family)
        
        Scenario: Error "RES.NAME_ERROR:newlib" (never seen before)
        Expected: Falls back to "RES.NAME_ERROR" patterns, then "RES.*"
        """
        # Add some RES.NAME_ERROR patterns
        errors = [
            ("RES.NAME_ERROR:requests", "Import requests"),
            ("RES.NAME_ERROR:pandas", "Import pandas"),
            ("RES.NAME_ERROR:numpy", "Import numpy"),
        ]
        
        for i, (cluster, desc) in enumerate(errors):
            envelope = {
                "patch_id": f"test_fb_{i}",
                "timestamp": datetime.now().isoformat(),
                "metadata": {
                    "rebanker_raw": {
                        "code": "RES.NAME_ERROR",
                        "cluster_id": cluster
                    },
                    "confidence": {"overall": 0.88}
                },
                "patch": {"description": desc, "diff": f"+ import {desc.split()[1]}"}
            }
            self.storage.save_envelope(envelope, action="PROMOTE")
        
        # Add a different RES family error (FILE_NOT_FOUND)
        envelope = {
            "patch_id": "test_fb_file",
            "timestamp": datetime.now().isoformat(),
            "metadata": {
                "rebanker_raw": {
                    "code": "RES.FILE_NOT_FOUND",
                    "cluster_id": "RES.FILE_NOT_FOUND:config.json"
                },
                "confidence": {"overall": 0.91}
            },
            "patch": {"description": "Check file exists", "diff": "+ if os.path.exists(...)"}
        }
        self.storage.save_envelope(envelope, action="PROMOTE")
        
        # Query for novel error: RES.NAME_ERROR:newlib
        patterns = self.storage.get_similar_success_patterns(
            error_code="RES.NAME_ERROR",
            cluster_id="RES.NAME_ERROR:newlib",  # Never seen before!
            limit=5
        )
        
        # Should fall back to error_code level
        assert len(patterns) >= 3, "Should find patterns via fallback"
        assert patterns[0]["fallback_level"] in ["error_code", "cluster+error_code"]
        
        # Verify it found the NAME_ERROR patterns, not FILE_NOT_FOUND
        error_codes = [p["error_code"] for p in patterns]
        assert all(code == "RES.NAME_ERROR" for code in error_codes[:3])
        
        print(f"✅ Fallback cascade test passed!")
        print(f"   Queried: RES.NAME_ERROR:newlib (novel)")
        print(f"   Found: {len(patterns)} patterns via fallback")
        print(f"   Fallback level: {patterns[0]['fallback_level']}")
    
    def test_garbage_collection(self):
        """
        Test: Garbage collection removes one-offs, keeps winners
        
        Patterns:
        - Common: "Import requests" (10 successes) → KEEP
        - One-off: "Fix typo" (1 success, 120 days old) → DELETE
        - Recent one-off: (1 success, 10 days old) → KEEP (not old enough)
        """
        # Add a proven winner (10 successes)
        for i in range(10):
            envelope = {
                "patch_id": f"winner_{i}",
                "timestamp": datetime.now().isoformat(),
                "metadata": {
                    "rebanker_raw": {
                        "code": "RES.NAME_ERROR",
                        "cluster_id": "RES.NAME_ERROR:requests"
                    },
                    "confidence": {"overall": 0.94}
                },
                "patch": {"description": "Import requests", "diff": "+ import requests"}
            }
            self.storage.save_envelope(envelope, action="PROMOTE")
        
        # Add an old one-off (should be deleted)
        old_date = (datetime.now() - timedelta(days=120)).isoformat()
        self.storage.save_success_pattern(
            error_code="SYN.TYPO",
            cluster_id="SYN.TYPO:reqeusts",
            fix_description="Fix typo 'reqeusts' → 'requests'",
            fix_diff="- reqeusts\n+ requests",
            confidence=0.82
        )
        # Manually update timestamp to make it old
        with self.storage._get_connection() as conn:
            conn.execute("""
                UPDATE success_patterns 
                SET last_success_at = ?
                WHERE cluster_id = 'SYN.TYPO:reqeusts'
            """, (old_date,))
            conn.commit()
        
        # Add a recent one-off (should be kept)
        recent_date = (datetime.now() - timedelta(days=10)).isoformat()
        self.storage.save_success_pattern(
            error_code="LOG.INDEX_ERROR",
            cluster_id="LOG.INDEX_ERROR:list_bounds",
            fix_description="Check array bounds",
            fix_diff="+ if idx < len(arr):",
            confidence=0.79
        )
        
        # Check initial state
        stats_before = self.storage.get_success_stats()
        assert stats_before["total_patterns"] == 3
        
        # Run garbage collection (conservative)
        result = self.storage.garbage_collect_patterns("conservative")
        
        # Verify results
        assert result["deleted_count"] == 1, "Should delete 1 old one-off"
        assert result["remaining_count"] == 2, "Should keep 2 patterns"
        assert result["protected_count"] == 1, "Should have 1 protected pattern (10 successes)"
        
        # Verify the winner was kept
        patterns = self.storage.get_similar_success_patterns(
            error_code="RES.NAME_ERROR",
            cluster_id="RES.NAME_ERROR:requests"
        )
        assert len(patterns) == 1
        assert patterns[0]["success_count"] == 10
        
        print(f"✅ Garbage collection test passed!")
        print(f"   Deleted: {result['deleted_count']} old one-offs")
        print(f"   Remaining: {result['remaining_count']} patterns")
        print(f"   Protected: {result['protected_count']} high-value patterns")
    
    def test_none_comparison_pattern(self):
        """Test: None comparison bug (common logic error)"""
        envelope = {
            "patch_id": "none_test",
            "timestamp": datetime.now().isoformat(),
            "metadata": {
                "rebanker_raw": {
                    "code": "LOG.TYPE_ERROR",
                    "cluster_id": "LOG.TYPE_ERROR:none_comparison"
                },
                "confidence": {"overall": 0.87}
            },
            "patch": {
                "description": "Use 'is None' instead of '== None'",
                "diff": "- if x == None:\n+ if x is None:"
            }
        }
        
        self.storage.save_envelope(envelope, action="PROMOTE")
        
        patterns = self.storage.get_similar_success_patterns(
            error_code="LOG.TYPE_ERROR",
            cluster_id="LOG.TYPE_ERROR:none_comparison"
        )
        
        assert len(patterns) == 1
        assert patterns[0]["success_count"] == 1
        assert "HIGH_CONFIDENCE" in patterns[0]["tags"]
        
        print(f"✅ None comparison pattern test passed!")
    
    def test_protected_patterns_never_deleted(self):
        """
        Test: High-value patterns are NEVER deleted, even if old
        
        Pattern: "Import requests" (15 successes, 2 years old)
        Expected: PROTECTED from all GC strategies
        """
        # Create a high-value pattern
        for i in range(15):
            envelope = {
                "patch_id": f"protected_{i}",
                "timestamp": datetime.now().isoformat(),
                "metadata": {
                    "rebanker_raw": {
                        "code": "RES.NAME_ERROR",
                        "cluster_id": "RES.NAME_ERROR:requests"
                    },
                    "confidence": {"overall": 0.95}
                },
                "patch": {"description": "Import requests", "diff": "+ import requests"}
            }
            self.storage.save_envelope(envelope, action="PROMOTE")
        
        # Make it very old (2 years)
        old_date = (datetime.now() - timedelta(days=730)).isoformat()
        with self.storage._get_connection() as conn:
            conn.execute("""
                UPDATE success_patterns 
                SET last_success_at = ?
                WHERE cluster_id = 'RES.NAME_ERROR:requests'
            """, (old_date,))
            conn.commit()
        
        # Try NUCLEAR garbage collection (most aggressive)
        result = self.storage.garbage_collect_patterns("nuclear")
        
        # Pattern should still exist!
        patterns = self.storage.get_similar_success_patterns(
            error_code="RES.NAME_ERROR",
            cluster_id="RES.NAME_ERROR:requests"
        )
        
        assert len(patterns) == 1, "Protected pattern should survive nuclear GC!"
        assert patterns[0]["success_count"] == 15
        assert result["protected_count"] >= 1
        
        print(f"✅ Protected patterns test passed!")
        print(f"   Pattern survived nuclear GC with 15 successes (2 years old)")


def run_integration_tests():
    """Run all integration tests"""
    pytest.main([__file__, "-v", "-s"])


if __name__ == "__main__":
    print("=" * 70)
    print("SUCCESS PATTERNS INTEGRATION TEST")
    print("=" * 70)
    run_integration_tests()
