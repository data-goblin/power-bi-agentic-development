# Creating a New Report

Step-by-step workflow for creating Power BI reports from scratch using the pbir CLI.

## Prerequisites

- Fabric CLI authenticated (`fab auth login`)
- Know the target workspace and semantic model
- Optionally: active connection set via `pbir connect`

## Step-by-Step Process

### 1. Understand the Business Process

Before creating any visuals, research and think about the underlying business process that the semantic model represents. Use `pbir model <report> -d` to explore the model's tables, columns, measures, and hierarchies. Consider:

- What domain does this model cover? (sales, finance, operations, logistics, etc.)
- What are the key performance indicators (KPIs) and measures that matter?
- What dimensions and hierarchies exist for slicing data?
- What time granularity makes sense? (daily, weekly, monthly, quarterly)
- What types of reporting and analysis would provide valuable insights to the audience?

**Use `AskUserQuestion`** to present a concrete proposal of the visuals, layout, and formatting before building anything. The proposal should include:

- Which KPI cards to show and what measures they display
- What trend chart(s) to include and at what time granularity
- Which categorical breakdowns are most insightful
- What detail table/matrix to provide and with what hierarchies
- How filters and slicers should scope the data

Ask the user for confirmation or feedback on the proposal. Iterate on the design before executing -- it is much cheaper to revise a plan than to rebuild visuals.

### 2. Identify Location and Connection

Determine where the report should be created and what model it connects to.

**Use `AskUserQuestion`** to understand the report's purpose, audience, and what decisions it should support. This shapes page structure, visual choices, and field selection throughout the workflow.

If the user provides a workspace location, first create the report locally (in a folder named after the workspace, e.g. `workspaceName.Workspace/`), then publish it. Ideally the user has Git source control in the current working directory.

```bash
# Check available models in a workspace
pbir model                                       # List all known reports/models

# Or set active connection first
pbir connect MyWorkspace MyReport
```

### 3. Create the Report

Create a project folder first, then the report inside it. Default format is PBIP. New reports include:
- The **sqlbi** theme out of the box -- do NOT run `pbir theme apply-template` unless the user requests a different theme
- A default **Page 1** with a **textbox** visual for the page title at position (20,20) height 90 -- do NOT add a new textbox. **Place all visuals at y:120 or below** to avoid overlapping the title.

```bash
# Create project folder and report
mkdir -p sales-dashboard && cd sales-dashboard
pbir new report "Sales.Report" -c "MyWorkspace/Sales.SemanticModel"

# Create using active connection
pbir connect MyWorkspace MyReport
mkdir -p sales-dashboard && cd sales-dashboard
pbir new report "Sales.Report"

# Create from template
mkdir -p sales-dashboard && cd sales-dashboard
pbir new report "Sales.Report" -c "Workspace/Model.SemanticModel" --from-template executive
pbir new report --list-templates                  # See available templates
```

### 4. Rename Default Page and Add More Pages

The report already has a "Page 1" with a textbox. Rename it rather than creating a new page. Only add additional pages if needed.

```bash
# Rename the default page
pbir pages rename "Sales.Report/Page 1.Page" "Overview"

# Add more pages only if needed
pbir add page "Sales.Report/Detail.Page" -n "Detail" --width 1920 --height 1080
pbir add page "Sales.Report/Tooltip.Page" -n "Revenue Tooltip" --width 320 --height 240

# Set page types
pbir pages type "Sales.Report/Tooltip.Page" --type tooltip

# Set landing page
pbir pages active-page "Sales.Report" "Overview"
```

### 5. Configure Theme (only if user requests)

The sqlbi theme is already included by default. Only modify the theme if the user explicitly asks for a different theme or custom colors.

```bash
# Only if user wants a different theme:
pbir theme apply-template "Sales.Report" custom-theme

# Or to customize specific colors:
pbir theme set-colors "Sales.Report" --good "#00B050" --bad "#FF0000"
pbir theme set-text-classes "Sales.Report" title --font-size 16

# Set visual-type defaults in the theme
pbir theme set-formatting "Sales.Report" "card.*.border.radius" --value 8
pbir theme set-formatting "Sales.Report" "lineChart.*.title.fontSize" --value 14
```

### 6. Add Visuals to Pages

**Before placing any visuals, check the actual page dimensions** -- do not assume 1280x720. Use `pbir pages json "Report.Report/Page.Page"` or `page.width`/`page.height` via the object model. The object model validates that visuals fit within page bounds; setting position or size without knowing the page dimensions will cause errors. When resizing via the object model, set `width`/`height` before `x`/`y` to avoid intermediate states that exceed bounds.

