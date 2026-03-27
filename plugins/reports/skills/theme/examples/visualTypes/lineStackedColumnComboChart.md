# lineStackedColumnComboChart (Line and Stacked Column Chart)

Combo chart that overlays a line series on stacked columns; adds a `totals` container for stacked column sum labels compared to the clustered-column variant.

## Containers

| Container | Key Properties |
|-----------|----------------|
| `categoryAxis` | `show`, `fontSize`, `fontFamily`, `labelColor`, `gridlineShow` |
| `valueAxis` | Primary: `show`, `fontSize`, `fontFamily`, `gridlineColor`, `gridlineThickness` — Secondary: `secShow`, `secFontSize`, `secFontFamily`, `secLabelColor` |
| `legend` | `show`, `position`, `fontSize`, `fontFamily`, `labelColor` |
| `labels` | `show`, `fontSize`, `fontFamily`, `color`, `labelPosition` |
| `lineStyles` | `strokeWidth`, `strokeColor`, `lineChartType`, `lineStyle`, `showMarker` |
| `markers` | `borderShow`, `borderColor`, `transparency` |
| `totals` | `show`, `fontSize`, `fontFamily`, `color` |

`legend.position` enum: `Top`, `TopCenter`, `TopRight`, `Left`, `Right`, `LeftCenter`, `RightCenter`, `Bottom`, `BottomCenter`, `BottomRight`

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "lineStackedColumnComboChart": {
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
            "gridlineThickness": 1,
            "secShow": true,
            "secFontSize": 11,
            "secFontFamily": "Segoe UI"
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
            "show": false,
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

- Identical to [lineClusteredColumnComboChart.md](lineClusteredColumnComboChart.md) except for the addition of the `totals` container which labels the sum of each stacked column.
- The dual-axis pattern (`sec*` prefix on `valueAxis`) is the same as the clustered-column combo — see that file for details.
- `totals.color` accepts `{ "solid": { "color": "#hex" } }`.
