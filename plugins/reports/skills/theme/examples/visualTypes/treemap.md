# treemap (Treemap)

Treemap chart that displays hierarchical data as proportionally-sized nested rectangles; supports legend, data labels, and category labels.

## Containers

| Container | Key Properties |
|-----------|----------------|
| `legend` | `show`, `position`, `fontSize`, `fontFamily`, `labelColor` |
| `labels` | `show`, `fontSize`, `fontFamily`, `color`, `labelDisplayUnits`, `labelPrecision` |
| `dataPoint` | `fill`, `fillRule` |

`legend.position` enum: `Top`, `TopCenter`, `TopRight`, `Left`, `Right`, `LeftCenter`, `RightCenter`, `Bottom`, `BottomCenter`, `BottomRight`

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "treemap": {
      "*": {
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
            "show": true,
            "fontSize": 11,
            "fontFamily": "Segoe UI",
            "color": { "solid": { "color": "#ffffff" } }
          }
        ],
        "dataPoint": [
          {
            "fill": { "solid": { "color": "#0078D4" } }
          }
        ]
      }
    }
  }
}
```

## Notes

- `labels.color` and `legend.labelColor` accept `{ "solid": { "color": "#hex" } }`, not plain strings.
- `dataPoint.fillRule` enables gradient/rule-based fill; use `dataPoint.fill` for a flat colour override.
- `treemap` has no `categoryAxis` or `valueAxis` containers — axis styling is not applicable to this chart type.
