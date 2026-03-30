#!/usr/bin/env python3
"""
Model Info Script
get_model_info.py

Retrieve comprehensive metadata for a Power BI semantic model: storage mode,
size, connected reports, deployment pipeline, endorsement, sensitivity label,
data sources, refresh schedule, and capacity.

AGENT USAGE GUIDE:
------------------
Run this as the first step of a semantic model review to gather context
before exporting and analyzing TMDL.

COMMON PATTERNS:
  # Full model info
  python3 get_model_info.py -w <workspace-id> -m <model-id>

  # JSON output
  python3 get_model_info.py -w <workspace-id> -m <model-id> --output json

PREREQUISITES:
  - `fab` CLI authenticated: `fab auth login`
  - Azure CLI authenticated: `az login` (for DataHub enrichment)
  - Python packages: requests (uv pip install requests)

TOKEN SECURITY:
  Uses `fab api` for most calls (handles auth internally).
  DataHub enrichment uses `az account get-access-token` in subprocess.
  Tokens held in memory only -- never printed or logged.
"""

import argparse
import json
import subprocess
import sys
from typing import Any, Dict, List, Optional

try:
    import requests
except ImportError:
    print("Error: 'requests' package required. Install with: uv pip install requests", file=sys.stderr)
    sys.exit(1)


#region Variables

REGIONS = {
    "west-europe": "wabi-west-europe-e-primary-redirect.analysis.windows.net",
    "north-europe": "wabi-north-europe-j-primary-redirect.analysis.windows.net",
    "us-east": "wabi-us-east-a-primary-redirect.analysis.windows.net",
    "us-east2": "wabi-us-east2-b-primary-redirect.analysis.windows.net",
    "us-west": "wabi-us-west-d-primary-redirect.analysis.windows.net",
    "uk-south": "wabi-uk-south-a-primary-redirect.analysis.windows.net",
}

DEFAULT_REGION = "west-europe"

#endregion


#region Helpers

