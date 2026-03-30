# donutChart (Donut Chart)

Donut chart — a pie chart with a hollow centre; container set is identical to `pieChart`. The centre hole size is governed by `slices.innerRadiusRatio`.

## Containers

| Container | Key Properties |
|-----------|----------------|
| `labels` | `show`, `fontSize`, `fontFamily`, `color`, `position`, `labelStyle`, `labelDisplayUnits`, `labelPrecision` |
| `legend` | `show`, `position`, `fontSize`, `fontFamily`, `labelColor` |
| `dataPoint` | `fill`, `defaultColor`, `fillTransparency`, `borderShow`, `borderColor` |
| `slices` | `innerRadiusRatio`, `startAngle` |

`labels.position` values: `Outside`, `Inside`, `BestFit` (PascalCase — lowercase values are silently ignored by Power BI)

`legend.position` enum: `Top`, `TopCenter`, `TopRight`, `Left`, `Right`, `LeftCenter`, `RightCenter`, `Bottom`, `BottomCenter`, `BottomRight`

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "donutChart": {
      "*": {
        "labels": [
          {
            "show": true,
            "fontSize": 11,
            "fontFamily": "Segoe UI",
            "color": { "solid": { "color": "#252423" } },
            "position": "Outside",
            "labelStyle": "Percent of total"
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
        "slices": [
          {
            "innerRadiusRatio": 60
          }
        ]
      }
    }
  }
}
```

## Notes

- `donutChart` has **no dedicated centre-label container** in the schema — the hole is purely visual, sized by `slices.innerRadiusRatio` (integer, represents a percentage of the outer radius).
- All properties are identical to `pieChart` — see [pieChart.md](pieChart.md) for full property details.
- Setting `slices.innerRadiusRatio` to `0` on a donut effectively renders it as a pie.
