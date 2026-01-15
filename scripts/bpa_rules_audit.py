#!/usr/bin/env python3
"""
BPA Rules Audit Script

Discovers and reports all BPA rules available for a semantic model across:
- Model-embedded rules (model.bim or model.tmdl annotations)
- User-level rules (%LocalAppData%/TabularEditor3/BPARules.json)
- Machine-level rules (%ProgramData%/TabularEditor3/BPARules.json)

Supports Windows, WSL, and macOS/Linux with Parallels.
"""

#region Imports

import argparse
import json
import os
import platform
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

#endregion


#region Variables

PARALLELS_BASE = Path.home() / "Library" / "Parallels" / "Windows Disks"
WSL_MOUNT = Path("/mnt/c")

#endregion


#region Classes

@dataclass
class BPARule:
    """Represents a single BPA rule."""

    id: str
    name: str
    severity: int
    scope: str
    expression: str
    category: Optional[str] = None
    description: Optional[str] = None
    fix_expression: Optional[str] = None
    compatibility_level: Optional[int] = None

    @classmethod
    def from_dict(cls, data: dict) -> "BPARule":
        """Create a BPARule from a dictionary."""

        return cls(
            id=data.get("ID", "UNKNOWN"),
            name=data.get("Name", "Unnamed"),
            severity=data.get("Severity", 1),
            scope=data.get("Scope", ""),
            expression=data.get("Expression", ""),
            category=data.get("Category"),
            description=data.get("Description"),
            fix_expression=data.get("FixExpression"),
            compatibility_level=data.get("CompatibilityLevel"),
        )


@dataclass
class RuleSource:
    """Represents a source of BPA rules."""

    location: str
    path: Optional[Path]
    rules: list[BPARule] = field(default_factory=list)
    error: Optional[str] = None

    @property
    def found(self) -> bool:
        return self.path is not None and self.error is None

    @property
    def count(self) -> int:
        return len(self.rules)


@dataclass
class AuditResult:
    """Complete audit result for a model."""

    model_path: Path
    model_format: str
    platform: str
    model_rules: RuleSource
    user_rules: RuleSource
    machine_rules: RuleSource

    @property
    def total_rules(self) -> int:
        return self.model_rules.count + self.user_rules.count + self.machine_rules.count

#endregion


#region Functions

def detect_platform() -> str:
    """
    Detect the current platform context.

    Returns one of: 'windows', 'wsl', 'macos', 'linux'
    """

    system = platform.system().lower()

    if system == "windows":
        return "windows"
    elif system == "linux":
        # Check if running in WSL
        if os.path.exists("/proc/version"):
            with open("/proc/version", "r") as f:
                if "microsoft" in f.read().lower():
                    return "wsl"
        return "linux"
    elif system == "darwin":
        return "macos"
    else:
        return "linux"


def find_parallels_root() -> Optional[Path]:
    """
    Find the Parallels Windows disk root on macOS.

    Searches for mounted Windows disks in the Parallels directory.
    Returns the path to the [C] drive if found.
    """

    if not PARALLELS_BASE.exists():
        return None

    # Look for VM UUID directories
    for vm_dir in PARALLELS_BASE.iterdir():
        if not vm_dir.is_dir():
            continue

        # Look for [C] drive (may have different names like "[C] Macdows.hidden")
        for item in vm_dir.iterdir():
            if item.name.startswith("[C]") and item.is_dir():
                return item

    return None


