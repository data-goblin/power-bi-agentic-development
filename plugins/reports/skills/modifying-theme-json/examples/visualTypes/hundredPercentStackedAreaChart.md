# hundredPercentStackedAreaChart (100% Stacked Area Chart)

Stacked area chart normalised to 100% at every category point; each series shows its proportional share rather than absolute values.

## Containers

| Container | Key Properties |
|-----------|----------------|
| `categoryAxis` | `show`, `fontSize`, `fontFamily`, `labelColor`, `gridlineColor`, `gridlineThickness`, `gridlineShow` |
| `valueAxis` | `show`, `fontSize`, `fontFamily`, `labelColor`, `gridlineColor`, `gridlineThickness`, `gridlineShow` |
| `legend` | `show`, `position`, `fontSize`, `fontFamily`, `labelColor` |
| `labels` | `show`, `fontSize`, `fontFamily`, `color`, `labelPosition` |
| `lineStyles` | `strokeWidth`, `strokeColor`, `areaShow`, `areaColor`, `areaMatchStrokeColor`, `showMarker` |
| `markers` | `borderShow`, `borderColor`, `transparency` |
| `seriesLabels` | `show`, `showByDefault`, `textSize`, `seriesFontFamily`, `seriesPosition` |
| `totals` | `show`, `fontSize`, `fontFamily`, `color` |

`legend.position` enum: `Top`, `TopCenter`, `TopRight`, `Left`, `Right`, `LeftCenter`, `RightCenter`, `Bottom`, `BottomCenter`, `BottomRight`

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "hundredPercentStackedAreaChart": {
      "*": {
        "categoryAxis": [
          {
            "show": true,
            "fontSize": 11,
            "fontFamily": "Segoe UI"
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
        "labels": [
          {
            "show": false
          }
        ]
      }
    }
  }
}
```

## Notes

- Container set is identical to `stackedAreaChart` — see [lineChart.md](lineChart.md) for shared axis and legend details.
- The value axis always displays percentages (0–100%); setting `start`/`end` on `valueAxis` is not meaningful here.
- `totals` labels show 100% for every category point and are typically hidden.
