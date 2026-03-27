# Filter Pane and Filters

> For slicer visuals (on-canvas filters), slicer visual documentation is not yet available.

## General Guidance

- The filter pane is the preferred place to set filters for Power BI reports.
- Slicers should only be used when a filter is so important that the user must see it on the page, or when the UX mandates it (button slicers, conditional formatting, specific designs).
- The filter pane is generally preferred because it's a more effective use of space and provides a clear UX.
- If the report is not using the filter pane, hide it by setting `visible: false` in report.json.
- Filter pane styling must be done in the theme JSON -- see [theme.md](./theme.md) "Filter Pane and Filter Card Formatting in Themes".

## Filter Types

Seven filter types are supported. In practice, `Categorical` and `Advanced` cover the vast majority of use cases.

| Type | Description | Use Case |
|------|-------------|----------|
| `Categorical` | Select from a list of values (In/NotIn) | Most common -- year, category, brand |
| `Advanced` | Comparison conditions on measures or columns | Measure > threshold, between ranges |
| `TopN` | Top/bottom N by a measure | Top 10 customers by revenue |
| `VisualTopN` | Visual-level top N | Applied automatically by some visuals |
| `RelativeDate` | Relative date window (last N days/months/years) | Rolling time windows |
| `RelativeTime` | Relative time window (last N hours/minutes) | Near-real-time dashboards |
| `Tuple` | Multi-column composite filter | Rare -- compound key filtering |

## Filter Scope

Filters can be scoped to three levels:

| Scope | Location | Applies to |
|-------|----------|------------|
| Report | `report.json` -> `filterConfig.filters[]` | All pages and visuals |
| Page | `page.json` -> `filterConfig.filters[]` | All visuals on the page |
| Visual | `visual.json` -> `filterConfig.filters[]` | Single visual only |

## Filter Structure

Every filter has the same core structure regardless of scope:

```json
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
  "filter": {},
  "isHiddenInViewMode": false,
  "isLockedInViewMode": false,
  "howCreated": "User",
  "objects": {}
}
```

### Core Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Unique 20-char hex identifier |
| `displayName` | string | Optional display name in filter pane |
| `field` | object | Column or Measure reference (same syntax as query projections) |
| `type` | string | Filter type (see table above) |
| `filter` | object | The filter condition (Where clause with selected values) |
| `isHiddenInViewMode` | boolean | Hide from filter pane in reading view |
| `isLockedInViewMode` | boolean | Prevent viewers from modifying |
| `howCreated` | string | `"User"` for user-created filters |
| `ordinal` | integer | Display order in filter pane (optional) |
| `objects` | object | Additional config (requireSingleSelect, etc.) |

## Discovering Filter Values

Before setting default values, you need to know what values exist in the model. Three tools can query the semantic model.

### pbir model (preferred for local PBIR reports)

```bash
# Get model definition (tables, columns, measures)
pbir model "Report.Report" -d

# Filter to a specific table
pbir model "Report.Report" -d -t Date

# Query distinct values for a column
pbir model "Report.Report" -q "EVALUATE DISTINCT('Date'[Calendar Year (ie 2021)])"

# Query with format
pbir model "Report.Report" -q "EVALUATE VALUES('Exchange Rate'[From Currency])" -F table
```

### te query (Tabular Editor CLI)

```bash
# Query distinct values (explicit workspace/model)
te query -q "EVALUATE VALUES('Date'[Calendar Year (ie 2021)])" -s "My Workspace" -d "My Model"

# Query with CSV output for processing
te query -q "EVALUATE VALUES('Exchange Rate'[From Currency])" --output csv

# Query from file
te query -f query.dax -s "My Workspace" -d "My Model"
```

### fab api (Fabric CLI -- for remote models)

```bash
# Get workspace and model IDs first
WS_ID=$(fab get "ws.Workspace" -q "id" | tr -d '"')
MODEL_ID=$(fab get "ws.Workspace/Model.SemanticModel" -q "id" | tr -d '"')

# Execute DAX query
fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID/executeQueries" \
  -X post -i '{"queries":[{"query":"EVALUATE VALUES('\''Date'\''[Calendar Year (ie 2021)])"}]}'
```

### Useful DAX patterns for filter value discovery

```dax
-- All distinct values for a column (for Categorical filters)
EVALUATE VALUES('Date'[Calendar Year (ie 2021)])

-- Distinct values with count (to understand cardinality)
EVALUATE
  ADDCOLUMNS(
    VALUES('Customers'[Account Type]),
    "Count", CALCULATE(COUNTROWS('Customers'))
  )

-- Min/max for range filters (Between, Advanced)
EVALUATE {(MIN('Date'[Date]), MAX('Date'[Date]))}

-- Top N preview (for TopN filters)
EVALUATE TOPN(10, 'Customers', [Revenue], DESC)
```

## Setting Default Selected Values

Default filter values are set in the `filter` property using a `Where` clause with `In` condition. This is how you pre-select values that the report opens with.

### Categorical Filter with Default Values (In)

Select specific values from a list:

