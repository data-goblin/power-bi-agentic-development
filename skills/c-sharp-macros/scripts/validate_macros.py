#!/usr/bin/env python3
"""
Validate Tabular Editor MacroActions.json

Validates macro definitions against the JSON schema and checks for
additional best practices.

Usage:
    python validate_macros.py <MacroActions.json>
    python validate_macros.py --stdin < MacroActions.json
    python validate_macros.py --schema-only <MacroActions.json>

Requirements:
    pip install jsonschema
"""

#region Imports

import json
import sys
from pathlib import Path

try:
    from jsonschema import Draft7Validator
    HAS_JSONSCHEMA = True
except ImportError:
    HAS_JSONSCHEMA = False

#endregion


#region Variables

SCRIPT_DIR = Path(__file__).parent
SCHEMA_PATH = SCRIPT_DIR.parent / "schema" / "macros-schema.json"

VALID_CONTEXTS = [
    "None", "Model", "Tables", "DataSources", "Perspectives", "Translations",
    "Roles", "Relationships", "PartitionCollection", "Expressions", "TablePermission",
    "Functions", "Table", "Measure", "Column", "Hierarchy", "Level", "Partition",
    "Relationship", "DataSource", "Role", "Perspective", "Translation", "KPI",
    "CalculatedColumn", "CalculationItem", "CalculatedTable", "CalculationGroup",
    "Expression", "RoleMember", "FolderOrSingularObject", "SingularObjects"
]

#endregion


#region Functions

def load_schema() -> dict | None:
    """
    Load the macros JSON schema from the schema directory.

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


def validate_with_schema(data: dict, schema: dict) -> list[str]:
    """
    Validate macros against JSON Schema.

    Args:
        data: MacroActions.json content
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

    for error in validator.iter_errors(data):
        path = " -> ".join(str(p) for p in error.absolute_path) if error.absolute_path else "root"
        errors.append(f"Schema: [{path}] {error.message}")

    return errors


def validate_macro_extras(macro: dict, index: int) -> list[str]:
    """
    Additional validation beyond JSON Schema.

    Args:
        macro: The macro dictionary
        index: Index in Actions array

    Returns:
        List of error/warning messages
    """
    messages = []
    name = macro.get("Name", f"Macro at index {index}")

    # Check for missing Name
    if not macro.get("Name"):
        print(f"  [WARN] [{index}] Macro has no Name")

    # Check for empty Execute
    if not macro.get("Execute", "").strip():
        messages.append(f"[{name}] Execute script is empty")

    # Check Enabled expression
    enabled = macro.get("Enabled", "true")
    if enabled and ";" in enabled:
        print(f"  [WARN] [{name}] Enabled expression contains semicolon - should be expression, not statement")

    # Check for dangerous patterns in Execute
    execute = macro.get("Execute", "")
    if "Delete()" in execute or ".Delete()" in execute:
        print(f"  [WARN] [{name}] Execute contains Delete() - ensure this is intended")
    if "Model.Database" in execute and "Deploy" in execute:
        print(f"  [WARN] [{name}] Execute may perform deployment operations")

    return messages


def validate_macros_file(data: dict, schema: dict | None, schema_only: bool = False) -> tuple[int, int, list[str]]:
    """
    Validate MacroActions.json content.

    Args:
        data: Parsed JSON content
        schema: JSON Schema dict (optional)
        schema_only: If True, only run schema validation

    Returns:
        Tuple of (total_macros, error_count, error_messages)
    """
    all_errors = []

    # Check basic structure
    if not isinstance(data, dict):
        return 0, 1, ["File must be a JSON object with 'Actions' array"]

    if "Actions" not in data:
        return 0, 1, ["Missing required 'Actions' array"]

    actions = data.get("Actions", [])
    if not isinstance(actions, list):
        return 0, 1, ["'Actions' must be an array"]

    # JSON Schema validation
    if schema:
        schema_errors = validate_with_schema(data, schema)
        all_errors.extend(schema_errors)
        if schema_only:
            return len(actions), len(all_errors), all_errors

    # Additional validation
    seen_ids = set()
    seen_names = set()

    for i, macro in enumerate(actions):
        if not isinstance(macro, dict):
            all_errors.append(f"Action at index {i} is not an object")
            continue

        # Extra validations
        extra_errors = validate_macro_extras(macro, i)
        all_errors.extend(extra_errors)

        # Check for duplicate IDs (if not -1)
        macro_id = macro.get("Id")
        if macro_id is not None and macro_id != -1:
            if macro_id in seen_ids:
                all_errors.append(f"[{macro.get('Name', i)}] Duplicate Id: {macro_id}")
            seen_ids.add(macro_id)

        # Check for duplicate names
        name = macro.get("Name")
        if name:
            if name in seen_names:
                print(f"  [WARN] Duplicate Name: {name}")
            seen_names.add(name)

    return len(actions), len(all_errors), all_errors


def main():
    """
    Main entry point for macro validation.
    """
    if len(sys.argv) < 2:
        print("Usage: python validate_macros.py <MacroActions.json>")
        print("       python validate_macros.py --stdin < MacroActions.json")
        print("       python validate_macros.py --schema-only <MacroActions.json>")
        sys.exit(1)

    schema_only = "--schema-only" in sys.argv
    args = [a for a in sys.argv[1:] if a != "--schema-only"]

    if not args:
        print("Error: No input file specified")
        sys.exit(1)

    # Read input
    if args[0] == "--stdin":
        content = sys.stdin.read()
        source = "stdin"
    else:
        file_path = Path(args[0])
        if not file_path.exists():
            print(f"Error: File not found: {file_path}")
            sys.exit(1)
        content = file_path.read_text()
        source = str(file_path)

    # Parse JSON
    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON - {e}")
        sys.exit(1)

    # Load schema
    schema = load_schema()

    # Validate
    actions_count = len(data.get("Actions", [])) if isinstance(data, dict) else 0
    print(f"Validating {actions_count} macros from {source}...")
    if schema:
        print(f"Using schema: {SCHEMA_PATH}")

    total, error_count, errors = validate_macros_file(data, schema, schema_only)

    # Output results
    print()
    if errors:
        print(f"Found {error_count} error(s):")
        for error in errors:
            print(f"  [ERROR] {error}")
        sys.exit(1)
    else:
        print(f"All {total} macros are valid.")
        sys.exit(0)

#endregion


if __name__ == "__main__":
    main()
