# reportExtensions.json

Report-level DAX measures and visual calculation placeholders.

**File location:** `<report>.Report/definition/reportExtensions.json`

**Schema:** `reportExtension/1.0.0`

## Two types of DAX in reports

| Type | Defined in | Scope | Reference |
|------|-----------|-------|-----------|
| **Extension measures** | `reportExtensions.json` | All visuals in report | [measures.md](./measures.md) |
| **Visual calculations** | Inline in `visual.json` | Single visual only | [visual-calculations.md](./schema-patterns/visual-calculations.md) |

## Extension Measures

See [measures.md](./measures.md) for complete documentation including:
- File structure and schema
- Measure properties (name, dataType, expression, references, formatString, etc.)
- Referencing in visuals (`Schema: "extension"`)
- Cross-extension references
- Multiple entity groups
- When to use extension vs model measures
- Common patterns (conditional formatting, time intelligence)

## Visual Calculation Placeholders

When visual calculations are used, Power BI creates placeholder entries in `reportExtensions.json`:

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

These are **not functional measures** -- they are metadata artifacts. The actual calculation is defined inline in the visual using `NativeVisualCalculation`. See [visual-calculations.md](./schema-patterns/visual-calculations.md) for the inline structure and patterns.

## Common Patterns

### Conditional formatting with extension measures

```json
{
  "name": "Bar Color",
  "dataType": "Text",
  "expression": "IF([Budget vs. Turnover (%)] < 0, \"#D64554\", \"#118DFF\")",
  "references": {
    "measures": [{"entity": "Budget", "name": "Budget vs. Turnover (%)"}]
  }
}
```

### Text styling measures

```json
{"name": "Font Weight", "dataType": "Text", "expression": "IF([Value] < 10, \"'bold'\", \"'normal'\")"},
{"name": "Font Style", "dataType": "Text", "expression": "IF([Value] >= 10 && [Value] < 20, \"'italic'\", \"'normal'\")"},
{"name": "Text Decoration", "dataType": "Text", "expression": "IF([Value] >= 20, \"'underline'\", \"'none'\")"}
```

Apply each to respective formatting properties: `fontWeight`, `fontStyle`, `textDecoration`.

## Related

- [measures.md](./measures.md) - Extension measure deep-dive
- [schema-patterns/visual-calculations.md](./schema-patterns/visual-calculations.md) - Visual calculation patterns
- [schema-patterns/conditional-formatting.md](./schema-patterns/conditional-formatting.md) - Conditional formatting with measures
