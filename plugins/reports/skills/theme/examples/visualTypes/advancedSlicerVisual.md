# advancedSlicerVisual (Advanced Slicer)

Card-style slicer that displays items as styled cards with a separate label and value; structurally distinct from the classic `slicer` visual.

## Containers

| Container | Key Properties |
|-----------|----------------|
| `label` | `show`, `fontSize`, `fontFamily`, `fontColor`, `bold`, `italic`, `horizontalAlignment`, `position`, `textWrap` |
| `value` | `show`, `fontSize`, `fontFamily`, `fontColor`, `bold`, `italic`, `horizontalAlignment`, `labelDisplayUnits`, `labelPrecision` |
| `layout` | Card layout controls (54 properties) |
| `selection` | `singleSelect`, `selectAllCheckboxEnabled`, `behavior` |
| `selectionIcon` | Icon shown for selected state (11 properties) |
| `accentBar` | Accent bar styling (6 properties) |
| `outline` | Card outline (5 properties) |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "advancedSlicerVisual": {
      "*": {
        "label": [
          {
            "show": true,
            "fontSize": 11,
            "fontFamily": "Segoe UI Semibold",
            "fontColor": { "solid": { "color": "#252423" } },
            "bold": false,
            "horizontalAlignment": "left"
          }
        ],
        "value": [
          {
            "show": true,
            "fontSize": 13,
            "fontFamily": "Segoe UI",
            "fontColor": { "solid": { "color": "#252423" } },
            "horizontalAlignment": "left",
            "labelDisplayUnits": 0
          }
        ]
      }
    }
  }
}
```

## Notes

- Has no `items` or `header` containers — those belong to the classic `slicer` type; applying them here has no effect.
- Uses `fontSize` (not `textSize`) in both `label` and `value`.
- `label` supports a `position` property (`belowValue` / `aboveValue`) that controls whether the label renders above or below the value within each card.
