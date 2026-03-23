# report.json

Report-level configuration: theme, filters, settings, and resource packages.

**Location:** `Report.Report/definition/report.json`

**Schema:** `report/3.0.0` (current) or `report/2.1.0` (older reports)

## Top-Level Properties

Real report.json files have these top-level keys (no `config` wrapper):

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/report/3.0.0/schema.json",
  "themeCollection": {},
  "filterConfig": {},
  "objects": {},
  "settings": {},
  "resourcePackages": [],
  "annotations": []
}
```

### themeCollection

Defines which theme files the report uses. References files in `StaticResources/`.

```json
"themeCollection": {
  "baseTheme": {
    "name": "CY24SU10",
    "reportVersionAtImport": {"visual": "2.1.0", "report": "3.0.0", "page": "2.0.0"},
    "type": "SharedResources"
  },
  "customTheme": {
    "name": "SqlbiDataGoblinTheme.json",
    "reportVersionAtImport": {"visual": "2.1.0", "report": "3.0.0", "page": "2.0.0"},
    "type": "RegisteredResources"
  }
}
```

- `SharedResources` -- Microsoft base themes in `StaticResources/SharedResources/BaseThemes/`
- `RegisteredResources` -- custom themes in `StaticResources/RegisteredResources/`
- `customTheme` is optional; omit if using only the base theme
- `reportVersionAtImport` can be a string (`"5.59"`) in older schema 2.x reports

### resourcePackages

Registers themes, images, and other static resources. Every custom theme and image file in `StaticResources/RegisteredResources/` must be listed here.

```json
"resourcePackages": [
  {
    "name": "SharedResources",
    "type": "SharedResources",
    "items": [
      {"name": "CY24SU10", "path": "BaseThemes/CY24SU10.json", "type": "BaseTheme"}
    ]
  },
  {
    "name": "RegisteredResources",
    "type": "RegisteredResources",
    "items": [
      {"name": "SqlbiDataGoblinTheme.json", "path": "SqlbiDataGoblinTheme.json", "type": "CustomTheme"},
      {"name": "logo15640660799959338.png", "path": "logo15640660799959338.png", "type": "Image"}
    ]
  }
]
```

Item types: `"BaseTheme"`, `"CustomTheme"`, `"Image"`. See [images.md](./images.md) for image usage.

### settings

Report-wide behavioral settings. Values are bare (not wrapped in expr).

```json
"settings": {
  "useStylableVisualContainerHeader": true,
  "useEnhancedTooltips": true,
  "defaultDrillFilterOtherVisuals": true,
  "exportDataMode": "AllowSummarized",
  "allowChangeFilterTypes": true,
  "useDefaultAggregateDisplayName": true
}
```

Key settings:

| Setting | Type | Description |
|---------|------|-------------|
| `useStylableVisualContainerHeader` | boolean | Enable enhanced visual headers |
| `useEnhancedTooltips` | boolean | Enable enhanced tooltips |
| `defaultDrillFilterOtherVisuals` | boolean | Drill actions cross-filter other visuals |
| `exportDataMode` | string | `"AllowSummarized"` or `"AllowSummarizedAndUnderlying"` |
| `allowChangeFilterTypes` | boolean | Allow users to change filter types |
| `useDefaultAggregateDisplayName` | boolean | Show default aggregate display names |
| `persistentFilters` | boolean | Remember user filter state across sessions |
| `keyboardNavigationEnabled` | boolean | Enable keyboard navigation |

### objects

Report-level formatting. Currently only `outspacePane` (filter pane visibility).

```json
"objects": {
  "outspacePane": [{
    "properties": {
      "visible": {"expr": {"Literal": {"Value": "false"}}},
      "expanded": {"expr": {"Literal": {"Value": "true"}}}
    }
  }]
}
```

**CRITICAL:** At report level, ONLY `visible` and `expanded` work on outspacePane. Styling properties (backgroundColor, width, etc.) must be in the theme JSON. Putting them here causes deployment errors.

### filterConfig

Report-level filters that apply to all pages. See [filter-pane.md](./filter-pane.md) for complete filter documentation including all filter types and default value patterns.

```json
"filterConfig": {
  "filters": [
    {
      "name": "d3f20cea05c37b47123a",
      "field": {
        "Column": {
          "Expression": {"SourceRef": {"Entity": "Date"}},
          "Property": "Calendar Year (ie 2021)"
        }
      },
      "type": "Categorical",
      "isHiddenInViewMode": false,
      "isLockedInViewMode": false
    }
  ]
}
```

### annotations

Report-level metadata annotations (name-value pairs):

```json
"annotations": [
  {"name": "PBI_ProTooling", "value": "[\"DevMode\"]"}
]
```

## Common Patterns

### Hide filter pane

```json
"objects": {
  "outspacePane": [{
    "properties": {
      "visible": {"expr": {"Literal": {"Value": "false"}}}
    }
  }]
}
```

### Restrict data export

```json
"settings": {
  "exportDataMode": "AllowSummarized"
}
```

### Enable modern features

```json
"settings": {
  "useStylableVisualContainerHeader": true,
  "useEnhancedTooltips": true,
  "keyboardNavigationEnabled": true
}
```

## Report vs Page vs Theme

| Setting | report.json | page.json | Theme JSON |
|---------|------------|-----------|------------|
| Filter pane visibility | `objects.outspacePane` (visible/expanded only) | -- | -- |
| Filter pane styling | -- | -- | `visualStyles.page."*".outspacePane` |
| Filters | `filterConfig` (all pages) | `filterConfig` (one page) | -- |
| Visual styling | -- | -- | `visualStyles` |
| Page background | -- | `objects.background` | `visualStyles.page."*".background` |
| Query limits / export | `settings` | -- | -- |

## Related

- [filter-pane.md](./filter-pane.md) - Filter configuration and default values
- [theme.md](./theme.md) - Theme structure and styling
- [images.md](./images.md) - Image registration in resourcePackages
- [report-extensions.md](./report-extensions.md) - Extension measures
