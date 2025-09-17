abstract class Observer {
  abstract update(subject: Subject, data: Record<string, any>): void;
}

class Subject {
  private observers: Observer[] = [];

  attach(observer: Observer): void {
    if (!this.observers.includes(observer)) {
      this.observers.push(observer);
    }
  }

  detach(observer: Observer): void {
    const index = this.observers.indexOf(observer);
    if (index > -1) {
      this.observers.splice(index, 1);
    }
  }

  notify(data: Record<string, any>): void {
    this.observers.forEach(observer => {
      observer.update(this, data);
    });
  }
}

class PatchObserver extends Observer {
  constructor(private name: string) {
    super();
  }

  update(subject: Subject, data: Record<string, any>): void {
    const outcome = {
      observer: this.name,
      patch_success: data.success || false,
      patch_name: data.patch_name || "",
      details: data.details || "",
      timestamp: data.timestamp || new Date().toISOString()
    };
    const jsonOutput = JSON.stringify(outcome, null, 2);
    console.log(`Observer ${this.name} received update: ${jsonOutput}`);
    // In a real system, send to logging service or AI feedback
  }
}

class ErrorHandler extends Subject {
  handleError(error: string, patchName: string = ""): void {
    const data = {
      error: error,
      patch_name: patchName,
      timestamp: new Date().toISOString()
    };
    this.notify(data);
  }
}

// --- Security/Observer extensions ---

type WatchdogEvent = {
  triggered: boolean;
  reason?: string;
  severity?: 'low' | 'medium' | 'high';
  suspicion?: 'none' | 'suspicious' | 'danger' | 'extreme';
  observed?: {
    execution_time_ms?: number;
    memory_used_mb?: number;
    cpu_used_percent?: number;
    limits_hit?: { time: boolean; memory: boolean; cpu: boolean };
  };
};

class HangWatchdog {
  private inFlight: Map<string, number> = new Map();
  constructor(private thresholdMs: number = 5000, private cpuThresholdPercent: number = 90) { }

  beginAttempt(key: string): void {
    this.inFlight.set(key, Date.now());
  }

  endAttempt(key: string, ctx?: { sandbox?: any; resourceUsage?: any }): WatchdogEvent {
    const started = this.inFlight.get(key);
    if (started == null) return { triggered: false };
    this.inFlight.delete(key);

    const wallMs = Date.now() - started;
    const observed = ctx?.resourceUsage?.observed || {};
    const execMs = (typeof ctx?.sandbox?.execution_time_ms === 'number' ? ctx?.sandbox?.execution_time_ms : undefined) ?? observed.execution_time_ms;
    const cpu = (typeof ctx?.sandbox?.cpu_used_percent === 'number' ? ctx?.sandbox?.cpu_used_percent : undefined) ?? observed.cpu_used_percent;
    const sandboxLimits = ctx?.sandbox?.limits_hit || { time: false, memory: false, cpu: false };
    const observedLimits = observed?.limits_hit || { time: false, memory: false, cpu: false };
    const limits = {
      time: Boolean(sandboxLimits.time || observedLimits.time),
      memory: Boolean(sandboxLimits.memory || observedLimits.memory),
      cpu: Boolean(sandboxLimits.cpu || observedLimits.cpu)
    };

    // Trigger if either wall or reported exec time exceeds threshold, or CPU pegged AND time grew
    const timeExceeded = (typeof execMs === 'number' && execMs > this.thresholdMs) || wallMs > this.thresholdMs || limits.time === true;
    const cpuHot = typeof cpu === 'number' && cpu >= this.cpuThresholdPercent;

    if (timeExceeded || cpuHot) {
      const severity: 'low' | 'medium' | 'high' = limits.time ? 'high' : (cpuHot ? 'medium' : 'low');
      const suspicion: 'suspicious' | 'danger' = (severity === 'low') ? 'suspicious' : 'danger';
      return {
        triggered: true,
        reason: limits.time ? `Resource time limit hit (> ${this.thresholdMs}ms)` : cpuHot ? `High CPU usage (>= ${this.cpuThresholdPercent}%)` : `Observed slow execution (> ${this.thresholdMs}ms)`,
        severity,
        suspicion,
        observed: { execution_time_ms: execMs ?? wallMs, memory_used_mb: observed.memory_used_mb, cpu_used_percent: cpu, limits_hit: limits }
      };
    }
    return { triggered: false, suspicion: 'none', observed: { execution_time_ms: execMs ?? wallMs, memory_used_mb: observed.memory_used_mb, cpu_used_percent: cpu, limits_hit: limits } };
  }
}