def fab_api(endpoint: str, audience: str = "powerbi") -> Optional[Dict]:
    """
    Call a Power BI API endpoint via fab CLI.
    Auth handled internally by fab -- no tokens exposed.
    """
    try:
        result = subprocess.run(
            ["fab", "api", "-A", audience, endpoint],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0 and result.stdout.strip():
            raw = json.loads(result.stdout)
            return raw.get("text", raw)
        return None
    except (subprocess.TimeoutExpired, FileNotFoundError, json.JSONDecodeError):
        return None


def get_token() -> Optional[str]:
    """Obtain Power BI API token via Azure CLI. Never printed or logged."""
    try:
        result = subprocess.run(
            ["az", "account", "get-access-token",
             "--resource", "https://analysis.windows.net/powerbi/api"],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            return json.loads(result.stdout).get("accessToken")
        return None
    except Exception:
        return None

#endregion


#region Data Collection

def get_model_details(workspace_id: str, model_id: str) -> Dict[str, Any]:
    """Get basic model properties via Power BI API."""
    data = fab_api(f"groups/{workspace_id}/datasets/{model_id}")
    if not data or not isinstance(data, dict):
        return {}
    return {
        "name": data.get("name", "?"),
        "id": data.get("id", model_id),
        "configuredBy": data.get("configuredBy", "?"),
        "isRefreshable": data.get("isRefreshable"),
        "isEffectiveIdentityRequired": data.get("isEffectiveIdentityRequired"),
        "isEffectiveIdentityRolesRequired": data.get("isEffectiveIdentityRolesRequired"),
        "targetStorageMode": data.get("targetStorageMode", "?"),
        "createdDate": data.get("createdDate"),
        "webUrl": data.get("webUrl"),
    }


def get_workspace_details(workspace_id: str) -> Dict[str, Any]:
    """Get workspace name and properties."""
    data = fab_api(f"groups/{workspace_id}")
    if not data or not isinstance(data, dict):
        return {"name": "?", "id": workspace_id}
    return {
        "name": data.get("name", "?"),
        "id": workspace_id,
        "type": data.get("type", "?"),
        "state": data.get("state", "?"),
    }


def get_connected_reports(workspace_id: str, model_id: str) -> List[Dict]:
    """Find all reports connected to this model across accessible workspaces."""
    reports = []

    # Check reports in the same workspace first
    data = fab_api(f"groups/{workspace_id}/reports")
    if data and isinstance(data, dict):
        for r in data.get("value", []):
            if r.get("datasetId") == model_id:
                reports.append({
                    "name": r.get("name", "?"),
                    "id": r.get("id", "?"),
                    "workspace": workspace_id,
                    "format": r.get("format", "?"),
                    "same_workspace": True,
                })

    # Check other workspaces via admin API (if available)
    admin_data = fab_api(f"admin/datasets/{model_id}/upstreamReports")
    if admin_data and isinstance(admin_data, dict):
        for r in admin_data.get("value", []):
            rid = r.get("id", "")
            if not any(rpt["id"] == rid for rpt in reports):
                reports.append({
                    "name": r.get("name", "?"),
                    "id": rid,
                    "workspace": r.get("workspaceId", "?"),
                    "same_workspace": False,
                })

    return reports


def get_deployment_pipeline(workspace_id: str) -> Optional[Dict]:
    """Check if this workspace belongs to a deployment pipeline."""
    data = fab_api("admin/pipelines")
    if not data or not isinstance(data, dict):
        return None

    for pipeline in data.get("value", []):
        pid = pipeline.get("id", "")
        stages_data = fab_api(f"admin/pipelines/{pid}/stages")
        if not stages_data or not isinstance(stages_data, dict):
            continue
        for stage in stages_data.get("value", []):
            if stage.get("workspaceId") == workspace_id:
                return {
                    "pipeline_name": pipeline.get("displayName", "?"),
                    "pipeline_id": pid,
                    "stage_order": stage.get("order"),
                }
    return None


def get_endorsement(model_id: str) -> Optional[Dict]:
    """Check endorsement status via admin API."""
    data = fab_api(f"admin/datasets/{model_id}")
    if not data or not isinstance(data, dict):
        return None
    endorsement = data.get("endorsementDetails")
    if endorsement:
        return {
            "status": endorsement.get("endorsement", "None"),
            "certifiedBy": endorsement.get("certifiedBy"),
        }
    return {"status": "None", "certifiedBy": None}


def get_sensitivity_label(workspace_id: str, model_id: str) -> Optional[str]:
    """Check sensitivity label via fab CLI."""
    try:
        result = subprocess.run(
            ["fab", "api", "-A", "powerbi",
             f"admin/datasets/{model_id}"],
            capture_output=True, text=True, timeout=15
        )
        if result.returncode == 0:
            raw = json.loads(result.stdout)
            data = raw.get("text", raw)
            label = data.get("sensitivityLabel")
            if label:
                return label.get("labelId", "Unknown")
        return None
    except Exception:
        return None


def get_data_sources(workspace_id: str, model_id: str) -> List[Dict]:
    """Get data sources configured for this model."""
    data = fab_api(f"groups/{workspace_id}/datasets/{model_id}/datasources")
    if not data or not isinstance(data, dict):
        return []

    sources = []
    for ds in data.get("value", []):
        source = {
            "type": ds.get("datasourceType", "?"),
            "gateway": ds.get("gatewayId"),
        }
        conn = ds.get("connectionDetails", {})
        if conn:
            source["server"] = conn.get("server", "")
            source["database"] = conn.get("database", "")
            source["path"] = conn.get("path", "")
            source["url"] = conn.get("url", "")
        sources.append(source)

    return sources


def get_refresh_history(workspace_id: str, model_id: str) -> Dict[str, Any]:
    """Get recent refresh history."""
    data = fab_api(f"groups/{workspace_id}/datasets/{model_id}/refreshes?$top=5")
    if not data or not isinstance(data, dict):
        return {"refreshes": [], "schedule": None}

    refreshes = []
    for r in data.get("value", []):
        refreshes.append({
            "status": r.get("status", "?"),
            "startTime": r.get("startTime"),
            "endTime": r.get("endTime"),
            "refreshType": r.get("refreshType", "?"),
        })

    # Get refresh schedule
    schedule_data = fab_api(f"groups/{workspace_id}/datasets/{model_id}/refreshSchedule")
    schedule = None
    if schedule_data and isinstance(schedule_data, dict):
        schedule = {
            "enabled": schedule_data.get("enabled"),
            "frequency": schedule_data.get("days"),
            "times": schedule_data.get("times"),
            "timezone": schedule_data.get("localTimeZoneId"),
        }

    return {"refreshes": refreshes, "schedule": schedule}


def get_datahub_enrichment(model_id: str, region: str) -> Optional[Dict]:
    """Enrich with DataHub V2 metadata (storage mode, size, capacity SKU, owner)."""
    token = get_token()
    if not token:
        return None

    host = REGIONS.get(region, REGIONS[DEFAULT_REGION])
    url = f"https://{host}/metadata/datahub/V2/artifacts"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    payload = {
        "filters": [],
        "hostFamily": 4,
        "orderBy": "Default",
        "pageNumber": 1,
        "pageSize": 200,
        "supportedTypes": ["Model"],
        "tridentSupportedTypes": ["model"]
    }

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=30)
        if resp.status_code == 200:
            items = resp.json()
            for item in items:
                oid = (item.get("artifactObjectId") or "").lower()
                if oid == model_id.lower():
                    artifact = item.get("artifact", {})
                    return {
                        "storageMode": "DirectLake" if artifact.get("directLakeMode") else
                                       ("Import" if artifact.get("storageMode") == 1 else
                                        "DirectQuery" if artifact.get("storageMode") == 2 else "Unknown"),
                        "sizeInMBs": artifact.get("sizeInMBs"),
                        "capacitySku": artifact.get("sharedFromEnterpriseCapacitySku"),
                        "owner": item.get("ownerUser", {}).get("emailAddress"),
                        "lastVisited": item.get("lastVisitedTimeUTC"),
                        "lastRefresh": artifact.get("LastRefreshTime"),
                        "isInEnterpriseCapacity": artifact.get("isInEnterpriseCapacity"),
                    }
    except Exception:
        pass
    return None

#endregion


#region Output

def format_info(info: Dict[str, Any]) -> str:
    """Format model info as readable ASCII output."""
    lines = []
    lines.append("=" * 72)
    lines.append(f"  SEMANTIC MODEL INFO")
    lines.append("=" * 72)

    m = info.get("model", {})
    ws = info.get("workspace", {})
    dh = info.get("datahub", {}) or {}
    endorsement = info.get("endorsement", {}) or {}
    pipeline = info.get("pipeline")

    lines.append("")
    lines.append(f"  Name:           {m.get('name', '?')}")
    lines.append(f"  Workspace:      {ws.get('name', '?')}")
    lines.append(f"  Storage mode:   {dh.get('storageMode', m.get('targetStorageMode', '?'))}")
    lines.append(f"  Size:           {dh.get('sizeInMBs', '?')} MB")
    lines.append(f"  Configured by:  {m.get('configuredBy', '?')}")
    lines.append(f"  Owner:          {dh.get('owner', '?')}")
    lines.append(f"  Capacity:       {dh.get('capacitySku', '?')}")
    lines.append(f"  Endorsement:    {endorsement.get('status', '?')}")

    label = info.get("sensitivity_label")
    lines.append(f"  Sensitivity:    {label if label else 'None'}")

    if pipeline:
        stage_names = {0: "Development", 1: "Test", 2: "Production"}
        stage = stage_names.get(pipeline.get("stage_order"), f"Stage {pipeline.get('stage_order')}")
        lines.append(f"  Pipeline:       {pipeline.get('pipeline_name', '?')} ({stage})")
    else:
        lines.append(f"  Pipeline:       None")

    lines.append(f"  Last visited:   {dh.get('lastVisited', '?')}")
    lines.append(f"  RLS:            {'Yes' if m.get('isEffectiveIdentityRolesRequired') else 'No'}")

    # Refresh
    refresh = info.get("refresh", {})
    schedule = refresh.get("schedule")
    if schedule and schedule.get("enabled"):
        days = schedule.get("frequency", [])
        times = schedule.get("times", [])
        lines.append(f"  Refresh:        {', '.join(str(d) for d in days)} at {', '.join(times)}")
    else:
        lines.append(f"  Refresh:        Manual / not scheduled")

    recent = refresh.get("refreshes", [])
    if recent:
        last = recent[0]
        lines.append(f"  Last refresh:   {last.get('startTime', '?')} ({last.get('status', '?')})")

    # Data sources
    sources = info.get("data_sources", [])
    if sources:
        lines.append("")
        lines.append(f"  DATA SOURCES ({len(sources)})")
        lines.append(f"  {'─' * 50}")
        for s in sources:
            loc = s.get("server") or s.get("path") or s.get("url") or "?"
            db = f" / {s['database']}" if s.get("database") else ""
            lines.append(f"    {s.get('type', '?')}: {loc}{db}")

    # Connected reports
    reports = info.get("connected_reports", [])
    if reports:
        lines.append("")
        lines.append(f"  CONNECTED REPORTS ({len(reports)})")
        lines.append(f"  {'─' * 50}")
        for r in reports:
            loc = "(same workspace)" if r.get("same_workspace") else f"(workspace: {r.get('workspace', '?')[:12]}...)"
            fmt = f" [{r.get('format', '')}]" if r.get("format") else ""
            lines.append(f"    {r.get('name', '?')}{fmt} {loc}")

    lines.append("")
    lines.append("=" * 72)
    return "\n".join(lines)

#endregion


#region Main

def main():
    parser = argparse.ArgumentParser(
        description="Retrieve comprehensive semantic model metadata.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument("--workspace-id", "-w", required=True, help="Workspace GUID")
    parser.add_argument("--model-id", "-m", required=True, help="Semantic model (dataset) GUID")
    parser.add_argument("--region", default=DEFAULT_REGION,
                        choices=list(REGIONS.keys()), help=f"Power BI region (default: {DEFAULT_REGION})")
    parser.add_argument("--output", "-o", choices=["table", "json"], default="table",
                        help="Output format (default: table)")

    args = parser.parse_args()

    print("Gathering model metadata...", file=sys.stderr)

    info = {
        "model": get_model_details(args.workspace_id, args.model_id),
        "workspace": get_workspace_details(args.workspace_id),
        "connected_reports": get_connected_reports(args.workspace_id, args.model_id),
        "pipeline": get_deployment_pipeline(args.workspace_id),
        "endorsement": get_endorsement(args.model_id),
        "sensitivity_label": get_sensitivity_label(args.workspace_id, args.model_id),
        "data_sources": get_data_sources(args.workspace_id, args.model_id),
        "refresh": get_refresh_history(args.workspace_id, args.model_id),
        "datahub": get_datahub_enrichment(args.model_id, args.region),
    }

    if args.output == "json":
        print(json.dumps(info, indent=2, default=str))
    else:
        print(format_info(info))


if __name__ == "__main__":
    main()

#endregion
