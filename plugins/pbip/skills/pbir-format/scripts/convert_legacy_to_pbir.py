"""
Legacy Power BI report.json -> PBIR directory format converter.

Converts the monolithic legacy report.json (with stringified configs)
into the PBIR directory structure with individual files per page/visual.

Usage:
    python3 convert_legacy_to_pbir.py <input_report_dir> <output_report_dir>
"""

import json
import os
import re
import shutil
import sys
import uuid
from pathlib import Path


# region Constants

VISUAL_SCHEMA = "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.4.0/schema.json"
PAGE_SCHEMA = "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.0.0/schema.json"
REPORT_SCHEMA = "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/report/3.0.0/schema.json"
VERSION_SCHEMA = "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/versionMetadata/1.0.0/schema.json"
PAGES_SCHEMA = "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json"
DEFINITION_PBIR_SCHEMA = "https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json"

DISPLAY_OPTION_MAP = {
    0: "FitToWidth",
    1: "FitToPage",
    2: "ActualSize",
}

HOW_CREATED_MAP = {
    0: "User",   # PBIR schema only accepts "User" or "Auto"; map Unknown -> User
    1: "User",
    2: "Auto",
}

# Legacy settings that are not valid in PBIR and should be dropped
LEGACY_ONLY_SETTINGS = {
    "allowDataPointLassoSelect",
    "optOutNewFilterPaneExperience",
    "useNewFilterPaneExperience",
    "queryLimitOption",  # Not in PBIR schema
}

# Combo chart role mapping: legacy Y/Y2 -> PBIR ColumnY/LineY
COMBO_CHART_TYPES = {
    "lineStackedColumnComboChart",
    "lineClusteredColumnComboChart",
}

# endregion


# region Helper Functions

def safe_parse_json(value):
    """Parse a value that might be a stringified JSON or already parsed."""
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return value
    return value


def sanitize_folder_name(name):
    """Create a safe folder name from a display name."""
    safe = re.sub(r'[<>:"/\\|?*]', '_', name)
    safe = safe.strip('. ')
    return safe if safe else 'Unnamed'


def build_query_ref_to_field_map(prototype_query):
    """
    Build a mapping from queryRef -> field definition using prototypeQuery.

    In legacy format, projections only have queryRef strings.
    In PBIR, each projection needs a full field definition.
    The prototypeQuery's Select array has both the Name (queryRef) and
    the field definition (Column or Measure).
    """
    field_map = {}
    if not prototype_query:
        return field_map

    selects = prototype_query.get("Select", [])
    for sel in selects:
        name = sel.get("Name", "")

        # Determine field type (Column or Measure)
        field_def = None
        if "Column" in sel:
            col = sel["Column"]
            entity = col.get("Expression", {}).get("SourceRef", {}).get("Source", "")
            prop = col.get("Property", "")
            # Resolve entity name from From clause
            entity_name = resolve_entity_name(prototype_query, entity)
            field_def = {
                "Column": {
                    "Expression": {
                        "SourceRef": {
                            "Entity": entity_name
                        }
                    },
                    "Property": prop
                }
            }
        elif "Measure" in sel:
            meas = sel["Measure"]
            entity = meas.get("Expression", {}).get("SourceRef", {}).get("Source", "")
            prop = meas.get("Property", "")
            entity_name = resolve_entity_name(prototype_query, entity)
            field_def = {
                "Measure": {
                    "Expression": {
                        "SourceRef": {
                            "Entity": entity_name
                        }
                    },
                    "Property": prop
                }
            }
        elif "Aggregation" in sel:
            agg = sel["Aggregation"]
            field_def = {"Aggregation": agg}
            # Resolve SourceRef inside aggregation
            expr = agg.get("Expression", {})
            if "Column" in expr:
                source = expr["Column"].get("Expression", {}).get("SourceRef", {}).get("Source", "")
                entity_name = resolve_entity_name(prototype_query, source)
                field_def = {
                    "Aggregation": {
                        "Expression": {
                            "Column": {
                                "Expression": {
                                    "SourceRef": {
                                        "Entity": entity_name
                                    }
                                },
                                "Property": expr["Column"].get("Property", "")
                            }
                        },
                        "Function": agg.get("Function", 0)
                    }
                }

        if field_def and name:
            field_map[name] = field_def

    return field_map


def resolve_entity_name(prototype_query, source_alias):
    """Resolve a source alias (e.g. 'd') to the entity name (e.g. 'Date')."""
    from_list = prototype_query.get("From", [])
    for f in from_list:
        if f.get("Name") == source_alias:
            return f.get("Entity", source_alias)
    return source_alias


