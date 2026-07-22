#!/usr/bin/env python3
"""
Deploy (create or update) a Fabric notebook definition fast, by polling the
long-running operation tightly instead of at the CLI's conservative cadence.

Why this exists
---------------
`fab import` and `nb create`/`nb cell edit` take 25-60s to push a notebook
definition. The server-side work is only ~0.5-1s: the item-definition API returns
202 Accepted with a `Retry-After: 20` header, and the CLIs wait that long between
status polls. Neither `fab` nor `nb` exposes a knob to change that interval.

The single biggest performance lever for any definition change is the poll interval.
Polling the operation every ~0.3s instead of every ~20s turns a 30s deploy into ~1s:

    create a new notebook (40KB cell)   ~1.6s   (vs ~29s for `fab import`)
    update an existing notebook         ~0.7s   (vs ~44s for `nb cell edit`)

This script does exactly that: create-with-definition (or updateDefinition when the
item already exists), then polls the LRO at `--poll-interval` (default 0.3s).

The same technique applies to any definition-based item (reports, semantic models,
pipelines) via `POST .../items/{id}/updateDefinition`; this script is scoped to
notebooks because that is what it is validated against.

Usage
-----
    # Auto-detect: update in place if the item exists, else create it
    python3 deploy_notebook.py "ws.Workspace/ETL.Notebook" -i ./ETL.Notebook
    python3 deploy_notebook.py "ws.Workspace/ETL.Notebook" -i ./notebook-content.ipynb

    # Force one path, tune the lever, or read JSON output
    python3 deploy_notebook.py "ws.Workspace/ETL.Notebook" -i ./ETL.Notebook --update-only
    python3 deploy_notebook.py "ws.Workspace/ETL.Notebook" -i ./ETL.Notebook --poll-interval 0.5
    python3 deploy_notebook.py "ws.Workspace/ETL.Notebook" -i ./ETL.Notebook --format json

Input may be a folder produced by `fab export` (containing `notebook-content.ipynb`)
or a bare `.ipynb` file.

Exit codes: 0 deployed; 1 operational error (auth, path, HTTP, LRO failure/timeout).

Requirements
------------
    - Azure CLI logged in (`az login`); the token is read from the az cache, never persisted
    - fab CLI installed and authenticated (`fab auth login`); used only to resolve the
      workspace id and check item existence
    Both identities must point at the same tenant/account.
"""

import argparse
import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

FABRIC_API = "https://api.fabric.microsoft.com/v1"
FABRIC_RESOURCE = "https://api.fabric.microsoft.com"


#region Shell + auth helpers


def run_fab(args: list[str], check: bool = True) -> subprocess.CompletedProcess:
    """Run a fab CLI command, returning the completed process (stdout+stderr captured)."""
    try:
        return subprocess.run(["fab"] + args, capture_output=True, text=True, check=check)
    except subprocess.CalledProcessError as e:
        print(f"fab error: {(e.stderr or e.stdout).strip()}", file=sys.stderr)
        sys.exit(1)
    except FileNotFoundError:
        print("fab CLI not found. Install: https://microsoft.github.io/fabric-cli/", file=sys.stderr)
        sys.exit(1)


def fabric_token() -> str:
    """Get a Fabric-audience bearer token from the current az login. Never logged."""
    try:
        res = subprocess.run(
            ["az", "account", "get-access-token", "--resource", FABRIC_RESOURCE],
            capture_output=True, text=True, check=True,
        )
    except subprocess.CalledProcessError:
        print("az could not get a token. Run 'az login' first.", file=sys.stderr)
        sys.exit(1)
    except FileNotFoundError:
        print("Azure CLI (az) not found. Install it and run 'az login'.", file=sys.stderr)
        sys.exit(1)
    return json.loads(res.stdout)["accessToken"]


_TOKEN = {"value": None, "at": 0.0}


def current_token(force: bool = False) -> str:
    """Return a cached Fabric token, re-fetching after 40 min (well before ~60 min expiry)."""
    now = time.monotonic()
    if force or _TOKEN["value"] is None or now - _TOKEN["at"] > 2400:
        _TOKEN["value"] = fabric_token()
        _TOKEN["at"] = now
    return _TOKEN["value"]


def api(method: str, url: str, body: dict | None = None, retries: int = 4) -> tuple[int, dict, dict]:
    """Call a Fabric REST URL; return (status, headers, json). Refresh token on 401, back off on 429/5xx."""
    data = json.dumps(body).encode() if body is not None else None
    for attempt in range(retries + 1):
        req = urllib.request.Request(
            url, data=data, method=method,
            headers={"Authorization": f"Bearer {current_token()}", "Content-Type": "application/json"},
        )
        try:
            resp = urllib.request.urlopen(req, timeout=60)
            raw = resp.read().decode()
            return resp.status, {k: v for k, v in resp.getheaders()}, (json.loads(raw) if raw.strip() else {})
        except urllib.error.HTTPError as e:
            if e.code == 401 and attempt < retries:
                current_token(force=True)
                continue
            if e.code in (429, 500, 502, 503, 504) and attempt < retries:
                ra = e.headers.get("Retry-After") if e.headers else None
                time.sleep(min(int(ra) if ra and ra.isdigit() else 2 ** attempt, 30))
                continue
            print(f"HTTP {e.code} on {method} {url}: {e.read().decode()[:400]}", file=sys.stderr)
            sys.exit(1)
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt < retries:
                time.sleep(2 ** attempt)
                continue
            print(f"Request to {url} failed: {e}", file=sys.stderr)
            sys.exit(1)


#endregion


#region Path, definition, and LRO


