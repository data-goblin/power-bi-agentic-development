# SVG Community Examples and Libraries

Organized by target visual type. Use these as reference when building SVG DAX measures.

## Libraries (UDF-based)

| Library | Author | Visual Target | Key Features | URL |
|---|---|---|---|---|
| PowerofBI.IBCS | Andrzej Leszkiewicz | Table/Matrix | IBCS-compliant bar, column, waterfall, pin, small multiples, P&L | https://daxlib.org/package/PowerofBI.IBCS/ |
| DaxLib.SVG | Jake Duddy | Table/Matrix | UDF library with 3-tier API (Viz/Compound/Element) | https://daxlib.org/package/DaxLib.SVG/ (source: https://github.com/daxlib/dev-daxlib-svg) |
| PBI-Core-Visuals-SVG-HTML | Various contributors | Table/Matrix | Chips, tornado, gradient matrix, bar UDF | https://github.com/nickvdw2/PBI-Core-Visuals-SVG-HTML |
| PowerBI MacGuyver Toolbox | Stepan Resl / Data Goblins | Card/Image | 20+ bar, 14+ line, 24+ KPI templates | https://github.com/data-goblin/powerbi-macguyver-toolbox |
| Dashboard Design UDF Library | Dashboard-Design | Table/Matrix | Target line bars, pill visuals | https://github.com/Dashboard-Design/Dashboard-Design-UDF-Library |
| Kerry Kolosko Templates | Kerry Kolosko | Image/Table/Matrix | Sparklines, data bars, gauges, KPI cards | https://kerrykolosko.com/portfolio-category/svg-templates/ |

See also `references/svg-table-matrix.md` for the UDF pattern and calling convention.

## PowerofBI.IBCS Functions (Andrzej Leszkiewicz)

IBCS-compliant SVG chart functions for business reporting. Install via DaxLib: https://daxlib.org/package/PowerofBI.IBCS/ -- source: https://github.com/avatorl/dax-udf-svg-ibcs

All functions target Table/Matrix visuals. Uses DAX UDF syntax with typed parameters.

### Bar Charts (horizontal)

| Function | Description |
|---|---|
| `PowerofBI.IBCS.BarChart.AbsoluteValues` | AC bar vs PY/BU base bar with data label. Base styling: `"grey"` (PY) or `"outlined"` (BU) |
| `PowerofBI.IBCS.BarChart.AbsoluteVariance` | Diverging bar showing absolute delta (AC-PY). Green/red by businessImpact. Hatched fill when FC present |
| `PowerofBI.IBCS.BarChart.RelativeVariance` | Pin chart showing % delta. Capped at +/-100% with outlier triangles. Hatched pinhead when FC present |
| `PowerofBI.IBCS.BarChart.WithAbsoluteVariance` | Compact: PY grey bar + AC black bar + colored variance bar. Auto-scaled to ALLSELECTED |

### Column Charts (vertical)

| Function | Description |
|---|---|
| `PowerofBI.IBCS.ColumnChart.WithAbsoluteVariance` | Monthly AC/FC columns + PY triangles + variance bars. Hatched FC, solid AC |
| `PowerofBI.IBCS.ColumnChart.WithWaterfall` | Multi-tier: columns + waterfall + relative pins. 3 tiers or responsive CSS. Most complex function |
| `PowerofBI.IBCS.ColumnChart.Stacked` | Stacked columns with top-N product groups + "Other". Highlight selected group |
| `PowerofBI.IBCS.ColumnChart.SmallMultiple` | Small multiple cards: absolute values, absolute variance, or relative variance modes |
| `PowerofBI.IBCS.ColumnChart.AbsoluteVarianceWide` | Wide single-column: AC vs PY with variance bar and labels |

### Waterfall / P&L

| Function | Description |
|---|---|
| `PowerofBI.IBCS.Waterfall.Vertical` | Vertical P&L waterfall with hierarchical structure (level-1/level-2). AC/PY/PL styling. Connector lines, subtotal markers |

### Extras

| Function | Description |
|---|---|
| `PowerofBI.IBCS.Extras.PieChart.PctOfTotal` | Pie chart showing percentage of total. Optional toggle, bold totals |
| `PowerofBI.IBCS.Helpers.Title` | Multi-line IBCS title (what/how/when) joined with UNICHAR(10) |

## DaxLib.SVG Functions (Jake Duddy)

High-level `Viz.*` functions -- each produces a complete SVG data URI for Table/Matrix Image URL columns:

| Function | Chart Type |
|---|---|
| `Viz.Area` | Area chart |
| `Viz.Bars` | Bar chart |
| `Viz.Boxplot` | Box plot |
| `Viz.Heatmap` | Heatmap |
| `Viz.Jitter` | Jitter plot |
| `Viz.Line` | Line / Sparkline |
| `Viz.Pill` | Pill badge |
| `Viz.ProgressBar` | Progress bar |
| `Viz.Violin` | Violin plot |