Fill the canvas with a purposeful visual hierarchy. Aim for a complete analytical page, not a sparse layout. The standard composition for a 1280x720 page:

**Row 1 (y: 20-160): KPI visuals** -- 2-3 `kpi` visuals (preferred over `card`) showing headline metrics with targets and trend lines. Use prior-year measures as targets when available; if none exist, add them to the semantic model via Tabular Editor or TMDL editing. If no clear target exists, ask the user. Space KPIs evenly across the top with equal gaps.

**Row 2 (y: 180-460): Trend + Breakdown** -- A line/area chart showing metric evolution over time on the left (~60% width), and a bar/column chart showing breakdown by a key category on the right (~40% width). The time granularity for the trend should be inferred from the active filter context: if filtering by year, show monthly; if filtering by month, show daily or weekly; if no date filter, show monthly or quarterly.

**Row 3 (y: 480-700): Detail table/matrix** -- A tableEx or matrix that provides row-level detail with relevant hierarchies (e.g., customer hierarchy, product hierarchy). Apply conditional formatting to highlight variance or performance columns.

**Sorting**: All charts with measures are automatically sorted descending by the first bound measure. Verify sorting is present after creation; if binding fields separately via `pbir visuals bind`, explicitly set sort:

```bash
pbir visuals sort "Report.Report/Page.Page/Visual.Visual" -f "Table.Measure" -d Descending
```

**Avoid redundant titles and labels**: Information should appear exactly once on the canvas. Distribute meaning across the title hierarchy:

- **Page title** (textbox): The subject/metric (e.g., "Order Lines")
- **Visual titles**: Additional context that differentiates the visual (e.g., "by Key Account", "Monthly Trend", "Detail by Account")
- **Subtitles**: Almost always redundant -- hidden by default when `--title` is set

Bad: Page title "Order Lines by Key Account" + visual title "Order Lines by Key Account" + subtitle "Order Lines by Key Account Name" -- says the same thing three times.

Good: Page title "Order Lines" + visual titles "by Key Account", "Monthly Trend", "On-Time Delivery" -- each adds unique information.

Hide subtitles explicitly if binding fields after creation:

```bash
pbir visuals subtitle "Report.Report/Page.Page/Visual.Visual" --no-show
```

