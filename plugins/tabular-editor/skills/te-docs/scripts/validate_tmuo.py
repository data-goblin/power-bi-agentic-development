#!/usr/bin/env python3
"""
Validate Tabular Editor User Options (.tmuo) files

Validates .tmuo files against the JSON schema and checks for
common issues and best practices.

Usage:
    python validate_tmuo.py <file.tmuo>
    python validate_tmuo.py --stdin < file.tmuo
    python validate_tmuo.py --schema-only <file.tmuo>

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
SCHEMA_PATH = SCRIPT_DIR.parent / "schema" / "tmuo-schema.json"

VALID_IMPERSONATION_MODES = [
    "Default", "ImpersonateAccount", "ImpersonateAnonymous",
    "ImpersonateCurrentUser", "ImpersonateServiceAccount",
    "ImpersonateUnattendedAccount"
]

VALID_SERVER_TYPES = [
    "Sql", "Oracle", "Odbc", "OleDb", "Snowflake", "Dataflow",
    "PostgreSql", "MySql", "MariaDb", "Db2", "Databricks", "OneLake"
]

#endregion


#region Functions

def load_schema() -> dict | None:
    """
    Load the TMUO JSON schema from the schema directory.

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
    Validate TMUO against JSON Schema.

    Args:
        data: TMUO file content
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


def validate_tmuo_extras(data: dict) -> list[str]:
    """
    Additional validation beyond JSON Schema.

    Args:
        data: TMUO file content

    Returns:
        List of error/warning messages
    """
    messages = []

    # Check workspace database naming
    ws_db = data.get("WorkspaceDatabase", "")
    if ws_db and not any(char in ws_db for char in ["_", "-"]):
        print("  [WARN] WorkspaceDatabase name should include user identifier to avoid conflicts")

    # Check for plain-text passwords (security warning)
    def check_for_plaintext(obj: dict, path: str = ""):
        for key, value in obj.items():
            current_path = f"{path}.{key}" if path else key
            if key.lower() in ["password", "accountkey"] and isinstance(value, str) and value:
                print(f"  [WARN] [{current_path}] Contains plain-text credential - consider using encrypted format")
            elif isinstance(value, dict):
                check_for_plaintext(value, current_path)

    check_for_plaintext(data)

    # Check deployment settings
    deployment = data.get("Deployment", {})
    if deployment:
        target = deployment.get("TargetConnectionString", "")
        if isinstance(target, str) and "powerbi://" in target.lower():
            if deployment.get("DeployPartitions", False):
                print("  [WARN] DeployPartitions=true may cause issues with Power BI Service")
            if deployment.get("DeployDataSources", False):
                print("  [WARN] DeployDataSources=true is typically not needed for Power BI Service")

    # Check for UseWorkspace without connection
    if data.get("UseWorkspace") and not data.get("WorkspaceConnection"):
        messages.append("UseWorkspace is true but WorkspaceConnection is not set")

    return messages


def validate_tmuo_file(data: dict, schema: dict | None, schema_only: bool = False) -> tuple[int, list[str]]:
    """
    Validate TMUO file content.

    Args:
        data: Parsed JSON content
        schema: JSON Schema dict (optional)
        schema_only: If True, only run schema validation

    Returns:
        Tuple of (section_count, error_messages)
    """
    all_errors = []

    # Check basic structure
    if not isinstance(data, dict):
        return 0, ["File must be a JSON object"]

    # JSON Schema validation
    if schema:
        schema_errors = validate_with_schema(data, schema)
        all_errors.extend(schema_errors)
        if schema_only:
            return len(data), all_errors

    # Additional validation
    extra_errors = validate_tmuo_extras(data)
    all_errors.extend(extra_errors)

    return len(data), all_errors


def main():
    """
    Main entry point for TMUO validation.
    """
    if len(sys.argv) < 2:
        print("Usage: python validate_tmuo.py <file.tmuo>")
        print("       python validate_tmuo.py --stdin < file.tmuo")
        print("       python validate_tmuo.py --schema-only <file.tmuo>")
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
    print(f"Validating TMUO file: {source}...")
    if schema:
        print(f"Using schema: {SCHEMA_PATH}")

    section_count, errors = validate_tmuo_file(data, schema, schema_only)

    # Output results
    print()
    if errors:
        print(f"Found {len(errors)} error(s):")
        for error in errors:
            print(f"  [ERROR] {error}")
        sys.exit(1)
    else:
        print(f"TMUO file is valid ({section_count} top-level settings).")
        sys.exit(0)

#endregion


if __name__ == "__main__":
    main()
