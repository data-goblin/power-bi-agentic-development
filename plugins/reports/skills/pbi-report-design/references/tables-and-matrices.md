# Tables and Matrices: Design Best Practices

Tables and matrices sit at the bottom of the detail gradient (3-30-300 rule) -- they provide drill-down detail for readers who need specifics beyond what KPIs and charts convey. "Easy to create" is not the same as "easy to read." A well-formatted table answers a specific question; a poorly formatted one is a wall of numbers that nobody uses.

The core principle: **format tables to answer specific reader questions, not to display all available data.** Before touching formatting, identify what the reader needs to know and why. Content selection and decision-making come first; formatting amplifies the signal.

## Decision-Making First

Before creating a table or matrix, answer these questions:

1. **What question does this table answer?** (e.g., "Which products are behind target?")
2. **Who reads it and what action do they take?** (e.g., "Sales managers re-allocate resources")
3. **What columns are essential to answer that question?** Remove everything else
4. **What should the reader see first?** This determines sort order and emphasis

Tables are valid visualizations when readers need precise numerical values, comparisons across many dimensions, or specific row lookups. The challenge is that human perception excels at visual pattern recognition but struggles with large numerical grids requiring mental calculation. Formatting must offload cognitive work from memory to visual perception.

## Table vs Matrix: When to Use Which

| Scenario | Visual Type | Why |
|---|---|---|
| Flat list of records, no grouping | `tableEx` | Simple rows, no hierarchy needed |
| Hierarchical categories (e.g., Region > Country > City) | `matrix` (pivotTable) | Rows expand/collapse, subtotals per level |
| Cross-tab / pivot (categories on both axes) | `matrix` | Row headers + column headers + values |
| Two or more categorical columns that form a natural hierarchy | `matrix` | Avoids repeating parent values in every row |

**Rule of thumb**: If the table has 2+ categorical columns where one is a parent of the other (Key Account > Account > Product), use a matrix. The expand/collapse behavior reduces visual clutter and lets readers drill into relevant sections without scrolling through thousands of flat rows. A flat table with repeating parent values is one of the most common anti-patterns.

## Column Selection

Include only columns that serve the question. Every column competes for horizontal space and reader attention. If the reader's question is "which products are behind target?", the variance column matters most -- showing separate actual and target columns alongside it may be redundant.

- **Leading columns**: The primary dimension(s) the reader groups by (customer, product, date)
- **Measure columns**: The KPIs that matter for this page -- typically the same measures shown in the KPI cards above
- **Avoid**: Internal IDs, keys, redundant names, measures unrelated to the page question, or columns that can be derived from others already shown

## Column Ordering

Order columns by importance, left to right:

1. **Row labels / hierarchy** (leftmost) -- what the reader scans first
2. **Primary measure** -- the metric that answers the page question (e.g., Order Lines)
3. **Secondary measures** -- supporting metrics (Net Orders, OTD %)
4. **Variance / delta columns** -- if applicable (vs 1YP, vs Budget)

## Sorting

**Always sort by the most important measure, descending.** Alphabetical sorting rarely answers useful questions. The top rows should show the largest/most significant items -- often the variance or gap column rather than the absolute value. This aligns with how business users read tables: they care about top contributors or biggest deviations first.

Set the sort configuration in the visual.json `query` block by specifying the sort field and direction (Descending).

For time-based detail tables (e.g., daily breakdown), sort ascending by date instead.

## Formatting

### Philosophy: Subtract, Don't Add

The default Power BI table styling includes gridlines, banded rows, and borders that compete with the data for visual attention. The recommended approach is to **remove visual noise and let whitespace do the separation work**:

- Strip or minimize gridlines (horizontal only if any)
- Remove banded row shading (or use an extremely subtle tint, 2-3% opacity)
- Reduce border complexity
- Increase row padding to let whitespace separate rows naturally

