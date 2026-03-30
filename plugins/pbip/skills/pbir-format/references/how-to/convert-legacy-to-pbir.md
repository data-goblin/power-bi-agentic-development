# Convert Legacy Report Format to PBIR

Procedure for converting Power BI reports from the legacy monolithic `report.json` format to the PBIR directory format. The officially supported method is to open and save in Power BI Desktop, but programmatic conversion is possible when Desktop is unavailable.

**WARNING:** Programmatic legacy-to-PBIR conversion is **not officially supported by Microsoft**. Always take a backup of the original report before attempting conversion. Use `fab export` to save the original locally, or copy the report in the workspace first. The conversion may produce valid JSON that still fails to render correctly due to undocumented format nuances.

**Script:** A Python conversion script is available at `scripts/convert_legacy_to_pbir.py`. Usage:
```bash
python3 scripts/convert_legacy_to_pbir.py <legacy_report_dir> <output_pbir_dir>
```

## Format Differences

### Legacy format

A single `report.json` at the report root with stringified JSON:

```
Report.Report/
  .platform
  definition.pbir
  report.json              <-- everything in one file
  StaticResources/
```

Key characteristics:
- `config`, `filters` are **stringified JSON** (JSON inside a JSON string)
- `sections[]` array contains pages, each with `visualContainers[]`
- Each visual container has a `config` string containing `singleVisual` with `projections` + `prototypeQuery`
- Visual container formatting uses `vcObjects` (not `visualContainerObjects`)
- Display options are integers (0=FitToWidth, 1=FitToPage, 2=ActualSize)
- `howCreated` on filters is an integer (0=Unknown, 1=User, 2=Auto)
- Visual interactions stored as `relationships` in section config (type: 1=Filter, 2=Highlight, 3=NoFilter)

### PBIR format

A `definition/` directory with separate files per component:

```
Report.Report/
  .platform
  definition.pbir
  definition/
    version.json
    report.json
    pages/
      pages.json
      PageId/
        page.json
        visuals/
          VisualId/
            visual.json
  StaticResources/
```

Key characteristics:
- All JSON is properly structured (no stringified nesting)
- `query.queryState` with full `field` references replaces `projections` + `prototypeQuery`
- `visualContainerObjects` replaces `vcObjects`
- Display options are strings (`"FitToPage"`, `"FitToWidth"`, `"ActualSize"`)
- `howCreated` on filters is a string (`"User"`, `"Auto"`, `"Unknown"`)
- Visual interactions stored as `visualInteractions` in `page.json` (only `NoFilter` entries; Filter is default)
- `themeCollection` entries require `reportVersionAtImport`

## Conversion Steps

### 1. Export the legacy report

```bash
fab export "Workspace.Workspace/Report.Report" -o ./exports -f
```

Verify the format by checking for `report.json` at root with no `definition/` directory.

### 2. Parse the legacy report.json

All stringified fields must be parsed:

```python
import json

def safe_parse(value):
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return value
    return value

# Top-level config and filters are stringified
config = safe_parse(report_data["config"])
filters = safe_parse(report_data["filters"])

# Each section's config and filters are stringified
for section in report_data["sections"]:
    section_config = safe_parse(section["config"])
    section_filters = safe_parse(section["filters"])

    # Each visual container's config and filters are stringified
    for vc in section.get("visualContainers", []):
        vc_config = safe_parse(vc["config"])
        vc_filters = safe_parse(vc["filters"])
```

### 3. Create the PBIR directory structure

#### version.json

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/versionMetadata/1.0.0/schema.json",
  "version": "2.0.0"
}
```

#### report.json

Map from the legacy top-level config:

| Legacy (stringified config) | PBIR report.json |
|---|---|
| `config.themeCollection.baseTheme` | `themeCollection.baseTheme` (add `reportVersionAtImport`) |
| `config.themeCollection.customTheme` | `themeCollection.customTheme` (add `reportVersionAtImport`) |
| `config.objects` | `objects` |
| `config.settings` | `settings` |
| `filters` (stringified array) | `filterConfig.filters` |
| `resourcePackages` | `resourcePackages` (convert item type integers to strings) |

**reportVersionAtImport**: Required on both theme entries. Use values from an existing PBIR report or `{"visual": "1.8.95", "report": "2.0.95", "page": "1.3.95"}` as a safe default. Power BI Desktop manages these values automatically.

**Resource package item types**: `202` -> `"BaseTheme"`, `100` -> `"CustomTheme"` (for `.json`) or `"Image"` (for images).

**Settings mappings**: `exportDataMode` integer `1` -> `"AllowSummarized"`, `0` -> `"Disabled"`, `2` -> `"AllowAll"`.

**Filter conversions**: `expression` -> `field`, `howCreated` integer -> string.

#### pages.json

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json",
  "pageOrder": ["sectionName1", "sectionName2"],
  "activePageName": "sectionName1"
}
```

