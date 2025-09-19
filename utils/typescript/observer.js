"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskyEditObserver = exports.HangWatchdog = exports.ErrorHandler = exports.PatchObserver = exports.Subject = exports.Observer = void 0;
exports.escalateSuspicion = escalateSuspicion;
class Observer {
}
exports.Observer = Observer;
class Subject {
    constructor() {
        this.observers = [];
    }
    attach(observer) {
        if (!this.observers.includes(observer)) {
            this.observers.push(observer);
        }
    }
    detach(observer) {
        const index = this.observers.indexOf(observer);
        if (index > -1) {
            this.observers.splice(index, 1);
        }
    }
    notify(data) {
        this.observers.forEach(observer => {
            observer.update(this, data);
        });
    }
}
exports.Subject = Subject;
class PatchObserver extends Observer {
    constructor(name) {
        super();
        this.name = name;
    }
    update(subject, data) {
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
exports.PatchObserver = PatchObserver;
class ErrorHandler extends Subject {
    handleError(error, patchName = "") {
        const data = {
            error: error,
            patch_name: patchName,
            timestamp: new Date().toISOString()
        };
        this.notify(data);
    }
}
exports.ErrorHandler = ErrorHandler;
class HangWatchdog {
    constructor(thresholdMs = 5000, cpuThresholdPercent = 90) {
        this.thresholdMs = thresholdMs;
        this.cpuThresholdPercent = cpuThresholdPercent;
        this.inFlight = new Map();
    }
    beginAttempt(key) {
        this.inFlight.set(key, Date.now());
    }
    endAttempt(key, ctx) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const started = this.inFlight.get(key);
        if (started == null)
            return { triggered: false };
        this.inFlight.delete(key);
        const wallMs = Date.now() - started;
        const observed = ((_a = ctx === null || ctx === void 0 ? void 0 : ctx.resourceUsage) === null || _a === void 0 ? void 0 : _a.observed) || {};
        const execMs = (_d = (typeof ((_b = ctx === null || ctx === void 0 ? void 0 : ctx.sandbox) === null || _b === void 0 ? void 0 : _b.execution_time_ms) === 'number' ? (_c = ctx === null || ctx === void 0 ? void 0 : ctx.sandbox) === null || _c === void 0 ? void 0 : _c.execution_time_ms : undefined)) !== null && _d !== void 0 ? _d : observed.execution_time_ms;
        const cpu = (_g = (typeof ((_e = ctx === null || ctx === void 0 ? void 0 : ctx.sandbox) === null || _e === void 0 ? void 0 : _e.cpu_used_percent) === 'number' ? (_f = ctx === null || ctx === void 0 ? void 0 : ctx.sandbox) === null || _f === void 0 ? void 0 : _f.cpu_used_percent : undefined)) !== null && _g !== void 0 ? _g : observed.cpu_used_percent;
        const sandboxLimits = ((_h = ctx === null || ctx === void 0 ? void 0 : ctx.sandbox) === null || _h === void 0 ? void 0 : _h.limits_hit) || { time: false, memory: false, cpu: false };
        const observedLimits = (observed === null || observed === void 0 ? void 0 : observed.limits_hit) || { time: false, memory: false, cpu: false };
        const limits = {
            time: Boolean(sandboxLimits.time || observedLimits.time),
            memory: Boolean(sandboxLimits.memory || observedLimits.memory),
            cpu: Boolean(sandboxLimits.cpu || observedLimits.cpu)
        };
        // Trigger if either wall or reported exec time exceeds threshold, or CPU pegged AND time grew
        const timeExceeded = (typeof execMs === 'number' && execMs > this.thresholdMs) || wallMs > this.thresholdMs || limits.time === true;
        const cpuHot = typeof cpu === 'number' && cpu >= this.cpuThresholdPercent;
        if (timeExceeded || cpuHot) {
            const severity = limits.time ? 'high' : (cpuHot ? 'medium' : 'low');
            const suspicion = (severity === 'low') ? 'suspicious' : 'danger';
            return {
                triggered: true,
                reason: limits.time ? `Resource time limit hit (> ${this.thresholdMs}ms)` : cpuHot ? `High CPU usage (>= ${this.cpuThresholdPercent}%)` : `Observed slow execution (> ${this.thresholdMs}ms)`,
                severity,
                suspicion,
                observed: { execution_time_ms: execMs !== null && execMs !== void 0 ? execMs : wallMs, memory_used_mb: observed.memory_used_mb, cpu_used_percent: cpu, limits_hit: limits }
            };
        }
        return { triggered: false, suspicion: 'none', observed: { execution_time_ms: execMs !== null && execMs !== void 0 ? execMs : wallMs, memory_used_mb: observed.memory_used_mb, cpu_used_percent: cpu, limits_hit: limits } };
    }
}
exports.HangWatchdog = HangWatchdog;
// Utility to escalate suspicion based on repeated triggers (e.g., attempts 3+)
function escalateSuspicion(base = 'suspicious', attempts, consecutiveFlags) {
    if (attempts >= 4 || consecutiveFlags >= 3)
        return 'extreme';
    if (attempts >= 3 || consecutiveFlags >= 2)
        return 'danger';
    return base;
}
class RiskyEditObserver {
    constructor(keywords = [], maxLinesChanged = 50) {
        this.keywords = keywords;
        this.maxLinesChanged = maxLinesChanged;
    }
    evaluate(patchCode, originalCode) {
        const flags = [];
        const blob = (patchCode || '').toLowerCase();
        // Built-in categories with example terms (non-exhaustive, non-exploit)
        const categories = [
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
exports.RiskyEditObserver = RiskyEditObserver;