```json
{
  "name": "d3f20cea05c37b47123a",
  "field": {
    "Column": {
      "Expression": {"SourceRef": {"Entity": "Exchange Rate"}},
      "Property": "From Currency"
    }
  },
  "type": "Categorical",
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
          "Values": [
            [{"Literal": {"Value": "'EUR'"}}],
            [{"Literal": {"Value": "'USD'"}}]
          ]
        }
      }
    }]
  }
}
```

**Filter Where clause rules:**
- `From` defines table aliases: `{"Name": "e", "Entity": "Exchange Rate", "Type": 0}`
- `Where.Condition` uses `SourceRef.Source` (the alias from `From`), NOT `SourceRef.Entity`
- Each value in `Values` is wrapped in its own array: `[[{val1}], [{val2}]]`
- String values use inner single quotes: `"'EUR'"`
- Integer values use L suffix: `"2022L"`
- Single quotes in values are doubled: `"'O''Brien'"`

### Single Default Value

For a single pre-selected value:

```json
"Values": [
  [{"Literal": {"Value": "'2024'"}}]
]
```

### No Default Values (Empty Filter)

A filter with no pre-selected values (user selects at runtime):

```json
{
  "name": "9a135e8e175961ab0070",
  "field": {
    "Column": {
      "Expression": {"SourceRef": {"Entity": "Date"}},
      "Property": "Calendar Year (ie 2021)"
    }
  },
  "type": "Categorical"
}
```

Omit the `filter` property entirely, or include it with an empty `Where`:

```json
"filter": {
  "Version": 2,
  "From": [{"Name": "d", "Entity": "Date", "Type": 0}],
  "Where": []
}
```

### Inverted Selection (Exclude Mode)

