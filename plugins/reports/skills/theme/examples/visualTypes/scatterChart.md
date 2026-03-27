# scatterChart (Scatter Chart)

Scatter and bubble chart for plotting two (or three) numeric measures against each other; supports play-axis animation.

## Containers

| Container | Key Properties |
|-----------|----------------|
| `categoryAxis` | `show`, `fontSize`, `fontFamily`, `labelColor`, `gridlineColor`, `gridlineThickness`, `gridlineShow` |
| `valueAxis` | `show`, `fontSize`, `fontFamily`, `labelColor`, `gridlineColor`, `gridlineThickness`, `gridlineShow` |
| `legend` | `show`, `position`, `fontSize`, `fontFamily`, `labelColor` |
| `categoryLabels` | `show`, `fontSize`, `fontFamily`, `color` |
| `markers` | `borderShow`, `borderColor`, `borderWidth`, `transparency` |
| `dataPoint` | `fill`, `defaultColor`, `fillTransparency`, `borderShow`, `borderColor` |

`legend.position` enum: `Top`, `TopCenter`, `TopRight`, `Left`, `Right`, `LeftCenter`, `RightCenter`, `Bottom`, `BottomCenter`, `BottomRight`

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "scatterChart": {
      "*": {
        "categoryAxis": [
          {
            "show": true,
            "fontSize": 11,
            "fontFamily": "Segoe UI",
            "gridlineShow": true,
            "gridlineColor": { "solid": { "color": "#E0E0E0" } }
          }
        ],
        "valueAxis": [
          {
            "show": true,
            "fontSize": 11,
            "fontFamily": "Segoe UI",
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
        "categoryLabels": [
          {
            "show": false,
            "fontSize": 9,
            "fontFamily": "Segoe UI"
          }
        ]
      }
    }
  }
}
```

## Notes

- `scatterChart` has **no `labels` container** — attempting to set one is silently ignored. Per-point labels use `categoryLabels` instead.
- `categoryAxis` in scatter context controls the X-axis (horizontal numeric axis), not discrete categories.
- `dataPoint.fill` supports conditional formatting rules, making it the right place to drive colour-by-category or colour-by-measure logic.