The `pageOrder` entries are the section `name` values. The `activePageName` is determined by `config.activeSectionIndex`.

#### page.json (per page)

| Legacy section | PBIR page.json |
|---|---|
| `section.name` | `name` |
| `section.displayName` | `displayName` |
| `section.displayOption` (int) | `displayOption` (string) |
| `section.height`, `section.width` | `height`, `width` |
| `section_config.objects` | `objects` |
| `section_config.relationships` | `visualInteractions` (convert type 3 -> `"NoFilter"`, omit type 1) |
| `section_filters` | `filterConfig.filters` |

**Visual interactions**: Only store `NoFilter` entries. `Filter` is the default behavior and must be omitted from PBIR (causes schema validation errors if included).

**Page folder naming**: Use the section `name` (e.g. `ReportSection`, `ReportSectionff9bc40a...`) as the folder name, not the `displayName`.

#### visual.json (per visual)

The most complex transformation. Each visual container's stringified `config` contains a `singleVisual` object.

| Legacy singleVisual | PBIR visual.json |
|---|---|
| `config.name` | `name` |
| `config.layouts[0].position` | `position` (add `tabOrder` from `z` if missing) |
| `singleVisual.visualType` | `visual.visualType` |
| `singleVisual.projections` + `prototypeQuery` | `visual.query.queryState` (see below) |
| `singleVisual.objects` | `visual.objects` |
| `singleVisual.vcObjects` | `visual.visualContainerObjects` |
| `singleVisual.drillFilterOtherVisuals` | `visual.drillFilterOtherVisuals` |
| `vc_filters` | `filterConfig.filters` |

**Visual folder naming**: Use `{visualName}-Visual` as the folder name (dash, not dot).

### 4. Convert projections to queryState

The most critical transformation. Legacy format uses `projections` (role -> queryRef list) and `prototypeQuery` (field definitions). PBIR uses `queryState` (role -> projections with inline field definitions).

**Legacy:**
```json
{
  "projections": {
    "Values": [{"queryRef": "Table.Column", "active": true}]
  },
  "prototypeQuery": {
    "Version": 2,
    "From": [{"Name": "t", "Entity": "Table", "Type": 0}],
    "Select": [
      {"Column": {"Expression": {"SourceRef": {"Source": "t"}}, "Property": "Column"}, "Name": "Table.Column"}
    ]
  }
}
```

**PBIR:**
```json
{
  "query": {
    "queryState": {
      "Values": {
        "projections": [
          {
            "field": {
              "Column": {
                "Expression": {"SourceRef": {"Entity": "Table"}},
                "Property": "Column"
              }
            },
            "queryRef": "Table.Column",
            "nativeQueryRef": "Column",
            "active": true
          }
        ]
      }
    }
  }
}
```

**Key steps:**
1. For each projection, look up the `queryRef` in `prototypeQuery.Select` to find the field definition
2. Resolve `SourceRef.Source` aliases to `SourceRef.Entity` using the `prototypeQuery.From` array
3. Add `nativeQueryRef` (the property name portion of queryRef)
4. Map `columnProperties` display names to `displayName` on projections
5. Convert `prototypeQuery.OrderBy` to `sortDefinition`

**Combo chart roles**: `lineStackedColumnComboChart` and `lineClusteredColumnComboChart` use `Y` (column bars) and `Y2` (lines). Do not rename these to `ColumnY`/`LineY`.

### 5. Ensure all filters have names

Every filter in PBIR must have a `name` property. Legacy filters may omit it. Generate a unique hex string if missing.

### 6. Copy static resources

Copy `.platform`, `definition.pbir`, and `StaticResources/` from the legacy export to the PBIR output. The `definition.pbir` file is the same format in both legacy and PBIR.

### 7. Validate

```bash
pbir validate "Report.Report" --allow-download-schemas
```

Address any schema errors. The 4 common issues:
- Missing `reportVersionAtImport` on theme entries
- `"Filter"` type in visualInteractions (remove; only keep `"NoFilter"`)
- Missing filter `name` properties
- Combo chart role name mismatches (false positive from validator)

### 8. Deploy

```bash
fab import "Workspace.Workspace/Report.Report" -i "Report.Report" -f
```

## Post-Conversion

After converting format, the report may still have broken field references if the semantic model has changed since the report was last working. See `references/how-to/fix-broken-field-references.md` for the repair workflow.
