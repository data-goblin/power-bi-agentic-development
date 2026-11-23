"""Execute a Power Query M expression via the Fabric executeQuery API.

Sends a custom M section document to a runner dataflow and returns the result
as a pandas DataFrame. Handles Arrow response parsing and error detection.

Requires:
    - pyarrow (uv run --with pyarrow)
    - az CLI authenticated (az login)
    - A runner dataflow with data source connections bound

Usage:
    uv run --with pyarrow python3 execute_m.py \
        --workspace <workspace-id> \
        --dataflow <dataflow-id> \
        --mashup 'section Section1; shared Result = #table({"A"}, {{"hello"}});'

    # Or pipe mashup from stdin:
    echo 'section Section1; shared Result = ...' | \
        uv run --with pyarrow python3 execute_m.py -w <ws-id> -d <df-id> --stdin

    # Output to CSV:
    uv run --with pyarrow python3 execute_m.py -w <ws-id> -d <df-id> \
        --mashup '...' --output result.csv
"""


# region Imports

import argparse
import io
import json
import subprocess
import sys
import urllib.request
import urllib.error

import pyarrow.ipc as ipc

# endregion


# region Functions

def get_token():
    """Get a Fabric API access token from az CLI.

    Returns the access token string.
    Raises RuntimeError if az CLI is not authenticated.
    """

    result = subprocess.run(
        ["az", "account", "get-access-token",
         "--resource", "https://api.fabric.microsoft.com",
         "--query", "accessToken", "-o", "tsv"],
        capture_output=True, text=True
    )

    if result.returncode != 0:
        raise RuntimeError(f"az CLI error: {result.stderr.strip()}")

    return result.stdout.strip()


def execute_m(ws_id, df_id, token, mashup, query_name="Result"):
    """Execute an M section document and return a pandas DataFrame.

    Args:
        ws_id: Workspace GUID
        df_id: Dataflow GUID (the runner)
        token: Bearer token from az CLI
        mashup: Full M section document string
        query_name: Name of the shared query to execute

    Returns:
        pandas DataFrame with results, or None on error
    """

    url = (
        f"https://api.fabric.microsoft.com/v1/workspaces/{ws_id}"
        f"/dataflows/{df_id}/executeQuery"
    )

    body = json.dumps({
        "queryName": query_name,
        "customMashupDocument": mashup
    }).encode()

    req = urllib.request.Request(url, data=body, method="POST", headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    })

    try:
        resp = urllib.request.urlopen(req, timeout=95)
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()[:500]
        print(f"HTTP {e.code}: {error_body}", file=sys.stderr)
        return None

    content_type = resp.headers.get("Content-Type", "")

    if "arrow" not in content_type:
        print(f"Unexpected response type: {content_type}", file=sys.stderr)
        return None

    table = ipc.open_stream(io.BytesIO(resp.read())).read_all()
    df = table.to_pandas()

    # Check for mashup engine errors in metadata column
    if "PQ Arrow Metadata" in df.columns:
        meta = df["PQ Arrow Metadata"].dropna()

        if len(meta) > 0 and len(df.columns) == 1:
            error = json.loads(meta.iloc[0])
            print(f"M engine error: {error.get('Error', error)}", file=sys.stderr)
            return None

        df = df.drop(columns=["PQ Arrow Metadata"])

    return df

# endregion


# region Main

def main():
    parser = argparse.ArgumentParser(description="Execute Power Query M via Fabric API")
    parser.add_argument("-w", "--workspace", required=True, help="Workspace GUID")
    parser.add_argument("-d", "--dataflow", required=True, help="Runner dataflow GUID")
    parser.add_argument("-m", "--mashup", help="M section document string")
    parser.add_argument("--stdin", action="store_true", help="Read mashup from stdin")
    parser.add_argument("-q", "--query-name", default="Result", help="Query name (default: Result)")
    parser.add_argument("-o", "--output", help="Output file path (.csv or .parquet)")
    parser.add_argument("-n", "--head", type=int, help="Print only first N rows")

    args = parser.parse_args()

    if args.stdin:
        mashup = sys.stdin.read()
    elif args.mashup:
        mashup = args.mashup
    else:
        parser.error("Provide --mashup or --stdin")

    token = get_token()
    df = execute_m(args.workspace, args.dataflow, token, mashup, args.query_name)

    if df is None:
        sys.exit(1)

    if args.output:
        if args.output.endswith(".parquet"):
            df.to_parquet(args.output, index=False)
        else:
            df.to_csv(args.output, index=False)

        print(f"Wrote {len(df)} rows to {args.output}", file=sys.stderr)
    else:
        display = df.head(args.head) if args.head else df
        print(display.to_string(index=False))
        print(f"\n({len(df)} rows, {len(df.columns)} columns)", file=sys.stderr)


if __name__ == "__main__":
    main()

# endregion
