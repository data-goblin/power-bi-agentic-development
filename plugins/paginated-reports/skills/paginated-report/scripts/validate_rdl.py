#!/usr/bin/env python3
"""Structural validator for RDL (paginated report) files.

Catches the mechanical "unwritten rule" breakage that hand-editing an .rdl
introduces and that the report engine reports only as an opaque "invalid
report definition". It does NOT validate expressions, live field references,
or render correctness; those surface only at render time.

Checks:
  - XML is well-formed
  - root is <Report> in a reportdefinition namespace (warns if not 2016/01)
  - MustUnderstand="df" present when <df:DefaultFontFamily> is used
  - <rd:ReportID> present and a valid GUID
  - top-level child elements are in the conventional order (the 2016 XSD declares
    them as an unordered choice, so a schema pass does not catch a reorder; the
    structural order DataSources, DataSets, ReportSections, ReportParameters is
    what Report Builder writes)
  - report-item, group, dataset, data-source, parameter, and embedded-image
    names are unique within their scope
  - tablix invariants: column count == column-hierarchy leaf count,
    row count == row-hierarchy leaf count, and each row's cell span sum ==
    column count
  - every dataset's DataSourceName resolves to a defined data source
  - every tablix DataSetName resolves to a defined dataset
  - every embedded-image reference resolves to a defined EmbeddedImage
  - layout dimensions carry a unit suffix (in/cm/mm/pt/pc)
  - PDF width trap: per ReportSection, <Width> + LeftMargin + RightMargin must be
    <= PageWidth, otherwise hard renderers emit blank pages to the right
  - every =Fields!X reference resolves to a field of the dataset in scope (the
    enclosing data region's DataSetName, or a dataset named in a quoted scope
    argument); every =Parameters!X resolves to a <ReportParameter>; every
    =ReportItems!X resolves to a named report item; parameter ValueField and
    LabelField resolve to fields of the referenced dataset
  - warnings: QueryParameter names not bound to an @name in the query, the @
    prefix convention per provider, and report items wider than the section

Usage:
    python3 validate_rdl.py report.rdl [more.rdl ...]
    python3 validate_rdl.py --hook < hook-json   (PostToolUse hook mode)

Exit code 0 if all files pass (warnings allowed), 1 if any file has errors. In
hook mode the exit code is 2 when the written .rdl has errors (blocks), else 0;
an unexpected crash in hook mode prints a note to stderr and exits 0.
"""

from __future__ import annotations

import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

GUID_RE = re.compile(r"^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$")
# RDL Size units are in/cm/mm/pt/pc (px is NOT valid); a space before the unit
# is allowed by the spec.
DIMENSION_RE = re.compile(r"^-?\d*\.?\d+\s*(in|cm|mm|pt|pc)$")

DIMENSION_TAGS = {
    "Width",
    "Height",
    "Top",
    "Left",
    "PageHeight",
    "PageWidth",
    "InteractiveHeight",
    "InteractiveWidth",
    "LeftMargin",
    "RightMargin",
    "TopMargin",
    "BottomMargin",
}

REPORT_ITEM_TAGS = {
    "Textbox",
    "Tablix",
    "Chart",
    "Image",
    "Rectangle",
    "Subreport",
    "Line",
    "Map",
    "Gauge",
    "GaugePanel",
    "CustomReportItem",
    "DataBar",
    "Sparkline",
    "Indicator",
}

UNIT_INCHES = {"in": 1.0, "cm": 1 / 2.54, "mm": 1 / 25.4, "pt": 1 / 72, "pc": 1 / 6}
SIZE_RE = re.compile(r"^(-?\d*\.?\d+)\s*(in|cm|mm|pt|pc)$")
FIELD_REF_RE = re.compile(r"\bFields!([A-Za-z_]\w*)\s*\.")
PARAM_REF_RE = re.compile(r"\bParameters!([A-Za-z_]\w*)\s*\.")
ITEM_REF_RE = re.compile(r"\bReportItems!([A-Za-z_]\w*)\s*\.")
COLLECTION_RE = re.compile(r"\b([A-Za-z_]\w*)!([A-Za-z_]\w*)")
KNOWN_COLLECTIONS = {
    "Fields",
    "Parameters",
    "Globals",
    "User",
    "ReportItems",
    "Variables",
    "DataSets",
    "DataSources",
}
QUOTED_RE = re.compile(r'"((?:[^"]|"")*)"')
QUERY_PARAM_RE = re.compile(r"@([A-Za-z_]\w*)")
DATA_REGION_TAGS = {
    "Tablix",
    "Chart",
    "Gauge",
    "GaugePanel",
    "Map",
    "DataBar",
    "Sparkline",
    "Indicator",
}
SQL_PROVIDERS = {"SQL", "SQLAZURE", "OLEDB", "ODBC", "ORACLE", "TERADATA"}
DAX_PROVIDERS = {"PBIDATASET"}


