/**
 * TypeScript Envelope Storage Layer - Hot Memory + Cold SQLite
 * 
 * Mirrors PHP EnvelopeStorage.php with better-sqlite3
 * 
 * Two-tier architecture:
 * - Hot Memory: InMemoryEnvelopeQueue (20 items, O(1) access)
 * - Cold Storage: SQLite (persistent, searchable)
 * 
 * Used by: HealingPipeline for remembering attempts and learning patterns
 */

import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";

interface HealingEnvelopeEntry {
  envelope: any;
  action: string;
  status: string;
  timestamp: string;
  added_at: number;
}

interface StorageMetrics {
  healing_success: number;
  breaker_status: string;
  pending_reviews: number;
  total_attempts: number;
  source: string;
}

/**
 * Circular buffer for recent envelopes in machine RAM
 * 1000x faster than SQLite for recent access
 */
class InMemoryEnvelopeQueue {
  private queue: HealingEnvelopeEntry[] = [];
  private max_size: number;

  constructor(max_size: number = 20) {
    this.max_size = max_size;
  }

  /**
   * Add envelope to memory (auto-evicts oldest if full)
   */
  push(envelope: any, action: string): void {
    const entry: HealingEnvelopeEntry = {
      envelope,
      action,
      status: this.mapActionToStatus(action),
      timestamp: new Date().toISOString(),
      added_at: Date.now() / 1000,
    };

    this.queue.push(entry);

    // Evict oldest if over max size
    if (this.queue.length > this.max_size) {
      this.queue.shift();
    }
  }

  /**
   * Get recent envelopes (newest first)
   */
  getRecent(limit: number = 20): HealingEnvelopeEntry[] {
    const recent = [...this.queue].reverse();
    return recent.slice(0, limit);
  }

  /**
   * Get metrics from in-memory envelopes (fast)
   */
  getMetrics(): StorageMetrics | null {
    if (this.queue.length === 0) {
      return null;
    }

    const total = this.queue.length;
    const promoted = this.queue.filter(
      (e) => e.status === "PROMOTED"
    ).length;
    const pending = this.queue.filter((e) => e.status === "RETRY").length;

    const healing_success = total > 0 ? Math.round((promoted / total) * 100) : 0;

    // Get latest breaker status
    const latest = this.queue[this.queue.length - 1];
    const breaker_status = (
      latest.envelope.breaker_state || "steady"
    ).toLowerCase();

    return {
      healing_success,
      breaker_status,
      pending_reviews: pending,
      total_attempts: total,
      source: "memory",
    };
  }

  /**
   * Generate LLM-friendly context from recent attempts
   */
  getContext(): string {
    if (this.queue.length === 0) {
      return "No recent healing history available.";
    }

    const recent = this.getRecent(5);
    let context = `Recent healing attempts (${recent.length}):\n\n`;

    recent.forEach((entry, idx) => {
      context += `${idx + 1}. Action: ${entry.action} | Status: ${entry.status}\n`;
      context += `   Error: ${entry.envelope.message || "N/A"}\n`;
      context += `   Velocity: ${entry.envelope.velocity || 0}\n\n`;
    });

    return context;
  }

  /**
   * Clear all memory
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }

  private mapActionToStatus(action: string): string {
    const statusMap: { [key: string]: string } = {
      PROMOTE: "PROMOTED",
      REJECT: "REJECTED",
      RETRY: "RETRY",
      PENDING: "PENDING",
      COMPLETE: "PROMOTED",
      ROLLBACK: "RETRY",
      ESCALATE: "RETRY",
      CONTINUE: "PENDING",
      STOP: "REJECTED",
    };
    return statusMap[action] || "UNKNOWN";
  }
}

/**
 * Cold storage with SQLite persistence
 */
class SQLiteEnvelopeStorage {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath: string = "./data/envelopes.db") {
    this.dbPath = dbPath;

    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Open or create database
    this.db = new Database(dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    // Create tables if they don't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS envelopes (
        id TEXT PRIMARY KEY,
        error_message TEXT,
        code TEXT,
        action TEXT,
        difficulty TEXT,
        velocity REAL,
        timestamp TEXT,
        attempt_number INTEGER,
        success INTEGER DEFAULT 0,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS success_patterns (
        id TEXT PRIMARY KEY,
        error_pattern TEXT,
        solution TEXT,
        success_rate REAL,
        uses INTEGER DEFAULT 0,
        timestamp TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_timestamp ON envelopes(timestamp);
      CREATE INDEX IF NOT EXISTS idx_difficulty ON envelopes(difficulty);
      CREATE INDEX IF NOT EXISTS idx_success ON envelopes(success);
    `);
  }

  /**
   * Store envelope in SQLite
   */
  store(envelope: any, action: string): string {
    const id = this.generateId(envelope);

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO envelopes
      (id, error_message, code, action, difficulty, velocity, timestamp, attempt_number, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      envelope.message || "",
      envelope.code || "",
      action,
      envelope.difficulty || "UNKNOWN",
      envelope.velocity || 0.0,
      new Date().toISOString(),
      envelope.attempt_number || 0,
      JSON.stringify(envelope)
    );

    return id;
  }

  /**
   * Retrieve envelope by ID
   */
  retrieve(id: string): any | null {
    const stmt = this.db.prepare(
      "SELECT metadata FROM envelopes WHERE id = ?"
    );
    const row = stmt.get(id) as any;

    if (!row) {
      return null;
    }

    return JSON.parse(row.metadata);
  }

  /**
   * Query envelopes by criteria
   */
  query(
    difficulty?: string,
    limit: number = 50
  ): any[] {
    let sql = "SELECT metadata FROM envelopes";
    const params: any[] = [];

    if (difficulty) {
      sql += " WHERE difficulty = ?";
      params.push(difficulty);
    }

    sql += " ORDER BY timestamp DESC LIMIT ?";
    params.push(limit);

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];

    return rows.map((row) => JSON.parse(row.metadata));
  }

  /**
   * Get success patterns (learning)
   */
  getSuccessPatterns(limit: number = 20): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM success_patterns
      ORDER BY success_rate DESC, uses DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as any[];
    return rows;
  }

  /**
   * Store a successful healing pattern
   */
  storeSuccessPattern(
    errorPattern: string,
    solution: string,
    successRate: number
  ): void {
    const id = this.generateId({ errorPattern, solution });

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO success_patterns
      (id, error_pattern, solution, success_rate, uses, timestamp)
      VALUES (?, ?, ?, ?, COALESCE((SELECT uses FROM success_patterns WHERE id = ?), 0) + 1, ?)
    `);

    stmt.run(
      id,
      errorPattern,
      solution,
      successRate,
      id,
      new Date().toISOString()
    );
  }

