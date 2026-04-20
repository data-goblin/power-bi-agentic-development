# cardVisual

This guidance covers the new `cardVisual` (GA since November 2025). The legacy `card` visual is still supported in existing reports but `cardVisual` is recommended for new work; it supports multiple values, reference labels, data-driven images, and category breakdowns in a single visual.

The `kpi` visual is a specialized indicator that shows a value against a goal with a trend line. Use `kpi` when the core question is "are we on track?" and the reader needs a directional indicator (up/down arrow). Use `cardVisual` for everything else; headline metrics, KPI rows, and any card that needs SVG imagery or multi-value layouts.

## Data roles

### cardVisual

| Role | Required | Types | Notes |
|------|----------|-------|-------|
| Data | Yes | Column, Measure | One or more values; each becomes a separate card |

### card (legacy)

| Role | Required | Types | Notes |
|------|----------|-------|-------|
| Values | Yes | Column, Measure | One or more values |

### kpi

| Role | Required | Types | Notes |
|------|----------|-------|-------|
| Indicator | Yes | Measure | The primary KPI value |
| TrendLine | No | Column | Time/period field for the sparkline trend (render-required) |
| Goal | No | Measure | Target value for comparison |
| Goals | No | Measure | Additional goal measures |

```bash
# New card visual
pbir add visual cardVisual "Report.Report/Page.Page" --title "Revenue" \
  -d "Data:Sales.Revenue" \
  --x 24 --y 24 --width 290 --height 140

# KPI visual
pbir add visual kpi "Report.Report/Page.Page" --title "Revenue vs Target" \
  -d "Indicator:Sales.Revenue" -d "Goal:Sales.Target" -d "TrendLine:Date.Month" \
  --x 24 --y 24 --width 290 --height 200

# KPI row (4 cards)
pbir add visual cardVisual "Page.Page" --title "Revenue" -d "Data:Sales.Revenue" --x 24 --y 24 --width 290 --height 140
pbir add visual cardVisual "Page.Page" --title "Orders" -d "Data:Orders.Count" --x 338 --y 24 --width 290 --height 140
pbir add visual cardVisual "Page.Page" --title "Margin" -d "Data:Sales.Margin" --x 652 --y 24 --width 290 --height 140
pbir add visual cardVisual "Page.Page" --title "Customers" -d "Data:Customers.Count" --x 966 --y 24 --width 290 --height 140
```

## Rules

> [!NOTE]
> Recall that formatting should be propagated from the theme.
> These are general rules that discuss applying visual overrides.
> Propagate to the theme where possible.

1. **Cards are supporting context, not the main story.** Place cards at the top of the page as a KPI row; they orient the reader before they look at the charts below. Keep them compact

2. **Use visual titles as labels; hide category labels on legacy cards.** The visual title already describes the metric; showing the measure name again as a category label is redundant

```bash
# Legacy card: hide category label
pbir set "Visual.Visual.categoryLabels.show" --value false
```

3. **Use display units and appropriate precision.** Large numbers should use K/M/B display units; avoid showing unnecessary decimals. Set this at the measure level (format string) or via visual override

```bash
# KPI: set display units to millions with 0 decimals
pbir set "Visual.Visual.indicator.indicatorDisplayUnits" --value 1000000
pbir set "Visual.Visual.indicator.indicatorPrecision" --value 0
```

4. **Theme the KPI status colors.** KPI good/bad colors should come from the theme's sentiment palette, not hard-coded hex values

```bash
# Set KPI status colors to theme palette
pbir set "Visual.Visual.status.goodColor" --theme-color 5 -0.25
pbir set "Visual.Visual.status.badColor" --theme-color 5 -0.25
```

5. **Use SVG image measures for rich KPI cards.** The new `cardVisual` supports data-driven images; bind an SVG-producing DAX measure to create inline sparklines, progress bars, or status indicators directly inside the card

6. **Hide the trend line date on KPIs when space is tight.** The "last date" label can consume valuable space on small KPIs

```bash
pbir set "Visual.Visual.lastDate.show" --value false
```

7. **KPI goal text should describe the comparison.** Relabel the default "Goal" text to something meaningful like "Plan MTD" or "Target"

```bash
pbir set "Visual.Visual.goals.goalText" --value "Plan MTD"
```

8. **Consistent sizing across KPI rows.** All cards in a row should have identical width and height; use the layout grid system

## Examples

Working `visual.json` files demonstrating these patterns:

- **`examples/visuals/default/card.json`** -- minimal legacy card; theme defaults only
- **`examples/visuals/default/cardVisual.json`** -- minimal new card; theme defaults only
- **`examples/visuals/default/kpi.json`** -- minimal KPI; theme defaults only
- **`examples/visuals/formatted/card.json`** -- legacy card with theme color styling, custom font, and visual title
- **`examples/visuals/formatted/card-with-filter.json`** -- legacy card with gradient fill rule and visual-level filter
- **`examples/visuals/formatted/cardVisual.json`** -- new card with SVG image measure (KPI trend line), outline, shadow, and visual-level filter
- **`examples/visuals/formatted/kpi.json`** -- KPI with extension measures from a thin report, indicator/goal/trendline
- **`examples/visuals/formatted/kpi-flash.json`** -- flash report KPI with themed status colors, display units, and custom goal text

## References

- [Card Visuals in Power BI](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-card) -- Microsoft Learn; covers new card visual (GA Nov 2025), callout images, reference labels, categories, SVG data-driven images
- [KPI Visuals in Power BI](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-kpi) -- Microsoft Learn; KPI requirements, trend axis, goal formatting, status indicators
- [IBCS Standards 1.2](https://www.ibcs.com/ibcs-standards-1-2/) -- International Business Communication Standards; notation for indicators and KPIs
