# Cards and KPIs: Design Best Practices

Cards and KPI visuals occupy the most prominent position on a report page (top-left, per the 3-30-300 rule). A bare number lacks meaning -- without context, readers cannot determine whether a metric is good or bad. Human cognition judges magnitude through comparison, not in isolation. Every KPI earning dashboard space must answer two questions without requiring the reader to think:

1. **"Is this good or bad?"** -- answered by a target and gap
2. **"Is it getting better or worse?"** -- answered by a trend

## Limiting KPI Quantity

Working memory holds approximately 3-4 information chunks. A page with 4 KPIs allows readers to retain the complete picture; 12 cards force exhausting loops of scanning, forgetting, and re-scanning. **5 represents a practical ceiling for most pages.**

Selection should be driven by the page's central question. Every KPI must directly serve that question. Metrics that don't contribute constitute noise, regardless of their individual interest.

## Choosing Actionable Metrics

**Vanity metrics** describe activity but don't drive decisions (e.g., total orders always increases). **Actionable metrics** create decision forks where different values suggest different actions.

A useful test: *"If this number changed 20%, should someone act differently?"* If the answer is no, the metric hasn't earned its dashboard space.

Comparative metrics (orders vs. prior year) outperform absolute ones because they immediately signal relative performance.

## Sourcing Targets

Every KPI needs a target. Where the target comes from depends on the model and context:

| Target Source | When to Use | Example DAX |
|---|---|---|
| **Prior year (1YP)** | Default choice when no budget exists | `CALCULATE([Measure], DATEADD('Date'[Date], -1, YEAR))` |
| **Prior month/period** | Short-term operational metrics | `CALCULATE([Measure], DATEADD('Date'[Date], -1, MONTH))` |
| **Budget/forecast** | When budgets exist in the model | Direct measure reference |
| **Rolling average** | Smoothing volatile metrics | `CALCULATE([Measure], DATESINPERIOD('Date'[Date], MAX('Date'[Date]), -3, MONTH))` |

**Preferred: add targets to the semantic model** using Tabular Editor CLI or the `tmdl` skill. Model-level measures are reusable across reports and benefit from server-side evaluation.

**Fallback: extension measures** in the report via `reportExtensions.json`. Use only when the target is report-specific (e.g., a custom threshold unique to one dashboard).

**If no clear target exists, use `AskUserQuestion`** to discuss options with the user. Do not leave KPIs bare -- a number without context is not actionable.

## The Three Elements of a Good KPI

A complete KPI card shows three elements working together:

| Element | Purpose | Example |
|---------|---------|---------|
| **Actual value** | Shows magnitude | 518M |
| **Target / comparison** | Establishes the benchmark | Target: 483M |
| **Gap (delta)** | Explicitly answers "good or bad?" | +35.4M (+7.3%) |

Without gaps, readers must perform mental arithmetic while processing other KPIs. Express gaps in **both absolute and percentage terms** -- the absolute shows scale, the percentage shows relative significance.

**Always label the target** -- "Target: 483M" is ambiguous. Set `goals.goalText` to describe what the comparison actually is: "1YP", "Budget", "3M Avg", etc. This tells the reader *what* they're comparing against without requiring them to look it up.

Set `goals.goalText` to the comparison label in the visual.json objects (e.g., `"1YP"`, `"Budget"`, `"3M Avg"`).

### Implementation

To build a contextualized KPI card, create a `kpi` visual.json file manually (see `pbir-format` skill in the pbip plugin for JSON structure) with title "Revenue MTD", positioned at x=20, y=100, width=300, height=160. Bind field roles: `Indicator: __Measures.Actuals MTD`, `Goal: __Measures.Sales Target MTD`, `TrendLine: Date.Date`.

Alternatively, use a `card` visual with extension measures that compute the gap. Add these to `reportExtensions.json`:

```dax
// Variance measure
Revenue vs Target =
VAR _actual = [Actuals MTD]
VAR _target = [Sales Target MTD]
VAR _gap = _actual - _target
RETURN FORMAT(_gap, "+#,##0;-#,##0") & " (" & FORMAT(DIVIDE(_gap, _target), "+0.0%;-0.0%") & ")"

// Conditional formatting measure for the gap color
Revenue vs Target Color = IF([Actuals MTD] >= [Sales Target MTD], "good", "bad")
```

