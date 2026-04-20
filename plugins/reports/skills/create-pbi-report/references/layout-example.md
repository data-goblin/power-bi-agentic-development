# Layout Example and Time Granularity

## Executive Dashboard Layout (1280x720, margin=24, gap=16)

```bash
# Page title textbox
pbir add visual textbox "Sales.Report/Overview.Page" \
  --x 24 --y 16 --width 1232 --height 56

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

## Spacing Verification

```
Title bottom:  16+56  = 72.   Gap to KPIs:   88-72   = 16  [ok]
KPI bottom:    88+160 = 248.  Gap to charts:  264-248 = 16  [ok]
Chart bottom:  264+220= 484.  Gap to table:   500-484 = 16  [ok]
Table bottom:  500+196= 696.  Bottom margin:  720-696 = 24  [ok]
Left margin:   24.  Right edge: 24+1232=1256.  Right margin: 1280-1256 = 24  [ok]
```

## KPI Targets

Use prior-year measures as targets when available. If none exist, add the measure to the semantic model via Tabular Editor or by editing the TMDL files directly:

```
# In the relevant table's .tmdl file, add:
measure 'Measure 1YP' = CALCULATE([Measure], DATEADD('Date'[Date], -1, YEAR))
```

If no clear target exists, ask the user via `AskUserQuestion`.

## Inferring Time Granularity from Filter Context

When adding trend visuals, infer the appropriate time axis from active filters:

| Active Filter | Trend Granularity | Date Column |
|---|---|---|
| Year (e.g., 2021) | Monthly | `Date.Calendar Month (ie Jan)` or `Date.Calendar Month Year (ie Jan 21)` |
| Quarter | Monthly or Weekly | `Date.Calendar Month (ie Jan)` or `Date.Calendar Week EU (ie WK25)` |
| Month | Daily or Weekly | `Date.Date` or `Date.Calendar Week EU (ie WK25)` |
| No date filter | Monthly or Quarterly | `Date.Calendar Month Year (ie Jan 21)` or `Date.Calendar Quarter Year (ie Q1 2021)` |

If unsure, default to monthly granularity -- it works well for most business reporting contexts.

## Title Hierarchy

Distribute meaning across the title hierarchy to avoid redundancy:

- **Page title** (textbox): The subject/metric (e.g., "Order Lines")
- **Visual titles**: Additional context that differentiates the visual (e.g., "by Key Account", "Monthly Trend", "Detail by Account")
- **Subtitles**: Almost always redundant -- hide by default when `--title` is set

Bad: Page title "Order Lines by Key Account" + visual title "Order Lines by Key Account" + subtitle "Order Lines by Key Account Name" -- says the same thing three times.

Good: Page title "Order Lines" + visual titles "by Key Account", "Monthly Trend", "On-Time Delivery" -- each adds unique information.

Hide subtitles explicitly:

```bash
pbir visuals subtitle "Report.Report/Page.Page/Visual.Visual" --no-show
```

Hide axis titles when the axis label is self-evident (e.g., month names on x-axis don't need a "Month" axis title). Hide category labels on cards when the visual title already describes the metric.
