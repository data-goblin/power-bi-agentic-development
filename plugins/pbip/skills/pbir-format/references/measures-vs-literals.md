# Using Measures vs Literals in Visual Properties

## Overview

Power BI visual properties can use different expression types in the \`expr\` field. Understanding when to use measures vs literals enables dynamic, data-driven formatting.

## Expression Types

### 1. Literal Values

Fixed, static values defined in the visual JSON.

**Syntax:**
```json
"expr": {
  "Literal": {
    "Value": "<value>"
  }
}
```

**Examples:**
```json
// Color
"expr": {"Literal": {"Value": "'#FF0000'"}}

// Boolean
"expr": {"Literal": {"Value": "true"}}

// Number (with D suffix for decimal)
"expr": {"Literal": {"Value": "50D"}}

// String (with single quotes)
"expr": {"Literal": {"Value": "'smooth'"}}
```

**Use when:**
- Value never changes
- No conditional logic needed
- Simple static configuration

### 2. Theme Data Colors

References colors from the Power BI theme.

**Syntax:**
```json
"expr": {
  "ThemeDataColor": {
    "ColorId": <number>,
    "Percent": <number>
  }
}
```

**Example:**
```json
"expr": {
  "ThemeDataColor": {
    "ColorId": 1,   // Theme color index (0-based)
    "Percent": 0
  }
}
```

**Parameters:**
- `ColorId`: Index into theme's dataColors array (0-based)
- `Percent`: Tint/shade (-1.0 to 1.0; negative = darker, positive = lighter, 0 = exact)

**Use when:**
- Want theme consistency
- Colors should change with theme
- No conditional logic needed

### 3. Measure Expressions

Dynamic values from DAX measures.

**Syntax:**
```json
"expr": {
  "Measure": {
    "Expression": {
      "SourceRef": {
        "Schema": "extension",  // Only for extension (report-level) measures defined in reportExtensions.json
        "Entity": "<EntityName>"
      }
    },
    "Property": "<MeasureName>"
  }
}
```

**Use when:**
- Value depends on data
- Conditional formatting needed
- Dynamic calculation required

## Extension Measures vs Model Measures

### Extension Measures (Report-Level Measures)

Defined in `reportExtensions.json`, scoped to the report only. Extension measures exist in both thick and thin PBIR reports — the distinction is between report-level DAX (extension) and model-level DAX (model measures), not between report connection types.

**Definition in reportExtensions.json:**
```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/reportExtension/1.0.0/schema.json",
  "name": "extension",
  "entities": [
    {
      "name": "_Formatting Measures",
      "measures": [
        {
          "name": "LineColor",
          "dataType": "Text",
          "expression": "IF([Value] < 0, \"#D64550\", \"#118DFF\")"
        }
      ]
    }
  ]
}
```

**Reference in visual:**
```json
"expr": {
  "Measure": {
    "Expression": {
      "SourceRef": {
        "Schema": "extension",  // ← Required for extension measures
        "Entity": "_Formatting Measures"
      }
    },
    "Property": "LineColor"
  }
}
```

**Advantages:**
- Lightweight, no semantic model changes needed
- Self-contained in report
- Easy to version control with report
- Can reference model measures

**Disadvantages:**
- Only available in this report
- Not reusable across reports
- Doesn't appear in model for other tools

**Use when:**
- Measure is formatting-specific
- Don't want to modify semantic model
- Rapid prototyping/testing

### Model Measures

Defined in the semantic model, available to all reports.

**Reference in visual:**
```json
"expr": {
  "Measure": {
    "Expression": {
      "SourceRef": {
        "Entity": "Sales"  // ← No "Schema" for model measures
      }
    },
    "Property": "Total Revenue"
  }
}
```

**Advantages:**
- Reusable across all reports
- Centralized logic in model
- Visible in all BI tools (Excel, etc.)
- Better for core business metrics

**Disadvantages:**
- Requires model edit permissions
- Model refresh needed after changes
- More ceremony to add/modify

**Use when:**
- Measure is a core business metric
- Needs to be reused across reports
- Should be available in other tools

## Common Patterns

### Conditional Color Based on Value

**Extension measure:**
```json
{
  "name": "StatusColor",
  "dataType": "Text",
  "expression": "
    SWITCH(
      TRUE(),
      [Value] < 0, \"#D64550\",     // Red
      [Value] < 0.5, \"#FFA500\",   // Orange
      \"#4CAF50\"                    // Green
    )
  "
}
```

**In visual:**
```json
"strokeColor": {
  "solid": {
    "color": {
      "expr": {
        "Measure": {
          "Expression": {
            "SourceRef": {
              "Schema": "extension",
              "Entity": "_Formatting"
            }
          },
          "Property": "StatusColor"
        }
      }
    }
  }
}
```

### Converting Literal to Measure

**Before (static):**
```json
"strokeColor": {
  "solid": {
    "color": {
      "expr": {
        "Literal": {
          "Value": "'#118DFF'"
        }
      }
    }
  }
}
```

**After (dynamic):**
```json
"strokeColor": {
  "solid": {
    "color": {
      "expr": {
        "Measure": {
          "Expression": {
            "SourceRef": {
              "Schema": "extension",
              "Entity": "_Formatting"
            }
          },
          "Property": "DynamicColor"
        }
      }
    }
  }
}
```

### Using Model Measure for Value, Extension for Formatting

```json
{
  "entities": [
    {
      "name": "_Formatting",
      "measures": [
        {
          "name": "RevenueColor",
          "dataType": "Text",
          "expression": "
            IF(
              [Total Revenue] > [Target Revenue],
              \"#4CAF50\",
              \"#D64550\"
            )
          ",
          "references": {
            "measures": [
              {
                "entity": "Sales",
                "name": "Total Revenue"
              },
              {
                "entity": "Targets",
                "name": "Target Revenue"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

## Data Type Requirements

When creating extension measures for formatting:

**Colors:**
- dataType: \`"Text"\`
- Return hex codes: \`"#RRGGBB"\`
- Cannot use color names

**Sizes/Transparency:**
- dataType: \`"Int64"\` or \`"Double"\`
- Return numeric values
- Visual converts to appropriate format

**Boolean properties:**
- dataType: \`"Boolean"\`
- Return \`TRUE()\` or \`FALSE()\`

## Selector Considerations

Measures work with different selectors:

**metadata selector:**
```json
"selector": {
  "metadata": "Sales.Revenue"
}
```
- Targets a specific named field (measure or column) by its `queryRef` string
- Applies formatting to the series or column matching that exact queryRef
- Does not evaluate per data point — all points in that series share the same formatting
- Distinct from no-selector (which applies to the entire visual)

**dataViewWildcard selector:**
```json
"selector": {
  "data": [{
    "dataViewWildcard": {"matchingOption": 1}
  }]
}
```
- Evaluates measure per data point
- Enables conditional per-category formatting

**scopeId selector:**
- Does NOT work with measure expressions for strokeColor
- Only accepts literal values
- Use for static per-category overrides

## Best Practices

1. **Use extension measures for formatting logic**
   - Keeps model clean
   - Easy to test and modify

2. **Reference model measures for business logic**
   - Don't duplicate calculations
   - Maintain single source of truth

3. **Keep extension measures simple**
   - Complex DAX impacts rendering performance
   - Consider pre-calculating in model if expensive

4. **Document measure purpose**
   - Add comments in DAX
   - Use descriptive names (\`_Formatting.LineColor\`)

5. **Prefix extension entities**
   - Use \`_\` prefix to distinguish from model tables
   - Example: \`_Formatting Measures\`, \`_Chart Helpers\`

## Troubleshooting

**Measure not found:**
- Check spelling of Entity and Property names
- Verify \`"Schema": "extension"\` for extension measures
- Ensure reportExtensions.json is valid

**Measure not evaluating:**
- Wrong selector type (use dataViewWildcard)
- Measure returns wrong data type
- Measure has DAX errors (check in visual)

**Performance issues:**
- Measure too complex
- Evaluates expensive calculations
- Consider calculated column in model instead
