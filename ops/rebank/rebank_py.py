#!/usr/bin/env python3
"""
rebank-py.py — Python Re-Banker for Self-Healing System

Parses Python compiler/linter output into structured 5-field error objects.
Uses built-in py_compile for syntax checking (no execution, AST-only).

Usage:
    python ops/rebank/rebank-py.py <file.py> [<file2.py> ...]
    python -m py_compile <file.py> 2>&1 | python ops/rebank/rebank-py.py --stdin

Output (JSON):
    {
      "file": "path/to/file.py",
      "line": 10,
      "column": 5,
      "message": "SyntaxError: invalid syntax",
      "code": "PY_SYNTAX",
      "severity": "FATAL_SYNTAX"
    }

Design Notes:
    - Uses py_compile (stdlib) for zero-execution syntax checking
    - Parses stderr output with regex (Python error format is stable)
    - Returns structured JSON for envelope attachment (no schema changes)
    - Non-zero exit on parse failure; zero exit on clean
"""

import sys
import re
import json
import subprocess
import argparse
from pathlib import Path
from typing import Optional, Dict, Any, List


# Regex patterns for Python error messages
# Format 1: SyntaxError with file, line, and context
#   File "file.py", line 10
#     code here
#       ^
#   SyntaxError: invalid syntax
SYNTAX_ERROR_RE = re.compile(
    r'File\s+"([^"]+)",\s+line\s+(\d+).*?'
    r'(SyntaxError|IndentationError|TabError):\s*(.+)',
    re.DOTALL | re.MULTILINE
)

# Format 2: Generic Python exception with file and line
#   File "file.py", line 10, in <module>
GENERIC_ERROR_RE = re.compile(
    r'File\s+"([^"]+)",\s+line\s+(\d+)(?:,\s+in\s+\S+)?'
)

# Column indicator pattern (the ^ pointer)
COLUMN_INDICATOR_RE = re.compile(r'^\s+(\^+)\s*$', re.MULTILINE)


def parse_py_compile_stderr(stderr: str, default_file: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Parse stderr from `python -m py_compile` into structured error object.
    
    Args:
        stderr: Raw stderr output from py_compile
        default_file: Fallback filename if not found in error
    
    Returns:
        Dict with file, line, column, message, code, severity
        None if no error detected
    """
    if not stderr or not stderr.strip():
        return None
    
    # Try syntax error pattern first (most common)
    match = SYNTAX_ERROR_RE.search(stderr)
    if match:
        file_path = match.group(1)
        line = int(match.group(2))
        error_type = match.group(3)  # SyntaxError, IndentationError, etc.
        message = match.group(4).strip()
        
        # Try to extract column from the ^ pointer
        column = None
        column_match = COLUMN_INDICATOR_RE.search(stderr)
        if column_match:
            # Find the position of the ^ pointer
            pointer_line = column_match.group(0)
            column = len(pointer_line) - len(pointer_line.lstrip())
        
        return {
            "file": file_path,
            "line": line,
            "column": column,
            "message": f"{error_type}: {message}",
            "code": "PY_SYNTAX",
            "severity": "FATAL_SYNTAX"
        }
    
    # Try generic error pattern (runtime errors, tracebacks)
    match = GENERIC_ERROR_RE.search(stderr)
    if match:
        file_path = match.group(1)
        line = int(match.group(2))
        # Extract error message from the end of stderr
        lines = stderr.strip().split('\n')
        message = lines[-1] if lines else f"Unknown Python error in {file_path} at line {line} (empty error output - check Python version or encoding)"
        
        # Try to extract column from the ^ pointer (if present)
        column = None
        column_match = COLUMN_INDICATOR_RE.search(stderr)
        if column_match:
            pointer_line = column_match.group(0)
            column = len(pointer_line) - len(pointer_line.lstrip())
        
        return {
            "file": file_path,
            "line": line,
            "column": column,
            "message": message,
            "code": "PY_RUNTIME",
            "severity": "FATAL_RUNTIME"
        }
    
    # Fallback: unparseable error
    if default_file:
        return {
            "file": default_file,
            "line": None,
            "column": None,
            "message": f"Unparseable Python error in {default_file}. Raw output: {stderr.strip()[:200]}",
            "code": "PY_UNPARSED",
            "severity": "FATAL_SYNTAX"
        }
    
    return None


def check_syntax(file_path: Path) -> Optional[Dict[str, Any]]:
    """
    Run py_compile on a file and parse output.
    
    Args:
        file_path: Path to Python file to check
    
    Returns:
        Error dict if syntax error found, None if clean
    """
    if not file_path.exists():
        return {
            "file": str(file_path),
            "line": None,
            "column": None,
            "message": f"File not found: {file_path} (check path or file was deleted)",
            "code": "PY_FILE_NOT_FOUND",
            "severity": "FATAL_SYNTAX"
        }
    
    try:
        result = subprocess.run(
            [sys.executable, "-m", "py_compile", str(file_path)],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            return None  # No errors
        
        # Parse stderr
        error = parse_py_compile_stderr(result.stderr, str(file_path))
        return error
        
    except subprocess.TimeoutExpired:
        return {
            "file": str(file_path),
            "line": None,
            "column": None,
            "message": f"Syntax check timed out after 10s on {file_path} (file too large or infinite loop in parser?)",
            "code": "PY_TIMEOUT",
            "severity": "FATAL_SYNTAX"
        }
    except Exception as e:
        return {
            "file": str(file_path),
            "line": None,
            "column": None,
            "message": f"Syntax check failed for {file_path}: {str(e)} (check Python installation or file permissions)",
            "code": "PY_CHECK_FAILED",
            "severity": "FATAL_SYNTAX"
        }


def main():
    parser = argparse.ArgumentParser(
        description="Python Re-Banker: Parse compiler output to structured JSON"
    )
    parser.add_argument(
        "files",
        nargs="*",
        help="Python files to check"
    )
    parser.add_argument(
        "--stdin",
        action="store_true",
        help="Parse stderr from stdin instead of running py_compile"
    )
    parser.add_argument(
        "--quiet",
        "-q",
        action="store_true",
        help="Suppress output on success (only emit JSON on error)"
    )
    
    args = parser.parse_args()
    
    # Mode 1: Parse stdin (pipe from external py_compile)
    if args.stdin:
        stderr = sys.stdin.read()
        error = parse_py_compile_stderr(stderr)
        if error:
            print(json.dumps(error, ensure_ascii=False))
            sys.exit(1)
        elif not args.quiet:
            print(json.dumps({"status": "clean"}))
        sys.exit(0)
    
    # Mode 2: Check files directly
    if not args.files:
        parser.print_help()
        sys.exit(1)
    
    errors: List[Dict[str, Any]] = []
    for file_arg in args.files:
        file_path = Path(file_arg)
        error = check_syntax(file_path)
        if error:
            errors.append(error)
    
    # Output results
    if errors:
        # Emit first error only (keeps envelope tight)
        print(json.dumps(errors[0], ensure_ascii=False))
        sys.exit(1)
    elif not args.quiet:
        print(json.dumps({"status": "clean", "files_checked": len(args.files)}))
    
    sys.exit(0)


if __name__ == "__main__":
    main()
