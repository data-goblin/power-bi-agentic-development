#!/usr/bin/env python3
"""Validate a Power BI Project (PBIP).

Focuses on cross-cutting PBIP concerns that `pbir validate` does NOT cover:
the `.pbip` root file, `.platform` files, `.SemanticModel` folder format
(TMDL vs TMSL), theme resource resolution on disk, orphan page folders, and
the silent-ignore page name regex rule. Deep `.Report` structure + JSON
schema compliance is delegated to `pbir validate` if it is on PATH.

Usage:
    validate_pbip.py <path>          text output
    validate_pbip.py <path> --json   machine-readable output
    validate_pbip.py <path> --fix    create the handful of things that are
                                     safe to scaffold (currently: .gitignore)
    validate_pbip.py <path> --no-pbir-cli
                                     skip delegation to `pbir validate`
    validate_pbip.py <path> --quiet  hide informational lines

Exit codes:
    0  clean
    1  warnings only
    2  errors
    3  script usage error

Notes:
  - The `.SemanticModel` folder is optional (thin reports have only `.Report`).
    The `.Report` folder is required for anything called a PBIP.
  - Semantic model format can be TMDL (`definition/` folder, preferred) or
    TMSL (`model.bim`, legacy). The two are mutually exclusive.
  - Page folder names can be opaque 20-char slugs or readable names, but the
    name MUST match ^[\\w-]+$ (word chars or hyphen). Names with spaces,
    dots, or other punctuation are silently ignored by Power BI Desktop.
  - Page folder name with or without the `.Page` suffix is acceptable; both
    forms appear in the wild.
"""

#region Imports
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
#endregion


#region Constants

GUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
PAGE_NAME_RE = re.compile(r"^[\w-]+$")

DEFAULT_GITIGNORE = """**/.pbi/localSettings.json
**/.pbi/cache.abf
"""

ERROR = "error"
WARN = "warn"
INFO = "info"

#endregion


#region Result types

@dataclass
class Finding:
    level: str
    code: str
    message: str
    path: str | None = None


@dataclass
class Result:
    project_root: Path
    project_type: str = "unknown"
    report_dir: Path | None = None
    semantic_model_dir: Path | None = None
    findings: list[Finding] = field(default_factory=list)
    fixes_applied: list[str] = field(default_factory=list)
    pbir_cli_output: str | None = None
    pbir_cli_exit: int | None = None

    def add(self, level: str, code: str, message: str, path: Path | None = None) -> None:
        self.findings.append(Finding(level, code, message, str(path) if path else None))

    def errors(self) -> list[Finding]:
        return [f for f in self.findings if f.level == ERROR]

    def warnings(self) -> list[Finding]:
        return [f for f in self.findings if f.level == WARN]

#endregion


#region IO helpers

def load_json(path: Path, result: Result, code_prefix: str) -> dict | None:
    """Load and parse a JSON file. Records an error on the result if missing
    or malformed. Returns the parsed dict, or None on failure."""
    if not path.exists():
        result.add(ERROR, f"{code_prefix}_missing", f"{path.name} is missing", path)
        return None
    try:
        raw = path.read_bytes()
    except OSError as e:
        result.add(ERROR, f"{code_prefix}_read", f"{path.name}: {e}", path)
        return None
    if raw.startswith(b"\xef\xbb\xbf"):
        result.add(WARN, f"{code_prefix}_bom",
                   f"{path.name} has a UTF-8 BOM; remove it (some tools reject BOMs)", path)
        raw = raw[3:]
    try:
        return json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError as e:
        result.add(ERROR, f"{code_prefix}_invalid_json",
                   f"{path.name}: {e.msg} (line {e.lineno} col {e.colno})", path)
        return None

#endregion


#region Discovery

