# Enumerated Values

**Sources:**
- `examples/K201-MonthSlicer.Report/StaticResources/SharedResources/BaseThemes/CY24SU10.json` (bundled base theme)
- `examples/K201-MonthSlicer.Report/StaticResources/RegisteredResources/SqlbiDataGoblinTheme.json` (bundled custom theme)
- `examples/K201-MonthSlicer.Report/definition/pages/*/visuals/*/visual.json` (real visual examples)

This document lists valid string values for properties that accept enumerations.

Note that this is not an exhaustive list. Please pull the schema files directly to understand the schema if you need a comprehensive overview.

## Visual Types

Valid `visualType` values. **[K201]** = confirmed in K201 example; **[theme]** = confirmed from bundled theme files.

```
--- Charts ---
lineChart                          [K201] [theme]
areaChart                          [theme]
stackedAreaChart                   [theme]
hundredPercentStackedAreaChart     [theme]
barChart                           [theme]
clusteredBarChart                  [theme]
hundredPercentStackedBarChart      [theme]
columnChart                        [theme]
clusteredColumnChart               [theme]
hundredPercentStackedColumnChart   [theme]
lineClusteredColumnComboChart      [theme]
lineStackedColumnComboChart        [theme]
scatterChart                       [K201] [theme]
pieChart                           [theme]
donutChart                         [theme]
waterfallChart                     [theme]
ribbonChart                        [theme]
funnel                             [theme]
treemap                            [theme]
gauge                              [theme]
filledMap                          [theme]
map                                [theme]
azureMap                           [theme]
shapeMap                           [theme]

--- Tables ---
tableEx                            [K201] -- standard table visual
pivotTable                         [theme] -- matrix visual
multiRowCard                       [theme]

--- KPI & Cards ---
kpi                                [K201] [theme]
cardVisual                         [theme] -- new card visual
card                               [theme] -- classic card visual
scorecard                          [theme]

--- Slicers ---
slicer                             [theme]
advancedSlicerVisual               [K201] [theme] -- new slicer
listSlicer                         [theme]

--- AI & Advanced ---
aiNarratives                       [theme]
decompositionTreeVisual            [theme]
keyDriversVisual                   [theme]
qnaVisual                          [theme]

--- Script Visuals ---
pythonVisual                       [theme]
scriptVisual                       [theme]
rdlVisual                          [theme]

--- Layout & Navigation ---
group                              [theme]
basicShape                         [theme]
shape                              [theme]
image                              [theme]
actionButton                       [theme]
pageNavigator                      [theme]
bookmarkNavigator                  [theme]
textbox                            [K201] [theme]
filter                             [theme]

--- Internal ---
page                               [theme] -- theme visualStyles key ONLY; NOT a valid visualType in visual.json
```

## Common Property Values

### gridlineStyle
```
- "dotted"
- "solid" (inferred)
- "dashed" (inferred)
```

**Source:** theme.visualStyles.*.*.categoryAxis.gridlineStyle

### legend.position
```
- "Top"
- "Bottom"
- "Left"
- "Right"
- "TopCenter"
- "BottomCenter"
- "LeftCenter"
- "RightCenter"
```

**Source:** theme.visualStyles.pieChart.*.legend.position, K201 LineChart and ScatterChart examples

### labels.labelStyle
```
- "Data value, percent of total"
- (other styles to be documented)
```

**Source:** theme.visualStyles.pieChart.*.labels.labelStyle

### smallMultiplesLayout.gridLineType
```
- "inner"
- "outer" (inferred)
```

**Source:** theme.visualStyles.lineChart.*.smallMultiplesLayout.gridLineType

### lineChartType (lineStyles)
```
- "smooth"
- "straight"
- "stepped"
```

**Source:** visual.json examples

### markerRangeType
```
- "auto"    -- Automatic range based on data
- "magnitude" -- Range based on value magnitude
```

**Source:** theme.visualStyles.scatterChart.*.bubbles.markerRangeType, K201 ScatterChart example

## Boolean Properties

Common boolean properties (true/false):
- show
- showAxisTitle
- concatenateLabels
- titleWrap
- wordWrap
- responsive
- showGradientLegend
- matchSeriesInterpolation
- showMarker
- segmentGradient
- areaShow
- enabled
- barMatchSeriesColor
- border
- fixedSize
- keepLayerOrder

## Numeric Properties

### Transparency
Range: 0-100
- 0 = fully opaque
- 100 = fully transparent

**Examples from theme:**
- line.transparency: 0
- outline.transparency: 0
- plotArea.transparency: 0
- background.transparency: 0
- trendline.transparency: 20
- page.background.transparency: 100

