#!/usr/bin/env python3
"""
Performance Audit Script
performance_audit.py

Analyze a Power BI report's performance by combining load time metrics
with visual complexity analysis from the report definition.

AGENT USAGE GUIDE:
------------------
Use this script to diagnose performance issues in a single report.
It combines server-side load time data with static analysis of the
report definition to identify complexity hotspots.

COMMON PATTERNS:
  # Performance audit for a report
  python3 performance_audit.py -w <workspace-id> -r <report-id>

  # JSON output
  python3 performance_audit.py -w <workspace-id> -r <report-id> --output json

  # Analyze an already-exported report definition (no API calls for load times)
  python3 performance_audit.py --report-path /path/to/Report.Report

PREREQUISITES:
  - Azure CLI authenticated: `az login` (for load time data)
  - Python packages: requests (uv pip install requests)
  - For --report-path: exported report definition (fab export)

TOKEN SECURITY:
  Auth tokens obtained via `az account get-access-token` in a subprocess.
  Tokens held in memory only -- never printed, logged, or written to disk.

OUTPUT:
  - Load time percentiles (P10, P50, P90) with geographic/browser breakdown
  - Per-page visual count and complexity score
  - Per-visual field binding analysis (grouping columns, measures)
  - Conditional formatting overhead detection
  - Ranked list of most complex visuals
"""

import argparse
import json
import os
import subprocess
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

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
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        print(f"Error getting token: {type(e).__name__}", file=sys.stderr)
        return None

#endregion


#region Load Time Data

def get_load_times(token: str, region: str, workspace_id: str, report_id: str) -> List[Dict]:
    """
    Retrieve load time events from the WABI reportloads endpoint.

    Args:
        token: Power BI access token
        region: Region key
        workspace_id: Workspace GUID
        report_id: Report GUID

    Returns:
        List of load event dicts with computed load_secs field.
    """
    host = REGIONS.get(region, REGIONS[DEFAULT_REGION])
    url = f"https://{host}/metadata/v201906/metrics/workspace/{workspace_id}/reportloads"
    headers = {"Authorization": f"Bearer {token}"}

    try:
        resp = requests.get(url, headers=headers, timeout=30)
        if resp.status_code != 200:
            return []
        all_loads = resp.json()
    except Exception:
        return []

    loads = [l for l in all_loads if l.get("ReportId") == report_id]

    for l in loads:
        start = l.get("StartTime")
        end = l.get("EndTime")
        if start and end:
            try:
                t0 = datetime.fromisoformat(start)
                t1 = datetime.fromisoformat(end)
                l["load_secs"] = (t1 - t0).total_seconds()
            except (ValueError, TypeError):
                l["load_secs"] = None
        else:
            l["load_secs"] = None

    return loads


def analyze_load_times(loads: List[Dict]) -> Dict[str, Any]:
    """
    Compute load time percentiles and breakdowns.

    Args:
        loads: List of load event dicts with load_secs field.

    Returns:
        Dict with percentiles, geographic distribution, and browser breakdown.
    """
    times = sorted(l["load_secs"] for l in loads if l.get("load_secs") is not None and l["load_secs"] >= 0)

    if not times:
        return {"available": False}

    n = len(times)
    locations = defaultdict(int)
    browsers = defaultdict(int)
    clients = defaultdict(int)

    for l in loads:
        city = l.get("LocationCity", "")
        country = l.get("LocationCountry", "")
        if city and country:
            locations[f"{city}, {country}"] += 1
        browser = l.get("DeviceBrowserVersion", "")
        if browser:
            browsers[browser] += 1
        client = l.get("Client", "")
        if client:
            clients[client] += 1

    return {
        "available": True,
        "sample_count": n,
        "p10": times[max(0, int(n * 0.1))],
        "p25": times[max(0, int(n * 0.25))],
        "p50": times[max(0, int(n * 0.5))],
        "p75": times[max(0, min(n - 1, int(n * 0.75)))],
        "p90": times[max(0, min(n - 1, int(n * 0.9)))],
        "min": times[0],
        "max": times[-1],
        "locations": dict(sorted(locations.items(), key=lambda x: -x[1])),
        "browsers": dict(sorted(browsers.items(), key=lambda x: -x[1])),
        "clients": dict(sorted(clients.items(), key=lambda x: -x[1])),
    }

