# Visual-Type Override Index

Reference index for `visualStyles["<type>"]["*"]` theme overrides. Each visual type has its own file in `examples/visualTypes/<type>.md` with verified containers, key properties, and a JSON snippet.

**Always verify property names with `pbir schema`:**
```bash
pbir schema containers <type>          # list containers
pbir schema describe <type>.<container> # list properties + types
```

## All Visual Types (49)

### Container / Decorative

| Type | File | Notes |
|------|------|-------|
| `textbox` | [textbox.md](../examples/visualTypes/textbox.md) | Suppress all container chrome |
| `image` | [image.md](../examples/visualTypes/image.md) | Suppress title/border/shadow |
| `shape` | [shape.md](../examples/visualTypes/shape.md) | Suppress all container chrome |
| `actionButton` | [actionButton.md](../examples/visualTypes/actionButton.md) | Has `default`/`hover`/`active`/`disabled` states |
| `group` | [group.md](../examples/visualTypes/group.md) | Container chrome only |
| `bookmarkNavigator` | [bookmarkNavigator.md](../examples/visualTypes/bookmarkNavigator.md) | Navigation button bar |

### KPI and Card

| Type | File | Notes |
|------|------|-------|
| `card` | [card.md](../examples/visualTypes/card.md) | Legacy card — `labels.color`, not `fontColor` |
| `cardVisual` | [cardVisual.md](../examples/visualTypes/cardVisual.md) | New card visual — `label`/`value` containers |
| `kpi` | [kpi.md](../examples/visualTypes/kpi.md) | `trendline` (lowercase), not `trendLine` |
| `multiRowCard` | [multiRowCard.md](../examples/visualTypes/multiRowCard.md) | Bar via `card.barShow`, not a `bar` container |

### Slicers

| Type | File | Notes |
|------|------|-------|
| `slicer` | [slicer.md](../examples/visualTypes/slicer.md) | `items`/`header` — uses `textSize` not `fontSize` |
| `advancedSlicerVisual` | [advancedSlicerVisual.md](../examples/visualTypes/advancedSlicerVisual.md) | Card-style — `label`/`value` containers |
| `listSlicer` | [listSlicer.md](../examples/visualTypes/listSlicer.md) | New list slicer — same structure as `advancedSlicerVisual` |
| `textSlicer` | [textSlicer.md](../examples/visualTypes/textSlicer.md) | Search/text slicer — `inputText`/`inputTextBox` |

### Bar / Column Family

All share the same core containers: `categoryAxis`, `valueAxis`, `legend`, `labels`, `dataPoint`.

| Type | File | Unique containers |
|------|------|-------------------|
| `barChart` | [barChart.md](../examples/visualTypes/barChart.md) | Base reference for the family |
| `clusteredBarChart` | [clusteredBarChart.md](../examples/visualTypes/clusteredBarChart.md) | Same as `barChart` |
| `clusteredColumnChart` | [clusteredColumnChart.md](../examples/visualTypes/clusteredColumnChart.md) | Same as `barChart` |
| `columnChart` | [columnChart.md](../examples/visualTypes/columnChart.md) | Adds `totals`, `ribbonBands` |
| `hundredPercentStackedBarChart` | [hundredPercentStackedBarChart.md](../examples/visualTypes/hundredPercentStackedBarChart.md) | Same as `barChart` + `ribbonBands`, `totals` |
| `hundredPercentStackedColumnChart` | [hundredPercentStackedColumnChart.md](../examples/visualTypes/hundredPercentStackedColumnChart.md) | Same as `barChart` + `ribbonBands`, `totals` |
| `ribbonChart` | [ribbonChart.md](../examples/visualTypes/ribbonChart.md) | Adds `ribbonBands` |

### Line / Area Family

All share: `categoryAxis`, `valueAxis`, `legend`, `labels`, `dataPoint`.

| Type | File | Unique containers |
|------|------|-------------------|
| `lineChart` | [lineChart.md](../examples/visualTypes/lineChart.md) | Base reference; adds `lineStyles`, `markers` |
| `areaChart` | [areaChart.md](../examples/visualTypes/areaChart.md) | Same as `lineChart` |
| `stackedAreaChart` | [stackedAreaChart.md](../examples/visualTypes/stackedAreaChart.md) | Same as `lineChart` + `totals`, `seriesLabels` |
| `hundredPercentStackedAreaChart` | [hundredPercentStackedAreaChart.md](../examples/visualTypes/hundredPercentStackedAreaChart.md) | Same as `stackedAreaChart` |

