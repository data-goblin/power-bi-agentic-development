#!/usr/bin/env python3
"""
Download complete Fabric workspace including items and lakehouse files.

Uses the same path syntax as fab CLI commands.

Usage:
    python3 download_workspace.py "Workspace.Workspace" [output_dir]
    python3 download_workspace.py "Sales.Workspace" ./backup
    python3 download_workspace.py "Production.Workspace" --no-lakehouse-files

Requirements:
    - fab CLI installed and authenticated
    - azure-storage-file-datalake (for lakehouse files)
    - azure-identity
"""

import subprocess
import json
import sys
import argparse
from pathlib import Path
from collections import defaultdict

try:
    from azure.storage.filedatalake import DataLakeServiceClient
    from azure.identity import DefaultAzureCredential
    AZURE_AVAILABLE = True
except ImportError:
    AZURE_AVAILABLE = False


#region Helper Functions


def run_fab_command(args: list) -> str:
    """
    Execute fab CLI command and return output.

    Args:
        args: Command arguments as list

    Returns:
        Command stdout

    Raises:
        subprocess.CalledProcessError if command fails
    """
    result = subprocess.run(
        ["fab"] + args,
        capture_output=True,
        text=True,
        check=True
    )
    return result.stdout.strip()


def parse_workspace_path(path: str) -> str:
    """
    Parse and normalize workspace path.

    Args:
        path: Workspace path (with or without .Workspace)

    Returns:
        Normalized path with .Workspace extension
    """
    if ".Workspace" not in path:
        return f"{path}.Workspace"
    return path


def get_workspace_items(workspace_path: str) -> list:
    """
    Get all items in workspace.

    Args:
        workspace_path: Full workspace path (e.g., "Sales.Workspace")

    Returns:
        List of items with metadata
    """
    output = run_fab_command(["ls", workspace_path, "-l"])

    lines = output.strip().split('\n')
    if len(lines) < 2:
        return []

    items = []
    for line in lines[2:]:
        parts = line.split()
        if len(parts) >= 2:
            item_id = parts[-1]
            display_name = ' '.join(parts[:-1])

            if '.' in display_name:
                name, item_type = display_name.rsplit('.', 1)
            else:
                name = display_name
                item_type = "Unknown"

            items.append({
                "displayName": name,
                "type": item_type,
                "id": item_id
            })

    return items


def export_item(workspace_path: str, item_name: str, item_type: str, output_path: Path) -> bool:
    """
    Export item using fab export.

    Args:
        workspace_path: Workspace path
        item_name: Item display name
        item_type: Item type
        output_path: Output directory

    Returns:
        True if successful
    """
    item_path = f"{workspace_path}/{item_name}.{item_type}"

    try:
        subprocess.run(
            ["fab", "export", item_path, "-o", str(output_path), "-f"],
            capture_output=True,
            text=True,
            check=True,
            timeout=300
        )
        return True
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
        print(f"  Failed to export {item_name}: {e}")
        return False


#endregion


#region Lakehouse Operations


def download_lakehouse_files(workspace_id: str, lakehouse_id: str, lakehouse_name: str, output_dir: Path):
    """
    Download all files from lakehouse using OneLake Storage API.

    Args:
        workspace_id: Workspace GUID
        lakehouse_id: Lakehouse GUID
        lakehouse_name: Lakehouse display name
        output_dir: Output directory for files
    """
    if not AZURE_AVAILABLE:
        print(f"  Skipping lakehouse files (azure-storage-file-datalake not installed)")
        return

    print(f"\n  Downloading lakehouse files from {lakehouse_name}...")

    try:
        account_url = "https://onelake.dfs.fabric.microsoft.com"
        credential = DefaultAzureCredential()
        service_client = DataLakeServiceClient(account_url=account_url, credential=credential)

        fs_client = service_client.get_file_system_client(file_system=workspace_id)
        base_path = f"{lakehouse_id}/Files"

        try:
            paths = fs_client.get_paths(path=base_path, recursive=True)

            file_count = 0
            dir_count = 0

            for path in paths:
                relative_path = path.name[len(base_path)+1:] if len(path.name) > len(base_path) else path.name

                if path.is_directory:
                    local_dir = output_dir / relative_path
                    local_dir.mkdir(parents=True, exist_ok=True)
                    dir_count += 1
                else:
                    local_file = output_dir / relative_path
                    local_file.parent.mkdir(parents=True, exist_ok=True)

                    file_client = fs_client.get_file_client(path.name)

                    with open(local_file, 'wb') as f:
                        download = file_client.download_file()
                        f.write(download.readall())

                    file_count += 1
                    print(f"    {relative_path}")

            print(f"  Downloaded {file_count} files, {dir_count} directories")

        except Exception as e:
            if "404" in str(e) or "PathNotFound" in str(e):
                print(f"  No files found in lakehouse")
            else:
                raise

    except Exception as e:
        print(f"  Error downloading lakehouse files: {e}")


def list_lakehouse_tables(workspace_path: str, lakehouse_name: str) -> list:
    """
    List tables in lakehouse.

    Args:
        workspace_path: Workspace path
        lakehouse_name: Lakehouse name

    Returns:
        List of table names
    """
    try:
        tables_path = f"{workspace_path}/{lakehouse_name}.Lakehouse/Tables"
        output = run_fab_command(["ls", tables_path])

        lines = output.strip().split('\n')
        tables = [line.strip() for line in lines if line.strip() and not line.startswith('---')]

        return tables
    except subprocess.CalledProcessError:
        return []


