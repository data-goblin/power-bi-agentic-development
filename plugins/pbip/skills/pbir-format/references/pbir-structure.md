# PBIR Structure Reference

Power BI reports in PBIR format use a directory structure for version control and programmatic manipulation.

## Directory Layout

```
Report.Report/
├── .pbi/
│   └── localSettings.json          # Local editor settings
├── definition/
│   ├── report.json                 # Report-level metadata
│   ├── definition.pbir             # Dataset connection
│   ├── reportExtensions.json       # Extension/thin measures (optional)
│   └── pages/
│       └── {page-guid}/
│           ├── page.json           # Page layout, size, background
│           └── visuals/
│               └── {visual-name-or-guid}/
│                   └── visual.json  # Visual definition
├── StaticResources/               # Themes, images, custom visuals
│   ├── SharedResources/
│   │   └── BaseThemes/
│   │       └── CY24SU10.json      # Base theme
│   └── RegisteredResources/
│       └── CustomTheme*.json      # Custom themes
└── Report.pbip                     # Container metadata (parent level)
```

## Key Files

### Report.pbip (Container)
Container metadata at parent level:
```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/pbip/pbipProperties/1.0.0/schema.json",
  "version": "1.0",
  "artifacts": [
    {"report": {"path": "Report.Report"}}
  ],
  "settings": {"enableAutoRecovery": true}
}
```

### definition.pbir
Dataset connection info:
```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json",
  "version": "4.0",
  "datasetReference": {
    "byConnection": {
      "connectionString": "Data Source=powerbi://api.powerbi.com/v1.0/myorg/workspace;initial catalog=model;..."
    }
  }
}
```

### report.json
Report-level properties:
```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/report/1.2.0/schema.json",
  "config": {
    "version": "5.43",
    "themeCollection": {"baseTheme": {"name": "CY24SU10"}},
    "activeSectionIndex": 0
  },
  "reportId": "{guid}"
}
```

### page.json
Page layout and settings:
```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/1.2.0/schema.json",
  "name": "{page-guid}",
  "displayName": "Page Name",
  "width": 1920,
  "height": 1080,
  "config": {
    "layouts": [
      {
        "id": 0,
        "displayOption": {"scalingType": "Fit"},
        "width": 1920,
        "height": 1080
      }
    ]
  }
}
```

### visual.json
Visual definition with query and formatting:
```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.2.0/schema.json",
  "name": "visual_name",
  "position": {"x": 0, "y": 0, "z": 0, "width": 500, "height": 300},
  "visual": {
    "visualType": "lineChart",
    "query": {...},
    "objects": {...}
  }
}
```

### reportExtensions.json
Extension/thin measures defined at report level:
```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/reportExtensions/1.2.0/schema.json",
  "name": "extension",
  "entities": [
    {
      "name": "_Formatting Measures",
      "measures": [
        {
          "name": "ColorMeasure",
          "dataType": "Text",
          "expression": "IF([Value] < 0, \"#D64550\", \"#118DFF\")"
        }
      ]
    }
  ]
}
```

**Note:** This file is **optional**. If you have no extension measures, delete the file entirely. An empty file with `"entities": []` will cause Power BI Desktop to fail during deserialization. See `extension-measures.md` for details.

## Exporting Reports

### Using dg (Data Goblins CLI)
```bash
# Export report to PBIP format
dg report export "workspace" "reportname" ./output

# Exports to ./output/reportname/reportname.Report/
```

### Using Fabric CLI (fab)
```bash
# Get definition as JSON
fab get "Workspace.Workspace/Report.Report" -q "definition"

# Use fabric-report-mcp tools for full export
```

### Using fabric-report-mcp
Python MCP server with export tools - see `/Users/klonk/Desktop/Git/fabric-report-mcp/`.

## Importing/Updating Reports

### Direct File Manipulation
1. Export report with `dg report export`
2. Edit files (visual.json, page.json, etc.)
3. Validate JSON: `jq empty file.json`
4. Import with `fab import "Workspace.Workspace/Report.Report" -i ./Report.Report -f`

### Programmatic Updates
Use Fabric REST API:
```bash
# Update report definition
fab api -X post "workspaces/{ws-id}/reports/{report-id}/updateDefinition" -i definition.json
```

