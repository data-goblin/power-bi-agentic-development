#!/usr/bin/env python3
"""
Validate BPA Rules JSON

Validates BPA rule definitions against the JSON schema and checks for
additional best practices including Tabular Editor compatibility.

Usage:
    python validate_rules.py <rules.json>
    python validate_rules.py --stdin < rules.json
    python validate_rules.py --schema-only <rules.json>  # Only JSON Schema validation
    python validate_rules.py --fix <rules.json>          # Fix common issues (CRLF, null values)

Requirements:
    pip install jsonschema
"""

#region Imports

import json
import sys
import re
from pathlib import Path
from typing import Any

try:
    from jsonschema import validate, ValidationError, Draft7Validator
    HAS_JSONSCHEMA = True
except ImportError:
    HAS_JSONSCHEMA = False

#endregion


#region Variables

SCRIPT_DIR = Path(__file__).parent
SCHEMA_PATH = SCRIPT_DIR.parent / "schema" / "bparules-schema.json"

REQUIRED_FIELDS = ["ID", "Name", "Severity", "Scope", "Expression"]
OPTIONAL_FIELDS = ["Category", "Description", "FixExpression", "CompatibilityLevel", "Source", "Remarks"]
ALLOWED_FIELDS = set(REQUIRED_FIELDS + OPTIONAL_FIELDS)

VALID_SEVERITIES = [1, 2, 3]

# From TabularEditor RuleScope (TE3 UI confirmed)
VALID_SCOPES = [
    "Model", "Table", "Measure", "Hierarchy", "Level", "Relationship",
    "Perspective", "Culture", "Partition", "ProviderDataSource", "DataColumn",
    "CalculatedColumn", "CalculatedTable", "CalculatedTableColumn", "KPI",
    "StructuredDataSource", "Variation", "NamedExpression", "ModelRole",
    "TablePermission", "CalculationGroup", "CalculationItem", "ModelRoleMember",
    "Calendar", "UserDefinedFunction",
    # Backwards compatibility aliases
    "Column", "DataSource"
]

STANDARD_CATEGORIES = [
    "DAX Expressions", "Metadata", "Performance", "Naming Conventions",
    "Model Layout", "Formatting", "Governance", "Maintenance", "Error Prevention",
    "Data Quality"
]

#endregion


#region Functions

def load_schema() -> dict | None:
    """
    Load the BPA rules JSON schema from the schema directory.

    Returns:
        The schema dict if found and valid, None otherwise.
    """
    if not SCHEMA_PATH.exists():
        print(f"  [WARN] Schema file not found: {SCHEMA_PATH}")
        return None

    try:
        return json.loads(SCHEMA_PATH.read_text())
    except json.JSONDecodeError as e:
        print(f"  [WARN] Invalid schema JSON: {e}")
        return None


def check_line_endings(file_path: Path) -> tuple[bool, str]:
    """
    Check if file has Windows CRLF line endings.

    Args:
        file_path: Path to the file to check

    Returns:
        Tuple of (has_crlf, message)
    """
    content = file_path.read_bytes()

    has_crlf = b'\r\n' in content
    has_lf_only = b'\n' in content and b'\r\n' not in content

    if has_lf_only:
        return False, "File uses Unix line endings (LF). Tabular Editor requires Windows line endings (CRLF)."
    elif has_crlf:
        return True, "File uses Windows line endings (CRLF)."
    else:
        return True, "File has no line endings (single line)."


def fix_line_endings(file_path: Path) -> bool:
    """
    Convert file to Windows CRLF line endings.

    Args:
        file_path: Path to the file to fix

    Returns:
        True if file was modified, False otherwise
    """
    content = file_path.read_bytes()

    # Check if already CRLF
    if b'\r\n' in content:
        return False

    # Convert LF to CRLF
    new_content = content.replace(b'\n', b'\r\n')
    file_path.write_bytes(new_content)
    return True


