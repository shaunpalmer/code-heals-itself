Yo Shaun — the “particle” you’re thinking of is MCP: Model Context Protocol. It’s the open, USB-C-style bridge that sits between an LLM and your tools/data. In MCP terms, your app (host/client) connects to one or more MCP servers that expose three things the model can discover and use: tools (callable actions), resources (read-only context like files or DB schemas), and prompts (templated instructions). Under the hood it rides JSON-RPC over stdio/WebSocket. 
modelcontextprotocol.io
+2
docs.claude.com
+2

Here’s how I’d drop it into your self-healing loop without changing your schema or envelope plan:

Fast integration plan (4 solid paths)

Re-Banker as an MCP Server (tools-first)

Expose syntax_check tools: php -l, tsc --noEmit, py -m pyflakes (or ruff --select=E,F).

Expose rebank to parse raw compiler output → your 5-field error object (line, col?, file, description, code/severity).

The host asks the server only when needed; you attach that object to the Traveling Envelope. No schema drift. 
modelcontextprotocol.io

# Targeted Search-and-Insertion Algorithm for Code Patching

Efficiently locate the correct insertion point in a codebase and apply a change, without scanning or rebuilding the entire code.

## Algorithm Concept
Inspired by pathfinding algorithms (like Dijkstra’s or A*), but focused on code structure. The algorithm traverses code elements (lines, blocks, AST nodes) to find the optimal spot for insertion.

## Steps
1. Parse the code structure (tokenize or build AST)
2. Define insertion criteria (function name, class, marker, etc.)
3. Traverse code elements, checking against criteria
4. Select the best match and record its position
5. Insert the patch at the identified location

## Pseudocode
```
function search_and_insert(code, criteria, patch):
    ast = parse_code_to_ast(code)
    for node in ast:
        if matches_criteria(node, criteria):
            insert_patch_at(node, patch)
            return updated_code
    raise Exception("No suitable insertion point found")
```

## Example Use Cases
- Insert a logging statement after every function definition
- Add a new method to a specific class
- Patch a configuration value in a settings file

## Benefits
- Fast: Only scans relevant parts of the code
- Precise: Avoids unnecessary changes elsewhere
- Scalable: Works for large codebases and complex logic

---

# GitHub Integration & Commit Messaging

When automating code patching via GitHub:
- Use the search-and-insert algorithm to generate minimal, targeted diffs
- Commit messages should be clear, concise, and reference the intent (e.g., "patch: insert logging after all functions")
- Example commit message:
  > patch: insert logging after all functions for audit traceability

Automated workflow:
1. Clone or pull the latest repo state
2. Run the search-and-insert patcher
3. Stage and commit changes with a descriptive message
4. Push to the appropriate branch or open a pull request

---

Project context as MCP Resources (read-only)

