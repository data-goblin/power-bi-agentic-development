#!/usr/bin/env python3
"""
Find all reports connected to a semantic model across accessible workspaces.

No tenant admin required -- uses workspace-level permissions only.
Scans all workspaces the authenticated user has access to.

Usage:
    # By workspace/model name
    python3 get-downstream-reports.py "Claude Code's Workspace" "SpaceParts"

    # By dataset GUID directly (skips model lookup)
    python3 get-downstream-reports.py --dataset-id 8f2a2a29-0738-444a-8a5a-f83d26ec1f7f

    # JSON output for piping
    python3 get-downstream-reports.py "ws" "model" --json

Requirements:
    pip install azure-identity requests
"""

import argparse
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from azure.identity import DefaultAzureCredential


# region Variables

API = "https://api.powerbi.com/v1.0/myorg"

# endregion


# region Functions

def get_token():
    """Acquire a Power BI API bearer token via DefaultAzureCredential."""
    cred = DefaultAzureCredential()
    tok = cred.get_token("https://analysis.windows.net/powerbi/api/.default")
    return tok.token


def get_dataset_id(headers, workspace_name, model_name):
    """
    Resolve a semantic model name to its dataset GUID.

    Searches the named workspace for a matching dataset by displayName.
    Returns the dataset ID string or exits with error.
    """
    resp = requests.get(f"{API}/groups", headers=headers, timeout=15)
    resp.raise_for_status()
    workspaces = resp.json().get("value", [])

    ws = next((w for w in workspaces if w["name"] == workspace_name), None)
    if not ws:
        print(f"Workspace '{workspace_name}' not found", file=sys.stderr)
        sys.exit(1)

    resp = requests.get(
        f"{API}/groups/{ws['id']}/datasets", headers=headers, timeout=15
    )
    resp.raise_for_status()
    datasets = resp.json().get("value", [])

    ds = next((d for d in datasets if d["name"] == model_name), None)
    if not ds:
        print(f"Model '{model_name}' not found in '{workspace_name}'", file=sys.stderr)
        print(f"Available: {[d['name'] for d in datasets]}", file=sys.stderr)
        sys.exit(1)

    return ds["id"], ws["id"], ws["name"]


def scan_workspace(ws_id, ws_name, dataset_id, headers):
    """
    Scan a single workspace for reports bound to the target dataset.

    Returns a list of matched report dicts with workspace context.
    """
    try:
        resp = requests.get(
            f"{API}/groups/{ws_id}/reports", headers=headers, timeout=10
        )
        if resp.status_code != 200:
            return []

        reports = resp.json().get("value", [])
        matched = []
        for r in reports:
            if r.get("datasetId") == dataset_id:
                matched.append({
                    "report": r["name"],
                    "reportId": r["id"],
                    "workspace": ws_name,
                    "workspaceId": ws_id,
                    "format": r.get("format", "?"),
                    "webUrl": r.get("webUrl", ""),
                })
        return matched
    except Exception:
        return []


def main():
    parser = argparse.ArgumentParser(
        description="Find all reports connected to a semantic model"
    )
    parser.add_argument("workspace", nargs="?", help="Workspace name")
    parser.add_argument("model", nargs="?", help="Semantic model name")
    parser.add_argument("--dataset-id", help="Dataset GUID (skip name lookup)")
    parser.add_argument("--json", action="store_true", help="JSON output")
    parser.add_argument(
        "--workers", type=int, default=8, help="Parallel workers (default: 8)"
    )
    args = parser.parse_args()

    if not args.dataset_id and not (args.workspace and args.model):
        parser.error("Provide workspace + model name, or --dataset-id")

    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Resolve dataset ID
    if args.dataset_id:
        dataset_id = args.dataset_id
        source_ws = "?"
    else:
        dataset_id, source_ws_id, source_ws = get_dataset_id(
            headers, args.workspace, args.model
        )

    if not args.json:
        print(f"Dataset: {dataset_id}")
        print(f"Scanning workspaces...", end="", flush=True)

    # Get all accessible workspaces
    resp = requests.get(f"{API}/groups", headers=headers, timeout=15)
    resp.raise_for_status()
    workspaces = resp.json().get("value", [])

    # Scan in parallel
    start = time.time()
    all_matched = []

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(scan_workspace, ws["id"], ws["name"], dataset_id, headers): ws
            for ws in workspaces
        }
        for f in as_completed(futures):
            all_matched.extend(f.result())

    elapsed = time.time() - start

    # Sort: source workspace first, then alphabetical
    all_matched.sort(key=lambda r: (r["workspace"] != source_ws, r["workspace"], r["report"]))

    if args.json:
        print(json.dumps(all_matched, indent=2))
        return

    print(f" {len(workspaces)} workspaces in {elapsed:.1f}s\n")

    if not all_matched:
        print("No downstream reports found.")
        return

    # Group by workspace
    by_ws = {}
    for r in all_matched:
        by_ws.setdefault(r["workspace"], []).append(r)

    print(f"Downstream reports ({len(all_matched)}):\n")
    for ws_name, reports in by_ws.items():
        print(f"  {ws_name}/")
        for r in reports:
            print(f"    {r['report']}.Report  ({r['format']})")

    print(f"\n{len(all_matched)} reports across {len(by_ws)} workspaces")


# endregion


if __name__ == "__main__":
    main()
