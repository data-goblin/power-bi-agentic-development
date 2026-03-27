# lineChart (Line Chart)

Standard line chart for plotting continuous data series over a category or time axis.

## Containers

| Container | Key Properties |
|-----------|----------------|
| `categoryAxis` | `show`, `fontSize`, `fontFamily`, `labelColor`, `gridlineColor`, `gridlineThickness`, `gridlineShow` |
| `valueAxis` | `show`, `fontSize`, `fontFamily`, `labelColor`, `gridlineColor`, `gridlineThickness`, `gridlineShow` |
| `legend` | `show`, `position`, `fontSize`, `fontFamily`, `labelColor` |
| `labels` | `show`, `fontSize`, `fontFamily`, `color`, `labelPosition` |
| `lineStyles` | `strokeWidth`, `strokeColor`, `lineChartType`, `lineStyle`, `showMarker`, `areaShow` |
| `markers` | `borderShow`, `borderColor`, `transparency` |

`legend.position` enum: `Top`, `TopCenter`, `TopRight`, `Left`, `Right`, `LeftCenter`, `RightCenter`, `Bottom`, `BottomCenter`, `BottomRight`

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "lineChart": {
      "*": {
        "categoryAxis": [
          {
            "show": true,
            "fontSize": 11,
            "fontFamily": "Segoe UI",
            "gridlineShow": false
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
            "position": "Bottom",
            "fontSize": 11,
            "fontFamily": "Segoe UI",
            "labelColor": { "solid": { "color": "#252423" } }
          }
        ],
        "labels": [
          {
            "show": false
          }
        ],
        "lineStyles": [
          {
            "strokeWidth": 2,
            "lineChartType": "linear",
            "showMarker": false
          }
        ]
      }
    }
  }
}
```

## Notes

- `gridlineColor` and `labelColor` are objects: `{ "solid": { "color": "#hex" } }`, not plain strings.
- `lineChartType` controls interpolation: `linear`, `smooth`, or `step`; `lineStyle` controls stroke pattern: `solid`, `dashed`, `dotted`, `custom`.
- `labels.labelPosition` accepts `Auto`, `InsideEnd`, `OutsideEnd`, and others — check schema for the full enum.
