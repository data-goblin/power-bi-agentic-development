---
name: python-visuals
version: 0.8.1
description: "This skill should be used when the user asks to 'create a Python visual', 'add a matplotlib chart', 'inject a Python script into Power BI', 'use seaborn in Power BI', 'add a Python chart to a report', 'write a Python visual script', 'pythonVisual', or needs guidance on Python visual creation, matplotlib/seaborn patterns, or Python visual best practices in PBIR reports."
---

# Python Visuals in Power BI (PBIR)

> **Report modification requires tooling.** Two paths exist:
> 1. **`pbir` CLI (preferred)** -- use the `pbir` command and the `pbir-cli` skill. Check availability with `pbir --version`.
> 2. **Direct JSON modification** -- if `pbir` is not available, use the `pbir-format` skill (pbip plugin) for PBIR JSON structure and patterns. Validate every change with `jq empty <file.json>`.
>
> If neither the `pbir-cli` skill nor the `pbir-format` skill is loaded, ask the user to install the appropriate plugin before proceeding with report modifications.

Python visuals execute matplotlib/seaborn scripts to render static PNG images on the Power BI canvas. **Prefer seaborn** over raw matplotlib for cleaner syntax and better defaults -- it handles most chart types with less code.

## Visual Identity

- **visualType:** `pythonVisual`
- **Data role:** `Values` (columns and measures, multiple allowed)
- **Data variable:** `dataset` (pandas DataFrame, auto-injected)
- **Row limit:** 150,000 rows
- **Output:** Static PNG at 72 DPI -- no interactivity

## Workflow: Creating a Python Visual

### Step 1: Add the Visual

Create the visual.json file manually (see `pbir-format` skill in the pbip plugin for JSON structure) with `visualType: pythonVisual`, field bindings for the columns and measures you need (use `Values:Table.Column` or `Values:Table.Measure` format), and position/size as required.

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

Set the script content in the visual's `objects.script[0].properties.source` literal value (see PBIR Format section below).

**Escaping rules for visual.json injection:**

The script must be encoded as a single-quoted DAX literal string inside `expr.Literal.Value`:

- Newlines in the script become `\n` in the JSON string
- Double quotes inside the script (e.g., `"#5B8DBE"`) become `\"` in the JSON string
- The entire script is wrapped in single quotes: `'import matplotlib...\nplt.show()'`
- See `examples/visual/` for a complete real-world visual.json showing this encoding

### Step 4: Validate

Validate JSON syntax with `jq empty <visual.json>` and inspect the visual.json to confirm script content and field bindings.

## PBIR Format

Scripts are stored in `visual.objects.script[0].properties`:

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
| Embed (app-owns-data) | Ending May 2026 | Ending May 2026 |

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

## When to Use Python Visuals

Python visuals are appropriate for **statistical and analytical visualizations** where the focus is on data analysis rather than interactivity. Use Python visuals when you need:

- Statistical charts (distributions, regressions, correlations, violin plots)
- Analytical visualizations leveraging scipy, scikit-learn, or statsmodels
- Chart types that seaborn/matplotlib handle well but Power BI natives don't support

**Output is static PNG** -- no cross-filtering FROM the visual, no hover/tooltip interactivity. Use Deneb instead for interactive custom visuals. Use SVG measures for simple inline graphics in tables/cards.

## References

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