def size_inches(text: str | None) -> float | None:
    """Parse an RDL Size (3in, 0.5 cm) to inches; None for missing or expression values."""
    if text is None:
        return None
    m = SIZE_RE.match(text.strip())
    return float(m.group(1)) * UNIT_INCHES[m.group(2)] if m else None


# Element local names whose Name attribute is checked for uniqueness, mapped to
# a human label. Uniqueness is scoped to the item's namespace (see
# _check_unique_names), not the whole report. Groups are bucketed separately
# from report items on purpose: real Report Builder output names a group and its
# header textbox identically (e.g. the field name), which is legal, so merging
# the buckets would false-positive on authentic reports.
NAMED_KINDS = {tag: "report item" for tag in REPORT_ITEM_TAGS}
NAMED_KINDS.update(
    {
        "Group": "group",
        "DataSet": "dataset",
        "DataSource": "data source",
        "ReportParameter": "report parameter",
        "EmbeddedImage": "embedded image",
    }
)

# Rank of top-level <Report> children for the 2016 schema. The order check only
# enforces the load-bearing structural sequence (data sources -> datasets ->
# sections -> parameters -> layout). The trailing optional metadata elements
# share one high rank because real Report Builder output varies their order
# (e.g. it writes CustomProperties before EmbeddedImages). Unknown elements are
# ignored, so the check never false-positives. 2005/2010 schemas place
# Body/Page/Width at the top level and are out of scope (warned on separately).
_TAIL = 90
# Only the structural sequence is order-enforced. Leading metadata
# (rd:ReportUnitType, rd:ReportID, am:AuthoringMetadata, df:DefaultFontFamily,
# Description, Author, AutoRefresh) is deliberately NOT ranked: real Report
# Builder output varies its position (those rd: elements appear first in some
# files and last, after EmbeddedImages, in others), so enforcing it would
# false-fail authentic reports. The trailing metadata shares one rank, so its
# mutual order is free too; it only has to follow the structural block.
TOPLEVEL_RANK = {
    "DataSources": 10,
    "DataSets": 11,
    "ReportSections": 12,
    "Body": 12,
    "ReportParameters": 13,
    "ReportParametersLayout": 14,
    "Variables": _TAIL,
    "Code": _TAIL,
    "EmbeddedImages": _TAIL,
    "CustomProperties": _TAIL,
    "ConsumeContainerWhitespace": _TAIL,
}

# Report-item containers that have their own coordinate space; layout-dimension
# elements inside them are unitless numbers, so the unit check must not descend.
COORD_SPACE_TAGS = {"Chart", "Gauge", "GaugePanel", "Map", "CustomReportItem"}


def local(el: ET.Element) -> str:
    """Local name of an element, namespace stripped."""
    return el.tag.rsplit("}", 1)[-1]


def children(el: ET.Element, name: str) -> list[ET.Element]:
    return [c for c in el if local(c) == name]


def first(el: ET.Element, name: str) -> ET.Element | None:
    for c in el:
        if local(c) == name:
            return c
    return None


def child_text(el: ET.Element | None, name: str) -> str | None:
    """Stripped text of the named direct child, or None when el or the child is absent."""
    child = first(el, name) if el is not None else None
    return (child.text or "").strip() if child is not None else None


def descendants(el: ET.Element, name: str) -> list[ET.Element]:
    return [d for d in el.iter() if local(d) == name]