Mid-level `Compound.*` functions create positionable chart components you combine with `SVG()` wrapper. Low-level `Element.*` functions create raw SVG primitives (rect, circle, line, polyline, text, path, group).

Docs: https://evaluationcontext.github.io/daxlib.svg/

## Examples by Target Visual: Table / Matrix

SVG measures rendered in table/matrix cells via Image URL column binding. DaxLib.SVG and PowerofBI.IBCS functions (listed above) all target Table/Matrix.

### Kerry Kolosko (kerrykolosko.com/portfolio/)

| Template | Chart Type | URL |
|---|---|---|
| Progress Callout | Progress bar with % | https://kerrykolosko.com/portfolio/progress-callout/ |
| Progress Bars | Bullet + progress | https://kerrykolosko.com/portfolio/progress-bars/ |
| Gradient Area Sparkline | Area sparkline with last point | https://kerrykolosko.com/portfolio/gradient-area-sparkline-with-last-point/ |
| Sparklines | Area + gradient sparkline | https://kerrykolosko.com/portfolio/sparklines/ |
| Gradient Sparklines | Line + area gradient | https://kerrykolosko.com/portfolio/gradient-sparklines/ |
| Circular Gauges | Pie gauge + radial gauge | https://kerrykolosko.com/portfolio/circular-gauges/ |
| Range Bars | Min/max/avg range | https://kerrykolosko.com/portfolio/range-bars/ |
| KPI Card | KPI with gauge bar | https://kerrykolosko.com/portfolio/kpi-card/ |
| Data Bars | Diverging pos/neg bars | https://kerrykolosko.com/portfolio/data-bars/ |

### PowerBI MacGuyver Toolbox (Kurt Buhler / Data Goblins, SVG measures by Stepan Resl)

MacGuyver Toolbox provides both native Power BI visual templates (bar/line/KPI patterns) and SVG DAX measures. The SVG measures are added via C# scripts in Tabular Editor. See `examples/` for extracted DAX measures from this toolbox.

## Examples by Target Visual: Image

SVG measures rendered in standalone Image visuals via `sourceType='imageData'`.

### Kerry Kolosko (kerrykolosko.com/portfolio/)

| Template | Chart Type | URL |
|---|---|---|
| Gauges with Tracks | Semicircular gauge | https://kerrykolosko.com/portfolio/gauges-with-tracks/ |
| Gauge with States | Radial gauge with dial | https://kerrykolosko.com/portfolio/gauge-with-states/ |
| Sparklines with Intercept | Line sparkline + intercept line | https://kerrykolosko.com/portfolio/sparklines-with-intercept/ |
| Area Sparklines with Intercept | Area sparkline + intercept | https://kerrykolosko.com/portfolio/area-sparklines-with-intercept/ |
| Barcode & Jitter Scatter | Barcode + jitter plot | https://kerrykolosko.com/portfolio/barcode-jitter-scatter/ |
| Waterfall | Waterfall chart | https://kerrykolosko.com/portfolio/waterfall/ |
| Boxplots and Dumbells | Box plot + dumbbell | https://kerrykolosko.com/portfolio/boxplots-and-dumbells/ |
| Radial Plot Backgrounds | Concentric axis backgrounds | https://kerrykolosko.com/portfolio/radial-plot-backgrounds/ |
| Progress with Icons | Progress bar + icon callouts | https://kerrykolosko.com/portfolio/progress-with-icons/ |
| Lollipop Sparkline | Lollipop sparkline + square variant | https://kerrykolosko.com/portfolio/lollipop-sparkline/ |

## Examples by Target Visual: Card (New)

SVG measures rendered in the new Card visual via `callout.imageFX`.

### PowerBI MacGuyver Toolbox (Stepan Resl / Data Goblins)

KPI card templates using SVG measures for inline micro-charts in card visuals:

| Template | Chart Type | Repo Path |
|---|---|---|
| KPI Bar | Bar in card | `kpi-cards/kpi-bar/` |
| KPI Bullet | Bullet in card | `kpi-cards/kpi-bullet/` |
| KPI Doughnut | Donut in card | `kpi-cards/kpi-doughnut/` |
| KPI Gauge | Gauge in card | `kpi-cards/kpi-gauge/` |
| KPI Sparkline Trend | Sparkline in card | `kpi-cards/kpi-sparkline-trend/` |
| KPI Trend Bar | Trend bar in card | `kpi-cards/kpi-trend-bar/` |
| KPI Trend Comparison | Trend comparison in card | `kpi-cards/kpi-trend-comparison/` |
| KPI Trend Line | Trend line in card | `kpi-cards/kpi-trend-line/` |
| Waffle Text | Waffle in card | `kpi-cards/waffle-text/` |
| Star Rating Text | Star rating in card | `kpi-cards/star-rating-text/` |

Repo: https://github.com/data-goblin/powerbi-macguyver-toolbox
