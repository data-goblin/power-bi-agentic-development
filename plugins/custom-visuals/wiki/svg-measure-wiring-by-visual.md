---
title: SVG measure wiring by host visual
summary: PBIR objects that make table, matrix, image, new card and button slicer render a DAX SVG measure.
kind: reference
status: current
sources:
  - url: https://www.sqlbi.com/articles/creating-custom-visuals-in-power-bi-with-dax/
  - url: https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-card
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 60
tools:
  pbir: 0.9.33
verified_by:
  - pbir dax measures add --help
  - pbir visuals table-density --help
skills: [custom-visuals/svg-visuals]
---

# SVG measure wiring by host visual

Learn has no page for SVG measures; the table below is our wiring. The new card and button slicer blocks and the image visual block were reported as rendered in the Power BI service on 2026-09-19 in this repository's earlier notes; that render check was not repeated for this edit. The table, matrix and `pbir` steps were run on a scratch report with released pbir 0.9.33.

## Table and matrix (`tableEx`, `pivotTable`)

```bash
pbir dax measures add "R.Report" -t Sales -n "Bar SVG" -e "$EXPRESSION" -d Text --data-category ImageUrl
pbir visuals bind "R.Report/P.Page/Tbl.Visual" --add "Values:Sales.Bar SVG" --type Measure
pbir visuals table-density "R.Report/P.Page/Tbl.Visual" --image-height 24 --image-width 110
```

- `grid.imageHeight` and `grid.imageWidth` are one size for every image column of the visual; a wide image stretches a sparkline flat. 110 x 24 suits bars, bullets and pills
- Rename the column header through the projection display name
- Scale row bars against the largest row at the same hierarchy level of the host, so write one measure per host and name it after the row field

## Image visual (`image`)

A graphic on its own goes in an image visual that reads the measure through "Select from data". Rendered wiring:

```json
"image": [{
  "properties": {
    "sourceType": {"expr": {"Literal": {"Value": "'imageData'"}}},
    "sourceField": {"expr": {"Measure": {"Expression": {"SourceRef": {"Schema": "extension", "Entity": "Sales"}}, "Property": "Revenue gauge"}}},
    "transparency": {"expr": {"Literal": {"Value": "0D"}}}
  }
}]
```

- `sourceType` must be `imageData` for a `data:` URI; `imageUrl` is for http URLs and errors with `VisualDataProxyExecutionUnknownError`
- No selector on the entry. An image visual with an empty `"query": {"queryState": {}}` rendered blank in the earlier check, so omit `query`
- `pbir add visual image "R.Report/P.Page" --name G --image "Sales.Gauge SVG"` in 0.9.33 writes `general.imageUrl` and an empty `query` instead; compare against the block above and render before shipping

## New card (`cardVisual`)

The card's own image area is the `image` object; the callout image is `cardImage`. Learn documents data-driven SVG images for this card visual, in the Image section and under Callout > Image ([card visual](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-card)).

```json
"image": [{
  "properties": {
    "show": {"expr": {"Literal": {"Value": "true"}}},
    "imageType": {"expr": {"Literal": {"Value": "'imageUrl'"}}},
    "imageUrl": {"expr": {"Measure": {"Expression": {"SourceRef": {"Schema": "extension", "Entity": "Sales"}}, "Property": "Revenue gauge"}}},
    "position": {"expr": {"Literal": {"Value": "'Top'"}}},
    "fit": {"expr": {"Literal": {"Value": "'Fit'"}}}
  },
  "selector": {"id": "default"}
}]
```

To show only the SVG, hide the card value and label. The value switch works without a selector; the label switch needs `{"id": "default"}`.

## Button slicer (`advancedSlicerVisual`) per-button image

The measure is evaluated in each button's context. The second entry needs both `id` and `hierarchyMatching` or the service ignores it:

```json
"image": [
  {"properties": {"show": {"expr": {"Literal": {"Value": "true"}}}, "sourceType": {"expr": {"Literal": {"Value": "'imageData'"}}}}, "selector": {"id": "default"}},
  {"properties": {"image": {"expr": {"Measure": {"Expression": {"SourceRef": {"Schema": "extension", "Entity": "Sales"}}, "Property": "Target pill"}}}},
   "selector": {"data": [{"dataViewWildcard": {"matchingOption": 1}}], "id": "default", "hierarchyMatching": 1}}
]
```

## Older wiring to avoid

`callout.imageFX` and `header.image` were an earlier card and slicer wiring in this repository and contradict the blocks above; do not use them.
