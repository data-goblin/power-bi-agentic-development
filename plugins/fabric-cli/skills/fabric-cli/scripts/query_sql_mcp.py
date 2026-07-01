#!/usr/bin/env python3
"""
Query a Fabric Lakehouse SQL endpoint, Warehouse, or SQL Database over HTTP via
the hosted Fabric SQL endpoint service (`microsoft.fabric.sqlEndpoint`).

This talks to the same endpoint the `fabric-sql` MCP server uses, but calls it
directly with JSON-RPC and parses the Server-Sent Events response. No MCP client
and no interactive OAuth are needed; it mints a token from the current `az login`
(kept in memory, never written to disk) and sends it as a bearer header. Results
come back as CSV.

Uses the same Fabric path syntax as the other fabric-cli skill scripts.

Usage:
    python3 query_sql_mcp.py "ws.Workspace/LH.Lakehouse" \
        -q "SELECT TOP 10 * FROM dbo.orders"

    python3 query_sql_mcp.py "ws.Workspace/WH.Warehouse" \
        -q "SELECT name FROM sys.tables" --format json

Requirements:
    - fab CLI installed and authenticated (resolves workspace/item GUIDs)
    - az CLI authenticated (`az login`)
"""

import argparse
import json
import subprocess
import sys
import time
import urllib.request
import urllib.error

BASE = "https://api.fabric.microsoft.com/v1/mcp/dataPlane"
TOKEN_RESOURCE = "https://analysis.windows.net/powerbi/api"


#region Helper Functions


def run_fab_command(args: list[str]) -> str:
    """Run a fab CLI command and return stdout, stripped of quotes/whitespace."""
    try:
        result = subprocess.run(
            ["fab"] + args, capture_output=True, text=True, check=True
        )
        return result.stdout.strip().strip('"').strip()
    except subprocess.CalledProcessError as e:
        print(f"Error running fab command: {e.stderr}", file=sys.stderr)
        sys.exit(1)
    except FileNotFoundError:
        print(
            "Error: fab CLI not found. Install from: https://microsoft.github.io/fabric-cli/",
            file=sys.stderr,
        )
        sys.exit(1)


def get_token() -> str:
    """Mint a Fabric access token from the current az login; kept in memory only."""
    try:
        result = subprocess.run(
            ["az", "account", "get-access-token", "--resource", TOKEN_RESOURCE,
             "--query", "accessToken", "-o", "tsv"],
            capture_output=True, text=True, check=True,
        )
        token = result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Error getting az token (run 'az login'): {e.stderr}", file=sys.stderr)
        sys.exit(1)
    except FileNotFoundError:
        print("Error: az CLI not found. Install Azure CLI and run 'az login'.", file=sys.stderr)
        sys.exit(1)
    if not token:
        print("Error: empty token; run 'az login'.", file=sys.stderr)
        sys.exit(1)
    return token


def parse_path(path: str) -> tuple[str, str]:
    """
    Parse a Fabric path into workspace path and item path.

    Args:
        path: Full path like "ws.Workspace/LH.Lakehouse"

    Returns:
        Tuple of (workspace_path, item_path).
    """
    if "/" not in path:
        raise ValueError(f"Invalid path: {path}. Expected: Workspace.Workspace/Item.<Type>")

    workspace, item = path.split("/", 1)
    if ".Workspace" not in workspace:
        workspace = f"{workspace}.Workspace"

    if not any(item.endswith(s) for s in (".Lakehouse", ".Warehouse", ".SQLDatabase")):
        raise ValueError(
            f"Unsupported item type in {item}. Expected .Lakehouse, .Warehouse, or .SQLDatabase."
        )
    return workspace, item


#endregion


#region MCP Call


