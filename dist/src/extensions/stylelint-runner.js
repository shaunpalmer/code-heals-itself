"use strict";
/*
  Optional Stylelint runner for CSS/SCSS validation, including path checks.
  - Uses stylelint with stylelint-config-standard and stylelint-scss if present.
  - Fails open (returns original code) if stylelint is not installed.
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStylelintRunner = createStylelintRunner;
exports.createStylelintReporter = createStylelintReporter;
function createStylelintRunner() {
    return async (code, opts) => {
        var _a, _b;
        let stylelint;
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            stylelint = require('stylelint');
        }
        catch {
            console.debug('[stylelint] not installed; skipping.');
            return code;
        }
        const filename = (opts === null || opts === void 0 ? void 0 : opts.filename) || 'polish.scss';
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
                const top = (((_b = (_a = result.results) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.warnings) || []).slice(0, 5)
                    .map((w) => `${w.rule}: ${w.text} @${w.line}:${w.column}`);
                console.warn('[stylelint] issues detected:', top);
            }
            return code;
        }
        catch (e) {
            console.debug('[stylelint] runner failed, continuing without Stylelint:', (e === null || e === void 0 ? void 0 : e.message) || String(e));
            return code;
        }
    };
}
/**
 * Reporter that returns structured warnings for metadata attachment.
 * Fails open: if stylelint is missing, returns { errored:false, warnings:[], note }.
 */
function createStylelintReporter() {
    return async (code, opts) => {
        var _a, _b;
        let stylelint;
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            stylelint = require('stylelint');
        }
        catch {
            return { errored: false, warnings: [], note: '[stylelint] not installed; skipping' };
        }
        const filename = (opts === null || opts === void 0 ? void 0 : opts.filename) || 'polish.scss';
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
            const warnings = (((_b = (_a = result.results) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.warnings) || []).map((w) => ({
                rule: w.rule,
                message: w.text,
                line: w.line,
                column: w.column
            }));
            return { errored: Boolean(result.errored), warnings };
        }
        catch (e) {
            return { errored: false, warnings: [], note: `[stylelint] reporter failed: ${(e === null || e === void 0 ? void 0 : e.message) || String(e)}` };
        }
    };
}
exports.default = createStylelintRunner;
