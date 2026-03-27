---
name: r-visuals
version: 0.8.1
description: "This skill should be used when the user asks to 'create an R visual', 'add a ggplot2 chart', 'inject an R script into Power BI', 'use ggplot in Power BI', 'add an R chart to a report', 'write an R visual script', or needs guidance on R visual creation, ggplot2 patterns, or R visual best practices in PBIR reports."
---

# R Visuals in Power BI (PBIR)

> **Report modification requires tooling.** Two paths exist:
> 1. **`pbir` CLI (preferred)** -- use the `pbir` command and the `pbir-cli` skill. Check availability with `pbir --version`.
> 2. **Direct JSON modification** -- if `pbir` is not available, use the `pbir-format` skill (pbip plugin) for PBIR JSON structure and patterns. Validate every change with `jq empty <file.json>`.
>
> If neither the `pbir-cli` skill nor the `pbir-format` skill is loaded, ask the user to install the appropriate plugin before proceeding with report modifications.

R visuals execute R scripts (primarily ggplot2) to render static PNG images on the Power BI canvas. **ggplot2 is the preferred library** -- its grammar of graphics approach produces clean, publication-quality statistical visualizations with less code. R is particularly strong for statistical visualizations.

## Visual Identity

- **visualType:** `scriptVisual`
- **Data role:** `Values` (columns and measures, multiple allowed)
- **Data variable:** `dataset` (data.frame, auto-injected)
- **Row limit:** 150,000 rows
- **Output:** Static PNG at 72 DPI -- no interactivity

## Workflow: Creating an R Visual

### Step 1: Add the Visual

Create the visual.json file manually (see `pbir-format` skill in the pbip plugin for JSON structure) with `visualType: scriptVisual`, field bindings for the columns and measures you need (use `Values:Table.Column` or `Values:Table.Measure` format), and position/size as required.

### Step 2: Write the Script

```r
library(ggplot2)

p <- ggplot(dataset, aes(x=Date, y=Sales)) +
  geom_col(fill="#5B8DBE") +
  theme_minimal(base_size=12) +
  theme(panel.grid.major.x=element_blank())

print(p)  # MANDATORY for ggplot2
```

Critical rules:
- `print(p)` is **mandatory** for ggplot2 objects -- they do not auto-display in Power BI
- `dataset` is auto-injected as a data.frame; do not create it
- Access columns by index (`dataset[,1]`) to avoid name escaping issues
- Use backticks for column names with spaces: `` dataset$`Order Lines` ``

### Step 2b: Review

Before presenting the script to the user, dispatch the `r-reviewer` agent to validate correctness and provide design feedback.

### Step 3: Inject the Script

Set the script content in the visual's `objects.script[0].properties.source` literal value (see PBIR Format section below).

**Escaping rules for visual.json injection:**

The script must be encoded as a single-quoted DAX literal string inside `expr.Literal.Value`:

- Newlines in the script become `\n` in the JSON string
- Double quotes inside the script (e.g., `"#5B8DBE"`) become `\"` in the JSON string
- The entire script is wrapped in single quotes: `'library(ggplot2)\n...\nprint(p)'`
- See `examples/visual/` for a complete real-world visual.json showing this encoding

### Step 4: Validate

Validate JSON syntax with `jq empty <visual.json>` and inspect the visual.json to confirm script content and field bindings.

## PBIR Format

Scripts are stored in `visual.objects.script[0].properties`:

```json
{
  "source": {"expr": {"Literal": {"Value": "'library(ggplot2)\\n...\\nprint(p)'"}}},
  "provider": {"expr": {"Literal": {"Value": "'R'"}}}
}
```

Identical structure to Python visuals except `visualType` is `scriptVisual` and `provider` is `'R'`.

## Supported Packages

### Power BI Service (R 4.3.3)

| Package | Version | Purpose |
|---------|---------|---------|
| ggplot2 | 3.5.1 | Grammar of graphics |
| dplyr | 1.1.4 | Data manipulation |
| tidyr | 1.3.1 | Data tidying |
| ggrepel | 0.9.5 | Non-overlapping labels |
| patchwork | 1.2.0 | Compose multiple plots |
| cowplot | 1.1.3 | Publication-quality plots |
| corrplot | 0.94 | Correlation matrices |
| viridis | 0.6.5 | Color scales |
| RColorBrewer | 1.1-3 | Color palettes |
| forecast | 8.23.0 | Time series forecasting |
| pheatmap | 1.0.12 | Heatmaps |
| treemap | 2.4-4 | Treemaps |
| lattice | 0.22-6 | Trellis graphics |

~1000 CRAN packages available. **Not supported:** packages requiring networking (RgoogleMaps, mailR).

Full package list: https://learn.microsoft.com/power-bi/connect-data/service-r-packages-support

### Desktop