def extract_native_query_ref(query_ref):
    """Extract the native query ref (property name) from a full queryRef like 'Table.Column'."""
    if "." in query_ref:
        return query_ref.split(".", 1)[1]
    return query_ref

# endregion


# region Conversion Functions

def convert_projections_to_query_state(projections, prototype_query, column_properties=None):
    """
    Convert legacy projections + prototypeQuery into PBIR queryState format.

    Legacy: {"Values": [{"queryRef": "Table.Col", "active": true}]}
    PBIR: {"Values": {"projections": [{"field": {...}, "queryRef": "...", "nativeQueryRef": "...", "active": true}]}}
    """
    if not projections:
        return None

    field_map = build_query_ref_to_field_map(prototype_query)
    query_state = {}

    for role, proj_list in projections.items():
        if not isinstance(proj_list, list):
            continue

        pbir_projections = []
        for proj in proj_list:
            query_ref = proj.get("queryRef", "")
            field_def = field_map.get(query_ref)

            pbir_proj = {}

            if field_def:
                pbir_proj["field"] = field_def
            elif query_ref and "." in query_ref:
                # Fallback: build field ref from queryRef (Table.Field)
                table, prop = query_ref.split(".", 1)
                # Guess type: if it looks like a measure (has spaces, special chars) use Measure
                # Default to Column for simple names
                pbir_proj["field"] = {
                    "Column": {
                        "Expression": {
                            "SourceRef": {
                                "Entity": table
                            }
                        },
                        "Property": prop
                    }
                }

            pbir_proj["queryRef"] = query_ref
            pbir_proj["nativeQueryRef"] = extract_native_query_ref(query_ref)

            # Check for display name override in columnProperties
            if column_properties and query_ref in column_properties:
                col_props = column_properties[query_ref]
                if "displayName" in col_props:
                    pbir_proj["displayName"] = col_props["displayName"]

            if "active" in proj:
                pbir_proj["active"] = proj["active"]

            pbir_projections.append(pbir_proj)

        query_state[role] = {"projections": pbir_projections}

    return query_state


def convert_sort_definition(prototype_query):
    """Extract sort definition from prototypeQuery OrderBy."""
    order_by = prototype_query.get("OrderBy", [])
    if not order_by:
        return None

    sorts = []
    for ob in order_by:
        direction = ob.get("Direction", 1)
        sort_entry = {"direction": "Descending" if direction == 2 else "Ascending"}

        # Build field reference
        for field_type in ["Measure", "Column"]:
            if field_type in ob.get("Expression", {}):
                expr = ob["Expression"][field_type]
                source = expr.get("Expression", {}).get("SourceRef", {}).get("Source", "")
                entity_name = resolve_entity_name(prototype_query, source)
                prop = expr.get("Property", "")
                sort_entry["field"] = {
                    field_type: {
                        "Expression": {
                            "SourceRef": {
                                "Entity": entity_name
                            }
                        },
                        "Property": prop
                    }
                }
                break

        sorts.append(sort_entry)

    return {"sort": sorts, "isDefaultSort": True} if sorts else None


