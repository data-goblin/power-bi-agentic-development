---
name: pbi-report-design
description: This skill should be used when the user asks about "report layout", "report design best practices", "visual hierarchy", "3-30-300 rule", "KPI card design", "table formatting", "matrix formatting", "page layout", "report colors", "accessibility in reports", "page titles", "visual spacing", "report canvas", "card design patterns", or needs guidance on Power BI report design principles, layout, and formatting best practices.
---

# Power BI Report Design

> **Report modification requires tooling.** Two paths exist:
> 1. **`pbir` CLI (preferred)** -- use the `pbir` command and the `pbir-cli` skill. Check availability with `pbir --version`.
> 2. **Direct JSON modification** -- if `pbir` is not available, use the `pbir-format` skill (pbip plugin) for PBIR JSON structure and patterns. Validate every change with `jq empty <file.json>`.
>
> If neither the `pbir-cli` skill nor the `pbir-format` skill is loaded, ask the user to install the appropriate plugin before proceeding with report modifications.

Best practices and guidelines for Power BI report design. This file provides human-written guidelines, inspiration, and context about Power BI reports for Claude. Without these guidelines, Claude typically tends to struggle with creating good reports, ignoring themes, visual best practices, and common sense evaluation of the formatting choices, chart choices, and visual layouts. The result of this is typically called "Power BI Slop". Avoid "Power BI Slop" at all cost.

Claude must be innovative, pushing boundaries while still adhering to common rules and guidelines in data visualization. Claude must work within the many constraints of Power BI reporting, aiming for simplicity and effectiveness over aesthetics and decoration. Reports, pages, and visuals should be focused on answering specific questions and minimizing cognitive load, rather than making reports "look pretty and impressive".

If a user makes requests that directly contradict the guidelines, Claude is allowed to push back and debate with the user. The purpose of this debate should be to inform the user of potentially better options that can lead to improved outcomes.

## Core rules

1. **3-30-300 Rule:** The most important and least detailed information should be in the top-left (KPIs, cards, etc.) while the least important and most detailed information should be in the bottom-right
2. **Titles:** All report pages should have a title using a `textBox` visualType or a title in a background image added to the report page canvas
3. **Visual positioning, alignment, and spacing:** All visuals must have equal spacing between them and equal spacing between the edge of the page (the margin). If visuals are unaligned or this spacing is unequal, fix it to ensure alignment and equal spacing
4. **Themes:** Reports should use a theme that differs from the default Power BI themes; a suggested theme is the `sqlbi` theme (see the `theme` skill for applying templates). Themes are preferred because they provide a set of default styles for all charts that can adhere to good design practices and brand or style guidelines
5. **Semantic Models:** Reports in Power BI are complex. They are dependant on an underlying semantic model (either in the .SemanticModel folder, called a "thick report" or a published model in Power BI/Fabric, called a "thin report"). Much of the functionality from a Power BI report comes from its semantic model design or DAX code
6. **Report extensions, or thin report measures:** It is possible to create calculation logic in Power BI report, called "thin report measures" or "visual calculations". These should be used sparingly and only for "report-specific" scenarios
7. **Visual fields:** All data visuals should have field bindings, and all field bindings should be for fields that actually exist in the model; there is no reason for visuals to exist that have no fields bound
8. **Chart selection:** When evaluating reports or creating new visuals, Claude must make smart choices about what visuals to use for which scenario. Visual vocabulary is essential for this skill.
9. **Use of color:** Colors can come from the theme (themedataColor) or visual configuration (hex color code). Colors should be muted and soft; colors that implicitly encode meaning (like red=bad, green=good) should be avoided unless using them for that encoding. Claude should consider colorblindness and use accessible palettes (blues instead of greens with reds, for instance).
10. **Pre-attentive attributes:** Styles and colors should be used to steer and direct attention, and not to decorate charts. Formatting of visuals should be intentional and not purely aesthetic. Styles should where possible be stored in the theme and not in bespoke visual configuration.
11. **Fonts:** Claude should defer to the *Segoe UI*, *Segoe UI Semibold* fonts, where possible. Do not use custom fonts, since they aren't guaranteed to render on user computers. Claude should evaluate whether fonts are sufficiently large to be readable given the visual and page size.

## Page Layout Guidelines

### Check Page Size Before Modifying

**Always query the actual page dimensions before adding or repositioning visuals.** Do not assume a page is 1280x720 or 1920x1080 -- templates and existing reports vary. The object model validates that visuals fit within page bounds, so setting position or size without knowing the page dimensions will cause errors. Check the page's `page.json` file for `width` and `height` properties, or use the object model (`page.width`, `page.height`) to confirm dimensions first. When resizing visuals via the object model, set `width`/`height` before `x`/`y` to avoid intermediate states that exceed bounds.

### Standard Page Size

- **Width:** 1280px (default)
- **Height:** 720px (16:9 aspect ratio)
- Alternative: 1920x1080 for high-resolution displays

