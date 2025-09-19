/*
  Enhanced ESLint runner (optional) that configures:
  - eslint-plugin-import (catches unresolved/duplicate imports, cycles)
  - eslint-import-resolver-typescript (TS path resolution)
  - eslint-import-resolver-alias (alias support like @/src)
  - eslint-plugin-security (flags risky patterns)

  This module uses dynamic imports and fails open: if ESLint or plugins are
  missing, it logs a concise note and returns the original code unchanged.
*/

export type EslintRunner = (code: string, opts?: { filename?: string }) => Promise<string>;

export function createEnhancedESLintRunner(options?: {
  alias?: Record<string, string>;
  extensions?: string[];
  tsconfigPath?: string;
}): EslintRunner {
  const alias = options?.alias || { '@': './src' };
  const exts = options?.extensions || ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
  const tsconfigPath = options?.tsconfigPath || 'tsconfig.json';

  return async (code: string, opts?: { filename?: string }) => {
    let ESLintCtor: any;
    try {
      // Lazy require to avoid hard dependency
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { ESLint } = require('eslint');
      ESLintCtor = ESLint;
    } catch {
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

      const filename = opts?.filename || 'polish.ts';
      const results = await eslint.lintText(code, { filePath: filename });
      const hasErrors = results.some((r: any) => r.errorCount > 0);

      if (hasErrors) {
        const msgs = results.flatMap((r: any) => r.messages || []);
        const top = msgs.slice(0, 5).map((m: any) => `${m.ruleId ?? 'unknown'}: ${m.message} @${m.line}:${m.column}`);
        console.warn('[enhanced-eslint] issues detected:', top);
      }

      // Return original code; ESLint here is for detection/signal
      return code;
    } catch (e) {
      console.debug('[enhanced-eslint] runner failed, continuing without ESLint:', (e as any)?.message || String(e));
      return code;
    }
  };
}

export default createEnhancedESLintRunner;