def discover(path: Path, result: Result) -> None:
    """Populate result.project_type / report_dir / semantic_model_dir from a
    user-supplied path. Accepts a `.pbip` file, a `.Report` or
    `.SemanticModel` directory, or a project root directory."""
    path = path.resolve()

    if path.is_file() and path.suffix == ".pbip":
        result.project_root = path.parent
        data = load_json(path, result, "pbip")
        if data:
            for artifact in data.get("artifacts") or []:
                rp = (artifact.get("report") or {}).get("path")
                if rp:
                    target = (path.parent / rp).resolve()
                    if target.is_dir():
                        result.report_dir = target
                    else:
                        result.add(ERROR, "pbip_report_path_missing",
                                   f".pbip artifacts[].report.path '{rp}' does not resolve", path)
        result.semantic_model_dir = sibling_semantic_model(result.report_dir, path.parent)
        result.project_type = "thick-pbip" if result.semantic_model_dir else "thin-pbip"
        return

    if path.is_dir():
        if path.name.endswith(".Report"):
            result.project_root = path.parent
            result.report_dir = path
            result.semantic_model_dir = sibling_semantic_model(path, path.parent)
            result.project_type = "thick-bare" if result.semantic_model_dir else "report-only"
            return
        if path.name.endswith(".SemanticModel"):
            result.project_root = path.parent
            result.semantic_model_dir = path
            result.project_type = "semantic-model-only"
            return

        result.project_root = path
        pbips = sorted(path.glob("*.pbip"))
        if pbips:
            discover(pbips[0], result)
            if len(pbips) > 1:
                result.add(WARN, "multiple_pbip",
                           f"{len(pbips)} .pbip files found; validated {pbips[0].name}", path)
            return

        reports = sorted(p for p in path.iterdir() if p.is_dir() and p.name.endswith(".Report"))
        sms = sorted(p for p in path.iterdir() if p.is_dir() and p.name.endswith(".SemanticModel"))
        if reports:
            result.report_dir = reports[0]
        if sms:
            result.semantic_model_dir = sms[0]
        if result.report_dir and result.semantic_model_dir:
            result.project_type = "thick-bare"
        elif result.report_dir:
            result.project_type = "report-only"
        elif result.semantic_model_dir:
            result.project_type = "semantic-model-only"
        else:
            result.add(ERROR, "no_pbip_components",
                       "no .pbip, .Report, or .SemanticModel found at this path", path)
        return

    result.add(ERROR, "invalid_path", f"path does not exist: {path}", path)


def sibling_semantic_model(report_dir: Path | None, project_root: Path) -> Path | None:
    """Find a sibling .SemanticModel folder next to a .Report folder. Prefers
    same-basename pairing; falls back to the first match in the project root."""
    if not report_dir:
        return None
    base = report_dir.name[: -len(".Report")]
    direct = project_root / f"{base}.SemanticModel"
    if direct.is_dir():
        return direct
    for p in project_root.iterdir():
        if p.is_dir() and p.name.endswith(".SemanticModel"):
            return p
    return None

#endregion


#region Validation — .platform

def validate_platform(dir_: Path, expected_type: str, result: Result) -> None:
    """Validate a .platform file: JSON validity, type match, GUID logicalId.
    Never auto-creates — wrong logicalId is a Fabric identity conflict."""
    platform_path = dir_ / ".platform"
    data = load_json(platform_path, result, "platform")
    if not data:
        return
    meta = data.get("metadata") or {}
    if meta.get("type") != expected_type:
        result.add(ERROR, "platform_type_mismatch",
                   f".platform metadata.type is {meta.get('type')!r}, expected {expected_type!r}",
                   platform_path)
    if not meta.get("displayName"):
        result.add(WARN, "platform_no_display_name",
                   ".platform metadata.displayName is empty", platform_path)
    logical_id = (data.get("config") or {}).get("logicalId")
    if not logical_id:
        result.add(ERROR, "platform_no_logical_id",
                   ".platform config.logicalId is missing", platform_path)
    elif not GUID_RE.match(logical_id):
        result.add(ERROR, "platform_bad_guid",
                   f".platform config.logicalId is not a GUID: {logical_id}", platform_path)

#endregion


#region Validation — report folder

def validate_report(report_dir: Path, result: Result) -> None:
    """Validate a .Report folder. Covers only what pbir-cli cannot: the
    definition.pbir datasetReference, orphan page folders, page name regex,
    and theme resource resolution."""
    if not report_dir.exists():
        result.add(ERROR, "report_missing", f"report folder does not exist: {report_dir}", report_dir)
        return

    validate_platform(report_dir, "Report", result)

    pbir_path = report_dir / "definition.pbir"
    def_dir = report_dir / "definition"
    legacy_report_json = report_dir / "report.json"

    if legacy_report_json.exists() and not def_dir.exists():
        result.add(WARN, "report_legacy_format",
                   "report.json at the root (no definition/ folder) is the legacy PBIR-Legacy "
                   "format. Open in Power BI Desktop and re-save to migrate to PBIR.",
                   legacy_report_json)
        return

    if not (pbir_path.exists() or def_dir.exists()):
        result.add(ERROR, "report_no_definition",
                   "report folder has neither definition.pbir nor definition/",
                   report_dir)
        return

    validate_pbir_entry(pbir_path, report_dir, result)

    if def_dir.exists():
        validate_pages_and_themes(def_dir, result)


