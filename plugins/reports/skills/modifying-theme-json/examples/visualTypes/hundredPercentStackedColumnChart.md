# hundredPercentStackedColumnChart (100% Stacked Column Chart)

Vertical 100% stacked column chart; each column fills 100% of the axis height, showing relative proportions. The vertical counterpart to `hundredPercentStackedBarChart`.

## Containers

Same container structure as `columnChart` — includes `ribbonBands` and `totals`. All containers are identical in properties.

| Container | Key Properties |
|-----------|----------------|
| `categoryAxis` | `show`, `fontSize`, `fontFamily`, `labelColor`, `bold`, `italic`, `showAxisTitle`, `titleText`, `titleFontSize`, `titleFontFamily`, `titleColor`, `gridlineShow`, `gridlineColor`, `invertAxis` |
| `valueAxis` | `show`, `fontSize`, `fontFamily`, `labelColor`, `bold`, `italic`, `showAxisTitle`, `titleText`, `titleFontSize`, `titleFontFamily`, `titleColor`, `gridlineShow`, `gridlineColor`, `start`, `end` |
| `legend` | `show`, `position`, `fontSize`, `fontFamily`, `labelColor`, `bold`, `italic`, `showTitle`, `titleText` |
| `labels` | `show`, `fontSize`, `fontFamily`, `color`, `bold`, `italic`, `labelPosition`, `labelDisplayUnits`, `labelPrecision`, `backgroundColor`, `enableBackground` |
| `dataPoint` | `defaultColor`, `fill`, `fillTransparency`, `fillRule`, `borderShow`, `borderColor`, `borderSize` |
| `totals` | `show`, `fontSize`, `fontFamily`, `color`, `bold`, `italic`, `labelDisplayUnits`, `labelPrecision`, `backgroundColor`, `enableBackground`, `showPositiveAndNegativeValues` |
| `ribbonBands` | `show`, `fillColor`, `fillMatchColor`, `fillTransparency`, `borderShow`, `borderColor`, `borderColorMatchFill` |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "hundredPercentStackedColumnChart": {
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
            "show": true,
            "fontSize": 10,
            "fontFamily": "Segoe UI",
            "color": { "solid": { "color": "#FFFFFF" } },
            "labelPosition": "InsideCenter"
          }
        ]
      }
    }
  }
}
```

## Notes

- Value axis renders as 0–100% regardless of `start`/`end` values; those properties are inert on this type.
- In column orientation, `categoryAxis` is the X-axis and `valueAxis` is the Y-axis.
- See [barChart.md](barChart.md) for full property reference and [hundredPercentStackedBarChart.md](hundredPercentStackedBarChart.md) for the horizontal equivalent.
