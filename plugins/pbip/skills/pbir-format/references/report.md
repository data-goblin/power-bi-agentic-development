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

### Custom Visual Registration

A `visualType` set to a custom visual's GUID is inert on its own. Rendering requires a matching registration elsewhere AND the visual being installed/approved in the consuming environment.

Three registration paths in `report.json` (schema `report/3.2.0`):

```yaml
publicCustomVisuals:
  - array of GUID strings (AppSource visuals; code is NOT in the report; resolved at open time)
organizationCustomVisuals:
  - array of {name, path, disabled?} (org-store-approved references; admin-managed)
resourcePackages:
  - CustomVisualJavascript/Css/Screenshot items (private .pbiviz only; JS/CSS ship inside the report)
CustomVisuals/ folder:
  - metadata for private .pbiviz only; absent for AppSource/org-store visuals
```

**AppSource visual (hand-adding):** Set `visualType` to the GUID and append the same GUID to `publicCustomVisuals`. Without the `publicCustomVisuals` entry, the visual renders blank with no validation error.

**Private `.pbiviz`:** Self-contained; JS/CSS ship via `resourcePackages` + `CustomVisuals/`. You cannot synthesize a private visual by hand-writing `resourcePackages`. Import once in Desktop, let it serialize the payload, then copy and edit.

Pitfalls:
- `visualType` GUID present but missing from `publicCustomVisuals` is the most common silent failure when copying a custom visual between reports
- Copying a private-`.pbiviz` visual requires copying its `resourcePackages`/`CustomVisuals` payload too
- `disabled: true` on an `organizationCustomVisuals` entry means the admin pulled the visual from the org store
- AppSource/org-store visuals are unavailable in Power BI Report Server; private `.pbiviz` must be used there instead

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

Report-level formatting. Two valid properties: `outspacePane` (filter pane visibility) and `section` (canvas vertical alignment).

```json
"objects": {
  "section": [{
    "properties": {
      "verticalAlignment": {"expr": {"Literal": {"Value": "'Middle'"}}}
    }
  }],
  "outspacePane": [{
    "properties": {
      "visible": {"expr": {"Literal": {"Value": "false"}}},
      "expanded": {"expr": {"Literal": {"Value": "true"}}}
    }
  }]
}
```

`section.verticalAlignment` values: `'Top'`, `'Middle'`, `'Bottom'`. Sets the default canvas alignment for all pages.

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
  ],
  "filterSortOrder": "Custom"
}
```

`filterSortOrder`: controls filter pane sort order. `"Custom"` preserves the `ordinal` field ordering; omit to use the default sort.

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
