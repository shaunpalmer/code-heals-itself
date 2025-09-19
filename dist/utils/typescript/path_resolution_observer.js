"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PathResolutionObserver = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Simple PathResolutionObserver compatible with the project's observer conventions.
 * - Scans source for import/require/fs.readFileSync strings
 * - Attempts to resolve relative paths against a provided projectRoot
 * - Returns a list of missing paths (best-effort)
 */
class PathResolutionObserver {
    constructor(projectRoot = process.cwd(), extraResolvers = []) {
        this.projectRoot = projectRoot;
        this.extraResolvers = extraResolvers;
    }
    // // tries to detect missing paths
    // strings and verifying that
    evaluate(sourceCode, sourceFilePath) {
        const missing = [];
        if (!sourceCode)
            return missing;
        // Basic regexes for import/require and fs.readFileSync path literals
        const importRegex = /import\s+(?:[\s\S]+?)from\s+['"]([^'"\n]+)['"]/g;
        const dynamicImportRegex = /import\(\s*['"]([^'"\n]+)['"]\s*\)/g;
        const requireRegex = /require\(\s*['"]([^'"\n]+)['"]\s*\)/g;
        const fsReadRegex = /readFileSync\(\s*['"]([^'"\n]+)['"]\s*,/g;
        const candidates = [];
        let m;
        while ((m = importRegex.exec(sourceCode)))
            candidates.push(m[1]);
        while ((m = dynamicImportRegex.exec(sourceCode)))
            candidates.push(m[1]);
        while ((m = requireRegex.exec(sourceCode)))
            candidates.push(m[1]);
        while ((m = fsReadRegex.exec(sourceCode)))
            candidates.push(m[1]);
        for (const spec of candidates) {
            // Ignore bare module specifiers (node_modules) and URL imports
            if (!spec)
                continue;
            if (spec.startsWith('.') || spec.startsWith('..') || spec.startsWith('/') || spec.match(/^\\w+:\/\//)) {
                // Attempt resolution
                const baseDir = sourceFilePath ? path.dirname(sourceFilePath) : this.projectRoot;
                let resolved = null;
                try {
                    // Try naive resolution: exact path, with .js/.ts/.json additions, and index files
                    const trial = path.resolve(baseDir, spec);
                    const trials = [trial, trial + '.ts', trial + '.js', path.join(trial, 'index.ts'), path.join(trial, 'index.js'), trial + '.json'];
                    for (const t of trials) {
                        if (fs.existsSync(t)) {
                            resolved = t;
                            break;
                        }
                    }
                    // Run extra resolvers if provided
                    if (!resolved) {
                        for (const r of this.extraResolvers) {
                            const rr = r(spec);
                            if (rr && fs.existsSync(rr)) {
                                resolved = rr;
                                break;
                            }
                        }
                    }
                }
                catch {
                    // ignore fs errors
                }
                if (!resolved) {
                    missing.push({ source: spec, reason: 'not_found' });
                }
                else {
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
exports.PathResolutionObserver = PathResolutionObserver;
