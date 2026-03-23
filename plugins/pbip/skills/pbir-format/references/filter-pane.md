# Filter Pane Formatting

The filter pane (outspacePane) can be controlled and formatted at both the report level and page/theme level. Individual filter cards within the pane can also be styled.

## Individual Filter Control

**Location:**
- Report filters: `report.json` → `filterConfig` → `filters` array
- Page filters: `page.json` → `filters` array
- Visual filters: `visual.json` → `filters` array

Each filter in these arrays can be hidden, locked, or configured for single-select behavior.

### Hide and Lock Filters

**Properties:**
- `isHiddenInViewMode` (boolean) - Hides filter from filter pane in view mode
- `isLockedInViewMode` (boolean) - Locks filter so viewers cannot modify it

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

## Page/Theme Level - Filter Pane Formatting

**Location:** Theme JSON or `page.json` → `objects` → `outspacePane`

Format the appearance of the filter pane:

```json
{
  "outspacePane": [
    {
      "properties": {
        "backgroundColor": {
          "solid": {
            "color": {
              "expr": {
                "Literal": {
                  "Value": "'#F5F5F5'"
                }
              }
            }
          }
        },
        "transparency": {
          "expr": {
            "Literal": {
              "Value": "0D"
            }
          }
        },
        "border": {
          "expr": {
            "Literal": {
              "Value": "true"
            }
          }
        },
        "borderColor": {
          "solid": {
            "color": {
              "expr": {
                "Literal": {
                  "Value": "'#E0E0E0'"
                }
              }
            }
          }
        },
        "fontFamily": {
          "expr": {
            "Literal": {
              "Value": "'Segoe UI'"
            }
          }
        },
        "foregroundColor": {
          "solid": {
            "color": {
              "expr": {
                "Literal": {
                  "Value": "'#333333'"
                }
              }
            }
          }
        },
        "headerSize": {
          "expr": {
            "Literal": {
              "Value": "12D"
            }
          }
        },
        "titleSize": {
          "expr": {
            "Literal": {
              "Value": "14D"
            }
          }
        },
        "searchTextSize": {
          "expr": {
            "Literal": {
              "Value": "10D"
            }
          }
        },
        "inputBoxColor": {
          "solid": {
            "color": {
              "expr": {
                "Literal": {
                  "Value": "'#FFFFFF'"
                }
              }
            }
          }
        },
        "checkboxAndApplyColor": {
          "solid": {
            "color": {
              "expr": {
                "Literal": {
                  "Value": "'#0078D4'"
                }
              }
            }
          }
        },
        "width": {
          "expr": {
            "Literal": {
              "Value": "280D"
            }
          }
        }
      }
    }
  ]
}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `backgroundColor` | color | Background color of the filter pane |
| `transparency` | number | Background transparency (0-100) |
| `border` | boolean | Show vertical line separating pane from report |
| `borderColor` | color | Color of the border line |
| `fontFamily` | string | Font family for title and headers |
| `foregroundColor` | color | Color for text, buttons, and icons |
| `headerSize` | integer | Font size for headers (use D suffix) |
| `titleSize` | integer | Font size for title (use D suffix) |
| `searchTextSize` | integer | Font size for search box (use D suffix) |
| `inputBoxColor` | color | Background color for input fields |
| `checkboxAndApplyColor` | color | Color for Apply button and checkboxes |
| `width` | integer | Width of the filter pane in pixels (use D suffix) |

## Filter Cards - Individual Filter Formatting

**Location:** Theme JSON or `page.json` → `objects` → `filterCard`

Format individual filter cards within the filter pane. Can target specific filter types or all filters:

```json
{
  "filterCard": [
    {
      "$id": "Applied",
      "properties": {
        "backgroundColor": {
          "solid": {
            "color": {
              "expr": {
                "Literal": {
                  "Value": "'#FFFFFF'"
                }
              }
            }
          }
        },
        "transparency": {
          "expr": {
            "Literal": {
              "Value": "0D"
            }
          }
        },
        "border": {
          "expr": {
            "Literal": {
              "Value": "true"
            }
          }
        },
        "borderColor": {
          "solid": {
            "color": {
              "expr": {
                "Literal": {
                  "Value": "'#CCCCCC'"
                }
              }
            }
          }
        },
        "fontFamily": {
          "expr": {
            "Literal": {
              "Value": "'Segoe UI'"
            }
          }
        },
        "foregroundColor": {
          "solid": {
            "color": {
              "expr": {
                "Literal": {
                  "Value": "'#333333'"
                }
              }
            }
          }
        },
        "textSize": {
          "expr": {
            "Literal": {
              "Value": "10D"
            }
          }
        },
        "inputBoxColor": {
          "solid": {
            "color": {
              "expr": {
                "Literal": {
                  "Value": "'#F9F9F9'"
                }
              }
            }
          }
        }
      }
    }
  ]
}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `$id` | string | Filter type: `"Available"`, `"Applied"`, or specific filter ID |
| `backgroundColor` | color | Background color of the filter card |
| `transparency` | integer | Background transparency (0-100) |
| `border` | boolean | Show border around filter card |
| `borderColor` | color | Border color |
| `fontFamily` | string | Font family for filter card text |
| `foregroundColor` | color | Color for text, buttons, and icons |
| `textSize` | integer | Font size for filter card text (use D suffix) |
| `inputBoxColor` | color | Background for input fields, search boxes, sliders |