def check_te_compatibility(rules: list[dict]) -> list[str]:
    """
    Check for Tabular Editor compatibility issues.

    Args:
        rules: List of rule dictionaries

    Returns:
        List of error messages
    """
    errors = []

    # Runtime fields that TE adds but should not be in rule definitions
    RUNTIME_FIELDS = {"ErrorMessage", "ObjectCount"}

    for i, rule in enumerate(rules):
        rule_id = rule.get("ID", f"Rule at index {i}")

        # Check for _comment fields (TE doesn't allow extra properties)
        if "_comment" in rule:
            errors.append(f"[{rule_id}] Contains '_comment' field - TE doesn't allow extra properties")

        # Check for runtime fields (TE adds these, don't include them)
        runtime_found = set(rule.keys()) & RUNTIME_FIELDS
        if runtime_found:
            errors.append(f"[{rule_id}] Contains runtime fields {runtime_found} - remove these (TE adds them automatically)")

        # Check for unknown fields (excluding runtime fields which have their own error)
        unknown_fields = set(rule.keys()) - ALLOWED_FIELDS - RUNTIME_FIELDS - {"_comment"}
        if unknown_fields:
            errors.append(f"[{rule_id}] Contains unknown fields: {unknown_fields}")

        # Note: FixExpression: null is VALID per official TE rules

    return errors


def fix_te_compatibility(rules: list[dict]) -> int:
    """
    Fix Tabular Editor compatibility issues in rules.

    Args:
        rules: List of rule dictionaries (modified in place)

    Returns:
        Number of fixes applied
    """
    fixes = 0

    for rule in rules:
        keys_to_remove = []

        for key in rule:
            # Remove _comment fields
            if key == "_comment":
                keys_to_remove.append(key)
                fixes += 1
            # Remove null FixExpression
            elif key == "FixExpression" and rule[key] is None:
                keys_to_remove.append(key)
                fixes += 1

        for key in keys_to_remove:
            del rule[key]

    return fixes


def validate_with_schema(rules: list[dict], schema: dict) -> list[str]:
    """
    Validate rules against JSON Schema.

    Args:
        rules: List of rule dictionaries
        schema: JSON Schema dict

    Returns:
        List of validation error messages
    """
    if not HAS_JSONSCHEMA:
        print("  [WARN] jsonschema not installed, skipping schema validation")
        print("         Install with: pip install jsonschema")
        return []

    errors = []
    validator = Draft7Validator(schema)

    for error in validator.iter_errors(rules):
        path = " -> ".join(str(p) for p in error.absolute_path) if error.absolute_path else "root"
        errors.append(f"Schema: [{path}] {error.message}")

    return errors


def validate_rule_extras(rule: dict, index: int) -> list[str]:
    """
    Additional validation beyond JSON Schema (best practices, warnings).

    Args:
        rule: The rule dictionary to validate
        index: The index of the rule in the array

    Returns:
        List of validation messages (errors and warnings)
    """
    messages = []
    rule_id = rule.get("ID", f"Rule at index {index}")

    # Check ID naming convention (should start with category prefix)
    if "ID" in rule:
        id_val = rule["ID"]
        known_prefixes = ["DAX_", "META_", "PERF_", "NAME_", "LAYOUT_", "FORMAT_", "GOV_", "MAINT_", "ERR_", "PQ_"]
        if not any(id_val.startswith(p) for p in known_prefixes):
            print(f"  [WARN] [{rule_id}] ID doesn't use standard prefix (DAX_, META_, PERF_, PQ_, etc.)")

    # Check Category against known values
    if "Category" in rule and rule["Category"] not in STANDARD_CATEGORIES:
        print(f"  [WARN] [{rule_id}] Non-standard category: {rule['Category']}")

    # Check FixExpression doesn't use Delete() without high severity
    if "FixExpression" in rule:
        fix = rule["FixExpression"]
        if fix is not None and "Delete()" in fix and rule.get("Severity", 1) < 3:
            messages.append(f"[{rule_id}] FixExpression uses Delete() but Severity < 3 (destructive fix on low-severity rule)")

    # Check for common Expression issues
    if "Expression" in rule:
        expr = rule["Expression"]
        # Warn about case-sensitive string comparisons
        if '= "' in expr or '="' in expr:
            if "StringComparison" not in expr and "ToLower" not in expr and "ToUpper" not in expr:
                print(f"  [WARN] [{rule_id}] String comparison may be case-sensitive")

    return messages


