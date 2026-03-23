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
    "filterConfig": {},
    "drillFilterOtherVisuals": true
  }
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
| DateTime | `{"expr": {"Literal": {"Value": "datetime'2024-01-15T00:00:00.000000"}}}` | Single-quoted datetime string |
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

**Aggregation function codes:** 0=SUM, 1=AVG, 2=COUNT, 3=MIN, 4=MAX, 5=DISTINCTCOUNT

## Query Roles by Visual Type

| Visual Type | Query Roles |
|-------------|-------------|
| card | Values |
| cardVisual (new card) | Data |
| tableEx | Values |
| slicer | Values |
| advancedSlicerVisual | Values |
| pieChart | Category, Y |
| lineChart | Category, Y (also Y2 for combo) |
| areaChart / stackedAreaChart | Category, Y |
| clusteredBarChart | Category, Y |
| clusteredColumnChart | Category, Y |
| pivotTable | Rows, Columns, Values |
| kpi | Indicator, Goal, Goals, TrendLine |
| scatterChart | Category, X, Y, Size, Tooltips |
| textbox | (none -- uses objects.general.paragraphs) |
| shape / actionButton | (none -- uses objects for shape/icon config) |
| scriptVisual | Values |

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

matchingOption: `0` = identities + totals, `1` = per data point, `2` = totals only. Selectors can be combined.

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

```json
"filterConfig": {
  "filters": [{
    "name": "e7466b66be105b916228",
    "field": {"Column": {"Expression": {"SourceRef": {"Entity": "Date"}}, "Property": "Month"}},
    "type": "Categorical"
  }]
}
```

Filter types: `"Categorical"`, `"Advanced"`. See [filter-pane.md](./filter-pane.md) for all filter types and patterns.

## Related

- [visual-container-formatting.md](./visual-container-formatting.md) -- objects vs visualContainerObjects
- [schema-patterns/expressions.md](./schema-patterns/expressions.md) -- Full expression type reference
- [schema-patterns/selectors.md](./schema-patterns/selectors.md) -- Selector deep-dive
- [schema-patterns/conditional-formatting.md](./schema-patterns/conditional-formatting.md) -- Conditional formatting patterns
- [sort-visuals.md](./sort-visuals.md) -- Sort configuration
- [filter-pane.md](./filter-pane.md) -- Filter types and default values
- [textbox.md](./textbox.md) -- Textbox-specific patterns
