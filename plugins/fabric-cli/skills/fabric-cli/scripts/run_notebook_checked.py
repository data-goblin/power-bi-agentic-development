#!/usr/bin/env python3
"""
Run a Fabric notebook and check its real outcome, not just the job status.

`fab job run` (and the job instance status) report "Completed" whenever the notebook
*process* finished. If the notebook caught an exception internally and returned a
structured failure via notebookutils.notebook.exit(json.dumps({"ok": False, ...})) /
mssparkutils.notebook.exit(...), the job still reads Completed. The exit payload -- the
notebook's own verdict -- is only exposed by the notebook-specific job-instance endpoint:

    GET /v1/workspaces/{ws}/notebooks/{nb}/jobs/execute/instances/{run}?beta=true
    -> properties.exitValue   (string; parse if it is JSON)

This script starts the notebook (via `fab job start`, so parameter translation is fab's
job), polls the documented GA instance endpoint for a terminal status, then reads the exit
value from the beta endpoint and turns the notebook's own verdict into an exit code.

Exit codes:
    0  job Completed and the notebook's exit verdict is ok (or there is no structured verdict)
    1  job Failed or Cancelled, or an operational error (auth, timeout, bad path)
    2  job Completed but the notebook's exitValue says it failed (ok:false / error / status)
    3  job Deduped -- skipped because the same job was already running; the notebook did NOT run

Usage:
    python3 run_notebook_checked.py "Workspace.Workspace/ETL.Notebook"
    python3 run_notebook_checked.py "ws.Workspace/ETL.Notebook" -P "date:string=2025-01-01,batch:int=500"
    python3 run_notebook_checked.py "ws.Workspace/ETL.Notebook" --format json
    python3 run_notebook_checked.py "ws.Workspace/ETL.Notebook" --run-id <instance-id>   # read only, no run

Stability note:
    The ?beta=true notebook job-instance route is an officially documented Fabric API, but it
    is marked Beta (not recommended for production, may change based on feedback). The GA
    status route (items/{id}/jobs/instances/{run}) does NOT return exitValue, so the Beta route
    is required to read the exit value. beta=true is mandatory on this endpoint.

Requirements:
    - fab CLI installed and authenticated (fab auth login) -- starts the run
    - Azure CLI logged in (az login) -- the status poll and exit-value read reuse your az token
    Both identities must point at the same tenant/account: the run starts under your fab
    login, but the poll and exit-value read use the az token, so a mismatch 401s after the
    job has already been kicked off.
"""

import argparse
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request


FABRIC_API = "https://api.fabric.microsoft.com/v1"
FABRIC_RESOURCE = "https://api.fabric.microsoft.com"
GUID_RE = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
TERMINAL = {"Completed", "Failed", "Cancelled", "Deduped"}


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


def get_id(path: str) -> str:
    """Resolve a Fabric path to its GUID via `fab get -q id`."""
    out = run_fab(["get", path, "-q", "id"]).stdout.strip().strip('"')
    if not GUID_RE.fullmatch(out):
        print(f"Could not resolve an id for {path!r} (got {out!r}).", file=sys.stderr)
        sys.exit(1)
    return out


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


def fabric_get(url: str, retries: int = 4) -> dict:
    """GET a Fabric REST URL and return parsed JSON, retrying transient errors.

    Refreshes the token on 401 and honors Retry-After on 429 so a long poll loop survives
    token expiry and rate limits instead of aborting a job that is still running server-side.
    """
    for attempt in range(retries + 1):
        req = urllib.request.Request(
            url, method="GET", headers={"Authorization": f"Bearer {current_token()}"}
        )
        try:
            resp = urllib.request.urlopen(req, timeout=30)
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            if e.code == 401 and attempt < retries:
                current_token(force=True)
                continue
            if e.code in (429, 500, 502, 503, 504) and attempt < retries:
                retry_after = e.headers.get("Retry-After") if e.headers else None
                time.sleep(min(int(retry_after) if retry_after and retry_after.isdigit() else 2 ** attempt, 30))
                continue
            print(f"HTTP {e.code} on {url}: {e.read().decode()[:300]}", file=sys.stderr)
            sys.exit(1)
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt < retries:
                time.sleep(2 ** attempt)
                continue
            print(f"Request to {url} failed: {e}", file=sys.stderr)
            sys.exit(1)


#endregion


#region Run + poll + read


def parse_notebook_path(path: str) -> tuple[str, str]:
    """Split a Fabric path into (workspace_path, notebook_path), defaulting the type suffixes."""
    if "/" not in path:
        print(f"Invalid path {path!r}. Expected: Workspace.Workspace/Notebook.Notebook", file=sys.stderr)
        sys.exit(1)
    workspace, item = path.split("/", 1)
    if ".Workspace" not in workspace:
        workspace += ".Workspace"
    if ".Notebook" not in item:
        item += ".Notebook"
    return workspace, item