def convert_visual_container(vc_config_str, vc_filters_str, vc_x, vc_y, vc_z, vc_w, vc_h):
    """
    Convert a legacy visualContainer to a PBIR visual.json object.

    Returns (visual_name, visual_json_dict).
    """
    config = safe_parse_json(vc_config_str)
    filters = safe_parse_json(vc_filters_str) if vc_filters_str else []

    visual_name = config.get("name", "unknown")
    single_visual = config.get("singleVisual", {})

    # Build position from layout or fallback to container coords
    position = {}
    layouts = config.get("layouts", [])
    if layouts and "position" in layouts[0]:
        pos = layouts[0]["position"]
        position = {
            "x": pos.get("x", vc_x),
            "y": pos.get("y", vc_y),
            "z": pos.get("z", vc_z),
            "height": pos.get("height", vc_h),
            "width": pos.get("width", vc_w),
            "tabOrder": pos.get("tabOrder", pos.get("z", vc_z)),
        }
    else:
        position = {
            "x": vc_x,
            "y": vc_y,
            "z": vc_z,
            "height": vc_h,
            "width": vc_w,
            "tabOrder": int(vc_z) if vc_z else 0,
        }

    # Build visual object
    visual = {}
    visual["visualType"] = single_visual.get("visualType", "unknown")

    # Convert projections -> queryState
    projections = single_visual.get("projections")
    prototype_query = single_visual.get("prototypeQuery")
    column_properties = single_visual.get("columnProperties")

    if projections and prototype_query:
        query_state = convert_projections_to_query_state(
            projections, prototype_query, column_properties
        )
        if query_state:
            query = {"queryState": query_state}

            # Add sort definition
            sort_def = convert_sort_definition(prototype_query)
            if sort_def:
                query["sortDefinition"] = sort_def

            visual["query"] = query

    # Objects (visual-level formatting)
    if "objects" in single_visual:
        visual["objects"] = single_visual["objects"]

    # Visual container objects (vcObjects -> visualContainerObjects)
    if "vcObjects" in single_visual:
        visual["visualContainerObjects"] = single_visual["vcObjects"]

    # Combo chart roles: legacy uses Y and Y2, PBIR also uses Y and Y2
    # Y = Column y-axis (bars), Y2 = Line y-axis (lines)
    # No transformation needed -- preserve the original role names

    # Drill filter
    if "drillFilterOtherVisuals" in single_visual:
        visual["drillFilterOtherVisuals"] = single_visual["drillFilterOtherVisuals"]

    # Filter config on the visual
    if filters and isinstance(filters, list) and len(filters) > 0:
        converted_filters = convert_filters(filters)
        if converted_filters:
            visual["filterConfig"] = {"filters": converted_filters}

    # Build the complete visual.json
    visual_json = {
        "$schema": VISUAL_SCHEMA,
        "name": visual_name,
        "position": position,
        "visual": visual,
    }

    # Also add top-level filterConfig if there are visual-level filters
    if filters and isinstance(filters, list) and len(filters) > 0:
        converted_filters = convert_filters(filters)
        if converted_filters:
            visual_json["filterConfig"] = {"filters": converted_filters}
            # Remove from visual level to avoid duplication
            if "filterConfig" in visual:
                del visual["filterConfig"]

    return visual_name, visual_json


def convert_filters(filters_list):
    """
    Convert legacy filter format to PBIR filter format.

    Main change: 'expression' -> 'field', 'howCreated' int -> string
    """
    if not filters_list:
        return []

    converted = []
    for f in filters_list:
        new_filter = {}

        if "name" in f:
            new_filter["name"] = f["name"]
        else:
            new_filter["name"] = uuid.uuid4().hex[:20]

        if "displayName" in f:
            new_filter["displayName"] = f["displayName"]

        # expression -> field
        if "expression" in f:
            new_filter["field"] = f["expression"]
        elif "field" in f:
            new_filter["field"] = f["field"]

        if "type" in f:
            new_filter["type"] = f["type"]

        if "filter" in f:
            new_filter["filter"] = f["filter"]

        # howCreated: int -> string
        if "howCreated" in f:
            hc = f["howCreated"]
            if isinstance(hc, int):
                new_filter["howCreated"] = HOW_CREATED_MAP.get(hc, "User")
            else:
                new_filter["howCreated"] = hc

        if "objects" in f:
            new_filter["objects"] = f["objects"]

        if "isHiddenInViewMode" in f:
            new_filter["isHiddenInViewMode"] = f["isHiddenInViewMode"]

        if "isLockedInViewMode" in f:
            new_filter["isLockedInViewMode"] = f["isLockedInViewMode"]

        converted.append(new_filter)

    return converted


