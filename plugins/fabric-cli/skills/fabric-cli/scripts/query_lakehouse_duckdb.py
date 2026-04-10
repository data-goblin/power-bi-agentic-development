#!/usr/bin/env python3
"""
Query Delta tables in a Fabric Lakehouse or Warehouse via DuckDB against OneLake.

Resolves workspace and item IDs via `fab`, builds the abfss:// OneLake path, and
shells out to `duckdb` with the `delta` and `azure` extensions preloaded. Reuses
the current `az login` session via the `credential_chain` provider so no password,
SPN secret, or token file is ever needed.

Uses the same Fabric path syntax as other fabric-cli skill scripts.

Usage:
    python3 query_lakehouse_duckdb.py "ws.Workspace/LH.Lakehouse" \
        -q "SELECT * FROM tbl LIMIT 10" -t regions_parq_table

    python3 query_lakehouse_duckdb.py "ws.Workspace/LH.Lakehouse" \
        -q "SELECT count(*) FROM tbl" -t gold.orders

    python3 query_lakehouse_duckdb.py "ws.Workspace/LH.Lakehouse" \
        --sql "SELECT count(*) FROM delta_scan('abfss://...') "

Requirements:
    - fab CLI installed and authenticated
    - duckdb >= 1.0 installed (brew install duckdb / winget install DuckDB.cli)
    - az CLI authenticated (`az login`)
"""

import argparse
import json
import subprocess
import sys


#region Helper Functions