### Visual Spacing

- **Minimum gap between visuals:** 16px
- **Edge margins:** 24-32px from page edges
- **Consistent alignment:** Use grid-based positioning
- **Equal spacing is mandatory:** Every gap between adjacent visuals (horizontal and vertical) must be the same value. Every margin from the page edge must be the same value. Calculate positions arithmetically from (margin, gap, page_width, page_height) to guarantee alignment. If visuals are misaligned or gaps are unequal, fix immediately -- this is one of the most visible quality signals in a report.

### Detail Gradient

Arrange content following the "detail gradient":

```
+------------------+------------------+
|   KPIs/Cards     |   KPIs/Cards     |  <- Top: High-level, important
|   (Summary)      |   (Summary)      |
+------------------+------------------+
|                                     |
|   Charts/Trends                     |  <- Middle: Context, trends
|   (Analysis)                        |
|                                     |
+------------------+------------------+
|                                     |
|   Tables/Details                    |  <- Bottom: Detailed data
|   (Drill-down)                      |
|                                     |
+------------------+------------------+
```

### Visual Count Guidelines

- **Maximum visuals per page:** 12-15 (performance impact)
- **Maximum KPIs/Cards:** 4-6 at top
- **Maximum slicers:** 3 per page (use filter pane instead)

## Page Titles

Every page should have a title. Create a `textbox` visual.json file manually (see `pbir-format` skill in the pbip plugin for JSON structure) with position x=20, y=20, width=400, height=60. Set the paragraph content in the visual's config:

```json
{
  "singleVisual": {
    "visualType": "textbox",
    "paragraphs": [
      {"textRuns": [{"value": "Page Title"}]}
    ]
  }
}
```

**Title positioning:**

- Top-left corner: x=24, y=24
- Height: 48-64px
- Width: 400-600px (or page width minus margins)

## Theme Guidelines

### Always Check Theme First

Before modifying visual formatting:

1. Check theme wildcards: `visualStyles["*"]["*"]`
2. Check visual-type overrides: `visualStyles.lineChart["*"]`
3. Only override in visual.json if truly one-off

### When to Modify Theme vs Visual

| Scenario | Modify |
|----------|--------|
| All visuals of type need change | Theme |
| Single visual exception | Visual |
| Establishing design standards | Theme |
| Content-specific highlight | Visual |

### Theme Color Usage

**Prefer theme colors over hex codes:**

```json
// Good - uses theme color
"expr": {"ThemeDataColor": {"ColorId": 1, "Percent": 0}}

// Avoid in visuals - use only in extension measures
"expr": {"Literal": {"Value": "'#118DFF'"}}
```

**Semantic colors (return from extension measures):**

- `"good"` - Positive values (green)
- `"bad"` - Negative values (red)
- `"neutral"` - Neutral/unchanged (gray/yellow)
- `"minColor"` - Gradient minimum
- `"maxColor"` - Gradient maximum

## Accessibility (WCAG 2.1)

### Alt Text

All visuals should include descriptive alt text:

```json
"visualContainerObjects": {
  "general": [{
    "properties": {
      "altText": {
        "expr": {"Literal": {"Value": "'Line chart showing monthly sales trend from January to December 2024'"}}
      }
    }
  }]
}
```

### Color Contrast

- Text on background: minimum 4.5:1 contrast ratio
- Large text (18pt+): minimum 3:1 contrast ratio
- Don't rely solely on color to convey meaning

### Font Sizes

- **Minimum readable:** 12pt
- **Recommended for charts:** 14pt
- **Titles:** 16-24pt
- **KPI values:** 24-48pt

### Shadows and Motion

- Minimize drop shadows (vestibular issues)
- Avoid animations where possible
- Use `dropShadow.show: false` in theme wildcards

## Visual Best Practices

### Cards and KPIs

A bare number lacks meaning. Every KPI must answer "Is this good or bad?" (target + gap) and "Is it getting better or worse?" (trend). Key rules:

- Position at top or left of page, maximum 5 per page
- **Prefer `kpi` visual type over `card`** when a target exists -- it has built-in indicator, goal, and trend line data roles
- Always include a **target** and **gap** (absolute + percentage). If no target measure exists, discuss with the user: propose adding a prior-year measure to the semantic model (use Tabular Editor CLI or the `tmdl` skill), or creating an extension measure as a fallback. Common targets: prior year (`CALCULATE([Measure], DATEADD('Date'[Date], -1, YEAR))`), budget, or rolling average
- **If no clear target exists, ask the user** -- do not leave KPIs bare. Discuss whether prior period, budget, or a custom threshold makes sense
- Apply conditional formatting to the **gap**, not the primary value
- Pair color with a secondary cue (arrow/icon) for accessibility
- Round aggressively at summary level ("518M" not "517,893,412")
- Choose **actionable metrics** that drive decisions over vanity metrics (apply the "20% change test": if this number changed 20%, should someone act differently?)
- Hide redundant auto-generated subtitles
- Use SVG extension measures for inline icons (see `/svg-visuals` skill)