def get_windows_appdata_paths(plat: str) -> tuple[Optional[Path], Optional[Path]]:
    """
    Get paths to Windows AppData locations based on platform.

    Returns (local_appdata_path, program_data_path) or (None, None) if not found.
    """

    if plat == "windows":
        local_appdata = Path(os.environ.get("LOCALAPPDATA", ""))
        program_data = Path(os.environ.get("PROGRAMDATA", ""))

        if local_appdata.exists() and program_data.exists():
            return local_appdata, program_data
        return None, None

    elif plat == "wsl":
        # Try to find Windows user directory
        if WSL_MOUNT.exists():
            users_dir = WSL_MOUNT / "Users"
            if users_dir.exists():
                # Find a user directory (skip Default, Public, etc.)
                for user_dir in users_dir.iterdir():
                    if user_dir.name.lower() in ("default", "public", "default user", "all users"):
                        continue
                    local_appdata = user_dir / "AppData" / "Local"
                    if local_appdata.exists():
                        program_data = WSL_MOUNT / "ProgramData"
                        return local_appdata, program_data
        return None, None

    elif plat in ("macos", "linux"):
        parallels_root = find_parallels_root()
        if parallels_root:
            users_dir = parallels_root / "Users"
            if users_dir.exists():
                for user_dir in users_dir.iterdir():
                    if user_dir.name.lower() in ("default", "public", "default user", "all users"):
                        continue
                    local_appdata = user_dir / "AppData" / "Local"
                    if local_appdata.exists():
                        program_data = parallels_root / "ProgramData"
                        return local_appdata, program_data
        return None, None

    return None, None


def parse_bpa_rules_json(path: Path) -> list[BPARule]:
    """
    Parse BPA rules from a JSON file.

    Expects a JSON array of rule objects.
    """

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if isinstance(data, list):
        return [BPARule.from_dict(rule) for rule in data]

    return []


def extract_annotation_value(content: str, annotation_name: str) -> Optional[str]:
    """
    Extract an annotation value from TMDL content.

    Handles both single-line and multi-line (triple-quoted) annotations.
    """

    # Pattern for single-line: annotation Name = value
    single_line = rf"annotation\s+{annotation_name}\s*=\s*(.+?)(?:\n|$)"
    match = re.search(single_line, content)
    if match:
        value = match.group(1).strip()
        # Remove surrounding quotes if present
        if value.startswith("'") and value.endswith("'"):
            value = value[1:-1]
        elif value.startswith('"') and value.endswith('"'):
            value = value[1:-1]
        return value

    # Pattern for multi-line: annotation Name = ```...```
    multi_line = rf"annotation\s+{annotation_name}\s*=\s*```(.*?)```"
    match = re.search(multi_line, content, re.DOTALL)
    if match:
        return match.group(1).strip()

    return None


def parse_model_embedded_rules(model_path: Path) -> RuleSource:
    """
    Parse BPA rules embedded in a model (model.bim or model.tmdl).

    Checks for BestPracticeAnalyzer annotation in model metadata.
    """

    source = RuleSource(location="Model-embedded", path=None)

    # Determine model format and find the right file
    if model_path.is_file():
        if model_path.suffix == ".bim":
            source.path = model_path
            try:
                with open(model_path, "r", encoding="utf-8") as f:
                    data = json.load(f)

                annotations = data.get("model", {}).get("annotations", [])
                for ann in annotations:
                    if ann.get("name") == "BestPracticeAnalyzer":
                        rules_json = ann.get("value", "[]")
                        rules_data = json.loads(rules_json)
                        source.rules = [BPARule.from_dict(r) for r in rules_data]
                        break
            except Exception as e:
                source.error = str(e)

        elif model_path.suffix == ".tmdl":
            source.path = model_path
            try:
                with open(model_path, "r", encoding="utf-8") as f:
                    content = f.read()

                bpa_value = extract_annotation_value(content, "BestPracticeAnalyzer")
                if bpa_value:
                    rules_data = json.loads(bpa_value)
                    source.rules = [BPARule.from_dict(r) for r in rules_data]
            except Exception as e:
                source.error = str(e)

    elif model_path.is_dir():
        # TMDL folder - look for model.tmdl
        model_tmdl = model_path / "model.tmdl"
        if not model_tmdl.exists():
            # Check for definition subfolder
            definition_dir = model_path / "definition"
            if definition_dir.exists():
                model_tmdl = definition_dir / "model.tmdl"

        if model_tmdl.exists():
            source.path = model_tmdl
            try:
                with open(model_tmdl, "r", encoding="utf-8") as f:
                    content = f.read()

                bpa_value = extract_annotation_value(content, "BestPracticeAnalyzer")
                if bpa_value:
                    rules_data = json.loads(bpa_value)
                    source.rules = [BPARule.from_dict(r) for r in rules_data]
            except Exception as e:
                source.error = str(e)
        else:
            source.error = "model.tmdl not found in directory"

    else:
        source.error = f"Path does not exist: {model_path}"

    return source


