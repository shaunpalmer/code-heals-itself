"use strict";
/*
  Enhanced ESLint runner (optional) that configures:
  - eslint-plugin-import (catches unresolved/duplicate imports, cycles)
  - eslint-import-resolver-typescript (TS path resolution)
  - eslint-import-resolver-alias (alias support like @/src)
  - eslint-plugin-security (flags risky patterns)

  This module uses dynamic imports and fails open: if ESLint or plugins are
  missing, it logs a concise note and returns the original code unchanged.
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEnhancedESLintRunner = createEnhancedESLintRunner;
function createEnhancedESLintRunner(options) {
    const alias = (options === null || options === void 0 ? void 0 : options.alias) || { '@': './src' };
    const exts = (options === null || options === void 0 ? void 0 : options.extensions) || ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
    const tsconfigPath = (options === null || options === void 0 ? void 0 : options.tsconfigPath) || 'tsconfig.json';
    return async (code, opts) => {
        let ESLintCtor;
        try {
            // Lazy require to avoid hard dependency
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { ESLint } = require('eslint');
            ESLintCtor = ESLint;
        }
        catch {
            console.debug('[enhanced-eslint] ESLint not installed; skipping.');
            return code;
        }
        try {
            const eslint = new ESLintCtor({
                useEslintrc: false,
                baseConfig: {
                    parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
                    plugins: ['import', 'security'],
                    settings: {
                        'import/resolver': {
                            typescript: { project: tsconfigPath },
                            alias: { map: Object.entries(alias), extensions: exts }
                        }
                    },
                    rules: {
                        // import rules
                        'import/no-unresolved': 'error',
                        'import/no-duplicates': 'warn',
                        'import/no-cycle': ['warn', { ignoreExternal: true }],
                        // security rules (subset that does not require extra config)
                        'security/detect-unsafe-regex': 'warn',
                        'security/detect-eval-with-expression': 'warn',
                        'security/detect-non-literal-fs-filename': 'warn',
                        'security/detect-child-process': 'warn'
                    }
                },
                // Fix mode is off by default; FinalPolishObserver primarily formats
                fix: false
            });
            const filename = (opts === null || opts === void 0 ? void 0 : opts.filename) || 'polish.ts';
            const results = await eslint.lintText(code, { filePath: filename });
            const hasErrors = results.some((r) => r.errorCount > 0);
            if (hasErrors) {
                const msgs = results.flatMap((r) => r.messages || []);
                const top = msgs.slice(0, 5).map((m) => { var _a; return `${(_a = m.ruleId) !== null && _a !== void 0 ? _a : 'unknown'}: ${m.message} @${m.line}:${m.column}`; });
                console.warn('[enhanced-eslint] issues detected:', top);
            }
            // Return original code; ESLint here is for detection/signal
            return code;
        }
        catch (e) {
            console.debug('[enhanced-eslint] runner failed, continuing without ESLint:', (e === null || e === void 0 ? void 0 : e.message) || String(e));
            return code;
        }
    };
}
exports.default = createEnhancedESLintRunner;
