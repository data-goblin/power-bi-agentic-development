# visual.json Reference

The most important and complex file in PBIR. Each visual on a report page has one. It defines what visual type to render, what data to bind, how to format it, and where to position it on the page.

**Location:** `Report.Report/definition/pages/[PageName]/visuals/[VisualName]/visual.json`

## Top-Level Structure

```json
{
  "$schema": "...visualContainer/2.7.0/schema.json",
  "name": "sales_line_chart",
  "position": {"x": 100, "y": 50, "z": 1000, "width": 400, "height": 300, "tabOrder": 0},
  "visual": {
    "visualType": "lineChart",
    "query": {
      "queryState": {},
      "sortDefinition": {}
    },
    "objects": {},
    "visualContainerObjects": {},
    "drillFilterOtherVisuals": true
  },
  "filterConfig": {}
}
```

## Position

```json
"position": {"x": 100, "y": 50, "z": 1000, "width": 400, "height": 300, "tabOrder": 0}
```

- `x`, `y` -- top-left corner in pixels (can be fractional)
- `z` -- layer order (higher = front); common values: 0, 1000, 2000, 3000, 5000, 8000, 15000
- `tabOrder` -- keyboard navigation order (optional; can differ from z)

## Expression Syntax

All formatting values in visual.json use `expr` wrappers with type-specific suffixes. Theme JSON uses bare values instead.

| Type | Syntax | Notes |
|------|--------|-------|
| String | `{"expr": {"Literal": {"Value": "'smooth'"}}}` | Inner single quotes required |
| Double | `{"expr": {"Literal": {"Value": "14D"}}}` | `D` suffix -- most common for font sizes, percentages |
| Integer | `{"expr": {"Literal": {"Value": "14L"}}}` | `L` suffix -- pixel counts, enum values |
| Decimal | `{"expr": {"Literal": {"Value": "2.4M"}}}` | `M` suffix -- money/decimal precision |
| Boolean | `{"expr": {"Literal": {"Value": "true"}}}` | Lowercase, no quotes, no suffix |
| DateTime | `{"expr": {"Literal": {"Value": "datetime'2024-01-15T00:00:00.000000'"}}}` | Single-quoted datetime string (closing `'` required) |
| Color (hex) | `{"expr": {"Literal": {"Value": "'#FF0000'"}}}` | Inner single quotes; 6-digit RGB or 8-digit ARGB |
| Null | `{"expr": {"Literal": {"Value": "null"}}}` | Lowercase, no quotes, no suffix |
| Theme color | `{"expr": {"ThemeDataColor": {"ColorId": 0, "Percent": 0}}}` | Percent: -1.0 (darker) to 1.0 (lighter), 0 = exact |
| Extension measure | `{"expr": {"Measure": {"Expression": {"SourceRef": {"Schema": "extension", "Entity": "_Fmt"}}, "Property": "Color"}}}` | `"Schema": "extension"` required |

Both `D` and `L` work for whole numbers. Use `D` for font sizes and floating-point contexts, `L` for integer-only contexts (pixel counts, ComparisonKind values).

**Gotchas:** `transparency` uses `D` normally but `L` inside `dropShadow`. `labelPrecision` always uses `L` but `labelDisplayUnits` always uses `D`.

**String escaping:** Single quotes within string literals are doubled: `"'here''s some text'"`. Font families with fallback chains use triple-quote escaping: `"'''Segoe UI Semibold'', helvetica, sans-serif'"`.

**Filter SourceRef gotcha:** In filter `Where` conditions, SourceRef uses `"Source": "alias"` (referencing the alias defined in `From`), NOT `"Entity"`. This differs from query projections which use `"Entity"`.

## Field Reference Patterns

Six patterns for referencing fields in queries and expressions:

