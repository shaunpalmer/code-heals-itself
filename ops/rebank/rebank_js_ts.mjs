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
 *     "message": "Type 'number' is not assignable to type 'string'",
 *     "code": "TS2322",
 *     "severity": "ERROR"
 *   }
 * 
 * Design Notes:
 *   - Uses node --check (fast, AST-only) or tsc --noEmit (type checking)
 *   - Parses stderr with regex (Node/TS error formats are stable)
 *   - Returns structured JSON for envelope attachment (no schema changes)
 *   - Non-zero exit on error found; zero exit on clean
 *   - Supports both file checking and stdin pipe mode
 *   - LLM-friendly error messages with file paths, causes, and hints
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { classifyLines, loadTaxonomy } from '../../rebanker/classify.mjs';

// Regex patterns for Node.js and TypeScript errors
// Format 1: Node.js syntax error
//   /path/to/file.js:2
//   const x = [1,2,3
//   
//   SyntaxError: Unexpected end of input
const NODE_ERROR_RE = /^(.+?):(\d+)\s*\n([\s\S]*?)(\w+Error):\s*(.+?)$/m;

// Format 2: TypeScript compiler error
//   file.ts(42,15): error TS2304: Cannot find name 'undefinedVar'.
//   file.ts:42:15 - error TS2304: Cannot find name 'undefinedVar'.
const TS_ERROR_RE = /^(.+?)[\(:](\d+)[,:](\d+)\)?[\s:-]+(\w+)\s+(TS\d+):\s*(.+?)\.?$/m;

// Column indicator pattern (spaces before ^)
const COLUMN_INDICATOR_RE = /^\s*\^+\s*$/m;

const JS_LANG = 'js';
const TS_LANG = 'ts';

let cachedTaxonomy = null;

function getTaxonomy() {
  if (!cachedTaxonomy) {
    cachedTaxonomy = loadTaxonomy();
  }
  return cachedTaxonomy;
}

function roundNumber(value, precision = 2) {
  const factor = 10 ** precision;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return 0;
  }
  return Math.round(numeric * factor) / factor;
}

function normalizeSeverity(severity, fallback = {}) {
  if (severity && typeof severity === 'object') {
    return {
      label: severity.label ?? fallback.label ?? 'ERROR',
      score: roundNumber(severity.score ?? fallback.score ?? 0.6),
    };
  }

  const label = typeof severity === 'string' && severity ? severity : fallback.label ?? 'ERROR';
  return {
    label,
    score: roundNumber(fallback.score ?? 0.6),
  };
}

function enrichWithTaxonomy(error, lang) {
  if (!error) {
    return error;
  }

  const taxonomy = getTaxonomy();
  const defaults = taxonomy.defaults ?? {};
  const defaultSeverity = defaults.severity ?? {};

  const classified = classifyLines([error.message ?? ''], lang, taxonomy);
  const classifiedErrors = classified?.errors ?? [];
  const ranked = classifiedErrors[0];

  const enriched = { ...error };

  if (ranked) {
    enriched.code = ranked.code ?? enriched.code ?? 'UNK.UNKNOWN';
    enriched.severity = normalizeSeverity(ranked.severity ?? enriched.severity, defaultSeverity);
    enriched.difficulty = roundNumber(ranked.difficulty ?? enriched.difficulty ?? defaults.difficulty ?? 0.5);
    enriched.cluster_id = ranked.cluster_id ?? enriched.cluster_id ?? enriched.code;
    enriched.hint = ranked.hint ?? enriched.hint ?? 'Review raw diagnostic; no taxonomy match.';
    enriched.confidence = roundNumber(ranked.confidence ?? enriched.confidence ?? defaults.confidence ?? 0.5);
  } else {
    enriched.code = enriched.code ?? 'UNK.UNKNOWN';
    enriched.severity = normalizeSeverity(enriched.severity, defaultSeverity);
    enriched.difficulty = roundNumber(enriched.difficulty ?? defaults.difficulty ?? 0.5);
    enriched.cluster_id = enriched.cluster_id ?? enriched.code;
    enriched.hint = enriched.hint ?? 'Review raw diagnostic; no taxonomy match.';
    enriched.confidence = roundNumber(enriched.confidence ?? defaults.confidence ?? 0.5);
  }

  return enriched;
}

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
    const errorType = match[4]; // SyntaxError, ReferenceError, etc.
    const message = match[5].trim();

    // Extract column from ^ pointer (if present)
    let column = null;
    const pointerMatch = COLUMN_INDICATOR_RE.exec(stderr);
    if (pointerMatch) {
      const pointerLine = pointerMatch[0];
      column = pointerLine.indexOf('^');
    }

    return enrichWithTaxonomy({
      file,
      line,
      column,
      message: `${errorType}: ${message}`,
      code: 'JS_SYNTAX',
      severity: 'FATAL_SYNTAX'
    }, JS_LANG);
  }

  // Fallback: unparseable error
  return defaultFile ? enrichWithTaxonomy({
    file: defaultFile,
    line: null,
    column: null,
    message: `Unparseable Node.js error in ${defaultFile}. Raw output: ${stderr.slice(0, 200)}`,
    code: 'JS_UNPARSED',
    severity: 'ERROR'
  }, JS_LANG) : null;
}

