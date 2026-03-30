# decompositionTreeVisual (Decomposition Tree)

AI-assisted hierarchical breakdown visual for exploring root causes and contributions across multiple dimensions.

## Containers

| Container | Key Properties |
|-----------|---------------|
| `levelHeader` | `levelTitleFontFamily`, `levelTitleFontSize`, `levelTitleFontColor`, `levelTitleBold`, `levelSubtitleFontFamily`, `levelSubtitleFontSize`, `levelSubtitleFontColor`, `levelHeaderBackgroundColor` |
| `dataLabels` | `dataLabelFontFamily`, `dataLabelFontSize`, `dataLabelFontColor`, `dataLabelBold`, `dataLabelDisplayUnits` |
| `dataBars` | `dataBarColor`, `positiveBarColor`, `negativeBarColor`, `dataBarBackgroundColor`, `dataBarWidthPercentage` |
| `categoryLabels` | `categoryLabelFontFamily`, `categoryLabelFontSize`, `categoryLabelFontColor`, `categoryLabelBold` |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "decompositionTreeVisual": {
      "*": {
        "levelHeader": [
          {
            "levelTitleFontFamily": "Segoe UI Semibold",
            "levelTitleFontSize": 11,
            "levelTitleFontColor": { "solid": { "color": "#252423" } },
            "levelTitleBold": false,
            "levelSubtitleFontFamily": "Segoe UI",
            "levelSubtitleFontSize": 9,
            "levelSubtitleFontColor": { "solid": { "color": "#605E5C" } },
            "levelHeaderBackgroundColor": { "solid": { "color": "#F3F2F1" } },
            "showSubtitles": true
          }
        ],
        "dataLabels": [
          {
            "dataLabelFontFamily": "Segoe UI",
            "dataLabelFontSize": 10,
            "dataLabelFontColor": { "solid": { "color": "#252423" } },
            "dataLabelBold": false
          }
        ],
        "dataBars": [
          {
            "positiveBarColor": { "solid": { "color": "#0078D4" } },
            "negativeBarColor": { "solid": { "color": "#D13438" } },
            "dataBarWidthPercentage": 80
          }
        ],
        "categoryLabels": [
          {
            "categoryLabelFontFamily": "Segoe UI",
            "categoryLabelFontSize": 10,
            "categoryLabelFontColor": { "solid": { "color": "#252423" } },
            "categoryLabelBold": false
          }
        ]
      }
    }
  }
}
```

## Notes

- Property names in `levelHeader` are prefixed (`levelTitleFontFamily`, `levelSubtitleFontFamily`) — there is no bare `fontFamily` or `fontSize` at this level.
- `dataBars` supports `positiveBarColor` and `negativeBarColor` separately; `dataBarColor` sets the colour when there is no positive/negative distinction.
- `dataBars.dataBarScalingType` controls relative vs. absolute bar scaling: `topNode`, `parentNode`, or `levelMaximum`.
