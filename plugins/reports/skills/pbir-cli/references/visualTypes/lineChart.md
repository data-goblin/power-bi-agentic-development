# lineChart

This guidance applies equally to `areaChart` (line + shaded area beneath). All data roles, rules, and CLI commands are identical; the only difference is `areaChart` enables area shading by default.

`stackedAreaChart` and `hundredPercentStackedAreaChart` are part-of-whole variants; they stack multiple series to show composition over time. They share the same data roles but Legend becomes essential for distinguishing segments.

## Data roles

| Role | Required | Types | Notes |
|------|----------|-------|-------|
| Category | Yes | Column | Time/period field; always sort ascending |
| Y | Yes | Measure | One or more measures |
| Legend | No | Column | Series grouping |
| SmallMultiples | No | Column | Use when > 3-4 series |

```bash
pbir add visual lineChart "Report.Report/Page.Page" --title "Revenue Trend" \
  -d "Category:Date.Month" -d "Y:Sales.Revenue" \
  --x 24 --y 120 --width 608 --height 300

pbir visuals bind "Visual.Visual" -a "Y:Sales.Target" -t Measure
pbir visuals sort "Visual.Visual" -f "Date.Month" -d Ascending
```

## Rules

> [!NOTE]
> Recall that formatting should be propagated from the theme
> These are general rules that discuss applying visual overrides
> You want to try and propagate to the theme where possible

1. **Sort by period ascending.** Line charts represent continuity over time; the x-axis must follow chronological order

```bash
pbir visuals sort "Visual.Visual" -f "Date.Month" -d Ascending
```

2. **Enable area shading at 85-90% transparency.** The shaded area under the line reinforces the magnitude without overpowering the line itself

```bash
pbir set "Visual.Visual.lineStyles.areaShow" --value true
pbir set "Visual.Visual.lineStyles.strokeTransparency" --value 88
```

3. **Differentiate series by stroke weight and color.** The primary series (e.g. Actuals) should have a thicker stroke and more prominent color (e.g. blue); secondary series (e.g. Targets) should be thinner and muted (e.g. grey). Secondary series can optionally use dashed or dotted lines. Avoid more than 3-4 series; use small multiples instead

```bash
# Primary series: thicker stroke
pbir set "Visual.Visual.lineStyles.strokeWidth" --value 3

# Secondary series styling (per-field formatting)
pbir set "Visual.Visual.lineStyles.field(Sales.Target).lineStyle" --value "dashed"
pbir set "Visual.Visual.lineStyles.field(Sales.Target).strokeWidth" --value 1
```

4. **Disable markers for continuous data; enable for categorical.** If the x-axis has many data points (e.g. daily over a year), markers clutter. If few data points (e.g. 4 quarters), markers help distinguish individual values

```bash
pbir set "Visual.Visual.lineStyles.showMarker" --value false
```

5. **Disable data labels.** Line charts communicate trends; precise values belong in tables or tooltips

```bash
pbir visuals labels "Visual.Visual" --no-show
```

6. **Use series labels with leader lines instead of a legend** for 2-3 series. Alternatively, set the legend to top center. Series labels place the label at the end of each line, removing the need for the reader to cross-reference a legend

```bash
# Option A: series labels with leader lines
pbir set "Visual.Visual.seriesLabels.show" --value true
pbir set "Visual.Visual.seriesLabels.leaderLines" --value true
pbir visuals legend "Visual.Visual" --no-show

# Option B: legend at top center
pbir visuals legend "Visual.Visual" --show --position TopCenter
```

7. **Latest data point label (optional).** To label only the most recent data point, create an extension measure that returns the value only at the latest period and BLANK() otherwise. Bind it as a separate Y series, enable markers and data labels for that series only, and disable the legend and series labels

```bash
# Create extension measure for latest point
pbir dax measures add "Report.Report" -t _Fmt -n "Revenue Latest" \
  -e "IF(MAX('Date'[Calendar Month #]) = CALCULATE(MAX('Date'[Calendar Month #]), ALLSELECTED('Date')), [Revenue], BLANK())"

# Bind as additional series
pbir visuals bind "Visual.Visual" -a "Y:_Fmt.Revenue Latest" -t Measure

# Enable marker and label only for latest-point series
pbir set "Visual.Visual.lineStyles.field(_Fmt.Revenue Latest).showMarker" --value true
pbir set "Visual.Visual.labels.field(_Fmt.Revenue Latest).show" --value true

# Disable legend (series labels or leader lines identify the lines)
pbir visuals legend "Visual.Visual" --no-show
```

8. **Pin axis bounds with measures (optional).** Bind `valueAxis.start` and `valueAxis.end` to extension measures to control the Y-axis range dynamically. Common patterns: pin `start` to zero so the axis doesn't float; set `end` to 120% of the max value so the latest-point label has room. Use `pbir visuals cf --measure` for measure-bound axis properties

```bash
# Pin Y-axis floor to zero
pbir visuals cf "Visual.Visual" --measure "valueAxis.start _Fmt.Zero"

# Dynamic ceiling at 120% of max
pbir visuals cf "Visual.Visual" --measure "valueAxis.end _Fmt.AxisCeiling"
```

## Examples

Working `visual.json` files demonstrating these patterns:

- **`examples/visuals/default/lineChart.json`** -- minimal lineChart; theme defaults only
- **`examples/visuals/formatted/lineChart.json`** -- actuals vs target with visual calculations for latest-point labels, series labels with leader lines, per-series stroke/color differentiation
- **`examples/visuals/formatted/lineChart-thresholds.json`** -- reference lines bound to measures, error bands (shading), measure-bound axis start/end
- **`examples/visuals/formatted/lineChart-visual-calcs.json`** -- CY vs PY comparison with visual calculations for latest data point markers and labels
- **`examples/visuals/formatted/lineChart-hillvalley.json`** -- measure-driven conditional formatting on `dataPoint.fill`, smooth interpolation

## References

- [Line Charts in Power BI](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-line-chart) -- Microsoft Learn; covers all four line/area variants, series labels, leader lines, small multiples
- [Basic Line Charts in Power BI](https://data-goblins.com/the-line) -- Data Goblins; practical guidance for constructing line charts
- [IBCS Standards 1.2](https://www.ibcs.com/ibcs-standards-1-2/) -- International Business Communication Standards; notation rules for lines, ratios, and trend representation
- [Effectively Communicating Numbers](https://www.perceptualedge.com/articles/Whitepapers/Communicating_Numbers.pdf) -- Stephen Few; when lines are appropriate vs bars, cognitive basis for trend perception
