# reportExtensions.json

Report-level DAX measures (extension measures). Used for conditional formatting, calculated fields, and formatting logic not in the semantic model.

## Location

`Report.Report/definition/reportExtensions.json` (optional file)

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
          "name": "Bar Color",
          "dataType": "Text",
          "expression": "IF([Sales] > [Target], \"#118DFF\", \"#D64550\")",
          "formatString": "#,##0.00",
          "displayFolder": "Colors",
          "description": "Returns hex color based on sales vs target",
          "references": {
            "measures": [
              {"entity": "Sales", "name": "Sales"},
              {"entity": "Sales", "name": "Target"}
            ]
          }
        }
      ]
    }
  ]
}
```

**Critical:** If no extension measures exist, DELETE this file entirely. An empty `"entities": []` causes Power BI Desktop to fail during deserialization.

## Measure Properties

| Property | Required | Description |
|----------|----------|-------------|
| name | Yes | Unique across semantic model AND other extensions |
| dataType | Yes | `Text`, `Integer`, `Double`, `Boolean`, `Date`, `DateTime` |
| expression | Yes | DAX expression |
| references | Yes* | Must list ALL measures referenced in the DAX expression |
| formatString | No | VBA format string (e.g. `"#,##0.00"`, `"0.00%;-0.00%;0.00%"`) |
| displayFolder | No | Display folder path |
| description | No | Documentation string |
| hidden | No | Boolean to hide measure from field list |
| annotations | No | Name-value pairs for metadata |

*`references` is technically optional but should always be provided. Use `{"unrecognizedReferences": true}` for broken/placeholder measures only.

## References Block

The `references.measures` array must list every measure referenced in the DAX expression:

```json
"references": {
  "measures": [
    {"entity": "Sales", "name": "Revenue"},
    {"entity": "Sales", "name": "Target"}
  ]
}
```

Cross-references to OTHER extension measures require `"schema": "extension"`:

```json
"references": {
  "measures": [
    {"entity": "Sales", "name": "Revenue"},
    {"schema": "extension", "entity": "_Formatting", "name": "Other Extension Measure"}
  ]
}
```

Self-entity references do NOT need `schema`.

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
    "Property": "Bar Color"
  }
}
```

**Common mistake:** Omitting `Schema` field -- the measure won't be found.

## Common Patterns

### Conditional Color (hex)

```json
{
  "name": "Bar Color",
  "dataType": "Text",
  "expression": "IF([Variance] < 0, \"#D64550\", \"#118DFF\")",
  "references": {
    "measures": [{"entity": "Comparison", "name": "Variance"}]
  }
}
```

### Numeric for Gradient

```json
{
  "name": "Gradient Value",
  "dataType": "Double",
  "expression": "DIVIDE([Actual], [Target], 0)",
  "references": {
    "measures": [
      {"entity": "Sales", "name": "Actual"},
      {"entity": "Sales", "name": "Target"}
    ]
  }
}
```

Returns 0-1 value for use with `FillRule.linearGradient2`.

### Multiple Entities

A single report can have multiple entity groups:

```json
"entities": [
  {
    "name": "_Formatting",
    "measures": [...]
  },
  {
    "name": "_KPIs",
    "measures": [...]
  }
]
```

## Extension Measures vs Visual Calculations

| Aspect | Extension Measures | Visual Calculations |
|--------|-------------------|---------------------|
| Defined in | reportExtensions.json | Inline in visual.json |
| Scope | All visuals in report | Single visual |
| DAX functions | Standard DAX | RUNNINGSUM, LAST, ROWS, etc. |
| Reference syntax | `Schema: "extension"` | `NativeVisualCalculation` |
