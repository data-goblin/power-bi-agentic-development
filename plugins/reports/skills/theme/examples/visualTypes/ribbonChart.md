# ribbonChart (Ribbon Chart)

Column chart that shows rank changes over time using ribbon connectors between bars; the `ribbonBands` container controls the connector appearance.

## Containers

Same container structure as `columnChart` — includes `ribbonBands` and `totals`.

| Container | Key Properties |
|-----------|----------------|
| `categoryAxis` | `show`, `fontSize`, `fontFamily`, `labelColor`, `bold`, `italic`, `showAxisTitle`, `titleText`, `titleFontSize`, `titleFontFamily`, `titleColor`, `gridlineShow`, `gridlineColor`, `invertAxis` |
| `valueAxis` | `show`, `fontSize`, `fontFamily`, `labelColor`, `bold`, `italic`, `showAxisTitle`, `titleText`, `titleFontSize`, `titleFontFamily`, `titleColor`, `gridlineShow`, `gridlineColor`, `start`, `end` |
| `legend` | `show`, `position`, `fontSize`, `fontFamily`, `labelColor`, `bold`, `italic`, `showTitle`, `titleText` |
| `labels` | `show`, `fontSize`, `fontFamily`, `color`, `bold`, `italic`, `labelPosition`, `labelDisplayUnits`, `labelPrecision`, `backgroundColor`, `enableBackground` |
| `dataPoint` | `defaultColor`, `fill`, `fillTransparency`, `fillRule`, `borderShow`, `borderColor`, `borderSize` |
| `ribbonBands` | `show`, `fillColor`, `fillMatchColor`, `fillTransparency`, `borderShow`, `borderColor`, `borderColorMatchFill`, `borderSize`, `borderTransparency` |
| `totals` | `show`, `fontSize`, `fontFamily`, `color`, `bold`, `italic`, `labelDisplayUnits`, `labelPrecision`, `backgroundColor`, `enableBackground`, `showPositiveAndNegativeValues` |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "ribbonChart": {
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
        "ribbonBands": [
          {
            "show": true,
            "fillMatchColor": true,
            "fillTransparency": 30,
            "borderShow": false
          }
        ]
      }
    }
  }
}
```

## Notes

- `ribbonBands.fillMatchColor: true` tints ribbons to match their corresponding bar color; set to `false` and use `fillColor` to override with a custom color.
- `ribbonBands.show: false` removes the connecting ribbons entirely, leaving a plain column chart appearance.
- `borderColorMatchFill` controls whether the ribbon border inherits the fill color; set to `false` to use `borderColor` independently.
