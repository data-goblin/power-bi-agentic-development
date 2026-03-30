# clusteredColumnChart (Clustered Column Chart)

Vertical clustered column chart; groups multiple series side-by-side. The vertical counterpart to `clusteredBarChart`.

## Containers

Same container structure as `clusteredBarChart` — no `ribbonBands` or `totals`. All axis, legend, labels, and dataPoint containers are identical in properties to `barChart`.

| Container | Key Properties |
|-----------|----------------|
| `categoryAxis` | `show`, `fontSize`, `fontFamily`, `labelColor`, `bold`, `italic`, `showAxisTitle`, `titleText`, `titleFontSize`, `titleFontFamily`, `titleColor`, `gridlineShow`, `gridlineColor`, `invertAxis` |
| `valueAxis` | `show`, `fontSize`, `fontFamily`, `labelColor`, `bold`, `italic`, `showAxisTitle`, `titleText`, `titleFontSize`, `titleFontFamily`, `titleColor`, `gridlineShow`, `gridlineColor`, `start`, `end` |
| `legend` | `show`, `position`, `fontSize`, `fontFamily`, `labelColor`, `bold`, `italic`, `showTitle`, `titleText` |
| `labels` | `show`, `fontSize`, `fontFamily`, `color`, `bold`, `italic`, `labelPosition`, `labelDisplayUnits`, `labelPrecision`, `backgroundColor`, `enableBackground` |
| `dataPoint` | `defaultColor`, `fill`, `fillTransparency`, `borderShow`, `borderColor`, `borderSize` |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "clusteredColumnChart": {
      "*": {
        "categoryAxis": [
          {
            "show": true,
            "fontSize": 11,
            "fontFamily": "Segoe UI",
            "labelColor": { "solid": { "color": "#252423" } }
          }
        ],
        "valueAxis": [
          {
            "show": true,
            "fontSize": 11,
            "fontFamily": "Segoe UI",
            "labelColor": { "solid": { "color": "#252423" } },
            "gridlineShow": true,
            "gridlineColor": { "solid": { "color": "#E0E0E0" } }
          }
        ],
        "legend": [
          {
            "show": true,
            "position": "Bottom",
            "fontSize": 11,
            "fontFamily": "Segoe UI"
          }
        ],
        "labels": [
          {
            "show": false,
            "fontSize": 10,
            "fontFamily": "Segoe UI"
          }
        ]
      }
    }
  }
}
```

## Notes

- In a column chart (vertical), `categoryAxis` is the X-axis and `valueAxis` is the Y-axis — the opposite of `barChart`.
- No `ribbonBands` or `totals` containers — see [columnChart.md](columnChart.md) if you need those.
- See [barChart.md](barChart.md) for full property reference on all shared containers.
