# map (Map)

Bing Maps bubble/heat map visual for geographic data visualisation using latitude/longitude or address geocoding.

## Containers

| Container | Key Properties |
|-----------|---------------|
| `legend` | `show`, `position`, `labelColor`, `fontSize`, `fontFamily` |
| `dataPoint` | `defaultColor`, `fill`, `fillRule`, `showAllDataPoints`, `transparency` |
| `categoryLabels` | `show`, `color`, `fontSize`, `fontFamily`, `backgroundColor`, `enableBackground` |
| `bubbles` | `bubbleSize`, `markerRangeType` |
| `heatMap` | `show`, `color0`, `color50`, `color100`, `filterRadius`, `transparency` |
| `mapControls` | `autoZoom`, `showZoomButtons`, `showLassoButton`, `zoomLevel` |
| `mapStyles` | `mapTheme`, `showLabels` |

## Theme Example

```json
{
  "map": {
    "legend": {
      "show": true,
      "position": "Bottom",
      "labelColor": { "solid": { "color": "#252423" } },
      "fontSize": 10,
      "fontFamily": "Segoe UI"
    },
    "dataPoint": {
      "defaultColor": { "solid": { "color": "#0078D4" } },
      "transparency": 20
    },
    "categoryLabels": {
      "show": true,
      "color": { "solid": { "color": "#252423" } },
      "fontSize": 9,
      "fontFamily": "Segoe UI"
    },
    "mapStyles": {
      "mapTheme": "canvasLight",
      "showLabels": true
    },
    "mapControls": {
      "autoZoom": true,
      "showZoomButtons": true
    }
  }
}
```

## Notes

- `mapStyles.mapTheme` accepts: `aerial`, `canvasDark`, `canvasLight`, `road`, `grayscale`.
- `heatMap.show` must be `true` for heat map layer properties to take effect; heat map and bubble layers are mutually exclusive display modes.
- Practical theme impact is limited — map tile style, geocoding culture, and zoom defaults are the main levers; per-data-point colours require field-level conditional formatting.
