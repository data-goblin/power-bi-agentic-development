# pieChart (Pie Chart)

Circular chart that divides a whole into proportional slices; supports outside, inside, and adaptive label placement.

## Containers

| Container | Key Properties |
|-----------|----------------|
| `labels` | `show`, `fontSize`, `fontFamily`, `color`, `position`, `labelStyle`, `labelDisplayUnits`, `labelPrecision` |
| `legend` | `show`, `position`, `fontSize`, `fontFamily`, `labelColor` |
| `dataPoint` | `fill`, `defaultColor`, `fillTransparency`, `borderShow`, `borderColor` |
| `slices` | `innerRadiusRatio`, `startAngle` |

`labels.position` values: `outside`, `inside`, `preferOutside`, `preferInside`

`legend.position` enum: `Top`, `TopCenter`, `TopRight`, `Left`, `Right`, `LeftCenter`, `RightCenter`, `Bottom`, `BottomCenter`, `BottomRight`

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "pieChart": {
      "*": {
        "labels": [
          {
            "show": true,
            "fontSize": 11,
            "fontFamily": "Segoe UI",
            "color": { "solid": { "color": "#252423" } },
            "position": "outside",
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

- `labels.color` and `legend.labelColor` accept `{ "solid": { "color": "#hex" } }`, not plain strings.
- `slices.innerRadiusRatio` converts a pie into a donut when set > 0; use `donutChart` if you want a donut with a centre label.
- `labels.labelStyle` controls what is shown on each slice: `Category`, `Data`, `Percent of total`, and combinations thereof.