Exclude specific values instead of including them. Wraps the `In` condition with `Not`:

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
        "isInvertedSelectionMode": {"expr": {"Literal": {"Value": "true"}}}
      }
    }]
  }
}
```

When `isInvertedSelectionMode: true`, the `Where` condition uses `Not` -> `In`.

### Advanced Filter (Comparison Conditions)

Used for measure-based or range-based conditions:

```json
{
  "name": "1c9a23490ebe5441b781",
  "field": {
    "Measure": {
      "Expression": {"SourceRef": {"Entity": "Budget"}},
      "Property": "Budget vs. Turnover (%)"
    }
  },
  "type": "Advanced",
  "filter": {
    "Version": 2,
    "From": [{"Name": "d", "Entity": "Budget", "Type": 0}],
    "Where": [{
      "Condition": {
        "Comparison": {
          "ComparisonKind": 1,
          "Left": {
            "Measure": {
              "Expression": {"SourceRef": {"Source": "d"}},
              "Property": "Budget vs. Turnover (%)"
            }
          },
          "Right": {"Literal": {"Value": "0D"}}
        }
      }
    }]
  }
}
```

ComparisonKind: `0`=Equal, `1`=GreaterThan, `2`=GreaterThanOrEqual, `3`=LessThanOrEqual, `4`=LessThan.

### Between (Range Filter)

Filter a column to values within a range (inclusive on both bounds):

```json
"filter": {
  "Version": 2,
  "From": [{"Name": "d", "Entity": "Date", "Type": 0}],
  "Where": [{
    "Condition": {
      "Between": {
        "Expression": {
          "Column": {
            "Expression": {"SourceRef": {"Source": "d"}},
            "Property": "Date"
          }
        },
        "LowerBound": {"Literal": {"Value": "datetime'2024-01-01T00:00:00.000000'"}},
        "UpperBound": {"Literal": {"Value": "datetime'2024-12-31T00:00:00.000000'"}}
      }
    }
  }]
}
```

Use `And` with two `Comparison` conditions for exclusive bounds or open-ended ranges.

### Relative Date Filter

Filter to a rolling window relative to today (e.g., "last 3 months"). Uses `DateSpan` in the `Where` condition:

```json
{
  "name": "a1b2c3d4e5f6a7b8c9d0",
  "field": {
    "Column": {
      "Expression": {"SourceRef": {"Entity": "Date"}},
      "Property": "Date"
    }
  },
  "type": "RelativeDate",
  "filter": {
    "Version": 2,
    "From": [{"Name": "d", "Entity": "Date", "Type": 0}],
    "Where": [{
      "Condition": {
        "Comparison": {
          "ComparisonKind": 2,
          "Left": {
            "Column": {
              "Expression": {"SourceRef": {"Source": "d"}},
              "Property": "Date"
            }
          },
          "Right": {
            "DateSpan": {
              "Expression": {"Now": {}},
              "TimeUnit": 2
            }
          }
        }
      }
    }]
  }
}
```

**TimeUnit values:** `0`=Day, `1`=Week, `2`=Month, `3`=Year, `4`=Decade, `5`=Second, `6`=Minute, `7`=Hour.

`DateSpan` computes the start of the current time unit period. Combine with `DateAdd` to offset:

```json
"Right": {
  "DateAdd": {
    "Expression": {
      "DateSpan": {
        "Expression": {"Now": {}},
        "TimeUnit": 2
      }
    },
    "TimeUnit": 2,
    "Amount": -3
  }
}
```

This gives "3 months ago from start of current month" -- useful for "last 3 months" rolling windows.

`RelativeTime` works identically but with `TimeUnit` values `5` (Second), `6` (Minute), `7` (Hour) for near-real-time filters.

### TopN Filter

Filter to top/bottom N items by a measure. Uses `VisualTopN` expression:

```json
{
  "name": "f1e2d3c4b5a6f7e8d9c0",
  "field": {
    "Column": {
      "Expression": {"SourceRef": {"Entity": "Customers"}},
      "Property": "Customer Name"
    }
  },
  "type": "TopN",
  "filter": {
    "Version": 2,
    "From": [{"Name": "c", "Entity": "Customers", "Type": 0}],
    "Where": [{
      "Condition": {
        "VisualTopN": {
          "Expression": {
            "Column": {
              "Expression": {"SourceRef": {"Source": "c"}},
              "Property": "Customer Name"
            }
          },
          "Count": {"Literal": {"Value": "10L"}},
          "OrderBy": {
            "Measure": {
              "Expression": {"SourceRef": {"Entity": "Sales"}},
              "Property": "Revenue"
            }
          },
          "IsAscending": false
        }
      }
    }]
  }
}
```

`IsAscending: false` = Top N (largest first). `IsAscending: true` = Bottom N (smallest first).

### Compound Conditions (And / Or)

Combine multiple conditions with `And` or `Or` wrappers:

```json
"Condition": {
  "And": {
    "Left": {
      "Comparison": {
        "ComparisonKind": 2,
        "Left": {"Column": {"Expression": {"SourceRef": {"Source": "d"}}, "Property": "Date"}},
        "Right": {"Literal": {"Value": "datetime'2024-01-01T00:00:00.000000'"}}
      }
    },
    "Right": {
      "Comparison": {
        "ComparisonKind": 3,
        "Left": {"Column": {"Expression": {"SourceRef": {"Source": "d"}}, "Property": "Date"}},
        "Right": {"Literal": {"Value": "datetime'2024-06-30T00:00:00.000000'"}}
      }
    }
  }
}
```

This filters to dates >= 2024-01-01 AND <= 2024-06-30.

## Filter Condition Reference

All condition types available in `Where[].Condition`:

| Condition | Description |
|-----------|-------------|
| `In` | Value is in a list (Categorical) |
| `Not` -> `In` | Value is NOT in a list (inverted Categorical) |
| `Comparison` | Single comparison (=, >, >=, <=, <) |
| `Between` | Value within range (inclusive) |
| `And` / `Or` | Compound conditions |
| `Not` | Negation wrapper |
| `Contains` | String contains substring |
| `StartsWith` | String starts with prefix |
| `DateSpan` | Relative date window (current period) |
| `DateAdd` | Offset from a date expression |
| `VisualTopN` | Top/bottom N by measure |
| `Now` | Current date/time (used inside DateSpan/DateAdd) |

## Filter Configuration Options

### Single-Select

Force users to select exactly one value:

```json
"objects": {
  "general": [{
    "properties": {
      "requireSingleSelect": {"expr": {"Literal": {"Value": "true"}}}
    }
  }]
}
```

Good for: year selection, currency, rate type, measure selection parameters.

### Hide and Lock

| Property | Effect |
|----------|--------|
| `isHiddenInViewMode: true` | Filter hidden from pane in reading view |
| `isLockedInViewMode: true` | Filter visible but viewers cannot change it |

**Only** hide report- or page-level filters with explicit justification. Never hide visual-level filters -- it confuses users when visuals don't behave as expected.

### Common Combinations

| Use Case | Hidden | Locked | SingleSelect |
|----------|--------|--------|--------------|
| Hidden background filter | true | true | - |
| Locked parameter (visible) | false | true | true |
| Normal multi-select | false | false | false |
| Visible single-select | false | false | true |

## Report Level - Filter Pane Visibility

**Location:** `report.json` -> `objects` -> `outspacePane`

**CRITICAL:** At report level, ONLY `visible` and `expanded` are allowed. Styling properties cause deployment errors.

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

| Property | Type | Description |
|----------|------|-------------|
| `visible` | boolean | Show/hide the filter pane entirely |
| `expanded` | boolean | Whether the pane starts expanded or collapsed |

## Filter Pane Styling

**All filter pane styling (colors, fonts, width, borders) must be done in the theme, not in report.json or page.json.** Putting styling properties at report level causes deployment errors.

See [theme.md](./theme.md) -- "Filter Pane and Filter Card Formatting in Themes" section for:
- `outspacePane` properties (backgroundColor, foregroundColor, fontFamily, titleSize, headerSize, width, etc.)
- `filterCard` properties with `$id` selectors (`"Available"`, `"Applied"`)
- Complete themed filter pane examples

## Related Documentation

- [theme.md](./theme.md) - Filter pane and filter card styling in themes
- [page.md](./page.md) - Page-level filter scope
- [report.md](./report.md) - Report-level filter scope
- [expressions.md](./schema-patterns/expressions.md) - Expression format for filter values
