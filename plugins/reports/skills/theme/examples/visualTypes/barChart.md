# barChart (Bar Chart)

Horizontal bar chart; base type for the bar/column family. Most containers (axes, legend, labels, dataPoint, ribbonBands, totals) are shared across all chart types in this family.

## Containers

| Container | Key Properties |
|-----------|----------------|
| `categoryAxis` | `show`, `fontSize`, `fontFamily`, `labelColor`, `bold`, `italic`, `showAxisTitle`, `titleText`, `titleFontSize`, `titleFontFamily`, `titleColor`, `gridlineShow`, `gridlineColor`, `invertAxis` |
| `valueAxis` | `show`, `fontSize`, `fontFamily`, `labelColor`, `bold`, `italic`, `showAxisTitle`, `titleText`, `titleFontSize`, `titleFontFamily`, `titleColor`, `gridlineShow`, `gridlineColor`, `start`, `end` |
| `legend` | `show`, `position`, `fontSize`, `fontFamily`, `labelColor`, `bold`, `italic`, `showTitle`, `titleText` |
| `labels` | `show`, `fontSize`, `fontFamily`, `color`, `bold`, `italic`, `labelPosition`, `labelDisplayUnits`, `labelPrecision`, `backgroundColor`, `enableBackground` |
| `dataPoint` | `defaultColor`, `fill`, `fillTransparency`, `borderShow`, `borderColor`, `borderSize` |
| `ribbonBands` | `show`, `fillColor`, `fillMatchColor`, `fillTransparency`, `borderShow`, `borderColor`, `borderColorMatchFill` |
| `totals` | `show`, `fontSize`, `fontFamily`, `color`, `bold`, `italic`, `labelDisplayUnits`, `labelPrecision`, `backgroundColor`, `enableBackground` |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "barChart": {
      "*": {
        "categoryAxis": [
          {
            "show": true,
            "fontSize": 11,
            "fontFamily": "Segoe UI",
            "labelColor": { "solid": { "color": "#252423" } },
            "gridlineShow": true,
            "gridlineColor": { "solid": { "color": "#E0E0E0" } }
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
            "fontFamily": "Segoe UI",
            "labelColor": { "solid": { "color": "#252423" } }
          }
        ],
        "labels": [
          {
            "show": false,
            "fontSize": 10,
            "fontFamily": "Segoe UI",
            "color": { "solid": { "color": "#252423" } },
            "labelPosition": "OutsideEnd"
          }
        ],
        "dataPoint": [
          {
            "fillTransparency": 0
          }
        ]
      }
    }
  }
}
```

## Notes

- In a bar chart (horizontal), `categoryAxis` is the Y-axis (categories) and `valueAxis` is the X-axis (values) — the opposite of a column chart.
- Axis label color is `labelColor`, not `fontColor`; the property name differs from most other visual containers.
- `ribbonBands` and `totals` are present on `barChart` and control stacked/ribbon overlay appearance; for non-stacked series they have no visible effect unless enabled.