def validate_pbir_entry(pbir_path: Path, report_dir: Path, result: Result) -> None:
    data = load_json(pbir_path, result, "pbir")
    if not data:
        return
    version = data.get("version")
    if not version:
        result.add(ERROR, "pbir_no_version", "definition.pbir missing version", pbir_path)
    elif version == "1.0":
        result.add(WARN, "pbir_legacy_version",
                   "definition.pbir version 1.0 only supports PBIR-Legacy; upgrade to 4.0+",
                   pbir_path)

    ds = data.get("datasetReference") or {}
    if "byPath" in ds:
        by_path = (ds["byPath"] or {}).get("path")
        if not by_path:
            result.add(ERROR, "pbir_bypath_empty",
                       "datasetReference.byPath has no path", pbir_path)
        else:
            target = (report_dir / by_path).resolve()
            if not target.is_dir():
                result.add(ERROR, "pbir_bypath_missing",
                           f"datasetReference.byPath.path '{by_path}' does not resolve "
                           f"to a directory", pbir_path)
    elif "byConnection" in ds:
        if not (ds["byConnection"] or {}).get("connectionString"):
            result.add(ERROR, "pbir_byconnection_no_cs",
                       "datasetReference.byConnection is missing connectionString", pbir_path)
    else:
        result.add(ERROR, "pbir_no_dataset_ref",
                   "definition.pbir datasetReference must have byPath or byConnection",
                   pbir_path)


def validate_pages_and_themes(def_dir: Path, result: Result) -> None:
    """Validate pages (orphans + name regex) and theme resource resolution.
    Deep schema/structure checks are the job of `pbir validate`."""
    report_json_path = def_dir / "report.json"
    pages_dir = def_dir / "pages"
    pages_json_path = pages_dir / "pages.json"

    if pages_dir.exists() and pages_json_path.exists():
        validate_pages(pages_dir, pages_json_path, result)

    report_json = load_json(report_json_path, result, "report_json") if report_json_path.exists() else None
    if report_json:
        validate_theme_resources(def_dir.parent, report_json, report_json_path, result)


def validate_pages(pages_dir: Path, pages_json_path: Path, result: Result) -> None:
    pages_json = load_json(pages_json_path, result, "pages_json")
    if not pages_json:
        return

    page_order = pages_json.get("pageOrder") or []
    active = pages_json.get("activePageName")
    if active and active not in page_order:
        result.add(WARN, "active_page_not_in_order",
                   f"activePageName '{active}' is not in pageOrder (Power BI Desktop "
                   f"will auto-fix this but it indicates stale state)",
                   pages_json_path)

    for name in page_order:
        if not PAGE_NAME_RE.match(name):
            result.add(ERROR, "page_name_invalid_chars",
                       f"page name '{name}' contains characters outside [A-Za-z0-9_-]. "
                       f"Power BI Desktop will SILENTLY IGNORE this page folder.",
                       pages_json_path)

    on_disk: dict[str, Path] = {}
    for child in pages_dir.iterdir():
        if not child.is_dir():
            continue
        slug = child.name[:-len(".Page")] if child.name.endswith(".Page") else child.name
        on_disk[slug] = child

    for name in page_order:
        folder = on_disk.get(name)
        if not folder:
            result.add(ERROR, "page_folder_missing",
                       f"pageOrder lists '{name}' but no matching folder exists "
                       f"(looked for {pages_dir / name} and {pages_dir / (name + '.Page')})",
                       pages_dir)
            continue
        page_json_path = folder / "page.json"
        data = load_json(page_json_path, result, "page_json")
        if not data:
            continue
        if data.get("name") != name:
            result.add(ERROR, "page_name_mismatch",
                       f"page.json name='{data.get('name')}' does not match folder slug "
                       f"'{name}' (match is case-sensitive)", page_json_path)

    for slug, folder in on_disk.items():
        if slug not in page_order:
            result.add(WARN, "orphan_page_folder",
                       f"page folder '{folder.name}' is not in pages.json pageOrder. "
                       f"Delete it or add '{slug}' to pageOrder.", folder)


