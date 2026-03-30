#!/usr/bin/env python3
"""
Report Usage Metrics Script
get_report_usage.py

Retrieve report usage data from Power BI using multiple API tiers.
Returns report views, page views, load times, and ranking across the org.

AGENT USAGE GUIDE:
------------------
This script retrieves usage metrics for reports in a Power BI workspace.
It uses three tiers of data, each providing progressively richer information:

  Tier 1 (WABI Metrics): Report views, page views, load times, org rank (no model needed)
  Tier 2 (Usage Metrics Model): Pre-built DAX measures, aggregated stats (requires model generation)
  Tier 3 (DataHub V2): Last visited timestamp across all workspaces

TOKEN SECURITY:
  The script obtains auth tokens via `az account get-access-token` in a subprocess.
  Tokens are held in memory only and never printed, logged, or written to disk.
  Ensure `az login` has been run before using this script.

COMMON PATTERNS:
  # Get usage summary for a workspace (Tier 1 only -- fast, no side effects)
  python3 get_report_usage.py --workspace-id <guid>

  # Get usage for a single report
  python3 get_report_usage.py --workspace-id <guid> --report-id <guid>

  # Include DataHub last-visited timestamps (Tier 3)
  python3 get_report_usage.py --workspace-id <guid> --include-datahub

  # JSON output for programmatic use
  python3 get_report_usage.py --workspace-id <guid> --output json

  # Specify region (default: west-europe)
  python3 get_report_usage.py --workspace-id <guid> --region us-east

PREREQUISITES:
  - Azure CLI authenticated: `az login`
  - Python packages: requests (uv pip install requests)
  - Workspace Contributor/Member/Admin role for Tier 2 (model generation)

OUTPUT:
  Returns a structured summary including:
  - Report view counts and org rank
  - Unique viewers and distribution methods
  - Page-level view breakdown
  - Load time percentiles P10/P50/P90
  - Last visited timestamps (with --include-datahub)
"""

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
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
    "us-north-central": "wabi-us-north-central-c-primary-redirect.analysis.windows.net",
    "us-south-central": "wabi-us-south-central-e-primary-redirect.analysis.windows.net",
    "south-east-asia": "wabi-south-east-asia-b-primary-redirect.analysis.windows.net",
    "australia-east": "wabi-australia-east-b-primary-redirect.analysis.windows.net",
    "brazil-south": "wabi-brazil-south-a-primary-redirect.analysis.windows.net",
    "canada-central": "wabi-canada-central-a-primary-redirect.analysis.windows.net",
    "india-west": "wabi-india-west-a-primary-redirect.analysis.windows.net",
    "japan-east": "wabi-japan-east-a-primary-redirect.analysis.windows.net",
    "uk-south": "wabi-uk-south-a-primary-redirect.analysis.windows.net",
}

DEFAULT_REGION = "west-europe"

#endregion


#region Authentication

