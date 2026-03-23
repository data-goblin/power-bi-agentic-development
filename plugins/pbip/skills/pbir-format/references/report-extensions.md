# Report Extensions

Documentation for reportExtensions.json - report-level DAX measures and visual calculations.

## Overview

The `reportExtensions.json` file defines DAX objects at the report level, separate from the semantic model. These are commonly called "extension measures" or "user DAX" and can be:

- **Report measures** - Standard DAX measures available across all visuals
- **Visual calculations** - Placeholder entries for calculations defined inline in visuals

**File location:** `<report>.Report/definition/reportExtensions.json`

## Report Measures

Report measures are DAX expressions defined in reportExtensions.json that can be referenced in any visual.

### Structure

```json
{
  "entities": [
    {
      "name": "TableName",
      "measures": [
        {
          "name": "Measure Name",
          "dataType": "Integer|Double|Text",
          "expression": "<DAX expression>",
          "description": "Optional description",
          "formatString": "Optional format string",
          "references": {
            "measures": [
              {
                "entity": "SourceTable",
                "name": "SourceMeasure"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

### Common use cases

**1. Time intelligence calculations:**

```json
{
  "name": "Order Lines (PY)",
  "dataType": "Integer",
  "expression": "CALCULATE([Order Lines], SAMEPERIODLASTYEAR('Date'[Date]))",
  "description": "Prior year Order Lines using SAMEPERIODLASTYEAR"
}
```

**2. Conditional formatting (color):**

```json
{
  "name": "Formatting",
  "dataType": "Text",
  "expression": "IF([Budget vs. Turnover (%)] < 0, \"#D64554\", \"#118DFF\")",
  "description": "Returns red for negative, blue for positive"
}
```

**3. Conditional formatting (text style):**

```json
{
  "name": "Order Lines Font Weight",
  "dataType": "Text",
  "expression": "IF([Order Lines] < 10, \"'bold'\", \"'normal'\")",
  "description": "Returns 'bold' for Order Lines < 10"
}
```

### Referencing in visuals

**Data roles (Y-axis, Values, etc.):**

```json
{
  "field": {
    "Measure": {
      "Expression": {
        "SourceRef": {
          "Schema": "extension",
          "Entity": "Orders"
        }
      },
      "Property": "Order Lines (PY)"
    }
  }
}
```

**Conditional formatting:**

```json
{
  "properties": {
    "fill": {
      "solid": {
        "color": {
          "expr": {
            "Measure": {
              "Expression": {
                "SourceRef": {
                  "Schema": "extension",
                  "Entity": "_Demo of SVG Measures"
                }
              },
              "Property": "Formatting"
            }
          }
        }
      }
    }
  },
  "selector": {
    "data": [{
      "dataViewWildcard": {
        "matchingOption": 1
      }
    }]
  }
}
```

Key: `"Schema": "extension"` identifies the measure as coming from reportExtensions.json.

## Visual Calculations

Visual calculations are DAX expressions that operate on the visual's query result, not the underlying data model. They're defined inline within visuals using `NativeVisualCalculation`.

### Structure (inline in visual.json)

```json
{
  "field": {
    "NativeVisualCalculation": {
      "Language": "dax",
      "Expression": "<DAX expression using visual-level functions>",
      "Name": "Calculation Name"
    }
  },
  "queryRef": "select",
  "nativeQueryRef": "Calculation Name"
}
```

### Common patterns

**1. Latest period value:**

```dax
VAR _Measure = [Order Lines]
RETURN
IF ( _Measure = LAST ( [Order Lines], ROWS ), [Order Lines] )
```

Returns the measure value only for the last row in the visual, blank otherwise.

**2. Latest period label:**

```dax
VAR _Measure = [Order Lines]
RETURN
IF ( _Measure = LAST ( [Order Lines], ROWS ),
     SWITCH ( TRUE(),
         ISATLEVEL ( [Date Hierarchy Calendar Month (ie Jan)] ),
             SELECTEDVALUE ( [Date Hierarchy Calendar Month (ie Jan)] ),
         ISATLEVEL ( [Date Hierarchy Calendar Week EU (ie WK25)] ),
             SELECTEDVALUE ( [Date Hierarchy Calendar Week EU (ie WK25)] ),
         BLANK()
     ),
     BLANK()
)
```

Returns the period name (month or week) for the last row, adapting to the active hierarchy level.

**3. Running total:**

```dax
RUNNINGSUM([Measure])
```

Calculates cumulative sum across the visual rows.

**4. Moving average:**

```dax
MOVINGAVERAGE([Measure], 3)
```

### Visual calculation functions

Visual calculations have access to special DAX functions:

- `LAST()`, `FIRST()` - Get first/last value in partition
- `ROWS`, `COLUMNS` - Define window/partition
- `RUNNINGSUM()`, `RUNNINGAVERAGE()` - Cumulative calculations
- `MOVINGAVERAGE()`, `MOVINGSUM()` - Window functions
- `ISATLEVEL()` - Check active hierarchy level
- `SELECTEDVALUE()` - Get value at current level

### Placeholder entries in reportExtensions.json

When visual calculations are used, you may see placeholder entries like:

```json
{
  "name": "Order Lines (Latest Month)",
  "dataType": "Double",
  "expression": "",
  "formatString": "General Number",
  "references": {
    "unrecognizedReferences": true
  }
}
```

These are **not** functional measures - they're metadata artifacts. The actual visual calculation is defined inline in the visual using `NativeVisualCalculation`.

## Differences: Report Measures vs Visual Calculations

| Aspect | Report Measures | Visual Calculations |
|--------|----------------|---------------------|
| **Defined** | reportExtensions.json | Inline in visual.json |
| **Scope** | Available to all visuals | Specific to one visual |
| **Execution** | Against data model | Against visual query result |
| **Functions** | Standard DAX | Visual calculation functions (RUNNINGSUM, etc.) |
| **Reference** | `Schema: "extension"` | `NativeVisualCalculation` |
| **Use case** | Time intelligence, conditional formatting | Running totals, moving averages, latest values |

## Best Practices

### Report measures

1. **Minimize usage** - Prefer model measures when possible
2. **Use for cross-cutting concerns** - Time intelligence, conditional formatting
3. **Reference theme colors** - Don't hardcode hex values, use theme-defined colors
4. **Add descriptions** - Document what each measure does
5. **Organize by entity** - Group related measures under logical entity names

### Visual calculations

1. **Use inline** - Don't try to define in reportExtensions.json
2. **Keep simple** - Complex logic better suited for model measures
3. **Document in visual** - Add comments explaining the calculation
4. **Test hierarchy behavior** - Ensure calculations work at all drill levels
5. **Handle blanks** - Return BLANK() for non-applicable rows

## Common Patterns

### Conditional formatting with theme colors

```json
{
  "name": "Budget Status Color",
  "dataType": "Text",
  "expression": "IF([Budget vs. Turnover (%)] < 0, \"#D64554\", \"#118DFF\")",
  "description": "Red (#D64554 = theme 'bad') for negative, blue (#118DFF = theme dataColors[0]) for positive"
}
```

### Latest period marker with label

Combine two visual calculations:

**Calculation 1 - Latest value:**

```dax
IF ( [Order Lines] = LAST ( [Order Lines], ROWS ), [Order Lines] )
```

**Calculation 2 - Latest label:**

```dax
IF ( [Order Lines] = LAST ( [Order Lines], ROWS ),
     SELECTEDVALUE ( [Period Name] ),
     BLANK()
)
```

Use the label calculation in data labels with `dynamicLabelTitle`.

### Text styling with multiple measures

```json
{
  "name": "Font Weight",
  "expression": "IF([Value] < 10, \"'bold'\", \"'normal'\")"
},
{
  "name": "Font Style",
  "expression": "IF([Value] >= 10 && [Value] < 20, \"'italic'\", \"'normal'\")"
},
{
  "name": "Text Decoration",
  "expression": "IF([Value] >= 20, \"'underline'\", \"'none'\")"
}
```

Apply each to respective formatting properties: `fontWeight`, `fontStyle`, `textDecoration`.

## See Also

- [extension-measures.md](./extension-measures.md) - Detailed extension measure documentation
- [conditional-formatting.md](./schema-patterns/conditional-formatting.md) - Using measures for dynamic formatting
- [visual-calculations.md](./schema-patterns/visual-calculations.md) - Visual calculation patterns
