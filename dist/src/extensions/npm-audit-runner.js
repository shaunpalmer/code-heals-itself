"use strict";
/*
  Optional dependency audit runner using `npm audit --json`.
  - Designed to run outside hot path; call manually when needed.
  - Fail-open: if npm is unavailable or audit fails, returns ok=false with error message.
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.runNpmAuditSummary = runNpmAuditSummary;
const child_process_1 = require("child_process");
function runNpmAuditSummary(cwd = process.cwd(), timeoutMs = 15000) {
    var _a, _b, _c, _d, _e;
    try {
        const out = (0, child_process_1.execFileSync)('npm', ['audit', '--json', '--audit-level=low'], {
            cwd,
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: timeoutMs
        });
        const txt = out.toString('utf8');
        const json = JSON.parse(txt);
        // npm v8+ structure includes `vulnerabilities` object with severity counts
        const vulns = json.vulnerabilities || {};
        const severities = {
            info: ((_a = vulns.info) === null || _a === void 0 ? void 0 : _a.length) || vulns.info || 0,
            low: ((_b = vulns.low) === null || _b === void 0 ? void 0 : _b.length) || vulns.low || 0,
            moderate: ((_c = vulns.moderate) === null || _c === void 0 ? void 0 : _c.length) || vulns.moderate || 0,
            high: ((_d = vulns.high) === null || _d === void 0 ? void 0 : _d.length) || vulns.high || 0,
            critical: ((_e = vulns.critical) === null || _e === void 0 ? void 0 : _e.length) || vulns.critical || 0
        };
        const total = Object.values(severities).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
        return { ok: true, vulnerabilities: total, severities };
    }
    catch (e) {
        return { ok: false, error: (e === null || e === void 0 ? void 0 : e.message) || String(e) };
    }
}
exports.default = runNpmAuditSummary;
