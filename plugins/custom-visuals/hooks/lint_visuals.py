#!/usr/bin/env python3
"""Deterministic lint for Deneb spec files and DAX SVG measures.

Deneb specs (*.vl.json for Vega-Lite, *.vega.json for Vega):
  error    invalid JSON; __identity__ or __key__ (removed in Deneb 1.9)
  warning  root $schema, usermeta, pbiContainer* signals (deprecated in 2.0),
           data that does not read the "dataset", data.url or data.values,
           single quotes (pbir 0.9.33 does not double them when it writes the spec)

DAX files that contain a data:image/svg+xml measure (*.dax):
  error    prefix without ;utf8, ; %23 colours; <script or on*= attributes
  warning  no xmlns on the svg element; double-quoted attributes inside the string

Usage:
    python3 lint_visuals.py file [file ...]
    python3 lint_visuals.py --hook < hook-json     (PostToolUse hook mode)

Exit 0 when there are no errors, 1 otherwise. In hook mode errors exit 2 and
go to stderr; warnings are returned as additionalContext. A crash in hook mode
prints a note to stderr and exits 0.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

DENEB_SUFFIXES = (".vl.json", ".vega.json")
REMOVED_FIELDS = ("__identity__", "__key__")
PBI_SIGNALS = re.compile(r"\bpbiContainer(Width|Height)?\b")
SVG_PREFIX = "data:image/svg+xml"
EVENT_ATTR = re.compile(r"""\son\w+\s*=""", re.IGNORECASE)


def strings(node: object) -> list[str]:
    if isinstance(node, str):
        return [node]
    if isinstance(node, dict):
        return [s for v in node.values() for s in strings(v)]
    if isinstance(node, list):
        return [s for v in node for s in strings(v)]
    return []


def reads_dataset(data: object, vega: bool) -> bool:
    if vega:
        return isinstance(data, list) and any(
            isinstance(d, dict)
            and d.get("name") == "dataset"
            and "url" not in d
            and "values" not in d
            for d in data
        )
    return isinstance(data, dict) and data.get("name") == "dataset"


def lint_deneb(path: Path, text: str) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    try:
        spec = json.loads(text)
    except ValueError as exc:
        return [f"invalid JSON: {exc}"], []
    if not isinstance(spec, dict):
        return ["the spec must be a JSON object"], []
    vega = path.name.endswith(".vega.json")
    flat = strings(spec)
    for field in REMOVED_FIELDS:
        if any(field in s for s in flat):
            errors.append(f"{field} was removed in Deneb 1.9; use __row__")
    if "$schema" in spec:
        warnings.append(
            "root $schema: Deneb 2.0 warns on it and adds the right one on export; remove it"
        )
    if "usermeta" in spec:
        warnings.append(
            "usermeta is template metadata; strip it before injecting the spec"
        )
    if any(PBI_SIGNALS.search(s) for s in flat):
        warnings.append(
            "pbiContainerWidth, pbiContainerHeight and pbiContainer are deprecated; use denebContainer.width, denebContainer.height and denebContainer"
        )
    data = spec.get("data")
    if not reads_dataset(data, vega):
        shape = '[{"name": "dataset"}]' if vega else '{"name": "dataset"}'
        warnings.append(f"data should be {shape} so the spec reads the bound fields")
    if isinstance(data, dict) and ("url" in data or "values" in data):
        warnings.append(
            "data.url or data.values embeds data; AppSource Deneb cannot fetch URLs and the bound fields are ignored"
        )
    if any("'" in s for s in flat):
        warnings.append(
            'single quote in a string: pbir 0.9.33 visuals deneb does not double it when writing the PBIR literal; use datum["Field"] and double-quoted literals'
        )
    return errors, warnings


def lint_svg_dax(text: str) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    if SVG_PREFIX not in text:
        return errors, warnings
    for m in re.finditer(re.escape(SVG_PREFIX) + r"(.{0,8})", text):
        if not m.group(1).startswith(";utf8,"):
            errors.append(
                f"{SVG_PREFIX} must be followed by ;utf8, (found {m.group(1)!r})"
            )
            break
    if "%23" in text:
        errors.append(
            "%23 in the measure: use plain #RRGGBB, the service encodes the data URI itself"
        )
    if re.search(r"<script", text, re.IGNORECASE) or EVENT_ATTR.search(text):
        errors.append("scripts and on* event attributes are stripped; remove them")
    if "<svg" in text and "http://www.w3.org/2000/svg" not in text:
        warnings.append("the svg element needs xmlns='http://www.w3.org/2000/svg'")
    if re.search(r'=\s*""[^"]*""', text):
        warnings.append(
            "attributes appear double-quoted inside the DAX string; use single quotes"
        )
    return errors, warnings


def lint_file(path: Path) -> tuple[list[str], list[str]]:
    text = path.read_text(encoding="utf-8")
    if path.name.endswith(DENEB_SUFFIXES):
        return lint_deneb(path, text)
    if path.suffix == ".dax":
        return lint_svg_dax(text)
    return [], []


def hook_path(payload: object) -> str | None:
    if not isinstance(payload, dict):
        return None
    tool_input = payload.get("tool_input") or payload.get("toolArgs") or {}
    if isinstance(tool_input, str):
        try:
            tool_input = json.loads(tool_input)
        except ValueError:
            return None
    if not isinstance(tool_input, dict):
        return None
    value = tool_input.get("file_path") or tool_input.get("path")
    return value.replace("\\", "/") if isinstance(value, str) else None


def hook_main() -> int:
    try:
        raw = sys.stdin.read()
        path_text = hook_path(json.loads(raw) if raw.strip() else {})
        if not path_text or not Path(path_text).is_file():
            return 0
        path = Path(path_text)
        errors, warnings = lint_file(path)
        if errors:
            print(f"custom-visuals lint failed: {path_text}", file=sys.stderr)
            for msg in errors:
                print(f"  ERROR  {msg}", file=sys.stderr)
            for msg in warnings:
                print(f"  WARN   {msg}", file=sys.stderr)
            return 2
        if warnings:
            context = f"custom-visuals lint for {path.name}: " + "; ".join(warnings)
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
    except Exception as exc:  # noqa: BLE001 - a crashed linter must fail open, never block an edit
        print(
            f"custom-visuals: lint_visuals.py crashed in hook mode ({exc!r}); file not linted",
            file=sys.stderr,
        )
        return 0


def main(argv: list[str]) -> int:
    if argv == ["--hook"]:
        return hook_main()
    if not argv:
        print(__doc__)
        return 2
    failed = False
    for arg in argv:
        errors, warnings = lint_file(Path(arg))
        print(
            f"{'FAIL' if errors else 'PASS'} {arg}  ({len(errors)} error(s), {len(warnings)} warning(s))"
        )
        for msg in errors:
            print(f"  ERROR  {msg}")
        for msg in warnings:
            print(f"  WARN   {msg}")
        failed = failed or bool(errors)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