### Combo Charts

| Type | File | Notes |
|------|------|-------|
| `lineClusteredColumnComboChart` | [lineClusteredColumnComboChart.md](../examples/visualTypes/lineClusteredColumnComboChart.md) | `lineChart` + `barChart`; dual `valueAxis` |
| `lineStackedColumnComboChart` | [lineStackedColumnComboChart.md](../examples/visualTypes/lineStackedColumnComboChart.md) | Same as above + `totals` |

### Other Charts

| Type | File | Notes |
|------|------|-------|
| `scatterChart` | [scatterChart.md](../examples/visualTypes/scatterChart.md) | No `labels` container |
| `pieChart` | [pieChart.md](../examples/visualTypes/pieChart.md) | `labels`/`legend`/`slices` |
| `donutChart` | [donutChart.md](../examples/visualTypes/donutChart.md) | Same as `pieChart` |
| `funnel` | [funnel.md](../examples/visualTypes/funnel.md) | `labels`/`categoryAxis`/`percentBarLabel` |
| `waterfallChart` | [waterfallChart.md](../examples/visualTypes/waterfallChart.md) | Unique `sentimentColors` container |
| `gauge` | [gauge.md](../examples/visualTypes/gauge.md) | `calloutValue`/`labels` |
| `treemap` | [treemap.md](../examples/visualTypes/treemap.md) | `legend`/`labels` |

### Table and Matrix

| Type | File | Notes |
|------|------|-------|
| `tableEx` | [tableEx.md](../examples/visualTypes/tableEx.md) | `backColor` not `backgroundColor` |
| `pivotTable` | [pivotTable.md](../examples/visualTypes/pivotTable.md) | Matrix — `pivotTable` not `matrix` |
| `scorecard` | [scorecard.md](../examples/visualTypes/scorecard.md) | Power BI scorecard / goals |

### Maps

| Type | File | Notes |
|------|------|-------|
| `map` | [map.md](../examples/visualTypes/map.md) | Bing map — `legend`/`dataPoint`/`categoryLabels` |
| `azureMap` | [azureMap.md](../examples/visualTypes/azureMap.md) | Azure Maps — many layer-specific containers |
| `filledMap` | [filledMap.md](../examples/visualTypes/filledMap.md) | Choropleth — `dataPoint`/`legend` |
| `shapeMap` | [shapeMap.md](../examples/visualTypes/shapeMap.md) | Custom shape map — `dataPoint`/`legend` |

### Specialized / AI / Navigation

| Type | File | Notes |
|------|------|-------|
| `decompositionTreeVisual` | [decompositionTreeVisual.md](../examples/visualTypes/decompositionTreeVisual.md) | `levelHeader`/`dataLabels`/`dataBars` |
| `keyDriversVisual` | [keyDriversVisual.md](../examples/visualTypes/keyDriversVisual.md) | AI insights — limited theming |
| `aiNarratives` | [aiNarratives.md](../examples/visualTypes/aiNarratives.md) | AI text — `text`/`summary` containers |
| `scorecard` | — | See Table/Matrix above |

### Script / External Renderers

Container chrome only — the rendered output itself is not themeable via `visualStyles`.

| Type | File | Notes |
|------|------|-------|
| `pythonVisual` | [pythonVisual.md](../examples/visualTypes/pythonVisual.md) | matplotlib/seaborn — chrome only |
| `scriptVisual` | [scriptVisual.md](../examples/visualTypes/scriptVisual.md) | R ggplot2 — chrome only |
| `rdlVisual` | [rdlVisual.md](../examples/visualTypes/rdlVisual.md) | Paginated reports — chrome only |
| `qnaVisual` | [qnaVisual.md](../examples/visualTypes/qnaVisual.md) | Q&A — `inputBox`/`suggestions` |
| `filter` | [filter.md](../examples/visualTypes/filter.md) | Filter card entity — `general` only |