def validate_theme_resources(report_dir: Path, report_json: dict, report_json_path: Path, result: Result) -> None:
    """Verify resourcePackages items actually resolve on disk.
    Resolution path: <report>/StaticResources/<package_type>/<item.path>"""
    packages = report_json.get("resourcePackages") or []
    for pkg in packages:
        pkg_type = pkg.get("type")
        if pkg_type not in ("SharedResources", "RegisteredResources"):
            continue
        for item in pkg.get("items") or []:
            item_path = item.get("path")
            if not item_path:
                continue
            target = report_dir / "StaticResources" / pkg_type / item_path
            if not target.exists():
                rel = target.relative_to(report_dir)
                result.add(ERROR, "resource_missing",
                           f"resourcePackages {pkg_type} item '{item.get('name')}' references "
                           f"missing file: {rel}", report_json_path)

    base = (report_json.get("themeCollection") or {}).get("baseTheme") or {}
    if base.get("type") == "SharedResources" and (base_name := base.get("name")):
        matched = any(
            i.get("name") == base_name
            for pkg in packages if pkg.get("type") == "SharedResources"
            for i in pkg.get("items") or []
        )
        if not matched:
            result.add(ERROR, "base_theme_not_in_packages",
                       f"themeCollection.baseTheme '{base_name}' has type SharedResources "
                       f"but no matching entry in resourcePackages",
                       report_json_path)

#endregion


#region Validation — semantic model folder

def validate_semantic_model(sm_dir: Path, result: Result) -> None:
    """Validate a .SemanticModel folder: .platform, .pbism, TMDL-vs-TMSL."""
    if not sm_dir.exists():
        return

    validate_platform(sm_dir, "SemanticModel", result)

    pbism_path = sm_dir / "definition.pbism"
    data = load_json(pbism_path, result, "pbism")
    if data and not data.get("version"):
        result.add(ERROR, "pbism_no_version", "definition.pbism missing version", pbism_path)

    tmdl_def = sm_dir / "definition"
    model_bim = sm_dir / "model.bim"
    has_tmdl = tmdl_def.is_dir() and (tmdl_def / "model.tmdl").exists()
    has_bim = model_bim.exists()

    if has_tmdl and has_bim:
        result.add(ERROR, "both_tmdl_and_bim",
                   "both definition/ (TMDL) and model.bim (TMSL) are present — mutually exclusive",
                   sm_dir)
    elif has_bim and not has_tmdl:
        result.add(WARN, "sm_tmsl_format",
                   "model.bim (TMSL) is the legacy format; prefer TMDL for source control",
                   model_bim)
        load_json(model_bim, result, "bim")
    elif has_tmdl:
        check_tmdl_presence(tmdl_def, result)
    else:
        result.add(ERROR, "sm_no_definition",
                   "semantic model has neither definition/ (TMDL) nor model.bim (TMSL)",
                   sm_dir)


def check_tmdl_presence(def_dir: Path, result: Result) -> None:
    """Lightweight TMDL presence checks. Does not parse TMDL syntax; that's
    the tmdl skill's job."""
    if not (def_dir / "model.tmdl").exists():
        result.add(ERROR, "model_tmdl_missing",
                   "definition/model.tmdl is missing", def_dir / "model.tmdl")
        return
    tables_dir = def_dir / "tables"
    if tables_dir.is_dir() and not any(tables_dir.glob("*.tmdl")):
        result.add(WARN, "tmdl_tables_empty",
                   "definition/tables/ has no .tmdl files", tables_dir)
    for optional in ("database.tmdl", "relationships.tmdl", "expressions.tmdl"):
        if not (def_dir / optional).exists():
            key = optional.replace(".tmdl", "")
            result.add(INFO, f"tmdl_{key}_absent",
                       f"definition/{optional} absent (optional)", def_dir / optional)

#endregion


#region pbir-cli delegation

def run_pbir_validate(report_dir: Path, result: Result) -> None:
    """Shell out to `pbir validate` for deep .Report validation. Captures
    stdout/stderr for display and the exit code for final status."""
    if not shutil.which("pbir"):
        result.add(INFO, "pbir_cli_absent",
                   "pbir CLI not found on PATH. Install for deeper .Report validation: "
                   "`uv tool install pbir-cli`", None)
        return
    try:
        proc = subprocess.run(
            ["pbir", "validate", str(report_dir), "--quiet"],
            capture_output=True, text=True, timeout=60,
        )
    except subprocess.TimeoutExpired:
        result.add(WARN, "pbir_cli_timeout",
                   "pbir validate timed out after 60s", report_dir)
        return
    except OSError as e:
        result.add(WARN, "pbir_cli_error", f"pbir validate failed to spawn: {e}", report_dir)
        return
    result.pbir_cli_output = (proc.stdout or "") + (proc.stderr or "")
    result.pbir_cli_exit = proc.returncode
    if proc.returncode not in (0, 1):
        result.add(ERROR, "pbir_cli_reported_errors",
                   "pbir validate reported errors (see output below)", report_dir)
    elif proc.returncode == 1:
        result.add(WARN, "pbir_cli_reported_warnings",
                   "pbir validate reported warnings (see output below)", report_dir)