def execute_query(workspace_id: str, item_id: str, query: str, token: str) -> str:
    """
    POST a JSON-RPC execute_query call to the item-scoped SQL endpoint URL and
    return the CSV result text. The item-scoped URL is used because the global
    URL intermittently fails to activate a cold workspace.

    Args:
        workspace_id: Workspace GUID
        item_id: SQL-capable item GUID (Lakehouse / Warehouse / SQL Database)
        query: T-SQL text
        token: Fabric bearer token

    Returns:
        CSV text of the result set.
    """
    url = f"{BASE}/workspaces/{workspace_id}/items/{item_id}/sqlEndpoint"
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": "execute_query",
            "arguments": {
                "workspaceId": workspace_id,
                "itemId": item_id,
                "query": query,
            },
        },
    }
    data = json.dumps(payload).encode()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    }

    # The endpoint returns a transient "activation parameters" error while a
    # cold workspace warms up; retry a few times before giving up.
    last_error = "unknown error"
    for attempt in range(5):
        req = urllib.request.Request(url, data=data, method="POST", headers=headers)
        try:
            with urllib.request.urlopen(req) as resp:
                body = resp.read().decode()
        except urllib.error.HTTPError as e:
            print(f"HTTP {e.code}: {e.read().decode()}", file=sys.stderr)
            sys.exit(1)

        result = parse_sse(body).get("result", {})
        if not result.get("isError"):
            for part in result.get("content", []):
                if part.get("type") == "resource":
                    return part.get("resource", {}).get("text", "")
            print("No result resource in response.", file=sys.stderr)
            sys.exit(1)

        last_error = result.get("content", [{}])[0].get("text", "unknown error")
        if "activation parameters" not in last_error:
            break
        print(f"Workspace warming up; retrying ({attempt + 1}/5)...", file=sys.stderr)
        time.sleep(4)

    print(f"Query error: {last_error}", file=sys.stderr)
    sys.exit(1)


def parse_sse(body: str) -> dict:
    """
    Parse a Server-Sent Events (or plain JSON) MCP response into the JSON-RPC
    message dict. SSE frames carry the payload on `data:` lines.
    """
    if body.lstrip().startswith("{"):
        return json.loads(body)

    for line in body.splitlines():
        if line.startswith("data:"):
            chunk = line[len("data:"):].strip()
            if chunk:
                return json.loads(chunk)
    raise ValueError(f"No JSON-RPC message found in response:\n{body[:500]}")


#endregion


#region Output


def csv_to_json(csv_text: str) -> str:
    """Convert CSV result text to a JSON array."""
    import csv
    import io

    rows = [r for r in csv.reader(io.StringIO(csv_text)) if r]
    if len(rows) < 2:
        return "[]\n"
    header, *data = rows
    return json.dumps([dict(zip(header, r)) for r in data], indent=2) + "\n"


def csv_to_table(csv_text: str) -> str:
    """Render CSV result text as a pipe-separated aligned table."""
    import csv
    import io

    rows = [r for r in csv.reader(io.StringIO(csv_text)) if r]
    if not rows:
        return "\n"
    widths = [max(len(str(r[i])) for r in rows) for i in range(len(rows[0]))]
    out = []
    for ri, row in enumerate(rows):
        out.append(" | ".join(str(c).ljust(widths[i]) for i, c in enumerate(row)))
        if ri == 0:
            out.append("-+-".join("-" * w for w in widths))
    return "\n".join(out) + "\n"


#endregion


#region Main


def main():
    parser = argparse.ArgumentParser(
        description="Query a Fabric SQL endpoint over HTTP via the hosted sqlEndpoint service",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Inline query against a lakehouse SQL endpoint (table output)
    python3 query_sql_mcp.py "ws.Workspace/LH.Lakehouse" \\
        -q "SELECT TOP 10 * FROM dbo.orders"

    # Warehouse, JSON output saved to file
    python3 query_sql_mcp.py "ws.Workspace/WH.Warehouse" \\
        -q "SELECT name FROM sys.tables" --format json -o tables.json
        """,
    )
    parser.add_argument(
        "path", help="SQL-capable item path: Workspace.Workspace/Item.Lakehouse|Warehouse|SQLDatabase"
    )
    parser.add_argument("-q", "--query", required=True, help="Inline T-SQL query to execute")
    parser.add_argument("-o", "--output", help="Output file path (default: stdout)")
    parser.add_argument("--format", choices=["table", "csv", "json"], default="table",
                        help="Output format (default: table)")
    args = parser.parse_args()

    try:
        workspace, item = parse_path(args.path)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    full_path = f"{workspace}/{item}"
    print(f"Resolving: {full_path}...", file=sys.stderr)
    workspace_id = run_fab_command(["get", workspace, "-q", "id"])
    item_id = run_fab_command(["get", full_path, "-q", "id"])

    print(f"Querying {item} via sqlEndpoint service...", file=sys.stderr)
    csv_text = execute_query(workspace_id, item_id, args.query, get_token())

    if args.format == "json":
        output = csv_to_json(csv_text)
    elif args.format == "table":
        output = csv_to_table(csv_text)
    else:
        output = csv_text if csv_text.endswith("\n") else csv_text + "\n"

    if args.output:
        with open(args.output, "w") as f:
            f.write(output)
        print(f"\nResults saved to: {args.output}", file=sys.stderr)
    else:
        print(output, end="")


if __name__ == "__main__":
    main()


#endregion
