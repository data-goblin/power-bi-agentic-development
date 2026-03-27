# slicer (Slicer)

List-style slicer for filtering by discrete field values; supports list, dropdown, and tile display modes.

## Containers

| Container | Key Properties |
|-----------|----------------|
| `items` | `textSize` (NOT `fontSize`), `fontFamily`, `fontColor`, `bold`, `italic`, `underline`, `background`, `padding` |
| `header` | `show`, `textSize` (NOT `fontSize`), `fontFamily`, `fontColor`, `bold`, `italic`, `showRestatement`, `text` |
| `searchBox` | `background`, `borderColor`, `outlineStyle` |
| `selection` | `singleSelect`, `selectAllCheckboxEnabled`, `strictSingleSelect` |
| `data` | Numeric/date range controls (10 properties) |
| `slider` | Range slider styling (5 properties) |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "slicer": {
      "*": {
        "items": [
          {
            "textSize": 11,
            "fontFamily": "Segoe UI",
            "fontColor": { "solid": { "color": "#252423" } },
            "bold": false,
            "padding": 4
          }
        ],
        "header": [
          {
            "show": true,
            "textSize": 11,
            "fontFamily": "Segoe UI Semibold",
            "fontColor": { "solid": { "color": "#252423" } },
            "showRestatement": true
          }
        ],
        "searchBox": [
          {
            "borderColor": { "solid": { "color": "#D1D1D1" } }
          }
        ]
      }
    }
  }
}
```

## Notes

- Both `items` and `header` use `textSize`, not `fontSize` — using `fontSize` is silently ignored.
- `fontColor` is an object `{ "solid": { "color": "#hex" } }`, not a plain string.
- The `searchBox` container styles the hover/focus search input that appears when search is enabled on the slicer; it has no font controls.