| Pattern | Syntax |
|---------|--------|
| Column | `{"Column": {"Expression": {"SourceRef": {"Entity": "Table"}}, "Property": "Column"}}` |
| Measure (model) | `{"Measure": {"Expression": {"SourceRef": {"Entity": "Table"}}, "Property": "Measure"}}` |
| Measure (extension) | `{"Measure": {"Expression": {"SourceRef": {"Schema": "extension", "Entity": "Table"}}, "Property": "Measure"}}` |
| Aggregation | `{"Aggregation": {"Expression": {"Column": {"Expression": {"SourceRef": {"Entity": "Table"}}, "Property": "Col"}}, "Function": 0}}` |
| Hierarchy level | `{"HierarchyLevel": {"Expression": {"Hierarchy": {"Expression": {"SourceRef": {"Entity": "Table"}}, "Hierarchy": "Name"}}, "Level": "Level"}}` |
| SparklineData | `{"SparklineData": {"Measure": {"Measure": {...}}, "Groupings": [{"Column": {...}}]}}` |

**Aggregation function codes:** 0=Sum, 1=Avg, 2=Min, 3=Max, 4=Count, 5=DistinctCount

## Query Roles by Visual Type

| Visual Type | Query Roles |
|-------------|-------------|
| card | Values |
| cardVisual (new card) | Data |
| tableEx | Values |
| pivotTable | Rows, Columns, Values |
| slicer | Values |
| advancedSlicerVisual / listSlicer | Values |
| pieChart / donutChart | Category, Y |
| lineChart | Category, Y (also Y2 for combo) |
| areaChart / stackedAreaChart / hundredPercentStackedAreaChart | Category, Y (also Series) |
| barChart / clusteredBarChart / hundredPercentStackedBarChart | Category, Y |
| columnChart / clusteredColumnChart / hundredPercentStackedColumnChart | Category, Y |
| lineClusteredColumnComboChart | Category, Y (columns), Y2 (line) |
| lineStackedColumnComboChart | Category, Y (stacked columns), Y2 (line) |
| ribbonChart | Category, Y |
| waterfallChart | Category, Y |
| scatterChart | Category, X, Y, Size, Tooltips |
| gauge | Y, TargetValue |
| kpi | Indicator, Goal, Goals, TrendLine |
| textbox | (none -- uses objects.general.paragraphs) |
| shape / actionButton / image | (none -- uses objects for shape/icon/image config) |
| scriptVisual / pythonVisual | Values |
| `PBI_CV_<GUID>` (custom visuals) | varies by visual (Category, Value, etc.) |
| `deneb<GUID>` (Deneb/Vega) | dataset |

### Projection Properties

Each projection in `queryState` supports:

| Property | Description |
|----------|-------------|
| `queryRef` | Fully qualified reference (`Table.Field`) -- used internally |
| `nativeQueryRef` | Display label shown in visual |
| `displayName` | Override display name (optional) |
| `active` | Whether hierarchy level is expanded (optional, boolean) |

## objects vs visualContainerObjects

Both live inside `visual` (not root level of visual.json). See [visual-container-formatting.md](./visual-container-formatting.md) for the full picture.

- **`objects`** -- Visual-specific: dataPoint, legend, categoryAxis, valueAxis, dataLabels, lineStyles, plotArea
- **`visualContainerObjects`** -- Container: title, subTitle, background, border, dropShadow, padding, divider, visualHeader, visualTooltip

Putting container properties in `objects` silently fails. Putting `visualContainerObjects` at root level errors.

**Schema version matters:** Schemas 2.1.0-2.2.0 use `objects` for everything. Schema 2.4.0+ splits them.

## Conditional Formatting

Three distinct patterns:

1. **Measure-based** -- DAX measure returns a color string directly via extension measure reference
2. **FillRule (gradient)** -- `linearGradient2` with min/max, or `linearGradient3` with min/mid/max. Uses `nullColoringStrategy`.
3. **Conditional (rule-based)** -- ComparisonKind conditions (0=Equal, 1=GT, 2=GTE, 3=LTE, 4=LT). Cases evaluated in order; first match wins.

Per-point formatting requires a two-entry array with `matchingOption: 1`. See [conditional-formatting.md](./schema-patterns/conditional-formatting.md) for full patterns.

### Selector Types

| Type | Syntax | Purpose |
|------|--------|---------|
| (none) | No `selector` key | Applies to entire visual |
| metadata | `{"metadata": "Sales.Revenue"}` | Specific column/measure |
| id | `{"id": "default"}` | Named instance (also: `"selection:selected"`, `"interaction:hover"`, `"interaction:press"`) |
| dataViewWildcard | `{"data": [{"dataViewWildcard": {"matchingOption": 1}}]}` | Per-point formatting |
| scopeId | `{"data": [{"scopeId": {"Comparison": {...}}}]}` | Specific data point value |