Similarly, hide axis titles when the axis label is self-evident from context (e.g., month names on x-axis don't need a "Month" axis title). Hide category labels on cards when the visual title already describes the metric. The principle: every label on the canvas should add information the viewer doesn't already have from surrounding context.

**Consistent spacing**: Calculate all positions from `(margin, gap, page_width, page_height)`. For a 1280x720 page with margin=24 and gap=16, the usable width is 1280-2*24=1232. Every vertical gap between rows must equal `gap`. Verify arithmetic before placing visuals.

**Example layout** (1280x720, margin=24, gap=16):

```bash
# Page title textbox -- already exists from report creation, no need to add one
# To resize the existing textbox if needed:
# pbir visuals resize "Sales.Report/Overview.Page/textbox.Visual" --width 1232 --height 56

# KPI visuals with targets and trend lines (y=88, h=160)
# 3 KPIs: each w=400, gaps: 24 + 400 + 16 + 400 + 16 + 400 + 24 = 1280
pbir add visual kpi "Sales.Report/Overview.Page" --title "Revenue" \
  -d "Indicator:Invoices.Turnover" -d "Goal:Invoices.Turnover 1YP" \
  -d "TrendLine:Date.Calendar Month (ie Jan)" \
  --x 24 --y 88 --width 400 --height 160

pbir add visual kpi "Sales.Report/Overview.Page" --title "Order Lines" \
  -d "Indicator:Orders.Order Lines" -d "Goal:Orders.Order Lines 1YP" \
  -d "TrendLine:Date.Calendar Month (ie Jan)" \
  --x 440 --y 88 --width 400 --height 160

pbir add visual kpi "Sales.Report/Overview.Page" --title "Margin %" \
  -d "Indicator:Invoices.Selling Margin (%)" -d "Goal:Invoices.Selling Margin (%) 1YP" \
  -d "TrendLine:Date.Calendar Month (ie Jan)" \
  --x 856 --y 88 --width 400 --height 160

# Trend chart (left, y=264, h=220)
pbir add visual lineChart "Sales.Report/Overview.Page" --title "Monthly Trend" \
  --x 24 --y 264 --width 608 --height 220

pbir visuals bind "Sales.Report/Overview.Page/Monthly Trend.Visual" \
  -a "Category:Date.Calendar Month (ie Jan)" -a "Y:Invoices.Turnover"

# Breakdown chart (right, y=264, h=220)
pbir add visual barChart "Sales.Report/Overview.Page" --title "by Region" \
  -d "Category:Regions.Territory" -d "Y:Invoices.Turnover" \
  --x 648 --y 264 --width 608 --height 220

# Detail table (full width, y=500, h=196)
pbir add visual tableEx "Sales.Report/Overview.Page" --title "Detail by Account" \
  --x 24 --y 500 --width 1232 --height 196

pbir visuals bind "Sales.Report/Overview.Page/Detail by Account.Visual" \
  -a "Values:Customers.Key Account Name" -a "Values:Products.Product Name" \
  -a "Values:Invoices.Turnover" -a "Values:Orders.Order Lines"
```

**Spacing verification** for the example above:
```
Title bottom:  16+56  = 72.   Gap to KPIs:   88-72   = 16  [ok]
KPI bottom:    88+160 = 248.  Gap to charts:  264-248 = 16  [ok]
Chart bottom:  264+220= 484.  Gap to table:   500-484 = 16  [ok]
Table bottom:  500+196= 696.  Bottom margin:  720-696 = 24  [ok]
Left margin:   24.  Right edge: 24+1232=1256.  Right margin: 1280-1256 = 24  [ok]
```

### 7. Add Filters

```bash
# Report-level filters
pbir add filter Date Year -r "Sales.Report" --values 2025
pbir add filter Geography Region -r "Sales.Report"

# Page-level filters
pbir add filter Products Category -p "Sales.Report/Detail.Page"
```

### 8. Format Visuals

Most formatting should already come from the theme (step 5). Only apply bespoke formatting for genuinely one-off cases. **Use `AskUserQuestion`** to discuss the visual hierarchy and formatting intent -- what should draw the eye, what's supporting context, what's the intended reading order. This informs whether to use theme-level or bespoke formatting.

```bash
# Bulk formatting via glob (requires -f for glob patterns)
pbir set "Sales.Report/**/*.Visual.title.show" --value true -f
pbir set "Sales.Report/**/*.Visual.border.show" --value true -f
pbir set "Sales.Report/**/*.Visual.border.radius" --value 8 -f

# Individual visual formatting
pbir visuals title "Sales.Report/Overview.Page/Revenue.Visual" --fontSize 14 --bold
pbir visuals background "Sales.Report/Overview.Page/Revenue.Visual" --color "#F8F9FA"
```

Run `pbir validate` after formatting changes to catch issues early.

### 9. Validate

```bash
pbir validate "Sales.Report"
pbir tree "Sales.Report" -v                      # Verify structure and field bindings
```

### 10. Publish or Open

```bash
# Publish to workspace
pbir publish "Sales.Report" "MyWorkspace/Sales"

# Or open locally
pbir open "Sales.Report"
```

## Common Report Patterns

### Executive Dashboard
- 2-3 KPI cards at top (revenue, orders, margin, etc.)
- 1 trend line/area chart showing evolution over time (monthly if yearly filter, daily/weekly if monthly)
- 1-2 breakdown charts (bar/column) by key categories
- 1 detail table or matrix with hierarchies and conditional formatting
- Page size: 1280x720 (16:9)

### Detailed Analysis
- Slicer bar at top (date range, category filters)
- Large table or matrix as main content with conditional formatting
- Supporting KPI cards for context
- Page size: 1280x720 or 1920x1080

### Tooltip Pages
- Small page (320x240 or similar)
- 2-3 focused visuals
- Set via `pbir pages type ... --type tooltip`

## Inferring Time Granularity from Filter Context

When adding trend visuals, infer the appropriate time axis from active filters:

| Active Filter | Trend Granularity | Date Column |
|---|---|---|
| Year (e.g., 2021) | Monthly | `Date.Calendar Month (ie Jan)` or `Date.Calendar Month Year (ie Jan 21)` |
| Quarter | Monthly or Weekly | `Date.Calendar Month (ie Jan)` or `Date.Calendar Week EU (ie WK25)` |
| Month | Daily or Weekly | `Date.Date` or `Date.Calendar Week EU (ie WK25)` |
| No date filter | Monthly or Quarterly | `Date.Calendar Month Year (ie Jan 21)` or `Date.Calendar Quarter Year (ie Q1 2021)` |

If unsure, default to monthly granularity -- it works well for most business reporting contexts.
