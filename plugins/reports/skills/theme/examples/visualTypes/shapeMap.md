# shapeMap (Shape Map)

Custom shape map visual that renders user-supplied TopoJSON/GeoJSON shape files, coloured by data values.

## Containers

| Container | Key Properties |
|-----------|---------------|
| `dataPoint` | `defaultColor`, `fill`, `fillRule`, `showAllDataPoints` |
| `legend` | `show`, `position`, `labelColor`, `fontSize`, `fontFamily` |
| `defaultColors` | `defaultColor`, `borderColor`, `borderThickness`, `defaultShow` |

## Theme Example

```json
{
  "shapeMap": {
    "dataPoint": {
      "defaultColor": { "solid": { "color": "#0078D4" } },
      "showAllDataPoints": true
    },
    "legend": {
      "show": true,
      "position": "Bottom",
      "labelColor": { "solid": { "color": "#252423" } },
      "fontSize": 10,
      "fontFamily": "Segoe UI"
    },
    "defaultColors": {
      "defaultColor": { "solid": { "color": "#E1DFDD" } },
      "borderColor": { "solid": { "color": "#FFFFFF" } },
      "borderThickness": 1,
      "defaultShow": true
    }
  }
}
```

## Notes

- Requires a custom shape file (TopoJSON format) — the visual renders no map without one.
- `defaultColors.defaultColor` fills shapes that have no matching data; `defaultColors.defaultShow` controls whether those unmatched shapes are visible at all.
- `dataPoint` in `shapeMap` has no `transparency` property (unlike `filledMap`) — opacity is not adjustable via theme.
