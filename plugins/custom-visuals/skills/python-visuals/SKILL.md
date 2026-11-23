---
name: python-visuals
description: Maintains and migrates Python script visuals (pythonVisual, matplotlib, seaborn) in PBIR reports; Python visuals retire in May 2027. Use for "Python visual", "pythonVisual", "matplotlib in Power BI", "seaborn in Power BI", "inject a Python script", and for "what breaks in May 2027" questions. New charts should go to Deneb, a built-in visual, an SVG measure or a pbiviz custom visual instead.
---

# Python visuals (retiring May 2027)

## Rules

- Python and R visuals retire in May 2027: published reports stop rendering them in the service, including already published ones, and future Desktop versions drop them. Say this before building one. Source and migration options: [retirement page](../../wiki/script-visuals-retirement.md). Python in Power Query is not affected
- Build a new Python visual only to maintain a report that already has them; otherwise use `deneb-visuals`, `svg-visuals`, a built-in visual or `powerbi-custom-visuals`
- Finding affected visuals in PBIP sources (`visualType` values, and what the search misses) is on the [retirement page](../../wiki/script-visuals-retirement.md)
- The script must end with `plt.show()` (only the default display device renders); `dataset` is a pandas DataFrame injected by Power BI, never created; columns keep their original names
- The service has no network, Python 3.11 and a fixed package list: [Learn package list](https://learn.microsoft.com/en-us/power-bi/connect-data/service-python-packages-support). plotly, bokeh and altair are not on it and the output is a static image anyway
- 150,000 rows, 250 MB input, strings cut at 32,766 characters, 72 DPI, and shorter timeouts in the service than in Desktop. Row grouping and the other caps: [dataset and limits](../../wiki/script-visual-dataset-and-limits.md)
- Not supported: cross-filtering from the visual, tooltips, Publish to web, app-owns-data embedding (ended May 2026), an unlicensed viewer outside Premium or Fabric capacity

## Commands (pbir 0.9.33)

```bash
pbir add visual pythonVisual "Report.Report/Page.Page" --name PyChart -d "Values:Sales.Date" -d "Values:Sales.Revenue"
pbir visuals python "Report.Report/Page.Page/PyChart.Visual" --script-file chart.py
pbir visuals bind "Report.Report/Page.Page/PyChart.Visual" --show
pbir validate "Report.Report" --all
```

The script lands in `visual.objects.script[0].properties.source` with `provider` `'Python'`; `pbir` handles the string escaping. Reviewers: the `python-reviewer` agent ships with the reports plugin; without that plugin installed, skip the review step and run `pbir validate`.

## Migrating a Python visual

```yaml
violin / box / histogram / scatter / heatmap: Deneb Vega-Lite (deneb-visuals)
bar / line / area / KPI with a built-in equivalent: the built-in visual
sparkline / data bar / bullet inside a table cell: SVG measure (svg-visuals)
reusable interactive chart: pbiviz custom visual (powerbi-custom-visuals)
model fit, forecast, clustering computed at render: Fabric notebook, then show results in a table or chart
```
