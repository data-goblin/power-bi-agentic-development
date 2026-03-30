# pivotTable (Matrix)

Matrix visual with row/column hierarchies, stepped layout, and independent row/column total styling.

## Containers

| Container | Key Properties |
|-----------|---------------|
| `columnHeaders` | `backColor`, `fontColor`, `fontSize`, `fontFamily`, `outlineColor`, `outlineStyle`, `outlineWeight` |
| `rowHeaders` | `backColor`, `fontColor`, `fontSize`, `fontFamily`, `stepped`, `steppedLayoutIndentation`, `outlineColor`, `outlineStyle`, `outlineWeight` |
| `values` | `backColorPrimary`, `backColorSecondary`, `fontColorPrimary`, `fontColorSecondary`, `fontSize`, `fontFamily` |
| `total` | `backColor`, `fontColor`, `fontSize`, `fontFamily`, `applyToHeaders` |
| `grid` | `gridHorizontal`, `gridHorizontalColor`, `gridHorizontalWeight`, `gridVertical`, `gridVerticalColor`, `gridVerticalWeight` |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "pivotTable": {
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
        "rowHeaders": [
          {
            "backColor": { "solid": { "color": "#F3F2F1" } },
            "fontColor": { "solid": { "color": "#252423" } },
            "fontSize": 11,
            "fontFamily": "Segoe UI",
            "stepped": true,
            "steppedLayoutIndentation": 10
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
            "applyToHeaders": true
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

- **The theme key is `pivotTable`, not `matrix`.** Using `matrix` has no effect — this is a common gotcha.
- `stepped` and `steppedLayoutIndentation` (pixels) in `rowHeaders` control the cascading indent for hierarchy levels.
- `pivotTable` has separate `columnTotal` and `rowTotal` containers (8 properties each) for independent grand total styling beyond what `total` covers.
