# stackedAreaChart (Stacked Area Chart)

Stacked area chart that accumulates series values so the filled areas do not overlap; adds `seriesLabels` and `totals` on top of the standard area chart containers.

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
    "stackedAreaChart": {
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
        "totals": [
          {
            "show": true,
            "fontSize": 11,
            "fontFamily": "Segoe UI",
            "color": { "solid": { "color": "#252423" } }
          }
        ]
      }
    }
  }
}
```

## Notes

- All axis, legend, `lineStyles`, and `markers` containers are identical to `lineChart` — see [lineChart.md](lineChart.md).
- `seriesLabels.textSize` (not `fontSize`) controls the end-of-series label font size; `seriesPosition` is `Left` or `Right`.
- `totals` renders a data label at the top of each stacked column showing the sum across all series.