def parse_file_rules(path: Path, location: str) -> RuleSource:
    """
    Parse BPA rules from a BPARules.json file.
    """

    source = RuleSource(location=location, path=None)

    rules_file = path / "TabularEditor3" / "BPARules.json"

    if rules_file.exists():
        source.path = rules_file
        try:
            source.rules = parse_bpa_rules_json(rules_file)
        except Exception as e:
            source.error = str(e)
    else:
        source.error = f"File not found: {rules_file}"

    return source


def detect_model_format(model_path: Path) -> str:
    """
    Detect whether the model is in .bim or TMDL format.
    """

    if model_path.is_file():
        if model_path.suffix == ".bim":
            return "model.bim"
        elif model_path.suffix == ".tmdl":
            return "TMDL"
    elif model_path.is_dir():
        if (model_path / "model.tmdl").exists():
            return "TMDL"
        elif (model_path / "definition" / "model.tmdl").exists():
            return "TMDL (definition/)"

    return "unknown"


def audit_bpa_rules(model_path: Path) -> AuditResult:
    """
    Perform a complete BPA rules audit for a model.

    Checks model-embedded, user-level, and machine-level rules.
    Handles Windows, WSL, and macOS/Linux with Parallels.
    """

    plat = detect_platform()
    model_format = detect_model_format(model_path)

    # Parse model-embedded rules
    model_rules = parse_model_embedded_rules(model_path)

    # Get Windows paths
    local_appdata, program_data = get_windows_appdata_paths(plat)

    # Parse user-level rules
    if local_appdata:
        user_rules = parse_file_rules(local_appdata, "User-level (LocalAppData)")
    else:
        user_rules = RuleSource(
            location="User-level (LocalAppData)",
            path=None,
            error="Could not locate Windows LocalAppData directory"
        )

    # Parse machine-level rules
    if program_data:
        machine_rules = parse_file_rules(program_data, "Machine-level (ProgramData)")
    else:
        machine_rules = RuleSource(
            location="Machine-level (ProgramData)",
            path=None,
            error="Could not locate Windows ProgramData directory"
        )

    return AuditResult(
        model_path=model_path,
        model_format=model_format,
        platform=plat,
        model_rules=model_rules,
        user_rules=user_rules,
        machine_rules=machine_rules,
    )


def format_rules_table(rules: list[BPARule], max_width: int = 50) -> str:
    """
    Format a list of rules as an ASCII table.
    """

    if not rules:
        return "    (no rules)"

    lines = []
    lines.append(f"    {'ID':<30} {'Severity':<10} {'Scope':<20}")
    lines.append(f"    {'-'*30} {'-'*10} {'-'*20}")

    for rule in rules:
        rule_id = rule.id[:28] + ".." if len(rule.id) > 30 else rule.id
        scope = rule.scope[:18] + ".." if len(rule.scope) > 20 else rule.scope
        sev_map = {1: "Low", 2: "Medium", 3: "High"}
        severity = sev_map.get(rule.severity, str(rule.severity))
        lines.append(f"    {rule_id:<30} {severity:<10} {scope:<20}")

    return "\n".join(lines)