Mount safe, read-only URIs (e.g., res://repo/..., res://envelope.json, res://logs/…) so the LLM can pull just-enough context instead of globbing the codebase. This trims tokens and speeds traces. 
modelcontextprotocol.io

Standardize your fixer prompts as MCP Prompts

Publish fix-syntax, safe-patch, reason-about-breaker as parameterized prompts (e.g., {language, file, line, error}) so different hosts/agents call them consistently with your rules (no header clobbering, patch-in-place, etc.). 
modelcontextprotocol.io

Dual-path rollout (keep it swappable)

Keep your current direct shell runners as the “A” path; add MCP as “B”. Feature-flag per language or repo. If MCP server isn’t present, you fall back automatically. (This mirrors the “integrate once, connect many” goal of MCP.) 
Anthropic

Architecture-first (where code lives / how it hooks)
/infrastructure
  /mcp-servers
    /rebanker-ts/            # TS MCP server: tools: syntax_check_*, rebank
    /rebanker-py/            # Optional Python flavor
  /hosts
    /runner-cli/             # Your loop host; tries MCP first → fallback to local
/selfhealing
  /envelope/                 # envelope.py / tests you already planned
  /prompts/                  # source-of-truth prompt templates (mirrored via MCP Prompts)


Naming conventions

Tools: syntax_check_php, syntax_check_ts, syntax_check_py, rebank_errors.

Resources: res://project/{path}, res://envelope/state, res://timeline/recent.

Prompts: fix_syntax, apply_patch, breaker_triage.

Activation

Host reads .mcp.json (or env) to discover local servers: stdio for local speed, ws://localhost:port for services in containers. JSON-RPC handshake per spec. 
modelcontextprotocol.io

What to test (parity + safety)

Hash parity: envelope hash unchanged when only attempts/timestamp vary (you already planned this).

Tool contract: given a broken file, syntax_check_* returns 1 precise error tuple under 10ms for small files.

Security: servers are allow-listed binaries and paths; no network egress by default; confirm tool args are escaped. (There’s already a real-world malicious MCP server incident—treat third-party servers like you treat npm: pin versions, review code, rotate creds if compromised.) 
IT Pro

Quick comparisons (why MCP here)

Direct shell vs MCP tool
Direct is fastest to wire, but N bespoke adapters. MCP gives one discovery + schema for tools/prompts/resources; easier to share across hosts/agents. 
modelcontextprotocol.io

Ad-hoc context uploads vs MCP resources
Uploads bloat tokens and drift. MCP resources let the model pull targeted files/metadata by URI. 
modelcontextprotocol.io

One-off prompts vs MCP prompts
Hand-copied prompts rot; MCP prompts are discoverable & typed, so every caller uses the same template. 
modelcontextprotocol.io

Plugin APIs vs open standard
MCP is vendor-neutral and already landing in Claude, GitHub Copilot, Windows ecosystem, etc., so you integrate once and ride the network effects. 
docs.claude.com
+2
GitHub Docs
+2

Minimal, working Re-Banker parser (drop-in today)

Python (CLI): parses php -l / tsc / pyflakes output to your 5 fields and emits JSON. (Keep this in /infrastructure/rebanker-py/ even before you wire MCP.)

#!/usr/bin/env python3
"""
rebanker.py — Parse compiler/linter output into a 5-field error object.
Usage:
  php -l /path/file.php 2>&1 | ./rebanker.py --lang php --file /path/file.php
  tsc --noEmit 2>&1 | ./rebanker.py --lang ts
  pyflakes /path/file.py 2>&1 | ./rebanker.py --lang py --file /path/file.py
"""
import sys, re, json, argparse, os

PHP_RE   = re.compile(r"on line (\d+)")
TS_RE    = re.compile(r"^(.+)\((\d+),(\d+)\): error (TS\d+): (.+)$")
PY_RE    = re.compile(r"^(.+):(\d+):\d*:\s*(.+)$")

def parse(log, lang, default_file=None):
    line = col = None
    file = default_file
    code = "SYNTAX"
    desc = log.strip().splitlines()[:1][0] if log.strip() else "Unknown error"

    if lang == "php":
        m = PHP_RE.search(log)
        if m: line = int(m.group(1))
        # php -l prints the file name separately sometimes
        if not file:
            for l in log.splitlines():
                if l.startswith("Errors parsing "):
                    file = l.replace("Errors parsing ", "").strip()
                    break
        return line, col, file, "PHP-E_STSYN", desc

    if lang == "ts":
        for l in log.splitlines():
            m = TS_RE.match(l)
            if m:
                file, line, col, code, desc = m.group(1), int(m.group(2)), int(m.group(3)), m.group(4), m.group(5)
                return line, col, file, code, desc

    if lang == "py":
        for l in log.splitlines():
            m = PY_RE.match(l)
            if m:
                file, line, desc = m.group(1), int(m.group(2)), m.group(3)
                return line, col, file, "PYF", desc

    return None, None, file, code, desc

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", choices=["php", "ts", "py"], required=True)
    ap.add_argument("--file")
    args = ap.parse_args()

    raw = sys.stdin.read()
    line, col, file, code, desc = parse(raw, args.lang, args.file)
    out = {
        "line": line,
        "column": col,
        "file": file,
        "description": desc,
        "code": code,
    }
    print(json.dumps(out, ensure_ascii=False))


Where it goes: /infrastructure/rebanker-py/rebanker.py

Deps: none (stdlib).

Hook: your loop shells the compiler, pipes stderr/stdout to this script, stores the JSON on the envelope (no schema changes).

If you want me to scaffold the actual MCP server next, say “mcp server ts” (TypeScript) or “mcp server py” and I’ll drop a tiny, production-ish server that exposes syntax_check_*, rebank_errors, and read-only project resources per spec.

 I’ll give you a tight “table resource” first (commands + what we parse), then drop in tiny, production-ready re-banker scripts for JS/TS, Python, and PHP that normalize to your 5-field payload.

# Re-Banking: Fast Native Checks (Summary Table)

| Lang           | Fastest native check (no execution) | Example stderr signature                                                                               | What we extract (regex hint)                                              | Notes                                                                                                      |
| -------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **JavaScript** | `node --check <file.js>`            | `path/to/file.js:1\n... ^\n\nSyntaxError: <msg>`                                                       | `file, line, (optional column from caret row), message, code="JS_SYNTAX"` | `--check` parses without running code (official). ([Node.js][1])                                           |
| **TypeScript** | `tsc --noEmit <paths-or-tsconfig>`  | `file.ts(10,5): error TS1005: ';' expected.`                                                           | `file, line, column, message, code=TS####`                                | `--noEmit` = type/syntax check only. For JS projects, add `--allowJs --checkJs`. ([typescriptlang.org][2]) |
| **Python**     | `python -m py_compile <file.py>`    | `Sorry: IndentationError: ... (file.py, line 3)` **or** traceback ending with `File "file.py", line 3` | `file, line, (optional column not provided), message, code="PY_SYNTAX"`   | Non-zero exit on failure; zero on pass. ([Python documentation][3])                                        |
| **PHP**        | `php -l <file.php>`                 | `PHP Parse error: syntax error, <details> in <file> on line <N>`                                       | `file, line, (no column), message, code="PHP_PARSE"`                      | CLI linter is standard; error shape includes file & line. Example form shown here. ([code-basics.com][4])  |

---

# Normalized error payload (what each script emits)

```json
{
  "file": "string",
  "line": 123,
  "column": 5,
  "message": "string",
  "code": "string",          // e.g. TS1005, JS_SYNTAX, PY_SYNTAX, PHP_PARSE
  "severity": "FATAL_SYNTAX" // fixed for compiler parse failures
}
```

This maps 1:1 to your envelope’s structured error object without adding schema fields: we’ll attach it under your existing `patch_data`/`metadata` path like we discussed (no new schema artifacts).

---

# Tiny re-banker scripts (drop-in)

## 1) JS / TS re-banker (Node, handles both)

**File:** `ops/rebank/rebank-js-ts.mjs`
**Deps:** none (uses built-ins)
**Run:** `node ops/rebank/rebank-js-ts.mjs <fileOrGlob> --mode=js|ts`

```js
#!/usr/bin/env node
/**
 * ReBanker for JS/TS: runs Node --check (JS) or tsc --noEmit (TS),
 * parses stderr, prints a single JSON error payload (or nothing on pass).
 *
 * Usage:
 *  node rebank-js-ts.mjs src/foo.js --mode=js
 *  node rebank-js-ts.mjs -p tsconfig.json --mode=ts
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const mode = (args.find(a => a.startsWith("--mode=")) || "").split("=")[1] || "js";
const files = args.filter(a => !a.startsWith("--"));

function print(payload) { process.stdout.write(JSON.stringify(payload) + "\n"); }

function parseNodeCheck(stderr) {
  // Example:
  // /path/file.js:1
  // ...source line...
  //         ^
  //
  // SyntaxError: Unexpected token ')'
  const mFileLine = stderr.match(/^(?<file>.+?):(?<line>\d+)\s*$/m);
  const mMsg = stderr.match(/SyntaxError:\s+(?<message>.+)$/m);
  if (!mFileLine || !mMsg) return null;
  return {
    file: mFileLine.groups.file,
    line: Number(mFileLine.groups.line),
    column: null, // caret can be derived, but not stable for tabs; omit
    message: mMsg.groups.message.trim(),
    code: "JS_SYNTAX",
    severity: "FATAL_SYNTAX"
  };
}

function parseTsc(stderr) {
  // Example: file.ts(10,5): error TS1005: ';' expected.
  const line = stderr.split("\n").find(l => /\): error TS\d+: /.test(l));
  if (!line) return null;
  const m = line.match(/^(?<file>.+)\((?<line>\d+),(?<column>\d+)\): error (?<code>TS\d+): (?<message>.+)$/);
  if (!m || !m.groups) return null;
  return {
    file: m.groups.file,
    line: Number(m.groups.line),
    column: Number(m.groups.column),
    message: m.groups.message.trim(),
    code: m.groups.code,
    severity: "FATAL_SYNTAX"
  };
}

function run(cmd, cmdArgs, parser) {
  return new Promise((resolve) => {
    const cp = spawn(cmd, cmdArgs, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    cp.stdout.on("data", d => (out += d));
    cp.stderr.on("data", d => (err += d));
    cp.on("close", (code) => {
      if (code === 0) return resolve(null);
      const parsed = parser(err || out);
      resolve(parsed || { message: (err || out || "Unknown error").trim(), code: "UNKNOWN", severity: "FATAL_SYNTAX" });
    });
  });
}

(async () => {
  if (mode === "js") {
    // node --check file.js
    const result = await run("node", ["--check", ...files], parseNodeCheck);
    if (result) print(result);
    process.exit(0);
  } else {
    // tsc --noEmit [--allowJs --checkJs] …
    const tscArgs = ["--noEmit", ...files];
    if (files.includes("--js")) tscArgs.push("--allowJs", "--checkJs");
    const result = await run("tsc", tscArgs, parseTsc);
    if (result) print(result);
    process.exit(0);
  }
})();
```

Why this way?

* `node --check` guarantees parse-only for JS (no execution). ([Node.js][1])
* `tsc --noEmit` is the fastest TS correctness gate (add `--allowJs --checkJs` to type-check JS when you want that stronger signal). ([typescriptlang.org][2])

## 2) Python re-banker

**File:** `ops/rebank/rebank-py.py`
**Run:** `python ops/rebank/rebank-py.py <file.py>`

```python
#!/usr/bin/env python3
"""
ReBanker for Python: uses native bytecode compilation (py_compile) to check syntax.
Emits single-line JSON payload on failure; nothing on success.
"""
import json, re, subprocess, sys

def parse_py_compile(stderr: str):
    # Two common shapes:
    # A) "Sorry: IndentationError: ... (file.py, line 3)"
    m = re.search(r"^Sorry:\s+(?P<etype>\w+Error):\s+(?P<message>.+)\s+\((?P<file>.+), line (?P<line>\d+)\)", stderr, re.M)
    if m:
        return {
            "file": m.group("file"),
            "line": int(m.group("line")),
            "column": None,
            "message": f"{m.group('etype')}: {m.group('message')}",
            "code": "PY_SYNTAX",
            "severity": "FATAL_SYNTAX"
        }
    # B) Traceback form ending with:
    #    File "file.py", line N
    #    SyntaxError: message
    mFile = None
    for match in re.finditer(r'File "(?P<file>.+?)", line (?P<line>\d+)', stderr):
        mFile = match  # take the last one
    mMsg = re.search(r'(?P<etype>\w+Error):\s+(?P<message>.+)$', stderr, re.M)
    if mFile and mMsg:
        return {
            "file": mFile.group("file"),
            "line": int(mFile.group("line")),
            "column": None,
            "message": f"{mMsg.group('etype')}: {mMsg.group('message')}",
            "code": "PY_SYNTAX",
            "severity": "FATAL_SYNTAX"
        }
    return None

def main():
    files = [a for a in sys.argv[1:] if not a.startswith("-")]
    if not files:
        sys.exit(0)
    proc = subprocess.run([sys.executable, "-m", "py_compile", *files], capture_output=True, text=True)
    if proc.returncode == 0:
        return
    payload = parse_py_compile(proc.stderr or proc.stdout) or {
        "file": files[0], "line": None, "column": None,
        "message": (proc.stderr or proc.stdout or "Unknown compile error").strip(),
        "code": "PY_SYNTAX", "severity": "FATAL_SYNTAX"
    }
    print(json.dumps(payload))

if __name__ == "__main__":
    main()
```

`py_compile` is the official, zero-execution syntax check; non-zero exit means “could not compile”. ([Python documentation][3])

## 3) PHP re-banker

**File:** `ops/rebank/rebank-php.php`
**Run:** `php ops/rebank/rebank-php.php <file.php>`

```php
#!/usr/bin/env php
<?php
/**
 * ReBanker for PHP: shells out to "php -l", parses CLI output,
 * emits a single JSON payload on failure; nothing on success.
 */
if ($argc < 2) { exit(0); }
array_shift($argv);
$files = $argv;

function runLint(array $files): array {
    $cmd = array_merge(['php', '-l'], $files);
    $proc = proc_open($cmd, [1 => ['pipe','w'], 2 => ['pipe','w']], $pipes);
    $out = stream_get_contents($pipes[1]); fclose($pipes[1]);
    $err = stream_get_contents($pipes[2]); fclose($pipes[2]);
    $status = proc_close($proc);
    return [$status, $out . $err];
}

function parseLint($text) {
    // Example: "PHP Parse error: syntax error, ... in /path/file.php on line 12"
    if (preg_match('/^(?:PHP )?(?<type>Parse error|Fatal error):\s+(?<message>.+?)\s+in\s+(?<file>.+?)\s+on\s+line\s+(?<line>\d+)/m', $text, $m)) {
        return [
            'file' => $m['file'],
            'line' => intval($m['line']),
            'column' => null,
            'message' => trim($m['message']),
            'code' => 'PHP_PARSE',
            'severity' => 'FATAL_SYNTAX'
        ];
    }
    return null;
}

[$code, $text] = runLint($files);
if ($code === 0) { exit(0); }
$payload = parseLint($text) ?: ['file'=> $files[0], 'line'=> null, 'column'=> null, 'message'=> trim($text), 'code'=> 'PHP_PARSE', 'severity'=> 'FATAL_SYNTAX'];
echo json_encode($payload, JSON_UNESCAPED_SLASHES) . PHP_EOL;
```

Typical CLI parse error line shape (includes file and line) is what we match. ([code-basics.com][4])

---

# How this drops into your loop

* **Where it lives:** `ops/rebank/` (three files above).
* **How it’s called:** right after build/snapshot, before the LLM attempt.
* **What it returns:** a *single* JSON object to attach to your Envelope (no schema changes).
* **What to test:** one green (no output), one red per language (assert the 5 fields are present & reasonable).
* **Why this mix:** fastest native checks by default; TS path doubles as JS type checker when you want stronger signal.

# Alternatives (when useful)

1. **Unify JS+TS under tsc**: always run `tsc --noEmit --allowJs --checkJs` on mixed repos for one pass; slower but gives stronger guidance (codes like TS1005). ([typescriptlang.org][5])
2. **AST fallback**: if the environment lacks Node/PHP/Python, use parsers (`esprima`/`php-parser`/`ast.parse`) in an offline mode — slower, not preferred.
3. **Batch mode**: feed globs and parse first error only to keep payload tight; store full stderr in the envelope timeline if you want traceability.
4. **Severity routing**: always tag compiler syntax as `FATAL_SYNTAX` → short-circuit breaker to the “fix-syntax-then-retry” path.

If you want, I can wire these calls into the existing Python `envelope.py` helpers so `append_attempt()` auto-attaches the re-banked payloads. Just say “go wire-up”.

[1]: https://nodejs.org/api/cli.html "Command-line API | Node.js v24.9.0 Documentation"
[2]: https://www.typescriptlang.org/tsconfig/noEmit.html?utm_source=chatgpt.com "TSConfig Option: noEmit"
[3]: https://docs.python.org/3/library/py_compile.html?utm_source=chatgpt.com "py_compile — Compile Python source files"
[4]: https://code-basics.com/languages/php/lessons/syntax-errors?utm_source=chatgpt.com "PHP: Syntax errors - CodeBasics"
[5]: https://www.typescriptlang.org/tsconfig/checkJs.html?utm_source=chatgpt.com "TSConfig Option: checkJs"


Goal:
Efficiently locate the correct insertion point in a codebase and apply a change, without scanning or rebuilding the entire code.

Concept:
Inspired by pathfinding algorithms (like Dijkstra’s or A*), but focused on code structure. The algorithm traverses code elements (lines, blocks, AST nodes) to find the optimal spot for insertion.

Steps:

Parse the code structure
Tokenize or build an abstract syntax tree (AST) from the source code.
Define the insertion criteria
Specify what to look for (e.g., function name, class, comment marker).
Traverse the code
Walk through the code elements, checking each against the criteria.
Select the best match
When a match is found, record its position.
Insert the patch
Apply the change at the identified location.
Pseudocode:


function search_and_insert(code, criteria, patch):    ast = parse_code_to_ast(code)    for node in ast:        if matches_criteria(node, criteria):            insert_patch_at(node, patch)            return updated_code    raise Exception("No suitable insertion point found")
Example Use Case:

Insert a logging statement after every function definition.
Add a new method to a specific class.
Patch a configuration value in a settings file.
Benefits:

Fast: Only scans relevant parts of the code.
Precise: Avoids unnecessary changes elsewhere.
Scalable: Works for large codebases and complex logic.


Hey Shaun — love this direction. Let’s level it up from “scan & regex” to a real, deterministic locator that’s envelope-aware and fast on big trees.

Here’s 4 solid paths (ranked), plus a lean TS implementation you can drop in today.

# Options (speed ↔ precision)

1. Best-First (A*-lite) over the AST  ✅

   * Build an AST, treat each node as a graph vertex, score nodes against your criteria, and expand highest-score first until a goal is found.
   * Heuristic (h): symbol/name match, node kind match (FunctionDecl, Method, Class, Comment), context similarity (n-gram overlap to patch prelude), language constraints (e.g., “don’t insert before `<?php`”).
   * Cost (g): distance from ideal scope (wrong file, wrong class, wrong region) + structural “risk” (near plugin headers, vendor dirs, generated files).
   * Why: insanely fast in practice because you don’t expand the whole tree; it converges on the right region quickly.

2. Two-stage: Coarse retrieval → Fine AST search

   * Stage 1: file-level ranking (symbols/BM25 on chunks).
   * Stage 2: run best-first search inside top-k files.
   * Why: scales to very large repos without touching thousands of ASTs.

3. Anchor + Fuzzy Cursor (robust to drift)

   * Accept stable anchors (comment tags, docblocks, guard lines), do a fuzzy window match, then a tiny AST search in that window.
   * Why: works great when you can plant markers or when teams already use tags like `// INSERT:analytics`.

4. Declarative “Intent Spec” + Rule Engine

   * A small DSL: `inside class Foo -> after method bar() -> before first return`.
   * Compile to a search plan (sequence of node filters) and run with #1.
   * Why: human-readable, reviewable diffs for the locator itself.

# Envelope hook points (no new schema, just use what you have)

* `timeline += { ts, event: "locator.search", data: { criteria, candidates, topScore, chosen: {file, kind, range} } }`
* `counters.locator_attempts++`
* `resourceUsage.locator = { astBuildMs, nodesVisited, filesScanned }`
* If compiler/re-banker fires: `metadata.lastSyntax = { lang, line, column, code, message }`
* Hash excludes stay intact; only stable fields affect `envelopeHash` after we set `envelope.timestamp`.

# Minimal, production-ready TypeScript (drop-in)

**Where it goes**

* `utils/typescript/locator.ts` (new)
* `utils/typescript/index.ts` export it
* Jest tests: `utils/typescript/__tests__/locator.test.ts`

**Dependencies**

* `typescript` (AST) — already in most TS repos
* No other deps

```ts
// utils/typescript/locator.ts
/**
 * Best-first (A*-lite) AST locator + inserter for JS/TS.
 * - Language-aware, envelope-friendly telemetry
 * - Pluggable scoring so we can add PHP/Python later with adapters
 */
import ts from "typescript";

export type Language = "ts" | "js";
export type InsertMode = "insertAfter" | "insertBefore" | "replace";

export interface Criteria {
  language: Language;
  target: {
    kind: "function" | "method" | "class" | "comment" | "config";
    name?: string;           // e.g., function/class/method name
    anchorText?: string;     // fallback fuzzy anchor in comments/text
    inClass?: string;        // for methods
    after?: "signature" | "openBrace" | "closeBrace";
  };
  constraints?: {
    forbidBeforePhpOpen?: boolean; // reserved for PHP adapter
    fileHint?: string;             // coarse file narrowing if known
  };
}

export interface Patch {
  mode: InsertMode;
  text: string;
}

export interface LocateResult {
  updatedCode: string;
  insertOffset: number;
  chosen: { kind: string; name?: string; file?: string; start: number; end: number };
  telemetry: {
    astBuildMs: number;
    nodesVisited: number;
    candidates: Array<{ kind: string; name?: string; start: number; score: number }>;
    topScore: number;
  };
}

type Scored = { node: ts.Node; score: number; name?: string };

function getNodeName(node: ts.Node): string | undefined {
  // Try to extract a symbol-like name for common nodes
  if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isMethodDeclaration(node)) {
    const id = (node as any).name;
    return id && ts.isIdentifier(id) ? id.text : undefined;
  }
  return undefined;
}

function nodeKindStr(node: ts.Node): string {
  return ts.SyntaxKind[node.kind];
}

// Simple priority queue via sorted array (fast enough for our use)
class PQ<T extends { score: number }> {
  private a: T[] = [];
  push(x: T) { this.a.push(x); }
  pop(): T | undefined {
    this.a.sort((x, y) => y.score - x.score); // highest first
    return this.a.shift();
  }
  get length() { return this.a.length; }
}

// Heuristic scorer: higher is better
function scoreNode(node: ts.Node, c: Criteria, source: string): number {
  let s = 0;

  const kind = nodeKindStr(node);
  const name = getNodeName(node);

  // Kind match
  if (c.target.kind === "function" && ts.isFunctionDeclaration(node)) s += 5;
  if (c.target.kind === "class" && ts.isClassDeclaration(node)) s += 5;
  if (c.target.kind === "method" && ts.isMethodDeclaration(node)) s += 5;
  if (c.target.kind === "comment" && (ts.isSourceFile(node) || ts.isBlock(node))) s += 1;

  // Name match
  if (c.target.name && name === c.target.name) s += 10;

  // In-class match for methods
  if (c.target.kind === "method" && c.target.inClass && ts.isMethodDeclaration(node)) {
    const parent = node.parent;
    if (ts.isClassDeclaration(parent)) {
      const parentName = parent.name?.text;
      if (parentName === c.target.inClass) s += 6;
    }
  }

  // AnchorText proximity
  if (c.target.anchorText) {
    const span = source.slice(node.getStart(), node.getEnd());
    if (span.includes(c.target.anchorText)) s += 4;
  }

  // Penalize risky regions (very naive starter; expand later)
  if (kind.includes("SourceFile")) s -= 1; // push away from root
  return s;
}

function findInsertOffset(node: ts.Node, c: Criteria, source: string): number {
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isClassDeclaration(node)) {
    const body = (node as any).body;
    if (!body) {
      // No body (e.g., d.ts). Insert after the node.
      return node.getEnd();
    }
    if (c.target.after === "signature") return node.getEnd();
    if (c.target.after === "openBrace") return body.getStart() + 1; // after '{'
    if (c.target.after === "closeBrace") return body.getEnd() - 1;  // before '}'
    // Default: start of body
    return body.getStart() + 1;
  }

  // Comment or config: naive fallback at node end
  return node.getEnd();
}

/**
 * searchAndInsert — best-first walk over AST until a high-scoring node is found.
 */
export function searchAndInsert(code: string, criteria: Criteria, patch: Patch): LocateResult {
  const t0 = performance.now();
  const sf = ts.createSourceFile(
    "file.tsx",
    code,
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ true,
    criteria.language === "ts" ? ts.ScriptKind.TSX : ts.ScriptKind.JSX
  );

  const pq = new PQ<Scored>();
  let nodesVisited = 0;
  const candidates: LocateResult["telemetry"]["candidates"] = [];

  // Seed queue with top-level nodes
  sf.forEachChild((child) => {
    pq.push({ node: child, score: scoreNode(child, criteria, code), name: getNodeName(child) });
  });

  // Always keep source file as a candidate (for comment anchors or config)
  pq.push({ node: sf, score: scoreNode(sf, criteria, code), name: "SourceFile" });

  let best: Scored | undefined;

  while (pq.length) {
    const cur = pq.pop()!;
    nodesVisited++;

    const curKind = nodeKindStr(cur.node);
    candidates.push({ kind: curKind, name: cur.name, start: cur.node.getStart(), score: cur.score });

    // Accept if score clears a threshold (tunable)
    if (cur.score >= 10 || (criteria.target.anchorText && cur.score >= 6)) {
      best = cur;
      break;
    }

    // Expand children
    cur.node.forEachChild((child) => {
      pq.push({ node: child, score: scoreNode(child, criteria, code), name: getNodeName(child) });
    });
  }

  // Fallback: choose the highest scored candidate if no threshold met
  if (!best && candidates.length) {
    best = candidates
      .map((c) => ({ node: findNodeAt(sf, c.start)!, score: c.score, name: c.name }))
      .sort((a, b) => b.score - a.score)[0];
  }

  if (!best) throw new Error("No suitable insertion point found");

  const offset = findInsertOffset(best.node, criteria, code);
  const updatedCode = applyPatch(code, offset, patch);

  const t1 = performance.now();
  return {
    updatedCode,
    insertOffset: offset,
    chosen: {
      kind: nodeKindStr(best.node),
      name: getNodeName(best.node),
      start: best.node.getStart(),
      end: best.node.getEnd(),
    },
    telemetry: {
      astBuildMs: Math.round(t1 - t0),
      nodesVisited,
      candidates,
      topScore: best.score,
    },
  };
}

function applyPatch(source: string, offset: number, patch: Patch): string {
  if (patch.mode === "insertAfter" || patch.mode === "insertBefore") {
    const before = source.slice(0, offset);
    const after = source.slice(offset);
    // ensure newline boundaries are clean
    const glue = source[offset - 1] === "\n" ? "" : "\n";
    return before + glue + patch.text + "\n" + after;
  }
  if (patch.mode === "replace") {
    // In real use, you'd pass a range. For now, replace at offset with text.
    return source.slice(0, offset) + patch.text + source.slice(offset);
  }
  return source;
}

function findNodeAt(root: ts.Node, start: number): ts.Node | undefined {
  let hit: ts.Node | undefined;
  const visit = (n: ts.Node) => {
    if (n.getStart() === start) hit = n;
    n.forEachChild(visit);
  };
  visit(root);
  return hit;
}
```

**Example use (JS/TS):**

```ts
import { searchAndInsert } from "./locator";

const criteria = {
  language: "ts",
  target: { kind: "method", name: "logRequest", inClass: "ApiClient", after: "openBrace" }
} as const;

const patch = {
  mode: "insertAfter",
  text: `console.log("[ApiClient] request", url, opts);`
} as const;

const result = searchAndInsert(sourceCode, criteria, patch);

// Attach to envelope (pseudo—use your real helpers)
append_attempt(envelope, { ts: Math.floor(Date.now()/1000), success: true });
add_timeline_entry(envelope, {
  ts: Date.now(),
  event: "locator.apply",
  data: { criteria, chosen: result.chosen, nodesVisited: result.telemetry.nodesVisited }
});
merge_resource_usage(envelope, { locatorMs: result.telemetry.astBuildMs });
set_envelope_timestamp(envelope, Date.now());
set_envelope_hash(envelope, compute_stable_envelope_hash(envelope));
```

**Jest test sketch**

```ts
// utils/typescript/__tests__/locator.test.ts
import { searchAndInsert } from "../locator";

test("inserts inside class method body", () => {
  const code = `
class ApiClient {
  logRequest(url:string, opts:any) {
    // TODO
  }
}
`;
  const res = searchAndInsert(
    code,
    { language: "ts", target: { kind: "method", name: "logRequest", inClass: "ApiClient", after: "openBrace" } },
    { mode: "insertAfter", text: `console.log("x");` }
  );
  expect(res.updatedCode).toMatch(/logRequest[\s\S]*\{\s*\n\s*console\.log\("x"\);/);
});
```

# How this maps to your real problems

* **“Don’t clobber WP plugin headers / `<?php`”**
  Add a PHP adapter that:

  * Finds the first `T_OPEN_TAG` and forbids offsets before it (constraint),
  * Treats plugin header block as a “high risk” zone (heavy negative score),
  * Uses nikic/php-parser (AST) to reuse the same best-first loop.

* **“Prefer patching in the middle vs rewriting whole blocks”**
  The `after: "openBrace" | "closeBrace" | "signature"` handles intra-block placement. Add more micro-anchors like “before first return”.

* **“Large codebases (VS Code star-star search takes minutes)”**
  Use Option #2: first rank files (ripgrep symbols + TF-IDF on chunks), only parse the top-k. It keeps you under the budget even on monorepos.

* **“Traceability”**
  Every run adds a `timeline` entry with `{ criteria, nodesVisited, candidates[], chosen, astBuildMs }` and increments counters. Hash excludes ensure stable hashing.

* **“Re-banker interplay”**
  Run re-banker after each patch; if syntax breaks, add a `timeline` entry `locator.rollback` and revert the change in memory, then pick the next candidate. That’s a neat closed-loop with your envelope + breaker.

# Quick contrasts (why this approach)

* **A* vs naive scan**: A* visits ~O(relevant) nodes; scans visit O(all). On big files/classes, that’s the difference between ms and seconds.
* **AST vs regex**: AST gives scope/safety (inside class X, after method Y) and language rules (no edits before `<?php`), regex can’t.
* **Best-first vs Dijkstra**: We don’t need exact shortest path; we need “best match now” — best-first wins on latency.
* **Markers vs heuristics**: Markers are great when you own the code; heuristics keep working on third-party code.

# What to test

* Method inside class (exact name)
* Function by name in a flat module
* Comment anchor fallback when names drift
* “Don’t insert before `<?php`” (PHP adapter)
* Threshold behavior: ensure it doesn’t choose a low-score wrong spot
* End-to-end with envelope: timeline + counters + stable hash unchanged when only volatile fields differ

If you want, I’ll add the **PHP adapter** next (nikic/php-parser), and a tiny **coarse retriever** (ripgrep + tf-idf) so Option #2 is wired in.

Want me to wire this into your envelope flow now or add the PHP pass first?