matchingOption: `0` = identities + totals (series-level), `1` = per data point, `2` = totals only. Selectors can be combined. `hierarchyMatching` is an optional property on the selector object that controls hierarchy level matching (`0` = leaf levels only, `1` = all levels matched). See [selectors.md](./schema-patterns/selectors.md) for full details.

## Sort Definition

```json
"sortDefinition": {
  "sort": [{
    "field": {"Measure": {"Expression": {"SourceRef": {"Entity": "Sales"}}, "Property": "Revenue"}},
    "direction": "Descending"
  }],
  "isDefaultSort": true
}
```

Direction: `"Ascending"` or `"Descending"`. See [sort-visuals.md](./sort-visuals.md).

## Visual filterConfig

`filterConfig` lives at the **root level** of visual.json (sibling to `visual`, not nested inside it):

```json
{
  "name": "my_visual",
  "position": {...},
  "visual": {...},
  "filterConfig": {
    "filters": [{
      "name": "e7466b66be105b916228",
      "field": {"Column": {"Expression": {"SourceRef": {"Entity": "Date"}}, "Property": "Month"}},
      "type": "Categorical"
    }]
  }
}
```

Filter types: `"Categorical"`, `"Advanced"`. See [filter-pane.md](./filter-pane.md) for all filter types and patterns.

## Slicer Default Selected Values

To set a slicer's default selected values (what it opens with pre-selected), store the selection in `objects.general.properties.filter` — **not** `filterConfig`. This is distinct from `filterConfig` which filters the data going *into* the slicer.

```json
"visual": {
  "objects": {
    "general": [{
      "properties": {
        "filter": {
          "filter": {
            "Version": 2,
            "From": [{"Name": "d", "Entity": "Date", "Type": 0}],
            "Where": [{
              "Condition": {
                "In": {
                  "Expressions": [{
                    "Column": {
                      "Expression": {"SourceRef": {"Source": "d"}},
                      "Property": "Calendar Month (ie Jan)"
                    }
                  }],
                  "Values": [
                    [{"Literal": {"Value": "'Jan'"}}],
                    [{"Literal": {"Value": "'Feb'"}}]
                  ]
                }
              }
            }]
          }
        }
      }
    }]
  }
}
```

**Key distinction:**
- `filterConfig.filters[]` — filter pane filters that constrain the data feeding the slicer
- `objects.general.properties.filter` — the slicer's pre-selected default values

## Slicer Sync Groups

Slicers on different pages can be synced so they share the same selection. This is configured in `visual.syncGroup` inside the slicer's visual.json:

```json
"visual": {
  "visualType": "slicer",
  "query": {...},
  "syncGroup": {
    "groupName": "Calendar Month (ie Jan)1",
    "fieldChanges": true,
    "filterChanges": true
  },
  "drillFilterOtherVisuals": true
}
```

- `groupName` -- slicers with the same groupName sync across pages
- `fieldChanges` -- sync when the bound field changes
- `filterChanges` -- sync when the filter selection changes

All slicers in the same `groupName` must bind to the same field. The groupName is typically auto-generated from the field name but can be anything.

## Visual Interactions

Visual interactions control cross-filtering between visuals on a page. Configured in **page.json** (not report.json):

```json
"visualInteractions": [
  {"source": "slicer_visual_name", "target": "chart_visual_name", "type": "NoFilter"},
  {"source": "chart_a_name", "target": "chart_b_name", "type": "NoFilter"}
]
```

Types: `"NoFilter"` (disable cross-filter), `"Filter"` (cross-filter), `"Highlight"` (cross-highlight).

Only interactions that deviate from the default need to be listed. By default, all visuals cross-filter each other.

## Table/Matrix Column Widths

Column widths in tables and matrices are set via the `columnWidth` object with a `metadata` selector targeting the specific column:

```json
"columnWidth": [
  {
    "properties": {
      "value": {"expr": {"Literal": {"Value": "215D"}}}
    },
    "selector": {"metadata": "Orders.Order Lines"}
  },
  {
    "properties": {
      "value": {"expr": {"Literal": {"Value": "150D"}}}
    },
    "selector": {"metadata": "Customers.Account Type"}
  }
]
```

Each entry sets the width for one column, identified by `metadata` selector using `Table.Column` format.

## Visual Groups

Visuals can be grouped into a container that moves and resizes as a unit. A group visual uses `visualGroup` instead of `visual`:

```json
{
  "$schema": "...visualContainer/2.7.0/schema.json",
  "name": "my_group",
  "position": {"x": 0, "y": 0, "z": 0, "width": 800, "height": 400},
  "visualGroup": {
    "displayName": "KPI Section",
    "groupMode": "ScaleMode",
    "objects": {
      "background": [...],
      "general": [...],
      "lockAspect": [...]
    }
  }
}
```

Child visuals reference the group via `parentGroupName`:

```json
{
  "name": "card_in_group",
  "position": {"x": 10, "y": 10, "z": 1, "width": 200, "height": 100},
  "parentGroupName": "my_group",
  "visual": {
    "visualType": "card",
    ...
  }
}
```

- `groupMode`: `"ScaleMode"` (contents scale with group) or `"ScrollMode"` (contents scroll)
- `visual` and `visualGroup` are mutually exclusive -- a visual.json has one or the other
- Group objects are limited to `background`, `general`, `lockAspect`

## Hiding Visuals and Fields

### Hiding an entire visual

Set `isHidden: true` at the root level of visual.json (outside `visual`):

```json
{
  "name": "hidden_slicer",
  "position": {...},
  "visual": {...},
  "isHidden": true
}
```

Hidden visuals still exist and process data, but aren't rendered. Common for bookmarks that toggle visibility, or for slicers that drive cross-filtering without being shown.

### Hiding fields from the visual

Individual fields can be hidden from display while still being used in calculations. This is done by omitting them from the visual's query projections -- if a field isn't in `queryState`, it won't show. The field can still be referenced in extension measures or filters.

## Chart Element Formatting

Common chart formatting properties in `objects`. These use the standard expr wrapper pattern.

### Data Labels

```json
"labels": [{
  "properties": {
    "show": {"expr": {"Literal": {"Value": "true"}}},
    "fontSize": {"expr": {"Literal": {"Value": "10D"}}},
    "color": {"solid": {"color": {"expr": {"ThemeDataColor": {"ColorId": 0, "Percent": -0.3}}}}},
    "labelDisplayUnits": {"expr": {"Literal": {"Value": "1000D"}}},
    "labelPrecision": {"expr": {"Literal": {"Value": "1L"}}}
  }
}]
```

`labelDisplayUnits`: `0D` (auto), `1D` (none), `1000D` (thousands), `1000000D` (millions), `1000000000D` (billions).

### Markers (line/area charts)

```json
"markers": [{
  "properties": {
    "show": {"expr": {"Literal": {"Value": "true"}}},
    "markerSize": {"expr": {"Literal": {"Value": "8D"}}},
    "borderShow": {"expr": {"Literal": {"Value": "false"}}}
  }
}]
```

### Line Styles

```json
"lineStyles": [{
  "properties": {
    "strokeWidth": {"expr": {"Literal": {"Value": "3D"}}},
    "lineChartType": {"expr": {"Literal": {"Value": "'smooth'"}}},
    "showMarker": {"expr": {"Literal": {"Value": "true"}}},
    "segmentGradient": {"expr": {"Literal": {"Value": "false"}}}
  }
}]
```

`lineChartType`: `'smooth'`, `'straight'`, `'stepped'`.

### Bar/Column Borders

Data point borders on bar/column charts:

```json
"dataPoint": [{
  "properties": {
    "fill": {"solid": {"color": {"expr": {"ThemeDataColor": {"ColorId": 0, "Percent": 0}}}}},
    "showAllDataPoints": {"expr": {"Literal": {"Value": "true"}}}
  }
}]
```

Border styling is typically controlled via the theme rather than per-visual.

## Analytics Lines

Line and bar charts support reference lines, trend lines, error bars, and forecasts. These live in `objects` under type-specific property names.

### Reference Lines

