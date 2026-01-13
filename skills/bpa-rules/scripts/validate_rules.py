#!/usr/bin/env python3
"""
Validate BPA Rules JSON

Validates that BPA rule definitions conform to the expected schema
and follow best practices.

Usage:
    python validate_rules.py <rules.json>
    python validate_rules.py --stdin < rules.json
"""

#region Imports

import json
import sys
import re
from pathlib import Path
from typing import Any

#endregion


#region Variables

REQUIRED_FIELDS = ["ID", "Name", "Severity", "Scope", "Expression"]
OPTIONAL_FIELDS = ["Category", "Description", "FixExpression", "CompatibilityLevel", "Source", "Remarks"]

VALID_SEVERITIES = [1, 2, 3]

VALID_SCOPES = [
    "Model", "Table", "Column", "DataColumn", "CalculatedColumn",
    "CalculatedTableColumn", "Measure", "Hierarchy", "Level",
    "Relationship", "Partition", "DataSource", "ProviderDataSource",
    "Role", "RoleMember", "TablePermission", "Perspective",
    "Culture", "CalculationGroup", "CalculationItem",
    "UserDefinedFunction", "Calendar", "KPI", "CalculatedTable"
]

VALID_CATEGORIES = [
    "DAX Expressions", "Metadata", "Performance",
    "Naming Conventions", "Model Layout", "Formatting", "Governance"
]

ID_PREFIXES = ["DAX_", "META_", "PERF_", "NAME_", "LAYOUT_", "FORMAT_", "GOV_"]

#endregion


#region Functions

def validate_rule(rule: dict, index: int) -> list[str]:
    """
    Validate a single BPA rule.

    Args:
        rule: The rule dictionary to validate
        index: The index of the rule in the array (for error messages)

    Returns:
        List of validation error messages (empty if valid)
    """
    errors = []
    rule_id = rule.get("ID", f"Rule at index {index}")

    # Check required fields
    for field in REQUIRED_FIELDS:
        if field not in rule:
            errors.append(f"[{rule_id}] Missing required field: {field}")
        elif field == "Expression" and not rule[field]:
            errors.append(f"[{rule_id}] Expression cannot be empty")

    # Validate ID format
    if "ID" in rule:
        if not re.match(r"^[A-Z][A-Z0-9_]*$", rule["ID"]):
            errors.append(f"[{rule_id}] ID should be SCREAMING_SNAKE_CASE")

    # Validate Severity
    if "Severity" in rule:
        if rule["Severity"] not in VALID_SEVERITIES:
            errors.append(f"[{rule_id}] Severity must be 1, 2, or 3 (got {rule['Severity']})")

    # Validate Scope
    if "Scope" in rule:
        scopes = [s.strip() for s in rule["Scope"].split(",")]
        for scope in scopes:
            if scope not in VALID_SCOPES:
                errors.append(f"[{rule_id}] Invalid scope: {scope}")

    # Validate Category (warning only)
    if "Category" in rule:
        if rule["Category"] not in VALID_CATEGORIES:
            # Custom categories are allowed but emit warning
            print(f"  [WARN] [{rule_id}] Non-standard category: {rule['Category']}")

    # Check for unknown fields
    known_fields = REQUIRED_FIELDS + OPTIONAL_FIELDS + ["_comment"]
    for field in rule:
        if field not in known_fields:
            print(f"  [WARN] [{rule_id}] Unknown field: {field}")

    # Validate CompatibilityLevel
    if "CompatibilityLevel" in rule:
        level = rule["CompatibilityLevel"]
        if not isinstance(level, int) or level < 1200:
            errors.append(f"[{rule_id}] CompatibilityLevel should be >= 1200")

    return errors


def validate_rules_file(rules: list[dict]) -> tuple[int, int, list[str]]:
    """
    Validate all rules in a BPA rules file.

    Args:
        rules: List of rule dictionaries

    Returns:
        Tuple of (total_rules, error_count, error_messages)
    """
    all_errors = []
    seen_ids = set()

    for i, rule in enumerate(rules):
        # Skip comment entries
        if isinstance(rule, dict) and list(rule.keys()) == ["_comment"]:
            continue

        errors = validate_rule(rule, i)
        all_errors.extend(errors)

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
        sys.exit(1)

    # Read input
    if sys.argv[1] == "--stdin":
        content = sys.stdin.read()
    else:
        file_path = Path(sys.argv[1])
        if not file_path.exists():
            print(f"Error: File not found: {file_path}")
            sys.exit(1)
        content = file_path.read_text()

    # Parse JSON
    try:
        rules = json.loads(content)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON - {e}")
        sys.exit(1)

    if not isinstance(rules, list):
        print("Error: Rules file must be a JSON array")
        sys.exit(1)

    # Validate
    print(f"Validating {len(rules)} rules...")
    total, error_count, errors = validate_rules_file(rules)

    # Output results
    if errors:
        print(f"\nFound {error_count} errors:")
        for error in errors:
            print(f"  [ERROR] {error}")
        sys.exit(1)
    else:
        print(f"\nAll {total} rules are valid.")
        sys.exit(0)

#endregion


if __name__ == "__main__":
    main()