#endregion


#region Report Definition Analysis

def export_report(workspace_id: str, report_id: str) -> Optional[str]:
    """
    Export a report definition to a temp directory via fab CLI.

    Args:
        workspace_id: Workspace GUID
        report_id: Report GUID

    Returns:
        Path to the exported report directory, or None on failure.
    """
    import tempfile
    export_dir = tempfile.mkdtemp(prefix="pbi_perf_audit_")

    try:
        # Get report definition via API (avoids needing workspace name for fab export)
        result = subprocess.run(
            ["fab", "api", "-A", "powerbi",
             f"groups/{workspace_id}/reports/{report_id}"],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode != 0:
            return None

        raw = json.loads(result.stdout)
        data = raw.get("text", raw)
        report_name = data.get("name", "report")

        # Get report definition
        result = subprocess.run(
            ["fab", "get",
             f"groups/{workspace_id}/reports/{report_id}",
             "-q", "definition"],
            capture_output=True, text=True, timeout=60
        )

        # Try fab export with workspace listing to find the path
        # First list workspaces to find workspace name
        ws_result = subprocess.run(
            ["fab", "api", "-A", "powerbi", f"groups/{workspace_id}"],
            capture_output=True, text=True, timeout=30
        )
        if ws_result.returncode == 0:
            ws_raw = json.loads(ws_result.stdout)
            ws_data = ws_raw.get("text", ws_raw)
            ws_name = ws_data.get("name", "")
            if ws_name:
                export_result = subprocess.run(
                    ["fab", "export",
                     f"{ws_name}.Workspace/{report_name}.Report",
                     "-o", export_dir, "-f"],
                    capture_output=True, text=True, timeout=60
                )

        # Find the exported directory
        for item in Path(export_dir).iterdir():
            if item.is_dir() and item.name.endswith(".Report"):
                return str(item)

        return None
    except Exception:
        return None


def find_report_path(base_path: str) -> Optional[str]:
    """
    Locate the report definition root from a given path.

    Handles both direct Report.Report paths and parent directories.

    Args:
        base_path: Path to report directory or parent

    Returns:
        Path to the definition directory containing pages/, or None.
    """
    p = Path(base_path)

    # Check if this is already the definition dir
    if (p / "definition" / "pages").exists():
        return str(p / "definition")
    if (p / "pages").exists():
        return str(p)

    # Check for .Report subdirectory
    for child in p.iterdir():
        if child.is_dir() and child.name.endswith(".Report"):
            if (child / "definition" / "pages").exists():
                return str(child / "definition")

    return None


def extract_field_bindings(query_state: Dict) -> Dict[str, Any]:
    """
    Extract field bindings from a visual's queryState.

    Parses Column and Measure projections from all roles.

    Args:
        query_state: The visual.query.queryState dict

    Returns:
        Dict with grouping_columns, measures, extension_measures lists
        and a complexity_score int.
    """
    grouping_columns = []
    measures = []

    for role_name, role_data in query_state.items():
        projections = role_data.get("projections", [])
        for proj in projections:
            field = proj.get("field", {})
            query_ref = proj.get("queryRef", "")

            if "Column" in field:
                col_info = field["Column"]
                entity = col_info.get("Expression", {}).get("SourceRef", {}).get("Entity", "?")
                prop = col_info.get("Property", "?")
                grouping_columns.append({
                    "table": entity,
                    "column": prop,
                    "ref": query_ref,
                    "role": role_name,
                })

            elif "Measure" in field:
                meas_info = field["Measure"]
                source_ref = meas_info.get("Expression", {}).get("SourceRef", {})
                entity = source_ref.get("Entity", "?")
                prop = meas_info.get("Property", "?")
                measures.append({
                    "table": entity,
                    "measure": prop,
                    "ref": query_ref,
                    "role": role_name,
                })

            elif "HierarchyLevel" in field:
                hier_info = field["HierarchyLevel"]
                entity = hier_info.get("Expression", {}).get("Hierarchy", {}).get("Expression", {}).get("SourceRef", {}).get("Entity", "?")
                grouping_columns.append({
                    "table": entity,
                    "column": f"[Hierarchy]{hier_info.get('Level', '?')}",
                    "ref": query_ref,
                    "role": role_name,
                })

    # Complexity score: grouping cols are most expensive
    complexity = len(grouping_columns) * 3 + len(measures)

    return {
        "grouping_columns": grouping_columns,
        "measures": measures,
        "total_fields": len(grouping_columns) + len(measures),
        "complexity_score": complexity,
    }


def count_conditional_format_measures(objects: Dict) -> int:
    """
    Count measures used in conditional formatting within visual objects.

    Scans the objects dict for measure references in fill, color, and
    similar formatting properties.

    Args:
        objects: The visual.objects dict

    Returns:
        Number of conditional formatting measures found.
    """
    count = 0

    def scan(obj):
        nonlocal count
        if isinstance(obj, dict):
            if "Measure" in obj and "Expression" in obj.get("Measure", {}):
                count += 1
            for v in obj.values():
                scan(v)
        elif isinstance(obj, list):
            for item in obj:
                scan(item)

    scan(objects)
    return count


def analyze_report_definition(report_path: str) -> Dict[str, Any]:
    """
    Analyze a report definition for performance indicators.

    Walks the page/visual directory structure and extracts complexity
    metrics from each visual's JSON definition.

    Args:
        report_path: Path to the report definition directory

    Returns:
        Dict with pages (per-page visual analysis), extension_measures,
        and summary metrics.
    """
    def_path = find_report_path(report_path)
    if not def_path:
        return {"error": f"Could not find report definition at {report_path}"}

    pages_dir = Path(def_path) / "pages"
    if not pages_dir.exists():
        return {"error": f"No pages directory at {pages_dir}"}

    pages = []
    all_visuals = []

    # Walk pages
    for page_dir in sorted(pages_dir.iterdir()):
        if not page_dir.is_dir():
            continue

        # Read page.json for page metadata
        page_json = page_dir / "page.json"
        page_name = page_dir.name
        page_type = "standard"
        if page_json.exists():
            try:
                with open(page_json) as f:
                    pdata = json.load(f)
                page_name = pdata.get("displayName", page_dir.name)
                if pdata.get("type") == "Tooltip":
                    page_type = "tooltip"
                if pdata.get("visibility") == "HiddenInViewMode":
                    page_type = "hidden"
            except (json.JSONDecodeError, KeyError):
                pass

        # Walk visuals
        visuals_dir = page_dir / "visuals"
        page_visuals = []

        if visuals_dir.exists():
            for vis_dir in sorted(visuals_dir.iterdir()):
                vis_file = vis_dir / "visual.json"
                if not vis_file.exists():
                    continue

                try:
                    with open(vis_file) as f:
                        vdata = json.load(f)
                except (json.JSONDecodeError, KeyError):
                    continue

                visual_config = vdata.get("visual", {})
                visual_type = visual_config.get("visualType", "?")
                query_state = visual_config.get("query", {}).get("queryState", {})
                objects = visual_config.get("objects", {})
                container_objects = vdata.get("visualContainerObjects", {})

                # Extract bindings
                bindings = extract_field_bindings(query_state)

                # Count conditional formatting measures
                cf_measures = count_conditional_format_measures(objects)

                # Check for tooltip page references
                has_tooltip_page = False
                tooltip_config = container_objects.get("visualTooltip", [])
                for tt in tooltip_config:
                    if tt.get("properties", {}).get("type", {}).get("expr", {}).get("Literal", {}).get("Value") == "'ReportPage'":
                        has_tooltip_page = True

                visual_info = {
                    "id": vis_dir.name,
                    "type": visual_type,
                    "bindings": bindings,
                    "conditional_format_measures": cf_measures,
                    "has_tooltip_page": has_tooltip_page,
                    "page": page_name,
                    "complexity_score": bindings["complexity_score"] + cf_measures * 2 + (3 if has_tooltip_page else 0),
                }

                page_visuals.append(visual_info)
                all_visuals.append(visual_info)

        page_complexity = sum(v["complexity_score"] for v in page_visuals)
        data_visuals = [v for v in page_visuals if v["bindings"]["total_fields"] > 0]

        pages.append({
            "name": page_name,
            "type": page_type,
            "total_visuals": len(page_visuals),
            "data_visuals": len(data_visuals),
            "page_complexity": page_complexity,
            "visuals": page_visuals,
        })

    # Rank visuals by complexity
    ranked = sorted(all_visuals, key=lambda v: v["complexity_score"], reverse=True)

    return {
        "pages": pages,
        "total_pages": len(pages),
        "total_visuals": len(all_visuals),
        "total_data_visuals": sum(p["data_visuals"] for p in pages),
        "most_complex_visuals": ranked[:10],
    }

#endregion


#region Output Formatting

def format_audit(load_analysis: Dict, definition_analysis: Dict) -> str:
    """
    Format the performance audit as a readable ASCII report.

    Args:
        load_analysis: Output from analyze_load_times
        definition_analysis: Output from analyze_report_definition

    Returns:
        Formatted string.
    """
    lines = []
    lines.append("=" * 72)
    lines.append("  PERFORMANCE AUDIT")
    lines.append("=" * 72)

    # Load times
    if load_analysis.get("available"):
        la = load_analysis
        lines.append("")
        lines.append(f"  LOAD TIMES (n={la['sample_count']})")
        lines.append(f"  {'─' * 50}")
        lines.append(f"  P10:  {la['p10']:.1f}s")
        lines.append(f"  P25:  {la['p25']:.1f}s")
        lines.append(f"  P50:  {la['p50']:.1f}s  (median -- typical experience)")
        lines.append(f"  P75:  {la['p75']:.1f}s")
        lines.append(f"  P90:  {la['p90']:.1f}s  (worst 10% of users)")
        lines.append(f"  Range: {la['min']:.1f}s - {la['max']:.1f}s")

        p50_p90_gap = la['p90'] - la['p50']
        if p50_p90_gap > 5:
            lines.append(f"  !! P50-P90 gap: {p50_p90_gap:.1f}s -- high inconsistency")

        if la.get("locations"):
            lines.append(f"  Locations:")
            for loc, count in list(la["locations"].items())[:5]:
                lines.append(f"    {count:>3}  {loc}")

        if la.get("browsers"):
            lines.append(f"  Browsers:")
            for browser, count in list(la["browsers"].items())[:5]:
                lines.append(f"    {count:>3}  {browser}")
    else:
        lines.append("")
        lines.append("  LOAD TIMES: No data available")

    # Definition analysis
    da = definition_analysis
    if "error" in da:
        lines.append("")
        lines.append(f"  DEFINITION ANALYSIS: {da['error']}")
    else:
        lines.append("")
        lines.append(f"  REPORT STRUCTURE")
        lines.append(f"  {'─' * 50}")
        lines.append(f"  Pages: {da['total_pages']}  |  Visuals: {da['total_visuals']}  |  Data visuals: {da['total_data_visuals']}")

        # Per-page summary
        lines.append("")
        lines.append(f"  PAGE BREAKDOWN")
        lines.append(f"  {'─' * 50}")
        lines.append(f"  {'Page':<30} {'Type':<10} {'Visuals':>7} {'Data':>6} {'Score':>6}")
        for p in sorted(da["pages"], key=lambda x: -x["page_complexity"]):
            lines.append(f"  {p['name'][:28]:<30} {p['type']:<10} {p['total_visuals']:>7} {p['data_visuals']:>6} {p['page_complexity']:>6}")

        # Most complex visuals
        if da["most_complex_visuals"]:
            lines.append("")
            lines.append(f"  MOST COMPLEX VISUALS (top 10)")
            lines.append(f"  {'─' * 50}")
            lines.append(f"  {'Score':>5}  {'Type':<20} {'Page':<20} {'Fields':>6} {'CF':>3} {'TT':>3}")
            for v in da["most_complex_visuals"]:
                cf = v["conditional_format_measures"]
                tt = "Y" if v["has_tooltip_page"] else ""
                lines.append(f"  {v['complexity_score']:>5}  {v['type'][:18]:<20} {v['page'][:18]:<20} {v['bindings']['total_fields']:>6} {cf:>3} {tt:>3}")

        # Warnings
        warnings = []
        for p in da["pages"]:
            if p["total_visuals"] > 12:
                warnings.append(f"Page '{p['name']}' has {p['total_visuals']} visuals (>12)")
            if p["data_visuals"] > 8:
                warnings.append(f"Page '{p['name']}' has {p['data_visuals']} data visuals (>8)")
        if warnings:
            lines.append("")
            lines.append(f"  WARNINGS")
            lines.append(f"  {'─' * 50}")
            for w in warnings:
                lines.append(f"  !! {w}")

    lines.append("")
    lines.append("=" * 72)
    return "\n".join(lines)

#endregion


#region Main

def main():
    parser = argparse.ArgumentParser(
        description="Performance audit for a Power BI report.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s -w <workspace-id> -r <report-id>
  %(prog)s --report-path /path/to/Report.Report
  %(prog)s -w <workspace-id> -r <report-id> --output json
        """
    )

    parser.add_argument("--workspace-id", "-w", help="Workspace GUID")
    parser.add_argument("--report-id", "-r", help="Report GUID")
    parser.add_argument("--report-path", help="Path to exported report definition (skips API export)")
    parser.add_argument("--region", default=DEFAULT_REGION,
                        choices=list(REGIONS.keys()), help=f"Power BI region (default: {DEFAULT_REGION})")
    parser.add_argument("--output", "-o", choices=["table", "json"], default="table",
                        help="Output format (default: table)")

    args = parser.parse_args()

    if not args.report_path and not (args.workspace_id and args.report_id):
        parser.error("Either --report-path or both --workspace-id and --report-id are required")

    # Load times (only if workspace/report specified)
    load_analysis = {"available": False}
    if args.workspace_id and args.report_id:
        print("Authenticating...", file=sys.stderr)
        token = get_token()
        if token:
            print("Fetching load time data...", file=sys.stderr)
            loads = get_load_times(token, args.region, args.workspace_id, args.report_id)
            load_analysis = analyze_load_times(loads)

    # Report definition analysis
    report_path = args.report_path
    if not report_path and args.workspace_id and args.report_id:
        print("Exporting report definition...", file=sys.stderr)
        report_path = export_report(args.workspace_id, args.report_id)

    if report_path:
        print("Analyzing report definition...", file=sys.stderr)
        definition_analysis = analyze_report_definition(report_path)
    else:
        definition_analysis = {"error": "Could not export or locate report definition"}

    # Output
    if args.output == "json":
        print(json.dumps({"load_times": load_analysis, "definition": definition_analysis}, indent=2, default=str))
    else:
        print(format_audit(load_analysis, definition_analysis))


if __name__ == "__main__":
    main()

#endregion
