# report.json

Report-level settings, theme configuration, filters, and resource packages.

## Location

`Report.Report/definition/report.json`

## Structure

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/report/3.2.0/schema.json",
  "themeCollection": {
    "baseTheme": {
      "name": "CY25SU11",
      "reportVersionAtImport": {"visual": "2.4.0", "report": "3.0.0", "page": "2.3.0"},
      "type": "SharedResources"
    },
    "customTheme": {
      "name": "MyTheme.json",
      "type": "RegisteredResources"
    }
  },
  "settings": {
    "useStylableVisualContainerHeader": true,
    "useEnhancedTooltips": true,
    "defaultDrillFilterOtherVisuals": true,
    "exportDataMode": "AllowSummarized",
    "allowChangeFilterTypes": true,
    "useDefaultAggregateDisplayName": true
  },
  "filterConfig": {},
  "objects": {},
  "resourcePackages": []
}
```

**Note:** Older reports (schema 2.x) use `"reportVersionAtImport": "5.59"` (string) instead of the object form. Both are valid for their respective schema versions.

## Key Properties

### themeCollection

```json
"themeCollection": {
  "baseTheme": {
    "name": "CY25SU11",
    "reportVersionAtImport": {"visual": "2.4.0", "report": "3.0.0", "page": "2.3.0"},
    "type": "SharedResources"
  },
  "customTheme": {
    "name": "MyTheme.json",
    "type": "RegisteredResources"
  }
}
```

- `SharedResources` -- built-in Microsoft base themes in `StaticResources/SharedResources/BaseThemes/`
- `RegisteredResources` -- custom themes/images in `StaticResources/RegisteredResources/`
- `customTheme` is optional; omit if using only the base theme

### objects.outspacePane

Filter pane visibility (report level supports ONLY visibility/expansion, not styling):

```json
"objects": {
  "outspacePane": [{
    "properties": {
      "visible": {"expr": {"Literal": {"Value": "false"}}},
      "expanded": {"expr": {"Literal": {"Value": "true"}}}
    }
  }],
  "section": [{
    "properties": {
      "verticalAlignment": {"expr": {"Literal": {"Value": "'Top'"}}}
    }
  }]
}
```

**Critical:** Putting styling properties (backgroundColor, etc.) in `outspacePane` at report level causes deployment errors. All filter pane styling must be in the theme JSON.

### filterConfig

Report-level filters (apply to all pages):

```json
"filterConfig": {
  "filters": [
    {
      "name": "702059a007b877667ab7",
      "field": {
        "Column": {
          "Expression": {"SourceRef": {"Entity": "Date"}},
          "Property": "Calendar Year (ie 2021)"
        }
      },
      "type": "Categorical",
      "howCreated": "User",
      "filter": {
        "Version": 2,
        "From": [{"Name": "d", "Entity": "Date", "Type": 0}],
        "Where": [{
          "Condition": {
            "In": {
              "Expressions": [{"Column": {"Expression": {"SourceRef": {"Source": "d"}}, "Property": "Calendar Year (ie 2021)"}}],
              "Values": [[{"Literal": {"Value": "'2022'"}}]]
            }
          }
        }]
      },
      "objects": {
        "general": [{
          "properties": {
            "requireSingleSelect": {"expr": {"Literal": {"Value": "true"}}}
          }
        }]
      }
    }
  ]
}
```

**Filter SourceRef gotcha:** In filter `Where` conditions, SourceRef uses `"Source": "d"` (referencing the alias from `From`), NOT `"Entity"`.

### resourcePackages

```json
"resourcePackages": [
  {
    "name": "SharedResources",
    "type": "SharedResources",
    "items": [{"name": "CY25SU11", "path": "BaseThemes/CY25SU11.json", "type": "BaseTheme"}]
  },
  {
    "name": "RegisteredResources",
    "type": "RegisteredResources",
    "items": [{"name": "MyTheme.json", "path": "MyTheme.json", "type": "CustomTheme"}]
  }
]
```

Older reports may omit `SharedResources` from `resourcePackages`.
