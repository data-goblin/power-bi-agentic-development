# tableEx (Table)

Standard tabular data visual with alternating row support and configurable grid lines.

## Containers

| Container | Key Properties |
|-----------|---------------|
| `columnHeaders` | `backColor`, `fontColor`, `fontSize`, `fontFamily`, `outlineColor`, `outlineStyle`, `outlineWeight` |
| `values` | `backColorPrimary`, `backColorSecondary`, `fontColorPrimary`, `fontColorSecondary`, `fontSize`, `fontFamily` |
| `total` | `backColor`, `fontColor`, `fontSize`, `fontFamily`, `totals` |
| `grid` | `gridHorizontal`, `gridHorizontalColor`, `gridHorizontalWeight`, `gridVertical`, `gridVerticalColor`, `gridVerticalWeight` |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "tableEx": {
      "*": {
        "columnHeaders": [
          {
            "backColor": { "solid": { "color": "#252423" } },
            "fontColor": { "solid": { "color": "#FFFFFF" } },
            "fontSize": 11,
            "fontFamily": "Segoe UI Semibold",
            "outlineColor": { "solid": { "color": "#3B3A39" } },
            "outlineStyle": 2,
            "outlineWeight": 1
          }
        ],
        "values": [
          {
            "backColorPrimary": { "solid": { "color": "#FFFFFF" } },
            "backColorSecondary": { "solid": { "color": "#F3F2F1" } },
            "fontColorPrimary": { "solid": { "color": "#252423" } },
            "fontColorSecondary": { "solid": { "color": "#252423" } },
            "fontSize": 11,
            "fontFamily": "Segoe UI"
          }
        ],
        "total": [
          {
            "backColor": { "solid": { "color": "#E1DFDD" } },
            "fontColor": { "solid": { "color": "#252423" } },
            "fontSize": 11,
            "fontFamily": "Segoe UI Semibold",
            "totals": true
          }
        ],
        "grid": [
          {
            "gridHorizontal": true,
            "gridHorizontalColor": { "solid": { "color": "#E1DFDD" } },
            "gridHorizontalWeight": 1,
            "gridVertical": false
          }
        ]
      }
    }
  }
}
```

## Notes

- Use `backColor` (not `backgroundColor`) for column headers and totals row background.
- `backColorPrimary` / `backColorSecondary` control alternating row banding in `values`; `backColor` in `values` sets a flat (non-banded) background.
- `outlineStyle` is an integer — common values: `0` (none), `1` (bottom only), `2` (all sides).
