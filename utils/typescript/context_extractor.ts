// Extract wider code context (e.g., containing function) and simple syntax balance checks

export interface FunctionContext {
  functionName?: string;
  functionCode?: string;
  surrounding?: string;
}

export interface BalanceReport {
  paren: { open: number; close: number; missingClose: number };
  brace: { open: number; close: number; missingClose: number };
  bracket: { open: number; close: number; missingClose: number };
  semicolonHeuristicMissing: number; // simple count of lines likely missing semicolons
}

export function extractFunctionContext(originalCode: string, patchCode: string): FunctionContext {
  const name = inferFunctionNameFromCode(patchCode);
  if (name) {
    const block = findFunctionBlockByName(originalCode, name);
    if (block) return block;
  }
  // Fallback: first function-like block in original
  const first = findFirstFunctionBlock(originalCode);
  if (first) return first;
  // Final fallback: provide a trimmed slice of the original
  const snippet = originalCode.split('\n').slice(0, 100).join('\n');
  return { functionName: undefined, functionCode: snippet, surrounding: undefined };
}

export function basicBalanceScan(code: string): BalanceReport {
  const counts = (chars: string) => (code.match(new RegExp(chars, 'g')) || []).length;
  const parenOpen = counts("\\(");
  const parenClose = counts("\\)");
  const braceOpen = counts("\\{");
  const braceClose = counts("\\}");
  const bracketOpen = counts("\\[");
  const bracketClose = counts("\\]");
  const missingSemi = code
    .split('\n')
    .filter(l => /\b(let|const|return|throw|yield)\b/.test(l.trim()) && !/[;{}]$/.test(l.trim()))
    .length;
  return {
    paren: { open: parenOpen, close: parenClose, missingClose: Math.max(0, parenOpen - parenClose) },
    brace: { open: braceOpen, close: braceClose, missingClose: Math.max(0, braceOpen - braceClose) },
    bracket: { open: bracketOpen, close: bracketClose, missingClose: Math.max(0, bracketOpen - bracketClose) },
    semicolonHeuristicMissing: missingSemi
  };
}

function inferFunctionNameFromCode(code: string): string | undefined {
  // function foo(
  let m = code.match(/function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/);
  if (m) return m[1];
  // export function foo(
  m = code.match(/export\s+function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/);
  if (m) return m[1];
  // const foo = (...) => {
  m = code.match(/const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/);
  if (m) return m[1];
  // class X { foo(...) { ... }
  m = code.match(/\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\([^)]*\)\s*\{/);
  if (m) return m[1];
  return undefined;
}

function findFunctionBlockByName(source: string, name: string): FunctionContext | undefined {
  const patterns = [
    new RegExp(`function\\s+${name}\\s*\\(`),
    new RegExp(`export\\s+function\\s+${name}\\s*\\(`),
    new RegExp(`const\\s+${name}\\s*=\\s*(?:async\\s*)?\\([^)]*\\)\\s*=>\\s*\\{`),
    new RegExp(`\n\s*${name}\\s*\\([^)]*\\)\\s*\\{`)
  ];
  for (const rx of patterns) {
    const idx = source.search(rx);
    if (idx >= 0) {
      const startBrace = source.indexOf('{', idx);
      if (startBrace < 0) continue;
      const end = findMatchingBrace(source, startBrace);
      if (end > startBrace) {
        const functionCode = source.slice(idx, end + 1);
        const surrounding = sliceSurrounding(source, idx, end + 1, 8);
        return { functionName: name, functionCode, surrounding };
      }
    }
  }
  return undefined;
}

function findFirstFunctionBlock(source: string): FunctionContext | undefined {
  const rx = /(export\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(|const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{|\n\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\([^)]*\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(source))) {
    const idx = m.index;
    const startBrace = source.indexOf('{', idx);
    if (startBrace < 0) continue;
    const end = findMatchingBrace(source, startBrace);
    if (end > startBrace) {
      const functionName = (m[2] || m[3] || m[4]) as string | undefined;
      const functionCode = source.slice(idx, end + 1);
      const surrounding = sliceSurrounding(source, idx, end + 1, 8);
      return { functionName, functionCode, surrounding };
    }
  }
  return undefined;
}

function findMatchingBrace(source: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function sliceSurrounding(source: string, start: number, end: number, lines: number): string {
  const pre = source.slice(0, start).split('\n');
  const post = source.slice(end).split('\n');
  const preSlice = pre.slice(Math.max(0, pre.length - lines)).join('\n');
  const postSlice = post.slice(0, Math.max(0, lines)).join('\n');
  return `${preSlice}\n${source.slice(start, end)}\n${postSlice}`;
}