## Renaming Folders for Better Readability

By default, PBIR uses 20-character GUID identifiers for page and visual folder names. These can be renamed to human-readable names for easier navigation.

### Before Renaming

```yaml
Report.Report/
├── definition/
│   ├── pages/
│   │   ├── 0c32c81bce347402001e/              # Page folder with GUID
│   │   │   ├── visuals/
│   │   │   │   ├── 813f79373a8c773c4d24/      # Visual folder with GUID
│   │   │   │   │   └── visual.json            # visualType: "advancedSlicerVisual"
│   │   │   │   ├── a2b5c8d1e4f7g9h2j5k8/      # Visual folder with GUID
│   │   │   │   │   └── visual.json            # visualType: "lineChart"
│   │   │   │   └── d7e9f2a5b8c1d4e7f0a3/      # Visual folder with GUID
│   │   │   │       └── visual.json            # visualType: "kpi"
│   │   │   └── page.json                      # displayName: "Alternatives"
│   │   └── pages.json
│   └── report.json
```

### After Renaming

```yaml
Report.Report/
├── definition/
│   ├── pages/
│   │   ├── Alternatives/                      # RENAMED: Uses displayName from page.json
│   │   │   ├── visuals/
│   │   │   │   ├── advancedSlicerVisual_Month/  # RENAMED: visualType + field
│   │   │   │   │   └── visual.json              # name property unchanged
│   │   │   │   ├── lineChart_Sales/             # RENAMED: visualType + field
│   │   │   │   │   └── visual.json              # name property unchanged
│   │   │   │   └── kpi_Revenue/                 # RENAMED: visualType + field
│   │   │   │       └── visual.json              # name property unchanged
│   │   │   └── page.json                        # name property unchanged
│   │   └── pages.json
│   └── report.json
```

**Important:**
- Folder names can be changed
- JSON filenames (`visual.json`, `page.json`) must remain unchanged
- The `name` property inside JSON files must remain unchanged (still contains GUID)
- Power BI Desktop preserves renamed folders when saving

## Best Practices

1. **Version Control**
   - Commit PBIR directories to Git
   - Use meaningful visual names (not GUIDs)
   - Document extension measures

2. **File Naming**
   - Use descriptive visual names: `sales_line_chart` not `a1b2c3d4`
   - Group related visuals with prefixes

3. **Validation**
   - Always validate JSON: `jq empty visual.json`
   - Check schema URLs are accessible
   - Test in Power BI Desktop after programmatic changes

4. **Extension Measures**
   - Keep formatting logic in extension measures
   - Prefix measure table names with `_`
   - Document measure purpose in comments

5. **Themes**
   - Store themes in SharedResources for reuse
   - Use RegisteredResources for report-specific themes
   - Reference theme name in report.json

## Common Patterns

### Find All Visuals of Type
```bash
find ./Report.Report/definition/pages -name "visual.json" -exec grep -l '"visualType": "lineChart"' {} \;
```

### Extract Visual Names
```bash
find ./Report.Report/definition/pages -name "visual.json" -exec jq -r '.name' {} \;
```

### List All Measures Used
```bash
find ./Report.Report/definition/pages -name "visual.json" -exec jq -r '.. | .Measure? | select(.) | "\(.Expression.SourceRef.Entity).\(.Property)"' {} \; | sort -u
```

### Update Property Across All Visuals
```bash
for visual in $(find ./Report.Report/definition/pages -name "visual.json"); do
  jq '.visual.objects.title[0].properties.fontSize.expr.Literal.Value = "14D"' $visual > tmp && mv tmp $visual
done
```

## Troubleshooting

**Report won't open after edits:**
- Validate all JSON files
- Check schema versions match
- Verify GUIDs are consistent
- Test with minimal changes first

**Conditional formatting not applying:**
- Check measure exists in model or reportExtensions.json
- Verify selector type (dataViewWildcard vs metadata)
- Ensure measure returns correct data type (hex string for colors)

**Visual position wrong:**
- Check x, y, width, height in visual.json
- Verify z-order (layering)
- Check page dimensions in page.json