This is counterintuitive -- many designers add formatting elements to "improve" tables. Better tables result from removing clutter so the data signal stands out.

### Theme-First Approach

Most table formatting should come from the theme. Only override at the visual level for genuinely one-off cases.

Check what the theme already provides by inspecting the theme.json `visualStyles` for `tableEx` and `pivotTable` entries (grid, columnHeaders, values properties).

### Key Formatting Properties

| Property | Recommended | Notes |
|---|---|---|
| Grid lines | Horizontal only, or none | Vertical lines add clutter; let column spacing separate. Horizontal lines aid row scanning when rows are dense |
| Banded rows | Off or extremely subtle (2-3% opacity) | Heavy banding competes with data; whitespace is better |
| Row padding | 6-10px | More breathing room than default. Let whitespace, not gridlines, separate rows |
| Header font | Segoe UI Semibold, 10-12pt | Distinguishable from values but not dominant |
| Value font | Segoe UI, 10-12pt | Consistent across all value columns |
| Column width | Auto or proportional | Avoid truncation; let measures be narrower than text columns |
| Borders | Minimal or none | Let content structure speak for itself |

### Number Formatting in Tables

Unlike KPI cards, tables should show **more precision** -- this is where readers go for detail:

- Measures: Use the model's format string (e.g., `#,##0` for integers, `#,##0.0%` for percentages)
- Do NOT apply display units (thousands/millions) in tables -- show full values
- Align numbers right, text left (Power BI default)

## Conditional Formatting

Conditional formatting is the primary tool for offloading cognitive work from the reader's memory to visual perception. But it must be applied strategically -- formatting on every column creates visual overload where nothing stands out.

### Data Bars

Apply data bars to the **primary measure column** (orders, revenue, volume). Data bars let readers compare magnitudes at a glance without reading numbers. They transform a column of numbers into a scannable visual pattern.

Configure data bars in the visual.json `objects` by setting the `dataBar` property on the relevant measure column.

### Color Scales on Variance Columns

Apply color scales to **variance/delta columns only** -- not to absolute values. Use an intuitive diverging scheme:

- Red/warm tones for negative/underperformance
- Blue/cool tones for positive/overperformance (avoid green for accessibility)

Create an extension measure for color (e.g., in `reportExtensions.json`):

```dax
OTD Color = IF([OTD % (Lines)] >= 0.9, "good", IF([OTD % (Lines)] >= 0.8, "neutral", "bad"))
```

Then bind it as a conditional formatting rule for `values.fontColor` in the visual.json objects.

### Directional Indicators

Triangle or arrow symbols with color coding can indicate direction (up/down) alongside magnitude. These are especially effective on variance columns where the direction of change matters as much as the size.

### What to Format and What Not To

| Column Type | Formatting | Rationale |
|---|---|---|
| Primary measure | Data bars | Enables magnitude comparison without reading numbers |
| Variance / delta | Color scale or font color | Instantly signals good/bad performance |
| Status indicators (OTD %, quality) | Color when above/below threshold | Only when the threshold matters for decisions |
| Dimension columns | None | Text labels need no emphasis |
| Secondary measures | None | Formatting everything means formatting nothing |

## Sparklines and Inline Trends

Sparklines add temporal context that answers "is this improving or declining?" -- information that a single number cannot convey. They distinguish between a product that is currently behind target but improving vs. one that is declining.

Add a native Power BI sparkline by binding a measure to the `Values` role with a sparkline date field in the visual.json query block.

For richer inline visuals (dumbbell charts, bullet charts, progress bars), use SVG extension measures via the `svg-visuals` skill (custom-visuals plugin). The trade-off: higher development and maintenance overhead vs. richer context. Use only when benefits justify added complexity.

## Matrix-Specific Guidance

### Row Hierarchy

Bind categories in order from broadest to most granular:

