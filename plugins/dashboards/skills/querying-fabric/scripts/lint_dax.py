#!/usr/bin/env python3
"""Lint dashboard DAX queries for patterns that are slow, fragile or re-implement model logic.

Usage:
    python3 lint_dax.py queries/*.dax        lint files; exit 0 ok, 1 warnings, 2 unreadable input
    python3 lint_dax.py --hook               read a PostToolUse hook payload on stdin, lint the .dax file it
                                             names, print the findings as hook context; always exit 0

Comments (// -- /* */) are removed before any rule runs and string literals are blanked, so text inside a
string or a comment never triggers or hides a finding. Two levels:
    warning  likely slow or wrong; the query should be rewritten (exit 1)
    advice   depends on the model (table size, client capabilities); read it, no exit code

Standard library only. Variables whose names start with an underscore are not flagged by the iterator rule.
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

TABLE = r"(?:'[^']+'|[A-Za-z][A-Za-z0-9_]*)"

RULES: list[tuple[str, str, re.Pattern[str], str]] = [
    (
        "warning",
        "filter-table",
        re.compile(rf"\bFILTER\s*\(\s*(?:ALL\s*\(\s*)?{TABLE}\s*[,)]", re.IGNORECASE),
        "FILTER over a whole table; filter the column with TREATAS or a column predicate",
    ),
    (
        "advice",
        "iterator",
        re.compile(
            rf"\b(?:AVERAGEX|MEDIANX|SUMX|COUNTX|MINX|MAXX|PERCENTILEX\.INC)\s*\(\s*(?:FILTER\s*\(\s*)?{TABLE}\s*[,)]",
            re.IGNORECASE,
        ),
        (
            "row-by-row iterator over a table: fine over a small dimension, costly over a fact table; "
            "prefer the model measure at the grain you need"
        ),
    ),
    (
        "warning",
        "countrows-filter",
        re.compile(r"\bCOUNTROWS\s*\(\s*FILTER\s*\(", re.IGNORECASE),
        "COUNTROWS ( FILTER ( ... ) ); use a count measure with a column filter",
    ),
    (
        "warning",
        "currentgroup",
        re.compile(r"\bCURRENTGROUP\s*\(", re.IGNORECASE),
        "GROUPBY with CURRENTGROUP iterates rows in the formula engine; use SUMMARIZECOLUMNS with measures",
    ),
    (
        "advice",
        "define-column",
        re.compile(r"\bDEFINE\b[\s\S]*?\bCOLUMN\s+'", re.IGNORECASE),
        (
            "DEFINE COLUMN may be rejected by the query endpoint (not confirmed against Learn); a VAR or "
            "SELECTCOLUMNS is the safe form"
        ),
    ),
    (
        "advice",
        "format",
        re.compile(r"\bFORMAT\s*\(", re.IGNORECASE),
        "FORMAT returns text that cannot be charted or sorted; return the number and format it in the dashboard",
    ),
]

DATE_CALL = re.compile(r"\bDATE\s*\(\s*(?:19|20)\d\d\b", re.IGNORECASE)
DATE_STRING = re.compile(r"\"(?:19|20)\d\d-\d\d-\d\d\"|\bdt\"", re.IGNORECASE)
DATE_MESSAGE = "hard-coded date; derive boundaries from MAX of the fact date"

CALC_FILTER = re.compile(
    r"\bCALCULATE\s*\(\s*\[[^\]]+\]\s*,\s*([^()]*(?:\([^()]*(?:\([^()]*\)[^()]*)*\)[^()]*)*)\)",
    re.IGNORECASE,
)


def strip_comments(text: str, blank_strings: bool) -> str:
    """Remove comments, keeping line numbers; optionally blank the inside of "string literals"."""
    out: list[str] = []
    i, n = 0, len(text)
    while i < n:
        c = text[i]
        two = text[i : i + 2]
        if two in ("//", "--"):
            while i < n and text[i] != "\n":
                i += 1
        elif two == "/*":
            end = text.find("*/", i + 2)
            end = n if end < 0 else end + 2
            out.append("".join("\n" if ch == "\n" else " " for ch in text[i:end]))
            i = end
        elif c in "\"'[":
            close = {'"': '"', "'": "'", "[": "]"}[c]
            blank = blank_strings and c == '"'
            out.append(c)
            i += 1
            while i < n:
                if text[i] == close:
                    if text[i + 1 : i + 2] == close:
                        out.append("  " if blank else text[i : i + 2])
                        i += 2
                        continue
                    break
                out.append(" " if blank and text[i] != "\n" else text[i])
                i += 1
            if i < n:
                out.append(text[i])
                i += 1
        else:
            out.append(c)
            i += 1
    return "".join(out)


def line_of(text: str, index: int) -> int:
    return text.count("\n", 0, index) + 1


def repeated_filters(text: str) -> list[str]:
    counts = Counter(
        re.sub(r"\s+", " ", m.group(1)).strip() for m in CALC_FILTER.finditer(text)
    )
    return [f for f, n in counts.items() if n >= 3 and f]


def lint_text(label: str, source: str) -> list[tuple[str, str]]:
    """Return (level, message) pairs for one query text."""
    raw = strip_comments(source, blank_strings=False)
    masked = strip_comments(source, blank_strings=True)
    out: list[tuple[str, str]] = []
    for level, name, pattern, message in RULES:
        for m in pattern.finditer(masked):
            out.append(
                (
                    level,
                    f"{label}:{line_of(masked, m.start())}: {level}: {name}: {message}",
                )
            )
    for m in DATE_CALL.finditer(masked):
        out.append(
            (
                "warning",
                f"{label}:{line_of(masked, m.start())}: warning: date-literal: {DATE_MESSAGE}",
            )
        )
    for m in DATE_STRING.finditer(raw):
        out.append(
            (
                "warning",
                f"{label}:{line_of(raw, m.start())}: warning: date-literal: {DATE_MESSAGE}",
            )
        )
    for f in repeated_filters(raw):
        out.append(
            (
                "warning",
                (
                    f"{label}: warning: repeated-filter: '{f[:60]}' is passed to CALCULATE 3+ times; "
                    "evaluate the measures once with CALCULATETABLE ( ROW ( ... ), filter ) or GENERATE over windows"
                ),
            )
        )
    if len(re.findall(r"\bCALCULATE\s*\(", masked, re.IGNORECASE)) >= 6 and re.search(
        r"\bROW\s*\(", masked, re.IGNORECASE
    ):
        out.append(
            (
                "warning",
                (
                    f"{label}: warning: calculate-per-column: 6+ CALCULATEs around ROW columns; "
                    "put the measures in one filter context"
                ),
            )
        )
    return out


def lint_file(path: Path) -> tuple[list[tuple[str, str]], str | None]:
    try:
        source = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        return [], f"{path}: cannot read: {getattr(exc, 'strerror', None) or exc}"
    return lint_text(str(path), source), None


def run_files(args: list[str]) -> int:
    findings: list[tuple[str, str]] = []
    unreadable = False
    for a in args:
        found, error = lint_file(Path(a))
        if error:
            print(error, file=sys.stderr)
            unreadable = True
        findings += found
    for _, message in findings:
        print(message)
    warnings = sum(level == "warning" for level, _ in findings)
    if unreadable:
        return 2
    if not findings:
        print(f"ok: {len(args)} queries, no findings")
    elif not warnings:
        print(f"ok: {len(args)} queries, {len(findings)} advice")
    return 1 if warnings else 0


def run_hook() -> int:
    try:
        payload = json.load(sys.stdin)
        file_path = str(payload.get("tool_input", {}).get("file_path") or "")
    except (ValueError, AttributeError):
        print("dashboards DAX lint skipped: hook payload was not JSON", file=sys.stderr)
        return 0
    path = Path(file_path.replace("\\", "/"))
    if path.suffix.lower() != ".dax" or not path.is_file():
        return 0
    findings, error = lint_file(path)
    if error:
        print(f"dashboards DAX lint skipped: {error}", file=sys.stderr)
        return 0
    if not findings:
        return 0
    context = (
        f"lint_dax.py findings for {path} (heuristics from the querying-fabric skill; judge each against the model):\n"
        + "\n".join(message for _, message in findings)
    )
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PostToolUse",
                    "additionalContext": context,
                }
            }
        )
    )
    return 0


def main(argv: list[str]) -> int:
    if argv == ["--hook"]:
        return run_hook()
    if not argv or argv[0] in ("-h", "--help"):
        print((__doc__ or "").strip())
        return 2
    return run_files(argv)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
