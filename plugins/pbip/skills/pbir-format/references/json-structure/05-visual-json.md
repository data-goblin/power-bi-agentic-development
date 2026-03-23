# visual.json

Visual configuration including position, data bindings, and formatting.

## Location

`Report.Report/definition/pages/[PageName]/visuals/[VisualName]/visual.json`

## Structure

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.2.0/schema.json",
  "name": "visual-guid",
  "position": {...},
  "visual": {
    "visualType": "barChart",
    "query": {...},
    "objects": {...},
    "visualContainerObjects": {...}
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

- `x`, `y`: Top-left corner (pixels)
- `z`: Layer order (higher = front)
- `tabOrder`: Keyboard navigation order

## visualType

Common types: `barChart`, `columnChart`, `lineChart`, `clusteredBarChart`, `clusteredColumnChart`, `pieChart`, `donutChart`, `tableEx`, `pivotTable`, `cardVisual`, `kpi`, `slicer`, `advancedSlicerVisual`, `textbox`, `image`, `shape`, `actionButton`

## query.queryState

Data bindings by role:

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
        "queryRef": "Date.Month"
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
        "queryRef": "Sales.Revenue"
      }]
    }
  }
}
```

Common roles: `Category`, `Y`, `Y2`, `Series`, `Values`, `Rows`, `Columns`, `Tooltips`

## objects vs visualContainerObjects

**Critical distinction:**

| Section | Contains | Examples |
|---------|----------|----------|
| `objects` | Visual-specific formatting | dataPoint, legend, categoryAxis, valueAxis, labels |
| `visualContainerObjects` | Container formatting | title, subTitle, background, border, dropShadow |

**Wrong:** Putting `background` in `objects` - silently ignored.

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

## Expression Patterns

### Literals

```json
// String (single quotes inside)
{"expr": {"Literal": {"Value": "'smooth'"}}}

// Number (D suffix required)
{"expr": {"Literal": {"Value": "14D"}}}

// Boolean (lowercase, no quotes)
{"expr": {"Literal": {"Value": "true"}}}
```

### Measure References

```json
// Model measure
{"expr": {"Measure": {"Expression": {"SourceRef": {"Entity": "Sales"}}, "Property": "Revenue"}}}

// Extension measure (requires Schema)
{"expr": {"Measure": {"Expression": {"SourceRef": {"Schema": "extension", "Entity": "_Fmt"}}, "Property": "Color"}}}
```

### ThemeDataColor

```json
{"expr": {"ThemeDataColor": {"ColorId": 0, "Percent": 0}}}
```

- `ColorId`: Index into theme dataColors (0-based)
- `Percent`: Lightness adjustment (-100 to 100)

### FillRule (Gradient)

```json
"expr": {
  "FillRule": {
    "Input": {"Measure": {...}},
    "FillRule": {
      "linearGradient2": {
        "min": {"color": {"Literal": {"Value": "'minColor'"}}, "value": {"Literal": {"Value": "0D"}}},
        "max": {"color": {"Literal": {"Value": "'maxColor'"}}, "value": {"Literal": {"Value": "1D"}}}
      }
    }
  }
}
```

## Selectors

### No selector (static)

Applies to entire visual:

```json
"legend": [{"properties": {"show": {"expr": {"Literal": {"Value": "true"}}}}}]
```

### metadata (series-level)

Applies to specific field:

```json
"selector": {"metadata": "Sales.Revenue"}
```

### dataViewWildcard (per-point)

| matchingOption | Description |
|----------------|-------------|
| 0 | Series + totals |
| 1 | Per data point (conditional formatting) |
| 2 | Totals only |

```json
"selector": {"data": [{"dataViewWildcard": {"matchingOption": 1}}]}
```

## Conditional Formatting Pattern

Two-entry array required:

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
                "Property": "BarColor"
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

## Search

```bash
# Find visuals by type
grep -r '"visualType":' Report.Report/definition/pages/

# Find field bindings
grep -r '"queryRef":' Report.Report/definition/pages/

# Find conditional formatting
grep -r '"dataViewWildcard"' Report.Report/definition/pages/

# Find extension measure usage
grep -r '"Schema": "extension"' Report.Report/definition/pages/
```
