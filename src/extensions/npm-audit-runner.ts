/*
  Optional dependency audit runner using `npm audit --json`.
  - Designed to run outside hot path; call manually when needed.
  - Fail-open: if npm is unavailable or audit fails, returns ok=false with error message.
*/

import { execFileSync } from 'child_process';

export type AuditSummary = {
  ok: boolean;
  vulnerabilities?: number;
  severities?: Record<string, number>;
  error?: string;
};

export function runNpmAuditSummary(cwd: string = process.cwd(), timeoutMs = 15000): AuditSummary {
  try {
    const out = execFileSync('npm', ['audit', '--json', '--audit-level=low'], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeoutMs
    });
    const txt = out.toString('utf8');
    const json = JSON.parse(txt);

    // npm v8+ structure includes `vulnerabilities` object with severity counts
    const vulns = json.vulnerabilities || {};
    const severities: Record<string, number> = {
      info: vulns.info?.length || vulns.info || 0,
      low: vulns.low?.length || vulns.low || 0,
      moderate: vulns.moderate?.length || vulns.moderate || 0,
      high: vulns.high?.length || vulns.high || 0,
      critical: vulns.critical?.length || vulns.critical || 0
    } as any;

    const total = Object.values(severities).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);

    return { ok: true, vulnerabilities: total, severities };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export default runNpmAuditSummary;
