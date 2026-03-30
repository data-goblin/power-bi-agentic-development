# clusteredBarChart (Clustered Bar Chart)

Horizontal clustered bar chart; groups multiple series side-by-side on the same axis.

## Containers

Same container structure as `barChart` with one difference: `clusteredBarChart` does **not** have `ribbonBands` or `totals` containers. All other containers (`categoryAxis`, `valueAxis`, `legend`, `labels`, `dataPoint`, etc.) are identical in property count and names.

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
    "clusteredBarChart": {
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

- No `ribbonBands` or `totals` containers — those are only available on stacked variants and `barChart`.
- See [barChart.md](barChart.md) for full container property reference; all shared containers are identical.
- `dataPoint` has 9 properties here vs 10 on `barChart` — `fillRule` (gradient fill rule) is absent on clustered variants.
