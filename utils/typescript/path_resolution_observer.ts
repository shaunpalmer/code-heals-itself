import * as fs from 'fs';
import * as path from 'path';

type MissingPath = {
  source: string; // the import string as written
  resolved?: string; // resolved absolute path when found
  reason: string; // e.g. 'not_found' | 'unresolved_alias' | 'unsupported'
};

/**
 * Simple PathResolutionObserver compatible with the project's observer conventions.
 * - Scans source for import/require/fs.readFileSync strings
 * - Attempts to resolve relative paths against a provided projectRoot
 * - Returns a list of missing paths (best-effort)
 */
class PathResolutionObserver {
  constructor(private projectRoot: string = process.cwd(), private extraResolvers: Array<(p: string) => string | null> = []) { }
  // // tries to detect missing paths
  // strings and verifying that
  evaluate(sourceCode: string, sourceFilePath?: string): MissingPath[] {
    const missing: MissingPath[] = [];
    if (!sourceCode) return missing;

    // Basic regexes for import/require and fs.readFileSync path literals
    const importRegex = /import\s+(?:[\s\S]+?)from\s+['"]([^'"\n]+)['"]/g;
    const dynamicImportRegex = /import\(\s*['"]([^'"\n]+)['"]\s*\)/g;
    const requireRegex = /require\(\s*['"]([^'"\n]+)['"]\s*\)/g;
    const fsReadRegex = /readFileSync\(\s*['"]([^'"\n]+)['"]\s*,/g;

    const candidates: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = importRegex.exec(sourceCode))) candidates.push(m[1]);
    while ((m = dynamicImportRegex.exec(sourceCode))) candidates.push(m[1]);
    while ((m = requireRegex.exec(sourceCode))) candidates.push(m[1]);
    while ((m = fsReadRegex.exec(sourceCode))) candidates.push(m[1]);

    for (const spec of candidates) {
      // Ignore bare module specifiers (node_modules) and URL imports
      if (!spec) continue;
      if (spec.startsWith('.') || spec.startsWith('..') || spec.startsWith('/') || spec.match(/^\\w+:\/\//)) {
        // Attempt resolution
        const baseDir = sourceFilePath ? path.dirname(sourceFilePath) : this.projectRoot;
        let resolved: string | null = null;
        try {
          // Try naive resolution: exact path, with .js/.ts/.json additions, and index files
          const trial = path.resolve(baseDir, spec);
          const trials = [trial, trial + '.ts', trial + '.js', path.join(trial, 'index.ts'), path.join(trial, 'index.js'), trial + '.json'];
          for (const t of trials) {
            if (fs.existsSync(t)) { resolved = t; break; }
          }
          // Run extra resolvers if provided
          if (!resolved) {
            for (const r of this.extraResolvers) {
              const rr = r(spec);
              if (rr && fs.existsSync(rr)) { resolved = rr; break; }
            }
          }
        } catch {
          // ignore fs errors
        }

        if (!resolved) {
          missing.push({ source: spec, reason: 'not_found' });
        } else {
          // If resolved but located outside project root, mark as unresolved_alias
          const rel = path.relative(this.projectRoot, resolved);
          if (rel.startsWith('..')) {
            missing.push({ source: spec, resolved, reason: 'resolved_outside_project' });
          }
        }
      }
    }

    return missing;
  }
}

export { PathResolutionObserver };