def start_run(path: str, params: str | None, config: str | None) -> str:
    """Start the notebook async via `fab job start`; return the new job instance id.

    Prefers the JSON output (unambiguous id), falling back to the first GUID in stdout.
    """
    args = ["job", "start", path, "--output_format", "json"]
    if params:
        args += ["-P", params]
    if config:
        args += ["-C", config]
    proc = run_fab(args)
    run_id = _id_from_json(proc.stdout) or next(iter(GUID_RE.findall(proc.stdout)), None)
    if not run_id:
        print("Could not find a job instance id in `fab job start` output.", file=sys.stderr)
        print((proc.stdout or proc.stderr).strip(), file=sys.stderr)
        sys.exit(1)
    return run_id


def _id_from_json(text: str) -> str | None:
    """Pull a job instance id (GUID) out of fab's JSON output.

    fab wraps results as {"status":..., "result": {"data": [{"id": "<guid>"}]}}, so the id
    is nested; walk the whole structure for the first GUID-valued id-like key.
    """
    try:
        return _find_guid_id(json.loads(text))
    except (json.JSONDecodeError, TypeError):
        return None


def _find_guid_id(node) -> str | None:
    """Recursively return the first GUID-valued id/jobInstanceId/instanceId in a JSON value."""
    if isinstance(node, dict):
        for key in ("id", "jobInstanceId", "instanceId"):
            val = node.get(key)
            if isinstance(val, str) and GUID_RE.fullmatch(val):
                return val
        for val in node.values():
            found = _find_guid_id(val)
            if found:
                return found
    elif isinstance(node, list):
        for item in node:
            found = _find_guid_id(item)
            if found:
                return found
    return None


def instance_status(workspace_id: str, notebook_id: str, run_id: str) -> dict:
    """Fetch the GA job instance once (status, failureReason, times)."""
    url = f"{FABRIC_API}/workspaces/{workspace_id}/items/{notebook_id}/jobs/instances/{run_id}"
    return fabric_get(url)


def poll_status(workspace_id: str, notebook_id: str, run_id: str,
                path: str, timeout: int, interval: int) -> dict:
    """Poll the GA instance endpoint until the job reaches a terminal status or times out."""
    deadline = time.monotonic() + timeout
    while True:
        job = instance_status(workspace_id, notebook_id, run_id)
        status = job.get("status", "Unknown")
        if status in TERMINAL:
            return job
        if time.monotonic() >= deadline:
            print(f"Timed out after {timeout}s; last status: {status}. The job is still "
                  f"running server-side and keeps consuming capacity. Cancel it with:\n"
                  f'  fab job run-cancel "{path}" --id {run_id} -w', file=sys.stderr)
            sys.exit(1)
        time.sleep(interval)


def read_exit_value(workspace_id: str, notebook_id: str, run_id: str) -> dict:
    """Read the exit value + monitoring links from the beta notebook job-instance endpoint.

    Per the documented schema the exit value is at properties.exitValue, and the monitoring
    links are under properties.computeDetails.monitoringInfo: executionSnapshotUrl for every
    compute type, plus sparkUiUrl/driverLogUrl and activityDetails.sparkApplicationId for
    Spark only. (A top-level exitValue fallback is kept defensively but is not in the schema.)
    """
    url = (f"{FABRIC_API}/workspaces/{workspace_id}/notebooks/{notebook_id}"
           f"/jobs/execute/instances/{run_id}?beta=true")
    job = fabric_get(url)
    props = job.get("properties") or {}
    monitoring = (props.get("computeDetails") or {}).get("monitoringInfo") or {}
    activity = monitoring.get("activityDetails") or {}
    exit_value = props.get("exitValue")
    return {
        "exit_value": exit_value if exit_value is not None else job.get("exitValue"),
        "snapshot_url": monitoring.get("executionSnapshotUrl"),
        "spark_ui_url": monitoring.get("sparkUiUrl"),
        "driver_log_url": monitoring.get("driverLogUrl"),
        "spark_application_id": activity.get("sparkApplicationId"),
    }


def verdict_from_exit_value(exit_value: str | None) -> tuple[bool, str]:
    """Interpret the notebook's exitValue. Returns (ok, human_summary).

    A structured JSON payload with ok:false, a truthy "error", or status in {error, failed}
    is treated as a failure even when the job status is Completed. An empty exit value trusts
    the job status. A non-JSON exit value can't be judged, so it trusts the status but warns:
    legacy notebooks that exit a plain string like "Failed: ..." can't be verified here.
    """
    if not exit_value:
        return True, "(no exitValue set; job status is authoritative)"
    try:
        payload = json.loads(exit_value)
    except (json.JSONDecodeError, TypeError):
        print(f"Warning: exitValue is not structured JSON, so the notebook's verdict can't be "
              f"verified; trusting the Completed status. exitValue: {exit_value[:200]}", file=sys.stderr)
        return True, exit_value
    if not isinstance(payload, dict):
        return True, str(payload)
    ok = payload.get("ok")
    status = str(payload.get("status", "")).lower()
    failed = ok is False or bool(payload.get("error")) or status in {"error", "failed"}
    summary = payload.get("summary") or payload.get("error") or payload.get("message") or exit_value
    return (not failed), summary if isinstance(summary, str) else json.dumps(summary)


