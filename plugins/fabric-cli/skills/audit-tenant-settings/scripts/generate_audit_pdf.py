#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "reportlab>=4.0",
#   "pyyaml>=6.0",
# ]
# ///
"""Render a clean PDF summary of a Fabric tenant settings audit.

Re-uses the drift and change-detection logic from the sibling
audit-tenant-settings.py (imported via importlib so the hyphenated filename
still works), optionally enumerates delegated overrides, and builds a
compact, editorial-style A4 PDF focused on deviations from the baseline and
changes since the last snapshot.

Usage:
    uv run plugins/fabric-cli/skills/audit-tenant-settings/scripts/generate_audit_pdf.py \
      -o /tmp/tenant-audit.pdf

Reads the same snapshot path as audit-tenant-settings.py so change detection
stays in lockstep. Pair it with the audit-tenant-settings skill workflow:
the PDF is intended as a shareable briefing, not a replacement for the full
markdown walk-through.
"""

# region Imports
from __future__ import annotations

import argparse
import importlib.util
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
# endregion


# region Constants
SCRIPT_DIR = Path(__file__).resolve().parent
AUDIT_SCRIPT = SCRIPT_DIR / "audit-tenant-settings.py"

# Editorial / refined-minimal palette. Earth tones, no purples, no alarm reds.
INK       = colors.HexColor("#0B0C0A")
WARM_GREY = colors.HexColor("#585A56")
HAIRLINE  = colors.HexColor("#C2C0B6")
PAPER     = colors.HexColor("#F7F5EE")
DRIFT     = colors.HexColor("#8F5A0E")  # muted amber
CRITICAL  = colors.HexColor("#7A2E2C")  # muted oxblood, high-risk only
COMPLIANT = colors.HexColor("#4E7247")  # desaturated sage

RISK_COLORS = {
    "high":   CRITICAL,
    "medium": DRIFT,
    "low":    WARM_GREY,
}

MAX_DRIFT_ROWS = 40
MAX_TOGGLE_ROWS = 12
# endregion


# region Audit module import
def load_audit_module():
    """Load the hyphenated audit-tenant-settings.py as an importable module.

    The audit script lives next to this file but its filename contains a
    hyphen, so regular `import` can't reach it. spec_from_file_location +
    exec_module loads it into sys.modules under a legal name.
    """
    spec = importlib.util.spec_from_file_location("audit_tenant_settings", AUDIT_SCRIPT)
    if spec is None or spec.loader is None:
        sys.exit(f"could not create import spec for {AUDIT_SCRIPT}")
    module = importlib.util.module_from_spec(spec)
    sys.modules["audit_tenant_settings"] = module
    spec.loader.exec_module(module)
    return module
# endregion