## Adding Trends

Trends answer: *"Is this typical or is something changing?"* A sparkline showing performance against target reveals directional movement.

Options for adding trends to KPI cards:

1. **KPI visual type**: Has built-in trend line support via the `TrendLine` data role
2. **SVG sparkline**: An extension measure generating inline SVG (see below)
3. **Adjacent line chart**: A small line chart positioned next to or below the card

## Formatting with Intent

Every visual choice should reinforce the KPI's message.

### Size Hierarchy

Primary values should be the **largest element**. Targets and gaps are smaller. Trends should be compact. The eye naturally follows this hierarchy:

1. Headline number (largest, boldest)
2. Verdict / gap (medium, colored)
3. Supporting context -- target, trend (smallest, muted)

### Conditional Color and Symbols

Color signals above/below target instantaneously. **Apply conditional formatting to the gap -- the judgment indicator -- not the primary value.** Pairing color with directional symbols (arrows) ensures the message doesn't depend on color perception alone.

Apply conditional color to the card's `labels.color` property in visual.json by binding it to the `Revenue vs Target Color` extension measure.

**Accessible palettes**: Some users struggle distinguishing green from red. Blue/orange is a more accessible alternative. Always pair color with a secondary cue (arrow, icon). Configure accessible colors in the theme:

Set accessible sentiment colors in the theme.json file: `good: "#2B7A78"`, `bad: "#D4602E"`.

### Display Units and Number Formatting

Round aggressively at the KPI level: **"518M" beats "517,893,412"**. Precision belongs in detail tables, not headline cards. Maintain consistent decimal places and units across all cards on a page.

**"Auto" display units do not work reliably** when measures have custom format strings (e.g., `#,##0`). The format string overrides Auto, resulting in raw unrounded numbers. Instead of relying on Auto, **query the actual values with the report's active filters**, then pick the display unit explicitly per visual.

#### Display Unit Selection Rule

**Pick the largest unit where the displayed integer part is >= 1.** The goal is 2-3 visible digits with no leading zero. Apply this algorithm:

```
value = query result with active filters
if value >= 1,000,000,000,000:  unit = 1000000000000 (Trillions)
elif value >= 1,000,000,000:    unit = 1000000000    (Billions)
elif value >= 1,000,000:        unit = 1000000       (Millions)
elif value >= 1,000:            unit = 1000          (Thousands)
else:                           unit = 1             (None)
```

Then set precision based on digit count of `value / unit`:
- 1 digit (e.g., 3.8M): precision = 1
- 2+ digits (e.g., 35bn, 338K): precision = 0

**Percentage measures** (OTD %, Margin %) always use `unit = 1` (None) with precision 1 -- the format string handles the `%` symbol.

#### Workflow

1. **Query values** with the report's active filters using DAX Studio or Tabular Editor CLI
2. **Apply the selection rule:**
   - 3,768,335 -> >= 1M -> Millions, 3.8 -> 1 digit -> precision 1 -> "3.8M"
   - 35,312,992,122 -> >= 1B -> Billions, 35.3 -> 2 digits -> precision 0 -> "35bn"
   - 0.719 (%) -> None, precision 1 -> "71.9%"
3. **Set per-visual** in visual.json objects (overrides theme default):
   - `indicator.indicatorDisplayUnits` = 1000000
   - `indicator.indicatorPrecision` = 1

#### KPI `indicatorDisplayUnits` Enum

| Value | Label |
|---|---|
| 0 | Auto (unreliable with custom format strings -- avoid) |
| 1 | None |
| 1000 | Thousands |
| 1000000 | Millions |
| 1000000000 | Billions |
| 1000000000000 | Trillions |

### Labels and Titles

Keep descriptors concise: **"Orders MTD"** is superior to "Month-to-Date Order Value (EUR, excl. returns)". Overly complex labels suggest unclear definitions in the semantic model.

**Title vs. callout/category label -- show one, not both.** Card visuals have two places where the metric name appears: the visual *title* (top of the card) and the *category label* / *callout label* (below the value). Showing both is redundant and wastes vertical space. Choose one:

