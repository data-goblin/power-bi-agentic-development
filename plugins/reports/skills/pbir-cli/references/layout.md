# Visual Selection and Layout

How to choose the right visual type and lay it out effectively. This is the starting point before creating any visual.

## Choosing a Visual Type

Visual selection is driven by the question the visual answers; not by the data shape. Ask: **"What comparison or pattern should the reader perceive?"**

### Decision Framework

| Reader Question | Visual Type | Notes |
|---|---|---|
| "What is the current value?" | `cardVisual`, `kpi` | Use `kpi` when a target exists |
| "How does this trend over time?" | `lineChart` | Time on x-axis; avoid bar/column for time |
| "How do categories compare?" | `clusteredBarChart`, `clusteredColumnChart` | Bar (horizontal) for long labels; column (vertical) for short labels |
| "What is the part-to-whole?" | `stackedBarChart`, `stackedColumnChart`, `donutChart` | Stacked bars for multi-category; donut for single split |
| "How are two measures related?" | `scatterChart` | Two continuous axes |
| "What are the individual records?" | `tableEx`, `pivotTable` | Table for flat; matrix for hierarchical |
| "Where is something happening?" | `map`, `filledMap` | Bubble map for magnitude; filled map for density |
| "What is the cumulative effect?" | `waterfallChart` | Shows positive/negative contributions to a total |
| "How is a value distributed?" | `treemap` | Nested rectangles proportional to value |
| "What measure drives an outcome?" | `keyDriversVisual`, `decompositionTreeVisual` | AI-powered; use sparingly |
| "What should the user filter by?" | `slicer`, `advancedSlicerVisual` | Max 3 per page; use filter pane for extras |

### When Native Visuals Fall Short

Some scenarios need custom visuals. Route to the appropriate skill:

| Scenario | Skill | Visual Type |
|---|---|---|
| Advanced interactive charts (lollipop, dumbell, custom axes) | `deneb-visuals` | Deneb (Vega/Vega-Lite) |
| Inline table/card graphics (sparklines, progress bars, icons) | `svg-visuals` | SVG extension measures |
| Statistical charts (distributions, regressions, correlation) | `python-visuals` | matplotlib/seaborn |
| Statistical charts (forecast, heatmap, corrplot) | `r-visuals` | ggplot2 |

**Trade-offs**: Custom visuals offer more flexibility but take more iterations to develop and are harder to maintain. Always discuss with the user before committing to a custom visual approach using `AskUserQuestion`.

## Page Dimensions

Always query actual page dimensions before placing visuals. Do not assume 1280x720.

```bash
pbir get "Report.Report/Page.Page"          # Page width, height
```

| Type | Width | Height | Use Case |
|------|-------|--------|----------|
| Standard | 1280 | 720 | Desktop (default) |
| Full HD | 1920 | 1080 | High-res displays, presentations |
| Letter | 816 | 1056 | Print, portrait |
| 4:3 | 1280 | 960 | Legacy displays |

## Margins and Spacing

```
Page margins:     24-32px (all sides, equal)
Gap between visuals: 16px minimum (24px recommended)
Grid alignment:   8px or 16px increments
```

**Symmetrical spacing is critical.** Every gap between adjacent visuals (horizontal and vertical) must be the same value. Calculate positions arithmetically:

```
content_width = page_width - (2 * margin)
total_gaps = gap * (num_visuals_in_row - 1)
visual_width = (content_width - total_gaps) / num_visuals_in_row
```

Example: 4 equal visuals on 1280px page, 24px margins, 16px gaps:
```
content_width = 1280 - 48 = 1232
total_gaps = 16 * 3 = 48
visual_width = (1232 - 48) / 4 = 296
x positions: 24, 336, 648, 960
```

### Vertical Column Alignment

When visuals in different rows share a vertical split, column boundaries must align across rows. The gap position in row 2 must match row 1.

```
RIGHT (aligned):
+------ 608px ------+--16--+---- 608px ----+   Row 1
+------ 608px ------+--16--+---- 608px ----+   Row 2
                     ^
                     Same column edge

WRONG (misaligned):
+------ 648px ------+--16--+---- 568px ----+   Row 1
+------- 500px ------+--16--+--- 716px ----+   Row 2
```

## Detail Gradient (3-30-300 Rule)

Arrange visuals top-to-bottom by importance and detail level:

```
+--------------------------------------------------+
|  Zone 1: Summary (KPIs, Cards)                   |  y: 24 - ~200
|  Most important, least detail                     |
+--------------------------------------------------+
|  Zone 2: Analysis (Charts, Trends)               |  y: ~216 - ~600
|  Context, patterns, comparisons                   |
+--------------------------------------------------+
|  Zone 3: Detail (Tables, Matrices)               |  y: ~616 - bottom
|  Precise values, drill-down                       |
+--------------------------------------------------+
```

