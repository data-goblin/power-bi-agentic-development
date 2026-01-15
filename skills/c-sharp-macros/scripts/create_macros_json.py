#!/usr/bin/env python3
"""
Create a new MacroActions.json from a set of .csx script files.

Usage:
    python create_macros_json.py <output_json> <csx_files>...
    python create_macros_json.py <output_json> --dir <directory> [--pattern PATTERN]

Arguments:
    output_json     Output path for MacroActions.json (creates or replaces)
    csx_files       One or more .csx script files

Options:
    --dir DIR       Directory containing .csx files
    --pattern PAT   Glob pattern for .csx files (default: *.csx)
    --recursive     Search recursively in directory

Example:
    python create_macros_json.py MacroActions.json script1.csx script2.csx
    python create_macros_json.py MacroActions.json --dir ./macros --recursive
"""

import json
import sys
import argparse
from pathlib import Path
from typing import List, Optional


def parse_macro_metadata(content: str) -> dict:
    """
    Parse metadata from script comments.

    Looks for special comment patterns:
        // Name: Macro Name
        // Tooltip: Description text
        // Context: Model, Table

    Args:
        content: Script content

    Returns:
        Dict with name, tooltip, context if found
    """
    metadata = {}
    lines = content.split("\n")

    for line in lines[:20]:
        line = line.strip()
        if line.startswith("// Name:"):
            metadata["name"] = line[8:].strip()
        elif line.startswith("// Tooltip:"):
            metadata["tooltip"] = line[11:].strip()
        elif line.startswith("// Context:"):
            metadata["context"] = line[11:].strip()
        elif line.startswith("// Description:"):
            metadata["tooltip"] = line[15:].strip()

    return metadata


def csx_to_macro(csx_path: Path, macro_id: int) -> dict:
    """
    Convert a .csx file to a macro dict.

    Args:
        csx_path: Path to .csx file
        macro_id: ID for this macro

    Returns:
        Macro dict ready for MacroActions.json
    """
    content = csx_path.read_text(encoding="utf-8")
    metadata = parse_macro_metadata(content)

    name = metadata.get(
        "name",
        csx_path.stem.replace("-", " ").replace("_", " ").title()
    )

    return {
        "Id": macro_id,
        "Name": name,
        "Enabled": "true",
        "Execute": content,
        "Tooltip": metadata.get("tooltip", ""),
        "ValidContexts": metadata.get("context", "Model")
    }


def create_macros_json(
    output_path: Path,
    csx_files: List[Path],
    verbose: bool = False
) -> List[dict]:
    """
    Create MacroActions.json from list of .csx files.

    Args:
        output_path: Path for output JSON file
        csx_files: List of .csx file paths
        verbose: Print progress

    Returns:
        List of created macro dicts

    Raises:
        FileNotFoundError: If any csx file doesn't exist
    """
    macros = []

    for i, csx_path in enumerate(csx_files, start=1):
        if not csx_path.exists():
            raise FileNotFoundError(f"Script not found: {csx_path}")

        macro = csx_to_macro(csx_path, i)
        macros.append(macro)

        if verbose:
            print(f"  [{i}] {macro['Name']} <- {csx_path.name}")

    output_path.write_text(
        json.dumps({"Actions": macros}, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )

    return macros


def collect_csx_files(
    directory: Path,
    pattern: str = "*.csx",
    recursive: bool = False
) -> List[Path]:
    """
    Collect .csx files from a directory.

    Args:
        directory: Directory to search
        pattern: Glob pattern
        recursive: Search recursively

    Returns:
        Sorted list of .csx file paths
    """
    if recursive:
        files = list(directory.rglob(pattern))
    else:
        files = list(directory.glob(pattern))

    return sorted(files, key=lambda p: p.stem.lower())


def main():
    parser = argparse.ArgumentParser(
        description="Create MacroActions.json from .csx script files"
    )
    parser.add_argument(
        "output_json",
        help="Output path for MacroActions.json"
    )
    parser.add_argument(
        "csx_files",
        nargs="*",
        help=".csx script files to include"
    )
    parser.add_argument(
        "--dir",
        help="Directory containing .csx files"
    )
    parser.add_argument(
        "--pattern",
        default="*.csx",
        help="Glob pattern (default: *.csx)"
    )
    parser.add_argument(
        "--recursive",
        action="store_true",
        help="Search directory recursively"
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Print progress"
    )

    args = parser.parse_args()

    output_path = Path(args.output_json)

    if args.dir:
        dir_path = Path(args.dir)
        if not dir_path.is_dir():
            print(f"Error: Not a directory: {dir_path}", file=sys.stderr)
            sys.exit(1)
        csx_files = collect_csx_files(dir_path, args.pattern, args.recursive)
    elif args.csx_files:
        csx_files = [Path(f) for f in args.csx_files]
    else:
        print("Error: Provide .csx files or --dir", file=sys.stderr)
        sys.exit(1)

    if not csx_files:
        print("Error: No .csx files found", file=sys.stderr)
        sys.exit(1)

    if args.verbose:
        print(f"Creating {output_path} with {len(csx_files)} macros:")

    try:
        macros = create_macros_json(output_path, csx_files, args.verbose)
        print(f"Created {output_path} with {len(macros)} macros")
    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
