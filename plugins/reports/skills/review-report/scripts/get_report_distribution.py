#!/usr/bin/env python3
"""
Report Distribution Script
get_report_distribution.py

Determine who can access a Power BI report and through what channels.
Maps all access paths: workspace role, direct report sharing, org apps,
and publish-to-web (public embed).

AGENT USAGE GUIDE:
------------------
Use this script to audit report distribution and compare audience against
actual viewership (from get_report_detail.py).

COMMON PATTERNS:
  # Check all access paths for a report
  python3 get_report_distribution.py -w <workspace-id> -r <report-id>

  # JSON output
  python3 get_report_distribution.py -w <workspace-id> -r <report-id> --output json

PREREQUISITES:
  - `fab` CLI authenticated: `fab auth login`
  - Admin role required for publish-to-web and org-wide sharing checks

TOKEN SECURITY:
  Uses `fab api` for all calls, which handles authentication internally.
  No tokens are exposed to stdout or the calling agent.

OUTPUT:
  - Workspace members (role-based access)
  - Direct report sharing recipients
  - App-based distribution (if report is in an app)
  - Publish-to-web status (public embed links)
  - Org-wide sharing links
  - Combined access summary with deduplication
"""

import argparse
import json
import subprocess
import sys
from typing import Any, Dict, List, Optional


#region fab API Helpers

