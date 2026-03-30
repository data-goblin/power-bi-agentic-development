# listSlicer (List Slicer)

New-generation list slicer visual with card-style item rendering; shares the same container structure as `advancedSlicerVisual`, not the classic `slicer`.

## Containers

| Container | Key Properties |
|-----------|----------------|
| `label` | `show`, `fontSize`, `fontFamily`, `fontColor`, `bold`, `italic`, `horizontalAlignment`, `position`, `textWrap` |
| `value` | `show`, `fontSize`, `fontFamily`, `fontColor`, `bold`, `italic`, `horizontalAlignment`, `labelDisplayUnits`, `labelPrecision` |
| `layout` | Card layout controls (57 properties) |
| `selection` | `singleSelect`, `selectAllCheckboxEnabled` |
| `selectionIcon` | Icon shown for selected state (11 properties) |
| `expansionIcon` | Expand/collapse icon for hierarchies (7 properties) |
| `accentBar` | Accent bar styling (6 properties) |
| `outline` | Card outline (5 properties) |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "listSlicer": {
      "*": {
        "label": [
          {
            "show": true,
            "fontSize": 11,
            "fontFamily": "Segoe UI Semibold",
            "fontColor": { "solid": { "color": "#252423" } },
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

- Despite the name, `listSlicer` is NOT the same as the classic `slicer` — it has no `items` or `header` containers.
- Uses `fontSize` (not `textSize`) in `label` and `value`, same as `advancedSlicerVisual`.
- Adds an `expansionIcon` container (absent in `advancedSlicerVisual`) for hierarchical list expansion control.