### Filter Card Selectors

The `$id` property allows targeting specific filter card types:

- **`"Available"`**: Filters in "Available" section (not yet applied)
- **`"Applied"`**: Filters in "Applied" section (actively filtering)
- **Specific filter ID**: Target a specific filter by its GUID (from filterConfig)

**Example - Different styles for Available vs Applied:**

```json
{
  "filterCard": [
    {
      "$id": "Available",
      "properties": {
        "backgroundColor": {
          "solid": {
            "color": {
              "expr": {
                "Literal": {
                  "Value": "'#F5F5F5'"
                }
              }
            }
          }
        }
      }
    },
    {
      "$id": "Applied",
      "properties": {
        "backgroundColor": {
          "solid": {
            "color": {
              "expr": {
                "Literal": {
                  "Value": "'#E3F2FD'"
                }
              }
            }
          }
        }
      }
    }
  ]
}
```

## Common Patterns

### Hide Filter Pane Completely

**report.json:**
```json
{
  "objects": {
    "outspacePane": [
      {
        "properties": {
          "visible": {
            "expr": {
              "Literal": {
                "Value": "false"
              }
            }
          }
        }
      }
    ]
  }
}
```

### Custom Themed Filter Pane

**In theme JSON (applies to all pages):**

```json
{
  "visualStyles": {
    "page": {
      "*": {
        "outspacePane": [
          {
            "backgroundColor": { "solid": { "color": "#2C3E50" } },
            "foregroundColor": { "solid": { "color": "#ECF0F1" } },
            "borderColor": { "solid": { "color": "#34495E" } },
            "checkboxAndApplyColor": { "solid": { "color": "#3498DB" } },
            "fontFamily": "Segoe UI",
            "headerSize": 12,
            "titleSize": 14,
            "width": 300
          }
        ],
        "filterCard": [
          {
            "$id": "Applied",
            "backgroundColor": { "solid": { "color": "#34495E" } },
            "foregroundColor": { "solid": { "color": "#ECF0F1" } },
            "borderColor": { "solid": { "color": "#3498DB" } },
            "border": true,
            "textSize": 10
          },
          {
            "$id": "Available",
            "backgroundColor": { "solid": { "color": "#2C3E50" } },
            "foregroundColor": { "solid": { "color": "#BDC3C7" } },
            "textSize": 10,
            "transparency": 20
          }
        ]
      }
    }
  }
}
```

### Narrow Filter Pane

```json
{
  "outspacePane": [
    {
      "properties": {
        "width": {
          "expr": {
            "Literal": {
              "Value": "200D"
            }
          }
        }
      }
    }
  ]
}
```

### High Contrast Filter Cards

```json
{
  "filterCard": [
    {
      "$id": "Applied",
      "properties": {
        "backgroundColor": {
          "solid": {
            "color": {
              "expr": {
                "Literal": {
                  "Value": "'#000000'"
                }
              }
            }
          }
        },
        "foregroundColor": {
          "solid": {
            "color": {
              "expr": {
                "Literal": {
                  "Value": "'#FFFFFF'"
                }
              }
            }
          }
        },
        "borderColor": {
          "solid": {
            "color": {
              "expr": {
                "Literal": {
                  "Value": "'#FFFF00'"
                }
              }
            }
          }
        },
        "border": {
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
```

## Key Learnings

1. **CRITICAL - Report vs Theme level restrictions**:
   - **Report level (report.json)**: ONLY `visible` and `expanded` work - styling properties cause deployment errors
   - **Theme level (theme JSON)**: All styling properties (backgroundColor, width, border, etc.) work here
   - **Rule**: Control visibility in report.json, control appearance in theme JSON

2. **outspacePane = Filter Pane**: Despite the name, this is the filter pane

3. **filterCard allows targeting**: Can style all filters or specific types (Available/Applied)

4. **Theme inheritance**: Filter pane formatting in themes applies to all pages

5. **Width is integer (no D suffix)**: Use bare integers like `320`, NOT `"320D"` - discovered via experimentation

6. **Font sizes are integers (no D suffix)**: Use bare integers like `16`, NOT `"16D"`

7. **Two-level control**: Pane level (outspacePane) + Card level (filterCard) for granular styling

8. **Tested and verified**: Light blue background (#F0F8FF), steel blue border (#4682B4), width 320px all work at theme level

## Related Documentation

- [page.md](./page.md) - Page-level objects including outspacePane
- [theme.md](./theme.md) - Theme structure and wildcard selectors
- [expressions.md](./schema-patterns/expressions.md) - Expression format for properties