```json
"y1AxisReferenceLine": [{
  "properties": {
    "show": {"expr": {"Literal": {"Value": "true"}}},
    "value": {"expr": {"Literal": {"Value": "50000D"}}},
    "lineColor": {"solid": {"color": {"expr": {"Literal": {"Value": "'#D64550'"}}}}},
    "transparency": {"expr": {"Literal": {"Value": "0D"}}},
    "style": {"expr": {"Literal": {"Value": "'dashed'"}}},
    "position": {"expr": {"Literal": {"Value": "'front'"}}},
    "dataLabelShow": {"expr": {"Literal": {"Value": "true"}}}
  }
}]
```

Also available: `xAxisReferenceLine`, `referenceLine` (some chart types).

### Trend Lines

```json
"trend": [{
  "properties": {
    "show": {"expr": {"Literal": {"Value": "true"}}},
    "lineColor": {"solid": {"color": {"expr": {"ThemeDataColor": {"ColorId": 0, "Percent": 0}}}}},
    "transparency": {"expr": {"Literal": {"Value": "20D"}}},
    "style": {"expr": {"Literal": {"Value": "'dashed'"}}}
  }
}]
```

### Error Bars/Bands

```json
"error": [{
  "properties": {
    "enabled": {"expr": {"Literal": {"Value": "true"}}},
    "barColor": {"solid": {"color": {"expr": {"ThemeDataColor": {"ColorId": 1, "Percent": 0.4}}}}},
    "barWidth": {"expr": {"Literal": {"Value": "2L"}}}
  },
  "selector": {"metadata": "Sales.Revenue"}
}]
```

Error bars can use measure-driven bounds via `errorRange.explicit.lowerBound` / `upperBound`.

### Forecast (line charts)

```json
"forecast": [{
  "properties": {
    "show": {"expr": {"Literal": {"Value": "true"}}},
    "forecastLength": {"expr": {"Literal": {"Value": "3L"}}},
    "confidenceBandStyle": {"expr": {"Literal": {"Value": "'fill'"}}},
    "confidenceLevel": {"expr": {"Literal": {"Value": "95D"}}}
  }
}]
```

### Which charts support which analytics

| Analytics | lineChart | barChart/columnChart | areaChart | scatterChart | comboChart |
|-----------|-----------|---------------------|-----------|--------------|------------|
| `y1AxisReferenceLine` | yes | yes | yes | yes | yes |
| `xAxisReferenceLine` | yes | yes | yes | yes | yes |
| `trend` | yes | yes | yes | yes | yes |
| `error` | yes | yes | -- | -- | yes |
| `forecast` | yes | -- | -- | -- | -- |
| `anomalyDetection` | yes | -- | -- | -- | -- |

## Matrix/Table Features

### Expansion States (pivotTable)

Controls which hierarchy levels are expanded when the report loads. Lives as a sibling of `objects` inside `visual`:

```json
"visual": {
  "visualType": "pivotTable",
  "expansionStates": [{
    "roles": ["Rows"],
    "levels": [
      {
        "queryRefs": ["Products.Type"],
        "identityKeys": [{"Column": {"Expression": {"SourceRef": {"Entity": "Products"}}, "Property": "Type"}}],
        "isPinned": true
      },
      {
        "queryRefs": ["Products.Subtype"],
        "isCollapsed": true,
        "identityKeys": [{"Column": {"Expression": {"SourceRef": {"Entity": "Products"}}, "Property": "Subtype"}}],
        "isPinned": true
      }
    ],
    "root": {}
  }],
  "objects": {...}
}
```

- `roles`: `"Rows"` or `"Columns"`
- `isCollapsed: true` -- level starts collapsed
- `isPinned: true` -- persists expansion across interactions

### Sub-Totals (pivotTable)

```json
"subTotals": [
  {
    "properties": {
      "rowSubtotals": {"expr": {"Literal": {"Value": "true"}}},
      "columnSubtotals": {"expr": {"Literal": {"Value": "true"}}}
    }
  },
  {
    "properties": {
      "bold": {"expr": {"Literal": {"Value": "true"}}},
      "fontColor": {"solid": {"color": {"expr": {"ThemeDataColor": {"ColorId": 0, "Percent": -0.3}}}}}
    },
    "selector": {"id": "Row"}
  }
]
```

