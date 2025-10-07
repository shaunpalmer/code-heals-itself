/**
 * JavaScript taxonomy loader/classifier for ReBanker.
 * Mirrors the TypeScript helper so Node CLI utilities can consume
 * the shared YAML without a build step.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import crypto from 'crypto';
import yaml from 'js-yaml';

const TAXONOMY_PATH = resolve(process.cwd(), 'rules', 'rebanker_taxonomy.yml');

let cachedSpec = null;

export function loadTaxonomy(path = TAXONOMY_PATH) {
  if (!cachedSpec) {
    const raw = readFileSync(path, 'utf-8');
    cachedSpec = yaml.load(raw);
  }
  return cachedSpec;
}

export function classifyLines(logLines, lang, taxonomy) {
  const spec = taxonomy ?? loadTaxonomy();
  const detectors = compileDetectors(spec);
  const errors = [];
  const langLower = (lang || '').toLowerCase();

  for (const raw of logLines) {
    const line = (raw || '').trim();
    if (!line) continue;

    const match = matchLine(line, langLower, detectors);
    if (!match) continue;

    const [detector, captures] = match;
    const { file, lineNo, colNo } = extractLocation(captures, line);

    errors.push({
      id: makeErrorId(line, detector.code, captures),
      file,
      line: lineNo,
      column: colNo,
      message: line,
      code: detector.code,
      severity: {
        label: detector.severityLabel,
        score: round(detector.severityScore),
      },
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

function compileDetectors(spec) {
  const defaults = spec.defaults || {};
  const detectors = [];

  for (const family of spec.families || []) {
    for (const category of family.categories || []) {
      for (const det of category.detectors || []) {
        const regexes = (det.regex || []).map((expr) => new RegExp(expr, 'i'));
        if (!regexes.length) continue;

        const severity = category.severity || {};
        detectors.push({
          code: category.code,
          severityLabel: severity.label ?? defaults.severity?.label ?? 'ERROR',
          severityScore: severity.score ?? defaults.severity?.score ?? 0.6,
          difficulty: category.difficulty ?? defaults.difficulty ?? 0.5,
          hint: category.hint ?? '',
          patterns: regexes,
          langs: det.langs || [],
          captures: det.capture || [],
          clusterKey: category.cluster_key,
          confidence: category.confidence ?? defaults.confidence ?? 0.5,
        });
      }
    }
  }

  return detectors;
}

function matchLine(line, lang, detectors) {
  for (const detector of detectors) {
    if (detector.langs.length && !detector.langs.includes(lang)) continue;
    for (const pattern of detector.patterns) {
      const match = pattern.exec(line);
      if (match) {
        const captures = {};
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

function makeErrorId(line, code, captures) {
  const payload = JSON.stringify({ line, code, captures });
  return `e:${crypto.createHash('sha1').update(payload).digest('hex').slice(0, 12)}`;
}

function extractLocation(captures, line) {
  const file = captures.file ?? guessFileFromText(line);
  const lineNo = captures.line ? Number(captures.line) : 0;
  const colNo = captures.col
    ? Number(captures.col)
    : captures.column
      ? Number(captures.column)
      : 0;
  return { file, lineNo, colNo };
}

function clusterId(detector, captures) {
  if (detector.clusterKey && captures[detector.clusterKey]) {
    return `${detector.code}:${captures[detector.clusterKey]}`;
  }
  return detector.code;
}

function bucket(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function guessFileFromText(text) {
  const match = text.match(/([\w./\\-]+\.(?:py|ts|js|php|json|sql))/);
  return match ? match[1] : 'unknown';
}

function round(value, precision = 2) {
  if (typeof value !== 'number') return Number(value);
  return Number(value.toFixed(precision));
}

export default {
  loadTaxonomy,
  classifyLines,
};
