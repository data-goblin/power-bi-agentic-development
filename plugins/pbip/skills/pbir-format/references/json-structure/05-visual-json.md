# visual.json

Visual configuration including position, data bindings, formatting, sorting, and filters.

## Location

`Report.Report/definition/pages/[PageName]/visuals/[VisualName]/visual.json`

## Structure

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.7.0/schema.json",
  "name": "sales_line_chart",
  "position": {
    "x": 100, "y": 50, "z": 1000,
    "width": 400, "height": 300,
    "tabOrder": 0
  },
  "visual": {
    "visualType": "lineChart",
    "query": {
      "queryState": {},
      "sortDefinition": {}
    },
    "objects": {},
    "visualContainerObjects": {},
    "filterConfig": {},
    "drillFilterOtherVisuals": true
  }
}
```

## position

```json
"position": {
  "x": 100,
  "y": 50,
  "z": 1000,
  "width": 400,
  "height": 300,
  "tabOrder": 0
}
```

- `x`, `y` -- top-left corner in pixels (can be fractional)
- `z` -- layer order (higher = front; values like 0, 1000, 4000, 8000, 15000 observed)
- `tabOrder` -- keyboard navigation order (can differ from z)

## visualType

Common types:

| Type | Category |
|------|----------|
| `card`, `cardVisual` | Cards (old vs new) |
| `tableEx`, `pivotTable` | Tables |
| `lineChart`, `areaChart`, `stackedAreaChart` | Line/area charts |
| `clusteredBarChart`, `clusteredColumnChart` | Bar/column charts |
| `pieChart` | Pie/donut |
| `scatterChart` | Scatter |
| `kpi` | KPI |
| `slicer`, `advancedSlicerVisual` | Slicers |
| `textbox` | Text |
| `shape`, `actionButton`, `image` | Non-data visuals |
| `scriptVisual` | R/Python visuals |

## query.queryState

Data bindings by role. Roles vary by visual type (see SKILL.md query roles table).

```json
"query": {
  "queryState": {
    "Category": {
      "projections": [{
        "field": {
          "Column": {
            "Expression": {"SourceRef": {"Entity": "Date"}},
            "Property": "Month"
          }
        },
        "queryRef": "Date.Month",
        "nativeQueryRef": "Month",
        "active": true
      }]
    },
    "Y": {
      "projections": [{
        "field": {
          "Measure": {
            "Expression": {"SourceRef": {"Entity": "Sales"}},
            "Property": "Revenue"
          }
        },
        "queryRef": "Sales.Revenue",
        "nativeQueryRef": "Revenue"
      }]
    }
  },
  "sortDefinition": {
    "sort": [{
      "field": {
        "Measure": {
          "Expression": {"SourceRef": {"Entity": "Sales"}},
          "Property": "Revenue"
        }
      },
      "direction": "Descending"
    }],
    "isDefaultSort": true
  }
}
```

Projection properties:
- `queryRef` -- fully qualified reference (`Table.Field`)
- `nativeQueryRef` -- display label used in the visual
- `displayName` -- override display name (optional)
- `active` -- whether hierarchy level is expanded (optional)

Sort direction values: `"Ascending"`, `"Descending"` (capitalized).

## objects vs visualContainerObjects

**Critical distinction -- both live inside `visual`, not at root level:**

| Section | Purpose | Common Properties |
|---------|---------|-------------------|
| `objects` | Visual-specific formatting | dataPoint, legend, categoryAxis, valueAxis, dataLabels, lineStyles, plotArea, grid, columnHeaders, columnFormatting, total, data (slicer mode), general (textbox paragraphs) |
| `visualContainerObjects` | Container chrome | title, subTitle, background, border, dropShadow, padding, divider, visualHeader, visualTooltip, general (altText), lockAspect, spacing |

**Schema version matters:** Schemas 2.1.0-2.2.0 use `objects` for everything. Schema 2.4.0+ splits into `objects` and `visualContainerObjects`. Putting container properties in `objects` on 2.4.0+ silently fails.

```json
"visual": {
  "objects": {
    "dataPoint": [...],
    "legend": [...],
    "categoryAxis": [...]
  },
  "visualContainerObjects": {
    "title": [...],
    "background": [...],
    "border": [...]
  }
}
```

## filterConfig

Visual-level filters:

```json
"filterConfig": {
  "filters": [{
    "name": "e7466b66be105b916228",
    "field": {"Column": {"Expression": {"SourceRef": {"Entity": "Date"}}, "Property": "Calendar Month"}},
    "type": "Categorical"
  }, {
    "name": "113e43857d99cc7a0e36",
    "field": {"Measure": {"Expression": {"SourceRef": {"Entity": "Budget"}}, "Property": "Budget vs. Turnover (%)"}},
    "type": "Advanced"
  }]
}
```

Filter types: `"Categorical"`, `"Advanced"`.

## Conditional Formatting

Three patterns (see `schema-patterns/conditional-formatting.md` for full details):

### Measure-based (two-entry array with dataViewWildcard)

```json
"dataPoint": [
  {"properties": {}},
  {
    "properties": {
      "fill": {
        "solid": {
          "color": {
            "expr": {
              "Measure": {
                "Expression": {"SourceRef": {"Schema": "extension", "Entity": "_Fmt"}},
                "Property": "Bar Color"
              }
            }
          }
        }
      }
    },
    "selector": {"data": [{"dataViewWildcard": {"matchingOption": 1}}]}
  }
]
```

### FillRule (gradient)

```json
"expr": {
  "FillRule": {
    "Input": {"Measure": {"Expression": {"SourceRef": {"Entity": "Sales"}}, "Property": "Revenue"}},
    "FillRule": {
      "linearGradient2": {
        "min": {"color": {"Literal": {"Value": "'#FF0000'"}}, "value": {"Literal": {"Value": "0D"}}},
        "max": {"color": {"Literal": {"Value": "'#00FF00'"}}, "value": {"Literal": {"Value": "1D"}}},
        "nullColoringStrategy": {"strategy": {"Literal": {"Value": "'asZero'"}}}
      }
    }
  }
}
```

### Conditional (rule-based)

```json
"expr": {
  "Conditional": {
    "Cases": [{
      "Condition": {"Comparison": {"ComparisonKind": 4, "Left": {"Measure": {...}}, "Right": {"Literal": {"Value": "0D"}}}},
      "Value": {"Literal": {"Value": "'#D64550'"}}
    }],
    "DefaultValue": {"Literal": {"Value": "'#118DFF'"}}
  }
}
```

ComparisonKind: 0=Equal, 1=GreaterThan, 2=GreaterThanOrEqual, 3=LessThanOrEqual, 4=LessThan.

## Selectors

| Type | Syntax | Purpose |
|------|--------|---------|
| (none) | No `selector` key | Applies to entire visual |
| metadata | `{"metadata": "Sales.Revenue"}` | Specific column/measure |
| id | `{"id": "default"}` | Named instance |
| dataViewWildcard | `{"data": [{"dataViewWildcard": {"matchingOption": 1}}]}` | Per-point formatting |
| scopeId | `{"data": [{"scopeId": {"Comparison": {...}}}]}` | Specific data point value |

matchingOption: 0 = identities + totals, 1 = per data point, 2 = totals only.

Selectors can be combined: `metadata` + `data` + `id` + `order` on the same object.