# region Override enumeration
def fetch_overrides() -> dict[str, dict[str, Any]]:
    """Enumerate delegated overrides across capacity, domain, and workspace scopes.

    Returns a dict keyed by scope. Each value is a dict with:
        reachable: bool  ; True if the endpoint returned HTTP 200.
        items:     list  ; override entries (empty if none exist).

    Distinguishing "reachable + empty" from "not reachable" lets the PDF
    render an unambiguous overrides section rather than collapsing both
    cases into one message.
    """
    def _get(path: str) -> dict[str, Any]:
        proc = subprocess.run(
            ["fab", "api", path, "--output_format", "json"],
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            return {"reachable": False, "items": []}
        try:
            payload = json.loads(proc.stdout)
        except json.JSONDecodeError:
            return {"reachable": False, "items": []}
        data_envelope = payload.get("result", {}).get("data", [{}])
        if not data_envelope:
            return {"reachable": False, "items": []}
        entry = data_envelope[0]
        status_code = entry.get("status_code")
        text = entry.get("text", {}) or {}
        # capacity ships `overrides` (legacy) + `value` (current); take whichever is populated
        items = text.get("value") or text.get("overrides") or []
        reachable = status_code == 200
        return {"reachable": reachable, "items": items}

    return {
        "capacity":  _get("admin/capacities/delegatedTenantSettingOverrides"),
        "domain":    _get("admin/domains/delegatedTenantSettingOverrides"),
        "workspace": _get("admin/workspaces/delegatedTenantSettingOverrides"),
    }
# endregion


# region Styles
def build_styles() -> dict[str, ParagraphStyle]:
    """Typographic system for the PDF.

    Helvetica for prose, Helvetica-Bold for display, Courier for API names
    and code. Generous leading, uppercase tracked section heads, strong
    hierarchy between display/section/body.
    """
    return {
        "display": ParagraphStyle(
            "display",
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=26,
            textColor=INK,
            spaceAfter=2,
            tracking=0,
        ),
        "display_sub": ParagraphStyle(
            "display_sub",
            fontName="Helvetica-Oblique",
            fontSize=9,
            leading=12,
            textColor=WARM_GREY,
            spaceAfter=14,
        ),
        "section": ParagraphStyle(
            "section",
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=12,
            textColor=INK,
        ),
        "body": ParagraphStyle(
            "body",
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=INK,
            spaceAfter=6,
        ),
        "mute": ParagraphStyle(
            "mute",
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=WARM_GREY,
            spaceAfter=4,
        ),
        "metric_number": ParagraphStyle(
            "metric_number",
            fontName="Helvetica-Bold",
            fontSize=24,
            leading=26,
            textColor=INK,
            alignment=1,  # center
        ),
        "metric_label": ParagraphStyle(
            "metric_label",
            fontName="Helvetica-Bold",
            fontSize=7,
            leading=9,
            textColor=WARM_GREY,
            alignment=1,
        ),
        "cell": ParagraphStyle(
            "cell",
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=INK,
        ),
        "cell_bold": ParagraphStyle(
            "cell_bold",
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=11,
            textColor=INK,
        ),
        "cell_mute": ParagraphStyle(
            "cell_mute",
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=WARM_GREY,
        ),
        "code": ParagraphStyle(
            "code",
            fontName="Courier",
            fontSize=7,
            leading=9,
            textColor=WARM_GREY,
        ),
    }


def section_head(title: str, styles: dict[str, ParagraphStyle]) -> list:
    """Section heading: uppercase tracked text above a hairline rule."""
    head = Table(
        [[Paragraph(f"<b>{title.upper()}</b>", styles["section"])]],
        colWidths=["100%"],
    )
    head.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, INK),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    return [Spacer(1, 14), head, Spacer(1, 6)]
# endregion