- **Category label only (preferred)**: Hide the visual title (`--no-show`). The category label sits below the large number and naturally reads as "3.8M Order Lines". This is cleaner and leaves more room for the value to render at a large font size.
- **Title only**: Hide the category label by setting `categoryLabels.show` to `false` in the visual.json objects. Use when the page title textbox already establishes context and the card just needs a small header.

To hide the title, set `title.show` to `false` in the visual.json `visualContainerObjects`. To hide the category label, set `categoryLabels.show` to `false` in the visual.json objects.

**Card sizing**: Ensure cards have sufficient height to render the value, label, and any gap/target text without clipping. Minimum recommended height: **130-150px** for a card with value + category label. If the value or label is clipped, increase height before reducing font size.

Hide auto-generated subtitles -- they repeat field binding names and add no information:

Set `subtitle.show` to `false` in the visual.json `visualContainerObjects`.

## Icons in KPI Cards

Icons can reinforce the KPI message -- a directional arrow, a warning triangle, or a category icon. In Power BI, **icons must be added as extension measures using SVG code** following the ImageUrl data category pattern.

Refer to the **`svg-visuals`** skill (custom-visuals plugin) for the proper logic of creating SVG extension measures. The general pattern:

1. Create a DAX measure that returns an SVG string
2. Set the measure's data category to `ImageUrl`
3. Bind the measure to a visual role that supports images

Add an extension measure to `reportExtensions.json` with `dataCategory: ImageUrl`:

```dax
Trend Arrow SVG =
VAR _gap = [Actuals MTD] - [Sales Target MTD]
VAR _color = IF(_gap >= 0, "#2B7A78", "#D4602E")
VAR _rotation = IF(_gap >= 0, "0", "180")
RETURN
"data:image/svg+xml;utf8," &
"<svg xmlns=""http://www.w3.org/2000/svg"" width=""24"" height=""24"" viewBox=""0 0 24 24"">" &
"<polygon points=""12,4 20,16 4,16"" fill=""" & _color & """ transform=""rotate(" & _rotation & " 12 12)""/>" &
"</svg>"
```

Icons should be used sparingly and only when they add information beyond what color and numbers already convey. Do not use icons purely for decoration.

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|---|---|---|
| Bare number with no target | Reader cannot judge performance | Add target and gap |
| Too many cards (>5) | Exceeds working memory | Prioritize by page question |
| Loud colors on primary value | Distracts from the judgment | Color the gap, not the value |
| Excessive precision (517,893,412) | Cognitive overhead at summary level | Round to "518M" |
| Title + category label both visible | Redundant metric name, wastes space | Show one or the other |
| Redundant subtitle | Repeats field name, wastes space | Hide subtitle |
| Card too short (< 130px) | Value or label clipped | Min height 130-150px |
| No trend context | Reader doesn't know direction | Add sparkline or trend indicator |
| Red/green only (no secondary cue) | Inaccessible to colorblind users | Pair with arrow/icon |
| Relying on Auto display units | Custom format strings override Auto, showing raw numbers | Query values, set explicit display units per visual |
| Vanity metrics | Don't drive decisions | Apply the "20% change" test |

## Visual Type Selection

| Scenario | Visual Type | Notes |
|---|---|---|
| Value + target + trend line | `kpi` | Built-in support for all three elements |
| Simple headline number | `card` | Add extension measures for gap and color |
| Multiple related metrics | `multiRowCard` | Groups related KPIs compactly |
| Custom layout with sparkline | `card` + SVG measure | Maximum control, higher complexity |
| Rich formatting with icons | `card` + SVG extension measures | Refer to `svg-visuals` skill (custom-visuals plugin) |

## Checklist for KPI Card Review

When evaluating or creating KPI cards, verify:

- [ ] Each card answers the page's central question
- [ ] Maximum 5 cards per page
- [ ] Each card has a target or comparison value
- [ ] Gap is shown in both absolute and percentage terms
- [ ] Conditional formatting applied to gap (not primary value)
- [ ] Color paired with secondary cue (arrow/icon) for accessibility
- [ ] Numbers rounded appropriately for summary level
- [ ] Subtitles hidden (no redundant auto-generated labels)
- [ ] Font size hierarchy: value > gap > label > trend
- [ ] Consistent units and formatting across all cards on the page
