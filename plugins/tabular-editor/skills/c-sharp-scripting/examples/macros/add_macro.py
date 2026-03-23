#!/usr/bin/env python3
"""
Add a .csx script file as a new macro to an existing MacroActions.json.

Usage:
    python add_macro.py <csx_file> <macros_json> [--name NAME] [--tooltip TOOLTIP] [--context CONTEXT]

Arguments:
    csx_file        Path to the .csx script file
    macros_json     Path to the MacroActions.json file

Options:
    --name NAME         Macro name (default: filename without extension)
    --tooltip TOOLTIP   Tooltip text (default: empty)
    --context CONTEXT   Valid contexts: Model, Table, Column, Measure, Partition,
                        Hierarchy, Level, Relationship, CalculationGroup,
                        CalculationItem, or comma-separated combinations
                        (default: Model)

Example:
    python add_macro.py format-dax.csx MacroActions.json --name "Format DAX" --context Model
"""

import json
import sys
import argparse
from pathlib import Path


def get_next_id(macros: list) -> int:
    """Get next available macro ID."""
    if not macros:
        return 1
    return max(m.get("Id", 0) for m in macros) + 1


def add_macro(
    csx_path: Path,
    macros_path: Path,
    name: str = None,
    tooltip: str = "",
    context: str = "Model"
) -> dict:
    """
    Add a .csx script as a macro to MacroActions.json.

    Args:
        csx_path: Path to .csx script file
        macros_path: Path to MacroActions.json
        name: Macro name (default: filename stem)
        tooltip: Tooltip text
        context: Valid contexts (comma-separated)

    Returns:
        The created macro dict

    Raises:
        FileNotFoundError: If csx_path doesn't exist
        json.JSONDecodeError: If macros_path is invalid JSON
    """
    if not csx_path.exists():
        raise FileNotFoundError(f"Script file not found: {csx_path}")

    script_content = csx_path.read_text(encoding="utf-8")

    if name is None:
        name = csx_path.stem.replace("-", " ").replace("_", " ").title()

    if macros_path.exists():
        data = json.loads(macros_path.read_text(encoding="utf-8"))
        macros = data.get("Actions", [])
    else:
        macros = []

    new_macro = {
        "Id": get_next_id(macros),
        "Name": name,
        "Enabled": "true",
        "Execute": script_content,
        "Tooltip": tooltip,
        "ValidContexts": context
    }

    macros.append(new_macro)

    macros_path.write_text(
        json.dumps({"Actions": macros}, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )

    return new_macro


def main():
    parser = argparse.ArgumentParser(
        description="Add a .csx script as a macro to MacroActions.json"
    )
    parser.add_argument("csx_file", help="Path to .csx script file")
    parser.add_argument("macros_json", help="Path to MacroActions.json")
    parser.add_argument("--name", help="Macro name (default: filename stem)")
    parser.add_argument("--tooltip", default="", help="Tooltip text")
    parser.add_argument(
        "--context",
        default="Model",
        help="Valid contexts (default: Model)"
    )

    args = parser.parse_args()

    csx_path = Path(args.csx_file)
    macros_path = Path(args.macros_json)

    try:
        macro = add_macro(
            csx_path,
            macros_path,
            name=args.name,
            tooltip=args.tooltip,
            context=args.context
        )
        print(f"Added macro: {macro['Name']} (ID: {macro['Id']})")
        print(f"Contexts: {macro['ValidContexts']}")
        print(f"Saved to: {macros_path}")
    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