#endregion


#region Main


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run a Fabric notebook and check its real outcome via the exit value.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("path", help="Notebook path: Workspace.Workspace/Notebook.Notebook")
    parser.add_argument("-P", "--params", help="Parameters as name:type=value, comma-separated (passed to fab)")
    parser.add_argument("-C", "--config", help="Notebook config JSON (inline or path; passed to fab)")
    parser.add_argument("--run-id", help="Read the exit value of an existing run; do not start a new one")
    parser.add_argument("--timeout", type=int, default=1800, help="Poll timeout in seconds (default: 1800)")
    parser.add_argument("--poll-interval", type=int, default=5, help="Poll interval in seconds (default: 5)")
    parser.add_argument("--format", choices=["table", "json"], default="table", help="Output format (default: table)")
    args = parser.parse_args()

    workspace, notebook = parse_notebook_path(args.path)
    print(f"Resolving {workspace} / {notebook}...", file=sys.stderr)
    workspace_id = get_id(workspace)
    notebook_id = get_id(f"{workspace}/{notebook}")

    if args.run_id:
        run_id = args.run_id
        print(f"Reading run {run_id}...", file=sys.stderr)
        job = instance_status(workspace_id, notebook_id, run_id)
    else:
        print("Starting notebook run...", file=sys.stderr)
        run_id = start_run(f"{workspace}/{notebook}", args.params, args.config)
        print(f"Run {run_id}; polling for completion...", file=sys.stderr)
        job = poll_status(workspace_id, notebook_id, run_id,
                          f"{workspace}/{notebook}", args.timeout, args.poll_interval)

    code = terminal_outcome(args.format, job, run_id)
    if code is not None:
        sys.exit(code)

    # status is Completed: the notebook's own exit value is the real verdict
    detail = read_exit_value(workspace_id, notebook_id, run_id)
    ok, summary = verdict_from_exit_value(detail["exit_value"])
    _emit(args.format, "Completed", run_id, detail["exit_value"], "OK" if ok else "FAILED", summary, detail)
    sys.exit(0 if ok else 2)


def terminal_outcome(fmt: str, job: dict, run_id: str) -> int | None:
    """Emit + return an exit code for any status except Completed.

    Returns None only when the job is Completed, meaning the caller should go on to read
    and judge the exit value. A run that is Failed/Cancelled (1), Deduped (3), or not yet
    terminal (1, only reachable via --run-id on an in-progress run) is reported here so it
    can never be mistaken for success.
    """
    status = job.get("status", "Unknown")
    if status == "Completed":
        return None
    if status == "Deduped":
        _emit(fmt, status, run_id, None, "DID NOT RUN", "Skipped: another run of this job was already in flight", {})
        return 3
    if status in {"Failed", "Cancelled"}:
        reason = job.get("failureReason") or {}
        msg = reason.get("message") if isinstance(reason, dict) else str(reason)
        _emit(fmt, status, run_id, None, "FAILED", msg or status, {})
        return 1
    _emit(fmt, status, run_id, None, "IN PROGRESS", "Run has not reached a terminal status yet", {})
    return 1


def _emit(fmt: str, status: str, run_id: str, exit_value, verdict: str, summary: str, detail: dict) -> None:
    """Print the outcome as a table or JSON. `verdict` is OK / FAILED / DID NOT RUN / IN PROGRESS."""
    if fmt == "json":
        print(json.dumps({
            "run_id": run_id, "job_status": status, "verdict": verdict,
            "notebook_ok": verdict == "OK",
            "summary": summary, "exit_value": exit_value,
            "snapshot_url": detail.get("snapshot_url"),
            "spark_ui_url": detail.get("spark_ui_url"),
            "driver_log_url": detail.get("driver_log_url"),
            "spark_application_id": detail.get("spark_application_id"),
        }, indent=2))
        return
    print(f"job status  : {status}")
    print(f"verdict     : {verdict}")
    print(f"run id      : {run_id}")
    print(f"summary     : {summary}")
    if verdict != "OK":
        if detail.get("snapshot_url"):
            print(f"snapshot    : {detail['snapshot_url']}")
        if detail.get("spark_ui_url"):
            print(f"spark ui    : {detail['spark_ui_url']}")
        if detail.get("driver_log_url"):
            print(f"driver log  : {detail['driver_log_url']}")
    if verdict != "OK" and detail.get("driver_log_url"):
        print(f"driver log  : {detail['driver_log_url']}")


if __name__ == "__main__":
    main()


#endregion
