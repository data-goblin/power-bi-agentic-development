# azureMap (Azure Map)

Azure Maps visual supporting multiple layer types: bubbles, heat maps, filled regions, route paths, tile overlays, and 3D bar charts.

## Containers

| Container | Key Properties |
|-----------|---------------|
| `bubbleLayer` | `show`, `fillColor`, `bubbleRadius`, `mapTransparency`, `clusteringEnabled`, `markerRangeType` |
| `heatMapLayer` | `show`, `heatMapColorLow`, `heatMapColorCenter`, `heatMapColorHigh`, `heatMapRadius`, `heatMapIntensity`, `mapTransparency` |
| `filledMap` | `show`, `defaultColor`, `strokeColor`, `strokeWidth`, `mapTransparency` |
| `pathLayer` | `show`, `color`, `strokeWidth`, `strokeTransparency` |
| `tileLayer` | `show`, `tileLayerUrl`, `mapTransparency`, `layerPosition` |
| `barChart` | `show`, `defaultColor`, `barHeight`, `thickness`, `mapTransparency` |
| `legend` | `show`, `position`, `labelColor`, `fontSize`, `fontFamily` |
| `dataPoint` | `fill`, `showAllDataPoints` |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "azureMap": {
      "*": {
        "bubbleLayer": [
          {
            "show": true,
            "fillColor": { "solid": { "color": "#0078D4" } },
            "bubbleRadius": 8,
            "mapTransparency": 20,
            "clusteringEnabled": false
          }
        ],
        "filledMap": [
          {
            "show": false,
            "defaultColor": { "solid": { "color": "#0078D4" } },
            "strokeColor": { "solid": { "color": "#FFFFFF" } },
            "strokeWidth": 1,
            "mapTransparency": 20
          }
        ],
        "legend": [
          {
            "show": true,
            "position": "Bottom",
            "labelColor": { "solid": { "color": "#252423" } },
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

- Only one layer type is typically active at a time; set `show: false` on inactive layers to avoid conflicts.
- `bubbleLayer` has 42 properties covering clustering, marker images, zoom-range visibility, and bezier easing — theme is appropriate only for baseline defaults, not per-series customisation.
- Map tile style, zoom defaults, and traffic overlays are controlled at the visual level (`mapControls`, `traffic`), not meaningfully overridden by theme for most use cases.
