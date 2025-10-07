/**
 * ReBanker taxonomy-driven classifier (TypeScript).
 *
 * Mirrors the Python implementation so both runtimes share identical
 * classification semantics and packet structure.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";
import crypto from "crypto";

const TAXONOMY_PATH = resolve(__dirname, "..", "rules", "rebanker_taxonomy.yml");

export interface TaxonomySpec {
  defaults?: {
    severity?: { label?: string; score?: number };
    difficulty?: number;
    confidence?: number;
  };
  families: Array<{
    id: string;
    categories: Array<TaxonomyCategory>;
  }>;
}

export interface TaxonomyCategory {
  id: string;
  code: string;
  description?: string;
  severity?: { label?: string; score?: number };
  difficulty?: number;
  hint?: string;
  detectors: Array<{
    langs?: string[];
    regex: string[];
    capture?: string[];
  }>;
  cluster_key?: string;
  confidence?: number;
}

interface Detector {
  code: string;
  severityLabel: string;
  severityScore: number;
  difficulty: number;
  hint: string;
  patterns: RegExp[];
  langs: string[];
  captures: string[];
  clusterKey?: string;
  confidence: number;
}

export interface ClassifiedError {
  id: string;
  file: string;
  line: number;
  column: number;
  message: string;
  code: string;
  severity: { label: string; score: number };
  difficulty: number;
  cluster_id: string;
  hint: string;
  confidence: number;
}

export interface ClassificationResult {
  errors: ClassifiedError[];
  summary: {
    count: number;
    by_severity: Record<string, number>;
    by_code: Record<string, number>;
    by_cluster: Record<string, number>;
  };
}

let cachedSpec: TaxonomySpec | null = null;

export function loadTaxonomy(path: string = TAXONOMY_PATH): TaxonomySpec {
  if (!cachedSpec) {
    const raw = readFileSync(path, "utf-8");
    cachedSpec = yaml.load(raw) as TaxonomySpec;
  }
  return cachedSpec;
}

export function classifyLines(
  logLines: Iterable<string>,
  lang: string,
  taxonomy?: TaxonomySpec
): ClassificationResult {
  const spec = taxonomy ?? loadTaxonomy();
  const detectors = compileDetectors(spec);
  const errors: ClassifiedError[] = [];
  const langLower = lang.toLowerCase();

  for (const raw of logLines) {
    const line = raw.trim();
    if (!line) continue;

    const match = matchLine(line, langLower, detectors);
    if (!match) continue;

    const [detector, captures] = match;
    const errorId = makeErrorId(line, detector.code, captures);
    const { file, lineNo, colNo } = extractLocation(captures, line);

    errors.push({
      id: errorId,
      file,
      line: lineNo,
      column: colNo,
      message: line,
      code: detector.code,
      severity: { label: detector.severityLabel, score: round(detector.severityScore) },
      difficulty: round(detector.difficulty),
      cluster_id: clusterId(detector, captures),
      hint: detector.hint,
      confidence: round(detector.confidence),
    });
  }

  return {
    errors,
    summary: {
      count: errors.length,
      by_severity: bucket(errors, (e) => e.severity.label),
      by_code: bucket(errors, (e) => e.code),
      by_cluster: bucket(errors, (e) => e.cluster_id ?? e.code),
    },
  };
}

function compileDetectors(spec: TaxonomySpec): Detector[] {
  const defaults = spec.defaults ?? {};
  const detectors: Detector[] = [];

  for (const family of spec.families ?? []) {
    for (const category of family.categories ?? []) {
      for (const det of category.detectors ?? []) {
        const regexes = (det.regex ?? []).map((expr) => new RegExp(expr, "i"));
        if (!regexes.length) continue;

        const severity = category.severity ?? {};
        detectors.push({
          code: category.code,
          severityLabel: severity.label ?? defaults.severity?.label ?? "ERROR",
          severityScore: severity.score ?? defaults.severity?.score ?? 0.6,
          difficulty: category.difficulty ?? defaults.difficulty ?? 0.5,
          hint: category.hint ?? "",
          patterns: regexes,
          langs: det.langs ?? [],
          captures: det.capture ?? [],
          clusterKey: category.cluster_key,
          confidence: category.confidence ?? defaults.confidence ?? 0.5,
        });
      }
    }
  }

  return detectors;
}

function matchLine(
  line: string,
  lang: string,
  detectors: Detector[]
): [Detector, Record<string, string>] | undefined {
  for (const detector of detectors) {
    if (detector.langs.length && !detector.langs.includes(lang)) continue;
    for (const pattern of detector.patterns) {
      const match = pattern.exec(line);
      if (match) {
        const captures: Record<string, string> = {};
        detector.captures.forEach((name, idx) => {
          const value = match[idx + 1];
          if (value !== undefined) captures[name] = value;
        });
        return [detector, captures];
      }
    }
  }
  return undefined;
}

function makeErrorId(line: string, code: string, captures: Record<string, string>): string {
  const payload = JSON.stringify({ line, code, captures });
  return `e:${crypto.createHash("sha1").update(payload).digest("hex").slice(0, 12)}`;
}

function extractLocation(captures: Record<string, string>, line: string) {
  const file = captures.file ?? guessFileFromText(line);
  const lineNo = captures.line ? Number(captures.line) : 0;
  const colNo = captures.col ? Number(captures.col) : captures.column ? Number(captures.column) : 0;
  return { file, lineNo, colNo };
}

function clusterId(detector: Detector, captures: Record<string, string>): string {
  if (detector.clusterKey && captures[detector.clusterKey]) {
    return `${detector.code}:${captures[detector.clusterKey]}`;
  }
  return detector.code;
}

function bucket<T>(items: T[], keyFn: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = keyFn(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function guessFileFromText(text: string): string {
  const match = text.match(/([\w./\\-]+\.(?:py|ts|js|php|json|sql))/);
  return match ? match[1] : "unknown";
}

function round(value: number, precision = 2): number {
  return Number(value.toFixed(precision));
}

export default {
  loadTaxonomy,
  classifyLines,
};