/**
 * Parse TypeScript compiler error output (from tsc --noEmit)
 */
function parseTypeScriptError(stderr, defaultFile = null) {
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

    return enrichWithTaxonomy({
      file,
      line,
      column,
      message,
      code,
      severity: severity === 'ERROR' ? 'ERROR' : 'WARNING'
    }, TS_LANG);
  }

  // Fallback: unparseable error
  return defaultFile ? enrichWithTaxonomy({
    file: defaultFile,
    line: null,
    column: null,
    message: `Unparseable TypeScript error in ${defaultFile}. Raw output: ${stderr.slice(0, 200)}`,
    code: 'TS_UNPARSED',
    severity: 'ERROR'
  }, TS_LANG) : null;
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
      resolve(enrichWithTaxonomy({
        file: filePath,
        line: null,
        column: null,
        message: `Failed to run node --check on ${filePath}: ${err.message} (check Node.js installation or file permissions)`,
        code: 'JS_CHECK_FAILED',
        severity: 'FATAL_SYNTAX'
      }, JS_LANG));
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
        const error = parseTypeScriptError(output, filePath);
        resolve(error);
      }
    });

    proc.on('error', err => {
      resolve(enrichWithTaxonomy({
        file: filePath,
        line: null,
        column: null,
        message: `Failed to run tsc on ${filePath}: ${err.message} (check TypeScript installation or tsconfig.json)`,
        code: 'TS_CHECK_FAILED',
        severity: 'ERROR'
      }, TS_LANG));
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
    const parser = typescriptMode ? parseTypeScriptError : parseNodeError;
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
    const isTS = filePath.endsWith('.ts') || filePath.endsWith('.tsx');

    if (!existsSync(filePath)) {
      errors.push(enrichWithTaxonomy({
        file: filePath,
        line: null,
        column: null,
        message: `File not found: ${filePath} (check path or file was deleted)`,
        code: 'FILE_NOT_FOUND',
        severity: 'FATAL_SYNTAX'
      }, isTS ? TS_LANG : JS_LANG));
      continue;
    }

    // Determine checker based on extension
    const checker = isTS ? checkTypeScript : checkJavaScript;

    try {
      const error = await checker(filePath);
      if (error) {
        errors.push(error);
      }
    } catch (err) {
      errors.push(enrichWithTaxonomy({
        file: filePath,
        line: null,
        column: null,
        message: `Error checking ${filePath}: ${err.message}`,
        code: 'CHECK_FAILED',
        severity: 'ERROR'
      }, isTS ? TS_LANG : JS_LANG));
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