def print_report(result: AuditResult) -> None:
    """
    Print a formatted audit report.
    """

    width = 78

    print("+" + "=" * width + "+")
    print(f"| {'BPA RULES AUDIT REPORT':^{width}} |")
    print("+" + "=" * width + "+")
    print(f"| Model Path: {str(result.model_path):<{width-14}} |")
    print(f"| Format: {result.model_format:<{width-10}} |")
    print(f"| Platform: {result.platform:<{width-12}} |")
    print("+" + "-" * width + "+")

    sources = [
        ("MODEL-EMBEDDED", result.model_rules),
        ("USER-LEVEL", result.user_rules),
        ("MACHINE-LEVEL", result.machine_rules),
    ]

    for name, source in sources:
        print(f"| {name:<{width}} |")
        if source.path:
            path_str = str(source.path)
            if len(path_str) > width - 10:
                path_str = "..." + path_str[-(width-13):]
            print(f"|   Path: {path_str:<{width-10}} |")

        if source.error:
            print(f"|   Status: ERROR - {source.error[:width-20]:<{width-20}} |")
        elif source.count > 0:
            print(f"|   Status: {source.count} rule(s) found{' ':<{width-26}} |")
        else:
            print(f"|   Status: No rules found{' ':<{width-26}} |")

        print("+" + "-" * width + "+")

    print(f"| {'TOTAL RULES: ' + str(result.total_rules):^{width}} |")
    print("+" + "=" * width + "+")

    # Print detailed rules if any found
    if result.total_rules > 0:
        print("\n" + "=" * 80)
        print("DETAILED RULES")
        print("=" * 80)

        for name, source in sources:
            if source.rules:
                print(f"\n{name}:")
                print(format_rules_table(source.rules))


def export_json(result: AuditResult, output_path: Path) -> None:
    """
    Export audit results to JSON.
    """

    def source_to_dict(source: RuleSource) -> dict:
        return {
            "location": source.location,
            "path": str(source.path) if source.path else None,
            "count": source.count,
            "error": source.error,
            "rules": [
                {
                    "ID": r.id,
                    "Name": r.name,
                    "Category": r.category,
                    "Severity": r.severity,
                    "Scope": r.scope,
                    "Expression": r.expression,
                    "FixExpression": r.fix_expression,
                    "CompatibilityLevel": r.compatibility_level,
                }
                for r in source.rules
            ]
        }

    data = {
        "model_path": str(result.model_path),
        "model_format": result.model_format,
        "platform": result.platform,
        "total_rules": result.total_rules,
        "sources": {
            "model": source_to_dict(result.model_rules),
            "user": source_to_dict(result.user_rules),
            "machine": source_to_dict(result.machine_rules),
        }
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    print(f"\nExported to: {output_path}")

#endregion


#region Main

def main():
    """
    Main entry point for the BPA rules audit script.
    """

    parser = argparse.ArgumentParser(
        description="Audit BPA rules for a Power BI semantic model",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Audit a model.bim file
  python bpa_rules_audit.py /path/to/model.bim

  # Audit a TMDL folder
  python bpa_rules_audit.py /path/to/Model.SemanticModel/definition/

  # Export results to JSON
  python bpa_rules_audit.py /path/to/model.bim --json output.json
        """
    )

    parser.add_argument(
        "model_path",
        type=Path,
        help="Path to model.bim file or TMDL directory"
    )

    parser.add_argument(
        "--json",
        type=Path,
        dest="json_output",
        help="Export results to JSON file"
    )

    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress detailed output, only show summary"
    )

    args = parser.parse_args()

    # Resolve path
    model_path = args.model_path.resolve()

    # Run audit
    result = audit_bpa_rules(model_path)

    # Print report
    if not args.quiet:
        print_report(result)
    else:
        print(f"Total rules: {result.total_rules}")
        print(f"  Model: {result.model_rules.count}")
        print(f"  User: {result.user_rules.count}")
        print(f"  Machine: {result.machine_rules.count}")

    # Export JSON if requested
    if args.json_output:
        export_json(result, args.json_output)

    # Exit code: 0 if rules found, 1 if errors, 2 if no rules
    if result.model_rules.error or result.user_rules.error or result.machine_rules.error:
        sys.exit(1)
    elif result.total_rules == 0:
        sys.exit(2)
    else:
        sys.exit(0)

#endregion


if __name__ == "__main__":
    main()
