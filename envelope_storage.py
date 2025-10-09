"""
Envelope Storage Layer - Persists healing envelopes for dashboard display

Stores envelopes from AI healing runs in SQLite database for real-time dashboard updates.
"""
import sqlite3
import json
import os
from typing import List, Dict, Any, Optional
from datetime import datetime
from contextlib import contextmanager

class EnvelopeStorage:
    """SQLite-based storage for patch envelopes from healing runs"""
    
    def __init__(self, db_path: str = "artifacts/envelopes.db"):
        self.db_path = db_path
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self._init_database()
    
    def _init_database(self):
        """Create envelopes table if it doesn't exist"""
        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS envelopes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    patch_id TEXT UNIQUE NOT NULL,
                    status TEXT NOT NULL,  -- PROMOTED, REJECTED, RETRY, PENDING
                    timestamp TEXT NOT NULL,
                    confidence REAL,
                    breaker_state TEXT,
                    cascade_depth INTEGER DEFAULT 0,
                    envelope_json TEXT NOT NULL,  -- Full envelope as JSON
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Index for fast queries
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_envelopes_timestamp 
                ON envelopes(timestamp DESC)
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_envelopes_status 
                ON envelopes(status)
            """)
            
            conn.commit()
    
    @contextmanager
    def _get_connection(self):
        """Context manager for database connections"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # Access columns by name
        try:
            yield conn
        finally:
            conn.close()
    
    def save_envelope(self, envelope_data: Dict[str, Any], action: str) -> None:
        """
        Save an envelope from a healing run
        
        Args:
            envelope_data: Envelope dictionary (from envelope.to_json())
            action: PROMOTE, REJECT, or RETRY
        """
        with self._get_connection() as conn:
            # Extract key fields
            patch_id = envelope_data.get("patch_id", f"unknown_{datetime.now().timestamp()}")
            
            # Map action to status
            status_map = {
                "PROMOTE": "PROMOTED",
                "REJECT": "REJECTED",
                "RETRY": "RETRY",
                "PENDING": "PENDING"
            }
            status = status_map.get(action, action)
            
            # Extract metadata
            metadata = envelope_data.get("metadata", {})
            confidence = metadata.get("confidence", {})
            overall_confidence = (
                confidence.get("overall") if isinstance(confidence, dict) 
                else confidence
            )
            
            timestamp = envelope_data.get("timestamp", datetime.now().isoformat())
            breaker_state = envelope_data.get("breakerState", "UNKNOWN")
            cascade_depth = envelope_data.get("cascadeDepth", 0)
            
            # Insert or replace envelope
            conn.execute("""
                INSERT OR REPLACE INTO envelopes 
                (patch_id, status, timestamp, confidence, breaker_state, cascade_depth, envelope_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                patch_id,
                status,
                timestamp,
                overall_confidence,
                breaker_state,
                cascade_depth,
                json.dumps(envelope_data)
            ))
            
            conn.commit()
    
    def get_latest_envelopes(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get most recent envelopes for dashboard timeline"""
        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT envelope_json, status, timestamp
                FROM envelopes
                ORDER BY timestamp DESC
                LIMIT ?
            """, (limit,))
            
            envelopes = []
            for row in cursor:
                envelope = json.loads(row["envelope_json"])
                
                # Transform to dashboard format
                envelopes.append({
                    "summary": f"Envelope {envelope.get('patch_id', 'unknown')} (python)",
                    "status": row["status"],
                    "timestamp": row["timestamp"],
                    "confidence": envelope.get("metadata", {}).get("confidence", {}).get("overall", 0),
                    "breaker": f"{envelope.get('breakerState', 'unknown')} breaker",
                    "payload": envelope
                })
            
            return envelopes
    
    def get_metrics(self) -> Dict[str, Any]:
        """Calculate real-time metrics for dashboard"""
        with self._get_connection() as conn:
            # Total healing attempts (last 24 hours)
            cursor = conn.execute("""
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'PROMOTED' THEN 1 ELSE 0 END) as promoted,
                    SUM(CASE WHEN status = 'RETRY' THEN 1 ELSE 0 END) as pending
                FROM envelopes
                WHERE datetime(timestamp) > datetime('now', '-24 hours')
            """)
            
            row = cursor.fetchone()
            total = row["total"] or 1  # Avoid division by zero
            promoted = row["promoted"] or 0
            pending = row["pending"] or 0
            
            # Calculate success rate
            healing_success = int((promoted / total) * 100) if total > 0 else 0
            
            # Get latest breaker status
            cursor = conn.execute("""
                SELECT breaker_state
                FROM envelopes
                ORDER BY timestamp DESC
                LIMIT 1
            """)
            
            row = cursor.fetchone()
            breaker_status = row["breaker_state"] if row else "steady"
            
            return {
                "healingSuccess": healing_success,
                "breakerStatus": breaker_status.lower() if breaker_status else "steady",
                "pendingReviews": pending
            }
    
    def clear_old_envelopes(self, days: int = 30) -> int:
        """Delete envelopes older than specified days (cleanup)"""
        with self._get_connection() as conn:
            cursor = conn.execute("""
                DELETE FROM envelopes
                WHERE datetime(timestamp) < datetime('now', ?)
            """, (f'-{days} days',))
            
            conn.commit()
            return cursor.rowcount


# Singleton instance for global access
_storage_instance: Optional[EnvelopeStorage] = None

def get_envelope_storage() -> EnvelopeStorage:
    """Get or create the global envelope storage instance"""
    global _storage_instance
    if _storage_instance is None:
        _storage_instance = EnvelopeStorage()
    return _storage_instance
