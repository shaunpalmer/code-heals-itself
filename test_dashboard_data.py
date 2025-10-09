"""
Quick test script to populate dashboard with sample success patterns
Run this to see the Knowledge Base panels light up!
"""
from envelope_storage import get_envelope_storage
from datetime import datetime

def add_sample_patterns():
    storage = get_envelope_storage()
    
    print("Adding sample success patterns to knowledge base...")
    
    # Sample 1: Import requests error (very common)
    for i in range(10):
        storage.save_success_pattern(
            error_code="RES.NAME_ERROR",
            cluster_id="RES.NAME_ERROR:requests",
            fix_description="Import requests library",
            fix_diff="+ import requests",
            confidence=0.94
        )
    print("✓ Added: Import requests pattern (10 successes)")
    
    # Sample 2: Import pandas
    for i in range(7):
        storage.save_success_pattern(
            error_code="RES.NAME_ERROR",
            cluster_id="RES.NAME_ERROR:pandas",
            fix_description="Import pandas library",
            fix_diff="+ import pandas as pd",
            confidence=0.91
        )
    print("✓ Added: Import pandas pattern (7 successes)")
    
    # Sample 3: None comparison
    for i in range(5):
        storage.save_success_pattern(
            error_code="LOG.TYPE_ERROR",
            cluster_id="LOG.TYPE_ERROR:none_comparison",
            fix_description="Use 'is None' instead of '== None'",
            fix_diff="- if x == None:\n+ if x is None:",
            confidence=0.87
        )
    print("✓ Added: None comparison pattern (5 successes)")
    
    # Sample 4: Array bounds check
    for i in range(3):
        storage.save_success_pattern(
            error_code="LOG.INDEX_ERROR",
            cluster_id="LOG.INDEX_ERROR:list_bounds",
            fix_description="Check array bounds before access",
            fix_diff="+ if idx < len(arr):\n      value = arr[idx]",
            confidence=0.82
        )
    print("✓ Added: Array bounds pattern (3 successes)")
    
    # Sample 5: Recent one-off
    storage.save_success_pattern(
        error_code="SYN.SYNTAX_ERROR",
        cluster_id="SYN.SYNTAX_ERROR:missing_colon",
        fix_description="Add missing colon after if statement",
        fix_diff="- if condition\n+ if condition:",
        confidence=0.89
    )
    print("✓ Added: Syntax error pattern (1 success)")
    
    # Get stats
    stats = storage.get_success_stats()
    print("\n" + "="*50)
    print("📊 Knowledge Base Stats:")
    print(f"   Total Patterns: {stats.get('total_patterns', 0)}")
    print(f"   Gold Standard: {stats.get('gold_standard_count', 0)}")
    print(f"   High Confidence: {stats.get('high_confidence_count', 0)}")
    print(f"   Total Successes: {stats.get('total_successes', 0)}")
    print("="*50)
    print("\n✅ Sample data added! Check your dashboard:")
    print("   1. Click '🧠 Knowledge Base' in the sidebar")
    print("   2. Watch the stats cards update")
    print("   3. See the patterns in Top Patterns panel")
    print("\n   Dashboard will auto-refresh in ~10 seconds!")

if __name__ == "__main__":
    add_sample_patterns()
