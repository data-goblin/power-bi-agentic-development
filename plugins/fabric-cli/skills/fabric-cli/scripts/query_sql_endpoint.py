#!/usr/bin/env python3
"""
Query a Fabric Lakehouse SQL endpoint, Warehouse, or SQL Database via `sqlcmd`.

Resolves the SQL host via `fab get` based on item type, then invokes `sqlcmd`
with `ActiveDirectoryAzCli` authentication so the current `az login` session is
reused. No password, SPN secret, or token file is needed.

Uses the same Fabric path syntax as other fabric-cli skill scripts.

Usage:
    python3 query_sql_endpoint.py "ws.Workspace/LH.Lakehouse" \
        -q "SELECT TOP 10 * FROM dbo.orders"

    python3 query_sql_endpoint.py "ws.Workspace/WH.Warehouse" \
        -q "SELECT name FROM sys.tables"

    python3 query_sql_endpoint.py "ws.Workspace/SQLDB.SQLDatabase" \
        --file ./analysis.sql --format csv -o results.csv

Requirements:
    - fab CLI installed and authenticated
    - sqlcmd (go-sqlcmd) v1.9+ installed
    - az CLI authenticated (`az login`)
"""

import argparse
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


def parse_path(path: str) -> tuple[str, str, str, str]:
    """
    Parse a Fabric path into workspace, item, item type, and default database name.

    Args:
        path: Full path like "ws.Workspace/LH.Lakehouse"

    Returns:
        Tuple of (workspace_path, item_path, item_type, default_db_name) where
        item_type is "Lakehouse", "Warehouse", or "SQLDatabase". default_db_name
        is the item's display name without the type extension.
    """
    if "/" not in path:
        raise ValueError(
            f"Invalid path: {path}. Expected: Workspace.Workspace/Item.<Type>"
        )

    workspace, item = path.split("/", 1)

    if ".Workspace" not in workspace:
        workspace = f"{workspace}.Workspace"

    supported_types = {
        ".Lakehouse":   "Lakehouse",
        ".Warehouse":   "Warehouse",
        ".SQLDatabase": "SQLDatabase",
    }

    for suffix, item_type in supported_types.items():
        if item.endswith(suffix):
            default_db_name = item[: -len(suffix)]
            return workspace, item, item_type, default_db_name

    raise ValueError(
        f"Unsupported item type in {item}. Expected .Lakehouse, .Warehouse, or .SQLDatabase."
    )


def resolve_sql_host(item_path: str, item_type: str) -> str:
    """
    Resolve the SQL endpoint host for an item via `fab get`. Each item type
    stores the host under a different property path.

    Args:
        item_path: Full Fabric path e.g. "ws.Workspace/LH.Lakehouse"
        item_type: "Lakehouse", "Warehouse", or "SQLDatabase"

    Returns:
        SQL host as a string (e.g. "<id>.datawarehouse.fabric.microsoft.com")
    """
    property_map = {
        "Lakehouse":   "properties.sqlEndpointProperties.connectionString",
        "Warehouse":   "properties.connectionString",
        "SQLDatabase": "properties.serverFqdn",
    }

    query = property_map[item_type]
    output = run_fab_command(["get", item_path, "-q", query])
    return output.strip('"')


#endregion


#region sqlcmd Execution


def build_sqlcmd_args(
    host: str,
    database: str,
    output_format: str,
    query: str | None,
    query_file: str | None,
) -> list[str]:
    """
    Build the sqlcmd argument list.

    Args:
        host: SQL endpoint host
        database: Database name to pass as -d
        output_format: "table", "csv", or "json" (json is emulated via CSV + jq)
        query: Inline SQL string (passed with -Q) or None
        query_file: Path to a .sql file (passed with -i) or None

    Returns:
        List of arguments for subprocess.run
    """
    args = [
        "sqlcmd",
        "-S", host,
        "-d", database,
        "--authentication-method", "ActiveDirectoryAzCli",
        "-W",                 # strip trailing whitespace (critical for readability)
        "-b",                 # exit non-zero on T-SQL error
    ]

    if output_format in ("csv", "json"):
        # JSON is emitted via CSV + csv_to_json, so both need the comma separator.
        args += ["-s", ",", "-m", "11"]
    else:
        args += ["-s", "|"]

    if query_file:
        args += ["-i", query_file]
    elif query:
        args += ["-Q", query]

    return args