class Report:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.root: ET.Element | None = None

    def err(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)

    def validate(self) -> None:
        try:
            self.root = ET.parse(self.path).getroot()
        except ET.ParseError as exc:
            self.err(f"XML is not well-formed: {exc}")
            return

        root = self.root
        if local(root) != "Report":
            self.err(f"root element is <{local(root)}>, expected <Report>")
            return

        ns = root.tag[1:].split("}", 1)[0] if root.tag.startswith("{") else ""
        if "reportdefinition" not in ns:
            self.err(f"root namespace is not an RDL reportdefinition namespace: {ns}")
        elif "2016/01" not in ns:
            self.warn(f"root namespace is {ns}; author new reports against 2016/01")

        self._check_default_font(root)
        self._check_report_id(root)
        self._check_toplevel_order(root)
        self._check_unique_names(root)
        self._check_references(root)
        self._check_tablixes(root)
        self._check_dimensions(root)
        self._check_page_width(root)
        self._check_expression_references(root)
        self._check_parameter_fields(root)
        self._check_query_parameters(root)

    def _check_page_width(self, root: ET.Element) -> None:
        for section in descendants(root, "ReportSection"):
            page = first(section, "Page")
            width = size_inches(child_text(section, "Width"))
            if page is None or width is None:
                continue
            page_width = size_inches(child_text(page, "PageWidth") or "8.5in")
            left = size_inches(child_text(page, "LeftMargin") or "0in")
            right = size_inches(child_text(page, "RightMargin") or "0in")
            if page_width is None or left is None or right is None:
                continue
            used = width + left + right
            if used > page_width + 0.005:
                self.err(
                    f"PDF width trap: section Width {width:.3g}in + margins "
                    f"{left + right:.3g}in = {used:.3g}in exceeds PageWidth "
                    f"{page_width:.3g}in; usable width is {page_width - left - right:.3g}in"
                )
            body = first(section, "Body")
            items = first(body, "ReportItems") if body is not None else None
            for item in items if items is not None else []:
                if local(item) not in REPORT_ITEM_TAGS:
                    continue
                item_left = size_inches(child_text(item, "Left") or "0in")
                item_width = size_inches(child_text(item, "Width"))
                if (
                    item_left is not None
                    and item_width is not None
                    and item_left + item_width > width + 0.005
                ):
                    self.warn(
                        f"{local(item)} {item.get('Name')!r} ends at {item_left + item_width:.3g}in, "
                        f"past the section Width {width:.3g}in"
                    )

    def _dataset_fields(self, root: ET.Element) -> dict[str, set[str]]:
        return {
            ds.get("Name", ""): {
                f.get("Name", "")
                for fields in children(ds, "Fields")
                for f in children(fields, "Field")
            }
            for ds in descendants(root, "DataSet")
        }

    def _check_expression_references(self, root: ET.Element) -> None:
        datasets = self._dataset_fields(root)
        params = {p.get("Name", "") for p in descendants(root, "ReportParameter")}
        items = {
            el.get("Name", "")
            for el in root.iter()
            if local(el) in REPORT_ITEM_TAGS and el.get("Name")
        }
        seen: set[str] = set()

        def report(what: str, where: str, hint: str = "") -> None:
            message = f"{what} in {where} {hint}".rstrip()
            if message not in seen:
                seen.add(message)
                self.err(message)

        def case_hint(name: str, known: set[str]) -> str:
            twins = sorted(k for k in known if k.lower() == name.lower())
            return f"(differs only by case from {twins[0]!r})" if twins else ""

        def walk(el: ET.Element, scope: str | None, where: str) -> None:
            tag = local(el)
            if tag in DATA_REGION_TAGS:
                dsn = first(el, "DataSetName")
                if dsn is not None and (dsn.text or "").strip():
                    scope = (dsn.text or "").strip()
                where = f"{tag} {el.get('Name')!r}"
            elif tag == "DataSet":
                scope, where = el.get("Name"), f"DataSet {el.get('Name')!r}"
            text = (el.text or "").strip()
            if text.startswith("=") and len(el) == 0:
                self._check_expression(
                    text, scope, where, datasets, params, items, report, case_hint
                )
            for child in el:
                walk(child, scope, where)

        walk(root, None, "the report")

    def _check_expression(
        self, expr, scope, where, datasets, params, items, report, case_hint
    ) -> None:
        strings = {m.group(1).replace('""', '"') for m in QUOTED_RE.finditer(expr)}
        for m in COLLECTION_RE.finditer(QUOTED_RE.sub('""', expr)):
            if m.group(1) not in KNOWN_COLLECTIONS:
                self.warn(
                    f"{m.group(1)}!{m.group(2)} in {where}: {m.group(1)} is not an RDL collection "
                    "(Fields, Parameters, Globals, User, ReportItems, Variables)"
                )
        scoped = {s for s in strings if s in datasets}
        candidates = ({scope} if scope in datasets else set()) | scoped
        if not candidates and len(datasets) == 1:
            candidates = set(datasets)
        for m in FIELD_REF_RE.finditer(expr):
            name = m.group(1)
            if not candidates:
                if datasets:
                    self.warn(
                        f"Fields!{name} in {where} has no dataset scope "
                        "(pass the dataset name as the aggregate's scope argument)"
                    )
                continue
            known = set().union(*(datasets[c] for c in candidates))
            if name not in known:
                names = ", ".join(sorted(candidates))
                report(
                    f"undefined field Fields!{name}",
                    f"{where} (dataset {names})",
                    case_hint(name, known),
                )
        for m in PARAM_REF_RE.finditer(expr):
            name = m.group(1)
            if name not in params:
                report(
                    f"undefined parameter Parameters!{name}",
                    where,
                    case_hint(name, params),
                )
        for m in ITEM_REF_RE.finditer(expr):
            name = m.group(1)
            if name not in items:
                report(
                    f"undefined report item ReportItems!{name}",
                    where,
                    case_hint(name, items),
                )

    def _check_parameter_fields(self, root: ET.Element) -> None:
        datasets = self._dataset_fields(root)
        for param in descendants(root, "ReportParameter"):
            for ref in descendants(param, "DataSetReference"):
                dsn = child_text(ref, "DataSetName")
                fields = datasets.get(dsn) if dsn else None
                if fields is None:
                    continue
                for tag in ("ValueField", "LabelField"):
                    value = child_text(ref, tag)
                    if value is not None and value not in fields:
                        self.err(
                            f"report parameter {param.get('Name')!r}: <{tag}> "
                            f"{value!r} is not a field of dataset {dsn!r}"
                        )

    def _check_query_parameters(self, root: ET.Element) -> None:
        provider_by_source = {
            ds.get("Name", ""): (
                child_text(first(ds, "ConnectionProperties"), "DataProvider") or ""
            ).upper()
            for ds in descendants(root, "DataSource")
        }
        for ds in descendants(root, "DataSet"):
            query = first(ds, "Query")
            if query is None:
                continue
            is_proc = child_text(query, "CommandType") == "StoredProcedure"
            command = first(query, "CommandText")
            text = (command.text or "") if command is not None else ""
            provider = provider_by_source.get(
                child_text(query, "DataSourceName") or "", ""
            )
            for qps in children(query, "QueryParameters"):
                for qp in children(qps, "QueryParameter"):
                    raw = qp.get("Name", "")
                    bare = raw.lstrip("@")
                    if provider in DAX_PROVIDERS and raw.startswith("@"):
                        self.warn(
                            f"dataset {ds.get('Name')!r}: PBIDATASET QueryParameter "
                            f"{raw!r} should not carry the @ prefix (the DAX uses @{bare})"
                        )
                    if (
                        provider in SQL_PROVIDERS
                        and not is_proc
                        and not raw.startswith("@")
                    ):
                        self.warn(
                            f"dataset {ds.get('Name')!r}: {provider} QueryParameter "
                            f"{raw!r} should carry the @ prefix"
                        )
                    if (
                        not is_proc
                        and provider != "ENTERDATA"
                        and bare not in set(QUERY_PARAM_RE.findall(text))
                    ):
                        self.warn(
                            f"dataset {ds.get('Name')!r}: QueryParameter {raw!r} is not "
                            f"referenced as @{bare} in the query text"
                        )

    def _check_default_font(self, root: ET.Element) -> None:
        if first(root, "DefaultFontFamily") is not None:
            must = root.get("MustUnderstand", "")
            if "df" not in must.split():
                self.err(
                    '<df:DefaultFontFamily> present but MustUnderstand="df" '
                    "missing on <Report>"
                )

    def _check_report_id(self, root: ET.Element) -> None:
        rid = first(root, "ReportID")
        if rid is None:
            self.warn("<rd:ReportID> missing; Report Builder writes one per report")
        elif not GUID_RE.match((rid.text or "").strip()):
            self.err(f"<rd:ReportID> is not a valid GUID: {rid.text!r}")

    def _check_toplevel_order(self, root: ET.Element) -> None:
        # Compare each ranked element to the immediately preceding ranked one.
        # Do not carry forward a running max: one early high-rank element must
        # not poison every later element (that produced self-contradicting
        # cascades). Equal ranks (the tail metadata block) are allowed in any
        # mutual order.
        prev_rank = -1
        prev_name = ""
        for child in root:
            name = local(child)
            rank = TOPLEVEL_RANK.get(name)
            if rank is None:
                continue
            if rank < prev_rank:
                self.err(
                    f"top-level <{name}> appears after <{prev_name}>; "
                    f"expected order has <{name}> before it"
                )
            prev_rank, prev_name = rank, name

    def _check_unique_names(self, root: ET.Element) -> None:
        # A Name must be unique within the namespace of its item: the innermost
        # containing element that itself has a Name (RDL spec). An element with a
        # Name opens a new namespace for its descendants, so two tablixes may each
        # contain a group named "Detail" or a textbox named "Sales" without colliding.
        names: dict[tuple[int, str], set[str]] = {}

        def walk(el: ET.Element, ns_id: int, ns_label: str) -> None:
            name = el.get("Name")
            kind = NAMED_KINDS.get(local(el))
            if kind is not None and name is not None:
                bucket = names.setdefault((ns_id, kind), set())
                if name in bucket:
                    self.err(f"duplicate {kind} Name {name!r} within {ns_label}")
                bucket.add(name)
            if name is not None:
                ns_id, ns_label = id(el), f"<{local(el)} Name={name!r}>"
            for child in el:
                walk(child, ns_id, ns_label)

        walk(root, id(root), "the report")

    def _check_references(self, root: ET.Element) -> None:
        ds_names = {e.get("Name") for e in descendants(root, "DataSource")}
        dataset_names = {e.get("Name") for e in descendants(root, "DataSet")}
        img_names = {e.get("Name") for e in descendants(root, "EmbeddedImage")}

        for ds in descendants(root, "DataSet"):
            query = first(ds, "Query")
            if query is None:
                continue
            src = first(query, "DataSourceName")
            if src is not None and (src.text or "").strip() not in ds_names:
                self.err(
                    f"dataset {ds.get('Name')!r} references undefined data "
                    f"source {src.text!r}"
                )

        for tablix in descendants(root, "Tablix"):
            dsn = first(tablix, "DataSetName")
            if dsn is not None and (dsn.text or "").strip() not in dataset_names:
                self.err(
                    f"tablix {tablix.get('Name')!r} references undefined "
                    f"dataset {dsn.text!r}"
                )

        for img in descendants(root, "Image"):
            source = first(img, "Source")
            value = first(img, "Value")
            if source is not None and (source.text or "").strip() == "Embedded":
                val = (value.text or "").strip() if value is not None else ""
                # An expression-driven Value (e.g. =Fields!Flag.Value) selects the
                # embedded image at runtime; only a literal name can be checked.
                if not val.startswith("=") and val not in img_names:
                    self.err(
                        f"image {img.get('Name')!r} is Embedded but its Value "
                        f"{val!r} matches no <EmbeddedImage>"
                    )

        # Report parameters often source their ValidValues/DefaultValue from a
        # dataset; a typo'd <DataSetName> only fails at render, so catch it here.
        for param in descendants(root, "ReportParameter"):
            for dsref in descendants(param, "DataSetReference"):
                dsn = first(dsref, "DataSetName")
                if dsn is not None and (dsn.text or "").strip() not in dataset_names:
                    self.err(
                        f"report parameter {param.get('Name')!r} references "
                        f"undefined dataset {dsn.text!r}"
                    )

    def _check_tablixes(self, root: ET.Element) -> None:
        for tablix in descendants(root, "Tablix"):
            name = tablix.get("Name", "?")
            body = first(tablix, "TablixBody")
            if body is None:
                self.err(f"tablix {name!r} has no <TablixBody>")
                continue

            cols_el = first(body, "TablixColumns")
            rows_el = first(body, "TablixRows")
            n_cols = (
                len(children(cols_el, "TablixColumn")) if cols_el is not None else 0
            )
            rows = children(rows_el, "TablixRow") if rows_el is not None else []

            col_h = first(tablix, "TablixColumnHierarchy")
            row_h = first(tablix, "TablixRowHierarchy")
            col_leaves = self._leaf_members(col_h)
            row_leaves = self._leaf_members(row_h)

            if col_leaves != n_cols:
                self.err(
                    f"tablix {name!r}: {n_cols} <TablixColumn> but "
                    f"{col_leaves} column-hierarchy leaf member(s)"
                )
            if row_leaves != len(rows):
                self.err(
                    f"tablix {name!r}: {len(rows)} <TablixRow> but "
                    f"{row_leaves} row-hierarchy leaf member(s)"
                )

            # cells-per-row == column count is only a reliable invariant for a
            # flat table (static columns, no column group, no row spans). A
            # matrix (column group) or merged cells legitimately diverge, and
            # real reports do, so skip the cell check unless the tablix is flat.
            # The leaf-count checks above still apply in all cases.
            col_h_has_group = col_h is not None and any(
                local(e) == "Group" for e in col_h.iter()
            )
            has_row_span = any(
                (rs.text or "").strip() not in ("", "1")
                for rs in descendants(tablix, "RowSpan")
            )
            if col_h_has_group or has_row_span:
                continue

            # RDL keeps one <TablixCell> per column; ColSpan is a render-merge
            # hint that does not change the cell count, so count cells (do not
            # sum ColSpan).
            for i, row in enumerate(rows):
                cells_el = first(row, "TablixCells")
                cells = children(cells_el, "TablixCell") if cells_el is not None else []
                if len(cells) != n_cols:
                    self.err(
                        f"tablix {name!r} row {i + 1}: {len(cells)} <TablixCell> "
                        f"!= column count {n_cols}"
                    )

    def _leaf_members(self, hierarchy: ET.Element | None) -> int:
        """Count TablixMember leaves (members with no nested TablixMembers)."""
        if hierarchy is None:
            return 0
        members_el = first(hierarchy, "TablixMembers")
        if members_el is None:
            return 0
        return self._count_leaves(members_el)

    def _count_leaves(self, members_el: ET.Element) -> int:
        total = 0
        for member in children(members_el, "TablixMember"):
            nested = first(member, "TablixMembers")
            total += self._count_leaves(nested) if nested is not None else 1
        return total

    def _check_dimensions(self, root: ET.Element) -> None:
        # Layout dimensions need a unit suffix, but charts/gauges/maps have their
        # own (unitless) coordinate space. Check a coordinate-space item's own
        # position dimensions, but do not descend into its internals.
        def walk(el: ET.Element) -> None:
            coord = local(el) in COORD_SPACE_TAGS
            for child in el:
                if local(child) in DIMENSION_TAGS:
                    text = (child.text or "").strip()
                    if (
                        text
                        and not text.startswith("=")
                        and not DIMENSION_RE.match(text)
                    ):
                        self.err(
                            f"<{local(child)}> value {text!r} lacks a unit "
                            "suffix (in/cm/mm/pt/pc)"
                        )
                if not coord:
                    walk(child)

        walk(root)


