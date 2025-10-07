"""ReBanker taxonomy-driven classifier (Python).

Loads the shared YAML taxonomy and deterministically maps raw diagnostic lines
into structured error packets that comply with the truth-flow contract.
"""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Pattern, Tuple
import hashlib
import json
import re

import yaml


TAXONOMY_PATH = Path(__file__).resolve().parent.parent / "rules" / "rebanker_taxonomy.yml"


@dataclass(frozen=True)
class Detector:
    code: str
    severity_label: str
    severity_score: float
    difficulty: float
    hint: str
    patterns: Tuple[Pattern[str], ...]
    langs: Tuple[str, ...]
    captures: Tuple[str, ...]
    cluster_key: Optional[str]
    confidence: float


@lru_cache(maxsize=1)
def load_taxonomy(path: Optional[Path] = None) -> Dict[str, Any]:
    """Cache and return the parsed taxonomy YAML."""
    taxonomy_path = path or TAXONOMY_PATH
    with taxonomy_path.open("r", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def compile_detectors(spec: Dict[str, Any]) -> List[Detector]:
    """Compile regex detectors defined in the taxonomy."""
    defaults = spec.get("defaults", {})
    detectors: List[Detector] = []

    for family in spec.get("families", []):
        for category in family.get("categories", []):
            for det in category.get("detectors", []):
                regexes = tuple(re.compile(expr, re.IGNORECASE) for expr in det.get("regex", []))
                if not regexes:
                    continue

                severity = category.get("severity", {})
                detectors.append(
                    Detector(
                        code=category["code"],
                        severity_label=severity.get("label", defaults.get("severity", {}).get("label", "ERROR")),
                        severity_score=float(severity.get("score", defaults.get("severity", {}).get("score", 0.6))),
                        difficulty=float(category.get("difficulty", defaults.get("difficulty", 0.5))),
                        hint=category.get("hint", ""),
                        patterns=regexes,
                        langs=tuple(det.get("langs", [])),
                        captures=tuple(det.get("capture", [])),
                        cluster_key=category.get("cluster_key"),
                        confidence=float(category.get("confidence", defaults.get("confidence", 0.5))),
                    )
                )
    return detectors


def classify_lines(log_lines: Iterable[str], lang: str, taxonomy: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Classify diagnostic lines into structured error packets."""
    spec = taxonomy or load_taxonomy()
    detectors = compile_detectors(spec)

    errors: List[Dict[str, Any]] = []
    lang_lower = lang.lower()

    for raw_line in log_lines:
        line = raw_line.strip()
        if not line:
            continue

        match = _match_line(line, lang_lower, detectors)
        if not match:
            continue

        detector, captures = match
        error_id = _make_error_id(line, detector.code, captures)
        file_hint, line_no, col_no = _extract_location(captures, line)
        severity = {
            "label": detector.severity_label,
            "score": round(detector.severity_score, 2),
        }
        errors.append(
            {
                "id": error_id,
                "file": file_hint,
                "line": line_no,
                "column": col_no,
                "message": line,
                "code": detector.code,
                "severity": severity,
                "difficulty": round(detector.difficulty, 2),
                "cluster_id": _cluster_id(detector, captures),
                "hint": detector.hint,
                "confidence": round(detector.confidence, 2),
            }
        )

    summary = {
        "count": len(errors),
        "by_severity": _bucket(errors, lambda e: e["severity"]["label"]),
        "by_code": _bucket(errors, lambda e: e["code"]),
        "by_cluster": _bucket(errors, lambda e: e.get("cluster_id") or e["code"]),
    }

    return {"errors": errors, "summary": summary}


def _match_line(line: str, lang: str, detectors: Iterable[Detector]) -> Optional[Tuple[Detector, Dict[str, str]]]:
    for detector in detectors:
        if detector.langs and lang not in detector.langs:
            continue
        for pattern in detector.patterns:
            match = pattern.search(line)
            if match:
                captures = {
                    name: match.group(idx + 1)
                    for idx, name in enumerate(detector.captures)
                    if match.group(idx + 1) is not None
                }
                return detector, captures
    return None


def _make_error_id(line: str, code: str, captures: Dict[str, str]) -> str:
    payload = json.dumps({"line": line, "code": code, "captures": captures}, sort_keys=True)
    digest = hashlib.sha1(payload.encode("utf-8")).hexdigest()[:12]
    return f"e:{digest}"


def _extract_location(captures: Dict[str, str], line: str) -> Tuple[str, int, int]:
    file_hint = captures.get("file") or _guess_file_from_text(line)
    line_no = int(captures.get("line") or 0)
    col_no = int(captures.get("col") or captures.get("column") or 0)
    return file_hint, line_no, col_no


def _cluster_id(detector: Detector, captures: Dict[str, str]) -> str:
    if detector.cluster_key and detector.cluster_key in captures:
        return f"{detector.code}:{captures[detector.cluster_key]}"
    return detector.code


def _bucket(items: Iterable[Dict[str, Any]], key_fn) -> Dict[str, int]:
    bucket: Dict[str, int] = {}
    for item in items:
        key = key_fn(item)
        bucket[key] = bucket.get(key, 0) + 1
    return bucket


def _guess_file_from_text(text: str) -> str:
    match = re.search(r"([\w./\\-]+\.(?:py|ts|js|php|json|sql))", text)
    return match.group(1) if match else "unknown"


__all__ = [
    "load_taxonomy",
    "compile_detectors",
    "classify_lines",
]
