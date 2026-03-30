# hundredPercentStackedBarChart (100% Stacked Bar Chart)

Horizontal 100% stacked bar chart; each bar always fills 100% of the axis width, showing relative proportions rather than absolute values.

## Containers

Same container structure as `barChart` plus `ribbonBands` and `totals`. All containers are identical in properties to `columnChart`.

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
    "hundredPercentStackedBarChart": {
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

- Value axis will always render as 0–100% regardless of `start`/`end` settings on `valueAxis`; those properties are effectively inert here.
- `labels` are commonly positioned `InsideCenter` or `InsideEnd` since bars always span the full width.
- See [barChart.md](barChart.md) for full property reference; this type is a horizontal stacked variant with the same complete container set.
