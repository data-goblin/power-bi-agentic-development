# columnChart (Column Chart)

Vertical column chart (single or stacked); adds `totals` and `ribbonBands` containers on top of the standard bar/column container set.

## Containers

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
    "columnChart": {
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
        ],
        "totals": [
          {
            "show": true,
            "fontSize": 10,
            "fontFamily": "Segoe UI Semibold",
            "color": { "solid": { "color": "#252423" } }
          }
        ]
      }
    }
  }
}
```

## Notes

- `totals` labels appear at the top of stacked columns showing the sum; `show` must be `true` and the visual must have a legend/series field in the stack.
- `ribbonBands` controls the connecting bands between stacked segments across categories; most useful when `fillMatchColor` is `false` to set a custom ribbon color.
- `dataPoint` gains a `fillRule` property (gradient fill rule) compared to clustered variants, enabling gradient fills on individual columns.
