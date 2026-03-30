# keyDriversVisual (Key Influencers)

AI visual that analyses a metric to surface the factors (influencers) that drive it up or down.

## Containers

| Container | Key Properties |
|-----------|---------------|
| `keyDrivers` | `selectedAnalysis`, `allowKeyDrivers`, `allowProfiles`, `selectedSort`, `countType`, `targetValue` |
| `keyInfluencersVisual` | `canvasColor`, `primaryColor`, `secondaryColor`, `fontColor`, `primaryFontColor`, `secondaryFontColor` |
| `keyDriversDrillVisual` | `defaultColor`, `referenceLineColor` |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "keyDriversVisual": {
      "*": {
        "keyInfluencersVisual": [
          {
            "canvasColor": { "solid": { "color": "#FFFFFF" } },
            "primaryColor": { "solid": { "color": "#0078D4" } },
            "secondaryColor": { "solid": { "color": "#E1DFDD" } },
            "fontColor": { "solid": { "color": "#252423" } },
            "primaryFontColor": { "solid": { "color": "#FFFFFF" } },
            "secondaryFontColor": { "solid": { "color": "#252423" } }
          }
        ],
        "keyDriversDrillVisual": [
          {
            "defaultColor": { "solid": { "color": "#0078D4" } },
            "referenceLineColor": { "solid": { "color": "#D13438" } }
          }
        ]
      }
    }
  }
}
```

## Notes

- `keyDrivers` container controls analysis configuration (analysis type, sort order, target value), not visual styling — leave this out of theme unless setting report-wide analysis defaults.
- `keyInfluencersVisual` does not expose font family or size — typography for this visual is not theme-controllable.
- The AI analysis itself is not influenced by theme settings; only the colour palette of the rendered output changes.
