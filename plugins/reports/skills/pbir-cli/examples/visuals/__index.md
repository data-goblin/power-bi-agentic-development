# Visual Examples

Standalone `visual.json` examples for common Power BI visual types. Each file is a complete, valid visual container that can be dropped into a PBIR report's `visuals/` directory.

## default/

Minimal visuals with no bespoke formatting; relies entirely on theme defaults.

| File | Visual Type |
|------|------------|
| advancedSlicer.json | advancedSlicerVisual (button slicer) |
| areaChart.json | areaChart |
| barChart.json | barChart |
| card.json | card (legacy) |
| cardVisual.json | cardVisual (new card) |
| columnChart.json | columnChart |
| comboChart.json | lineStackedColumnComboChart |
| donutChart.json | donutChart |
| gauge.json | gauge |
| image.json | image |
| kpi.json | kpi |
| lineChart.json | lineChart |
| pivotTable.json | pivotTable (matrix) |
| scatterChart.json | scatterChart |
| slicer-dropdown.json | slicer (dropdown mode) |
| slicer-list.json | slicer (list mode) |
| stackedAreaChart.json | stackedAreaChart |
| tableEx.json | tableEx (flat table) |
| textbox.json | textbox |
| waterfallChart.json | waterfallChart |

## formatted/

Visuals with bespoke formatting, conditional formatting, filters, or advanced patterns.

| File | Visual Type | Formatting |
|------|------------|------------|
| actionButton.json | actionButton | Theme color styling on a navigation button |
| advancedSlicer-buttons.json | advancedSlicerVisual | Button slicer with custom selection colors |
| areaChart-multiple.json | areaChart | Multiple series with line styles and data point colors |
| barChart-bullet.json | barChart | Bullet chart pattern with conditional formatting and custom data point colors |
| barChart-divergent.json | barChart | Divergent bars (positive/negative) with conditional formatting |
| barChart-lollipop.json | barChart | Lollipop chart pattern with custom data point markers |
| barChart-progress.json | barChart | Progress bar pattern with themed data point colors |
| card.json | card | Theme color styling |
| card-with-filter.json | card | Gradient fill rule with a visual-level filter |
| cardVisual.json | cardVisual | Theme colors with SVG image and visual-level filter |
| clusteredBarChart-variance.json | clusteredBarChart | Variance analysis with custom data point colors |
| columnChart.json | columnChart | Custom data point colors and label formatting |
| comboChart.json | lineStackedColumnComboChart | Styled combo with line styles and data point colors |
| comboChart-flash.json | lineStackedColumnComboChart | Flash report combo; actuals as columns, targets as lines with visual-level filter |
| donutChart.json | donutChart | Gradient fill rule with custom slice colors |
| gauge.json | gauge | Gradient fill with themed target and data point colors |
| image-svg-measure.json | image | Image bound to an SVG-producing DAX measure |
| kpi.json | kpi | Styled KPI |
| kpi-flash.json | kpi | Flash report KPI with theme-colored indicator and goal |
| lineChart.json | lineChart | Custom line styles, markers, data point colors, and visual-level filter |
| lineChart-thresholds.json | lineChart | Reference lines (y-axis thresholds) with custom line styles |
| lineChart-visual-calcs.json | lineChart | Visual calculations with line styles |
| pivotTable-bullet-kpi.json | pivotTable | Matrix with inline SVG bullet chart KPI pattern, column widths, and visual-level filter |
| pivotTable-flash.json | pivotTable | Flash report matrix with gradient conditional formatting and custom column widths |
| scatterChart.json | scatterChart | Conditional formatting on scatter points |
| scatterChart-flash.json | scatterChart | Flash report scatter with gradient fill and themed colors |
| shape.json | shape | Decorative shape element |
| slicer.json | slicer | Styled slicer |
| slicer-flash.json | slicer | Flash report dropdown slicer with theme colors |
| stackedAreaChart.json | stackedAreaChart | Custom line styles and data point colors per series |
| tableEx-gradient.json | tableEx | Table with gradient conditional formatting (FillRule) and column widths |
| textbox.json | textbox | Styled title textbox |
| waterfallChart.json | waterfallChart | Custom waterfall sentiment colors |
| waterfallChart-flash.json | waterfallChart | Flash report waterfall with theme colors |
