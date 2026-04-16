#!/usr/bin/env python3
"""Audit Fabric tenant settings against a curated recommendation baseline.

Fetches live tenant settings via `fab api admin/tenantsettings`, merges them
with the metadata in `references/tenant-settings-metadata.yaml`, and renders
a markdown report grouped by admin-portal section. For each setting it shows
the live state directly above the recommended posture so an admin can audit
drift, preview features, and security-group scoping at a glance.

Usage:
    uv run scripts/audit-tenant-settings.py                  # print to stdout
    uv run scripts/audit-tenant-settings.py -o audit.md      # write to file
    uv run scripts/audit-tenant-settings.py --drift-only     # only non-compliant

Requires: fab CLI, pyyaml.
"""

# region Imports
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml
# endregion


# region Constants
SCRIPT_DIR = Path(__file__).resolve().parent
METADATA_PATH = SCRIPT_DIR.parent / "references" / "tenant-settings-metadata.yaml"
INDEX_URL = "https://learn.microsoft.com/en-us/fabric/admin/tenant-settings-index"
DEFAULT_SNAPSHOT = Path.home() / ".cache" / "fabric-admin-audit" / "last-snapshot.json"
# endregion


# region Data classes
@dataclass
class SettingRecord:
    api_name: str
    group: str
    human_name: str
    description: str
    preview: bool
    source_url: str
    recommended: str | None
    default: str | None
    default_source: str | None
    default_properties: dict[str, str] | None
    risk: str | None
    recommendation_nuance: str | None
    needs_review: bool
    live_enabled: bool
    can_specify_sg: bool
    enabled_sg: list[dict[str, str]]
    excluded_sg: list[dict[str, str]]
    properties: list[dict[str, Any]]
# endregion


