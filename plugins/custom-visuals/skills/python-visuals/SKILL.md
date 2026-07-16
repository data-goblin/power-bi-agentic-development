---
name: python-visuals
description: Python visual creation and matplotlib/seaborn patterns for PBIR reports. Automatically invoke when the user mentions "Python visual", "matplotlib in Power BI", "seaborn in Power BI", "pythonVisual", or asks to "create a Python visual", "add a matplotlib chart", "write a Python visual script".
---

# Python Visuals in Power BI (PBIR)

> **Use `pbir` for every report mutation.** Read PBIR metadata only for diagnosis. If `pbir` is
> unavailable or lacks an operation, stop and report the gap; never edit report JSON directly.

Python visuals execute matplotlib/seaborn scripts to render static PNG images on the Power BI canvas. **Prefer seaborn** over raw matplotlib for cleaner syntax and better defaults -- it handles most chart types with less code.

## Visual Identity

- **visualType:** `pythonVisual`
- **Data role:** `Values` (columns and measures, multiple allowed)
- **Data variable:** `dataset` (pandas DataFrame, auto-injected)
- **Row limit:** 150,000 rows
- **Output:** Static PNG at 72 DPI -- no interactivity

## Workflow: Creating a Python Visual

### Step 1: Add the Visual

```bash
pbir add visual pythonVisual "Report.Report/Page.Page" --name PythonChart \
  --data "Values:Sales.Date" --data "Values:Sales.Revenue"
```

### Step 2: Write the Script

```python
import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(8, 4))
ax.bar(dataset["Date"], dataset["Sales"], color="#5B8DBE")
ax.spines["top"].set_visible(False)
ax.spines["right"].set_visible(False)
plt.tight_layout()
plt.show()  # MANDATORY
```

Critical rules:
- `plt.show()` is **mandatory** as the final line -- nothing renders without it
- `dataset` is auto-injected as a pandas DataFrame; do not create it
- Column names match the `nativeQueryRef` (display name) from field bindings
- Only the last `plt.show()` call renders; multiple figures not supported

### Step 2b: Review

Before presenting the script to the user, dispatch the `python-reviewer` agent to validate correctness and provide design feedback.

### Step 3: Inject the Script

```bash
pbir visuals python "Report.Report/Page.Page/PythonChart.Visual" \
  --script-file chart.py
```

The CLI handles PBIR string escaping.

### Step 4: Validate

```bash
pbir visuals bind "Report.Report/Page.Page/PythonChart.Visual" --show
pbir validate "Report.Report" --all
```

## PBIR Format

For read-only diagnosis, scripts are stored in `visual.objects.script[0].properties`:

```json
{
  "source": {"expr": {"Literal": {"Value": "'import matplotlib.pyplot as plt\\n...\\nplt.show()'"}}},
  "provider": {"expr": {"Literal": {"Value": "'Python'"}}}
}
```

The CLI handles all escaping automatically.

## Supported Libraries

### Power BI Service (Python 3.11)

| Package | Version | Purpose |
|---------|---------|---------|
| matplotlib | 3.8.4 | Primary plotting |
| seaborn | 0.13.2 | Statistical visualization |
| numpy | 2.0.0 | Numerical computing |
| pandas | 2.2.2 | Data manipulation |
| scipy | 1.13.1 | Scientific computing |
| scikit-learn | 1.5.0 | Machine learning |
| statsmodels | 0.14.2 | Statistical models |
| pillow | 10.4.0 | Image processing |

**Not supported:** plotly, bokeh, altair (networking blocked in Service).

Full package list: https://learn.microsoft.com/power-bi/connect-data/service-python-packages-support

### Desktop

Any locally installed package works without restriction.

## Best Practices

1. **Always call `plt.show()`** -- mandatory, must be the final line
2. **Use `figsize=(w, h)`** to match container aspect ratio (72 DPI output)
3. **Remove chart chrome** -- `ax.spines["top"].set_visible(False)` etc.
4. **Use hex colors** matching the report theme
5. **Keep scripts simple** -- 5-min timeout Desktop, 1-min Service
6. **Minimize transforms** -- do heavy computation in DAX/Power Query instead
7. **Use `try/except`** for robustness in production scripts
8. **Copy data first** -- `data = dataset.copy()` before manipulation

## Limitations

