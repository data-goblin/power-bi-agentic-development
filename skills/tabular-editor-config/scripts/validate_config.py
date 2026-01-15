#!/usr/bin/env python3
"""
Validate Tabular Editor 3 Configuration Files

Validates TE3 configuration files against their JSON schemas:
- Preferences.json
- UiPreferences.json
- Layouts.json
- RecentFiles.json
- RecentServers.json
- *.tmuo (model-level user options)

Usage:
    python validate_config.py <file.json>
    python validate_config.py --type preferences Preferences.json
    python validate_config.py --type tmuo Model.Username.tmuo
    python validate_config.py --stdin --type layouts < Layouts.json

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
SCHEMA_DIR = SCRIPT_DIR.parent / "schema"

CONFIG_TYPES = {
    "preferences": "preferences-schema.json",
    "uipreferences": "uipreferences-schema.json",
    "layouts": "layouts-schema.json",
    "recentfiles": "recentfiles-schema.json",
    "recentservers": "recentservers-schema.json",
    "tmuo": "tmuo-schema.json",
}

FILE_TYPE_MAPPING = {
    "preferences.json": "preferences",
    "uipreferences.json": "uipreferences",
    "layouts.json": "layouts",
    "recentfiles.json": "recentfiles",
    "recentservers.json": "recentservers",
}

#endregion


#region Functions

def detect_config_type(filename: str) -> str | None:
    """
    Detect configuration type from filename.

    Args:
        filename: Name of the file being validated

    Returns:
        Config type string or None if undetected
    """
    lower_name = filename.lower()

    if lower_name.endswith(".tmuo"):
        return "tmuo"

    for pattern, config_type in FILE_TYPE_MAPPING.items():
        if lower_name.endswith(pattern):
            return config_type

    return None


def load_schema(config_type: str) -> dict | None:
    """
    Load the JSON schema for a configuration type.

    Args:
        config_type: One of the CONFIG_TYPES keys

    Returns:
        The schema dict if found and valid, None otherwise.
    """
    if config_type not in CONFIG_TYPES:
        print(f"  [ERROR] Unknown config type: {config_type}")
        return None

    schema_path = SCHEMA_DIR / CONFIG_TYPES[config_type]

    if not schema_path.exists():
        print(f"  [WARN] Schema file not found: {schema_path}")
        return None

    try:
        return json.loads(schema_path.read_text())
    except json.JSONDecodeError as e:
        print(f"  [WARN] Invalid schema JSON: {e}")
        return None


def validate_with_schema(data: dict | list, schema: dict) -> list[str]:
    """
    Validate data against JSON Schema.

    Args:
        data: Parsed JSON content
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
    Additional validation for TMUO files.

    Args:
        data: TMUO file content

    Returns:
        List of error/warning messages
    """
    messages = []

    ws_db = data.get("WorkspaceDatabase", "")
    if ws_db and not any(char in ws_db for char in ["_", "-"]):
        print("  [WARN] WorkspaceDatabase name should include user identifier to avoid conflicts")

    def check_for_plaintext(obj: dict, path: str = ""):
        for key, value in obj.items():
            current_path = f"{path}.{key}" if path else key
            if key.lower() in ["password", "accountkey"] and isinstance(value, str) and value:
                print(f"  [WARN] [{current_path}] Contains plain-text credential")
            elif isinstance(value, dict):
                check_for_plaintext(value, current_path)

    check_for_plaintext(data)

    deployment = data.get("Deployment", {})
    if deployment:
        target = deployment.get("TargetConnectionString", "")
        if isinstance(target, str) and "powerbi://" in target.lower():
            if deployment.get("DeployPartitions", False):
                print("  [WARN] DeployPartitions=true may cause issues with Power BI Service")

    if data.get("UseWorkspace") and not data.get("WorkspaceConnection"):
        messages.append("UseWorkspace is true but WorkspaceConnection is not set")

    return messages


def validate_preferences_extras(data: dict) -> list[str]:
    """
    Additional validation for Preferences.json.

    Args:
        data: Preferences file content

    Returns:
        List of error/warning messages
    """
    messages = []

    if data.get("ProxyType") == "Manual" and not data.get("ProxyAddress"):
        messages.append("ProxyType is Manual but ProxyAddress is not set")

    if data.get("BackupOnSave") and not data.get("SaveBackupLocation"):
        print("  [WARN] BackupOnSave is true but SaveBackupLocation is not set")

    return messages


def validate_config_file(
    data: dict | list,
    config_type: str,
    schema: dict | None,
    schema_only: bool = False
) -> tuple[int, list[str]]:
    """
    Validate configuration file content.

    Args:
        data: Parsed JSON content
        config_type: Type of configuration file
        schema: JSON Schema dict (optional)
        schema_only: If True, only run schema validation

    Returns:
        Tuple of (item_count, error_messages)
    """
    all_errors = []

    if schema:
        schema_errors = validate_with_schema(data, schema)
        all_errors.extend(schema_errors)
        if schema_only:
            return len(data) if isinstance(data, (dict, list)) else 0, all_errors

    if config_type == "tmuo" and isinstance(data, dict):
        extra_errors = validate_tmuo_extras(data)
        all_errors.extend(extra_errors)
    elif config_type == "preferences" and isinstance(data, dict):
        extra_errors = validate_preferences_extras(data)
        all_errors.extend(extra_errors)

    return len(data) if isinstance(data, (dict, list)) else 0, all_errors


def main():
    """
    Main entry point for configuration validation.
    """
    if len(sys.argv) < 2:
        print("Usage: python validate_config.py <file.json>")
        print("       python validate_config.py --type <type> <file.json>")
        print("       python validate_config.py --stdin --type <type>")
        print()
        print("Types: " + ", ".join(CONFIG_TYPES.keys()))
        sys.exit(1)

    schema_only = "--schema-only" in sys.argv
    args = [a for a in sys.argv[1:] if a != "--schema-only"]

    config_type = None
    if "--type" in args:
        type_idx = args.index("--type")
        if type_idx + 1 < len(args):
            config_type = args[type_idx + 1].lower()
            args = args[:type_idx] + args[type_idx + 2:]
        else:
            print("Error: --type requires a value")
            sys.exit(1)

    if not args:
        print("Error: No input file specified")
        sys.exit(1)

    if args[0] == "--stdin":
        content = sys.stdin.read()
        source = "stdin"
        if not config_type:
            print("Error: --type is required when using --stdin")
            sys.exit(1)
    else:
        file_path = Path(args[0])
        if not file_path.exists():
            print(f"Error: File not found: {file_path}")
            sys.exit(1)
        content = file_path.read_text()
        source = str(file_path)

        if not config_type:
            config_type = detect_config_type(file_path.name)
            if not config_type:
                print(f"Error: Could not detect config type from filename '{file_path.name}'")
                print("       Use --type to specify: " + ", ".join(CONFIG_TYPES.keys()))
                sys.exit(1)

    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON - {e}")
        sys.exit(1)

    schema = load_schema(config_type)

    print(f"Validating {config_type} config: {source}...")
    if schema:
        print(f"Using schema: {SCHEMA_DIR / CONFIG_TYPES[config_type]}")

    item_count, errors = validate_config_file(data, config_type, schema, schema_only)

    print()
    if errors:
        print(f"Found {len(errors)} error(s):")
        for error in errors:
            print(f"  [ERROR] {error}")
        sys.exit(1)
    else:
        print(f"Config file is valid ({item_count} top-level items).")
        sys.exit(0)

#endregion


if __name__ == "__main__":
    main()
