---
name: r-visuals
description: Maintains and migrates R script visuals (scriptVisual, ggplot2) in PBIR reports; R and Python visuals retire in May 2027, including R-powered custom visuals. Use for "R visual", "scriptVisual", "ggplot2 in Power BI", "inject an R script", "R visual blank in the service", and "what breaks in May 2027" questions. New charts should go to Deneb, a built-in visual, an SVG measure or a pbiviz custom visual instead.
---

# R visuals (retiring May 2027)

## Rules

- R and Python visuals, including R-powered custom visuals from AppSource, retire in May 2027: the service stops rendering them in published reports and future Desktop versions drop them. Say this before building one. Source and migration options: [retirement page](../../wiki/script-visuals-retirement.md)
- Build a new R visual only to maintain a report that already has them; otherwise use `deneb-visuals`, `svg-visuals`, a built-in visual or `powerbi-custom-visuals`
- Finding affected visuals in PBIP sources (`visualType` values, and what the search misses) is on the [retirement page](../../wiki/script-visuals-retirement.md)
- `dataset` is a data.frame injected by Power BI; ggplot objects must be printed (`print(p)`); the service supports one fixed CRAN list on R 4.3.3: [Learn package list](https://learn.microsoft.com/en-us/power-bi/connect-data/service-r-packages-support)
- Desktop passes but the service is blank: check, in order, the missing `powerbi_rEnableShowText = 1` first line (text labels), a package outside the list or one needing the network, the 60 second timeout, and HTML/XML-based packages (out of memory in the service; Learn says to move those to a custom visual); the rest is on the traps page. Details: [service traps](../../wiki/r-visual-service-traps.md)
- Same limits as Python visuals: 150,000 rows, 250 MB input, grouped rows, 72 DPI, no cross-filter source, no tooltips, no Publish to web; Desktop output is capped at 2 MB. See [dataset and limits](../../wiki/script-visual-dataset-and-limits.md)
- Not supported: DirectQuery for Analysis Services, printing with the report

## Commands (pbir 0.9.33)

```bash
pbir add visual scriptVisual "Report.Report/Page.Page" --name RChart -d "Values:Sales.Date" -d "Values:Sales.Revenue"
pbir visuals r "Report.Report/Page.Page/RChart.Visual" --script-file chart.R
pbir visuals bind "Report.Report/Page.Page/RChart.Visual" --show
pbir validate "Report.Report" --all
```

The `r-reviewer` agent ships with the reports plugin; without that plugin installed, skip the review step and run `pbir validate`.

## Migrating an R visual

```yaml
ggplot bar / line / scatter / heatmap / boxplot: Deneb Vega-Lite (deneb-visuals)
chart with a built-in equivalent: the built-in visual
small chart inside a table cell: SVG measure (svg-visuals)
reusable interactive chart or an R-powered custom visual: pbiviz custom visual (powerbi-custom-visuals)
forecast, regression, ridgeline, correlation matrix: Fabric notebook
```