// Utility to escalate suspicion based on repeated triggers (e.g., attempts 3+)
function escalateSuspicion(
  base: NonNullable<WatchdogEvent['suspicion']> = 'suspicious',
  attempts: number,
  consecutiveFlags: number
): NonNullable<WatchdogEvent['suspicion']> {
  if (attempts >= 4 || consecutiveFlags >= 3) return 'extreme';
  if (attempts >= 3 || consecutiveFlags >= 2) return 'danger';
  return base;
}

// Aggregator type to surface in telemetry extras.observers
type WatchdogAggregate = {
  watchdog_flag_count: number;
  last_event?: WatchdogEvent;
};

type RiskFlag = {
  flag: string; // 'keyword' | 'size'
  reason: string;
  category?: string; // e.g., 'sql_injection', 'xss', 'auth_bypass', 'code_exec'
  level?: 'low' | 'medium' | 'high' | 'extreme';
  keyword?: string;
};

class RiskyEditObserver {
  constructor(private keywords: string[] = [], private maxLinesChanged: number = 50) { }

  evaluate(patchCode: string, originalCode?: string): RiskFlag[] {
    const flags: RiskFlag[] = [];
    const blob = (patchCode || '').toLowerCase();
    // Built-in categories with example terms (non-exhaustive, non-exploit)
    const categories: Array<{ cat: string; level: RiskFlag['level']; terms: string[] }> = [
      { cat: 'sql_injection', level: 'high', terms: ['drop table', 'union select', 'or 1=1', 'xp_cmdshell'] },
      { cat: 'xss', level: 'high', terms: ['<script', 'onerror=', 'javascript:'] },
      { cat: 'auth_bypass', level: 'high', terms: ['authentication_bypass', 'disable auth', 'allow insecure'] },
      { cat: 'code_exec', level: 'high', terms: ['eval(', 'function("', 'child_process.exec', 'execsync', 'os.system', 'subprocess.Popen'] },
      { cat: 'privilege_escalation', level: 'high', terms: ['setuid', 'sudo ', 'admin override'] },
      { cat: 'network_exfiltration', level: 'medium', terms: ['curl http', 'wget http', 'netcat', 'nc -e', 'base64 -d'] },
      { cat: 'buffer_overflow', level: 'medium', terms: ['strcpy(', 'gets(', 'memcpy(', 'strcat('] }
    ];

    // Check built-in categories first
    for (const { cat, level, terms } of categories) {
      for (const t of terms) {
        if (blob.includes(t)) {
          flags.push({ flag: 'keyword', reason: `Detected risky pattern: ${t} (${cat})`, category: cat, level, keyword: t });
        }
      }
    }

    // Check user-provided keywords
    for (const k of this.keywords) {
      if (blob.includes(k.toLowerCase())) {
        flags.push({ flag: 'keyword', reason: `Patch contains risky keyword: ${k}`, category: 'custom', level: 'medium', keyword: k });
      }
    }
    const lines = (patchCode || '').split('\n').length;
    const originalLines = (originalCode || '').split('\n').length;
    const delta = Math.max(0, Math.abs(lines - originalLines));
    if (delta > this.maxLinesChanged) {
      flags.push({ flag: 'size', reason: `Large change set: ~${delta} lines vs allowance ${this.maxLinesChanged}`, level: 'low', category: 'size' });
    }
    return flags;
  }
}

export { Observer, Subject, PatchObserver, ErrorHandler, HangWatchdog, RiskyEditObserver };
export { escalateSuspicion };
export type { WatchdogAggregate, WatchdogEvent, RiskFlag };