def fab_api(endpoint: str, audience: str = "powerbi") -> Optional[Dict]:
    """
    Call a Power BI API endpoint via fab CLI.

    Auth is handled entirely by fab -- no tokens are exposed.

    Args:
        endpoint: API path (relative to /v1.0/myorg/)
        audience: API audience (powerbi, fabric, etc.)

    Returns:
        Parsed JSON response on success, None on error.
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

#endregion


#region Data Collection

def get_workspace_members(workspace_id: str) -> List[Dict[str, str]]:
    """
    Get workspace members and their roles.

    Workspace members inherit access to all items in the workspace.
    Roles: Admin, Member, Contributor, Viewer.

    Args:
        workspace_id: Workspace GUID

    Returns:
        List of dicts with principal, role, type, and access_path.
    """
    data = fab_api(f"groups/{workspace_id}/users")
    if not data or not isinstance(data, dict):
        return []

    members = []
    for u in data.get("value", []):
        members.append({
            "principal": u.get("emailAddress") or u.get("displayName") or u.get("identifier", "?"),
            "role": u.get("groupUserAccessRight", "?"),
            "type": u.get("principalType", "?"),
            "access_path": "workspace_role",
        })

    return members


def get_report_shares(workspace_id: str, report_id: str) -> List[Dict[str, str]]:
    """
    Get users with direct report-level sharing.

    Direct sharing grants access to the report without workspace membership.

    Args:
        workspace_id: Workspace GUID
        report_id: Report GUID

    Returns:
        List of dicts with principal, role, type, and access_path.
    """
    data = fab_api(f"admin/reports/{report_id}/users")
    if not data or not isinstance(data, dict):
        return []

    shares = []
    for u in data.get("value", []):
        shares.append({
            "principal": u.get("emailAddress") or u.get("displayName") or u.get("identifier", "?"),
            "role": u.get("reportUserAccessRight", "?"),
            "type": u.get("principalType", "?"),
            "access_path": "direct_report_share",
        })

    return shares


def get_app_distribution(workspace_id: str, report_id: str) -> Dict[str, Any]:
    """
    Check if the report is distributed via a Power BI app.

    Apps package workspace content for broader consumption.
    Checks admin API for apps associated with the workspace.

    Args:
        workspace_id: Workspace GUID
        report_id: Report GUID

    Returns:
        Dict with app_name, app_id, and users list (if app exists).
    """
    data = fab_api("admin/apps")
    if not data or not isinstance(data, dict):
        return {"apps": []}

    apps = []
    for app in data.get("value", []):
        if app.get("workspaceId") == workspace_id:
            app_id = app.get("id", "")
            app_info = {
                "name": app.get("name", "?"),
                "id": app_id,
                "users": [],
            }

            # Get app users
            app_users_data = fab_api(f"admin/apps/{app_id}/users")
            if app_users_data and isinstance(app_users_data, dict):
                for u in app_users_data.get("value", []):
                    app_info["users"].append({
                        "principal": u.get("emailAddress") or u.get("displayName") or u.get("identifier", "?"),
                        "role": u.get("appUserAccessRight", "?"),
                        "type": u.get("principalType", "?"),
                        "access_path": f"app:{app.get('name', '?')}",
                    })

            apps.append(app_info)

    return {"apps": apps}


def get_publish_to_web(report_id: str) -> Dict[str, Any]:
    """
    Check if the report has been published to the web (public embed).

    Publish-to-web creates a public URL accessible without authentication.
    This is a significant security consideration for any report review.

    Args:
        report_id: Report GUID

    Returns:
        Dict with is_public flag and embed details.
    """
    data = fab_api("admin/widelySharedArtifacts/publishedToWeb")
    if not data or not isinstance(data, dict):
        return {"is_public": False, "embeds": []}

    embeds = []
    for entity in data.get("ArtifactAccessEntities", []):
        if entity.get("artifactId") == report_id:
            embeds.append({
                "shared_by": entity.get("sharer", {}).get("emailAddress", "?"),
                "share_type": entity.get("shareType", "?"),
            })

    return {
        "is_public": len(embeds) > 0,
        "embeds": embeds,
    }


def get_org_wide_shares(report_id: str) -> Dict[str, Any]:
    """
    Check if the report has been shared with the entire organization.

    Org-wide links grant access to anyone in the tenant.

    Args:
        report_id: Report GUID

    Returns:
        Dict with is_org_wide flag and link details.
    """
    data = fab_api("admin/widelySharedArtifacts/linksSharedToWholeOrganization")
    if not data or not isinstance(data, dict):
        return {"is_org_wide": False, "links": []}

    links = []
    for entity in data.get("ArtifactAccessEntities", []):
        if entity.get("artifactId") == report_id:
            links.append({
                "shared_by": entity.get("sharer", {}).get("emailAddress", "?"),
                "share_type": entity.get("shareType", "?"),
            })

    return {
        "is_org_wide": len(links) > 0,
        "links": links,
    }

#endregion


#region Analysis

def build_distribution(
    workspace_members: List[Dict],
    report_shares: List[Dict],
    app_dist: Dict,
    publish_to_web: Dict,
    org_wide: Dict,
) -> Dict[str, Any]:
    """
    Build a unified distribution summary, deduplicating across access paths.

    Args:
        workspace_members: From get_workspace_members
        report_shares: From get_report_shares
        app_dist: From get_app_distribution
        publish_to_web: From get_publish_to_web
        org_wide: From get_org_wide_shares

    Returns:
        Dict with all_users (deduplicated), per-channel breakdowns,
        and security flags.
    """
    # Collect all access entries
    all_entries = []
    all_entries.extend(workspace_members)
    all_entries.extend(report_shares)
    for app in app_dist.get("apps", []):
        all_entries.extend(app.get("users", []))

    # Deduplicate by principal, keeping all access paths
    users = {}
    for entry in all_entries:
        principal = entry["principal"]
        if principal not in users:
            users[principal] = {
                "principal": principal,
                "type": entry["type"],
                "access_paths": [],
                "highest_role": entry["role"],
            }
        users[principal]["access_paths"].append(
            f"{entry['access_path']}:{entry['role']}"
        )

    return {
        "total_unique_users": len(users),
        "users": list(users.values()),
        "channels": {
            "workspace_role": {
                "count": len(workspace_members),
                "members": workspace_members,
            },
            "direct_sharing": {
                "count": len(report_shares),
                "members": report_shares,
            },
            "apps": {
                "count": sum(len(a.get("users", [])) for a in app_dist.get("apps", [])),
                "apps": app_dist.get("apps", []),
            },
        },
        "security": {
            "publish_to_web": publish_to_web,
            "org_wide_sharing": org_wide,
        },
    }

#endregion


#region Output Formatting

def format_distribution(dist: Dict[str, Any]) -> str:
    """
    Format the distribution as a readable ASCII report.

    Args:
        dist: Output from build_distribution

    Returns:
        Formatted string with distribution details.
    """
    lines = []
    lines.append("=" * 72)
    lines.append("  REPORT DISTRIBUTION")
    lines.append("=" * 72)

    # Security warnings first
    sec = dist["security"]
    if sec["publish_to_web"]["is_public"]:
        lines.append("")
        lines.append("  !! PUBLISH-TO-WEB: Report is publicly accessible !!")
        for e in sec["publish_to_web"]["embeds"]:
            lines.append(f"     Shared by: {e['shared_by']}")

    if sec["org_wide_sharing"]["is_org_wide"]:
        lines.append("")
        lines.append("  !! ORG-WIDE: Report shared with entire organization !!")
        for link in sec["org_wide_sharing"]["links"]:
            lines.append(f"     Shared by: {link['shared_by']}")

    # Summary
    lines.append("")
    lines.append(f"  Total unique users with access: {dist['total_unique_users']}")

    # Workspace role
    ch = dist["channels"]
    if ch["workspace_role"]["count"] > 0:
        lines.append("")
        lines.append(f"  WORKSPACE ROLE ({ch['workspace_role']['count']})")
        lines.append(f"  {'─' * 50}")
        for m in ch["workspace_role"]["members"]:
            lines.append(f"    {m['principal']:<40} {m['role']:<12} ({m['type']})")

    # Direct sharing
    if ch["direct_sharing"]["count"] > 0:
        lines.append("")
        lines.append(f"  DIRECT REPORT SHARING ({ch['direct_sharing']['count']})")
        lines.append(f"  {'─' * 50}")
        for m in ch["direct_sharing"]["members"]:
            lines.append(f"    {m['principal']:<40} {m['role']:<12} ({m['type']})")

    # Apps
    if ch["apps"]["count"] > 0:
        lines.append("")
        for app in ch["apps"]["apps"]:
            lines.append(f"  APP: {app['name']} ({len(app.get('users', []))} users)")
            lines.append(f"  {'─' * 50}")
            for u in app.get("users", []):
                lines.append(f"    {u['principal']:<40} {u['role']:<12} ({u['type']})")

    # Combined user list
    if dist["users"]:
        lines.append("")
        lines.append(f"  ALL USERS (deduplicated)")
        lines.append(f"  {'─' * 50}")
        for u in dist["users"]:
            paths = ", ".join(u["access_paths"])
            lines.append(f"    {u['principal']:<35} {paths}")

    lines.append("")
    lines.append("=" * 72)

    return "\n".join(lines)

#endregion


#region Main

def main():
    parser = argparse.ArgumentParser(
        description="Audit Power BI report distribution and access paths.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s -w <workspace-id> -r <report-id>
  %(prog)s -w <workspace-id> -r <report-id> --output json
        """
    )

    parser.add_argument("--workspace-id", "-w", required=True, help="Workspace GUID")
    parser.add_argument("--report-id", "-r", required=True, help="Report GUID")
    parser.add_argument("--output", "-o", choices=["table", "json"], default="table",
                        help="Output format (default: table)")

    args = parser.parse_args()

    # Collect all access paths
    print("Checking workspace members...", file=sys.stderr)
    workspace_members = get_workspace_members(args.workspace_id)

    print("Checking direct report shares...", file=sys.stderr)
    report_shares = get_report_shares(args.workspace_id, args.report_id)

    print("Checking app distribution...", file=sys.stderr)
    app_dist = get_app_distribution(args.workspace_id, args.report_id)

    print("Checking publish-to-web...", file=sys.stderr)
    publish_to_web = get_publish_to_web(args.report_id)

    print("Checking org-wide sharing...", file=sys.stderr)
    org_wide = get_org_wide_shares(args.report_id)

    # Build combined distribution
    dist = build_distribution(workspace_members, report_shares, app_dist, publish_to_web, org_wide)

    # Output
    if args.output == "json":
        print(json.dumps(dist, indent=2, default=str))
    else:
        print(format_distribution(dist))


if __name__ == "__main__":
    main()

#endregion
