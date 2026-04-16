# barChart

This guidance applies equally to `columnChart` (vertical bars). The only difference is axis orientation; all data roles, rules, and CLI commands are identical. Use `barChart` (horizontal) when category labels are long or when ranking is the primary message; use `columnChart` (vertical) when categories represent time periods.

`clusteredBarChart` / `clusteredColumnChart` place multiple measures side-by-side per category. `stackedBarChart` / `stackedColumnChart` and `hundredPercentStackedBarChart` / `hundredPercentStackedColumnChart` are part-of-whole variants; Legend becomes essential for distinguishing segments.

## Data roles

| Role | Required | Types | Notes |
|------|----------|-------|-------|
| Category | Yes | Column | Dimension for grouping |
| Y | Yes | Measure | One or more measures |
| Legend | No | Column | Series grouping (clustered/stacked) |
| SmallMultiples | No | Column | Available on barChart, clusteredBarChart, columnChart, clusteredColumnChart only; not on stacked/100% variants |

```bash
pbir add visual barChart "Report.Report/Page.Page" --title "Revenue by Region" \
  -d "Category:Geography.Region" -d "Y:Sales.Revenue" \
  --x 24 --y 120 --width 608 --height 400

pbir visuals sort "Visual.Visual" -f "Sales.Revenue" -d Descending
```

## Rules

> [!NOTE]
> Recall that formatting should be propagated from the theme.
> These are general rules that discuss applying visual overrides.
> Propagate to the theme where possible.

1. **Sort by value descending (not alphabetically).** Bar charts compare magnitude; the reader should immediately see the largest category at the top (barChart) or left (columnChart). Only sort chronologically if Category is a time field

```bash
pbir visuals sort "Visual.Visual" -f "Sales.Revenue" -d Descending
```

2. **Hide the value axis.** Data labels on bars make the axis redundant; removing it frees space and reduces clutter

```bash
pbir set "Visual.Visual.valueAxis.show" --value false
```

3. **Enable data labels.** Place inside-end or outside-end depending on bar length. Use display units (K, M) to keep labels compact

```bash
pbir visuals labels "Visual.Visual" --show
```

4. **Use consistent single color for simple comparisons.** When all bars represent the same measure, a single theme color is cleaner than rainbow. Reserve color variation for conditional formatting or multi-series

```bash
# Single color via theme (preferred; no CLI override needed)
# Per-series color if needed:
pbir set "Visual.Visual.dataPoint.field(Sales.Revenue).fill" --value "#5B8DBE"
```

5. **Conditional formatting on bar fill for variance.** When bars represent a comparison (e.g. variance to prior year), color only the actionable categories to reduce cognitive load. Highlight negative variance or categories outside a threshold; leave the rest in a neutral/muted tone so the reader's attention goes to what needs action, not to every bar

```bash
# CF measure: only highlight underperformance; neutral otherwise
pbir dax measures add "Report.Report" -t _Fmt -n "VarianceColor" \
  -e "IF([Variance] < 0, \"bad\", \"neutral\")" --data-type Text

# Apply to bar fill
pbir visuals cf "Visual.Visual" --measure "dataPoint.fill _Fmt.VarianceColor"
```

6. **Limit categories to 5-10.** Beyond that, bars become thin and unreadable. Use Top N filters or group smaller categories into "Other"

```bash
pbir filters add "Visual.Visual" -f "Geography.Region" --type TopN --top 10 \
  --by "Sales.Revenue"
```

7. **Bullet chart pattern for target comparison (JSON fallback).** Overlay a target/comparison value as an error bar marker on each bar to create a bullet chart. The `error` object container is not yet supported by `pbir set`; edit `visual.json` directly or use `pbir-format` skill. Set `errorRange.explicit.lowerBound` and `upperBound` to the same target measure so the marker renders as a single line. See `barChart-bullet.json` for the full pattern

```json
"error": [{
  "properties": {
    "enabled": { "expr": { "Literal": { "Value": "true" } } },
    "barWidth": { "expr": { "Literal": { "Value": "1L" } } },
    "markerSize": { "expr": { "Literal": { "Value": "10D" } } }
  },
  "selector": { "metadata": "Measures.Revenue" }
}]
```

8. **Disable the legend for single-series.** The legend adds no information when there is only one measure; remove it and use the visual title instead

```bash
pbir visuals legend "Visual.Visual" --no-show
```

9. **Pin axis bounds with measures (optional).** Bind `valueAxis.start` and `valueAxis.end` to extension measures to control the value axis range dynamically. Common pattern: pin `start` to zero and set `end` to 120% of the max so labels have room. Use `pbir visuals cf --measure` for measure-bound axis properties

```bash
# Pin value axis floor to zero
pbir visuals cf "Visual.Visual" --measure "valueAxis.start _Fmt.Zero"

# Dynamic ceiling
pbir visuals cf "Visual.Visual" --measure "valueAxis.end _Fmt.AxisCeiling"
```

## Examples

Working `visual.json` files demonstrating these patterns:

- **`examples/visuals/default/barChart.json`** -- minimal barChart; theme defaults only
- **`examples/visuals/formatted/barChart-bullet.json`** -- bullet chart pattern with error bars as comparison markers, conditional dataPoint fill, and per-category color overrides
- **`examples/visuals/formatted/barChart-divergent.json`** -- divergent bars (positive/negative variance) with conditional formatting
- **`examples/visuals/formatted/barChart-lollipop.json`** -- lollipop chart pattern with thin bars and marker emphasis
- **`examples/visuals/formatted/barChart-progress.json`** -- progress bar pattern with themed data point colors
- **`examples/visuals/formatted/clusteredBarChart-variance.json`** -- variance analysis with custom data point colors
- **`examples/visuals/default/columnChart.json`** -- minimal columnChart; theme defaults only
- **`examples/visuals/formatted/columnChart.json`** -- styled column chart with custom data point colors and label formatting

## References

- [Column Charts in Power BI](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-column-charts) -- Microsoft Learn; covers stacked, clustered, and 100% stacked variants, drill, zoom, cross-filtering, conditional formatting
- [Bar Charts in Power BI](https://data-goblins.com/power-bi/bar-charts) -- Data Goblins; bar chart variants including bullet, divergent, and stacked patterns
- [IBCS Standards 1.2](https://www.ibcs.com/ibcs-standards-1-2/) -- International Business Communication Standards; notation rules for bars, variance charts, and comparison patterns