#endregion


#region Fix mode

def ensure_gitignore(project_root: Path, result: Result, fix: bool) -> None:
    """Scaffold a minimal .gitignore if absent. Only pbip runtime state, no
    implication that those files are required."""
    gi = project_root / ".gitignore"
    if gi.exists():
        return
    if fix:
        gi.write_text(DEFAULT_GITIGNORE, encoding="utf-8")
        result.fixes_applied.append(f"created {gi}")
    else:
        result.add(INFO, "gitignore_absent",
                   ".gitignore not present. Suggested contents: "
                   "'**/.pbi/localSettings.json' and '**/.pbi/cache.abf'",
                   gi)

#endregion


#region Rendering

def render_text(result: Result, quiet: bool) -> str:
    lines: list[str] = []
    lines.append(f"PBIP Validation: {result.project_root}")
    lines.append(f"  type: {result.project_type}")
    if result.report_dir:
        lines.append(f"  report: {result.report_dir.name}")
    if result.semantic_model_dir:
        lines.append(f"  semantic model: {result.semantic_model_dir.name}")
    lines.append("")

    for f in result.findings:
        if f.level == INFO and quiet:
            continue
        icon = {ERROR: "ERR ", WARN: "WARN", INFO: "info"}[f.level]
        lines.append(f"  {icon}  [{f.code}] {f.message}")
        if f.path:
            lines.append(f"         at {relpath(f.path, result.project_root)}")

    for fix in result.fixes_applied:
        lines.append(f"  FIX   {fix}")

    if result.pbir_cli_output:
        lines.append("")
        lines.append("pbir validate output:")
        lines.append("=" * 40)
        lines.append(result.pbir_cli_output.rstrip())
        lines.append("=" * 40)

    n_err = len(result.errors())
    n_warn = len(result.warnings())
    lines.append("")
    lines.append(f"Result: {n_err} error(s), {n_warn} warning(s)")
    return "\n".join(lines)


def render_json(result: Result) -> str:
    return json.dumps({
        "project_root": str(result.project_root),
        "project_type": result.project_type,
        "report_dir": str(result.report_dir) if result.report_dir else None,
        "semantic_model_dir": str(result.semantic_model_dir) if result.semantic_model_dir else None,
        "findings": [
            {"level": f.level, "code": f.code, "message": f.message, "path": f.path}
            for f in result.findings
        ],
        "fixes_applied": result.fixes_applied,
        "pbir_cli_exit": result.pbir_cli_exit,
        "pbir_cli_output": result.pbir_cli_output,
        "error_count": len(result.errors()),
        "warning_count": len(result.warnings()),
    }, indent=2)


def relpath(path_str: str, base: Path) -> str:
    try:
        return str(Path(path_str).relative_to(base))
    except ValueError:
        return path_str

#endregion


#region Main

def main() -> int:
    parser = argparse.ArgumentParser(description="Validate a Power BI Project (PBIP)")
    parser.add_argument("path", help=".pbip file, .Report / .SemanticModel dir, or project root")
    parser.add_argument("--fix", action="store_true",
                        help="scaffold missing files that are safe to create (currently only .gitignore)")
    parser.add_argument("--json", action="store_true", dest="as_json",
                        help="machine-readable output")
    parser.add_argument("--quiet", action="store_true", help="hide informational lines in text output")
    parser.add_argument("--no-pbir-cli", action="store_true",
                        help="skip delegation to `pbir validate` for .Report folder validation")
    args = parser.parse_args()

    path = Path(args.path)
    if not path.exists():
        print(f"error: path does not exist: {path}", file=sys.stderr)
        return 3

    result = Result(project_root=path if path.is_dir() else path.parent)
    discover(path, result)

    if result.report_dir:
        validate_report(result.report_dir, result)
        if not args.no_pbir_cli:
            run_pbir_validate(result.report_dir, result)
    elif result.project_type != "semantic-model-only":
        result.add(ERROR, "no_report_folder",
                   "PBIP must have a .Report folder (only .SemanticModel is optional)",
                   result.project_root)

    if result.semantic_model_dir:
        validate_semantic_model(result.semantic_model_dir, result)

    ensure_gitignore(result.project_root, result, args.fix)

    if args.as_json:
        print(render_json(result))
    else:
        print(render_text(result, quiet=args.quiet))

    if result.errors():
        return 2
    if result.warnings():
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

#endregion