  /**
   * Get statistics
   */
  getStats(): {
    total_envelopes: number;
    successful: number;
    success_rate: number;
    total_patterns: number;
    avg_velocity: number;
  } {
    const countStmt = this.db.prepare("SELECT COUNT(*) as count FROM envelopes");
    const totalRow = countStmt.get() as any;

    const successStmt = this.db.prepare(
      "SELECT COUNT(*) as count FROM envelopes WHERE success = 1"
    );
    const successRow = successStmt.get() as any;

    const velocityStmt = this.db.prepare(
      "SELECT AVG(velocity) as avg_vel FROM envelopes"
    );
    const velocityRow = velocityStmt.get() as any;

    const patternStmt = this.db.prepare(
      "SELECT COUNT(*) as count FROM success_patterns"
    );
    const patternRow = patternStmt.get() as any;

    const total = totalRow.count || 0;
    const successful = successRow.count || 0;

    return {
      total_envelopes: total,
      successful,
      success_rate: total > 0 ? (successful / total) * 100 : 0,
      total_patterns: patternRow.count || 0,
      avg_velocity: velocityRow.avg_vel || 0.0,
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }

  private generateId(obj: any): string {
    const crypto = require("crypto");
    const canonical = JSON.stringify(obj, Object.keys(obj).sort());
    return crypto.createHash("sha256").update(canonical).digest("hex");
  }
}

/**
 * Unified Envelope Storage - manages both hot and cold tiers
 */
class EnvelopeStorage {
  private memory: InMemoryEnvelopeQueue;
  private sqlite: SQLiteEnvelopeStorage;

  constructor(sqlitePath: string = "./data/envelopes.db") {
    this.memory = new InMemoryEnvelopeQueue(20);
    this.sqlite = new SQLiteEnvelopeStorage(sqlitePath);
  }

  /**
   * Store envelope to both tiers
   */
  store(envelope: any, action: string): string {
    // Store in hot memory (fast)
    this.memory.push(envelope, action);

    // Store in cold storage (persistent)
    const id = this.sqlite.store(envelope, action);

    return id;
  }

  /**
   * Retrieve from hot memory first, then cold storage
   */
  retrieve(id: string): any | null {
    // Try memory first
    const recent = this.memory.getRecent(100);
    const found = recent.find((e) => e.envelope.id === id);

    if (found) {
      return found.envelope;
    }

    // Fall back to SQLite
    return this.sqlite.retrieve(id);
  }

  /**
   * Get recent envelopes from hot memory
   */
  getRecent(limit: number = 20): any[] {
    return this.memory.getRecent(limit).map((e) => e.envelope);
  }

  /**
   * Query cold storage
   */
  query(difficulty?: string, limit?: number): any[] {
    return this.sqlite.query(difficulty, limit);
  }

  /**
   * Get metrics (mostly from hot memory for speed)
   */
  getMetrics(): StorageMetrics | null {
    return this.memory.getMetrics();
  }

  /**
   * Get LLM context from recent attempts
   */
  getContext(): string {
    return this.memory.getContext();
  }

  /**
   * Get success patterns
   */
  getSuccessPatterns(limit?: number): any[] {
    return this.sqlite.getSuccessPatterns(limit);
  }

  /**
   * Store a successful pattern
   */
  storeSuccessPattern(
    errorPattern: string,
    solution: string,
    successRate: number
  ): void {
    this.sqlite.storeSuccessPattern(errorPattern, solution, successRate);
  }

  /**
   * Get statistics
   */
  getStats(): any {
    return this.sqlite.getStats();
  }

  /**
   * Clear hot memory (for testing or reset)
   */
  clearMemory(): void {
    this.memory.clear();
  }

  /**
   * Close storage
   */
  close(): void {
    this.sqlite.close();
  }
}

export { EnvelopeStorage, InMemoryEnvelopeQueue, SQLiteEnvelopeStorage };
export type { HealingEnvelopeEntry, StorageMetrics };