def parse_path(path: str) -> tuple[str, str, str]:
    """Split a Fabric path into (workspace_path, notebook_path, display_name), defaulting suffixes."""
    if "/" not in path:
        print(f"Invalid path {path!r}. Expected: Workspace.Workspace/Notebook.Notebook", file=sys.stderr)
        sys.exit(1)
    workspace, item = path.split("/", 1)
    if not workspace.endswith(".Workspace"):
        workspace += ".Workspace"
    if not item.endswith(".Notebook"):
        item += ".Notebook"
    return workspace, item, item[: -len(".Notebook")]


def read_ipynb(input_path: str) -> str:
    """Return the base64 InlineBase64 payload for the notebook's `.ipynb`.

    Accepts a folder holding `notebook-content.ipynb` (fab export layout) or a bare `.ipynb`.
    """
    if os.path.isdir(input_path):
        candidate = os.path.join(input_path, "notebook-content.ipynb")
        if not os.path.isfile(candidate):
            print(f"No notebook-content.ipynb in {input_path!r}. Export with "
                  f"`fab export <path> -o <dir> --format ipynb -f`.", file=sys.stderr)
            sys.exit(1)
        input_path = candidate
    if not os.path.isfile(input_path):
        print(f"Input {input_path!r} not found.", file=sys.stderr)
        sys.exit(1)
    with open(input_path, "rb") as f:
        return base64.b64encode(f.read()).decode()


def definition(payload_b64: str) -> dict:
    """Build the ipynb item-definition object with a single InlineBase64 part."""
    return {
        "format": "ipynb",
        "parts": [{"path": "notebook-content.ipynb", "payload": payload_b64, "payloadType": "InlineBase64"}],
    }


def poll_lro(location: str, poll_interval: float, timeout: float) -> None:
    """Poll an operation-state URL until terminal. Exit non-zero on failure or timeout.

    The poll interval is the whole point of this script: the server finishes in ~1s, but the
    202 advertises `Retry-After: 20`. Polling at ~0.3s collapses a 30s wait to ~1s.
    """
    deadline = time.monotonic() + timeout
    while True:
        status, _, body = api("GET", location)
        state = body.get("status")
        if state in ("Succeeded", "Completed") or (status in (200, 201) and state is None):
            return
        if state in ("Failed", "Cancelled"):
            print(f"Operation {state}: {json.dumps(body.get('error') or body)[:400]}", file=sys.stderr)
            sys.exit(1)
        if time.monotonic() >= deadline:
            print(f"LRO did not finish within {timeout}s (last state: {state}).", file=sys.stderr)
            sys.exit(1)
        time.sleep(poll_interval)


def submit(method: str, url: str, body: dict, poll_interval: float, timeout: float) -> None:
    """POST a create/update and drive its LRO to completion at the given poll interval."""
    status, headers, _ = api(method, url, body)
    if status in (200, 201):
        return
    if status == 202:
        location = headers.get("Location")
        if not location:
            print("202 Accepted but no Location header to poll.", file=sys.stderr)
            sys.exit(1)
        poll_lro(location, poll_interval, timeout)
        return
    print(f"Unexpected status {status} from {method} {url}.", file=sys.stderr)
    sys.exit(1)


#endregion


#region Main


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Deploy a Fabric notebook definition fast by tight-polling the LRO.",
        formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__,
    )
    parser.add_argument("path", help="Target: Workspace.Workspace/Notebook.Notebook")
    parser.add_argument("-i", "--input", required=True, help="Local folder (fab export) or .ipynb file")
    parser.add_argument("--poll-interval", type=float, default=0.3,
                        help="LRO poll interval in seconds; the main performance lever (default: 0.3)")
    parser.add_argument("--timeout", type=float, default=120, help="LRO timeout in seconds (default: 120)")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--create-only", action="store_true", help="Fail if the notebook already exists")
    mode.add_argument("--update-only", action="store_true", help="Fail if the notebook does not exist")
    parser.add_argument("--format", choices=["table", "json"], default="table", help="Output format (default: table)")
    args = parser.parse_args()

    workspace, notebook, display_name = parse_path(args.path)
    payload = read_ipynb(args.input)

    t0 = time.perf_counter()
    # One fab call resolves the workspace id; one REST call gives existence + the item id
    # together (cheaper than fab exists + fab get id, and every subprocess hop is latency).
    ws_id = run_fab(["get", workspace, "-q", "id"]).stdout.strip().strip('"')
    _, _, listing = api("GET", f"{FABRIC_API}/workspaces/{ws_id}/notebooks")
    item_id = next((it["id"] for it in listing.get("value", []) if it.get("displayName") == display_name), None)
    exists = item_id is not None

    if exists and args.create_only:
        print(f"{notebook} already exists in {workspace}; --create-only refuses to overwrite.", file=sys.stderr)
        sys.exit(1)
    if not exists and args.update_only:
        print(f"{notebook} does not exist in {workspace}; --update-only cannot update it.", file=sys.stderr)
        sys.exit(1)

    if exists:
        action = "update"
        submit("POST", f"{FABRIC_API}/workspaces/{ws_id}/items/{item_id}/updateDefinition",
               {"definition": definition(payload)}, args.poll_interval, args.timeout)
    else:
        action = "create"
        submit("POST", f"{FABRIC_API}/workspaces/{ws_id}/notebooks",
               {"displayName": display_name, "definition": definition(payload)}, args.poll_interval, args.timeout)
    elapsed = time.perf_counter() - t0

    if args.format == "json":
        print(json.dumps({"action": action, "notebook": notebook, "workspace": workspace,
                          "seconds": round(elapsed, 3), "poll_interval": args.poll_interval}))
    else:
        print(f"{action:6s} {notebook}  in {workspace}  ->  {elapsed:.2f}s  (poll {args.poll_interval}s)")


if __name__ == "__main__":
    main()


#endregion
