# Report Definition (report.json)

## Schema

`https://developer.microsoft.com/json-schemas/fabric/item/report/definition/report/2.0.0/schema.json`

## Location

**File**: `*.Report/report.json` (in PBIR format)

## Overview

The report.json file defines report-wide settings, configurations, and default behaviors that apply across all pages. It contains:
- Report-level filters
- Default visual interactions
- Report settings and options
- Filter pane visibility
- Layout type
- Resource packages
- Theme references

## Top-Level Properties

### config
Report configuration settings.

**Type**: Object
**Properties**:
- `defaultFilterActionIsDataFilter` - Controls default filter behavior
- `layoutType` - Report layout type (e.g., "Master")

**Example:**
```json
"config": {
  "defaultFilterActionIsDataFilter": true,
  "layoutType": "Master"
}
```

### filterConfig
Report-level filters that apply to all pages.

**Type**: Object
**Contains**: Array of filter definitions

**Example:**
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

**See**: [filter-pane.md](./filter-pane.md) for complete filter documentation

### resourcePackages

Registers themes, images, and other resources used by the report. Files live in `StaticResources/`.

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
      {"name": "MyTheme.json", "path": "MyTheme.json", "type": "CustomTheme"},
      {"name": "logo15640660799959338.png", "path": "logo15640660799959338.png", "type": "Image"}
    ]
  }
]
```

- `SharedResources` -- built-in Microsoft base themes (`StaticResources/SharedResources/BaseThemes/`)
- `RegisteredResources` -- custom themes and images (`StaticResources/RegisteredResources/`)
- Item types: `"BaseTheme"`, `"CustomTheme"`, `"Image"`
- Every image and custom theme file must be registered here to be referenced in pages/visuals
- See [images.md](./images.md) for image usage patterns

### settings
Report-wide settings and options.

**Type**: Object
**Properties**:
- `useStylableVisualContainerHeader` - Enable stylable visual headers
- `exportDataMode` - Export data permissions (1 = summarized, 2 = underlying)
- `queryLimit` - Query result limit
- `useNewFilterPaneExperience` - Enable new filter pane UI
- `allowChangeFilterTypes` - Allow users to change filter types
- `allowChangeOnlyFiltersByUI` - Restrict filter editing to UI
- And many more options

**Example:**
```json
"settings": {
  "useStylableVisualContainerHeader": true,
  "exportDataMode": 1,
  "queryLimit": 3000,
  "useNewFilterPaneExperience": true
}
```

### visualInteractions
Default cross-visual interaction settings.

**Type**: Object
**Contains**: Interaction rules between visuals

**Example:**
```json
"visualInteractions": {
  "version": 2,
  "interactions": []
}
```

### objects
Formatting objects for report-level styling.

**Type**: Object
**Available objects**:
- `outspacePane` - Filter pane visibility and basic settings

**Example:**
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

**CRITICAL:** At report level, ONLY `visible` and `expanded` properties work on outspacePane. Styling properties (backgroundColor, width, etc.) must be in theme JSON, NOT report.json.

### theme
Theme reference for report styling.

**Type**: Object
**Properties**:
- `name` - Theme name
- `themeJson` - Inline theme JSON (optional)

**Example:**
```json
"theme": {
  "name": "CustomTheme",
  "themeJson": {...}
}
```

Or reference external theme:
```json
"theme": {
  "name": "StaticResources/RegisteredResources/CustomTheme.json"
}
```

## Report Settings Object

The `settings` object contains numerous options that control report behavior:

### Data Loading and Performance
- `queryLimit`: Number - Maximum rows to query (default 3000)
- `useDefaultAggregateDisplayUnits`: Boolean - Use default display units
- `allowChangeDataIngestion`: Boolean - Allow data ingestion changes

### Export and Data Access
- `exportDataMode`: Number - Export permissions (1 = summarized only, 2 = summarized + underlying)
- `exportToFileMode`: Number - File export permissions
- `pdfExportWarningSettings`: Object - PDF export warning configuration

### Filter Pane
- `useNewFilterPaneExperience`: Boolean - Enable modern filter pane UI
- `allowChangeFilterTypes`: Boolean - Allow users to change filter types
- `allowChangeOnlyFiltersByUI`: Boolean - Restrict filter edits to UI-created filters
- `filterPaneEnabled`: Boolean - (deprecated - use objects.outspacePane instead)

### Visual Behavior
- `useStylableVisualContainerHeader`: Boolean - Enable enhanced visual headers
- `allowVisualCustomization`: Boolean - Allow users to customize visuals
- `hideVisualContainerHeader`: Boolean - Hide visual headers globally
- `useEnhancedTooltips`: Boolean - Enable enhanced tooltips

### Personalization
- `persistentFilters`: Boolean - Remember filter state
- `persistentVisuals`: Boolean - Remember visual state
- `personalizeVisuals`: Boolean - Allow personal visual customization
- `allowBookmarksView`: Boolean - Enable bookmarks pane

### Cross-Filtering
- `allowCrossFilterOverwrite`: Boolean - Allow overwriting cross-filter settings
- `defaultFilterActionIsDataFilter`: Boolean - Use data filters by default (in config)

### Accessibility
- `maintainTabOrder`: Boolean - Preserve tab order for accessibility
- `keyboardNavigationEnabled`: Boolean - Enable keyboard navigation

### Advanced
- `syncSlicer`: Object - Slicer synchronization settings
- `hidePages`: Boolean - Hide page tabs
- `useExecutionEnvironment`: String - Execution environment mode
- `queryOptions`: Object - Advanced query settings

## Complete Example

**Minimal report.json:**
```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/report/2.0.0/schema.json",
  "config": {
    "version": "5.47",
    "themeCollection": {
      "baseTheme": {
        "name": "CY24SU10"
      }
    }
  }
}
```

**Comprehensive report.json:**
```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/report/2.0.0/schema.json",
  "config": {
    "version": "5.47",
    "defaultFilterActionIsDataFilter": true,
    "layoutType": "Master",
    "themeCollection": {
      "baseTheme": {
        "name": "CY24SU10"
      }
    }
  },
  "filterConfig": {
    "filters": [
      {
        "name": "report-filter-guid",
        "displayName": "Fiscal Year",
        "field": {
          "Column": {
            "Expression": {"SourceRef": {"Entity": "Date"}},
            "Property": "Fiscal Year"
          }
        },
        "type": "Categorical",
        "isHiddenInViewMode": false,
        "isLockedInViewMode": false,
        "filter": {
          "Version": 2,
          "From": [{"Name": "d", "Entity": "Date", "Type": 0}],
          "Where": [{
            "Condition": {
              "In": {
                "Expressions": [{
                  "Column": {
                    "Expression": {"SourceRef": {"Source": "d"}},
                    "Property": "Fiscal Year"
                  }
                }],
                "Values": [[{"Literal": {"Value": "'FY2024'"}}]]
              }
            }
          }]
        }
      }
    ]
  },
  "settings": {
    "useStylableVisualContainerHeader": true,
    "exportDataMode": 1,
    "queryLimit": 10000,
    "useNewFilterPaneExperience": true,
    "allowChangeFilterTypes": false,
    "useEnhancedTooltips": true,
    "persistentFilters": true,
    "keyboardNavigationEnabled": true
  },
  "objects": {
    "outspacePane": [{
      "properties": {
        "visible": {"expr": {"Literal": {"Value": "true"}}},
        "expanded": {"expr": {"Literal": {"Value": "false"}}}
      }
    }]
  },
  "theme": {
    "name": "StaticResources/RegisteredResources/CustomTheme.json"
  },
  "resourcePackages": [],
  "visualInteractions": {
    "version": 2,
    "interactions": []
  }
}
```

## Common Patterns

### Hide Filter Pane
```json
{
  "objects": {
    "outspacePane": [{
      "properties": {
        "visible": {"expr": {"Literal": {"Value": "false"}}}
      }
    }]
  }
}
```

### Restrict Data Export
```json
{
  "settings": {
    "exportDataMode": 1
  }
}
```
**Values:**
- `1` - Summarized data only
- `2` - Summarized + underlying data

### High Query Limit (Large Datasets)
```json
{
  "settings": {
    "queryLimit": 50000
  }
}
```
**Note:** Higher limits may impact performance

### Enable Modern Features
```json
{
  "settings": {
    "useStylableVisualContainerHeader": true,
    "useNewFilterPaneExperience": true,
    "useEnhancedTooltips": true,
    "keyboardNavigationEnabled": true
  }
}
```

### Lock Filters at Report Level
```json
{
  "filterConfig": {
    "filters": [{
      "name": "filter-guid",
      "field": {...},
      "filter": {...},
      "isHiddenInViewMode": true,
      "isLockedInViewMode": true
    }]
  }
}
```

### Apply Custom Theme
```json
{
  "theme": {
    "name": "StaticResources/RegisteredResources/CorporateTheme.json"
  }
}
```

## Report vs Page vs Theme

**Understanding the hierarchy:**

| Setting | Report Level | Page Level | Theme Level |
|---------|-------------|------------|-------------|
| **Filter pane visibility** | ✓ (visible/expanded only) | ✓ (styling) | ✓ (styling) |
| **Filters** | ✓ (apply to all pages) | ✓ (page-specific) | ✗ |
| **Visual interactions** | ✓ (defaults) | ✓ (per-page) | ✗ |
| **Query limits** | ✓ | ✗ | ✗ |
| **Export permissions** | ✓ | ✗ | ✗ |
| **Visual styling** | ✗ | ✗ | ✓ |
| **Page background** | ✗ | ✓ | ✓ (default) |

**Decision tree:**
- **Report-wide behavior** → report.json settings
- **Report-wide filters** → report.json filterConfig
- **All pages styling** → theme JSON
- **Single page config** → page.json
- **Filter pane visibility** → report.json objects.outspacePane
- **Filter pane styling** → theme JSON

## Key Learnings

1. **outspacePane restrictions**: At report level, ONLY `visible` and `expanded` work. Styling properties cause deployment errors.

2. **Filter hierarchy**: Report filters → Page filters → Visual filters (most to least precedence)

3. **Settings vs objects**: `settings` contains functional options, `objects` contains formatting

4. **Theme reference**: Theme can be inline (`themeJson`) or external file reference (`name`)

5. **Export permissions**: `exportDataMode: 1` = summarized only (restrictive), `2` = underlying data (permissive)

6. **Query limits**: Higher `queryLimit` values may impact performance but allow more data

7. **Deprecated properties**: Some old properties like `filterPaneEnabled` deprecated in favor of objects

8. **Settings inheritance**: Report settings apply to all pages unless overridden

9. **Resource packages**: Required for embedded images and custom visuals

10. **Version tracking**: `config.version` tracks Power BI version for compatibility

## Settings Best Practices

**Security and governance:**
```json
{
  "settings": {
    "exportDataMode": 1,
    "allowChangeFilterTypes": false,
    "allowChangeOnlyFiltersByUI": true
  }
}
```

**Performance optimization:**
```json
{
  "settings": {
    "queryLimit": 3000,
    "useDefaultAggregateDisplayUnits": true
  }
}
```

**Modern experience:**
```json
{
  "settings": {
    "useStylableVisualContainerHeader": true,
    "useNewFilterPaneExperience": true,
    "useEnhancedTooltips": true,
    "keyboardNavigationEnabled": true
  }
}
```

**User customization:**
```json
{
  "settings": {
    "persistentFilters": true,
    "personalizeVisuals": true,
    "allowBookmarksView": true,
    "allowVisualCustomization": true
  }
}
```

## Troubleshooting

**Issue:** Deployment fails with "Property 'backgroundColor' has not been defined"
**Cause:** Styling properties used in report.json outspacePane
**Solution:** Move styling to theme JSON, keep only visible/expanded in report.json

**Issue:** Report filters not applying
**Cause:** Page or visual filters overriding
**Solution:** Check filter hierarchy, use isLockedInViewMode: true

**Issue:** Export options not available
**Cause:** exportDataMode set to 1
**Solution:** Change to 2 for underlying data export (if policy allows)

**Issue:** Query timeout errors
**Cause:** queryLimit too high or query too complex
**Solution:** Reduce queryLimit or optimize DAX queries

**Issue:** Theme not applying
**Cause:** Incorrect theme path or missing theme file
**Solution:** Verify theme path matches file location

## Related Documentation

- [filter-pane.md](./filter-pane.md) - Filter pane and filter configuration
- [page.md](./page.md) - Page-level properties
- [theme.md](./theme.md) - Theme structure and styling
- [report-extensions.md](./report-extensions.md) - Extension measures

## Usage Notes

- report.json affects all pages in the report
- Settings are functional (behavior), objects are formatting (appearance)
- Theme reference can be external file or inline JSON
- Filter pane visibility controlled at report level
- Export and query settings controlled here
- Resource packages required for embedded images
- Visual interaction defaults set here
- Some settings deprecated (use modern equivalents)
- Report-level filters apply to entire report
- Check deployment-status.md after changes
- Validate JSON structure before deployment
