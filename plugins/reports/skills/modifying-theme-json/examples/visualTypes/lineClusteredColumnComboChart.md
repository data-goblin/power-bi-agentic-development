# lineClusteredColumnComboChart (Line and Clustered Column Chart)

Combo chart that overlays a line series on clustered columns; the primary (left) Y-axis scales the columns and the secondary (right) Y-axis scales the line — both live inside the single `valueAxis` container.

## Containers

| Container | Key Properties |
|-----------|----------------|
| `categoryAxis` | `show`, `fontSize`, `fontFamily`, `labelColor`, `gridlineShow` |
| `valueAxis` | Primary: `show`, `fontSize`, `fontFamily`, `gridlineColor`, `gridlineThickness` — Secondary: `secShow`, `secFontSize`, `secFontFamily`, `secLabelColor` |
| `legend` | `show`, `position`, `fontSize`, `fontFamily`, `labelColor` |
| `labels` | `show`, `fontSize`, `fontFamily`, `color`, `labelPosition` |
| `lineStyles` | `strokeWidth`, `strokeColor`, `lineChartType`, `lineStyle`, `showMarker` |
| `markers` | `borderShow`, `borderColor`, `transparency` |

`legend.position` enum: `Top`, `TopCenter`, `TopRight`, `Left`, `Right`, `LeftCenter`, `RightCenter`, `Bottom`, `BottomCenter`, `BottomRight`

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "lineClusteredColumnComboChart": {
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
        "lineStyles": [
          {
            "strokeWidth": 2,
            "lineChartType": "linear",
            "showMarker": false
          }
        ]
      }
    }
  }
}
```

## Notes

- Primary and secondary Y-axes share one `valueAxis` container: primary properties use no prefix (`show`, `fontSize`, `gridlineColor`), secondary properties use the `sec` prefix (`secShow`, `secFontSize`, `secLabelColor`).
- `valueAxis.alignZeros` (`boolean`) aligns the zero tick marks of both axes — useful when one axis goes negative.
- `lineStyles` applies only to the line series; column styling is controlled via `dataPoint`.
