/*
  Optional Stylelint runner for CSS/SCSS validation, including path checks.
  - Uses stylelint with stylelint-config-standard and stylelint-scss if present.
  - Fails open (returns original code) if stylelint is not installed.
*/

/**
 * Stylelint runner: returns the original code (lint is for signaling only)
 * Engage/Disengage: Controlled by enable_stylelint policy in AIDebugger.
 */
export type StylelintRunner = (code: string, opts?: { filename?: string }) => Promise<string>;

export function createStylelintRunner(): StylelintRunner {
  return async (code: string, opts?: { filename?: string }) => {
    let stylelint: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      stylelint = require('stylelint');
    } catch {
      console.debug('[stylelint] not installed; skipping.');
      return code;
    }

    const filename = opts?.filename || 'polish.scss';
    try {
      const result = await stylelint.lint({
        code,
        codeFilename: filename,
        config: {
          extends: ['stylelint-config-standard'],
          plugins: ['stylelint-scss'],
          rules: {
            // Common sanity rules that surface import/path issues
            'no-empty-source': true,
            'function-no-unknown': true,
            'scss/at-import-no-partial-leading-underscore': true
          }
        }
      });

      if (result.errored) {
        const top = (result.results?.[0]?.warnings || []).slice(0, 5)
          .map((w: any) => `${w.rule}: ${w.text} @${w.line}:${w.column}`);
        console.warn('[stylelint] issues detected:', top);
      }

      return code;
    } catch (e) {
      console.debug('[stylelint] runner failed, continuing without Stylelint:', (e as any)?.message || String(e));
      return code;
    }
  };
}

/** A compact report shape for envelope metadata attachment */
export type StylelintReport = {
  errored: boolean;
  warnings: Array<{ rule: string; message: string; line?: number; column?: number }>;
  note?: string; // e.g., "stylelint not installed"
};

/**
 * Reporter that returns structured warnings for metadata attachment.
 * Fails open: if stylelint is missing, returns { errored:false, warnings:[], note }.
 */
export function createStylelintReporter() {
  return async (code: string, opts?: { filename?: string }): Promise<StylelintReport> => {
    let stylelint: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      stylelint = require('stylelint');
    } catch {
      return { errored: false, warnings: [], note: '[stylelint] not installed; skipping' };
    }

    const filename = opts?.filename || 'polish.scss';
    try {
      const result = await stylelint.lint({
        code,
        codeFilename: filename,
        config: {
          extends: ['stylelint-config-standard'],
          plugins: ['stylelint-scss'],
          rules: {
            'no-empty-source': true,
            'function-no-unknown': true,
            'scss/at-import-no-partial-leading-underscore': true
          }
        }
      });

      const warnings = (result.results?.[0]?.warnings || []).map((w: any) => ({
        rule: w.rule,
        message: w.text,
        line: w.line,
        column: w.column
      }));
      return { errored: Boolean(result.errored), warnings };
    } catch (e) {
      return { errored: false, warnings: [], note: `[stylelint] reporter failed: ${(e as any)?.message || String(e)}` };
    }
  };
}

export default createStylelintRunner;