def convert_report_config(legacy_report):
    """
    Convert the legacy report top-level config + filters into PBIR report.json.
    """
    config = safe_parse_json(legacy_report.get("config", "{}"))
    filters = safe_parse_json(legacy_report.get("filters", "[]"))

    report_json = {
        "$schema": REPORT_SCHEMA,
    }

    # Theme collection
    theme_collection = config.get("themeCollection", {})
    if theme_collection:
        pbir_themes = {}
        if "baseTheme" in theme_collection:
            bt = theme_collection["baseTheme"]
            pbir_themes["baseTheme"] = {
                "name": bt.get("name", ""),
                "reportVersionAtImport": {
                    "visual": "2.4.0",
                    "report": "3.0.0",
                    "page": "2.0.0"
                },
                "type": "SharedResources",
            }
        if "customTheme" in theme_collection:
            ct = theme_collection["customTheme"]
            pbir_themes["customTheme"] = {
                "name": ct.get("name", ""),
                "reportVersionAtImport": {
                    "visual": "2.4.0",
                    "report": "3.0.0",
                    "page": "2.0.0"
                },
                "type": "RegisteredResources",
            }
        report_json["themeCollection"] = pbir_themes

    # Filter config
    if filters:
        converted_filters = convert_filters(filters)
        if converted_filters:
            report_json["filterConfig"] = {"filters": converted_filters}

    # Objects
    if "objects" in config:
        report_json["objects"] = config["objects"]

    # Resource packages
    if "resourcePackages" in legacy_report:
        pbir_packages = []
        for rp in legacy_report["resourcePackages"]:
            pkg = rp.get("resourcePackage", rp)
            pbir_pkg = {
                "name": pkg.get("name", ""),
                "type": pkg.get("name", ""),  # In PBIR, type matches name for standard packages
            }
            items = []
            for item in pkg.get("items", []):
                pbir_item = {
                    "name": item.get("name", ""),
                    "path": item.get("path", ""),
                }
                # Map item type
                item_type = item.get("type")
                if item_type == 202:
                    pbir_item["type"] = "BaseTheme"
                elif item_type == 100:
                    # Determine from name/path
                    if item["name"].endswith(".json"):
                        pbir_item["type"] = "CustomTheme"
                    else:
                        pbir_item["type"] = "Image"
                elif isinstance(item_type, str):
                    pbir_item["type"] = item_type
                else:
                    # Default: infer from file extension
                    name = item.get("name", "")
                    if name.endswith(".json"):
                        pbir_item["type"] = "CustomTheme"
                    elif name.endswith((".png", ".jpg", ".jpeg", ".svg", ".gif")):
                        pbir_item["type"] = "Image"
                    else:
                        pbir_item["type"] = "CustomTheme"
                items.append(pbir_item)
            pbir_pkg["items"] = items
            pbir_packages.append(pbir_pkg)
        report_json["resourcePackages"] = pbir_packages

    # Settings
    settings = config.get("settings", {})
    if settings:
        pbir_settings = {}
        for key, val in settings.items():
            # Drop legacy-only settings
            if key in LEGACY_ONLY_SETTINGS:
                continue
            # Convert exportDataMode from int to string
            if key == "exportDataMode" and isinstance(val, int):
                mode_map = {0: "Disabled", 1: "AllowSummarized", 2: "AllowAll"}
                pbir_settings[key] = mode_map.get(val, "AllowSummarized")
            else:
                pbir_settings[key] = val
        if "defaultDrillFilterOtherVisuals" in config:
            pbir_settings["defaultDrillFilterOtherVisuals"] = config["defaultDrillFilterOtherVisuals"]
        report_json["settings"] = pbir_settings

    # Public custom visuals
    if "publicCustomVisuals" in legacy_report:
        report_json["publicCustomVisuals"] = legacy_report["publicCustomVisuals"]

    return report_json


def convert_page(section, page_index):
    """
    Convert a legacy section to PBIR page.json.

    Returns (page_name_id, display_name, page_json, visual_list).
    """
    section_config = safe_parse_json(section.get("config", "{}"))
    section_filters = safe_parse_json(section.get("filters", "[]"))

    page_name = section.get("name", f"page_{page_index}")
    display_name = section.get("displayName", f"Page {page_index + 1}")
    height = section.get("height", 720)
    width = section.get("width", 1280)

    display_option = section.get("displayOption", 1)
    display_option_str = DISPLAY_OPTION_MAP.get(display_option, "FitToPage")

    page_json = {
        "$schema": PAGE_SCHEMA,
        "name": page_name,
        "displayName": display_name,
        "displayOption": display_option_str,
        "height": height,
        "width": width,
    }

    # Page-level objects
    if "objects" in section_config:
        page_json["objects"] = section_config["objects"]

    # Page-level filters
    if section_filters:
        converted_filters = convert_filters(section_filters)
        if converted_filters:
            page_json["filterConfig"] = {"filters": converted_filters}

    # Page background
    if "background" in section:
        page_json["background"] = section["background"]

    # Visual interactions (legacy "relationships" -> PBIR "visualInteractions")
    # Legacy type mapping: 1=Filter, 2=Highlight, 3=NoFilter
    # PBIR only stores NoFilter (Filter is the default, so omitted)
    relationships = section_config.get("relationships", [])
    if relationships:
        interactions = []
        for r in relationships:
            legacy_type = r.get("type", 1)
            if legacy_type == 3:  # NoFilter
                interactions.append({
                    "source": r["source"],
                    "target": r["target"],
                    "type": "NoFilter"
                })
        if interactions:
            page_json["visualInteractions"] = interactions

    if "visualInteractions" in section_config:
        page_json["visualInteractions"] = section_config["visualInteractions"]

    # Convert visual containers
    visuals = []
    for vc in section.get("visualContainers", []):
        vc_config = vc.get("config", "{}")
        vc_filters = vc.get("filters", "[]")
        v_name, v_json = convert_visual_container(
            vc_config, vc_filters,
            vc.get("x", 0), vc.get("y", 0), vc.get("z", 0),
            vc.get("width", 100), vc.get("height", 100)
        )
        visuals.append((v_name, v_json))

    return page_name, display_name, page_json, visuals