def run_fab_command(args: list[str]) -> str:
    """Run fab CLI command and return stdout as string; exit on failure."""
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
    Parse a Fabric path into workspace, item, and item type.

    Args:
        path: Full path like "ws.Workspace/LH.Lakehouse" or "ws.Workspace/WH.Warehouse"

    Returns:
        Tuple of (workspace_path, item_path, item_type) where item_type is
        "Lakehouse" or "Warehouse".
    """
    if "/" not in path:
        raise ValueError(f"Invalid path: {path}. Expected: Workspace.Workspace/Item.Lakehouse")

    workspace, item = path.split("/", 1)

    if ".Workspace" not in workspace:
        workspace = f"{workspace}.Workspace"

    if item.endswith(".Lakehouse"):
        item_type = "Lakehouse"
    elif item.endswith(".Warehouse"):
        item_type = "Warehouse"
    else:
        raise ValueError(
            f"Unsupported item type in {item}. Expected .Lakehouse or .Warehouse."
        )

    return workspace, item, item_type


def get_id(path: str) -> str:
    """Get the GUID for a Fabric path via `fab get -q id`."""
    output = run_fab_command(["get", path, "-q", "id"])
    return output.strip('"')


#endregion


#region DuckDB Execution


def build_delta_path(workspace_id: str, item_id: str, table: str | None) -> str:
    """
    Build an abfss:// OneLake path for a Delta table.

    Args:
        workspace_id: Workspace GUID
        item_id: Lakehouse or Warehouse GUID
        table: Table name in "schema.table" or "table" format, or None
               (caller will substitute the full path themselves)

    Returns:
        Fully-qualified abfss:// path
    """
    base = f"abfss://{workspace_id}@onelake.dfs.fabric.microsoft.com/{item_id}/Tables"

    if table is None:
        return base

    return f"{base}/{table.replace('.', '/')}"


def build_duckdb_script(query: str, delta_path: str | None) -> str:
    """
    Wrap a user query in the required LOAD / SECRET / delta_scan preamble.

    If delta_path is given, substitutes `tbl` in the query with a delta_scan()
    call. If delta_path is None, passes the query through unchanged (caller
    is expected to use --sql with fully-qualified delta_scan() references).
    """
    preamble = (
        "LOAD delta; LOAD azure; "
        "CREATE SECRET (TYPE azure, PROVIDER credential_chain, CHAIN 'cli'); "
    )

    if delta_path is not None:
        expanded = query.replace("tbl", f"delta_scan('{delta_path}')")
        return preamble + expanded

    return preamble + query


def strip_preamble_noise(raw: str, output_format: str) -> str:
    """
    Remove the Success result emitted by CREATE SECRET so callers only see the
    actual query output. DuckDB's CLI always prints a Success row for DDL, which
    is pure noise for a single-query wrapper.

    Args:
        raw: Raw duckdb stdout
        output_format: "table", "csv", or "json"

    Returns:
        Cleaned output with the preamble's Success row removed
    """
    if output_format == "csv":
        # CSV: first two lines are "Success\n" and "true\n"; drop them and
        # any trailing blank line between the two result sets.
        lines = raw.split("\n")
        return "\n".join(lines[2:]).lstrip("\n")

    if output_format == "json":
        # JSON: two separate arrays on separate lines; drop the first.
        lines = [ln for ln in raw.split("\n") if ln.strip()]
        return lines[-1] if lines else ""

    # Box mode: strip everything through the first "└...┘" bottom border,
    # which closes the Success box. The real result follows immediately.
    lines = raw.split("\n")
    for i, line in enumerate(lines):
        if line.startswith("└"):
            return "\n".join(lines[i + 1 :])
    return raw


def run_duckdb(script: str, output_format: str) -> str:
    """
    Run a DuckDB script and return cleaned stdout.

    Args:
        script: Full DuckDB SQL script (including LOAD / SECRET statements)
        output_format: One of "table", "csv", "json"

    Returns:
        Command stdout, with the CREATE SECRET preamble row stripped
    """
    format_flag = {
        "table": ["-box"],
        "csv":   ["-csv"],
        "json":  ["-json"],
    }[output_format]

    try:
        result = subprocess.run(
            ["duckdb", *format_flag, "-c", script],
            capture_output=True,
            text=True,
            check=True
        )
        return strip_preamble_noise(result.stdout, output_format)
    except subprocess.CalledProcessError as e:
        print(f"DuckDB error:\n{e.stderr}", file=sys.stderr)
        sys.exit(1)
    except FileNotFoundError:
        print("Error: duckdb CLI not found. Install with: brew install duckdb", file=sys.stderr)
        sys.exit(1)


#endregion


#region Main


def main():
    parser = argparse.ArgumentParser(
        description="Query Delta tables in a Fabric Lakehouse or Warehouse via DuckDB",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Query a table in the default schema (substitutes `tbl` with delta_scan)
    python3 query_lakehouse_duckdb.py "ws.Workspace/LH.Lakehouse" \\
        -q "SELECT * FROM tbl LIMIT 10" -t regions_parq_table

    # Query a table in a named schema
    python3 query_lakehouse_duckdb.py "ws.Workspace/LH.Lakehouse" \\
        -q "SELECT count(*) FROM tbl" -t gold.orders

    # Pass a raw SQL script with your own delta_scan() calls (multi-table joins)
    python3 query_lakehouse_duckdb.py "ws.Workspace/LH.Lakehouse" \\
        --sql "SELECT a.id FROM delta_scan('abfss://.../Tables/gold/orders') a"

    # CSV output, save to file
    python3 query_lakehouse_duckdb.py "ws.Workspace/LH.Lakehouse" \\
        -q "SELECT * FROM tbl" -t gold.orders --format csv -o orders.csv
        """
    )

    parser.add_argument("path", help="Lakehouse or Warehouse path: Workspace.Workspace/Item.Lakehouse")
    parser.add_argument("-q", "--query", help="SQL query; use `tbl` as a placeholder for the table (requires -t)")
    parser.add_argument("--sql", help="Raw SQL script with your own delta_scan() calls; ignores -t")
    parser.add_argument("-t", "--table", help="Table name: schema.table or just table (for default schema)")
    parser.add_argument("-o", "--output", help="Output file path (default: stdout)")
    parser.add_argument("--format", choices=["table", "csv", "json"], default="table",
                        help="Output format (default: table)")
    parser.add_argument("--print-path", action="store_true",
                        help="Print the resolved abfss:// path and exit")

    args = parser.parse_args()

    if not args.query and not args.sql and not args.print_path:
        parser.error("one of -q/--query, --sql, or --print-path is required")
    if args.query and not args.table:
        parser.error("-q/--query requires -t/--table (use --sql for raw multi-table queries)")

    # Resolve IDs
    try:
        workspace, item, item_type = parse_path(args.path)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"Resolving: {workspace}...", file=sys.stderr)
    workspace_id = get_id(workspace)

    full_path = f"{workspace}/{item}"
    print(f"Resolving: {full_path}...", file=sys.stderr)
    item_id = get_id(full_path)

    delta_path = build_delta_path(workspace_id, item_id, args.table) if args.table else None

    if args.print_path:
        print(delta_path or build_delta_path(workspace_id, item_id, None))
        return

    # Build and execute the DuckDB script
    if args.sql:
        script = build_duckdb_script(args.sql, delta_path=None)
    else:
        script = build_duckdb_script(args.query, delta_path=delta_path)

    print(f"Querying {item_type} via DuckDB...", file=sys.stderr)
    output = run_duckdb(script, args.format)

    if args.output:
        with open(args.output, 'w') as f:
            f.write(output)
        print(f"\nResults saved to: {args.output}", file=sys.stderr)
    else:
        print(output)


if __name__ == "__main__":
    main()


#endregion