# region IO helpers
def fetch_live_settings() -> list[dict[str, Any]]:
    """Call `fab api admin/tenantsettings` and return the list of settings.

    Fails with a non-zero exit code if the fab CLI is unauthenticated or the
    admin endpoint is unreachable.
    """
    result = subprocess.run(
        ["fab", "api", "admin/tenantsettings", "--output_format", "json"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        sys.exit(f"fab api failed (exit {result.returncode}):\n{result.stderr}")
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        sys.exit(f"could not parse fab api output as JSON: {exc}")
    try:
        return payload["result"]["data"][0]["text"]["tenantSettings"]
    except (KeyError, IndexError) as exc:
        sys.exit(f"unexpected fab api payload shape: {exc}")


def load_snapshot(path: Path) -> dict[str, Any] | None:
    """Load the previous audit snapshot if it exists.

    Returns None when the file doesn't exist or can't be parsed; callers treat
    that as "no baseline available" and skip the change-detection section.
    """
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        return None


def save_snapshot(path: Path, live: list[dict[str, Any]]) -> None:
    """Persist the current live settings so the next run can diff against it."""
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "settings": {s["settingName"]: normalize_for_snapshot(s) for s in live},
    }
    path.write_text(json.dumps(payload, indent=2, sort_keys=True))


def normalize_for_snapshot(setting: dict[str, Any]) -> dict[str, Any]:
    """Reduce a live setting to the fields that matter for change detection.

    Uses graphId (not name) for group identity so a rename doesn't look like
    a config change, and sorts lists so ordering noise doesn't create false
    positives.
    """
    return {
        "title": setting.get("title", ""),
        "group": setting.get("tenantSettingGroup", ""),
        "enabled": bool(setting.get("enabled", False)),
        "canSpecifySecurityGroups": bool(setting.get("canSpecifySecurityGroups", False)),
        "enabledSecurityGroups": sorted(
            [sg.get("graphId", "") for sg in setting.get("enabledSecurityGroups") or []]
        ),
        "excludedSecurityGroups": sorted(
            [sg.get("graphId", "") for sg in setting.get("excludedSecurityGroups") or []]
        ),
        "properties": sorted(
            [
                {"name": p.get("name", ""), "value": p.get("value", ""), "type": p.get("type", "")}
                for p in setting.get("properties") or []
            ],
            key=lambda p: p["name"],
        ),
    }


def diff_snapshots(previous: dict[str, Any], current: list[dict[str, Any]]) -> dict[str, list[Any]]:
    """Compare the previous snapshot against the current live state.

    Returns a dict with five lists: added, removed, toggled, sg_changed,
    property_changed. Each entry is a small struct the renderer knows how
    to format.
    """
    prev_settings = previous.get("settings", {})
    current_map = {s["settingName"]: normalize_for_snapshot(s) for s in current}

    added = sorted(set(current_map) - set(prev_settings))
    removed = sorted(set(prev_settings) - set(current_map))
    toggled: list[dict[str, Any]] = []
    sg_changed: list[dict[str, Any]] = []
    property_changed: list[dict[str, Any]] = []

    for name in sorted(set(prev_settings) & set(current_map)):
        prev_entry = prev_settings[name]
        curr_entry = current_map[name]
        if prev_entry.get("enabled") != curr_entry.get("enabled"):
            toggled.append(
                {
                    "name": name,
                    "title": curr_entry.get("title") or prev_entry.get("title"),
                    "from": "on" if prev_entry.get("enabled") else "off",
                    "to": "on" if curr_entry.get("enabled") else "off",
                }
            )
        if (
            prev_entry.get("enabledSecurityGroups") != curr_entry.get("enabledSecurityGroups")
            or prev_entry.get("excludedSecurityGroups") != curr_entry.get("excludedSecurityGroups")
        ):
            sg_changed.append(
                {
                    "name": name,
                    "title": curr_entry.get("title") or prev_entry.get("title"),
                    "prev_enabled_sg": prev_entry.get("enabledSecurityGroups", []),
                    "curr_enabled_sg": curr_entry.get("enabledSecurityGroups", []),
                    "prev_excluded_sg": prev_entry.get("excludedSecurityGroups", []),
                    "curr_excluded_sg": curr_entry.get("excludedSecurityGroups", []),
                }
            )
        if prev_entry.get("properties") != curr_entry.get("properties"):
            property_changed.append(
                {
                    "name": name,
                    "title": curr_entry.get("title") or prev_entry.get("title"),
                    "prev": prev_entry.get("properties", []),
                    "curr": curr_entry.get("properties", []),
                }
            )

    return {
        "added": added,
        "removed": removed,
        "toggled": toggled,
        "sg_changed": sg_changed,
        "property_changed": property_changed,
    }


def load_metadata(path: Path) -> dict[str, dict[str, Any]]:
    """Load the curated metadata file.

    The YAML file is the single source of truth for every field (human_name,
    description, recommended, default, etc.). Every `recommended` value must
    be one of the quoted strings "on", "off", "on:sg", or null; bare on/off
    would be coerced to booleans by YAML 1.1 and is rejected so the schema
    stays obvious when read by a human.
    """
    if not path.exists():
        sys.exit(f"metadata file not found: {path}")
    with path.open() as f:
        data = yaml.safe_load(f) or {}
    allowed = {"on", "off", "on:sg", None}
    for name, entry in data.items():
        rec = entry.get("recommended")
        if rec not in allowed:
            sys.exit(
                f"metadata: {name} has invalid recommended={rec!r}; "
                f"must be one of \"on\", \"off\", \"on:sg\", or null"
            )
    return data
# endregion


# region Merge
def merge(metadata: dict[str, dict[str, Any]], live: list[dict[str, Any]]) -> tuple[list[SettingRecord], list[str], list[str]]:
    """Merge live API state with curated metadata.

    Returns (records, unknown_live, missing_live) where unknown_live are
    settings present in the API but not in the metadata, and missing_live
    are settings in the metadata but absent from the API response.
    """
    live_by_name = {s["settingName"]: s for s in live}
    records: list[SettingRecord] = []
    unknown_live = sorted(set(live_by_name) - set(metadata))
    missing_live = sorted(set(metadata) - set(live_by_name))

    for api_name in sorted(metadata):
        meta_entry = metadata[api_name]
        live_entry = live_by_name.get(api_name, {})
        records.append(
            SettingRecord(
                api_name=api_name,
                group=live_entry.get("tenantSettingGroup", "(unknown group)"),
                human_name=meta_entry.get("human_name", api_name),
                description=meta_entry.get("description", ""),
                preview=bool(meta_entry.get("preview", False)),
                source_url=meta_entry.get("source_url", INDEX_URL),
                recommended=meta_entry.get("recommended"),
                default=meta_entry.get("default"),
                default_source=meta_entry.get("default_source"),
                default_properties=meta_entry.get("default_properties"),
                risk=meta_entry.get("risk"),
                recommendation_nuance=meta_entry.get("recommendation_nuance"),
                needs_review=bool(meta_entry.get("needs_review", False)),
                live_enabled=bool(live_entry.get("enabled", False)),
                can_specify_sg=bool(live_entry.get("canSpecifySecurityGroups", False)),
                enabled_sg=live_entry.get("enabledSecurityGroups") or [],
                excluded_sg=live_entry.get("excludedSecurityGroups") or [],
                properties=live_entry.get("properties") or [],
            )
        )
    return records, unknown_live, missing_live
# endregion


# region Status calculation
def current_state(record: SettingRecord) -> str:
    """Normalize the live state to the recommendation vocabulary.

    Live state collapses into one of the three valid postures: off, on, on:sg.
    Any SG membership at all (enabled_sg or excluded_sg) counts as on:sg.
    """
    if not record.live_enabled:
        return "off"
    if record.enabled_sg or record.excluded_sg:
        return "on:sg"
    return "on"


def current_detail(record: SettingRecord) -> str:
    """Render the SG membership detail as a short parenthetical suffix."""
    bits: list[str] = []
    if record.enabled_sg:
        names = ", ".join(sg.get("name", sg.get("graphId", "?")) for sg in record.enabled_sg)
        bits.append(f"{len(record.enabled_sg)} enabled SG: {names}")
    if record.excluded_sg:
        names = ", ".join(sg.get("name", sg.get("graphId", "?")) for sg in record.excluded_sg)
        bits.append(f"{len(record.excluded_sg)} excluded SG: {names}")
    return f" ({'; '.join(bits)})" if bits else ""


def current_label(record: SettingRecord) -> str:
    """Render Current state as `<normalized>[ (detail)]`, matching metadata format."""
    return f"{current_state(record)}{current_detail(record)}"


def status_of(record: SettingRecord) -> str:
    """Compare recommended vs live to label compliance.

    The recommendation vocabulary is closed: on, off, on:sg. Anything else
    (including None) is treated as unknown so metadata bugs surface instead
    of silently masquerading as compliant.
    """
    rec = record.recommended
    if rec is None:
        return "unknown"

    has_sg_scope = bool(record.enabled_sg) or bool(record.excluded_sg)

    if rec == "on":
        return "compliant" if (record.live_enabled and not has_sg_scope) else "drift"
    if rec == "off":
        return "compliant" if not record.live_enabled else "drift"
    if rec == "on:sg":
        return "compliant" if (record.live_enabled and has_sg_scope) else "drift"
    return "unknown"


UPN_RE = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")


def individuals_in_scope(record: SettingRecord) -> list[str]:
    """Heuristic: any SG entry whose `name` looks like a UPN email is probably an individual.

    The tenant-settings API schema only exposes security groups, but some
    admin-portal flows end up naming individual users. We can only detect this
    via a Microsoft Graph lookup on graphId, which this script doesn't do, so
    we fall back to flagging anything that looks like a UPN.
    """
    flagged: list[str] = []
    for sg in record.enabled_sg + record.excluded_sg:
        name = sg.get("name", "")
        if UPN_RE.search(name):
            flagged.append(name)
    return flagged
# endregion


# region Markdown rendering
STATUS_SYMBOL = {
    "compliant": "OK",
    "drift": "DRIFT",
    "unknown": "UNKNOWN",
}


def render_summary(records: list[SettingRecord], unknown_live: list[str], missing_live: list[str]) -> str:
    total = len(records)
    compliant = sum(1 for r in records if status_of(r) == "compliant")
    drift = sum(1 for r in records if status_of(r) == "drift")
    unknown = sum(1 for r in records if status_of(r) == "unknown")
    preview = sum(1 for r in records if r.preview)
    sg_scoped = sum(1 for r in records if (r.enabled_sg or r.excluded_sg))
    individuals = sum(1 for r in records if individuals_in_scope(r))
    needs_review = sum(1 for r in records if r.needs_review)
    with_default = sum(1 for r in records if r.default is not None)
    differs_from_default = sum(
        1 for r in records
        if r.default is not None and current_state(r) != r.default
    )

    lines = [
        "## Summary",
        "",
        f"- Total settings:           **{total}**",
        f"- Compliant:                **{compliant}**",
        f"- Drift vs. recommended:    **{drift}**",
        f"- Preview features:         **{preview}**",
        f"- SG-scoped:                **{sg_scoped}**",
        f"- Flagged individuals:      **{individuals}**",
        f"- With documented default:  **{with_default}** / {total}",
        f"- Differ from default:      **{differs_from_default}** (of {with_default} with documented default)",
    ]
    if unknown:
        lines.append(f"- Unknown (missing recommendation in metadata): **{unknown}**")
    if needs_review:
        lines.append(f"- Metadata gaps (needs_review): **{needs_review}**")
    if unknown_live:
        lines.append(f"- Live settings missing from metadata: **{len(unknown_live)}**")
    if missing_live:
        lines.append(f"- Metadata entries missing from live API: **{len(missing_live)}**")
    lines.append("")
    return "\n".join(lines)


def render_drift_table(records: list[SettingRecord]) -> str:
    drift_records = [r for r in records if status_of(r) == "drift"]
    if not drift_records:
        return "## Drift\n\nNo drift detected against the recommendation baseline.\n"
    # sort: high risk first, then by group
    risk_order = {"high": 0, "medium": 1, "low": 2, None: 3}
    drift_records.sort(key=lambda r: (risk_order.get(r.risk, 3), r.group, r.human_name))

    lines = [
        "## Drift",
        "",
        f"{len(drift_records)} settings differ from the recommended posture.",
        "",
        "| Risk | Group | Setting | Current | Recommended | Default |",
        "|---|---|---|---|---|---|",
    ]
    for r in drift_records:
        default_cell = r.default if r.default is not None else "-"
        lines.append(
            f"| {r.risk or '-'} | {r.group} | **{r.human_name}** (`{r.api_name}`) "
            f"| {current_state(r)} | {r.recommended} | {default_cell} |"
        )
    lines.append("")
    return "\n".join(lines)


def render_individuals_table(records: list[SettingRecord]) -> str:
    flagged = [(r, individuals_in_scope(r)) for r in records if individuals_in_scope(r)]
    if not flagged:
        return ""
    lines = [
        "## Individuals in SG scoping (heuristic)",
        "",
        "Entries below have at least one security-group member whose name looks like a UPN (`user@domain`). "
        "The tenant-settings API schema only exposes security groups, so this is a heuristic check; "
        "confirm against Microsoft Graph before acting.",
        "",
        "| Setting | Principal(s) |",
        "|---|---|",
    ]
    for r, principals in flagged:
        lines.append(f"| **{r.human_name}** (`{r.api_name}`) | {', '.join(principals)} |")
    lines.append("")
    return "\n".join(lines)


def render_setting(record: SettingRecord) -> str:
    """Render one setting block with Current / Recommended / Default adjacent.

    All three lines use the same on / off / on:sg vocabulary so they line up
    visually. Current also includes an SG-membership detail in parentheses
    when the live state is SG-scoped.
    """
    status = status_of(record)
    header = f"#### {record.human_name}"
    meta_line_parts = [f"`{record.api_name}`"]
    if record.preview:
        meta_line_parts.append("preview")
    if record.risk:
        meta_line_parts.append(f"risk: **{record.risk}**")
    if record.needs_review:
        meta_line_parts.append("**needs_review**")

    default_value = record.default if record.default is not None else "(not documented)"
    recommended_value = record.recommended if record.recommended is not None else "(none)"

    lines = [
        header,
        "",
        " · ".join(meta_line_parts),
        "",
        record.description,
        "",
        f"Docs: <{record.source_url}>",
        "",
        "```",
        f"Current:     {current_label(record)}",
        f"Recommended: {recommended_value}",
        f"Default:     {default_value}",
        f"Status:      {STATUS_SYMBOL.get(status, status)}",
        "```",
    ]

    if record.default_properties:
        lines.append("")
        lines.append("Default properties:")
        for name, value in record.default_properties.items():
            lines.append(f"- `{name}` = `{value}`")

    # Only cite the default source when we actually have a documented default;
    # for unverified entries the default_source URL points at the doc that
    # didn't state a default, so citing it would be misleading.
    if record.default is not None and record.default_source and record.default_source != record.source_url:
        lines.append("")
        lines.append(f"Default source: <{record.default_source}>")

    props = [p for p in record.properties if p.get("value")]
    if props:
        lines.append("")
        lines.append("Current properties:")
        for p in props:
            lines.append(f"- `{p.get('name')}` = `{p.get('value')}` ({p.get('type')})")

    individuals = individuals_in_scope(record)
    if individuals:
        lines.append("")
        lines.append(f"> Individuals in SG scope: {', '.join(individuals)}")

    if record.recommendation_nuance:
        lines.append("")
        lines.append(f"_Nuance:_ {record.recommendation_nuance}")

    lines.append("")
    return "\n".join(lines)


def render_full_audit(records: list[SettingRecord], drift_only: bool) -> str:
    by_group: dict[str, list[SettingRecord]] = {}
    for r in records:
        if drift_only and status_of(r) != "drift":
            continue
        by_group.setdefault(r.group, []).append(r)

    if not by_group:
        return "## Full Audit\n\nNothing to render (drift-only mode and no drift detected).\n"

    lines = ["## Full Audit", ""]
    for group in sorted(by_group):
        lines.append(f"### {group}")
        lines.append("")
        for r in sorted(by_group[group], key=lambda x: x.human_name):
            lines.append(render_setting(r))
    return "\n".join(lines)


def render_changes(diff: dict[str, list[Any]] | None, previous_timestamp: str | None) -> str:
    """Render the "Changes since last audit" section.

    Returns an empty string when there's no snapshot to compare against so
    the report doesn't render an empty header on first-ever runs.
    """
    if diff is None:
        return (
            "## Changes since last audit\n\n"
            "No previous snapshot found; this is a baseline run. Re-run the audit later "
            "to see drift, added settings, and toggled states.\n"
        )
    total = sum(len(v) for v in diff.values())
    if total == 0:
        return (
            "## Changes since last audit\n\n"
            f"No changes since the last snapshot (`{previous_timestamp or 'unknown timestamp'}`).\n"
        )

    lines = [
        "## Changes since last audit",
        "",
        f"{total} change(s) since the last snapshot (`{previous_timestamp or 'unknown timestamp'}`).",
        "",
    ]

    if diff["added"]:
        lines.append(f"### Added settings ({len(diff['added'])})")
        lines.append("")
        lines.append("Microsoft added these settings since the last run; consider updating the curated metadata.")
        lines.append("")
        for name in diff["added"]:
            lines.append(f"- `{name}`")
        lines.append("")

    if diff["removed"]:
        lines.append(f"### Removed settings ({len(diff['removed'])})")
        lines.append("")
        lines.append("These were in the previous snapshot but no longer come back from the API.")
        lines.append("")
        for name in diff["removed"]:
            lines.append(f"- `{name}`")
        lines.append("")

    if diff["toggled"]:
        lines.append(f"### Toggled on/off ({len(diff['toggled'])})")
        lines.append("")
        lines.append("| Setting | From | To |")
        lines.append("|---|---|---|")
        for entry in diff["toggled"]:
            title = entry.get("title") or entry["name"]
            lines.append(f"| **{title}** (`{entry['name']}`) | {entry['from']} | {entry['to']} |")
        lines.append("")

    if diff["sg_changed"]:
        lines.append(f"### Security-group scope changes ({len(diff['sg_changed'])})")
        lines.append("")
        lines.append("| Setting | Enabled SG (before → after) | Excluded SG (before → after) |")
        lines.append("|---|---|---|")
        for entry in diff["sg_changed"]:
            title = entry.get("title") or entry["name"]
            before_e = len(entry["prev_enabled_sg"])
            after_e = len(entry["curr_enabled_sg"])
            before_x = len(entry["prev_excluded_sg"])
            after_x = len(entry["curr_excluded_sg"])
            lines.append(
                f"| **{title}** (`{entry['name']}`) | {before_e} → {after_e} | {before_x} → {after_x} |"
            )
        lines.append("")

    if diff["property_changed"]:
        lines.append(f"### Property value changes ({len(diff['property_changed'])})")
        lines.append("")
        for entry in diff["property_changed"]:
            title = entry.get("title") or entry["name"]
            lines.append(f"- **{title}** (`{entry['name']}`)")
            prev_props = {p["name"]: p["value"] for p in entry["prev"]}
            curr_props = {p["name"]: p["value"] for p in entry["curr"]}
            for key in sorted(set(prev_props) | set(curr_props)):
                before = prev_props.get(key, "(absent)")
                after = curr_props.get(key, "(absent)")
                if before != after:
                    lines.append(f"  - `{key}`: `{before}` → `{after}`")
        lines.append("")

    return "\n".join(lines)


def render_unknown_and_missing(unknown: list[str], missing: list[str]) -> str:
    if not (unknown or missing):
        return ""
    lines = ["## Metadata Gaps", ""]
    if unknown:
        lines.append(f"### Live settings not in metadata ({len(unknown)})")
        lines.append("")
        lines.append("These appeared in `fab api admin/tenantsettings` but have no curated entry. "
                     "Microsoft likely added them since the metadata was last updated.")
        lines.append("")
        for name in unknown:
            lines.append(f"- `{name}`")
        lines.append("")
    if missing:
        lines.append(f"### Metadata entries missing from live API ({len(missing)})")
        lines.append("")
        lines.append("These are in the metadata file but did not come back from the API. "
                     "Microsoft may have renamed or removed them.")
        lines.append("")
        for name in missing:
            lines.append(f"- `{name}`")
        lines.append("")
    return "\n".join(lines)


def render_report(
    records: list[SettingRecord],
    unknown: list[str],
    missing: list[str],
    drift_only: bool,
    diff: dict[str, list[Any]] | None,
    previous_timestamp: str | None,
) -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    head = [
        "# Fabric Tenant Settings Audit",
        "",
        f"Generated: {timestamp}",
        "",
        f"Baseline: `{METADATA_PATH.relative_to(SCRIPT_DIR.parent.parent)}`",
        "",
    ]
    sections = [
        "\n".join(head),
        render_summary(records, unknown, missing),
        render_changes(diff, previous_timestamp),
        render_drift_table(records),
        render_individuals_table(records),
        render_full_audit(records, drift_only),
        render_unknown_and_missing(unknown, missing),
    ]
    return "\n".join(s for s in sections if s)
# endregion


# region CLI
def main() -> int:
    parser = argparse.ArgumentParser(description="Audit Fabric tenant settings against a recommendation baseline.")
    parser.add_argument("-o", "--output", type=Path, help="Write markdown to this file instead of stdout.")
    parser.add_argument("--drift-only", action="store_true",
                        help="Render only settings whose live state drifts from the recommended posture.")
    parser.add_argument("--metadata", type=Path, default=METADATA_PATH,
                        help=f"Path to the curated metadata YAML (default: {METADATA_PATH}).")
    parser.add_argument("--snapshot", type=Path, default=DEFAULT_SNAPSHOT,
                        help=f"Path to the previous-run snapshot JSON (default: {DEFAULT_SNAPSHOT}).")
    parser.add_argument("--no-snapshot", action="store_true",
                        help="Skip loading and writing the snapshot; disables change detection.")
    args = parser.parse_args()

    metadata = load_metadata(args.metadata)
    live = fetch_live_settings()
    records, unknown, missing = merge(metadata, live)

    diff: dict[str, list[Any]] | None = None
    previous_timestamp: str | None = None
    if not args.no_snapshot:
        previous = load_snapshot(args.snapshot)
        if previous is not None:
            previous_timestamp = previous.get("timestamp")
            diff = diff_snapshots(previous, live)

    report = render_report(records, unknown, missing, args.drift_only, diff, previous_timestamp)

    if args.output:
        args.output.write_text(report)
        print(f"wrote {len(report)} bytes to {args.output}", file=sys.stderr)
    else:
        sys.stdout.write(report)

    if not args.no_snapshot:
        save_snapshot(args.snapshot, live)
        print(f"snapshot saved to {args.snapshot}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
# endregion
