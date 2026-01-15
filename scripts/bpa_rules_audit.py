#!/usr/bin/env python3
"""
BPA Rules Audit Script

Discovers and reports all BPA rules available for a semantic model across:
- Built-in rules (TE3 only, from Preferences.json)
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
import ssl
import sys
import urllib.request
import urllib.error
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

#endregion


#region Variables

PARALLELS_BASE = Path.home() / "Library" / "Parallels" / "Windows Disks"
WSL_MOUNT = Path("/mnt/c")

# All known TE3 built-in rule IDs (extracted from TE3 v3.25.0)
BUILTIN_RULES = {
    "TE3_BUILT_IN_DATA_COLUMN_SOURCE": ("Schema", "Data column source validation"),
    "TE3_BUILT_IN_EXPRESSION_REQUIRED": ("Schema", "Expression required for calculated objects"),
    "TE3_BUILT_IN_AVOID_PROVIDER_PARTITIONS_STRUCTURED": ("Data Sources", "Avoid provider partitions with structured sources"),
    "TE3_BUILT_IN_SET_ISAVAILABLEINMDX_FALSE": ("Performance", "Set IsAvailableInMdx to false for non-MDX columns"),
    "TE3_BUILT_IN_DATE_TABLE_EXISTS": ("Schema", "Date table should exist"),
    "TE3_BUILT_IN_MANY_TO_MANY_SINGLE_DIRECTION": ("Relationships", "Many-to-many should use single direction"),
    "TE3_BUILT_IN_RELATIONSHIP_SAME_DATATYPE": ("Relationships", "Relationship columns should have same data type"),
    "TE3_BUILT_IN_AVOID_INVALID_CHARACTERS_NAMES": ("Naming", "Avoid invalid characters in names"),
    "TE3_BUILT_IN_AVOID_INVALID_CHARACTERS_DESCRIPTIONS": ("Metadata", "Avoid invalid characters in descriptions"),
    "TE3_BUILT_IN_SET_ISAVAILABLEINMDX_TRUE_NECESSARY": ("Performance", "Set IsAvailableInMdx true only when necessary"),
    "TE3_BUILT_IN_REMOVE_UNUSED_DATA_SOURCES": ("Maintenance", "Remove unused data sources"),
    "TE3_BUILT_IN_VISIBLE_TABLES_NO_DESCRIPTION": ("Metadata", "Visible tables should have descriptions"),
    "TE3_BUILT_IN_VISIBLE_COLUMNS_NO_DESCRIPTION": ("Metadata", "Visible columns should have descriptions"),
    "TE3_BUILT_IN_VISIBLE_MEASURES_NO_DESCRIPTION": ("Metadata", "Visible measures should have descriptions"),
    "TE3_BUILT_IN_VISIBLE_CALCULATION_GROUPS_NO_DESCRIPTION": ("Metadata", "Visible calculation groups should have descriptions"),
    "TE3_BUILT_IN_VISIBLE_UDF_NO_DESCRIPTION": ("Metadata", "Visible UDFs should have descriptions"),
    "TE3_BUILT_IN_PERSPECTIVES_NO_OBJECTS": ("Schema", "Perspectives should contain objects"),
    "TE3_BUILT_IN_CALCULATION_GROUPS_NO_ITEMS": ("Schema", "Calculation groups should have items"),
    "TE3_BUILT_IN_TRIM_OBJECT_NAMES": ("Naming", "Object names should be trimmed"),
    "TE3_BUILT_IN_FORMAT_STRING_COLUMNS": ("Formatting", "Columns should have format strings"),
    "TE3_BUILT_IN_TRANSLATE_DISPLAY_FOLDERS": ("Translations", "Display folders should be translated"),
    "TE3_BUILT_IN_TRANSLATE_DESCRIPTIONS": ("Translations", "Descriptions should be translated"),
    "TE3_BUILT_IN_TRANSLATE_VISIBLE_NAMES": ("Translations", "Visible names should be translated"),
    "TE3_BUILT_IN_TRANSLATE_HIERARCHY_LEVELS": ("Translations", "Hierarchy levels should be translated"),
    "TE3_BUILT_IN_TRANSLATE_PERSPECTIVES": ("Translations", "Perspectives should be translated"),
    "TE3_BUILT_IN_SPECIFY_APPLICATION_NAME": ("Metadata", "Specify application name"),
    "TE3_BUILT_IN_POWERBI_LATEST_COMPATIBILITY": ("Compatibility", "Use latest Power BI compatibility level"),
}

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
    is_builtin: bool = False
    is_enabled: bool = True
    is_ignored: bool = False  # Ignored at model level via BestPracticeAnalyzer_IgnoreRules

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

    @classmethod
    def from_builtin(cls, rule_id: str, enabled: bool = True) -> "BPARule":
        """Create a BPARule from a built-in rule ID."""

        category, description = BUILTIN_RULES.get(rule_id, ("Unknown", "Unknown built-in rule"))
        return cls(
            id=rule_id,
            name=description,
            severity=2,  # Built-in rules default to medium
            scope="Various",
            expression="(built-in)",
            category=category,
            description=description,
            is_builtin=True,
            is_enabled=enabled,
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

    @property
    def enabled_count(self) -> int:
        return len([r for r in self.rules if r.is_enabled])

    @property
    def ignored_count(self) -> int:
        return len([r for r in self.rules if r.is_ignored])

    @property
    def active_count(self) -> int:
        """Count of rules that are enabled and not ignored."""
        return len([r for r in self.rules if r.is_enabled and not r.is_ignored])


@dataclass
class BuiltInConfig:
    """Configuration for built-in BPA rules from Preferences.json."""

    status: str  # "Enable", "Disable", "EnableWithWarnings"
    disabled_ids: list[str] = field(default_factory=list)
    app_version: Optional[str] = None
    path: Optional[Path] = None
    error: Optional[str] = None


@dataclass
class AuditResult:
    """Complete audit result for a model."""

    model_path: Path
    model_format: str
    platform: str
    builtin_config: BuiltInConfig
    builtin_rules: RuleSource
    url_rules: list[RuleSource]  # Multiple URL sources possible
    model_rules: RuleSource
    user_rules: RuleSource
    machine_rules: RuleSource
    ignored_rule_ids: list[str] = field(default_factory=list)  # From BestPracticeAnalyzer_IgnoreRules

    @property
    def url_rules_count(self) -> int:
        return sum(s.count for s in self.url_rules)

    @property
    def url_rules_active_count(self) -> int:
        return sum(s.active_count for s in self.url_rules)

    @property
    def total_rules(self) -> int:
        """Total count of all rules (regardless of status)."""
        return (
            self.builtin_rules.count +
            self.url_rules_count +
            self.model_rules.count +
            self.user_rules.count +
            self.machine_rules.count
        )

    @property
    def total_active_rules(self) -> int:
        """Total count of rules that are enabled and not ignored."""
        return (
            self.builtin_rules.active_count +
            self.url_rules_active_count +
            self.model_rules.active_count +
            self.user_rules.active_count +
            self.machine_rules.active_count
        )

    @property
    def total_ignored(self) -> int:
        """Total count of ignored rules."""
        return (
            self.builtin_rules.ignored_count +
            sum(s.ignored_count for s in self.url_rules) +
            self.model_rules.ignored_count +
            self.user_rules.ignored_count +
            self.machine_rules.ignored_count
        )

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


def parse_builtin_config(local_appdata: Optional[Path]) -> BuiltInConfig:
    """
    Parse built-in BPA rules configuration from Preferences.json.
    """

    config = BuiltInConfig(status="Unknown")

    if not local_appdata:
        config.error = "Could not locate Windows LocalAppData directory"
        return config

    prefs_file = local_appdata / "TabularEditor3" / "Preferences.json"

    if not prefs_file.exists():
        config.error = f"Preferences.json not found"
        return config

    config.path = prefs_file

    try:
        with open(prefs_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        config.status = data.get("BuiltInBpaRules", "Enable")
        config.disabled_ids = data.get("DisabledBuiltInRuleIds", [])
        config.app_version = data.get("AppVersion")

    except Exception as e:
        config.error = str(e)

    return config


def get_builtin_rules(config: BuiltInConfig) -> RuleSource:
    """
    Get all built-in rules with their enabled/disabled status.
    """

    source = RuleSource(location="Built-in (TE3)", path=config.path)

    if config.status == "Disable":
        source.error = "Built-in rules disabled in Preferences.json"
        return source

    if config.error:
        source.error = config.error
        return source

    # Create rule objects for all known built-in rules
    for rule_id in BUILTIN_RULES.keys():
        is_enabled = rule_id not in config.disabled_ids
        rule = BPARule.from_builtin(rule_id, enabled=is_enabled)
        source.rules.append(rule)

    return source


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


def fetch_rules_from_url(url: str) -> RuleSource:
    """
    Fetch BPA rules from a URL.

    Returns a RuleSource with the fetched rules or an error message.
    """

    source = RuleSource(location=f"URL: {url}", path=None)

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "BPA-Audit-Script/1.0"})

        # Try with unverified SSL context (macOS often has certificate issues)
        ssl_context = ssl._create_unverified_context()
        with urllib.request.urlopen(req, timeout=15, context=ssl_context) as response:
            data = json.loads(response.read().decode("utf-8"))

        if isinstance(data, list):
            source.rules = [BPARule.from_dict(rule) for rule in data]
        else:
            source.error = "Response is not a JSON array"

    except urllib.error.HTTPError as e:
        source.error = f"HTTP {e.code}: {e.reason}"
    except urllib.error.URLError as e:
        source.error = f"URL error: {e.reason}"
    except json.JSONDecodeError as e:
        source.error = f"Invalid JSON: {e.msg}"
    except Exception as e:
        source.error = str(e)

    return source


def extract_external_rule_urls(content: str, is_json: bool = False) -> list[str]:
    """
    Extract external rule file URLs from model content.

    Handles both model.bim (JSON) and model.tmdl formats.
    Looks for BestPracticeAnalyzer_ExternalRuleFiles annotation.
    """

    urls = []

    if is_json:
        # Already parsed JSON - content is actually a dict
        return []  # Handled separately in parse_model_embedded_rules

    # TMDL format - look for annotation
    value = extract_annotation_value(content, "BestPracticeAnalyzer_ExternalRuleFiles")
    if value:
        try:
            urls = json.loads(value)
            if not isinstance(urls, list):
                urls = []
        except json.JSONDecodeError:
            pass

    return urls


def extract_annotation_value(content: str, annotation_name: str) -> Optional[str]:
    """
    Extract an annotation value from TMDL content.

    Handles:
    - Single-line: annotation Name = value
    - Multi-line with triple-quotes: annotation Name = ```...```
    - Multi-line with indentation: annotation Name =\\n\\t\\tvalue...
    """

    lines = content.split('\n')
    in_annotation = False
    value_lines = []
    base_indent = 0

    for i, line in enumerate(lines):
        # Check if this line starts the target annotation
        pattern = rf"^(\s*)annotation\s+{annotation_name}\s*=\s*(.*)$"
        match = re.match(pattern, line)

        if match:
            in_annotation = True
            base_indent = len(match.group(1))
            remainder = match.group(2).strip()

            # Handle triple-quote multi-line
            if remainder.startswith("```"):
                # Find closing ```
                combined = remainder[3:]
                for j in range(i + 1, len(lines)):
                    if "```" in lines[j]:
                        idx = lines[j].index("```")
                        combined += "\n" + lines[j][:idx]
                        return combined.strip()
                    combined += "\n" + lines[j]
                return combined.strip()

            # Handle single-line with value on same line
            if remainder and not remainder.isspace():
                # Check if value continues on next lines (indented JSON)
                if remainder.startswith('[') or remainder.startswith('{'):
                    value_lines.append(remainder)
                    continue
                # Remove surrounding quotes
                if remainder.startswith("'") and remainder.endswith("'"):
                    remainder = remainder[1:-1]
                elif remainder.startswith('"') and remainder.endswith('"'):
                    remainder = remainder[1:-1]
                return remainder

            # Empty remainder - value starts on next line(s)
            continue

        elif in_annotation:
            # Check if we've exited the indented block
            stripped = line.lstrip()
            current_indent = len(line) - len(stripped)

            # Empty line - might be end of annotation
            if not stripped:
                # Check if next non-empty line is still indented
                continue

            # If we hit a non-indented line or another annotation/property, stop
            if current_indent <= base_indent and stripped:
                break

            value_lines.append(stripped)

    if value_lines:
        # Join and parse - for JSON arrays/objects, preserve structure
        combined = '\n'.join(value_lines)
        return combined

    return None


def parse_model_annotations(model_path: Path) -> tuple[RuleSource, list[str], list[str]]:
    """
    Parse BPA-related annotations from a model (model.bim or model.tmdl).

    Extracts:
    - BestPracticeAnalyzer: Embedded rules
    - BestPracticeAnalyzer_ExternalRuleFiles: External URL list
    - BestPracticeAnalyzer_IgnoreRules: Ignored rule IDs

    Returns (RuleSource, external_urls, ignored_rule_ids).
    """

    source = RuleSource(location="Model-embedded", path=None)
    external_urls = []
    ignored_ids = []

    def parse_bim_annotations(data: dict) -> None:
        nonlocal external_urls, ignored_ids
        annotations = data.get("model", {}).get("annotations", [])
        for ann in annotations:
            name = ann.get("name", "")
            value = ann.get("value", "")
            if name == "BestPracticeAnalyzer":
                rules_data = json.loads(value) if value else []
                source.rules = [BPARule.from_dict(r) for r in rules_data]
            elif name == "BestPracticeAnalyzer_ExternalRuleFiles":
                external_urls = json.loads(value) if value else []
                if not isinstance(external_urls, list):
                    external_urls = []
            elif name == "BestPracticeAnalyzer_IgnoreRules":
                ignore_data = json.loads(value) if value else {}
                ignored_ids = ignore_data.get("RuleIDs", [])

    def parse_tmdl_annotations(content: str) -> None:
        nonlocal external_urls, ignored_ids

        # BestPracticeAnalyzer - embedded rules
        bpa_value = extract_annotation_value(content, "BestPracticeAnalyzer")
        if bpa_value:
            try:
                rules_data = json.loads(bpa_value)
                source.rules = [BPARule.from_dict(r) for r in rules_data]
            except json.JSONDecodeError as e:
                source.error = f"Error parsing BestPracticeAnalyzer: {e}"

        # BestPracticeAnalyzer_ExternalRuleFiles - URL list
        urls_value = extract_annotation_value(content, "BestPracticeAnalyzer_ExternalRuleFiles")
        if urls_value:
            try:
                external_urls = json.loads(urls_value)
                if not isinstance(external_urls, list):
                    external_urls = []
            except json.JSONDecodeError:
                pass

        # BestPracticeAnalyzer_IgnoreRules - ignored rule IDs
        ignore_value = extract_annotation_value(content, "BestPracticeAnalyzer_IgnoreRules")
        if ignore_value:
            try:
                ignore_data = json.loads(ignore_value)
                ignored_ids = ignore_data.get("RuleIDs", [])
            except json.JSONDecodeError:
                pass

    # Determine model format and find the right file
    if model_path.is_file():
        if model_path.suffix == ".bim":
            source.path = model_path
            try:
                with open(model_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                parse_bim_annotations(data)
            except Exception as e:
                source.error = str(e)

        elif model_path.suffix == ".tmdl":
            source.path = model_path
            try:
                with open(model_path, "r", encoding="utf-8") as f:
                    content = f.read()
                parse_tmdl_annotations(content)
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
                parse_tmdl_annotations(content)
            except Exception as e:
                source.error = str(e)
        else:
            source.error = "model.tmdl not found in directory"

    else:
        source.error = f"Path does not exist: {model_path}"

    return source, external_urls, ignored_ids


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


def apply_ignore_status(sources: list[RuleSource], ignored_ids: list[str]) -> None:
    """Apply ignore status to all rules in the given sources."""
    for source in sources:
        for rule in source.rules:
            if rule.id in ignored_ids:
                rule.is_ignored = True


def audit_bpa_rules(model_path: Path, fetch_urls: bool = True) -> AuditResult:
    """
    Perform a complete BPA rules audit for a model.

    Checks built-in, URL-based, model-embedded, user-level, and machine-level rules.
    Handles Windows, WSL, and macOS/Linux with Parallels.

    Args:
        model_path: Path to the model file or directory.
        fetch_urls: Whether to fetch rules from external URLs (default: True).
    """

    plat = detect_platform()
    model_format = detect_model_format(model_path)

    # Get Windows paths
    local_appdata, program_data = get_windows_appdata_paths(plat)

    # Parse built-in rules config
    builtin_config = parse_builtin_config(local_appdata)
    builtin_rules = get_builtin_rules(builtin_config)

    # Parse model annotations (embedded rules, external URLs, ignored rules)
    model_rules, external_urls, ignored_ids = parse_model_annotations(model_path)

    # Fetch rules from external URLs
    url_rules = []
    if fetch_urls and external_urls:
        for url in external_urls:
            url_source = fetch_rules_from_url(url)
            url_rules.append(url_source)

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

    # Apply ignore status to all rules from all sources
    all_sources = [builtin_rules, model_rules, user_rules, machine_rules] + url_rules
    apply_ignore_status(all_sources, ignored_ids)

    return AuditResult(
        model_path=model_path,
        model_format=model_format,
        platform=plat,
        builtin_config=builtin_config,
        builtin_rules=builtin_rules,
        url_rules=url_rules,
        model_rules=model_rules,
        user_rules=user_rules,
        machine_rules=machine_rules,
        ignored_rule_ids=ignored_ids,
    )


def format_rules_table(rules: list[BPARule], show_status: bool = False, show_ignored: bool = False) -> str:
    """
    Format a list of rules as an ASCII table.
    """

    if not rules:
        return "    (no rules)"

    lines = []
    if show_status or show_ignored:
        lines.append(f"    {'ID':<40} {'Status':<12} {'Category':<15}")
        lines.append(f"    {'-'*40} {'-'*12} {'-'*15}")
    else:
        lines.append(f"    {'ID':<30} {'Severity':<10} {'Scope':<20}")
        lines.append(f"    {'-'*30} {'-'*10} {'-'*20}")

    for rule in rules:
        if show_status or show_ignored:
            rule_id = rule.id[:38] + ".." if len(rule.id) > 40 else rule.id
            if rule.is_ignored:
                status = "Ignored"
            elif not rule.is_enabled:
                status = "Disabled"
            else:
                status = "Active"
            category = (rule.category or "")[:13] + ".." if len(rule.category or "") > 15 else (rule.category or "")
            lines.append(f"    {rule_id:<40} {status:<12} {category:<15}")
        else:
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

    # Built-in rules section
    print(f"| {'BUILT-IN (TE3)':<{width}} |")
    if result.builtin_config.path:
        path_str = str(result.builtin_config.path)
        if len(path_str) > width - 10:
            path_str = "..." + path_str[-(width-13):]
        print(f"|   Path: {path_str:<{width-10}} |")

    if result.builtin_config.app_version:
        print(f"|   TE3 Version: {result.builtin_config.app_version:<{width-17}} |")

    print(f"|   Setting: {result.builtin_config.status:<{width-13}} |")

    if result.builtin_config.error:
        print(f"|   Status: ERROR - {result.builtin_config.error[:width-20]:<{width-20}} |")
    else:
        enabled = result.builtin_rules.enabled_count
        total = result.builtin_rules.count
        disabled = total - enabled
        print(f"|   Status: {enabled}/{total} enabled, {disabled} disabled{' ':<{width-38}} |")

    print("+" + "-" * width + "+")

    # URL-based rules section
    print(f"| {'URL-BASED (External)':<{width}} |")
    if result.url_rules:
        for url_source in result.url_rules:
            url_str = url_source.location.replace("URL: ", "")
            if len(url_str) > width - 10:
                url_str = "..." + url_str[-(width-13):]
            print(f"|   URL: {url_str:<{width-9}} |")
            if url_source.error:
                print(f"|     ERROR: {url_source.error[:width-13]:<{width-13}} |")
            else:
                active = url_source.active_count
                ignored = url_source.ignored_count
                total = url_source.count
                status = f"{total} rules, {active} active, {ignored} ignored"
                print(f"|     Status: {status:<{width-14}} |")
    else:
        print(f"|   Status: No external URLs configured{' ':<{width-39}} |")
    print("+" + "-" * width + "+")

    # Other sources
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

    # Ignored rules section
    if result.ignored_rule_ids:
        print(f"| {'IGNORED RULES (from model annotation)':<{width}} |")
        ignored_str = ", ".join(result.ignored_rule_ids[:5])
        if len(result.ignored_rule_ids) > 5:
            ignored_str += f" (+{len(result.ignored_rule_ids) - 5} more)"
        if len(ignored_str) > width - 6:
            ignored_str = ignored_str[:width-9] + "..."
        print(f"|   {ignored_str:<{width-4}} |")
        print("+" + "-" * width + "+")

    # Summary
    print(f"| {'SUMMARY':^{width}} |")
    print(f"|   Built-in (enabled): {result.builtin_rules.enabled_count} / {result.builtin_rules.count:<{width-32}} |")
    print(f"|   URL-based: {result.url_rules_active_count} active / {result.url_rules_count} total{' ':<{width-42}} |")
    print(f"|   Model-embedded: {result.model_rules.active_count} active / {result.model_rules.count} total{' ':<{width-47}} |")
    print(f"|   User-level: {result.user_rules.active_count} active / {result.user_rules.count} total{' ':<{width-43}} |")
    print(f"|   Machine-level: {result.machine_rules.active_count} active / {result.machine_rules.count} total{' ':<{width-46}} |")
    print("+" + "-" * width + "+")
    print(f"|   Total rules defined: {result.total_rules:<{width-26}} |")
    print(f"|   Total ignored: {result.total_ignored:<{width-20}} |")
    print(f"| {'TOTAL ACTIVE RULES: ' + str(result.total_active_rules):^{width}} |")
    print("+" + "=" * width + "+")

    # Print detailed rules if any found
    print("\n" + "=" * 80)
    print("DETAILED RULES")
    print("=" * 80)

    print("\nBUILT-IN (TE3):")
    print(format_rules_table(result.builtin_rules.rules, show_status=True))

    for url_source in result.url_rules:
        if url_source.rules:
            print(f"\n{url_source.location}:")
            print(format_rules_table(url_source.rules, show_ignored=True))

    for name, source in sources:
        if source.rules:
            print(f"\n{name}:")
            print(format_rules_table(source.rules, show_ignored=True))


def export_json(result: AuditResult, output_path: Path) -> None:
    """
    Export audit results to JSON.
    """

    def source_to_dict(source: RuleSource, include_status: bool = False) -> dict:
        rules_list = []
        for r in source.rules:
            rule_dict = {
                "ID": r.id,
                "Name": r.name,
                "Category": r.category,
                "Severity": r.severity,
                "Scope": r.scope,
                "Expression": r.expression,
                "FixExpression": r.fix_expression,
                "CompatibilityLevel": r.compatibility_level,
                "IsIgnored": r.is_ignored,
            }
            if include_status:
                rule_dict["IsEnabled"] = r.is_enabled
                rule_dict["IsBuiltIn"] = r.is_builtin
            rules_list.append(rule_dict)

        return {
            "location": source.location,
            "path": str(source.path) if source.path else None,
            "count": source.count,
            "active_count": source.active_count,
            "ignored_count": source.ignored_count,
            "error": source.error,
            "rules": rules_list,
        }

    data = {
        "model_path": str(result.model_path),
        "model_format": result.model_format,
        "platform": result.platform,
        "total_rules": result.total_rules,
        "total_active_rules": result.total_active_rules,
        "total_ignored": result.total_ignored,
        "ignored_rule_ids": result.ignored_rule_ids,
        "builtin_config": {
            "status": result.builtin_config.status,
            "app_version": result.builtin_config.app_version,
            "path": str(result.builtin_config.path) if result.builtin_config.path else None,
            "disabled_ids": result.builtin_config.disabled_ids,
            "error": result.builtin_config.error,
        },
        "sources": {
            "builtin": source_to_dict(result.builtin_rules, include_status=True),
            "url": [source_to_dict(s) for s in result.url_rules],
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
        print(f"Total active rules: {result.total_active_rules}")
        print(f"  Built-in (enabled): {result.builtin_rules.enabled_count}/{result.builtin_rules.count}")
        print(f"  URL-based: {result.url_rules_active_count}/{result.url_rules_count}")
        print(f"  Model: {result.model_rules.active_count}/{result.model_rules.count}")
        print(f"  User: {result.user_rules.active_count}/{result.user_rules.count}")
        print(f"  Machine: {result.machine_rules.active_count}/{result.machine_rules.count}")
        if result.total_ignored > 0:
            print(f"  Ignored: {result.total_ignored}")

    # Export JSON if requested
    if args.json_output:
        export_json(result, args.json_output)

    # Exit code: 0 if rules found, 1 if errors, 2 if no rules
    has_errors = (
        result.builtin_config.error or
        result.model_rules.error or
        result.user_rules.error or
        result.machine_rules.error
    )
    if has_errors:
        sys.exit(1)
    elif result.total_rules == 0:
        sys.exit(2)
    else:
        sys.exit(0)

#endregion


if __name__ == "__main__":
    main()
