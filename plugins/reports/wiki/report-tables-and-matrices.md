---
title: "Tables and matrices: which visual, widths, subtotals, sparklines"
summary: "Power BI specifics for tableEx and pivotTable: choosing between them, auto-size width, default collapse, sparklines and sizing."
kind: reference
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-tables
  - url: https://learn.microsoft.com/en-us/power-bi/visuals/desktop-matrix-visual
tools:
  pbir: 0.9.33
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - pbir schema roles pivotTable
  - pbir schema describe tableEx columnHeaders
  - pbir visuals table-density --help
skills: [reports/pbi-report-design]
---

# Tables and matrices

[Learn: tables](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-tables) and [matrix](https://learn.microsoft.com/en-us/power-bi/visuals/desktop-matrix-visual) cover the UI. Define the question, audience and action before building one; a table that answers none becomes an unused report.

## Which visual

```yaml
tableEx:    a flat list of records; role Values
pivotTable: the matrix; roles Rows, Columns, Values. Use it when two or more categorical columns form a hierarchy (Key Account, Account, Product) or when categories sit on both axes
```

A flat table that repeats parent values on every row is the usual mistake. Bind rows broadest first:

```bash
pbir add visual pivotTable "R.Report/P.Page" --name DetailMatrix --title "Detail" \
  -d "Rows:Customers.Key Account" -d "Rows:Customers.Account" -d "Values:Orders.Net Orders"
pbir visuals bind "R.Report/P.Page/DetailMatrix.Visual" --add "Columns:Date.Quarter" --type Column
```

## Behaviour to know

- A matrix starts collapsed at the top level and shows subtotals at every level; both are usually right. Hide intermediate subtotals past about four levels
- **Auto-size width**: turn off `columnHeaders.autoSizeColumnWidth` when the visual shares a row with another visual, otherwise content-based widths overflow and produce a horizontal scrollbar that hides whole columns. With it off, columns share the width proportionally and long text truncates. A full-width table can leave it on
- The two native width modes are exclusive: stretch (`autoSizeColumnWidth=false`, `columnAdjustment=growToFit`) or fit to content (`true`, `fitToContent`); remove stale `columnWidth` overrides when switching
- No vertical-alignment property exists for values; `pbir visuals table-density` reduces row padding and image height
- Sparklines add the "improving or declining" context a number cannot; add the measure with `pbir visuals bind` and report a capability gap if pbir cannot author the date projection. Richer inline graphics (bullets, dumbbells) are SVG measures from the `svg-visuals` skill
- Size: height for the header plus five to eight rows; `pbir validate --qa` flags `tableEx` under 300x200

## Format by subtracting

Remove gridlines and heavy banding and let whitespace separate rows; sort by the main measure or variance, not alphabetically; show full precision (a table is where readers go for detail); put dimensions left, the primary measure next and variance right. Apply data bars to the primary measure and colour scales to variance columns only: formatting every column means nothing stands out ([conditional formatting](pbir-conditional-formatting.md)). Give the visual a title that differs from the page title and hide the redundant subtitle.
