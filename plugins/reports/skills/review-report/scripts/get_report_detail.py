#!/usr/bin/env python3
"""
Report Detail Script
get_report_detail.py

Deep-dive into a single Power BI report's usage: daily view breakdown,
per-viewer stats, page-level analytics, load times, and audience reach.

AGENT USAGE GUIDE:
------------------
Use this script to evaluate a single report's adoption and engagement.
It answers: who is looking at it, how frequently, which pages, and how
does actual viewership compare to the total possible audience.

COMMON PATTERNS:
  # Full report detail
  python3 get_report_detail.py -w <workspace-id> -r <report-id>

  # JSON output for programmatic use
  python3 get_report_detail.py -w <workspace-id> -r <report-id> --output json

  # Specify region
  python3 get_report_detail.py -w <workspace-id> -r <report-id> --region us-east

PREREQUISITES:
  - Azure CLI authenticated: `az login`
  - Python packages: requests (uv pip install requests)

TOKEN SECURITY:
  Auth tokens obtained via `az account get-access-token` in a subprocess.
  Tokens held in memory only -- never printed, logged, or written to disk.

OUTPUT:
  - Daily view counts over the reporting period
  - Per-viewer breakdown (views, last seen, consumption method)
  - Page-level view counts with page names
  - Load time percentiles and geographic distribution
  - Audience reach: viewers vs users with access (via ACL)
"""

import argparse
import json
import subprocess
import sys
from collections import defaultdict
from datetime import datetime
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


#region WABI API

