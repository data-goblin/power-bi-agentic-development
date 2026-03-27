# waterfallChart (Waterfall Chart)

Waterfall chart showing incremental increases and decreases leading to a running total; bar colours for each state are controlled by the `sentimentColors` container.

## Containers

| Container | Key Properties |
|-----------|----------------|
| `categoryAxis` | `show`, `fontSize`, `fontFamily`, `labelColor`, `innerPadding` |
| `valueAxis` | `show`, `fontSize`, `fontFamily`, `labelColor`, `gridlineColor`, `gridlineThickness`, `gridlineShow` |
| `legend` | `show`, `position`, `fontSize`, `fontFamily`, `labelColor` |
| `labels` | `show`, `fontSize`, `fontFamily`, `color`, `labelPosition` |
| `sentimentColors` | `increaseFill`, `decreaseFill`, `totalFill`, `otherFill` |

`legend.position` enum: `Top`, `TopCenter`, `TopRight`, `Left`, `Right`, `LeftCenter`, `RightCenter`, `Bottom`, `BottomCenter`, `BottomRight`

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "waterfallChart": {
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
            "gridlineThickness": 1
          }
        ],
        "legend": [
          {
            "show": true,
            "position": "Top",
            "fontSize": 11,
            "fontFamily": "Segoe UI",
            "labelColor": { "solid": { "color": "#252423" } }
          }
        ],
        "labels": [
          {
            "show": true,
            "fontSize": 10,
            "fontFamily": "Segoe UI",
            "color": { "solid": { "color": "#252423" } }
          }
        ],
        "sentimentColors": [
          {
            "increaseFill": { "solid": { "color": "#107C10" } },
            "decreaseFill": { "solid": { "color": "#D83B01" } },
            "totalFill":    { "solid": { "color": "#0078D4" } },
            "otherFill":    { "solid": { "color": "#737373" } }
          }
        ]
      }
    }
  }
}
```

## Notes

- `sentimentColors` is a **visual-level container** — distinct from the top-level theme `good`, `neutral`, `bad` colour keys. Changes here affect only waterfall bar fills.
- All four `sentimentColors` properties accept `{ "solid": { "color": "#hex" } }` objects; there is no shorthand string form.
- `waterfallChart` has no `dataPoint` container; bar colours are controlled exclusively through `sentimentColors`.
