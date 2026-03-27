# areaChart (Area Chart)

Area chart that shades the region below each line series; supports the same containers as the line chart.

## Containers

| Container | Key Properties |
|-----------|----------------|
| `categoryAxis` | `show`, `fontSize`, `fontFamily`, `labelColor`, `gridlineColor`, `gridlineThickness`, `gridlineShow` |
| `valueAxis` | `show`, `fontSize`, `fontFamily`, `labelColor`, `gridlineColor`, `gridlineThickness`, `gridlineShow` |
| `legend` | `show`, `position`, `fontSize`, `fontFamily`, `labelColor` |
| `labels` | `show`, `fontSize`, `fontFamily`, `color`, `labelPosition` |
| `lineStyles` | `strokeWidth`, `strokeColor`, `areaShow`, `areaColor`, `areaMatchStrokeColor`, `showMarker` |
| `markers` | `borderShow`, `borderColor`, `transparency` |

`legend.position` enum: `Top`, `TopCenter`, `TopRight`, `Left`, `Right`, `LeftCenter`, `RightCenter`, `Bottom`, `BottomCenter`, `BottomRight`

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "areaChart": {
      "*": {
        "categoryAxis": [
          {
            "show": true,
            "fontSize": 11,
            "fontFamily": "Segoe UI",
            "gridlineShow": false
          }
        ],
        "valueAxis": [
          {
            "show": true,
            "fontSize": 11,
            "fontFamily": "Segoe UI",
            "gridlineColor": { "solid": { "color": "#E0E0E0" } },
            "gridlineThickness": 1
          }
        ],
        "legend": [
          {
            "show": true,
            "position": "Bottom",
            "fontSize": 11,
            "fontFamily": "Segoe UI",
            "labelColor": { "solid": { "color": "#252423" } }
          }
        ],
        "lineStyles": [
          {
            "strokeWidth": 2,
            "areaShow": true,
            "showMarker": false
          }
        ]
      }
    }
  }
}
```

## Notes

- Container list is identical to `lineChart` — see [lineChart.md](lineChart.md) for axis and legend property details.
- `lineStyles.areaShow` controls whether the fill area is rendered; `areaMatchStrokeColor` ties the fill to the line colour.
- `areaColor` accepts `{ "solid": { "color": "#hex" } }` and is only applied when `areaMatchStrokeColor` is `false`.
