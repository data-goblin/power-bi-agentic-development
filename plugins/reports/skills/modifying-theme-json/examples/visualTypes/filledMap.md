# filledMap (Filled Map)

Choropleth map visual that shades geographic regions by data value using Bing Maps boundary data.

## Containers

| Container | Key Properties |
|-----------|---------------|
| `dataPoint` | `defaultColor`, `fill`, `fillRule`, `showAllDataPoints`, `transparency` |
| `legend` | `show`, `position`, `labelColor`, `fontSize`, `fontFamily` |
| `categoryLabels` | `show` |
| `stroke` | `show`, `strokeColor`, `strokeWidth` |
| `mapControls` | `autoZoom`, `showZoomButtons`, `showLassoButton`, `zoomLevel` |
| `mapStyles` | `mapTheme`, `showLabels` |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "filledMap": {
      "*": {
        "dataPoint": [
          {
            "defaultColor": { "solid": { "color": "#0078D4" } },
            "transparency": 20,
            "showAllDataPoints": false
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
        ],
        "stroke": [
          {
            "show": true,
            "strokeColor": { "solid": { "color": "#FFFFFF" } },
            "strokeWidth": 1
          }
        ],
        "mapStyles": [
          {
            "mapTheme": "canvasLight",
            "showLabels": true
          }
        ],
        "mapControls": [
          {
            "autoZoom": true,
            "showZoomButtons": false
          }
        ]
      }
    }
  }
}
```

## Notes

- `dataPoint.defaultColor` sets the single-series fill; for multi-series, use `dataPoint.fill` with a `fillRule` gradient object.
- `stroke` controls the boundary outline between regions — setting `show: false` removes region borders entirely.
- `categoryLabels` in `filledMap` has only a `show` property (1 property); label styling is not exposed here.