### Stroke/Line Width
Type: Numeric with "D" suffix
**Examples:**
- lineStyles.strokeWidth: 3 (from theme)
- border.width: 1 (from theme)

### Font Sizes
Type: Numeric (int or with "D" suffix)
**Examples from theme.textClasses:**
- callout.fontSize: 45
- title.fontSize: 12
- header.fontSize: 12
- label.fontSize: 10

### Marker/Bubble Sizes
Type: Numeric (can be negative for auto-scaling)
**Examples:**
- markerSize: 8D, 10D (from visuals)
- bubbleSize: -10 (from theme scatterChart)
- bubbleRadius: 8 (from theme azureMap)
- minBubbleRadius: 8
- maxRadius: 40

### Padding/Spacing
Type: Numeric
**Examples:**
- items.padding: 4 (from theme slicer)
- outlineWeight: 2 (from theme multiRowCard)
- barWeight: 2

### Bar/Column Dimensions
Type: Numeric with suffixes
**Examples:**
- barWidth: 10D (from visual)
- barBorderSize: 0L (from visual)
- barHeight: 3 (from theme azureMap)
- thickness: 3

## Color Properties

### Hex Colors
Format: "#RRGGBB"

**Examples from theme.dataColors:**
```
"#118DFF", "#12239E", "#E66C37", "#6B007B", "#E044A7",
"#744EC2", "#D9B300", "#D64550", "#197278", "#1AAB40"
```

### Named Theme Colors
Properties available in theme root:
- foreground
- foregroundNeutralSecondary
- foregroundNeutralTertiary
- background
- backgroundLight
- backgroundNeutral
- tableAccent
- good
- neutral
- bad
- maximum
- center
- minimum
- null
- hyperlink
- visitedHyperlink

### ThemeDataColor.ColorId
Range: 0 to (dataColors.length - 1)

In CY24SU10 theme: 0-44 (45 colors)

### ThemeDataColor.Percent
Range: -1.0 to 1.0
- Negative = darker (e.g. -0.5 = 50% darker)
- 0 = exact theme color
- Positive = lighter (e.g. 0.4 = 40% lighter)

## Font Properties

### fontFace (Font Family)
**Examples from theme:**
- "DIN"
- "Segoe UI"
- "Segoe UI Semibold"

Common fonts (to be confirmed):
- "Segoe UI"
- "Segoe UI Light"
- "Segoe UI Semibold"
- "Arial"
- "Calibri"
- "Georgia"
- "Verdana"

## Object-Specific Properties

### categoryAxis / valueAxis
- showAxisTitle: boolean
- gridlineStyle: string (see above)
- concatenateLabels: boolean (categoryAxis only)
- show: boolean (y2Axis, valueAxis)
- end: numeric with D suffix (axis range)

### title
- titleWrap: boolean
- show: boolean (inferred)
- text: string (inferred)
- fontSize: numeric
- fontFace: string
- color: color expression

### lineStyles
- strokeWidth: numeric
- lineChartType: string (see enumerations above)
- lineStyle: string (see below)
- showMarker: boolean
- markerShape: string (see below)
- markerSize: numeric with D suffix
- segmentGradient: boolean
- areaShow: boolean
- transparency: numeric 0-100

### markerShape
```
- "circle"   (confirmed from SqlbiDataGoblinTheme.json)
- "square"   (likely valid)
- "diamond"  (likely valid)
- "triangle" (likely valid)
- "x"        (likely valid)
```

**Source:** SqlbiDataGoblinTheme.json `lineStyles.markerShape`

### lineStyle
Controls line dash pattern (distinct from `lineChartType` which controls smooth/stepped/straight):
```
- "solid"   (confirmed from SqlbiDataGoblinTheme.json)
- "dashed"  (likely valid)
- "dotted"  (likely valid)
```

**Source:** SqlbiDataGoblinTheme.json `lineStyles.lineStyle`

### background
- show: boolean
- transparency: numeric 0-100
- backgroundColor/color: color expression

### border
- show: boolean (inferred)
- width: numeric
- color: color expression (inferred)

### general
- responsive: boolean
- keepLayerOrder: boolean

### legend
- show: boolean
- position: string (see enumerations above)
- showGradientLegend: boolean

### smallMultiplesLayout
- backgroundTransparency: numeric 0-100
- gridLineType: string (see enumerations above)

## Notes

- Values marked "(inferred)" are logical opposites or common patterns not yet seen in examples
- Values marked "(to be confirmed)" are from documentation but not yet seen in actual visuals
- This list will expand as we test more properties