Create a matrix visual.json file manually (see `pbir-format` skill in the pbip plugin for JSON structure) with title "Detail" and field bindings: `Rows: Customers.Key Account Name`, `Rows: Customers.Account Name`, `Rows: Products.Product Name`, `Values: Orders.Order Lines`, `Values: Orders.Net Orders`.

### Subtotals

Matrix visuals show subtotals at each hierarchy level by default. This is usually desirable -- it answers "how much for this Key Account across all products?" However, for very deep hierarchies (4+ levels), consider hiding intermediate subtotals to save space.

### Expand/Collapse

By default, matrices start collapsed to the top level. This is the preferred behavior -- it respects the detail gradient principle. Readers expand only the rows they care about.

### Column Hierarchy (Pivot)

Use column headers for time periods or categorical pivots:

Add a column hierarchy binding for `Columns: Date.Calendar Quarter (ie Q1)` in the visual.json query block.

## Sizing

- **Minimum height**: 180-200px (enough for header + 5-8 visible rows)
- **Full width**: Tables/matrices typically span the full page width (margin to margin)
- **Pagination**: Power BI handles pagination automatically; ensure enough height for meaningful data density

### Auto-Size Width

**Turn off auto-size width** when the table/matrix is placed in a constrained container (i.e., not full page width). Auto-size width calculates column widths based on content, which can exceed the visual container width and produce a horizontal scrollbar. Horizontal scrollbars are a bad practice -- they hide columns, break scannability, and signal that the visual doesn't fit its layout.

When auto-size is off, columns distribute proportionally within the visual's width. This may truncate long text values, but truncation with a tooltip is better than a scrollbar that hides entire columns off-screen.

Set `columnHeaders.autoSizeColumnWidth` to `false` in the visual.json objects:

```
columnHeaders.autoSizeColumnWidth = false  -> columns fit container proportionally
columnWidth.value = <pixels>               -> fixed width (only when autoSize is off)
```

**Rule of thumb**: If the table is full-width (margin to margin), auto-size is usually fine. If the table shares a row with another visual (e.g., bar chart left, matrix right), disable auto-size width.

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|---|---|---|
| Skipping the decision-making phase | Table shows data without answering a question | Define the question, audience, and action before building |
| Flat table with repeating parent values | Redundant data, hard to scan | Use matrix with hierarchy |
| Too many columns (>8) | Horizontal scroll, cognitive overload | Remove non-essential columns; disable auto-size width if constrained |
| Alphabetical sort | Rarely answers useful questions | Sort by primary measure or variance descending |
| Conditional formatting on every column | Visual overload, nothing stands out | Apply data bars to primary measure, color to variance only |
| Heavy gridlines + banded rows | Visual noise competes with data | Remove gridlines, use whitespace to separate rows |
| Display units in tables | Loses the detail readers came for | Show full precision |
| Same title as page title | Redundant information | Use differentiating title (e.g., "by Account and Product") |
| Unformatted data dump | Creates unused reports; nobody scans raw number walls | Apply the full formatting workflow |
| Showing actual + target + variance | Redundant when variance alone answers the question | Show variance; remove actual/target if not needed |

## Checklist

- [ ] Question defined: what does this table answer and for whom?
- [ ] Visual type matches data structure (table for flat, matrix for hierarchical)
- [ ] Only essential columns included (no redundant or derived columns)
- [ ] Sorted by most important measure or variance descending
- [ ] Column order: dimensions left, primary measure next, variance right
- [ ] Visual noise removed: minimal gridlines, no heavy banding, adequate whitespace
- [ ] Data bars on primary measure column for magnitude scanning
- [ ] Color scales on variance columns only (not on every column)
- [ ] Number formatting shows appropriate detail (no display units)
- [ ] Sparklines added where temporal context matters
- [ ] Subtitle hidden
- [ ] Title differentiates from page title
- [ ] Auto-size width disabled if visual shares row with other visuals (prevents horizontal scrollbar)
- [ ] Height sufficient for 5-8 visible rows minimum
