# Visual Calculations

Visual calculations (also called "native visual calculations") are DAX expressions evaluated in the visual's data context. They allow per-point calculations using windowing functions without modifying the semantic model.

## Structure

Visual calculations appear in `query.queryState` projections as `NativeVisualCalculation` fields:

```json
{
  "field": {
    "NativeVisualCalculation": {
      "Language": "dax",
      "Expression": "\nVAR _Measure = [Order Lines]\nRETURN\nIF ( _Measure = LAST ( [Order Lines], ROWS ), [Order Lines] )",
      "Name": "Latest Period"
    }
  },
  "queryRef": "select",
  "nativeQueryRef": "Latest Period"
}
```

**Key fields:**
- `Language`: Always `"dax"`
- `Expression`: DAX code with access to visual window functions
- `Name`: Display name in legend/labels
- `queryRef`: Usually `"select"` for visual calcs
- `nativeQueryRef`: Matches `Name`

## Window Functions

Visual calculations have access to windowing functions not available in model measures:

**ROWS**: Current row set
**FIRST()**: First value in window
**LAST()**: Last value in window
**INDEX()**: Current row position
**OFFSET()**: Value N rows away

## Common Patterns

### Latest Data Point Only

Shows value only for the final point, BLANK elsewhere:

```dax
VAR _Measure = [Order Lines]
RETURN
IF ( _Measure = LAST ( [Order Lines], ROWS ), [Order Lines] )
```

**Use case**: Add labels/markers only to the most recent point while keeping the full line clean.

**Selector targeting**: `"metadata": "select"` targets this visual calc series.

### Running Total

Visual calculations use dedicated window functions — `ROWS` is an axis keyword, not a filterable table. `EARLIER()` has no meaning in visual calculation context.

```dax
RUNNINGSUM ( [Revenue] )
```

### Moving Average

```dax
MOVINGAVERAGE ( [Sales], 3 )
```

The second argument is the window size (number of periods to average over).

## Multi-Series Configuration

Visual calculations create separate series in the visual. You can:

1. Hide the base measure labels: `selector: {metadata: "Orders.Order Lines"}`
2. Show visual calc labels only: `selector: {metadata: "select"}`
3. Format each series differently

**Example - dual series pattern**:

```json
"Y": {
  "projections": [
    {"field": {"Measure": {...}, "Property": "Order Lines"}},
    {
      "field": {
        "NativeVisualCalculation": {
          "Expression": "IF([Order Lines] = LAST([Order Lines], ROWS), [Order Lines])",
          "Name": "Latest Period"
        }
      },
      "queryRef": "select"
    }
  ]
}
```

Then in `lineStyles`:

```json
[
  {"properties": {"showMarker": {"expr": {"Literal": {"Value": "false"}}}}},
  {
    "properties": {"showMarker": {"expr": {"Literal": {"Value": "true"}}}},
    "selector": {"metadata": "select"}
  }
]
```

Result: Full line without markers, plus marker at latest point.

## Integration with Extension Measures

Visual calcs can reference extension measures but **cannot be used in conditional formatting selectors** - they create separate series, not per-point evaluations.

For per-point conditional formatting, use `dataViewWildcard` with extension measures instead.

## Metadata Selector Targeting

**Base measures**: `"metadata": "EntityName.MeasureName"`
**Visual calculations**: `"metadata": "select"`

This allows independent formatting of:
- `labels` - Show/hide per series
- `lineStyles` - Markers, line type
- `dataPoint` - Colors
- `markers` - Border styles

## Limitations

1. **No model changes**: Visual calcs don't modify the semantic model
2. **queryRef always "select"**: Makes targeting less granular with multiple visual calcs
3. **Limited DAX context**: Some time intelligence functions may not work as expected
4. **Performance**: Calculated in the visual layer, not optimized by engine

## Related

- [expressions.md](expressions.md) - Measure expression syntax
- [selectors.md](selectors.md) - Metadata selector patterns
- Visual catalog - not yet available
