#!/usr/bin/env node
/**
 * rebank_js_ts.mjs — JavaScript/TypeScript Re-Banker for Self-Healing System
 * 
 * Parses Node.js and TypeScript compiler output into structured 5-field error objects.
 * Uses `node --check` for JS and `tsc --noEmit` for TS (syntax-only, no execution).
 * 
 * Usage:
 *   node ops/rebank/rebank_js_ts.mjs <file.js> [<file2.ts> ...]
 *   node --check <file.js> 2>&1 | node ops/rebank/rebank_js_ts.mjs --stdin
 *   tsc --noEmit <file.ts> 2>&1 | node ops/rebank/rebank_js_ts.mjs --stdin --typescript
 * 
 * Output (JSON):
 *   {
 *     "file": "path/to/file.ts",
 *     "line": 42,
 *     "column": 15,
 *     "message": "Cannot find name 'undefinedVar'",
 *     "code": "TS2304",
 *     "severity": "ERROR"
 *   }
 * 
 * Design Notes:
 *   - Uses node --check (fast, AST-only) or tsc --noEmit (type checking)
 *   - Parses stderr with regex (Node/TS error formats are stable)
 *   - Returns structured JSON for envelope attachment (no schema changes)
 *   - Non-zero exit on parse failure; zero exit on clean
 *   - Supports both file checking and stdin pipe mode
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Regex patterns for Node.js and TypeScript errors
// Format 1: Node.js syntax error
//   /path/to/file.js:10
//   const x = [1,2,3
//             ^
//   SyntaxError: Unexpected end of input
const NODE_ERROR_RE = /^(.+?):(\d+)\n.*?\n\s*\^+\n(\w+Error):\s*(.+)$/ms;

// Format 2: TypeScript compiler error
//   file.ts(42,15): error TS2304: Cannot find name 'undefinedVar'.
const TS_ERROR_RE = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s*(.+?)\.?$/m;

// Format 3: ESLint JSON output (if --format json)
// [{"filePath":"file.js","messages":[{"line":10,"column":5,"severity":2,"message":"...","ruleId":"..."}]}]

/**
 * Parse Node.js error output (from node --check)
 */
function parseNodeError(stderr, defaultFile = null) {
  if (!stderr || !stderr.trim()) {
    return null;
  }

  const match = NODE_ERROR_RE.exec(stderr);
  if (match) {
    const file = match[1];
    const line = parseInt(match[2], 10);
    const errorType = match[3]; // SyntaxError, ReferenceError, etc.
    const message = match[4].trim();

    // Extract column from ^ pointer (count leading spaces)
    const lines = stderr.split('\n');
    const pointerLine = lines.find(l => /^\s*\^+\s*$/.test(l));
    const column = pointerLine ? pointerLine.indexOf('^') : null;

    return {
      file,
      line,
      column,
      message: `${errorType}: ${message}`,
      code: 'JS_SYNTAX',
      severity: 'FATAL_SYNTAX'
    };
  }

  // Fallback: unparseable error
  return defaultFile ? {
    file: defaultFile,
    line: null,
    column: null,
    message: stderr.split('\n')[0]?.slice(0, 200) || 'Unknown error',
    code: 'JS_UNPARSED',
    severity: 'ERROR'
  } : null;
}

/**
 * Parse TypeScript compiler error output (from tsc --noEmit)
 */
function parseTypescriptError(stderr, defaultFile = null) {
  if (!stderr || !stderr.trim()) {
    return null;
  }

  const match = TS_ERROR_RE.exec(stderr);
  if (match) {
    const file = match[1];
    const line = parseInt(match[2], 10);
    const column = parseInt(match[3], 10);
    const severity = match[4].toUpperCase(); // ERROR or WARNING
    const code = match[5]; // TS2304, etc.
    const message = match[6].trim();

    return {
      file,
      line,
      column,
      message,
      code,
      severity: severity === 'ERROR' ? 'ERROR' : 'WARNING'
    };
  }

  // Fallback: unparseable error
  return defaultFile ? {
    file: defaultFile,
    line: null,
    column: null,
    message: stderr.split('\n')[0]?.slice(0, 200) || 'Unknown error',
    code: 'TS_UNPARSED',
    severity: 'ERROR'
  } : null;
}

/**
 * Check syntax of a JavaScript file using node --check
 */
async function checkJavaScript(filePath) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', ['--check', filePath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr.on('data', chunk => { stderr += chunk.toString(); });

    proc.on('close', code => {
      if (code === 0) {
        resolve(null); // Clean
      } else {
        const error = parseNodeError(stderr, filePath);
        resolve(error);
      }
    });

    proc.on('error', err => {
      reject(new Error(`Failed to run node --check: ${err.message}`));
    });
  });
}

/**
 * Check syntax/types of a TypeScript file using tsc --noEmit
 */
async function checkTypeScript(filePath) {
  return new Promise((resolve, reject) => {
    // Note: tsc --noEmit checks the whole project by default
    // For single-file checking, we might need --noResolve or isolated mode
    const proc = spawn('tsc', ['--noEmit', filePath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stderr = '';
    let stdout = '';
    proc.stderr.on('data', chunk => { stderr += chunk.toString(); });
    proc.stdout.on('data', chunk => { stdout += chunk.toString(); });

    proc.on('close', code => {
      const output = stderr || stdout;
      if (code === 0 && !output.includes('error TS')) {
        resolve(null); // Clean
      } else {
        const error = parseTypescriptError(output, filePath);
        resolve(error);
      }
    });

    proc.on('error', err => {
      reject(new Error(`Failed to run tsc: ${err.message}`));
    });
  });
}

/**
 * Main CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const stdinMode = args.includes('--stdin');
  const typescriptMode = args.includes('--typescript');
  const quiet = args.includes('--quiet') || args.includes('-q');
  const files = args.filter(a => !a.startsWith('--'));

  // Mode 1: Parse stdin (pipe from external node/tsc)
  if (stdinMode) {
    const stdin = readFileSync(0, 'utf-8'); // Read from stdin
    const parser = typescriptMode ? parseTypescriptError : parseNodeError;
    const error = parser(stdin);

    if (error) {
      console.log(JSON.stringify(error, null, 0));
      process.exit(1);
    } else if (!quiet) {
      console.log(JSON.stringify({ status: 'clean' }));
    }
    process.exit(0);
  }

  // Mode 2: Check files directly
  if (files.length === 0) {
    console.error('Usage: node rebank_js_ts.mjs <file> [<file2>...]');
    console.error('       node rebank_js_ts.mjs --stdin [--typescript]');
    process.exit(1);
  }

  const errors = [];
  for (const file of files) {
    const filePath = resolve(file);

    if (!existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      continue;
    }

    // Determine checker based on extension
    const isTS = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
    const checker = isTS ? checkTypeScript : checkJavaScript;

    try {
      const error = await checker(filePath);
      if (error) {
        errors.push(error);
      }
    } catch (err) {
      console.error(`Error checking ${filePath}: ${err.message}`);
    }
  }

  // Output results
  if (errors.length > 0) {
    // Emit first error only (keeps envelope tight)
    console.log(JSON.stringify(errors[0], null, 0));
    process.exit(1);
  } else if (!quiet) {
    console.log(JSON.stringify({ status: 'clean', files_checked: files.length }));
  }

  process.exit(0);
}

// Run
main().catch(err => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(2);
});