| Zone | Purpose | Height | Visual Types |
|------|---------|--------|--------------|
| 1 | Summary | 150-200px | `cardVisual`, `kpi`, slicers |
| 2 | Analysis | 350-450px | Charts, maps, gauges |
| 3 | Detail | 350-450px | `tableEx`, `pivotTable` |

## Common Visual Sizes

| Visual | Width | Height | Notes |
|--------|-------|--------|-------|
| Card/KPI | 200-300 | 100-150 | Min height 130px for value + label |
| Chart (small) | 400 | 300 | Side-by-side pair |
| Chart (medium) | 600 | 400 | Standard single chart |
| Chart (large) | 900 | 500 | Primary analysis chart |
| Chart (full-width) | content_width | 400-500 | Spanning the page |
| Table/Matrix | content_width | 300-500 | Usually full width |
| Slicer (horizontal) | 200-400 | 56-80 | Button or dropdown |
| Slicer (vertical) | 150-200 | 200-400 | List style |

## Layout Patterns

### KPI Row + Chart + Table (Standard Dashboard)

```bash
# Title
pbir add title "Report.Report/Page.Page" "Sales Dashboard" --x 24 --y 24

# KPI row (4 cards, equal width)
pbir add visual cardVisual "Page.Page" --title "Revenue" \
  -d "Data:Sales.Revenue" --x 24 --y 88 --width 296 --height 140
pbir add visual cardVisual "Page.Page" --title "Orders" \
  -d "Data:Sales.OrderCount" --x 336 --y 88 --width 296 --height 140
pbir add visual cardVisual "Page.Page" --title "Margin" \
  -d "Data:Sales.Margin" --x 648 --y 88 --width 296 --height 140
pbir add visual cardVisual "Page.Page" --title "Customers" \
  -d "Data:Sales.CustomerCount" --x 960 --y 88 --width 296 --height 140

# Two charts side-by-side
pbir add visual lineChart "Page.Page" --title "Revenue Trend" \
  --x 24 --y 244 --width 608 --height 220
pbir add visual clusteredBarChart "Page.Page" --title "Revenue by Region" \
  --x 648 --y 244 --width 608 --height 220

# Detail table (full width)
pbir add visual tableEx "Page.Page" --title "Order Details" \
  --x 24 --y 480 --width 1232 --height 216
```

### Analysis Layout (Main + Supporting)

```bash
# Main chart (left, 2/3 width)
pbir add visual lineChart "Page.Page" --title "Trend Analysis" \
  --x 24 --y 88 --width 808 --height 400

# Stacked supporting visuals (right, 1/3 width)
pbir add visual cardVisual "Page.Page" --title "Current" \
  --x 848 --y 88 --width 408 --height 140
pbir add visual clusteredBarChart "Page.Page" --title "By Category" \
  --x 848 --y 244 --width 408 --height 244
```

### KPI-Heavy Dashboard

```bash
# Large KPI cards (2x2 grid)
pbir add visual cardVisual "Page.Page" --title "Revenue" \
  --x 24 --y 88 --width 608 --height 200
pbir add visual cardVisual "Page.Page" --title "Margin" \
  --x 648 --y 88 --width 608 --height 200
pbir add visual cardVisual "Page.Page" --title "Orders" \
  --x 24 --y 304 --width 608 --height 200
pbir add visual cardVisual "Page.Page" --title "OTD" \
  --x 648 --y 304 --width 608 --height 200

# Trend chart (full width)
pbir add visual lineChart "Page.Page" --title "Monthly Trend" \
  --x 24 --y 520 --width 1232 --height 176
```

## Visual Count

| Count | Level | Notes |
|-------|-------|-------|
| 6-8 | Optimal | Best render performance |
| 9-12 | Acceptable | Slight impact |
| 13-15 | Warning | Noticeable delay |
| 16+ | Critical | Performance issues |

Simple visuals (textbox, image, shape, button) have minimal performance impact and don't count toward these limits.

## Positioning Verification

After placing visuals, verify alignment and spacing:

```bash
pbir tree "Report.Report" -v               # See all visual positions
pbir cat "Report.Report/Page.Page"         # Full page JSON with coordinates
pbir validate "Report.Report"              # Structural integrity
```

Check:
- All horizontal gaps are equal
- All vertical gaps are equal
- Column edges align across rows
- No visuals extend beyond page bounds
- Margins are consistent on all sides
