#!/usr/bin/env python3
"""
Execute DAX queries against Fabric semantic models.

Uses the same path syntax as fab CLI commands.

Usage:
    python3 execute_dax.py "Workspace.Workspace/Model.SemanticModel" -q "EVALUATE VALUES(Date[Year])"
    python3 execute_dax.py "Sales.Workspace/Sales Model.SemanticModel" -q "EVALUATE TOPN(5, 'Orders')"

Requirements:
    - fab CLI installed and authenticated
"""

import argparse
import json
import subprocess
import sys
import re


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


def parse_path(path: str) -> tuple[str, str]:
    """
    Parse Fabric path into workspace and item components.

    Args:
        path: Full path like "Workspace.Workspace/Model.SemanticModel"

    Returns:
        Tuple of (workspace_path, item_path)

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

    if ".SemanticModel" not in item:
        item = f"{item}.SemanticModel"

    return workspace, item


def get_id(path: str) -> str:
    """
    Get ID for a Fabric path.

    Args:
        path: Fabric path

    Returns:
        Item ID as string
    """
    output = run_fab_command(["get", path, "-q", "id"])
    return output.strip('"')


#endregion


#region DAX Execution


def execute_dax_query(workspace_id: str, dataset_id: str, query: str, include_nulls: bool = False) -> dict:
    """
    Execute DAX query against semantic model using Fabric CLI.

    Uses Power BI API via fab CLI: fab api -A powerbi

    Args:
        workspace_id: Workspace GUID
        dataset_id: Semantic model GUID
        query: DAX query string
        include_nulls: Whether to include null values in results

    Returns:
        Query results as dict
    """
    payload = {
        "queries": [{"query": query}],
        "serializerSettings": {"includeNulls": include_nulls}
    }

    endpoint = f"groups/{workspace_id}/datasets/{dataset_id}/executeQueries"

    output = run_fab_command([
        "api",
        "-A", "powerbi",
        "-X", "post",
        endpoint,
        "-i", json.dumps(payload)
    ])

    return json.loads(output)


#endregion


#region Output Formatting


def format_results_as_table(results: dict) -> str:
    """Format query results as ASCII table."""
    output_lines = []

    if "text" in results:
        data = results["text"]
    else:
        data = results

    for result_set in data.get("results", []):
        tables = result_set.get("tables", [])

        for table in tables:
            rows = table.get("rows", [])

            if not rows:
                output_lines.append("(No rows returned)")
                continue

            columns = list(rows[0].keys())

            widths = {col: len(col) for col in columns}
            for row in rows:
                for col in columns:
                    value_str = str(row.get(col, ""))
                    widths[col] = max(widths[col], len(value_str))

            header = " | ".join(col.ljust(widths[col]) for col in columns)
            output_lines.append(header)
            output_lines.append("-" * len(header))

            for row in rows:
                row_str = " | ".join(str(row.get(col, "")).ljust(widths[col]) for col in columns)
                output_lines.append(row_str)

            output_lines.append("")
            output_lines.append(f"({len(rows)} row(s) returned)")

    return "\n".join(output_lines)


def format_results_as_csv(results: dict) -> str:
    """Format query results as CSV."""
    import csv
    import io

    output = io.StringIO()

    if "text" in results:
        data = results["text"]
    else:
        data = results

    for result_set in data.get("results", []):
        tables = result_set.get("tables", [])

        for table in tables:
            rows = table.get("rows", [])

            if rows:
                columns = list(rows[0].keys())

                writer = csv.DictWriter(output, fieldnames=columns)
                writer.writeheader()
                writer.writerows(rows)

    return output.getvalue()


#endregion


#region Main


def main():
    parser = argparse.ArgumentParser(
        description="Execute DAX query against Fabric semantic model",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python3 execute_dax.py "Sales.Workspace/Sales Model.SemanticModel" -q "EVALUATE VALUES('Date'[Year])"
    python3 execute_dax.py "Production.Workspace/Sales.SemanticModel" -q "EVALUATE TOPN(10, 'Sales')" --format csv
    python3 execute_dax.py "ws.Workspace/Model.SemanticModel" -q "EVALUATE ROW(\\"Total\\", SUM('Sales'[Amount]))"

DAX Requirements:
    - EVALUATE is mandatory - all queries must start with EVALUATE
    - Use single quotes for table names: 'Sales', 'Date'
    - Qualify columns: 'Sales'[Amount], not just [Amount]
        """
    )

    parser.add_argument("path", help="Model path: Workspace.Workspace/Model.SemanticModel")
    parser.add_argument("-q", "--query", required=True, help="DAX query to execute")
    parser.add_argument("-o", "--output", help="Output file path")
    parser.add_argument("--format", choices=["json", "csv", "table"], default="table",
                        help="Output format (default: table)")
    parser.add_argument("--include-nulls", action="store_true",
                        help="Include null values in results")

    args = parser.parse_args()

    # Parse path
    try:
        workspace, model = parse_path(args.path)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    # Get IDs
    print(f"Resolving: {workspace}...", file=sys.stderr)
    workspace_id = get_id(workspace)

    full_path = f"{workspace}/{model}"
    print(f"Resolving: {full_path}...", file=sys.stderr)
    model_id = get_id(full_path)

    # Execute query
    print(f"Executing DAX query...", file=sys.stderr)
    results = execute_dax_query(workspace_id, model_id, args.query, args.include_nulls)

    # Format results
    if args.format == "json":
        formatted_output = json.dumps(results, indent=2)
    elif args.format == "csv":
        formatted_output = format_results_as_csv(results)
    else:
        formatted_output = format_results_as_table(results)

    # Output results
    if args.output:
        with open(args.output, 'w') as f:
            f.write(formatted_output)
        print(f"\nResults saved to: {args.output}", file=sys.stderr)
    else:
        print(formatted_output)


if __name__ == "__main__":
    main()


#endregion