Any locally installed R package works without restriction. R must be installed separately.

## Best Practices

1. **Always call `print(p)`** -- ggplot2 objects require explicit printing
2. **Guard against empty data** -- `if (nrow(dataset) == 0) { plot.new(); text(0.5, 0.5, "No data") }`
3. **Use index-based column access** -- `dataset[,1]` avoids name escaping issues
4. **Use `theme_minimal()`** -- clean aesthetic that works well with Power BI
5. **Factor categorical variables** -- control sort order explicitly with `factor()`
6. **Use hex colors** matching the report theme
7. **Set margins** -- `plot.margin=margin(t, r, b, l)` to prevent clipping
8. **Keep scripts concise** -- 5-min timeout Desktop, 1-min Service

## Limitations

| Constraint | Desktop | Service |
|------------|---------|---------|
| Output | Static PNG, 72 DPI | Static PNG, 72 DPI |
| Timeout | 5 minutes | 1 minute |
| Row limit | 150,000 | 150,000 |
| Output size | 2 MB | 30 MB |
| Networking | Unrestricted | Blocked |
| Gateway | Personal only | Personal only |
| Cross-filter FROM | Not supported | Not supported |
| Receive cross-filter | Yes | Yes |
| Publish to web | Not supported | Not supported |
| Embed (app-owns-data) | Ending May 2026 | Ending May 2026 |

## Script Structure Template

```r
library(ggplot2)

# 1. Guard against empty data
if (nrow(dataset) == 0) {
  plot.new()
  text(0.5, 0.5, "No data available", cex=1.5)
} else {
  # 2. Data preparation (index-based access)
  df <- data.frame(
    category = dataset[,1],
    value = dataset[,2]
  )

  # 3. Create visualization
  p <- ggplot(df, aes(x=reorder(category, -value), y=value)) +
    geom_col(fill="#5B8DBE", width=0.7) +
    theme_minimal(base_size=12) +
    theme(
      panel.grid.major.x = element_blank(),
      axis.title = element_blank()
    )

  # 4. Render
  print(p)
}
```

## R vs Python Comparison

| Aspect | R (`scriptVisual`) | Python (`pythonVisual`) |
|--------|-------|--------|
| Primary library | ggplot2 | matplotlib |
| Render call | `print(p)` | `plt.show()` |
| Column access | `dataset[,1]` or `dataset$col` | `dataset.iloc[:,0]` or `dataset["col"]` |
| Empty guard | `if (nrow(dataset) == 0)` | `if len(dataset) == 0:` |
| Factor control | `factor(x, levels=...)` | `pd.Categorical(x, categories=...)` |
| Runtime (Service) | R 4.3.3 | Python 3.11 |

## When to Use R Visuals

R visuals are the preferred choice for **statistical and analytical visualizations**, particularly where R's statistical ecosystem excels. Use R visuals when you need:

- Distribution analysis (violin, ridgeline, density, boxplot)
- Statistical modeling (regression, correlation, ANOVA)
- Publication-quality analytical charts with ggplot2
- Packages like forecast, corrplot, pheatmap that have no Python equivalent of equal quality

**Output is static PNG** -- no cross-filtering FROM the visual, no hover/tooltip interactivity. Use Deneb instead for interactive custom visuals. Use SVG measures for simple inline graphics in tables/cards.

## References

- **`references/community-examples.md`** -- R Graph Gallery examples organized by chart type (distribution, correlation, ranking, evolution, flow)
- **`references/ggplot2-patterns.md`** -- Common ggplot2 chart patterns (bar, donut, line, heatmap, bullet)
- **`examples/script/`** -- Standalone R scripts (bar-chart, trend-line) -- ready to inject into visual.json after escaping
- **`examples/visual/bullet-chart.json`** -- PBIR visual.json: bullet chart with conditional coloring, error handling, and extensive escaping
- **`examples/visual/bar-chart.json`** -- PBIR visual.json: horizontal bar with PY comparison lines and colored account labels
- **`examples/visual/trend-line.json`** -- PBIR visual.json: area chart with ribbon plot and month factor handling

## Fetching Docs

To retrieve current R visual / package support docs, use `microsoft_docs_search` + `microsoft_docs_fetch` (MCP) if available, otherwise `mslearn search` + `mslearn fetch` (CLI). Search based on the user's request and run multiple searches as needed to ensure sufficient context before proceeding.

## Related Skills

- **`pbi-report-design`** -- Layout and design best practices
- **`python-visuals`** -- Python Script visuals (same concept, different language)
- **`deneb-visuals`** -- Vega/Vega-Lite visuals (interactive, vector-based alternative)
- **`svg-visuals`** -- SVG via DAX measures (lightweight inline graphics)
- **`pbir-format`** (pbip plugin) -- PBIR JSON format reference
