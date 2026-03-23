# Filter Pane

## General guidance

- The filter pane is the preferred place to place filters for Power BI visuals.
- Slicers should only be used when a filter is so important that the user must see it on the page, or when the user experience mandates a slicer (such as buttons or certain designs with conditional formatting or specific shapes). 
- The filter pane is generally preferred because it's a more effective use of space, and it provides a clear UX for users to select and use the filters.
- If the user is not using the filter pane, it's a good idea to hide it by setting `"visible": { "expr": { "Literal": { "Value": "false" } } }` in the report.json.
- The filter pane can be styled and formatted, but it's generally not worth doing. If you will style the formatting pane, you should modify the theme JSON.

## Filter scope

You can scope filters to three levels:

- Report-level: `report.json` → `filterConfig` → `filters` array
- Page-level: Applies to all visuals on a page - `page.json` → `filters` array
- Visual-level: `visual.json` → `filters` array

Each filter in these arrays can be hidden, locked, or configured for single-select behavior.


### Hide and Lock Filters

**Properties:**
- `isHiddenInViewMode` (boolean) - Hides filter from filter pane in view mode. This should only be done with report- or page-level filters that must be hidden from users for an explicit reason. **NEVER** hide a visual-level filter because this can lead to confusion in users as visuals don't work as they expect.
- `isLockedInViewMode` (boolean) - Locks filter so viewers cannot modify it. This should only be done with explicit reasoning as it leads to frustration among users.

**Example - Hidden and locked report filter:**
```json
{
  "filters": [
    {
      "name": "d3f20cea05c37b47123a",
      "displayName": "Currency",
      "field": {
        "Column": {
          "Expression": {"SourceRef": {"Entity": "Exchange Rate"}},
          "Property": "From Currency"
        }
      },
      "type": "Categorical",
      "isHiddenInViewMode": true,
      "isLockedInViewMode": true,
      "filter": {
        "Version": 2,
        "From": [{"Name": "e", "Entity": "Exchange Rate", "Type": 0}],
        "Where": [{
          "Condition": {
            "In": {
              "Expressions": [{
                "Column": {
                  "Expression": {"SourceRef": {"Source": "e"}},
                  "Property": "From Currency"
                }
              }],
              "Values": [[{"Literal": {"Value": "'EUR'"}}]]
            }
          }
        }]
      },
      "howCreated": "User"
    }
  ]
}
```

### Single-Select and Other Filter Configuration

Single select is often good when there is only one valid option. A common example is selection of year, currency, rate type, or measure (in measure selection) and aggregation (when using measure selection or calculation groups).

**Location:** Same filter objects, in `objects` → `general` array

**Properties:**
- `requireSingleSelect` (boolean) - Force single selection only
- `isInvertedSelectionMode` (boolean) - Invert selection (exclude instead of include)

**Example - Single-select required:**
```json
{
  "name": "9a135e8e175961ab0070",
  "field": {
    "Column": {
      "Expression": {"SourceRef": {"Entity": "Date"}},
      "Property": "Calendar Year (ie 2021)"
    }
  },
  "type": "Categorical",
  "filter": {...},
  "objects": {
    "general": [{
      "properties": {
        "requireSingleSelect": {
          "expr": {"Literal": {"Value": "true"}}
        }
      }
    }]
  }
}
```

**Example - Inverted selection (exclude mode):**

This is rarely needed. 

```json
{
  "name": "61fce691ed537b989b43",
  "field": {
    "Column": {
      "Expression": {"SourceRef": {"Entity": "Brands"}},
      "Property": "Brand"
    }
  },
  "type": "Categorical",
  "filter": {
    "Version": 2,
    "From": [{"Name": "b", "Entity": "Brands", "Type": 0}],
    "Where": [{
      "Condition": {
        "Not": {
          "Expression": {
            "In": {
              "Expressions": [{
                "Column": {
                  "Expression": {"SourceRef": {"Source": "b"}},
                  "Property": "Brand"
                }
              }],
              "Values": [
                [{"Literal": {"Value": "'ASAN'"}}],
                [{"Literal": {"Value": "'Galileo'"}}]
              ]
            }
          }
        }
      }
    }]
  },
  "objects": {
    "general": [{
      "properties": {
        "isInvertedSelectionMode": {
          "expr": {"Literal": {"Value": "true"}}
        }
      }
    }]
  }
}
```

**Pattern:** When `isInvertedSelectionMode: true`, the filter uses `Not` wrapper around the `In` condition.

### Common Combinations

| Use Case | isHiddenInViewMode | isLockedInViewMode | requireSingleSelect |
|----------|-------------------|-------------------|---------------------|
| Hidden background filter | true | true | - |
| Locked parameter (visible) | false | true | true |
| Normal multi-select | false | false | false |
| Visible single-select | false | false | true |

## Report Level - Filter Pane Visibility

**Location:** `report.json` → `objects` → `outspacePane`

**CRITICAL:** At the report level, ONLY `visible` and `expanded` are allowed. Styling properties (backgroundColor, width, border, etc.) will cause deployment errors.

Controls whether the filter pane is shown and expanded:

```json
{
  "objects": {
    "outspacePane": [
      {
        "properties": {
          "visible": {
            "expr": {
              "Literal": {
                "Value": "true"
              }
            }
          },
          "expanded": {
            "expr": {
              "Literal": {
                "Value": "true"
              }
            }
          }
        }
      }
    ]
  }
}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `visible` | boolean | Show/hide the filter pane entirely |
| `expanded` | boolean | Whether the pane is expanded or collapsed |

**Common Use Cases:**

Hide filter pane:
```json
"visible": { "expr": { "Literal": { "Value": "false" } } }
```

Show but collapsed:
```json
"visible": { "expr": { "Literal": { "Value": "true" } } },
"expanded": { "expr": { "Literal": { "Value": "false" } } }
```

## Filter Pane Styling

**All filter pane styling (colors, fonts, width, borders) must be done in the theme, not in report.json or page.json.** Putting styling properties at report level causes deployment errors.

See [theme.md](./theme.md) -- "Filter Pane and Filter Card Formatting in Themes" section for:
- `outspacePane` properties (backgroundColor, foregroundColor, fontFamily, titleSize, headerSize, width, etc.)
- `filterCard` properties with `$id` selectors (`"Available"`, `"Applied"`)
- Complete themed filter pane examples

## Related Documentation

- [page.md](./page.md) - Page-level objects including outspacePane
- [theme.md](./theme.md) - Filter pane and filter card styling in themes
- [expressions.md](./schema-patterns/expressions.md) - Expression format for properties
