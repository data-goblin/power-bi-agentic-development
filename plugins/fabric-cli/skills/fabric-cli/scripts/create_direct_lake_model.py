#!/usr/bin/env python3
"""
Create a Direct Lake semantic model from lakehouse tables.

Usage:
    python3 create_direct_lake_model.py "src.Workspace/LH.Lakehouse" "dest.Workspace/Model.SemanticModel" -t schema.table

Requirements:
    - fab CLI installed and authenticated
"""

import argparse
import json
import subprocess
import sys
import uuid
import tempfile
from pathlib import Path


def run_fab(args: list[str]) -> str:
    """Run fab command and return output."""
    result = subprocess.run(["fab"] + args, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"fab error: {result.stderr}", file=sys.stderr)
    return result.stdout.strip()


def get_lakehouse_sql_endpoint(workspace: str, lakehouse: str) -> dict:
    """Get lakehouse SQL endpoint info."""
    path = f"{workspace}/{lakehouse}"
    output = run_fab(["get", path, "-q", "properties.sqlEndpointProperties"])
    return json.loads(output)


def get_table_schema(workspace: str, lakehouse: str, schema: str, table: str) -> list:
    """Get table schema from lakehouse (parses text output)."""
    path = f"{workspace}/{lakehouse}/Tables/{schema}/{table}"
    output = run_fab(["table", "schema", path])

    # Parse text table format:
    # name                            type
    # ------------------------------------------
    # col_name                        col_type
    columns = []
    in_data = False
    for line in output.split("\n"):
        line = line.strip()
        if line.startswith("---"):
            in_data = True
            continue
        if in_data and line:
            parts = line.split()
            if len(parts) >= 2:
                columns.append({"name": parts[0], "type": parts[1]})
    return columns


def tmdl_data_type(sql_type: str) -> str:
    """Convert SQL type to TMDL data type."""
    sql_type = sql_type.lower()
    if 'int' in sql_type:
        return 'int64'
    elif 'float' in sql_type or 'double' in sql_type or 'decimal' in sql_type:
        return 'double'
    elif 'bool' in sql_type or 'bit' in sql_type:
        return 'boolean'
    elif 'date' in sql_type or 'time' in sql_type:
        return 'dateTime'
    else:
        return 'string'


def create_model_tmdl(model_name: str, table_name: str) -> str:
    """Create model.tmdl content."""
    return f"""model '{model_name}'
\tculture: en-US
\tdefaultPowerBIDataSourceVersion: powerBI_V3

ref table '{table_name}'
"""


def create_expressions_tmdl(connection_string: str, endpoint_id: str) -> str:
    """Create expressions.tmdl content."""
    return f"""expression DatabaseQuery =
\t\tlet
\t\t\tdatabase = Sql.Database("{connection_string}", "{endpoint_id}")
\t\tin
\t\t\tdatabase
\tlineageTag: {uuid.uuid4()}
"""


def create_table_tmdl(table_name: str, schema_name: str, columns: list) -> str:
    """Create table.tmdl content."""
    lines = [
        f"table '{table_name}'",
        f"\tlineageTag: {uuid.uuid4()}",
        f"\tsourceLineageTag: [{schema_name}].[{table_name}]",
        ""
    ]

    # Add columns
    for col in columns:
        col_name = col['name']
        data_type = tmdl_data_type(col['type'])
        lines.extend([
            f"\tcolumn '{col_name}'",
            f"\t\tdataType: {data_type}",
            f"\t\tlineageTag: {uuid.uuid4()}",
            f"\t\tsourceLineageTag: {col_name}",
            f"\t\tsummarizeBy: none",
            f"\t\tsourceColumn: {col_name}",
            "",
            f"\t\tannotation SummarizationSetBy = Automatic",
            ""
        ])

    # Add partition
    lines.extend([
        f"\tpartition '{table_name}' = entity",
        f"\t\tmode: directLake",
        f"\t\tsource",
        f"\t\t\tentityName: {table_name}",
        f"\t\t\tschemaName: {schema_name}",
        f"\t\t\texpressionSource: DatabaseQuery",
        ""
    ])

    return "\n".join(lines)


