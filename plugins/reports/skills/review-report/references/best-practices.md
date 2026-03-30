# Report Design Best Practices

Data visualization and report design principles for evaluating Power BI reports. Based on the [Data Goblins Report Checklist](https://data-goblins.com/power-bi/report-checklist).

## Reviewing Philosophy

An LLM or agent cannot assert that a report "looks good" or "is good." Provide evaluation and suggestions for possible improvements, but aim to spar with the user... steer them in the right direction and augment them with the appropriate skills to make good things.

**Best practices are defaults, not mandates.** They are recognized standards providing a helpful starting point for most scenarios. They are not optimizations. Optimizations are situation-specific techniques. When flagging deviations from best practices, present them as observations and suggestions, not failures. Ask the user whether the deviation is intentional. Do not over-extrapolate from one scenario to another or make assumptions about the audience or purpose of the report.

**For performance recommendations specifically:** do not recommend optimizations without evidence. If suggesting a change, recommend that the user test it rigorously, or offer to test it yourself by inferring queries from visual fields and querying the semantic model with a trace. Test multiple times when comparing; a single test yields misleading conclusions. Revert to simpler approaches if testing shows no meaningful improvement... avoid unnecessary complexity

When viewing a report (via Chrome MCP, Playwright, devtools, or screenshot), keep a keen eye for anomalies like (Blank) values, repeating values, or query errors, but do not use a simple screenshot or interaction to assert design competence. Always confirm font size readability with the user -- Claude tends to underestimate whether fonts are large enough.

## Understanding Business Context

Before evaluating design, understand the report's purpose:

1. **What business process is being reported on?** Read the report definition and the definition of its underlying semantic model to understand this.
2. **What questions is it trying to answer?** Is it descriptive, exploratory, or prescriptive?
3. **Who is the intended audience?** What are they expected to do with this data? Ask the user.
4. **Is the report redundant?** Are there other, related reports tackling similar questions or reporting similar data? Check with the `fabric-cli` skill.
5. **Is it replacing an existing solution?** If migrating from another tool/platform, is that existing solution being used? Ask the user.

You can hypothesize, but don't assume purpose from the visual layout or metadata alone.

## The 3/30/300 Rule

| Time | What the user should grasp | Design implication |
|---|---|---|
| **3 seconds** | The main message or headline insight | KPIs, cards, and titles at the top-left |
| **30 seconds** | Context and supporting trends | Charts and comparisons in the middle |
| **300 seconds** | Granular detail for exploration | Tables, matrices, and drill-through in the bottom-right |

## Layout

- Charts should be consistent in their sizes
- Equal spacing between charts on a page and between charts and the page edges
- Most important and simplest information in the top-left; more detailed/dense information in the bottom-right
- Charts should have sufficient space to render, while not too many charts are displayed at once
- Only 2-3 simple slicers on the page; the rest should be in the filter pane
- Report pages should have a clear and descriptive title
- Include data freshness information (e.g. a card showing last refresh datetime)
- Identical slicers on different pages should be synchronized

## Chart Selection

Match the visualization type to the analytical question being asked.

### Visual Vocabulary

| Question | Recommended Visual | Avoid |
|---|---|---|
| What is the current value? | Card, KPI | Gauge (hard to read), pie chart |
| How does this compare? | Bar chart (horizontal preferred -- axis labels more readable) | Pie chart (>3 slices), donut |
| What is the trend over time? | Line chart, area chart | Bar chart (implies discrete, not continuous) |
| What is the composition? | Stacked bar, treemap | Pie chart (>5 slices) |
| What is the distribution? | Histogram, box plot (via Deneb/SVG), swarm | Default visuals (limited support) |
| What is the relationship? | Scatter plot | Line chart (implies sequence) |
| How do two periods compare? | Slope chart, dumbbell plot (via Deneb/SVG) | Side-by-side bars (harder to compare) |
| What is the part-to-whole? | Stacked bar (100%), waterfall | Pie chart (poor perceptual accuracy) |
| How does this vary by category? | Small multiples, matrix with conditional formatting | Single cluttered chart |

### Charting Best Practices

- Visuals should provide sufficient meaning and context to be interpretable and should leverage pre-attentive attributes
- Axes should start at 0 except for line charts focused on overall trend. If a line chart does not start at 0, note this in the subtitle
- Horizontal bars are better than vertical bars in most cases since axis labels are more readable
- Avoid pie and donut charts. If the user wants one, suggest a donut with smaller radius slices
- Tables and matrices should not have too many columns or try to show too much at once. Sufficient padding (4 is usually enough), not too much conditional formatting. Values should have sufficient rounding to avoid showing too much detail, but users may prefer full unformatted numbers
- Visuals should have sort order applied: typically descending by the key value field, ascending if negative numbers require more attention, or categorical for date fields (quarter, month, year, workdays MTD, etc.)
- Data labels: Use instead of axis ticks if feasible for bar charts. If data labels are shown, the axis may not be needed (but keep the axis title for context)

### Anti-Patterns

- **Pie charts with >5 slices:** Comparing categories is better done with a simple bar chart or alternative chart type
- **Dual-axis charts:** Misleading when scales differ; use small multiples or separate visuals instead
- **Gauges:** Take up space, show one value poorly; use a card with trend instead
- **Default visual interactions:** Avoid deviating from default interactions unless there's an explicit reason to do so
- **Too many custom/macgyvered visuals:** SVG, R, Python, or heavily customized core visuals using atypical properties to achieve unique results increase maintenance burden disproportionately

## Formatting and Conditional Formatting

- Formatting should not be decoration; aim for an optimally high information-to-ink ratio
- Formatting should be functional and consistent between visuals, pages, and related reports. This should be reflected in a good, common theme reused across reports
- Formatting is more about what to take away than what to add
- Static formatting should ideally be in the theme, not in bespoke visual overrides. When the theme changes, it should propagate to all downstream visuals. Some visual overrides are inevitable and necessary, but the theme should carry the baseline
- If data labels are shown, the axis may not be needed -- but keep the axis title so it's clear what is being measured

## Color Usage

Color is a data encoding channel, not decoration. It must be used as a resource to steer or direct attention to important or actionable areas.

### Principles

1. **Muted/pastel palettes:** Soft, desaturated colors reduce visual noise. Reserve saturated/bright colors for emphasis and alerts
2. **Intentional encoding:** Every color should mean something. Color should draw attention to important and actionable elements; it should not be overused
3. **Semantic consistency:** If "Sales" measures are blue on one page, it must be blue on every page
4. **Sentiment colors:** Reds/oranges/yellows for bad and green/blue for good should not be used for categories -- only for sentiment encoding
5. **Accessible palettes:** Test for red-green colorblindness. Prefer blue-orange or blue-red diverging scales. Do not rely on color alone
6. **Limit the palette:** 5-7 colors maximum

## Font and Text

- **Font family:** Use Segoe UI or Segoe UI Semibold, or other default fonts built-in to Power BI. Custom fonts are not guaranteed to render on all devices
- **Consistency:** Font family, size, weight, and color should be consistent throughout. Variation should signal hierarchy, not randomness
- **Minimum sizes:** 9pt for data values, 12pt for labels and titles. Confirm with the user whether sizes are large enough -- always check this
- **Data labels:** Use sparingly. Dense data labels create clutter

## Container Formatting

- Containers should have basic, simple formatting unless there is a specific reason to deviate
- Charts can have titles but avoid redundancy or titles/subtitles taking up too much space

## Interaction Design

### Slicers and Filters

- Maximum of 2-3 slicers on the page; the rest should be in the filter pane
- **Apply buttons:** Consider enabling on reports with performance issues
- **Synchronize slicers** across pages to prevent conflicting filter states
- **Visual-level filters** are invisible to users and a common source of confusion. Document them explicitly. Prefer page-level or report-level filters
- **Default slicer selections:** Set sensible defaults so the report loads with useful data

### Cross-Filtering and Interactions

- Set/modified interactions can be useful but are generally avoided to prevent confusion with users and other developers
- Test filter combinations beyond the defaults and most common scenarios
- Try to interact with the report to verify cross-filtering works as expected

### Navigation and Organization

- **Title/landing page:** Establish context before data
- **Bookmarks:** Use minimally. Sometimes necessary for dynamically showing/hiding charts or navigation, but generally better to avoid. Bookmark states are fragile
- **Organizational pages:** Provide FAQ information about the report, data, model, where to get help, how to read certain charts, calculations, etc. If not a full page, a (?) button with a link can serve the same purpose

## Organizational Best Practices

- **Extension measures:** Can exist but should only contain logic specific to this report. If beneficial for multiple reports, push it into the semantic model
- **Visual calculations:** Can exist but should only contain logic specific to a single visual. If beneficial for multiple visuals, move to an extension measure or model measure
- **Alt text:** Good practice but very rare in practice
- **Hidden visuals / hidden slicers:** Can cause confusion with users and other developers, especially hidden slicers

## Semantic Model Considerations

Many report issues originate in the underlying semantic model. Ask the user:

1. Do they have access to the underlying semantic model?
2. Are they the developer of both the report and model, or only one of them?

If the model is in scope, use the `review-semantic-model` skill in parallel. The following are model-related issues that surface as report symptoms:

- (Blank) values from referential integrity violations (missing keys) or incorrect relationships
- Repeating/inflated values from many-to-many or bidirectional relationships
- Slow visuals caused by expensive DAX measures, large model size, or missing aggregations
- Missing fields referenced by visual bindings (renamed or removed columns/measures)
- RLS not behaving correctly for different user contexts
- Refresh frequency not matching business needs
- Unused columns/tables inflating model size

These are documented in detail in the `review-semantic-model` skill. For the report review, note these as symptoms and flag them for model-level investigation.

## Design for Agents

- Use annotations to provide documentation or descriptive instructions about reports, pages, or visuals
- Include instruction or memory files in the .Report folder that pertain to the report
- Focus on providing key learnings for next time or implicit information from the business or the analysts perspective