# endregion


# region Main Conversion

def convert_legacy_to_pbir(input_dir, output_dir):
    """
    Main conversion function.

    Reads legacy report.json from input_dir and creates
    PBIR directory structure in output_dir.
    """
    input_path = Path(input_dir)
    output_path = Path(output_dir)

    # Read legacy report.json
    legacy_path = input_path / "report.json"
    if not legacy_path.exists():
        print(f"ERROR: {legacy_path} not found")
        sys.exit(1)

    with open(legacy_path) as f:
        legacy_report = json.load(f)

    # Create output structure
    def_path = output_path / "definition"
    def_path.mkdir(parents=True, exist_ok=True)

    # 1. version.json
    version_json = {
        "$schema": VERSION_SCHEMA,
        "version": "2.0.0"
    }
    write_json(def_path / "version.json", version_json)
    print("  [+] definition/version.json")

    # 2. report.json
    report_json = convert_report_config(legacy_report)
    write_json(def_path / "report.json", report_json)
    print("  [+] definition/report.json")

    # 3. Pages
    sections = legacy_report.get("sections", [])
    pages_path = def_path / "pages"
    pages_path.mkdir(exist_ok=True)

    page_order = []
    active_page = None

    # Determine active section
    config = safe_parse_json(legacy_report.get("config", "{}"))
    active_index = config.get("activeSectionIndex", 0)

    for i, section in enumerate(sections):
        page_name, display_name, page_json, visuals = convert_page(section, i)
        page_order.append(page_name)

        if i == active_index:
            active_page = page_name

        # Create page directory (use page name/ID, not display name)
        folder_name = page_name
        page_dir = pages_path / folder_name
        page_dir.mkdir(exist_ok=True)

        # Write page.json
        write_json(page_dir / "page.json", page_json)
        print(f"  [+] pages/{folder_name}/page.json ({len(visuals)} visuals)")

        # Create visuals
        visuals_dir = page_dir / "visuals"
        if visuals:
            visuals_dir.mkdir(exist_ok=True)

        for v_name, v_json in visuals:
            visual_type = v_json.get("visual", {}).get("visualType", "unknown")
            visual_folder = f"{v_name}-Visual"
            visual_dir = visuals_dir / visual_folder
            visual_dir.mkdir(exist_ok=True)
            write_json(visual_dir / "visual.json", v_json)

    # 4. pages.json
    pages_meta = {
        "$schema": PAGES_SCHEMA,
        "pageOrder": page_order,
    }
    if active_page:
        pages_meta["activePageName"] = active_page
    write_json(pages_path / "pages.json", pages_meta)
    print("  [+] pages/pages.json")

    # 5. Copy definition.pbir (update version if needed)
    src_pbir = input_path / "definition.pbir"
    if src_pbir.exists():
        with open(src_pbir) as f:
            pbir_data = json.load(f)
        # Ensure it has the right schema
        pbir_data["$schema"] = DEFINITION_PBIR_SCHEMA
        write_json(output_path / "definition.pbir", pbir_data)
        print("  [+] definition.pbir")

    # 6. Copy .platform
    src_platform = input_path / ".platform"
    if src_platform.exists():
        shutil.copy2(src_platform, output_path / ".platform")
        print("  [+] .platform")

    # 7. Copy StaticResources
    src_static = input_path / "StaticResources"
    if src_static.exists():
        dst_static = output_path / "StaticResources"
        if dst_static.exists():
            shutil.rmtree(dst_static)
        shutil.copytree(src_static, dst_static)
        print("  [+] StaticResources/")

    print(f"\nConversion complete: {len(sections)} pages, {sum(len(s.get('visualContainers', [])) for s in sections)} visuals")


def write_json(path, data):
    """Write JSON with consistent formatting."""
    with open(path, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')

# endregion


# region Entry Point

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <input_report_dir> <output_report_dir>")
        sys.exit(1)

    input_dir = sys.argv[1]
    output_dir = sys.argv[2]

    print(f"Converting legacy report: {input_dir}")
    print(f"Output PBIR: {output_dir}")
    print()

    convert_legacy_to_pbir(input_dir, output_dir)

# endregion