Selector IDs: `"Row"` or `"Column"` for independent row/column subtotal styling.

### Sparkline Formatting (tableEx / pivotTable)

The `SparklineData` field reference adds the sparkline to the query. The `sparklines` formatting object in `objects` styles it:

```json
"sparklines": [{
  "properties": {
    "dataColor": {"solid": {"color": {"expr": {"Literal": {"Value": "'#8D9EA7'"}}}}},
    "markers": {"expr": {"Literal": {"Value": "144D"}}},
    "markerColor": {"solid": {"color": {"expr": {"Literal": {"Value": "'#8D9EA7'"}}}}},
    "strokeWidth": {"expr": {"Literal": {"Value": "2L"}}}
  },
  "selector": {"metadata": "SparklineData(Comparison.AOP MTD vs. Gross Sales (D)_[Date.Workdays MTD])"}
}]
```

The `selector.metadata` must match the exact `queryRef` of the SparklineData projection. `markers` is a bitmask (144D = show first + last markers).

### Per-Column Formatting (tableEx / pivotTable)

```json
"columnFormatting": [{
  "properties": {
    "labelDisplayUnits": {"expr": {"Literal": {"Value": "1000000D"}}},
    "formatString": {"expr": {"Literal": {"Value": "'$#,##0.00'"}}},
    "alignment": {"expr": {"Literal": {"Value": "'right'"}}}
  },
  "selector": {"metadata": "Sales.Revenue"}
}]
```

Can also include `dataBars` and `fontColor` per column. Each entry targets one column via `metadata` selector.

## Small Multiples

Many chart types support small multiples -- a grid of the same chart broken out by a dimension. Configured via the `Series` query role and `smallMultiplesLayout` in `objects`:

```json
"query": {
  "queryState": {
    "Category": {"projections": [...]},
    "Y": {"projections": [...]},
    "Series": {"projections": [{"field": {"Column": {"Expression": {"SourceRef": {"Entity": "Products"}}, "Property": "Category"}}}]}
  }
}
```

```json
"smallMultiplesLayout": [{
  "properties": {
    "gridLineType": {"expr": {"Literal": {"Value": "'inner'"}}},
    "backgroundTransparency": {"expr": {"Literal": {"Value": "0D"}}}
  }
}]
```

Supported on: lineChart, areaChart, barChart, columnChart, comboChart, and their stacked/100% variants.

## Related

- [visual-container-formatting.md](./visual-container-formatting.md) -- objects vs visualContainerObjects
- [schema-patterns/expressions.md](./schema-patterns/expressions.md) -- Full expression type reference
- [schema-patterns/selectors.md](./schema-patterns/selectors.md) -- Selector deep-dive
- [schema-patterns/conditional-formatting.md](./schema-patterns/conditional-formatting.md) -- Conditional formatting patterns
- [sort-visuals.md](./sort-visuals.md) -- Sort configuration
- [filter-pane.md](./filter-pane.md) -- Filter types and default values
- [textbox.md](./textbox.md) -- Textbox-specific patterns

## External

- [SQLBI: The 3-30-300 Rule for Better Reports](https://www.sqlbi.com/articles/introducing-the-3-30-300-rule-for-better-reports/) -- report design principles (3 visuals, 30 seconds, 300px)
- [Data Goblins: Report Checklist](https://data-goblins.com/report-checklist) -- comprehensive pre-deployment checklist (layout, accessibility, testing, UX, handover, documentation, training)
- [Data Goblins: Report Requirements](https://data-goblins.com/power-bi/report-requirements) -- gathering requirements before building
- [Data Goblins: Solving Problems with Power BI](https://data-goblins.com/power-bi/solving-problems) -- framing reports around business problems, not data

## mobile.json

Each visual folder can optionally contain a `mobile.json` file alongside `visual.json`. It defines the visual's position and formatting overrides for mobile layout. Structure mirrors `visual.json` position fields but with mobile-specific coordinates.

**Location:** `definition/pages/[PageName]/visuals/[VisualName]/mobile.json`

Mobile layout is configured in PBI Desktop's mobile view. External editing is supported but rarely needed.
