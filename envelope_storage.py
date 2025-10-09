"""
Envelope Storage Layer - Persists healing envelopes for dashboard display

Stores envelopes from AI healing runs in SQLite database for real-time dashboard updates.
Uses in-memory circular buffer for fast recent access (machine memory advantage).
"""
import sqlite3
import json
import os
from typing import List, Dict, Any, Optional, Deque
from datetime import datetime
from contextlib import contextmanager
from collections import deque
import threading

from collections import deque
import threading

class InMemoryEnvelopeQueue:
    """
    Fast circular buffer in machine RAM for recent envelopes.
    
    Why: LLMs have no memory, but the machine does! Use it.
    Acts as short-term working memory (5-20 iterations) before persisting to disk.
    
    Benefits:
    - 1000x faster than SQLite reads
    - Real-time dashboard updates without disk I/O
    - Reduces database write pressure
    - Survives between healing runs (until server restart)
    """
    
    def __init__(self, max_size: int = 20):
        """
        Args:
            max_size: Number of recent envelopes to keep in memory (default 20)
        """
        self.max_size = max_size
        self._queue: Deque[Dict[str, Any]] = deque(maxlen=max_size)
        self._lock = threading.Lock()  # Thread-safe for concurrent healing runs
    
    def push(self, envelope_data: Dict[str, Any], action: str) -> None:
        """
        Add envelope to in-memory queue (automatically evicts oldest when full)
        
        Args:
            envelope_data: Full envelope dictionary
            action: PROMOTE, REJECT, RETRY
        """
        with self._lock:
            # Transform to dashboard format immediately
            status_map = {
                "PROMOTE": "PROMOTED",
                "REJECT": "REJECTED",
                "RETRY": "RETRY",
                "PENDING": "PENDING"
            }
            
            entry = {
                "envelope": envelope_data,
                "action": action,
                "status": status_map.get(action, action),
                "timestamp": envelope_data.get("timestamp", datetime.now().isoformat()),
                "added_to_queue": datetime.now().isoformat()
            }
            
            self._queue.append(entry)
    
    def get_recent(self, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Get most recent envelopes from memory (FAST - no disk I/O)
        
        Returns:
            List of envelopes in dashboard format
        """
        with self._lock:
            # Return in reverse order (newest first)
            recent = list(self._queue)
            recent.reverse()
            
            # Transform to dashboard format
            result = []
            for entry in recent[:limit]:
                envelope = entry["envelope"]
                result.append({
                    "summary": f"Envelope {envelope.get('patch_id', 'unknown')} (python)",
                    "status": entry["status"],
                    "timestamp": entry["timestamp"],
                    "confidence": envelope.get("metadata", {}).get("confidence", {}).get("overall", 0),
                    "breaker": f"{envelope.get('breakerState', 'unknown')} breaker",
                    "payload": envelope
                })
            
            return result
    
    def get_metrics(self) -> Optional[Dict[str, Any]]:
        """
        Calculate metrics from in-memory envelopes (FAST)
        
        Returns:
            Metrics dict or None if not enough data
        """
        with self._lock:
            if not self._queue:
                return None
            
            total = len(self._queue)
            promoted = sum(1 for e in self._queue if e["status"] == "PROMOTED")
            pending = sum(1 for e in self._queue if e["status"] == "RETRY")
            
            # Calculate success rate
            healing_success = int((promoted / total) * 100) if total > 0 else 0
            
            # Get latest breaker status
            if self._queue:
                latest = self._queue[-1]  # Most recent
                breaker_status = latest["envelope"].get("breakerState", "steady")
            else:
                breaker_status = "steady"
            
            return {
                "healingSuccess": healing_success,
                "breakerStatus": breaker_status.lower() if breaker_status else "steady",
                "pendingReviews": pending,
                "source": "memory"  # Flag to indicate this came from RAM
            }
    
    def size(self) -> int:
        """Get current number of envelopes in memory"""
        with self._lock:
            return len(self._queue)
    
    def clear(self) -> None:
        """Clear all in-memory envelopes"""
        with self._lock:
            self._queue.clear()
    
    def get_llm_context(self, limit: int = 10) -> str:
        """
        Generate LLM-friendly context from recent healing attempts.
        
        This gives the LLM "memory" of what just happened - what worked, what failed,
        what patterns emerged. Helps it learn and adapt in real-time.
        
        Args:
            limit: Number of recent attempts to include (default 10)
            
        Returns:
            String formatted for LLM consumption with recent patterns
        """
        with self._lock:
            if not self._queue:
                return "No recent healing attempts in memory."
            
            # Get recent envelopes (newest first)
            recent = list(self._queue)
            recent.reverse()
            
            # Build LLM context
            lines = ["=== RECENT HEALING CONTEXT (Your Recent Memory) ===\n"]
            
            # Summary statistics
            total = len(recent)
            promoted = sum(1 for e in recent if e["status"] == "PROMOTED")
            rejected = sum(1 for e in recent if e["status"] == "REJECTED")
            retry = sum(1 for e in recent if e["status"] == "RETRY")
            
            success_rate = int((promoted / total) * 100) if total > 0 else 0
            
            lines.append(f"Success Rate: {success_rate}% ({promoted}/{total} promoted)")
            lines.append(f"Status Breakdown: {promoted} PROMOTED, {rejected} REJECTED, {retry} RETRY\n")
            
            # Individual attempt summaries (most recent N)
            lines.append("Recent Attempts (newest first):")
            for i, entry in enumerate(recent[:limit], 1):
                envelope = entry["envelope"]
                status = entry["status"]
                
                # Extract key info
                patch_id = envelope.get("patch_id", "unknown")
                confidence = envelope.get("metadata", {}).get("confidence", {})
                overall_conf = confidence.get("overall", 0) if isinstance(confidence, dict) else confidence
                breaker = envelope.get("breakerState", "unknown")
                
                # Get error type/message if available
                patch_data = envelope.get("patch_data", {})
                error_msg = patch_data.get("message", "")[:80]  # Truncate long messages
                
                lines.append(f"\n{i}. [{status}] {patch_id}")
                lines.append(f"   Confidence: {overall_conf:.2f} | Breaker: {breaker}")
                if error_msg:
                    lines.append(f"   Error: {error_msg}")
                
                # Show what happened
                attempts = envelope.get("attempts", [])
                if attempts:
                    last_attempt = attempts[-1]
                    note = last_attempt.get("note", "")[:60]
                    if note:
                        lines.append(f"   Last attempt: {note}")
            
            lines.append("\n=== END CONTEXT ===")
            
            return "\n".join(lines)
    
    def get_pattern_insights(self) -> Dict[str, Any]:
        """
        Analyze patterns in recent attempts for LLM guidance.
        
        Returns insights like:
        - What error types are succeeding/failing
        - Confidence score trends
        - Breaker state patterns
        """
        with self._lock:
            if len(self._queue) < 3:
                return {"insight": "Not enough data yet (need 3+ attempts)"}
            
            recent = list(self._queue)
            
            # Analyze patterns
            promoted = [e for e in recent if e["status"] == "PROMOTED"]
            rejected = [e for e in recent if e["status"] == "REJECTED"]
            
            insights = {
                "total_attempts": len(recent),
                "success_rate": len(promoted) / len(recent) if recent else 0,
                "improving": False,
                "degrading": False,
                "patterns": []
            }
            
            # Check if we're improving (more recent successes)
            if len(recent) >= 5:
                recent_5 = recent[-5:]
                older_5 = recent[-10:-5] if len(recent) >= 10 else recent[:-5]
                
                recent_success = sum(1 for e in recent_5 if e["status"] == "PROMOTED") / len(recent_5)
                older_success = sum(1 for e in older_5 if e["status"] == "PROMOTED") / len(older_5) if older_5 else 0
                
                if recent_success > older_success + 0.2:
                    insights["improving"] = True
                    insights["patterns"].append("✓ Success rate improving - keep current approach")
                elif recent_success < older_success - 0.2:
                    insights["degrading"] = True
                    insights["patterns"].append("⚠ Success rate declining - consider changing strategy")
            
            # Check breaker states
            breaker_states = [e["envelope"].get("breakerState", "unknown") for e in recent[-5:]]
            if breaker_states.count("OPEN") > 2:
                insights["patterns"].append("⚠ Circuit breaker opening frequently - errors cascading")
            
            # Confidence trends
            confidences = []
            for e in recent[-5:]:
                conf = e["envelope"].get("metadata", {}).get("confidence", {})
                if isinstance(conf, dict):
                    confidences.append(conf.get("overall", 0))
            
            if confidences and len(confidences) >= 3:
                avg_conf = sum(confidences) / len(confidences)
                if avg_conf < 0.3:
                    insights["patterns"].append("⚠ Low confidence scores - may need simpler approach")
                elif avg_conf > 0.8:
                    insights["patterns"].append("✓ High confidence - approach is working well")
            
            return insights


class EnvelopeStorage:
    """
    Dual-layer storage: In-memory queue (fast) + SQLite (persistent)
    
    Strategy:
    - Write to memory first (instant)
    - Also write to SQLite (background/persistent)
    - Read from memory if available (recent items)
    - Fall back to SQLite for history
    """
    
    def __init__(self, db_path: str = "artifacts/envelopes.db", memory_size: int = 20):
        self.db_path = db_path
        self.memory_queue = InMemoryEnvelopeQueue(max_size=memory_size)
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
            
            # 🏆 SUCCESS PATTERNS KNOWLEDGE BASE
            # Accumulate proven solutions from 95% successful fixes
            conn.execute("""
                CREATE TABLE IF NOT EXISTS success_patterns (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    error_code TEXT NOT NULL,        -- e.g., "RES.NAME_ERROR"
                    cluster_id TEXT,                 -- e.g., "RES.NAME_ERROR:requests"
                    fix_description TEXT,            -- Human-readable fix summary
                    fix_diff TEXT,                   -- Actual code change (diff)
                    success_count INTEGER DEFAULT 1, -- Number of times this fix worked
                    avg_confidence REAL,             -- Average confidence score
                    tags TEXT,                       -- Comma-separated (GOLD_STANDARD, etc.)
                    last_success_at TEXT,            -- Last time this fix worked
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(error_code, cluster_id, fix_description)
                )
            """)
            
            # Indexes for fast pattern matching
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_patterns_error_code 
                ON success_patterns(error_code)
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_patterns_cluster_id 
                ON success_patterns(cluster_id)
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_patterns_tags 
                ON success_patterns(tags)
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
        
        Strategy: MEMORY FIRST (fast), then SQLite (persistent)
        
        Args:
            envelope_data: Envelope dictionary (from envelope.to_json())
            action: PROMOTE, REJECT, or RETRY
        """
        # 1. Push to in-memory queue FIRST (instant - takes advantage of machine memory!)
        self.memory_queue.push(envelope_data, action)
        
        # 2. Also persist to SQLite (background - survives restarts)
        try:
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
                
                # 🏆 KNOWLEDGE BASE ACCUMULATION: Save successful fixes
                # When PROMOTE with confidence >= 0.7, add to success patterns
                if action == "PROMOTE" and overall_confidence and overall_confidence >= 0.7:
                    rebanker_raw = metadata.get("rebanker_raw", {})
                    error_code = rebanker_raw.get("code")
                    cluster_id = rebanker_raw.get("cluster_id")
                    
                    if error_code:
                        # Generate fix description from patch
                        patch = envelope_data.get("patch", {})
                        fix_description = f"Fix for {error_code}"
                        if "description" in patch:
                            fix_description = patch["description"][:200]  # Truncate
                        
                        # Get diff (if available)
                        fix_diff = patch.get("diff", "")
                        
                        try:
                            self.save_success_pattern(
                                error_code=error_code,
                                cluster_id=cluster_id,
                                fix_description=fix_description,
                                fix_diff=fix_diff,
                                confidence=overall_confidence
                            )
                        except Exception as e:
                            print(f"Warning: Failed to save success pattern: {e}")
        except Exception as e:
            # Don't fail if SQLite write fails - memory queue still has it!
            print(f"Warning: SQLite write failed (memory queue still intact): {e}")
    
    def get_latest_envelopes(self, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Get most recent envelopes for dashboard timeline
        
        Strategy: Try memory first (FAST), fall back to SQLite if needed
        """
        # Try in-memory queue first (1000x faster than disk!)
        memory_envelopes = self.memory_queue.get_recent(limit)
        
        if memory_envelopes and len(memory_envelopes) >= limit:
            # Memory has enough - return immediately
            return memory_envelopes
        
        # Memory doesn't have enough - query SQLite for full history
        try:
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
        except Exception as e:
            # If SQLite fails, at least return memory envelopes
            print(f"Warning: SQLite read failed, returning memory envelopes: {e}")
            return memory_envelopes if memory_envelopes else []
    
    def get_metrics(self) -> Dict[str, Any]:
        """
        Calculate real-time metrics for dashboard
        
        Strategy: Try memory first (instant), fall back to SQLite
        """
        # Try in-memory metrics first (FAST - no disk I/O)
        memory_metrics = self.memory_queue.get_metrics()
        
        if memory_metrics and memory_metrics.get("healingSuccess") is not None:
            return memory_metrics
        
        # Fall back to SQLite for full 24-hour history
        try:
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
                    "pendingReviews": pending,
                    "source": "sqlite"  # Flag to indicate this came from disk
            }
        except Exception as e:
            # If both memory and SQLite fail, return safe defaults
            print(f"Warning: Metrics calculation failed: {e}")
            return {
                "healingSuccess": 0,
                "breakerStatus": "unknown",
                "pendingReviews": 0,
                "source": "fallback"
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
    
    def garbage_collect_patterns(self, strategy: str = "conservative") -> Dict[str, int]:
        """
        Clean up low-value success patterns to prevent database bloat.
        
        Philosophy: Keep patterns that ACTUALLY HELP, discard one-off flukes.
        
        CRITICAL: NEVER delete high-value patterns, even if old!
          - success_count >= 10 → PROTECTED (proven winner)
          - GOLD_STANDARD tag → PROTECTED (high quality)
          - success_count >= 5 AND used within 1 year → PROTECTED
        
        Strategies:
        - conservative: Delete patterns with success_count=1 and last_success > 90 days
        - aggressive: Delete patterns with success_count < 3 and last_success > 60 days
        - nuclear: Delete patterns with success_count < 5 (EXCEPT protected patterns)
        
        Returns:
            Dict with deleted_count, remaining_count, protected_count
        """
        with self._get_connection() as conn:
            if strategy == "conservative":
                # One-offs that haven't been used in 90 days → DELETE
                # BUT: Never delete if success_count >= 10 or GOLD_STANDARD
                cursor = conn.execute("""
                    DELETE FROM success_patterns
                    WHERE success_count = 1 
                      AND datetime(last_success_at) < datetime('now', '-90 days')
                      AND success_count < 10
                      AND (tags NOT LIKE '%GOLD_STANDARD%' OR tags IS NULL)
                """)
            
            elif strategy == "aggressive":
                # Low-usage patterns (< 3 successes) older than 60 days → DELETE
                # BUT: Protect proven winners (>= 10 successes)
                cursor = conn.execute("""
                    DELETE FROM success_patterns
                    WHERE success_count < 3 
                      AND datetime(last_success_at) < datetime('now', '-60 days')
                      AND success_count < 10
                      AND (tags NOT LIKE '%GOLD_STANDARD%' OR tags IS NULL)
                """)
            
            elif strategy == "nuclear":
                # Keep only proven winners (≥ 5 successes) → DELETE rest
                # BUT: ALWAYS protect high-value patterns (>= 10 or GOLD_STANDARD)
                cursor = conn.execute("""
                    DELETE FROM success_patterns
                    WHERE success_count < 5
                      AND success_count < 10
                      AND (tags NOT LIKE '%GOLD_STANDARD%' OR tags IS NULL)
                """)
            
            else:
                raise ValueError(f"Unknown strategy: {strategy}")
            
            deleted_count = cursor.rowcount
            conn.commit()
            
            # Count remaining patterns
            cursor = conn.execute("SELECT COUNT(*) FROM success_patterns")
            remaining_count = cursor.fetchone()[0]
            
            # Count protected high-value patterns (never deleted)
            cursor = conn.execute("""
                SELECT COUNT(*) FROM success_patterns
                WHERE success_count >= 10 OR tags LIKE '%GOLD_STANDARD%'
            """)
            protected_count = cursor.fetchone()[0]
            
            return {
                "deleted_count": deleted_count,
                "remaining_count": remaining_count,
                "protected_count": protected_count,
                "strategy": strategy
            }
            return cursor.rowcount
    
    def get_memory_stats(self) -> Dict[str, Any]:
        """
        Get statistics about in-memory queue
        
        Returns:
            Dict with memory usage info
        """
        return {
            "in_memory_count": self.memory_queue.size(),
            "max_memory_size": self.memory_queue.max_size,
            "memory_percentage": int((self.memory_queue.size() / self.memory_queue.max_size) * 100)
        }
    
    # ========================================================================
    # 🏆 SUCCESS PATTERNS KNOWLEDGE BASE
    # ========================================================================
    
    def save_success_pattern(
        self, 
        error_code: str, 
        cluster_id: Optional[str],
        fix_description: str,
        fix_diff: str,
        confidence: float
    ) -> None:
        """
        Save a successful fix pattern to the knowledge base.
        Called when an envelope is PROMOTED with high confidence.
        
        Args:
            error_code: Canonical error code (e.g., "RES.NAME_ERROR")
            cluster_id: Specific cluster (e.g., "RES.NAME_ERROR:requests")
            fix_description: Human-readable summary of the fix
            fix_diff: Actual code change (unified diff)
            confidence: Confidence score for this fix (0.0-1.0)
        """
        # Auto-tag based on confidence thresholds
        tags = []
        if confidence >= 0.9:
            tags.append("GOLD_STANDARD")
        elif confidence >= 0.8:
            tags.append("HIGH_CONFIDENCE")
        elif confidence >= 0.7:
            tags.append("VERIFIED")
        
        tags_str = ",".join(tags)
        
        with self._get_connection() as conn:
            # Try to update existing pattern (increment success_count)
            cursor = conn.execute("""
                SELECT id, success_count, avg_confidence 
                FROM success_patterns 
                WHERE error_code = ? AND cluster_id = ? AND fix_description = ?
            """, (error_code, cluster_id or "", fix_description))
            
            existing = cursor.fetchone()
            
            if existing:
                # Update existing pattern (running average)
                pattern_id = existing[0]
                old_count = existing[1]
                old_avg = existing[2]
                
                new_count = old_count + 1
                new_avg = ((old_avg * old_count) + confidence) / new_count
                
                conn.execute("""
                    UPDATE success_patterns 
                    SET success_count = ?, 
                        avg_confidence = ?,
                        tags = ?,
                        last_success_at = datetime('now')
                    WHERE id = ?
                """, (new_count, new_avg, tags_str, pattern_id))
            else:
                # Insert new pattern
                conn.execute("""
                    INSERT INTO success_patterns 
                    (error_code, cluster_id, fix_description, fix_diff, 
                     success_count, avg_confidence, tags, last_success_at)
                    VALUES (?, ?, ?, ?, 1, ?, ?, datetime('now'))
                """, (error_code, cluster_id or "", fix_description, fix_diff, confidence, tags_str))
            
            conn.commit()
    
    def get_similar_success_patterns(
        self,
        error_code: Optional[str] = None,
        cluster_id: Optional[str] = None,
        limit: int = 5,
        min_confidence: float = 0.0
    ) -> List[Dict[str, Any]]:
        """
        Query knowledge base for similar successful fixes with intelligent fallback.
        
        Strategy:
        1. Try cluster_id (most specific, e.g., "RES.NAME_ERROR:requests")
        2. If < limit results, fall back to error_code (broader, e.g., "RES.NAME_ERROR")
        3. If still < limit, fall back to error family (e.g., "RES.*")
        4. If still empty, return [] → LLM uses base knowledge + scope widening
        
        Args:
            error_code: Error code to match (e.g., "RES.NAME_ERROR")
            cluster_id: Cluster to match (e.g., "RES.NAME_ERROR:requests")
            limit: Max number of patterns to return
            min_confidence: Minimum confidence threshold (0.0-1.0)
            
        Returns:
            List of pattern dicts ordered by success_count DESC, with fallback_level indicator
        """
        if not error_code and not cluster_id:
            return []
        
        patterns = []
        seen = set()  # Track unique patterns by (cluster_id, fix_description)
        
        with self._get_connection() as conn:
            # 🎯 Level 1: Try cluster_id (most specific)
            if cluster_id:
                cursor = conn.execute("""
                    SELECT error_code, cluster_id, fix_description, fix_diff,
                           success_count, avg_confidence, tags, last_success_at
                    FROM success_patterns
                    WHERE cluster_id = ? AND avg_confidence >= ?
                    ORDER BY success_count DESC, avg_confidence DESC
                    LIMIT ?
                """, (cluster_id, min_confidence, limit))
                
                rows = cursor.fetchall()
                for row in rows:
                    key = (row[1], row[2])  # (cluster_id, fix_description)
                    if key not in seen:
                        seen.add(key)
                        pattern = self._row_to_pattern(row)
                        pattern["fallback_level"] = "cluster"
                        patterns.append(pattern)
            
            # 🔄 Level 2: Fall back to error_code if not enough results
            if len(patterns) < limit and error_code:
                cursor = conn.execute("""
                    SELECT error_code, cluster_id, fix_description, fix_diff,
                           success_count, avg_confidence, tags, last_success_at
                    FROM success_patterns
                    WHERE error_code = ? AND avg_confidence >= ?
                    ORDER BY success_count DESC, avg_confidence DESC
                    LIMIT ?
                """, (error_code, min_confidence, limit))
                
                rows = cursor.fetchall()
                for row in rows:
                    key = (row[1], row[2])  # (cluster_id, fix_description)
                    if key not in seen and len(patterns) < limit:
                        seen.add(key)
                        pattern = self._row_to_pattern(row)
                        pattern["fallback_level"] = "error_code"
                        patterns.append(pattern)
            
            # 🌐 Level 3: Fall back to error family (e.g., "RES.*")
            if len(patterns) < limit and error_code and "." in error_code:
                family = error_code.split(".")[0]  # Extract "RES" from "RES.NAME_ERROR"
                cursor = conn.execute("""
                    SELECT error_code, cluster_id, fix_description, fix_diff,
                           success_count, avg_confidence, tags, last_success_at
                    FROM success_patterns
                    WHERE error_code LIKE ? AND avg_confidence >= ?
                    ORDER BY success_count DESC, avg_confidence DESC
                    LIMIT ?
                """, (f"{family}.%", min_confidence, limit))
                
                rows = cursor.fetchall()
                for row in rows:
                    key = (row[1], row[2])  # (cluster_id, fix_description)
                    if key not in seen and len(patterns) < limit:
                        seen.add(key)
                        pattern = self._row_to_pattern(row)
                        pattern["fallback_level"] = "family"
                        patterns.append(pattern)
            
            return patterns
    
    def _row_to_pattern(self, row) -> Dict[str, Any]:
        """Convert SQLite row to pattern dict"""
        return {
            "error_code": row[0],
            "cluster_id": row[1],
            "fix_description": row[2],
            "fix_diff": row[3],
            "success_count": row[4],
            "avg_confidence": row[5],
            "tags": row[6].split(",") if row[6] else [],
            "last_success_at": row[7]
        }
    
    def get_success_stats(self) -> Dict[str, Any]:
        """
        Get aggregate statistics about the knowledge base.
        
        Returns:
            Dict with total_patterns, total_successes, gold_standard_count, avg_confidence
        """
        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT 
                    COUNT(*) as total_patterns,
                    SUM(success_count) as total_successes,
                    AVG(avg_confidence) as overall_avg_confidence,
                    SUM(CASE WHEN tags LIKE '%GOLD_STANDARD%' THEN 1 ELSE 0 END) as gold_standard_count
                FROM success_patterns
            """)
            
            row = cursor.fetchone()
            
            return {
                "total_patterns": row[0] or 0,
                "total_successes": row[1] or 0,
                "overall_avg_confidence": round(row[2] or 0.0, 3),
                "gold_standard_count": row[3] or 0
            }


# Singleton instance for global access
_storage_instance: Optional[EnvelopeStorage] = None

def get_envelope_storage() -> EnvelopeStorage:
    """Get or create the global envelope storage instance"""
    global _storage_instance
    if _storage_instance is None:
        _storage_instance = EnvelopeStorage()
    return _storage_instance

