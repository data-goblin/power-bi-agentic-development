---
name: r-visuals
description: "This skill should be used when the user asks to 'create an R visual', 'add a ggplot2 chart', 'inject an R script into Power BI', 'use ggplot in Power BI', 'add an R chart to a report', 'write an R visual script', or needs guidance on R visual creation, ggplot2 patterns, or R visual best practices in PBIR reports."
---

# R Visuals in Power BI (PBIR)

> **Report modification requires tooling.** Two paths exist:
> 1. **`pbir` CLI (preferred)** -- use the `pbir` command and the `pbir-cli` skill. Check availability with `pbir --version`.
> 2. **Direct JSON modification** -- if `pbir` is not available, use the `pbir-format` skill (pbip plugin) for PBIR JSON structure and patterns. Validate every change with `jq empty <file.json>`.
>
> If neither the `pbir-cli` skill nor the `pbir-format` skill is loaded, ask the user to install the appropriate plugin before proceeding with report modifications.

R visuals execute R scripts (primarily ggplot2) to render static PNG images on the Power BI canvas.

## Visual Identity

- **visualType:** `scriptVisual`
- **Data role:** `Values` (columns and measures, multiple allowed)
- **Data variable:** `dataset` (data.frame, auto-injected)
- **Row limit:** 150,000 rows
- **Output:** Static PNG at 72 DPI -- no interactivity

## Workflow: Creating an R Visual

### Step 1: Add the Visual

Create the visual.json file manually (see `pbir-format` skill in the pbip plugin for JSON structure) with `visualType: scriptVisual`, field bindings for `Values:Date.Date` and `Values:Orders.Sales`, positioned at x=40, y=260 with width=800 and height=400.

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

### Step 3: Inject the Script

Set the script content in the visual's `objects.script[0].properties.source` literal value (see PBIR Format section below). The script text must be escaped as a single-quoted DAX literal string with `\\n` for newlines.

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

## References

- **`references/ggplot2-patterns.md`** -- Common ggplot2 chart patterns (bar, donut, line, heatmap, bullet)
- **`examples/`** -- Ready-to-use R scripts

## Related Skills

- **`pbi-report-design`** -- Layout and design best practices
- **`python-visuals`** -- Python Script visuals (same concept, different language)
- **`deneb-visuals`** -- Vega/Vega-Lite visuals (interactive, vector-based alternative)
- **`svg-visuals`** -- SVG via DAX measures (lightweight inline graphics)
- **`pbir-format`** (pbip plugin) -- PBIR JSON format reference
