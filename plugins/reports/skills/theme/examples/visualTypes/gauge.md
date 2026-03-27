# gauge (Gauge)

Dial/gauge chart that plots a single value against a min/max arc; the large central value display is styled via `calloutValue`.

## Containers

| Container | Key Properties |
|-----------|----------------|
| `calloutValue` | `show`, `fontFamily`, `color`, `bold`, `italic`, `labelDisplayUnits`, `labelPrecision` (no `fontSize` property) |
| `labels` | `show`, `fontSize`, `fontFamily`, `color`, `labelDisplayUnits`, `labelPrecision` |
| `dataPoint` | `fill`, `target` |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "gauge": {
      "*": {
        "calloutValue": [
          {
            "show": true,
            "fontFamily": "Segoe UI Semibold",
            "color": { "solid": { "color": "#252423" } },
            "bold": false,
            "labelDisplayUnits": 0
          }
        ],
        "labels": [
          {
            "show": true,
            "fontSize": 11,
            "fontFamily": "Segoe UI",
            "color": { "solid": { "color": "#252423" } }
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

- `calloutValue` does **not** have a `fontSize` property — font size for the central callout is not directly theme-controllable; use `fontFamily` and `bold` to adjust its appearance.
- `labels` controls the min/max/target tick labels around the arc rim, not the centre value.
- `dataPoint.fill` sets the arc bar colour; `dataPoint.target` sets the target indicator colour.
