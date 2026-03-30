#!/usr/bin/env python3
"""
Export Fabric semantic model as PBIP (Power BI Project) format.

Uses the same path syntax as fab CLI commands.

Usage:
    python3 export_semantic_model_as_pbip.py "Workspace.Workspace/Model.SemanticModel" -o ./output
    python3 export_semantic_model_as_pbip.py "Sales.Workspace/Sales Model.SemanticModel" -o /tmp/exports

Requirements:
    - fab CLI installed and authenticated
"""

import argparse
import base64
import json
import re
import subprocess
import sys
import uuid
from pathlib import Path


#region Helper Functions


def run_fab_command(args: list[str]) -> str:
    """
    Run fab CLI command and return output.

    Args:
        args: List of command arguments

    Returns:
        Command stdout as string

    Raises:
        SystemExit if command fails or fab not found
    """
    try:
        result = subprocess.run(
            ["fab"] + args,
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Error running fab command: {e.stderr}", file=sys.stderr)
        sys.exit(1)
    except FileNotFoundError:
        print("Error: fab CLI not found. Install from: https://microsoft.github.io/fabric-cli/", file=sys.stderr)
        sys.exit(1)


def parse_path(path: str) -> tuple[str, str, str]:
    """
    Parse Fabric path into workspace, item, and display name.

    Args:
        path: Full path like "Workspace.Workspace/Model.SemanticModel"

    Returns:
        Tuple of (workspace_path, item_path, display_name)

    Raises:
        ValueError if path format is invalid
    """
    if "/" not in path:
        raise ValueError(f"Invalid path format: {path}. Expected: Workspace.Workspace/Item.Type")

    parts = path.split("/", 1)
    workspace = parts[0]
    item = parts[1]

    if ".Workspace" not in workspace:
        workspace = f"{workspace}.Workspace"

    # Extract display name before adding extension
    display_name = re.sub(r'\.SemanticModel$', '', item, flags=re.IGNORECASE)

    if ".SemanticModel" not in item:
        item = f"{item}.SemanticModel"

    return workspace, item, display_name


def sanitize_name(name: str) -> str:
    """
    Sanitize name for filesystem usage.

    Args:
        name: Display name

    Returns:
        Filesystem-safe name
    """
    name = re.sub(r'\.SemanticModel$', '', name, flags=re.IGNORECASE)
    safe_name = re.sub(r'[<>:"/\\|?*]', '_', name)
    safe_name = re.sub(r'\s+', ' ', safe_name)
    return safe_name.strip()


#endregion


#region Model Definition


def get_model_definition(full_path: str) -> dict:
    """
    Get model definition from Fabric.

    Args:
        full_path: Full path like "Workspace.Workspace/Model.SemanticModel"

    Returns:
        Definition dict
    """
    print(f"Fetching model definition...")

    output = run_fab_command(["get", full_path, "-q", "definition"])

    try:
        return json.loads(output)
    except json.JSONDecodeError:
        print("Error: Failed to parse model definition JSON", file=sys.stderr)
        sys.exit(1)


def parse_tmdl_definition(definition: dict) -> dict[str, str]:
    """
    Parse TMDL definition parts from base64-encoded payload.

    Args:
        definition: Definition dict with parts array

    Returns:
        Dict mapping path to decoded content
    """
    parts = {}

    for part in definition.get("parts", []):
        path = part.get("path", "")
        payload = part.get("payload", "")

        try:
            content = base64.b64decode(payload).decode("utf-8")
            parts[path] = content
        except Exception as e:
            print(f"Warning: Failed to decode part {path}: {e}", file=sys.stderr)

    return parts


#endregion


#region PBIP Structure Creation


def create_pbip_structure(definition: dict, output_path: Path, model_name: str):
    """
    Create PBIP folder structure with model definition.

    Args:
        definition: Model definition dict
        output_path: Output directory
        model_name: Model display name
    """
    safe_name = sanitize_name(model_name)

    container_path = output_path / safe_name
    container_path.mkdir(parents=True, exist_ok=True)

    print(f"Creating PBIP structure in: {container_path}")

    # Create .pbip metadata file
    pbip_metadata = {
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/pbip/pbipProperties/1.0.0/schema.json",
        "version": "1.0",
        "artifacts": [
            {
                "report": {
                    "path": f"{safe_name}.Report"
                }
            }
        ],
        "settings": {
            "enableAutoRecovery": True
        }
    }

    pbip_file = container_path / f"{safe_name}.pbip"
    with open(pbip_file, "w", encoding="utf-8") as f:
        json_str = json.dumps(pbip_metadata, indent=2)
        json_str = json_str.replace(': True', ': true').replace(': False', ': false')
        f.write(json_str)

    create_report_folder(container_path, safe_name)
    create_model_folder(container_path, safe_name, definition)

    print(f"PBIP created: {container_path}")
    print(f"Open in Power BI Desktop: {pbip_file}")


def create_report_folder(container_path: Path, safe_name: str):
    """Create minimal Report folder structure."""
    report_folder = container_path / f"{safe_name}.Report"
    report_folder.mkdir(parents=True, exist_ok=True)

    # .platform file
    platform_content = {
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
        "metadata": {
            "type": "Report",
            "displayName": safe_name
        },
        "config": {
            "version": "2.0",
            "logicalId": str(uuid.uuid4())
        }
    }

    with open(report_folder / '.platform', 'w', encoding='utf-8') as f:
        json.dump(platform_content, f, indent=2)

    # definition.pbir
    pbir_content = {
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/1.0.0/schema.json",
        "version": "4.0",
        "datasetReference": {
            "byPath": {
                "path": f"../{safe_name}.SemanticModel"
            }
        }
    }

    with open(report_folder / 'definition.pbir', 'w', encoding='utf-8') as f:
        json.dump(pbir_content, f, indent=2)

    # definition folder
    definition_folder = report_folder / 'definition'
    definition_folder.mkdir()

    # report.json
    report_json = {
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/report/2.1.0/schema.json",
        "themeCollection": {
            "baseTheme": {
                "name": "CY24SU10",
                "reportVersionAtImport": "5.59",
                "type": "SharedResources"
            }
        },
        "settings": {
            "useStylableVisualContainerHeader": True,
            "defaultDrillFilterOtherVisuals": True
        }
    }

    with open(definition_folder / 'report.json', 'w', encoding='utf-8') as f:
        json_str = json.dumps(report_json, indent=2)
        json_str = json_str.replace(': True', ': true').replace(': False', ': false')
        f.write(json_str)

    # version.json
    with open(definition_folder / 'version.json', 'w', encoding='utf-8') as f:
        json.dump({
            "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/versionMetadata/1.0.0/schema.json",
            "version": "2.0.0"
        }, f, indent=2)

    # blank page
    pages_folder = definition_folder / 'pages'
    pages_folder.mkdir()

    page_id = str(uuid.uuid4()).replace('-', '')[:16]
    page_folder = pages_folder / page_id
    page_folder.mkdir()

    with open(page_folder / 'page.json', 'w', encoding='utf-8') as f:
        json.dump({
            "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.0.0/schema.json",
            "name": page_id,
            "displayName": "Page 1",
            "width": 1920,
            "height": 1080
        }, f, indent=2)

    (page_folder / 'visuals').mkdir()

    with open(pages_folder / 'pages.json', 'w', encoding='utf-8') as f:
        json.dump({
            "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json",
            "pageOrder": [page_id],
            "activePageName": page_id
        }, f, indent=2)


def create_model_folder(container_path: Path, safe_name: str, definition: dict):
    """Create .SemanticModel folder with TMDL definition."""
    model_folder = container_path / f"{safe_name}.SemanticModel"
    model_folder.mkdir(parents=True, exist_ok=True)

    # .platform file
    with open(model_folder / '.platform', 'w', encoding='utf-8') as f:
        json.dump({
            "$schema": "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
            "metadata": {
                "type": "SemanticModel",
                "displayName": safe_name
            },
            "config": {
                "version": "2.0",
                "logicalId": str(uuid.uuid4())
            }
        }, f, indent=2)

    # definition.pbism
    with open(model_folder / 'definition.pbism', 'w', encoding='utf-8') as f:
        json.dump({
            "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/semanticModel/definitionProperties/1.0.0/schema.json",
            "version": "4.0",
            "settings": {}
        }, f, indent=2)

    # .pbi folder
    pbi_folder = model_folder / ".pbi"
    pbi_folder.mkdir(parents=True, exist_ok=True)

    with open(pbi_folder / "editorSettings.json", "w", encoding="utf-8") as f:
        json_str = json.dumps({
            "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/semanticModel/editorSettings/1.0.0/schema.json",
            "autodetectRelationships": True,
            "parallelQueryLoading": True
        }, indent=2)
        json_str = json_str.replace(': True', ': true').replace(': False', ': false')
        f.write(json_str)

    # Write TMDL parts
    tmdl_parts = parse_tmdl_definition(definition)

    for part_path, content in tmdl_parts.items():
        if part_path == '.platform':
            continue

        file_path = model_folder / part_path
        file_path.parent.mkdir(parents=True, exist_ok=True)

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

    print(f"  Wrote {len(tmdl_parts)} TMDL parts")


#endregion


#region Main


def main():
    parser = argparse.ArgumentParser(
        description="Export Fabric semantic model as PBIP format",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python3 export_semantic_model_as_pbip.py "Production.Workspace/Sales.SemanticModel" -o /tmp/exports
    python3 export_semantic_model_as_pbip.py "Sales.Workspace/Sales Model.SemanticModel" -o ./models
        """
    )

    parser.add_argument("path", help="Model path: Workspace.Workspace/Model.SemanticModel")
    parser.add_argument("-o", "--output", required=True, help="Output directory")

    args = parser.parse_args()

    # Parse path
    try:
        workspace, item, display_name = parse_path(args.path)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    full_path = f"{workspace}/{item}"
    output_path = Path(args.output)

    # Get and export definition
    definition = get_model_definition(full_path)
    create_pbip_structure(definition, output_path, display_name)


if __name__ == "__main__":
    main()


#endregion