def run_sqlcmd(
    host: str,
    database: str,
    output_format: str,
    query: str | None,
    query_file: str | None,
) -> str:
    """
    Run sqlcmd and return stdout. For CSV/JSON formats, strip the trailing
    Fabric footer (Statement ID / Query hash / Distributed request ID) and
    the "(N rows affected)" line.

    Args:
        host: SQL endpoint host
        database: Database name
        output_format: "table", "csv", or "json"
        query: Inline SQL string or None
        query_file: .sql file path or None

    Returns:
        Cleaned command stdout
    """
    args = build_sqlcmd_args(host, database, output_format, query, query_file)

    try:
        result = subprocess.run(args, capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as e:
        print(f"sqlcmd error:\n{e.stderr or e.stdout}", file=sys.stderr)
        sys.exit(1)
    except FileNotFoundError:
        print(
            "Error: sqlcmd not found. Install go-sqlcmd: "
            "brew install sqlcmd  OR  winget install --id Microsoft.Sqlcmd",
            file=sys.stderr,
        )
        sys.exit(1)

    output = result.stdout

    if output_format in ("csv", "json"):
        output = strip_fabric_footer(output)

    if output_format == "json":
        output = csv_to_json(output)

    return output


def strip_fabric_footer(raw: str) -> str:
    """
    Remove the `Statement ID: ... | Query hash: ... | Distributed request ID: ...`
    footer, the `(N rows affected)` line, and the dashes-only separator row
    that sqlcmd prints between the header and data rows. Useful when piping
    CSV or JSON to another tool.
    """
    import re

    separator_pattern = re.compile(r"^[-,|\s]+$")

    lines = []
    for line in raw.split("\n"):
        if line.startswith("Statement ID:"):
            continue
        if line.endswith("rows affected)") or line.endswith("row affected)"):
            continue
        if line and separator_pattern.match(line) and "-" in line:
            continue
        lines.append(line)
    return "\n".join(lines).rstrip("\n") + "\n"


def csv_to_json(csv_text: str) -> str:
    """
    Convert sqlcmd CSV output to a JSON array. sqlcmd does not emit JSON
    natively, so we reuse the CSV path and transform. `-h -1` suppresses the
    repeating header, so row 0 is the column names.
    """
    import csv
    import io
    import json

    reader = csv.reader(io.StringIO(csv_text))
    rows = [row for row in reader if row]

    if len(rows) < 2:
        return "[]\n"

    header, *data = rows
    return json.dumps([dict(zip(header, r)) for r in data], indent=2) + "\n"


#endregion


#region Main


def main():
    parser = argparse.ArgumentParser(
        description="Query a Fabric Lakehouse SQL endpoint, Warehouse, or SQL Database via sqlcmd",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Inline query against a lakehouse SQL endpoint
    python3 query_sql_endpoint.py "ws.Workspace/LH.Lakehouse" \\
        -q "SELECT TOP 10 * FROM dbo.orders"

    # Query a warehouse, csv output, save to file
    python3 query_sql_endpoint.py "ws.Workspace/WH.Warehouse" \\
        -q "SELECT name FROM sys.tables" --format csv -o tables.csv

    # Multi-statement .sql file against a SQL database
    python3 query_sql_endpoint.py "ws.Workspace/MyDB.SQLDatabase" \\
        --file ./migration.sql

    # JSON output for piping
    python3 query_sql_endpoint.py "ws.Workspace/LH.Lakehouse" \\
        -q "SELECT TOP 3 Territory, Region FROM dbo.regions" --format json
        """,
    )

    parser.add_argument(
        "path", help="SQL-capable item path: Workspace.Workspace/Item.Lakehouse|Warehouse|SQLDatabase"
    )
    parser.add_argument("-q", "--query", help="Inline T-SQL query to execute")
    parser.add_argument("--file", dest="query_file", help="Path to a .sql file to execute")
    parser.add_argument("-d", "--database",
                        help="Override database name (defaults to item display name)")
    parser.add_argument("-o", "--output", help="Output file path (default: stdout)")
    parser.add_argument("--format", choices=["table", "csv", "json"], default="table",
                        help="Output format (default: table)")
    parser.add_argument("--print-host", action="store_true",
                        help="Print the resolved SQL host and exit")

    args = parser.parse_args()

    if not args.query and not args.query_file and not args.print_host:
        parser.error("one of -q/--query, --file, or --print-host is required")

    # Resolve item
    try:
        workspace, item, item_type, default_db = parse_path(args.path)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    full_path = f"{workspace}/{item}"
    print(f"Resolving: {full_path}...", file=sys.stderr)
    host = resolve_sql_host(full_path, item_type)

    if args.print_host:
        print(host)
        return

    database = args.database or default_db

    print(f"Querying {item_type} ({host}) as database '{database}'...", file=sys.stderr)
    output = run_sqlcmd(host, database, args.format, args.query, args.query_file)

    if args.output:
        with open(args.output, "w") as f:
            f.write(output)
        print(f"\nResults saved to: {args.output}", file=sys.stderr)
    else:
        print(output, end="" if output.endswith("\n") else "\n")


if __name__ == "__main__":
    main()


#endregion
