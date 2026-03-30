# funnel (Funnel)

Funnel chart that displays values as proportionally sized horizontal bars in descending order; supports data labels and a percentage-bar overlay.

## Containers

| Container | Key Properties |
|-----------|----------------|
| `labels` | `show`, `fontSize`, `fontFamily`, `color`, `funnelLabelStyle`, `labelPosition` |
| `categoryAxis` | `show`, `fontSize`, `fontFamily`, `color` |
| `percentBarLabel` | `show`, `fontSize`, `fontFamily`, `color` |
| `dataPoint` | `fill`, `defaultColor`, `fillTransparency`, `borderShow` |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "funnel": {
      "*": {
        "labels": [
          {
            "show": true,
            "fontSize": 11,
            "fontFamily": "Segoe UI",
            "color": { "solid": { "color": "#ffffff" } },
            "funnelLabelStyle": "Data"
          }
        ],
        "categoryAxis": [
          {
            "show": true,
            "fontSize": 11,
            "fontFamily": "Segoe UI"
          }
        ],
        "percentBarLabel": [
          {
            "show": true,
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

- `labels.funnelLabelStyle` controls what is shown: `Data`, `Percent of first`, `Percent of previous`, and combined variants.
- `percentBarLabel` styles the small percentage annotation shown next to the funnel bar; it has `show`, `fontSize`, `fontFamily`, `color`, `bold`, `italic`, `underline`.
- `categoryAxis` in a funnel is a simple text label list; it supports `show`, `fontSize`, `fontFamily`, and `color` only (no gridline properties).
