#!/usr/bin/env python3
"""
Semantic Model Refresh Script
refresh_model.py

Trigger and monitor semantic model refreshes via the Power BI Enhanced
Refresh REST API. Supports full model, individual tables, specific
partitions, and all TMSL refresh types.

AGENT USAGE GUIDE:
------------------
Use this script to programmatically refresh semantic models. It wraps the
Enhanced Refresh API with sensible defaults and clear status output.

COMMON PATTERNS:
  # Full model refresh (all tables, type=full)
  uv run refresh_model.py -w <workspace-id> -m <model-id>

  # Automatic refresh (incremental if configured, else full)
  uv run refresh_model.py -w <workspace-id> -m <model-id> -t automatic

  # Refresh specific tables
  uv run refresh_model.py -w <workspace-id> -m <model-id> --tables Sales,Calendar

  # Refresh specific partitions
  uv run refresh_model.py -w <workspace-id> -m <model-id> --partitions Sales:Sales_2024,Sales:Sales_2023

  # Data-only refresh (no recalculation)
  uv run refresh_model.py -w <workspace-id> -m <model-id> -t dataOnly

  # Calculate only (no data reload)
  uv run refresh_model.py -w <workspace-id> -m <model-id> -t calculate

  # Clear values from specific table
  uv run refresh_model.py -w <workspace-id> -m <model-id> -t clearValues --tables FactSales

  # Partial batch commit with parallelism
  uv run refresh_model.py -w <workspace-id> -m <model-id> --commit partialBatch --parallelism 4

  # Skip incremental refresh policy
  uv run refresh_model.py -w <workspace-id> -m <model-id> --no-policy

  # Monitor only (check last N refreshes)
  uv run refresh_model.py -w <workspace-id> -m <model-id> --status-only --top 5

  # Cancel an in-progress refresh
  uv run refresh_model.py -w <workspace-id> -m <model-id> --cancel <request-id>

PREREQUISITES:
  - `fab` CLI authenticated: `fab auth login`
  - Workspace contributor or higher permissions
  - Premium/Fabric capacity for enhanced refresh features

TOKEN SECURITY:
  Uses `fab api` for all calls (handles auth internally).
  No tokens are printed or logged.
"""

import argparse
import json
import subprocess
import sys
import time
from typing import Any, Dict, List, Optional


#region Helpers

def fab_api(
    endpoint: str,
    method: str = "GET",
    body: Optional[Dict] = None,
    audience: str = "powerbi",
) -> Dict[str, Any]:
    """
    Call a Power BI API endpoint via fab CLI.

    Returns a dict with 'status' (int), 'data' (parsed JSON or None),
    and 'error' (str or None). Auth handled internally by fab.
    """
    cmd = ["fab", "api", "-A", audience, endpoint]

    if method.upper() != "GET":
        cmd.extend(["-X", method.lower()])

    if body is not None:
        cmd.extend(["-i", json.dumps(body)])

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

        if result.returncode != 0:
            err = result.stderr.strip() or result.stdout.strip()
            return {"status": 1, "data": None, "error": err}

        stdout = result.stdout.strip()
        if not stdout:
            return {"status": 0, "data": None, "error": None}

        raw = json.loads(stdout)
        data = raw.get("text", raw)
        return {"status": 0, "data": data, "error": None}

    except subprocess.TimeoutExpired:
        return {"status": 1, "data": None, "error": "Request timed out"}
    except json.JSONDecodeError:
        return {"status": 0, "data": None, "error": None}

#endregion


#region Refresh Operations

