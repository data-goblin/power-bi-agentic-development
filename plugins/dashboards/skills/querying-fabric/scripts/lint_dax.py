#!/usr/bin/env python3
"""Lint dashboard DAX queries for patterns that are slow, fragile or re-implement model logic.

Usage:
    python3 scripts/lint_dax.py queries/*.dax

Exits 1 when any query has a finding. Standard library only.
"""

from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path

TABLE = r"(?:'[^']+'|[A-Za-z][A-Za-z0-9_]*)"

RULES: list[tuple[str, re.Pattern[str], str]] = [
    (
        "filter-table",
        re.compile(rf"\bFILTER\s*\(\s*(?:ALL\s*\(\s*)?{TABLE}\s*[,)]", re.I),
        "FILTER over a whole table; filter the column with TREATAS or a column predicate",
    ),
    (
        "iterator",
        re.compile(rf"\b(?:AVERAGEX|MEDIANX|SUMX|COUNTX|MINX|MAXX|PERCENTILEX\.INC)\s*\(\s*(?:FILTER\s*\(\s*)?{TABLE}\s*[,)]", re.I),
        "row-by-row iterator over a table; use the model measure at the grain you need",
    ),
    (
        "countrows-filter",
        re.compile(r"\bCOUNTROWS\s*\(\s*FILTER\s*\(", re.I),
        "COUNTROWS ( FILTER ( ... ) ); use a count measure with a column filter",
    ),
    (
        "currentgroup",
        re.compile(r"\bCURRENTGROUP\s*\(", re.I),
        "GROUPBY with CURRENTGROUP iterates rows in the formula engine; use SUMMARIZECOLUMNS with measures",
    ),
    (
        "date-literal",
        re.compile(r"\bDATE\s*\(\s*(?:19|20)\d\d\b|\"(?:19|20)\d\d-\d\d-\d\d\"|\bdt\"", re.I),
        "hard-coded date; derive boundaries from MAX of the fact date",
    ),
    (
        "define-column",
        re.compile(r"\bDEFINE\b[\s\S]*?\bCOLUMN\s+'", re.I),
        "DEFINE COLUMN is rejected by XMLA clients; use a VAR or SELECTCOLUMNS",
    ),
    (
        "format",
        re.compile(r"\bFORMAT\s*\(", re.I),
        "FORMAT returns text; return the number and format it in the dashboard",
    ),
]

CALC_FILTER = re.compile(r"\bCALCULATE\s*\(\s*\[[^\]]+\]\s*,\s*([^()]*(?:\([^()]*(?:\([^()]*\)[^()]*)*\)[^()]*)*)\)", re.I)


def repeated_filters(text: str) -> list[str]:
    counts = Counter(re.sub(r"\s+", " ", m.group(1)).strip() for m in CALC_FILTER.finditer(text))
    return [f for f, n in counts.items() if n >= 3 and f]


def lint(path: Path) -> list[str]:
    text = re.sub(r"//[^\n]*|--[^\n]*", "", path.read_text(encoding="utf-8"))
    out: list[str] = []
    for name, pattern, message in RULES:
        for m in pattern.finditer(text):
            line = text.count("\n", 0, m.start()) + 1
            out.append(f"{path}:{line}: {name}: {message}")
    for f in repeated_filters(text):
        out.append(
            f"{path}: repeated-filter: '{f[:60]}' is passed to CALCULATE 3+ times; "
            "evaluate the measures once with CALCULATETABLE ( ROW ( ... ), filter ) or GENERATE over windows"
        )
    if len(re.findall(r"\bCALCULATE\s*\(", text, re.I)) >= 6 and re.search(r"\bROW\s*\(", text, re.I):
        out.append(f"{path}: calculate-per-column: 6+ CALCULATEs around ROW columns; put the measures in one filter context")
    return out


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__.strip())
        return 2
    findings = [f for a in argv for f in lint(Path(a))]
    print("\n".join(findings) if findings else f"ok: {len(argv)} queries, no findings")
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