# region Flowables: hero strip
def build_counts_strip(metrics: list[tuple[str, int]], styles: dict[str, ParagraphStyle], page_width: float) -> Table:
    """Horizontal metrics strip. Big numbers up top, tracked caps labels below.

    Layout relies on Table VALIGN so the numbers bottom-align and the labels
    top-align, meeting cleanly at a shared midline.
    """
    rows = [
        [Paragraph(f"{v:,}", styles["metric_number"]) for _, v in metrics],
        [Paragraph(k.upper(), styles["metric_label"]) for k, _ in metrics],
    ]
    col_width = page_width / len(metrics)
    t = Table(
        rows,
        colWidths=[col_width] * len(metrics),
        rowHeights=[30, 14],
    )
    t.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (-1, 0), 0.5, INK),
        ("LINEBELOW", (0, -1), (-1, -1), 0.5, INK),
        ("LINEBEFORE", (1, 0), (-1, -1), 0.25, HAIRLINE),
        ("VALIGN", (0, 0), (-1, 0), "BOTTOM"),
        ("VALIGN", (0, 1), (-1, 1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t
# endregion


# region Flowables: sections
def build_masthead(tenant_label: str, baseline_path: Path, styles: dict[str, ParagraphStyle]) -> list:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    meta_parts = [f"Generated {ts}"]
    meta_parts.append(
        f"Baseline <font face='Courier' size='8'>{baseline_path.name}</font>"
    )
    if tenant_label:
        meta_parts.append(f"Tenant {tenant_label}")
    meta = "  &middot;  ".join(meta_parts)
    return [
        Paragraph("FABRIC TENANT SETTINGS AUDIT", styles["display"]),
        Paragraph(meta, styles["display_sub"]),
    ]


def build_changes_section(diff: dict[str, list[Any]] | None, previous_timestamp: str | None, styles: dict[str, ParagraphStyle]) -> list:
    els = section_head("Changes since last audit", styles)
    if diff is None:
        els.append(Paragraph(
            "First run. No baseline snapshot to compare against.",
            styles["mute"],
        ))
        return els

    added = diff.get("added", [])
    removed = diff.get("removed", [])
    toggled = diff.get("toggled", [])
    sg_changed = diff.get("sg_changed", [])
    prop_changed = diff.get("property_changed", [])

    if not any([added, removed, toggled, sg_changed, prop_changed]):
        when = previous_timestamp or "last run"
        els.append(Paragraph(f"No changes since {when}.", styles["mute"]))
        return els

    since_label = previous_timestamp or "last run"
    summary_bits = [
        f"Since {since_label}",
        f"added: <b>{len(added)}</b>",
        f"removed: <b>{len(removed)}</b>",
        f"toggled: <b>{len(toggled)}</b>",
        f"sg_changed: <b>{len(sg_changed)}</b>",
        f"property_changed: <b>{len(prop_changed)}</b>",
    ]
    els.append(Paragraph("  &middot;  ".join(summary_bits), styles["mute"]))

    if toggled:
        rows = [[
            Paragraph("SETTING", styles["cell_bold"]),
            Paragraph("FROM", styles["cell_bold"]),
            Paragraph("TO", styles["cell_bold"]),
        ]]
        for t in toggled[:MAX_TOGGLE_ROWS]:
            rows.append([
                Paragraph(t.get("title") or t["name"], styles["cell"]),
                Paragraph(t["from"], styles["cell_mute"]),
                Paragraph(t["to"], styles["cell"]),
            ])
        tbl = Table(rows, colWidths=["72%", "14%", "14%"])
        tbl.setStyle(TableStyle([
            ("LINEBELOW", (0, 0), (-1, 0), 0.4, INK),
            ("LINEBELOW", (0, 1), (-1, -1), 0.2, HAIRLINE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]))
        els += [Spacer(1, 4), tbl]
        if len(toggled) > MAX_TOGGLE_ROWS:
            els.append(Spacer(1, 3))
            els.append(Paragraph(
                f"{len(toggled) - MAX_TOGGLE_ROWS} more toggles omitted; check the markdown audit for the full list.",
                styles["mute"],
            ))

    return els


def build_drift_section(records: list, styles: dict[str, ParagraphStyle], audit) -> list:
    els = section_head("Drift against recommended baseline", styles)

    drift_records = [r for r in records if audit.status_of(r) == "drift"]
    if not drift_records:
        els.append(Paragraph(
            "All settings with a hard recommendation match the baseline.",
            styles["mute"],
        ))
        return els

    drift_records.sort(key=lambda r: (
        {"high": 0, "medium": 1, "low": 2, None: 3}.get(r.risk, 3),
        r.group,
        r.human_name,
    ))

    header = [
        Paragraph("RISK", styles["cell_bold"]),
        Paragraph("SETTING", styles["cell_bold"]),
        Paragraph("GROUP", styles["cell_bold"]),
        Paragraph("CURRENT", styles["cell_bold"]),
        Paragraph("RECOMMENDED", styles["cell_bold"]),
    ]
    rows = [header]
    shown = drift_records[:MAX_DRIFT_ROWS]
    for r in shown:
        risk_label = (r.risk or "-").upper()
        setting_cell = [
            Paragraph(r.human_name, styles["cell"]),
            Paragraph(r.api_name, styles["code"]),
        ]
        rows.append([
            Paragraph(risk_label, styles["cell_bold"]),
            setting_cell,
            Paragraph(r.group, styles["cell_mute"]),
            Paragraph(audit.current_state(r), styles["cell"]),
            Paragraph(r.recommended or "-", styles["cell"]),
        ])

    tbl = Table(
        rows,
        colWidths=["10%", "42%", "18%", "15%", "15%"],
        repeatRows=1,
    )
    style = [
        ("LINEBELOW", (0, 0), (-1, 0), 0.4, INK),
        ("LINEBELOW", (0, 1), (-1, -1), 0.2, HAIRLINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]
    for i, r in enumerate(shown, start=1):
        style.append((
            "TEXTCOLOR", (0, i), (0, i),
            RISK_COLORS.get(r.risk, WARM_GREY),
        ))
    tbl.setStyle(TableStyle(style))

    els.append(tbl)

    if len(drift_records) > MAX_DRIFT_ROWS:
        els.append(Spacer(1, 4))
        els.append(Paragraph(
            f"{len(drift_records) - MAX_DRIFT_ROWS} additional drift rows omitted; "
            f"see the full markdown audit for complete coverage.",
            styles["mute"],
        ))

    return els


def build_overrides_section(overrides: dict[str, dict[str, Any]], skipped: bool, styles: dict[str, ParagraphStyle]) -> list:
    els = section_head("Delegated overrides", styles)
    if skipped:
        els.append(Paragraph(
            "Override enumeration skipped via --no-overrides.",
            styles["mute"],
        ))
        return els

    unreachable = [scope for scope, r in overrides.items() if not r["reachable"]]
    total = sum(len(r["items"]) for r in overrides.values())

    if unreachable and total == 0:
        els.append(Paragraph(
            "Override endpoints not reachable for scope(s): "
            f"<b>{', '.join(unreachable)}</b>. "
            "Verify Fabric admin role and re-run; this section can only populate when all three admin endpoints succeed.",
            styles["mute"],
        ))
        return els

    if total == 0:
        els.append(Paragraph(
            "No delegated overrides found at capacity, domain, or workspace scope. "
            "Tenant-wide defaults are the effective posture for every setting.",
            styles["mute"],
        ))
        return els

    rows = [[
        Paragraph("SCOPE", styles["cell_bold"]),
        Paragraph("COUNT", styles["cell_bold"]),
    ]]
    for scope in ("capacity", "domain", "workspace"):
        count_text = str(len(overrides[scope]["items"]))
        if not overrides[scope]["reachable"]:
            count_text = "unreachable"
        rows.append([
            Paragraph(scope.capitalize(), styles["cell"]),
            Paragraph(count_text, styles["cell"]),
        ])
    rows.append([
        Paragraph("<b>Total</b>", styles["cell_bold"]),
        Paragraph(f"<b>{total}</b>", styles["cell_bold"]),
    ])
    tbl = Table(rows, colWidths=["72%", "28%"])
    tbl.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, 0), 0.4, INK),
        ("LINEBELOW", (0, 1), (-1, -2), 0.2, HAIRLINE),
        ("LINEABOVE", (0, -1), (-1, -1), 0.4, INK),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    els.append(tbl)
    els.append(Spacer(1, 6))
    els.append(Paragraph(
        "Review each override individually in the portal or via fabric-cli and "
        "tag as drift-vs-tenant, drift-vs-recommended, high-risk, or orphan. "
        "See references/delegated-overrides.md for the full classification workflow.",
        styles["mute"],
    ))
    return els
# endregion


# region Footer
def draw_footer(canvas, doc):
    """Thin hairline rule, disclaimer text, and a page number in small caps."""
    canvas.saveState()
    canvas.setStrokeColor(HAIRLINE)
    canvas.setLineWidth(0.3)
    w, _ = A4
    canvas.line(2 * cm, 1.6 * cm, w - 2 * cm, 1.6 * cm)

    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(WARM_GREY)
    canvas.drawString(
        2 * cm, 1.15 * cm,
        "Read-only audit. Recommendations are general, not prescriptive. "
        "User is responsible for due diligence before applying any change.",
    )
    canvas.drawRightString(w - 2 * cm, 1.15 * cm, f"PAGE {doc.page}")
    canvas.restoreState()
# endregion


# region Main
def main() -> int:
    parser = argparse.ArgumentParser(
        description="Render a clean PDF summary of a Fabric tenant settings audit.",
    )
    parser.add_argument("-o", "--output", type=Path, required=True,
                        help="Path to write the PDF to.")
    parser.add_argument("--snapshot", type=Path, default=None,
                        help="Path to the previous-run snapshot JSON; defaults to the path audit-tenant-settings.py uses.")
    parser.add_argument("--no-snapshot", action="store_true",
                        help="Skip snapshot load/save; disables change detection.")
    parser.add_argument("--no-overrides", action="store_true",
                        help="Skip delegated-override enumeration (faster; use when not an admin).")
    parser.add_argument("--tenant-label", type=str, default="",
                        help="Optional tenant display name shown in the masthead.")
    args = parser.parse_args()

    audit = load_audit_module()
    snapshot_path = args.snapshot or audit.DEFAULT_SNAPSHOT

    metadata = audit.load_metadata(audit.METADATA_PATH)
    live = audit.fetch_live_settings()
    records, unknown, missing = audit.merge(metadata, live)

    diff: dict[str, list[Any]] | None = None
    previous_timestamp: str | None = None
    if not args.no_snapshot:
        previous = audit.load_snapshot(snapshot_path)
        if previous is not None:
            previous_timestamp = previous.get("timestamp")
            diff = audit.diff_snapshots(previous, live)

    overrides: dict[str, dict[str, Any]] = {
        scope: {"reachable": False, "items": []}
        for scope in ("capacity", "domain", "workspace")
    }
    if not args.no_overrides:
        overrides = fetch_overrides()

    total = len(records)
    compliant = sum(1 for r in records if audit.status_of(r) == "compliant")
    drift_count = sum(1 for r in records if audit.status_of(r) == "drift")
    preview = sum(1 for r in records if r.preview)
    sg_scoped = sum(1 for r in records if (r.enabled_sg or r.excluded_sg))
    high_risk_drift = sum(
        1 for r in records
        if audit.status_of(r) == "drift" and r.risk == "high"
    )

    styles = build_styles()

    args.output.parent.mkdir(parents=True, exist_ok=True)

    doc = BaseDocTemplate(
        str(args.output),
        pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2 * cm, bottomMargin=2.4 * cm,
        title="Fabric Tenant Settings Audit",
        author="audit-tenant-settings",
    )
    frame = Frame(
        doc.leftMargin, doc.bottomMargin,
        doc.width, doc.height,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
    )
    doc.addPageTemplates([PageTemplate(id="body", frames=frame, onPage=draw_footer)])

    story: list = []
    story += build_masthead(args.tenant_label, audit.METADATA_PATH, styles)
    story.append(build_counts_strip(
        [
            ("Total",            total),
            ("Compliant",        compliant),
            ("Drift",            drift_count),
            ("High-risk drift",  high_risk_drift),
            ("Preview",          preview),
            ("SG-scoped",        sg_scoped),
        ],
        styles,
        doc.width,
    ))
    story += build_changes_section(diff, previous_timestamp, styles)
    story += build_drift_section(records, styles, audit)
    story += build_overrides_section(overrides, args.no_overrides, styles)

    doc.build(story)

    if not args.no_snapshot:
        audit.save_snapshot(snapshot_path, live)
        print(f"snapshot saved to {snapshot_path}", file=sys.stderr)

    print(f"wrote {args.output}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
# endregion