def create_database_tmdl() -> str:
    """Create database.tmdl content."""
    return f"""database '{uuid.uuid4()}'
"""


def create_pbism() -> str:
    """Create definition.pbism content."""
    return json.dumps({
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/semanticModel/definitionProperties/1.0.0/schema.json",
        "version": "4.0",
        "settings": {}
    }, indent=2)


def create_platform(model_name: str) -> str:
    """Create .platform content."""
    return json.dumps({
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
        "metadata": {
            "type": "SemanticModel",
            "displayName": model_name
        },
        "config": {
            "version": "2.0",
            "logicalId": str(uuid.uuid4())
        }
    }, indent=2)


def main():
    parser = argparse.ArgumentParser(description="Create Direct Lake semantic model")
    parser.add_argument("source", help="Source: Workspace.Workspace/Lakehouse.Lakehouse")
    parser.add_argument("dest", help="Destination: Workspace.Workspace/Model.SemanticModel")
    parser.add_argument("-t", "--table", required=True, help="Table: schema.table_name")
    args = parser.parse_args()

    # Parse source
    src_parts = args.source.split("/")
    src_workspace = src_parts[0]
    src_lakehouse = src_parts[1].replace(".Lakehouse", "") + ".Lakehouse"

    # Parse destination
    dest_parts = args.dest.split("/")
    dest_workspace = dest_parts[0]
    model_name = dest_parts[1].replace(".SemanticModel", "")

    # Parse table
    table_parts = args.table.split(".")
    schema_name = table_parts[0]
    table_name = table_parts[1]

    print(f"Source: {src_workspace}/{src_lakehouse}")
    print(f"Table: {schema_name}.{table_name}")
    print(f"Dest: {dest_workspace}/{model_name}.SemanticModel")

    # Get SQL endpoint
    print("\nGetting SQL endpoint...")
    endpoint = get_lakehouse_sql_endpoint(src_workspace, src_lakehouse)
    print(f"  Connection: {endpoint['connectionString']}")
    print(f"  ID: {endpoint['id']}")

    # Get table schema
    print(f"\nGetting table schema for {schema_name}.{table_name}...")
    columns = get_table_schema(src_workspace, src_lakehouse, schema_name, table_name)
    print(f"  Found {len(columns)} columns")

    # Create temp directory with TMDL
    with tempfile.TemporaryDirectory() as tmpdir:
        model_dir = Path(tmpdir) / f"{model_name}.SemanticModel"
        def_dir = model_dir / "definition"
        tables_dir = def_dir / "tables"

        model_dir.mkdir()
        def_dir.mkdir()
        tables_dir.mkdir()

        # Write files
        print("\nCreating TMDL files...")

        (model_dir / ".platform").write_text(create_platform(model_name))
        (model_dir / "definition.pbism").write_text(create_pbism())
        (def_dir / "model.tmdl").write_text(create_model_tmdl(model_name, table_name))
        (def_dir / "database.tmdl").write_text(create_database_tmdl())
        (def_dir / "expressions.tmdl").write_text(
            create_expressions_tmdl(endpoint['connectionString'], endpoint['id'])
        )
        (tables_dir / f"{table_name}.tmdl").write_text(
            create_table_tmdl(table_name, schema_name, columns)
        )

        print(f"  Created: {model_dir}")
        for f in model_dir.rglob("*"):
            if f.is_file():
                print(f"    {f.relative_to(model_dir)}")

        # Import to Fabric
        print(f"\nImporting to {dest_workspace}...")
        dest_path = f"{dest_workspace}/{model_name}.SemanticModel"
        result = run_fab(["import", dest_path, "-i", str(model_dir), "-f"])
        print(result)

    print("\nDone!")


if __name__ == "__main__":
    main()