def validate_rules_file(rules: list[dict], schema: dict | None, schema_only: bool = False) -> tuple[int, int, list[str]]:
    """
    Validate all rules in a BPA rules file.

    Args:
        rules: List of rule dictionaries
        schema: JSON Schema dict (optional)
        schema_only: If True, only run schema validation

    Returns:
        Tuple of (total_rules, error_count, error_messages)
    """
    all_errors = []

    # TE compatibility checks (always run)
    te_errors = check_te_compatibility(rules)
    all_errors.extend(te_errors)

    # JSON Schema validation
    if schema:
        schema_errors = validate_with_schema(rules, schema)
        all_errors.extend(schema_errors)
        if schema_only:
            return len(rules), len(all_errors), all_errors

    # Additional validation
    seen_ids = set()

    for i, rule in enumerate(rules):
        if not isinstance(rule, dict):
            all_errors.append(f"Rule at index {i} is not an object")
            continue

        # Extra validations
        extra_errors = validate_rule_extras(rule, i)
        all_errors.extend(extra_errors)

        # Check for duplicate IDs
        rule_id = rule.get("ID")
        if rule_id:
            if rule_id in seen_ids:
                all_errors.append(f"[{rule_id}] Duplicate rule ID")
            seen_ids.add(rule_id)

    return len(rules), len(all_errors), all_errors


def main():
    """
    Main entry point for BPA rule validation.
    """
    if len(sys.argv) < 2:
        print("Usage: python validate_rules.py <rules.json>")
        print("       python validate_rules.py --stdin < rules.json")
        print("       python validate_rules.py --schema-only <rules.json>")
        print("       python validate_rules.py --fix <rules.json>")
        sys.exit(1)

    schema_only = "--schema-only" in sys.argv
    fix_mode = "--fix" in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("--")]

    if not args:
        print("Error: No input file specified")
        sys.exit(1)

    # Read input
    if args[0] == "--stdin":
        content = sys.stdin.read()
        source = "stdin"
        file_path = None
    else:
        file_path = Path(args[0])
        if not file_path.exists():
            print(f"Error: File not found: {file_path}")
            sys.exit(1)
        content = file_path.read_text()
        source = str(file_path)

    # Check line endings
    if file_path:
        has_crlf, le_message = check_line_endings(file_path)
        if not has_crlf:
            if fix_mode:
                fix_line_endings(file_path)
                print(f"  [FIXED] Converted to Windows line endings (CRLF)")
                content = file_path.read_text()
            else:
                print(f"  [ERROR] {le_message}")
                print(f"          Run with --fix to convert automatically")

    # Parse JSON
    try:
        rules = json.loads(content)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON - {e}")
        sys.exit(1)

    if not isinstance(rules, list):
        print("Error: Rules file must be a JSON array")
        sys.exit(1)

    # Fix mode: apply fixes
    if fix_mode and file_path:
        fixes = fix_te_compatibility(rules)
        if fixes > 0:
            # Write fixed JSON
            with open(file_path, 'w') as f:
                json.dump(rules, f, indent=4)
            # Re-apply CRLF
            fix_line_endings(file_path)
            print(f"  [FIXED] Removed {fixes} TE compatibility issues")
            content = file_path.read_text()
            rules = json.loads(content)

    # Load schema
    schema = load_schema()

    # Validate
    print(f"Validating {len(rules)} rules from {source}...")
    if schema:
        print(f"Using schema: {SCHEMA_PATH}")

    total, error_count, errors = validate_rules_file(rules, schema, schema_only)

    # Output results
    print()
    if errors:
        print(f"Found {error_count} error(s):")
        for error in errors:
            print(f"  [ERROR] {error}")
        sys.exit(1)
    else:
        print(f"All {total} rules are valid.")
        sys.exit(0)

#endregion


if __name__ == "__main__":
    main()
