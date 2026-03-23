# report.json

Report-level settings, theme configuration, and report filters.

## Location

`Report.Report/definition/report.json`

## Structure

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/report/2.0.0/schema.json",
  "config": {
    "version": "5.47",
    "themeCollection": {
      "baseTheme": {"name": "CY24SU10"},
      "customTheme": {"name": "CustomTheme.json", "type": "RegisteredResources"}
    }
  },
  "settings": {...},
  "filterConfig": {...},
  "objects": {...}
}
```

## Key Properties

### config.themeCollection

```json
"themeCollection": {
  "baseTheme": {"name": "CY24SU10"},
  "customTheme": {
    "name": "MyTheme.json",
    "type": "RegisteredResources"
  }
}
```

Custom theme file: `StaticResources/RegisteredResources/MyTheme.json`

### settings

```json
"settings": {
  "useStylableVisualContainerHeader": true,
  "exportDataMode": 1,              // 1=summarized, 2=underlying
  "queryLimit": 3000,
  "useNewFilterPaneExperience": true,
  "persistentFilters": true
}
```

### filterConfig

Report-level filters (apply to all pages):

```json
"filterConfig": {
  "filters": [
    {
      "name": "filter-guid",
      "field": {
        "Column": {
          "Expression": {"SourceRef": {"Entity": "Date"}},
          "Property": "Year"
        }
      },
      "filter": {...},
      "isHiddenInViewMode": true,
      "isLockedInViewMode": true
    }
  ]
}
```

### objects.outspacePane

Filter pane visibility:

```json
"objects": {
  "outspacePane": [{
    "properties": {
      "visible": {"expr": {"Literal": {"Value": "true"}}},
      "expanded": {"expr": {"Literal": {"Value": "false"}}}
    }
  }]
}
```

**Note:** Only `visible` and `expanded` work at report level. Styling (backgroundColor, etc.) must be in theme JSON.

## Common Patterns

```json
// Hide filter pane
"objects": {"outspacePane": [{"properties": {"visible": {"expr": {"Literal": {"Value": "false"}}}}}]}

// Restrict data export
"settings": {"exportDataMode": 1}

// Increase query limit
"settings": {"queryLimit": 50000}
```

## Search

```bash
# Find theme reference
grep -A3 '"themeCollection"' Report.Report/definition/report.json

# Find report filters
grep -A10 '"filterConfig"' Report.Report/definition/report.json
```