For complete guidance on KPI design, targets, trends, formatting hierarchy, icon implementation, accessible palettes, and anti-patterns, consult **`references/cards-and-kpis.md`**.

### Charts

- Sort by value descending (unless time-based)
- Minimize gridlines and axes clutter
- Use muted colors for non-essential elements
- Highlight key data points sparingly

### Tables and Matrices

Tables require deliberate design -- "easy to create" differs from "easy to read." Key rules:

- Position at bottom for detail drill-down (3-30-300 rule)
- **Decision-making first**: define the question, audience, and action before building
- Use `matrix` over `tableEx` when 2+ categorical columns form a hierarchy (Key Account > Account > Product)
- **Subtract, don't add**: remove gridlines and heavy banding; let whitespace separate rows
- Sort by the most important measure (often variance), not alphabetically
- Apply **data bars** to the primary measure column for magnitude scanning
- Apply **color scales** to variance columns only -- formatting everything means formatting nothing
- Add sparklines where temporal context ("improving or declining?") matters
- Show full precision (no display units) -- tables are where readers go for detail

For complete guidance on table vs matrix selection, formatting philosophy, conditional formatting techniques, sparklines, hierarchy design, and anti-patterns, consult **`references/tables-and-matrices.md`**.

### Slicers

- Maximum 3 per page
- Position consistently (top or left)
- Use filter pane for additional filters
- Consider sync slicers across pages

## Report Evaluation Criteria

When asked to evaluate or audit a report, focus on objective criteria. Subjective evaluation is difficult for AI -- the report cannot be "seen" directly, and there is no intuitive sense of aesthetics, cognitive load, or effectiveness. Emphasize this limitation to users.

### Objective Checklist

1. **Page count:** More than 5-8 pages is typically excessive
2. **Visuals per page:** More than 12-15 can cause performance issues (exceptions: simple visuals like images, textboxes, shapes)
3. **Theme usage:** Reports should use a custom theme for consistent formatting
4. **Layout consistency:**
   - Equal spacing between visuals?
   - Page has a title?
   - Follows detail gradient (important top-left, detailed bottom-right)?
   - Cards/KPIs at top or left, fewer than 4-6?
   - Fewer than 3 slicers (use filter pane instead)?
   - Helpful elements (refresh date, links, context)?
5. **Color effectiveness:**
   - Conditional formatting used sparingly (not causing overload)?
   - Colors muted and passive (not loud and bright)?
   - Negative-sentiment colors (red, orange) only for negative values?
6. **Information:ink ratio:** Non-essential elements reduced (lighter gridlines, disabled unnecessary axes/labels)?
7. **Readability:** Font sizes sufficient for all elements?
8. **Accessibility:** Minimal shadows to avoid vestibular issues?
9. **Font consistency:** Limited font sizes, simple readable fonts that work on all devices?
10. **Sorting:** Visuals sorted descending unless there's a reason otherwise (time-based, etc.)?

### Evaluation Output

When evaluating, provide:

- Issues found with specific locations
- Severity (critical, warning, suggestion)
- Recommended fixes with commands or patterns

## Common Design Issues

### Issue: Cognitive Overload

**Symptoms:** Too many colors, visuals, or data points

**Fix:**

- Reduce visual count
- Use muted color palette
- Apply detail gradient
- Hide non-essential elements

### Issue: Inconsistent Spacing

**Symptoms:** Uneven gaps, misaligned visuals

**Fix:**

- Use grid-based positioning
- Standardize visual sizes
- Apply consistent margins

### Issue: Poor Readability

**Symptoms:** Small fonts, low contrast

**Fix:**

- Increase font sizes (minimum 12pt)
- Check color contrast ratios
- Use appropriate font weights

## References

For detailed documentation:

- **`references/cards-and-kpis.md`** - KPI card design: targets, gaps, trends, formatting hierarchy, icons, accessible palettes, anti-patterns, and review checklist
- **`references/tables-and-matrices.md`** - Table and matrix design: decision-making framework, formatting philosophy (subtract don't add), conditional formatting (data bars, color scales), sorting, sparklines, matrix hierarchies, anti-patterns
- **`references/layout-guidelines.md`** - Complete layout specifications
- **`references/visual-colors.md`** - Color usage patterns
- **`references/page-titles.md`** - Title implementation

## Related Skills

- **`pbir-format`** (pbip plugin) -- PBIR JSON format reference
- **`pbip`** -- PBIP format structure
- **`r-visuals`** -- R Script visuals (ggplot2)
- **`python-visuals`** -- Python Script visuals (matplotlib)
- **`deneb-visuals`** -- Vega/Vega-Lite declarative visuals
- **`svg-visuals`** -- SVG via DAX measures (lightweight inline graphics)