def validate_paths(paths: list[str]) -> int:
    any_errors = False
    for arg in paths:
        path = Path(arg)
        report = Report(path)
        if not path.is_file():
            print(f"FAIL {arg}: not a file")
            any_errors = True
            continue
        report.validate()

        if report.errors:
            any_errors = True
            print(
                f"FAIL {arg}  ({len(report.errors)} error(s), "
                f"{len(report.warnings)} warning(s))"
            )
            for msg in report.errors:
                print(f"  ERROR  {msg}")
        else:
            print(f"PASS {arg}  ({len(report.warnings)} warning(s))")
        for msg in report.warnings:
            print(f"  WARN   {msg}")

    return 1 if any_errors else 0


def hook_path(payload: object) -> str | None:
    """The written file path from a Claude Code or Copilot CLI hook payload, else None."""
    if not isinstance(payload, dict):
        return None
    tool_input = payload.get("tool_input") or payload.get("toolArgs") or {}
    if isinstance(tool_input, str):
        try:
            tool_input = json.loads(tool_input)
        except ValueError:
            return None
    if not isinstance(tool_input, dict):
        return None
    path = tool_input.get("file_path") or tool_input.get("path")
    return path.replace("\\", "/") if isinstance(path, str) else None


def hook_main() -> int:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
        path = hook_path(payload)
        if not path or not path.lower().endswith(".rdl") or not Path(path).is_file():
            return 0
        report = Report(Path(path))
        report.validate()
        if not report.errors:
            return 0
        print(f"RDL validation failed: {path}", file=sys.stderr)
        for msg in report.errors:
            print(f"  ERROR  {msg}", file=sys.stderr)
        for msg in report.warnings:
            print(f"  WARN   {msg}", file=sys.stderr)
        print(
            "Fix these before continuing. Rerun: python3 validate_rdl.py <file.rdl>",
            file=sys.stderr,
        )
        return 2
    except Exception as exc:  # noqa: BLE001 - a crashed validator must fail open, never block an edit
        print(
            f"paginated-reports: validate_rdl.py crashed in hook mode ({exc!r}); .rdl not validated",
            file=sys.stderr,
        )
        return 0


def main(argv: list[str]) -> int:
    if argv == ["--hook"]:
        return hook_main()
    if not argv:
        print(__doc__)
        return 2
    return validate_paths(argv)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