| Constraint | Desktop | Service |
|------------|---------|---------|
| Output | Static PNG, 72 DPI | Static PNG, 72 DPI |
| Timeout | 5 minutes | 1 minute |
| Row limit | 150,000 | 150,000 |
| Payload | -- | 30 MB |
| Networking | Unrestricted | Blocked |
| Gateway | Personal only | Personal only |
| Cross-filter FROM | Not supported | Not supported |
| Receive cross-filter | Yes | Yes |
| Publish to web | Not supported | Not supported |
| Embed (app-owns-data) | Not supported | Not supported |

## Script Structure Template

```python
import matplotlib.pyplot as plt
import numpy as np

# 1. Guard against empty data
if dataset.empty:
    fig, ax = plt.subplots(1, 1, figsize=(6, 4))
    ax.text(0.5, 0.5, "No data available", ha='center', va='center', fontsize=14, color='#888888')
    ax.axis('off')
    plt.show()
else:
    # 2. Data preparation (dataset is auto-injected)
    data = dataset.copy()

    # 3. Create figure with explicit size
    fig, ax = plt.subplots(figsize=(8, 4))

    # 4. Plot
    ax.plot(data["X"], data["Y"], color="#5B8DBE", linewidth=2)

    # 5. Style
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", alpha=0.3)

    # 6. Layout and render
    plt.tight_layout()
    plt.show()
```

## When to Use a Script Visual

Reach for a Python visual only when **all** of the following hold:

- The chart has no native equivalent and no reasonable Deneb spec
- The value is in a statistical computation that must run at render time (model fit, kernel density, forecast band), not just a shape Vega could draw
- The visual does not need to be a cross-filter source, hover tooltips, publish-to-web, or app-owns-data embed
- The report is served in a Pro/PPU or higher capacity with a Fabric-enabled region

If interactivity or cross-filtering matters, use **Deneb** (a static PNG cannot be a selection source). If the need is a small inline mark (sparkline, bar, status pill), use an **SVG measure** (no row cap, no timeout, no licensing/region gate, renders under publish-to-web). The script visual's niche is narrow: compute-at-render statistical plots for internal or org consumption.

**Python vs R once a script visual is the right call:** use Python when the computation leans on scikit-learn, statsmodels, or scipy, or when surrounding report logic is already Python. Use R for publication-quality statistical defaults and packages with no Python peer (`forecast`, `corrplot`, `pheatmap`, ridgeline/violin). Where equal, default to whichever language the report's other scripts use; mixing doubles the publish-time package surface to validate.

Do not default to a script visual because a chart type "looks statistical." A box plot, lollipop, or dumbbell is an SVG-measure or Deneb job; reserve scripts for charts that genuinely compute.

## References

- **`references/data-model.md`** -- `dataset` grouping mechanic, the row/byte caps, and how to force per-row input
- **`references/community-examples.md`** -- seaborn gallery examples organized by chart type, plus matplotlib and Python Graph Gallery links
- **`references/chart-patterns.md`** -- Common matplotlib/seaborn chart patterns (bar, heatmap, donut, KPI, area)
- **`examples/script/`** -- Standalone Python scripts (bar-chart, trend-line) -- ready to inject into visual.json after escaping
- **`examples/visual/bar-chart.json`** -- PBIR visual.json: horizontal stacked bar with PY comparison lines and % change labels
- **`examples/visual/kpi-card.json`** -- PBIR visual.json: text-based KPI with value, % change indicator, and PY comparison
- **`examples/visual/trend-line.json`** -- PBIR visual.json: area chart with line plot and monthly x-axis

## Fetching Docs

To retrieve current Python visual / package support docs, use `microsoft_docs_search` + `microsoft_docs_fetch` (MCP) if available, otherwise `mslearn search` + `mslearn fetch` (CLI). Search based on the user's request and run multiple searches as needed to ensure sufficient context before proceeding.

## Related Skills

- **`pbi-report-design`** -- Layout and design best practices
- **`r-visuals`** -- R Script visuals (same concept, different language)
- **`deneb-visuals`** -- Vega/Vega-Lite visuals (interactive, vector-based alternative)
- **`svg-visuals`** -- SVG via DAX measures (lightweight inline graphics)
- **`pbir-format`** (pbip plugin) -- PBIR JSON format reference