def export_table_schema(workspace_path: str, lakehouse_name: str, table_name: str, output_file: Path) -> bool:
    """
    Export table schema.

    Args:
        workspace_path: Workspace path
        lakehouse_name: Lakehouse name
        table_name: Table name
        output_file: Output JSON file

    Returns:
        True if successful
    """
    try:
        table_path = f"{workspace_path}/{lakehouse_name}.Lakehouse/Tables/{table_name}"
        schema_output = run_fab_command(["table", "schema", table_path])

        with open(output_file, 'w') as f:
            f.write(schema_output)

        return True
    except subprocess.CalledProcessError as e:
        print(f"    Failed to export schema for {table_name}: {e}")
        return False


#endregion


#region Main Download


def download_workspace(workspace_path: str, output_dir: Path, download_lakehouse_files_flag: bool = True):
    """
    Download complete workspace contents.

    Args:
        workspace_path: Workspace path (e.g., "Sales.Workspace")
        output_dir: Output directory
        download_lakehouse_files_flag: Whether to download lakehouse files
    """
    print(f"Downloading workspace: {workspace_path}")
    print(f"Output directory: {output_dir}")
    print()

    output_dir.mkdir(parents=True, exist_ok=True)

    # Get workspace ID
    print("Getting workspace ID...")
    workspace_id = run_fab_command(["get", workspace_path, "-q", "id"])
    print(f"Workspace ID: {workspace_id}")
    print()

    # Get all items
    print("Discovering workspace items...")
    items = get_workspace_items(workspace_path)

    if not items:
        print("No items found")
        return

    # Group by type
    items_by_type = defaultdict(list)
    for item in items:
        items_by_type[item["type"]].append(item)

    print(f"Found {len(items)} items across {len(items_by_type)} types:")
    for item_type, type_items in sorted(items_by_type.items()):
        print(f"   {item_type}: {len(type_items)}")
    print()

    # Track statistics
    total_success = 0
    total_failed = 0
    lakehouses = []

    # Download items by type
    for item_type, type_items in sorted(items_by_type.items()):
        print(f"Downloading {item_type} items ({len(type_items)})...")

        type_dir = output_dir / item_type
        type_dir.mkdir(parents=True, exist_ok=True)

        for item in type_items:
            item_name = item["displayName"]
            item_id = item["id"]

            print(f"  {item_name}...")

            if item_type == "Lakehouse" and download_lakehouse_files_flag:
                lakehouses.append({
                    "name": item_name,
                    "id": item_id,
                    "output_dir": type_dir / f"{item_name}.Lakehouse"
                })

            success = export_item(workspace_path, item_name, item_type, type_dir)

            if success:
                total_success += 1
                print(f"  Done: {item_name}")
            else:
                total_failed += 1

        print()

    # Download lakehouse files
    if lakehouses and download_lakehouse_files_flag:
        print(f"Downloading lakehouse files ({len(lakehouses)} lakehouses)...")

        for lh in lakehouses:
            lh_files_dir = lh["output_dir"] / "Files"
            lh_files_dir.mkdir(parents=True, exist_ok=True)

            download_lakehouse_files(
                workspace_id=workspace_id,
                lakehouse_id=lh["id"],
                lakehouse_name=lh["name"],
                output_dir=lh_files_dir
            )

            # Export table schemas
            print(f"\n  Exporting table schemas from {lh['name']}...")
            tables = list_lakehouse_tables(workspace_path, lh["name"])

            if tables:
                tables_dir = lh["output_dir"] / "Tables"
                tables_dir.mkdir(parents=True, exist_ok=True)

                for table in tables:
                    schema_file = tables_dir / f"{table}_schema.json"
                    if export_table_schema(workspace_path, lh["name"], table, schema_file):
                        print(f"    {table}")

                print(f"  Exported {len(tables)} table schemas")
            else:
                print(f"  No tables found")

        print()

    # Summary
    print("=" * 60)
    print("Download Summary")
    print("=" * 60)
    print(f"Successfully downloaded: {total_success}")
    print(f"Failed: {total_failed}")
    print(f"Output directory: {output_dir.absolute()}")


#endregion


#region Main


def main():
    parser = argparse.ArgumentParser(
        description="Download complete Fabric workspace",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python3 download_workspace.py "Sales.Workspace"
    python3 download_workspace.py "Production.Workspace" ./backup
    python3 download_workspace.py "dev.Workspace" --no-lakehouse-files
        """
    )

    parser.add_argument("workspace", help="Workspace path: Name.Workspace or just Name")
    parser.add_argument("output_dir", nargs="?", default=None,
                        help="Output directory (default: ./workspace_downloads/<name>)")
    parser.add_argument("--no-lakehouse-files", action="store_true",
                        help="Skip downloading lakehouse files")

    args = parser.parse_args()

    workspace_path = parse_workspace_path(args.workspace)

    # Extract name for default output dir
    workspace_name = workspace_path.replace(".Workspace", "")

    if args.output_dir:
        output_dir = Path(args.output_dir)
    else:
        output_dir = Path("./workspace_downloads") / workspace_name

    try:
        download_workspace(
            workspace_path=workspace_path,
            output_dir=output_dir,
            download_lakehouse_files_flag=not args.no_lakehouse_files
        )
    except KeyboardInterrupt:
        print("\n\nDownload interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()


#endregion