def trigger_refresh(
    workspace_id: str,
    model_id: str,
    refresh_type: str = "full",
    tables: Optional[List[str]] = None,
    partitions: Optional[List[Dict[str, str]]] = None,
    commit_mode: str = "transactional",
    max_parallelism: int = 10,
    retry_count: int = 0,
    apply_policy: bool = True,
    effective_date: Optional[str] = None,
    timeout: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Trigger a semantic model refresh via the Enhanced Refresh API.

    Builds the POST body from the provided parameters and sends it to
    the /refreshes endpoint. Returns the API response with request ID
    if successful.

    Inputs:
      workspace_id  - Workspace GUID
      model_id      - Semantic model (dataset) GUID
      refresh_type  - One of: full, automatic, dataOnly, calculate, clearValues, defragment
      tables        - Optional list of table names to refresh
      partitions    - Optional list of {"table": ..., "partition": ...} dicts
      commit_mode   - transactional or partialBatch
      max_parallelism - Max parallel processing threads (1-100)
      retry_count   - Number of retries on failure
      apply_policy  - Whether to apply incremental refresh policy
      effective_date - Override current date for policy (YYYY-MM-DD)
      timeout       - Per-attempt timeout (HH:MM:SS format)

    Output:
      Dict with 'success' (bool), 'message' (str), and 'request_id' (str or None)
    """
    endpoint = f"groups/{workspace_id}/datasets/{model_id}/refreshes"

    body: Dict[str, Any] = {
        "type": refresh_type,
        "commitMode": commit_mode,
        "maxParallelism": max_parallelism,
        "retryCount": retry_count,
        "applyRefreshPolicy": apply_policy,
    }

    if effective_date:
        body["effectiveDate"] = effective_date

    if timeout:
        body["timeout"] = timeout

    # Build objects array from tables and/or partitions
    objects = []

    if partitions:
        for p in partitions:
            objects.append({"table": p["table"], "partition": p["partition"]})
    elif tables:
        for t in tables:
            objects.append({"table": t})

    if objects:
        body["objects"] = objects

    resp = fab_api(endpoint, method="POST", body=body)

    if resp["error"]:
        return {"success": False, "message": resp["error"], "request_id": None}

    # fab CLI does not expose the Location header, so retrieve the
    # requestId from the most recent refresh history entry.
    request_id = None
    history_resp = fab_api(
        f"groups/{workspace_id}/datasets/{model_id}/refreshes?$top=1"
    )
    if history_resp["data"]:
        entries = history_resp["data"]
        if isinstance(entries, dict):
            entries = entries.get("value", [])
        if entries:
            request_id = entries[0].get("requestId")

    return {
        "success": True,
        "message": f"Refresh triggered ({refresh_type})",
        "request_id": request_id,
    }


def get_refresh_history(
    workspace_id: str,
    model_id: str,
    top: int = 5,
) -> List[Dict[str, Any]]:
    """
    Retrieve recent refresh history for a semantic model.

    Inputs:
      workspace_id - Workspace GUID
      model_id     - Semantic model GUID
      top          - Number of recent refreshes to return

    Output:
      List of refresh records with status, times, and type.
    """
    endpoint = f"groups/{workspace_id}/datasets/{model_id}/refreshes?$top={top}"
    resp = fab_api(endpoint)

    if resp["error"] or not resp["data"]:
        return []

    data = resp["data"]
    if isinstance(data, dict):
        return data.get("value", [])
    if isinstance(data, list):
        return data
    return []


def cancel_refresh(
    workspace_id: str,
    model_id: str,
    request_id: str,
) -> Dict[str, Any]:
    """
    Cancel an in-progress enhanced refresh operation.

    Inputs:
      workspace_id - Workspace GUID
      model_id     - Semantic model GUID
      request_id   - The requestId of the refresh to cancel

    Output:
      Dict with 'success' (bool) and 'message' (str).
      Only works for refreshes triggered via the Enhanced API.
    """
    endpoint = f"groups/{workspace_id}/datasets/{model_id}/refreshes/{request_id}"
    resp = fab_api(endpoint, method="DELETE")

    if resp["error"]:
        return {"success": False, "message": resp["error"]}

    return {"success": True, "message": f"Cancel request sent for {request_id}"}

#endregion


#region Output

def format_refresh_history(refreshes: List[Dict]) -> str:
    """Format refresh history as readable ASCII table."""
    if not refreshes:
        return "  No refresh history found."

    lines = []
    lines.append("")
    lines.append(f"  {'Status':<12} {'Type':<18} {'Start':<26} {'End':<26}")
    lines.append(f"  {'─' * 12} {'─' * 18} {'─' * 26} {'─' * 26}")

    for r in refreshes:
        status = r.get("status", "?")
        rtype = r.get("refreshType", "?")
        start = r.get("startTime", "")[:25] if r.get("startTime") else "?"
        end = r.get("endTime", "")[:25] if r.get("endTime") else "..."

        lines.append(f"  {status:<12} {rtype:<18} {start:<26} {end:<26}")

    lines.append("")
    return "\n".join(lines)


def format_trigger_result(result: Dict) -> str:
    """Format the result of a refresh trigger."""
    lines = []
    if result["success"]:
        lines.append(f"  [OK] {result['message']}")
        if result.get("request_id"):
            lines.append(f"       Request ID: {result['request_id']}")
    else:
        lines.append(f"  [FAIL] {result['message']}")
    return "\n".join(lines)

#endregion


#region CLI

def parse_partitions(partition_str: str) -> List[Dict[str, str]]:
    """
    Parse partition argument string into list of table/partition dicts.
    Format: "Table1:Partition1,Table2:Partition2"
    """
    partitions = []
    for item in partition_str.split(","):
        item = item.strip()
        if ":" not in item:
            print(f"  [WARN] Invalid partition format '{item}'; expected Table:Partition", file=sys.stderr)
            continue
        table, partition = item.split(":", 1)
        partitions.append({"table": table.strip(), "partition": partition.strip()})
    return partitions


def main():
    parser = argparse.ArgumentParser(
        description="Trigger and monitor semantic model refreshes via the Enhanced Refresh API.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Full refresh of entire model
  %(prog)s -w <ws-id> -m <model-id>

  # Refresh specific tables
  %(prog)s -w <ws-id> -m <model-id> --tables Sales,Calendar

  # Refresh specific partitions
  %(prog)s -w <ws-id> -m <model-id> --partitions Sales:Sales_2024

  # Data-only refresh (skip recalculation)
  %(prog)s -w <ws-id> -m <model-id> -t dataOnly

  # Check refresh status only
  %(prog)s -w <ws-id> -m <model-id> --status-only
        """,
    )

    parser.add_argument("--workspace-id", "-w", required=True, help="Workspace GUID")
    parser.add_argument("--model-id", "-m", required=True, help="Semantic model (dataset) GUID")

    # Refresh type
    parser.add_argument(
        "--type", "-t",
        default="full",
        choices=["full", "automatic", "dataOnly", "calculate", "clearValues", "defragment"],
        help="Refresh type (default: full)",
    )

    # Object scope
    parser.add_argument("--tables", help="Comma-separated table names to refresh")
    parser.add_argument("--partitions", help="Comma-separated Table:Partition pairs to refresh")

    # Enhanced options
    parser.add_argument("--commit", default="transactional", choices=["transactional", "partialBatch"],
                        help="Commit mode (default: transactional)")
    parser.add_argument("--parallelism", type=int, default=10, help="Max parallel threads (default: 10)")
    parser.add_argument("--retries", type=int, default=0, help="Retry count on failure (default: 0)")
    parser.add_argument("--no-policy", action="store_true", help="Skip incremental refresh policy")
    parser.add_argument("--effective-date", help="Override current date for policy (YYYY-MM-DD)")
    parser.add_argument("--timeout", help="Per-attempt timeout (HH:MM:SS)")

    # Monitor / cancel
    parser.add_argument("--status-only", action="store_true", help="Show refresh history only; do not trigger")
    parser.add_argument("--top", type=int, default=5, help="Number of recent refreshes to show (default: 5)")
    parser.add_argument("--cancel", metavar="REQUEST_ID", help="Cancel an in-progress refresh by request ID")
    parser.add_argument("--poll", action="store_true", help="Poll refresh status after triggering until complete")
    parser.add_argument("--poll-interval", type=int, default=15, help="Seconds between polls (default: 15)")
    parser.add_argument("--max-wait", type=int, default=3600, help="Max seconds to poll before giving up (default: 3600)")

    args = parser.parse_args()

    print("=" * 72)
    print("  SEMANTIC MODEL REFRESH")
    print("=" * 72)

    # Cancel mode
    if args.cancel:
        result = cancel_refresh(args.workspace_id, args.model_id, args.cancel)
        print(format_trigger_result(result))
        sys.exit(0 if result["success"] else 1)

    # Status-only mode
    if args.status_only:
        refreshes = get_refresh_history(args.workspace_id, args.model_id, top=args.top)
        print(format_refresh_history(refreshes))
        sys.exit(0)

    # Parse object scope
    tables = [t.strip() for t in args.tables.split(",")] if args.tables else None
    partitions = parse_partitions(args.partitions) if args.partitions else None

    # Describe what will happen
    scope_desc = "entire model"
    if partitions:
        scope_desc = ", ".join(f"{p['table']}:{p['partition']}" for p in partitions)
    elif tables:
        scope_desc = ", ".join(tables)

    print(f"\n  Type:      {args.type}")
    print(f"  Scope:     {scope_desc}")
    print(f"  Commit:    {args.commit}")
    print(f"  Parallel:  {args.parallelism}")
    print(f"  Retries:   {args.retries}")
    print(f"  Policy:    {'skip' if args.no_policy else 'apply'}")
    if args.effective_date:
        print(f"  Eff. date: {args.effective_date}")
    if args.timeout:
        print(f"  Timeout:   {args.timeout}")
    print()

    # Trigger
    result = trigger_refresh(
        workspace_id=args.workspace_id,
        model_id=args.model_id,
        refresh_type=args.type,
        tables=tables,
        partitions=partitions,
        commit_mode=args.commit,
        max_parallelism=args.parallelism,
        retry_count=args.retries,
        apply_policy=not args.no_policy,
        effective_date=args.effective_date,
        timeout=args.timeout,
    )

    print(format_trigger_result(result))

    if not result["success"]:
        sys.exit(1)

    # Poll if requested
    if args.poll:
        print(f"\n  Polling for completion (max {args.max_wait}s)...")
        elapsed = 0
        while elapsed < args.max_wait:
            time.sleep(args.poll_interval)
            elapsed += args.poll_interval
            refreshes = get_refresh_history(args.workspace_id, args.model_id, top=1)
            if refreshes:
                latest = refreshes[0]
                status = latest.get("status", "Unknown")
                print(f"  ... {status} ({elapsed}s)")
                if status in ("Completed", "Failed", "Disabled", "Cancelled"):
                    print(format_refresh_history([latest]))
                    sys.exit(0 if status == "Completed" else 1)
            else:
                print(f"  ... unable to retrieve status ({elapsed}s)")

        print(f"\n  [WARN] Max wait time ({args.max_wait}s) exceeded; refresh may still be running.")
        print("  Use --status-only to check later.")

    # Show current history
    print("\n  Recent refresh history:")
    refreshes = get_refresh_history(args.workspace_id, args.model_id, top=3)
    print(format_refresh_history(refreshes))


if __name__ == "__main__":
    main()

#endregion