def get_token() -> Optional[str]:
    """
    Obtain a Power BI API access token via Azure CLI.

    Returns the access token string, or None on failure.
    Tokens are captured in-process and never printed or logged.
    """
    try:
        result = subprocess.run(
            ["az", "account", "get-access-token",
             "--resource", "https://analysis.windows.net/powerbi/api"],
            capture_output=True, text=True, timeout=30
        )

        if result.returncode == 0:
            data = json.loads(result.stdout)
            return data.get("accessToken")

        print("Error: Azure CLI not authenticated. Run 'az login' first.", file=sys.stderr)
        return None

    except subprocess.TimeoutExpired:
        print("Error: Token request timed out.", file=sys.stderr)
        return None
    except FileNotFoundError:
        print("Error: Azure CLI not installed. Install with 'brew install azure-cli'.", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Error getting token: {type(e).__name__}", file=sys.stderr)
        return None

#endregion


#region WABI Metrics API (Tier 1)

def wabi_get(token: str, region: str, workspace_id: str, endpoint: str) -> Optional[List[Dict]]:
    """
    Call a WABI metrics endpoint for a workspace.

    Args:
        token: Power BI access token
        region: Region key from REGIONS dict
        workspace_id: Workspace GUID
        endpoint: Metric type (reportviews, reportmetadata, reportrank, reportpagesectionmetadata)

    Returns:
        List of dicts on success, None on error.
    """
    host = REGIONS.get(region, REGIONS[DEFAULT_REGION])
    url = f"https://{host}/metadata/v201906/metrics/workspace/{workspace_id}/{endpoint}"
    headers = {"Authorization": f"Bearer {token}"}

    try:
        resp = requests.get(url, headers=headers, timeout=30)
        if resp.status_code == 200:
            return resp.json()
        else:
            print(f"Warning: WABI {endpoint} returned {resp.status_code}", file=sys.stderr)
            return None
    except Exception as e:
        print(f"Warning: WABI {endpoint} failed: {type(e).__name__}", file=sys.stderr)
        return None


def get_tier1_data(token: str, region: str, workspace_id: str, report_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Retrieve Tier 1 usage data from WABI metrics endpoints.

    Collects report views, page views, load times, page metadata, report
    metadata, and org rank without generating a usage metrics model.

    Args:
        token: Power BI access token
        region: Region key
        workspace_id: Workspace GUID
        report_id: Optional report GUID to filter results

    Returns:
        Dict with keys: report_views, page_views, report_loads, report_metadata,
                        page_metadata, report_rank
    """
    report_views = wabi_get(token, region, workspace_id, "reportviews") or []
    page_views = wabi_get(token, region, workspace_id, "reportpagesectionviews") or []
    report_loads = wabi_get(token, region, workspace_id, "reportloads") or []
    report_metadata = wabi_get(token, region, workspace_id, "reportmetadata") or []
    page_metadata = wabi_get(token, region, workspace_id, "reportpagesectionmetadata") or []
    report_rank = wabi_get(token, region, workspace_id, "reportrank") or []

    # Filter to specific report if requested
    if report_id:
        report_views = [v for v in report_views if v.get("ReportId") == report_id]
        page_views = [v for v in page_views if v.get("ReportId") == report_id]
        report_loads = [v for v in report_loads if v.get("ReportId") == report_id]
        report_metadata = [r for r in report_metadata if r.get("ReportId") == report_id]
        page_metadata = [p for p in page_metadata if p.get("ReportId") == report_id]
        report_rank = [r for r in report_rank if r.get("ReportId") == report_id]

    return {
        "report_views": report_views,
        "page_views": page_views,
        "report_loads": report_loads,
        "report_metadata": report_metadata,
        "page_metadata": page_metadata,
        "report_rank": report_rank,
    }

#endregion


#region Usage Metrics Model (Tier 2)

def generate_usage_model(token: str, region: str, workspace_id: str) -> Optional[str]:
    """
    Generate or refresh the Usage Metrics Model for a workspace.

    Calls the undocumented beta endpoint to create the hidden usage metrics
    semantic model. This is equivalent to clicking "View usage metrics" in
    the Power BI service.

    Args:
        token: Power BI access token
        region: Region key
        workspace_id: Workspace GUID

    Returns:
        Dataset ID (GUID) of the generated model, or None on failure.
    """
    host = REGIONS.get(region, REGIONS[DEFAULT_REGION])
    url = f"https://{host}/beta/myorg/groups/{workspace_id}/usageMetricsReportV2"
    headers = {"Authorization": f"Bearer {token}"}

    try:
        resp = requests.get(url, headers=headers, timeout=60)
        if resp.status_code in (200, 202):
            data = resp.json()
            models = data.get("models", [])
            if models:
                dataset_id = models[0].get("dbName")
                return dataset_id
        print(f"Warning: Usage model generation returned {resp.status_code}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Warning: Usage model generation failed: {type(e).__name__}", file=sys.stderr)
        return None


def dax_query(token: str, workspace_id: str, dataset_id: str, query: str) -> Optional[List[Dict]]:
    """
    Execute a DAX query against a dataset via the Power BI REST API.

    Args:
        token: Power BI access token
        workspace_id: Workspace GUID
        dataset_id: Dataset GUID
        query: DAX query string

    Returns:
        List of row dicts on success, None on error.
    """
    url = f"https://api.powerbi.com/v1.0/myorg/groups/{workspace_id}/datasets/{dataset_id}/executeQueries"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {
        "queries": [{"query": query}],
        "serializerSettings": {"includeNulls": True}
    }

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            results = data.get("results", [])
            if results:
                tables = results[0].get("tables", [])
                if tables:
                    return tables[0].get("rows", [])
        return None
    except Exception:
        return None


def get_tier2_data(token: str, region: str, workspace_id: str, report_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Retrieve Tier 2 usage data from the Usage Metrics Model.

    Generates (or refreshes) the usage metrics model, then queries it
    for page-level views and load time performance data.

    Args:
        token: Power BI access token
        region: Region key
        workspace_id: Workspace GUID
        report_id: Optional report GUID to filter results

    Returns:
        Dict with keys: page_views, load_times, dataset_id
    """
    dataset_id = generate_usage_model(token, region, workspace_id)
    if not dataset_id:
        return {"page_views": [], "load_times": [], "dataset_id": None}

    # Query page views
    report_filter = f"'Report page views'[ReportId] = \"{report_id}\"" if report_id else ""
    page_views_dax = f"EVALUATE CALCULATETABLE('Report page views'{', ' + report_filter if report_filter else ''})"
    page_views = dax_query(token, workspace_id, dataset_id, page_views_dax) or []

    # Query load times
    load_filter = f"'Report load times'[ReportId] = \"{report_id}\"" if report_id else ""
    load_times_dax = f"EVALUATE CALCULATETABLE('Report load times'{', ' + load_filter if load_filter else ''})"
    load_times = dax_query(token, workspace_id, dataset_id, load_times_dax) or []

    return {
        "page_views": page_views,
        "load_times": load_times,
        "dataset_id": dataset_id,
    }

#endregion


#region DataHub V2 (Tier 3)

def get_datahub_data(token: str, region: str, workspace_id: str, report_id: Optional[str] = None) -> List[Dict]:
    """
    Retrieve last-visited timestamps from the DataHub V2 API.

    The DataHub API returns metadata not available via other APIs, including
    when each item was last accessed by any user.

    Args:
        token: Power BI access token
        region: Region key
        workspace_id: Workspace GUID
        report_id: Optional report GUID to filter results

    Returns:
        List of item dicts with lastVisitedTimeUTC and other metadata.
    """
    host = REGIONS.get(region, REGIONS[DEFAULT_REGION])
    url = f"https://{host}/metadata/datahub/V2/artifacts"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    payload = {
        "filters": [{"datahubFilterType": "workspace", "values": [workspace_id]}],
        "hostFamily": 4,
        "orderBy": "Default",
        "orderDirection": "",
        "pageNumber": 1,
        "pageSize": 200,
        "supportedTypes": ["PowerBIReport"],
        "tridentSupportedTypes": ["powerbireport"]
    }

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=30)
        if resp.status_code == 200:
            items = resp.json()
            if isinstance(items, list):
                if report_id:
                    items = [i for i in items if i.get("artifactObjectId", "").lower() == report_id.lower()]
                return items
        return []
    except Exception:
        return []

#endregion


#region Output Formatting

def clean_column_name(key: str) -> str:
    """Strip table prefix from DAX column names like 'Report views[UserId]' -> 'UserId'."""
    if "[" in key and key.endswith("]"):
        return key.split("[")[1].rstrip("]")
    return key


def clean_key(row: Dict, target_col: str) -> str:
    """Find the full key in a DAX result row that ends with the target column name."""
    for k in row:
        col = clean_column_name(k)
        if col == target_col:
            return k
    return target_col


def _new_report_entry(name: str, rid: str) -> Dict[str, Any]:
    """Create a fresh report summary dict."""
    return {
        "name": name,
        "id": rid,
        "total_views": 0,
        "unique_viewers": set(),
        "distribution_methods": set(),
        "consumption_methods": set(),
        "rank": None,
        "rank_total": None,
        "pages": [],
        "page_views": {},
        "load_times": [],
        "last_visited": None,
    }


def build_summary(tier1: Dict, tier2: Optional[Dict], datahub: Optional[List]) -> Dict[str, Any]:
    """
    Build a unified summary from all tiers of data.

    Combines report views, page views, load times, ranking, and last-visited
    into a structured summary dict per report.

    Args:
        tier1: Output from get_tier1_data
        tier2: Output from get_tier2_data (or None)
        datahub: Output from get_datahub_data (or None)

    Returns:
        Dict with per-report summaries and workspace-level stats.
    """
    reports = {}

    # Populate from report metadata
    for r in tier1["report_metadata"]:
        rid = r.get("ReportId", "")
        if r.get("IsUsageMetricsReport"):
            continue
        reports[rid] = _new_report_entry(r.get("ReportName", "?"), rid)

    # Populate from report views
    for v in tier1["report_views"]:
        rid = v.get("ReportId", "")
        if rid not in reports:
            reports[rid] = _new_report_entry(v.get("ReportName", "?"), rid)
        reports[rid]["total_views"] += 1
        user_id = v.get("UserId", "")
        if user_id:
            reports[rid]["unique_viewers"].add(user_id)
        dist = v.get("DistributionMethod", "")
        if dist:
            reports[rid]["distribution_methods"].add(dist)
        cons = v.get("ConsumptionMethod", "")
        if cons:
            reports[rid]["consumption_methods"].add(cons)

    # Populate from rank
    for r in tier1["report_rank"]:
        rid = r.get("ReportId", "")
        if rid in reports:
            reports[rid]["rank"] = r.get("ReportRank")
            reports[rid]["rank_total"] = r.get("TotalReportCount")
            reports[rid]["total_views"] = max(reports[rid]["total_views"], r.get("ReportViewCount", 0))

    # Populate pages
    for p in tier1["page_metadata"]:
        rid = p.get("ReportId", "")
        if rid in reports:
            reports[rid]["pages"].append({
                "section_id": p.get("SectionId", ""),
                "name": p.get("SectionName", ""),
            })

    # Populate page views from Tier 1 WABI endpoint
    for pv in tier1.get("page_views", []):
        rid = pv.get("ReportId", "")
        sid = pv.get("SectionId", "")
        if rid in reports and sid:
            if sid not in reports[rid]["page_views"]:
                reports[rid]["page_views"][sid] = 0
            reports[rid]["page_views"][sid] += 1

    # Populate load times from Tier 1 WABI endpoint
    for rl in tier1.get("report_loads", []):
        rid = rl.get("ReportId", "")
        start = rl.get("StartTime")
        end = rl.get("EndTime")
        if rid in reports and start and end:
            try:
                from datetime import datetime as dt
                t_start = dt.fromisoformat(start)
                t_end = dt.fromisoformat(end)
                load_secs = (t_end - t_start).total_seconds()
                if load_secs >= 0:
                    reports[rid]["load_times"].append(load_secs)
            except (ValueError, TypeError):
                pass

    # Overlay Tier 2 data if available (adds any events not in Tier 1)
    if tier2:
        for pv in tier2.get("page_views", []):
            rid = pv.get(clean_key(pv, "ReportId"), "")
            sid = pv.get(clean_key(pv, "SectionId"), "")
            if rid in reports and sid:
                if sid not in reports[rid]["page_views"]:
                    reports[rid]["page_views"][sid] = 0
                reports[rid]["page_views"][sid] += 1

        for lt in tier2.get("load_times", []):
            rid = lt.get(clean_key(lt, "ReportId"), "")
            load_time = lt.get(clean_key(lt, "loadTime"))
            if rid in reports and load_time is not None:
                reports[rid]["load_times"].append(load_time)

    # Populate DataHub last visited
    if datahub:
        for item in datahub:
            rid = (item.get("artifactObjectId") or "").lower()
            for key, report in reports.items():
                if key.lower() == rid:
                    report["last_visited"] = item.get("lastVisitedTimeUTC")
                    break

    # Convert sets to lists for serialization
    for r in reports.values():
        r["unique_viewers"] = list(r["unique_viewers"])
        r["distribution_methods"] = list(r["distribution_methods"])
        r["consumption_methods"] = list(r["consumption_methods"])

    return {"reports": reports}


def format_table(summary: Dict[str, Any], page_metadata: List[Dict]) -> str:
    """
    Format the summary as a readable ASCII table.

    Args:
        summary: Output from build_summary
        page_metadata: Page section metadata for name lookups

    Returns:
        Formatted string with report usage data.
    """
    # Build page name lookup
    page_names = {}
    for p in page_metadata:
        key = (p.get("ReportId", ""), p.get("SectionId", ""))
        page_names[key] = p.get("SectionName", "?")

    lines = []
    lines.append("=" * 72)
    lines.append("REPORT USAGE SUMMARY")
    lines.append("=" * 72)

    reports = summary.get("reports", {})
    sorted_reports = sorted(reports.values(), key=lambda r: r.get("total_views", 0), reverse=True)

    for r in sorted_reports:
        lines.append("")
        lines.append(f"  {r['name']}")
        lines.append(f"  {'─' * 60}")

        rank_str = f"#{r['rank']}/{r['rank_total']}" if r.get("rank") else "N/A"
        lines.append(f"  Views: {r['total_views']:<8} Rank: {rank_str:<12} Viewers: {len(r['unique_viewers'])}")

        if r.get("last_visited"):
            lines.append(f"  Last visited: {r['last_visited']}")

        if r.get("distribution_methods"):
            methods = [m for m in r["distribution_methods"] if m]
            if methods:
                lines.append(f"  Distribution: {', '.join(methods)}")

        if r.get("consumption_methods"):
            methods = [m for m in r["consumption_methods"] if m]
            if methods:
                lines.append(f"  Consumed via: {', '.join(methods)}")

        # Page views breakdown
        if r.get("page_views"):
            lines.append(f"  Page views:")
            page_sorted = sorted(r["page_views"].items(), key=lambda x: x[1], reverse=True)
            for sid, count in page_sorted:
                pname = page_names.get((r["id"], sid), sid[:12] + "...")
                lines.append(f"    {count:>4}  {pname}")

        # Load time percentiles
        if r.get("load_times"):
            times = sorted(r["load_times"])
            n = len(times)
            p10 = times[max(0, int(n * 0.1))]
            p50 = times[max(0, int(n * 0.5))]
            p90 = times[max(0, min(n - 1, int(n * 0.9)))]
            lines.append(f"  Load times (s): P10={p10:.1f}  P50={p50:.1f}  P90={p90:.1f}  (n={n})")

        # Pages without views
        if r.get("pages") and r.get("page_views"):
            viewed_sids = set(r["page_views"].keys())
            unviewed = [p for p in r["pages"] if p["section_id"] not in viewed_sids]
            if unviewed:
                lines.append(f"  Pages with 0 views:")
                for p in unviewed:
                    lines.append(f"          {p['name']}")

    lines.append("")
    lines.append("=" * 72)

    # Reports with 0 views
    zero_view = [r for r in sorted_reports if r["total_views"] == 0]
    if zero_view:
        lines.append(f"  Reports with 0 views: {len(zero_view)}")
        for r in zero_view:
            lv = r.get("last_visited", "never")
            lines.append(f"    - {r['name']} (last visited: {lv})")
        lines.append("")

    return "\n".join(lines)

#endregion


#region Main

def main():
    parser = argparse.ArgumentParser(
        description="Retrieve Power BI report usage metrics.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --workspace-id <guid>
  %(prog)s --workspace-id <guid> --report-id <guid>
  %(prog)s --workspace-id <guid> --include-model --include-datahub
  %(prog)s --workspace-id <guid> --output json
        """
    )

    parser.add_argument("--workspace-id", "-w", required=True, help="Workspace GUID")
    parser.add_argument("--report-id", "-r", help="Optional report GUID to filter")
    parser.add_argument("--include-model", action="store_true",
                        help="Generate and query Usage Metrics Model for page views and load times (Tier 2)")
    parser.add_argument("--include-datahub", action="store_true",
                        help="Include DataHub V2 last-visited timestamps (Tier 3)")
    parser.add_argument("--region", default=DEFAULT_REGION,
                        choices=list(REGIONS.keys()), help=f"Power BI region (default: {DEFAULT_REGION})")
    parser.add_argument("--output", "-o", choices=["table", "json"], default="table",
                        help="Output format (default: table)")

    args = parser.parse_args()

    # Authenticate
    print("Authenticating...", file=sys.stderr)
    token = get_token()
    if not token:
        sys.exit(1)

    # Tier 1: WABI metrics (always)
    print("Fetching report metrics (Tier 1)...", file=sys.stderr)
    tier1 = get_tier1_data(token, args.region, args.workspace_id, args.report_id)

    # Tier 2: Usage Metrics Model (optional)
    tier2 = None
    if args.include_model:
        print("Generating Usage Metrics Model (Tier 2)...", file=sys.stderr)
        tier2 = get_tier2_data(token, args.region, args.workspace_id, args.report_id)

    # Tier 3: DataHub (optional)
    datahub = None
    if args.include_datahub:
        print("Fetching DataHub metadata (Tier 3)...", file=sys.stderr)
        datahub = get_datahub_data(token, args.region, args.workspace_id, args.report_id)

    # Build summary
    summary = build_summary(tier1, tier2, datahub)

    # Output
    if args.output == "json":
        print(json.dumps(summary, indent=2, default=str))
    else:
        print(format_table(summary, tier1.get("page_metadata", [])))


if __name__ == "__main__":
    main()

#endregion
