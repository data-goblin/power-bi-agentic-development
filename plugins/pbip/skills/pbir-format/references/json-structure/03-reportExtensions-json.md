# reportExtensions.json

Report-level DAX measures (extension measures). Used for conditional formatting and calculated fields not in the semantic model.

## Location

`Report.Report/definition/reportExtensions.json`

## Structure

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/reportExtension/1.0.0/schema.json",
  "name": "extension",
  "entities": [
    {
      "name": "_Formatting",
      "measures": [
        {
          "name": "BarColor",
          "dataType": "Text",
          "expression": "IF([Sales] > [Target], \"good\", \"bad\")"
        }
      ]
    }
  ]
}
```

## Measure Properties

| Property | Required | Description |
|----------|----------|-------------|
| name | Yes | Measure name |
| dataType | Yes | `Text`, `Integer`, `Double` |
| expression | Yes | DAX expression |
| description | No | Documentation |
| formatString | No | Display format |

## Referencing in Visuals

Extension measures require `Schema: "extension"` in SourceRef:

```json
"expr": {
  "Measure": {
    "Expression": {
      "SourceRef": {
        "Schema": "extension",
        "Entity": "_Formatting"
      }
    },
    "Property": "BarColor"
  }
}
```

**Common mistake:** Omitting `Schema` field - measure won't be found.

## Common Patterns

### Conditional Color (theme names)

```json
{
  "name": "BarColor",
  "dataType": "Text",
  "expression": "IF([Sales] > [Target], \"good\", \"bad\")"
}
```

Theme names: `"good"`, `"bad"`, `"neutral"`, `"minColor"`, `"maxColor"`

### Conditional Color (hex)

```json
{
  "name": "LineColor",
  "dataType": "Text",
  "expression": "IF([Variance] < 0, \"#D64550\", \"#118DFF\")"
}
```

### Numeric for Gradient

```json
{
  "name": "GradientValue",
  "dataType": "Double",
  "expression": "DIVIDE([Actual], [Target], 0)"
}
```

Returns 0-1 value for use with `FillRule.linearGradient2`.

## Extension Measures vs Visual Calculations

| Aspect | Extension Measures | Visual Calculations |
|--------|-------------------|---------------------|
| Defined | reportExtensions.json | Inline in visual.json |
| Scope | All visuals | Single visual |
| Functions | Standard DAX | RUNNINGSUM, LAST, ROWS, etc. |
| Reference | `Schema: "extension"` | `NativeVisualCalculation` |

## Search

```bash
# Find all extension measures
grep -A5 '"measures"' Report.Report/definition/reportExtensions.json

# Find usage in visuals
grep -r '"Schema": "extension"' Report.Report/
```