def wabi_get(token: str, region: str, workspace_id: str, endpoint: str) -> Optional[List[Dict]]:
    """
    Call a WABI metrics endpoint for a workspace.

    Args:
        token: Power BI access token
        region: Region key from REGIONS dict
        workspace_id: Workspace GUID
        endpoint: Metric type

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

#endregion


#region ACL Lookup

def get_report_acl(workspace_id: str, report_id: str) -> List[Dict[str, str]]:
    """
    Retrieve the access control list for a report via fab CLI.

    Uses workspace-level and report-level APIs to get all users.
    Service principals (type=App) are included but flagged.

    Args:
        workspace_id: Workspace GUID
        report_id: Report GUID

    Returns:
        List of dicts with 'principal', 'role', and 'type' keys.
    """
    acl = []

    # Workspace-level permissions
    try:
        result = subprocess.run(
            ["fab", "api", "-A", "powerbi",
             f"groups/{workspace_id}/users"],
            capture_output=True, text=True, timeout=30
        )

        if result.returncode == 0:
            raw = json.loads(result.stdout)
            data = raw.get("text", raw)
            users = data.get("value", [])
            for u in users:
                acl.append({
                    "principal": u.get("emailAddress") or u.get("displayName") or u.get("identifier", "?"),
                    "role": u.get("groupUserAccessRight", "?"),
                    "type": u.get("principalType", "?"),
                })
    except Exception:
        pass

    # Report-level permissions
    try:
        result = subprocess.run(
            ["fab", "api", "-A", "powerbi",
             f"groups/{workspace_id}/reports/{report_id}/users"],
            capture_output=True, text=True, timeout=30
        )

        if result.returncode == 0:
            raw = json.loads(result.stdout)
            data = raw.get("text", raw)
            users = data.get("value", [])
            existing = {a["principal"] for a in acl}
            for u in users:
                principal = u.get("emailAddress") or u.get("displayName") or u.get("identifier", "?")
                if principal not in existing:
                    acl.append({
                        "principal": principal,
                        "role": u.get("reportUserAccessRight", "?"),
                        "type": u.get("principalType", "?"),
                    })
    except Exception:
        pass

    return acl

#endregion


#region Data Collection

def collect_report_data(
    token: str, region: str, workspace_id: str, report_id: str
) -> Dict[str, Any]:
    """
    Collect all usage data for a single report from WABI endpoints.

    Args:
        token: Power BI access token
        region: Region key
        workspace_id: Workspace GUID
        report_id: Report GUID

    Returns:
        Dict with report_views, page_views, report_loads, page_metadata,
        report_rank, and report_metadata filtered to the target report.
    """
    report_views = wabi_get(token, region, workspace_id, "reportviews") or []
    page_views = wabi_get(token, region, workspace_id, "reportpagesectionviews") or []
    report_loads = wabi_get(token, region, workspace_id, "reportloads") or []
    page_metadata = wabi_get(token, region, workspace_id, "reportpagesectionmetadata") or []
    report_rank = wabi_get(token, region, workspace_id, "reportrank") or []
    report_metadata = wabi_get(token, region, workspace_id, "reportmetadata") or []

    return {
        "report_views": [v for v in report_views if v.get("ReportId") == report_id],
        "page_views": [v for v in page_views if v.get("ReportId") == report_id],
        "report_loads": [v for v in report_loads if v.get("ReportId") == report_id],
        "page_metadata": [p for p in page_metadata if p.get("ReportId") == report_id],
        "report_rank": [r for r in report_rank if r.get("ReportId") == report_id],
        "report_metadata": [r for r in report_metadata if r.get("ReportId") == report_id],
    }

#endregion


#region Analysis

def analyze_report(data: Dict[str, Any], acl: List[Dict]) -> Dict[str, Any]:
    """
    Analyze collected report data into a structured detail summary.

    Args:
        data: Output from collect_report_data
        acl: Output from get_report_acl

    Returns:
        Dict with overview, daily_views, viewers, pages, performance, audience.
    """
    views = data["report_views"]
    page_views = data["page_views"]
    loads = data["report_loads"]
    pages_meta = data["page_metadata"]
    rank = data["report_rank"]
    meta = data["report_metadata"]

    # Page name lookup
    page_names = {}
    for p in pages_meta:
        page_names[p.get("SectionId", "")] = p.get("SectionName", "?")

    # Report name
    report_name = "?"
    if meta:
        report_name = meta[0].get("ReportName", "?")
    elif views:
        report_name = views[0].get("ReportName", "?")

    # Overview
    overview = {
        "name": report_name,
        "total_views": len(views),
        "unique_viewers": len({v.get("UserId", "") for v in views if v.get("UserId")}),
        "rank": rank[0].get("ReportRank") if rank else None,
        "rank_total": rank[0].get("TotalReportCount") if rank else None,
        "rank_view_count": rank[0].get("ReportViewCount") if rank else None,
    }

    # Daily views
    daily = defaultdict(int)
    for v in views:
        ts = v.get("CreationTime", "")
        if ts:
            day = ts[:10]
            daily[day] += 1
    daily_sorted = sorted(daily.items())

    # Per-viewer breakdown
    viewer_stats = defaultdict(lambda: {
        "views": 0, "last_seen": "", "methods": set(), "agents": set()
    })
    for v in views:
        uid = v.get("UserId", "")
        if not uid:
            continue
        viewer_stats[uid]["views"] += 1
        ts = v.get("CreationTime", "")
        if ts > viewer_stats[uid]["last_seen"]:
            viewer_stats[uid]["last_seen"] = ts
        method = v.get("ConsumptionMethod", "")
        if method:
            viewer_stats[uid]["methods"].add(method)
        agent = v.get("UserAgent", "")
        if agent:
            # Extract browser name
            if "Chrome" in agent:
                viewer_stats[uid]["agents"].add("Chrome")
            elif "Firefox" in agent:
                viewer_stats[uid]["agents"].add("Firefox")
            elif "Safari" in agent and "Chrome" not in agent:
                viewer_stats[uid]["agents"].add("Safari")
            elif "Edge" in agent:
                viewer_stats[uid]["agents"].add("Edge")

    # Convert sets to lists
    viewers = {}
    for uid, stats in sorted(viewer_stats.items(), key=lambda x: -x[1]["views"]):
        viewers[uid] = {
            "views": stats["views"],
            "last_seen": stats["last_seen"],
            "methods": list(stats["methods"]),
            "browsers": list(stats["agents"]),
        }

    # Page views by page by day
    page_daily = defaultdict(lambda: defaultdict(int))
    page_totals = defaultdict(int)
    for pv in page_views:
        sid = pv.get("SectionId", "")
        ts = pv.get("Timestamp", "")
        if sid and ts:
            day = ts[:10]
            pname = page_names.get(sid, sid[:12] + "...")
            page_daily[pname][day] += 1
            page_totals[pname] += 1

    pages_result = {}
    for pname, total in sorted(page_totals.items(), key=lambda x: -x[1]):
        pages_result[pname] = {
            "total_views": total,
            "daily": dict(sorted(page_daily[pname].items())),
        }

    # Performance
    load_times = []
    locations = defaultdict(int)
    browsers = defaultdict(int)
    for rl in loads:
        start = rl.get("StartTime")
        end = rl.get("EndTime")
        if start and end:
            try:
                t_start = datetime.fromisoformat(start)
                t_end = datetime.fromisoformat(end)
                secs = (t_end - t_start).total_seconds()
                if secs >= 0:
                    load_times.append(secs)
            except (ValueError, TypeError):
                pass
        city = rl.get("LocationCity", "")
        country = rl.get("LocationCountry", "")
        if city and country:
            locations[f"{city}, {country}"] += 1
        browser = rl.get("DeviceBrowserVersion", "")
        if browser:
            browsers[browser] += 1

    performance = {}
    if load_times:
        load_times.sort()
        n = len(load_times)
        performance = {
            "sample_count": n,
            "p10": load_times[max(0, int(n * 0.1))],
            "p50": load_times[max(0, int(n * 0.5))],
            "p90": load_times[max(0, min(n - 1, int(n * 0.9)))],
            "min": load_times[0],
            "max": load_times[-1],
            "locations": dict(sorted(locations.items(), key=lambda x: -x[1])),
            "browsers": dict(sorted(browsers.items(), key=lambda x: -x[1])),
        }

    # Audience reach (exclude service principals from human audience metrics)
    human_acl = [a for a in acl if a.get("type") != "App"]
    sp_acl = [a for a in acl if a.get("type") == "App"]
    human_count = len(human_acl)

    audience = {
        "total_with_access": human_count,
        "service_principals": len(sp_acl),
        "actual_viewers": overview["unique_viewers"],
        "reach_pct": round(overview["unique_viewers"] / human_count * 100, 1) if human_count else None,
        "access_list": human_acl,
        "non_viewers": [],
    }

    # Identify human users with access who haven't viewed
    viewer_emails = {v.get("UserId", "").lower() for v in views if v.get("UserId")}
    for a in human_acl:
        principal = a.get("principal", "").lower()
        if principal and principal not in viewer_emails:
            audience["non_viewers"].append(a["principal"])

    return {
        "overview": overview,
        "daily_views": daily_sorted,
        "viewers": viewers,
        "pages": pages_result,
        "performance": performance,
        "audience": audience,
    }

#endregion


#region Output Formatting

def format_detail(analysis: Dict[str, Any]) -> str:
    """
    Format the analysis as a readable ASCII report.

    Args:
        analysis: Output from analyze_report

    Returns:
        Formatted string with detailed report usage.
    """
    o = analysis["overview"]
    lines = []

    lines.append("=" * 72)
    lines.append(f"  REPORT DETAIL: {o['name']}")
    lines.append("=" * 72)

    # Overview
    rank_str = f"#{o['rank']}/{o['rank_total']}" if o.get("rank") else "N/A"
    lines.append("")
    lines.append(f"  Total views:    {o['total_views']}")
    lines.append(f"  Unique viewers: {o['unique_viewers']}")
    lines.append(f"  Org rank:       {rank_str}")

    # Audience reach
    aud = analysis["audience"]
    if aud["total_with_access"] > 0 or aud.get("service_principals", 0) > 0:
        lines.append("")
        lines.append(f"  AUDIENCE REACH (human users only)")
        lines.append(f"  {'─' * 40}")
        lines.append(f"  Users with access: {aud['total_with_access']}")
        lines.append(f"  Active viewers:    {aud['actual_viewers']}")
        if aud.get("reach_pct") is not None:
            lines.append(f"  Reach:             {aud['reach_pct']}%")
        if aud.get("service_principals", 0) > 0:
            lines.append(f"  Service principals: {aud['service_principals']} (excluded from reach)")
        if aud["non_viewers"]:
            lines.append(f"  Non-viewers ({len(aud['non_viewers'])}):")
            for nv in aud["non_viewers"][:10]:
                lines.append(f"    - {nv}")
            if len(aud["non_viewers"]) > 10:
                lines.append(f"    ... and {len(aud['non_viewers']) - 10} more")

    # Daily views
    if analysis["daily_views"]:
        lines.append("")
        lines.append(f"  DAILY VIEWS")
        lines.append(f"  {'─' * 40}")
        max_views = max(v for _, v in analysis["daily_views"]) if analysis["daily_views"] else 1
        for day, count in analysis["daily_views"]:
            bar_len = int(count / max_views * 30) if max_views > 0 else 0
            bar = "+" * bar_len
            lines.append(f"  {day}  {count:>3}  {bar}")

    # Per-viewer breakdown
    if analysis["viewers"]:
        lines.append("")
        lines.append(f"  VIEWERS")
        lines.append(f"  {'─' * 40}")
        lines.append(f"  {'User':<35} {'Views':>5}  {'Last seen':<12}  Method")
        for uid, stats in analysis["viewers"].items():
            short_uid = uid[:33] + ".." if len(uid) > 35 else uid
            last = stats["last_seen"][:10] if stats["last_seen"] else "?"
            methods = ", ".join(stats["methods"]) if stats["methods"] else "?"
            lines.append(f"  {short_uid:<35} {stats['views']:>5}  {last:<12}  {methods}")

    # Page views
    if analysis["pages"]:
        lines.append("")
        lines.append(f"  PAGE VIEWS")
        lines.append(f"  {'─' * 40}")
        for pname, pdata in analysis["pages"].items():
            lines.append(f"  {pdata['total_views']:>4}  {pname}")
            if pdata.get("daily"):
                for day, count in sorted(pdata["daily"].items()):
                    lines.append(f"        {day}: {count}")

    # Performance
    if analysis["performance"]:
        perf = analysis["performance"]
        lines.append("")
        lines.append(f"  PERFORMANCE (n={perf['sample_count']})")
        lines.append(f"  {'─' * 40}")
        lines.append(f"  Load time P10: {perf['p10']:.1f}s")
        lines.append(f"  Load time P50: {perf['p50']:.1f}s")
        lines.append(f"  Load time P90: {perf['p90']:.1f}s")
        lines.append(f"  Range: {perf['min']:.1f}s - {perf['max']:.1f}s")

        if perf.get("locations"):
            lines.append(f"  Locations:")
            for loc, count in list(perf["locations"].items())[:5]:
                lines.append(f"    {count:>3}  {loc}")

        if perf.get("browsers"):
            lines.append(f"  Browsers:")
            for browser, count in list(perf["browsers"].items())[:5]:
                lines.append(f"    {count:>3}  {browser}")

    lines.append("")
    lines.append("=" * 72)

    return "\n".join(lines)

#endregion


#region Main

def main():
    parser = argparse.ArgumentParser(
        description="Deep-dive into a single Power BI report's usage.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s -w <workspace-id> -r <report-id>
  %(prog)s -w <workspace-id> -r <report-id> --output json
        """
    )

    parser.add_argument("--workspace-id", "-w", required=True, help="Workspace GUID")
    parser.add_argument("--report-id", "-r", required=True, help="Report GUID")
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

    # Collect WABI data
    print("Fetching report usage data...", file=sys.stderr)
    data = collect_report_data(token, args.region, args.workspace_id, args.report_id)

    # Get ACL
    print("Fetching access control list...", file=sys.stderr)
    acl = get_report_acl(args.workspace_id, args.report_id)

    # Analyze
    analysis = analyze_report(data, acl)

    # Output
    if args.output == "json":
        print(json.dumps(analysis, indent=2, default=str))
    else:
        print(format_detail(analysis))


if __name__ == "__main__":
    main()

#endregion
