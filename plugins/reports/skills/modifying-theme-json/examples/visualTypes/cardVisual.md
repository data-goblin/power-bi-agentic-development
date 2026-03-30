# cardVisual (Multi-row Card — New Card Visual)

The modern card visual (introduced in 2023) that replaces the legacy `card`. Supports multiple fields, reference labels, images, and rich layout options.

## Containers

| Container | Key Properties |
|-----------|---------------|
| `value` | `fontColor`, `fontFamily`, `fontSize`, `show`, `bold`, `horizontalAlignment`, `labelDisplayUnits`, `labelPrecision` |
| `label` | `fontColor`, `fontFamily`, `fontSize`, `show`, `bold`, `horizontalAlignment`, `position` |
| `cardCalloutArea` | `show`, `backgroundFillColor`, `backgroundTransparency`, `rectangleRoundedCurve`, `paddingUniform` |
| `title` | `show`, `text`, `fontColor`, `fontFamily`, `fontSize` |
| `background` | `show`, `color`, `transparency` |
| `border` | `show` |
| `dropShadow` | `show` |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "cardVisual": {
      "*": {
        "value": [{
          "fontFamily": "Segoe UI Semibold",
          "fontSize": 28,
          "horizontalAlignment": "center",
          "labelDisplayUnits": 0
        }],
        "label": [{
          "show": true,
          "fontFamily": "Segoe UI",
          "fontSize": 11,
          "position": "belowValue"
        }],
        "cardCalloutArea": [{ "show": true, "rectangleRoundedCurve": 4 }],
        "title": [{ "show": false }],
        "background": [{ "show": false }],
        "border": [{ "show": false }],
        "dropShadow": [{ "show": false }]
      }
    }
  }
}
```

## Notes

- `value.fontColor` and `label.fontColor` use `fontColor` (not `color`) — the opposite convention from the legacy `card` visual.
- `label.position` accepts `"belowValue"` or `"aboveValue"`, controlling where the field label appears relative to the number.
- `cardVisual` is the type name used in Power BI's theme JSON even though the visual is marketed as the "New Card"; do not confuse it with `multiRowCard`, which is a separate legacy visual.
