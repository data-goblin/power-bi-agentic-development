# Visual Formatting Reference

Complete guide to formatting visuals using the pbir CLI. The core principle: **always check and prefer theme-level formatting before applying bespoke visual formatting**.

## Formatting Hierarchy: Theme First

Power BI applies formatting in a cascade: **base theme -> custom theme -> visual-type defaults -> individual visual overrides**. Formatting set in the theme applies to all visuals of that type automatically and is far more maintainable than bespoke per-visual formatting.

**Before any formatting change, always:**

1. Check what the theme already provides
2. If the desired formatting isn't in the theme, set it in the theme (not on the visual)
3. Only apply bespoke visual formatting for genuinely one-off cases

### Step 1: Check Current Theme Formatting

```bash
# See the full theme cascade for a visual (shows source: theme/wildcard/visual/default)
pbir visuals format "Report.Report/Page.Page/Visual.Visual"

# Theme color palette and which visuals use each color
pbir theme colors "Report.Report"

# Text style definitions (title sizes, fonts, etc.)
pbir theme text-classes "Report.Report"

# Font usage
pbir theme fonts "Report.Report"
```

The `visuals format` output labels each value with its source:
- **default** -- Power BI built-in default
- **wildcard** -- Theme applies to all visual types
- **visualType** -- Theme default for this specific visual type
- **visual** -- Bespoke override on this specific visual

### Step 2: Set Formatting in the Theme (Preferred)

If a formatting change should apply broadly (e.g., "all cards should have 14pt titles"), set it in the theme:

```bash
# Set default for all visuals of a type
pbir theme set-formatting "Report.Report" "card.*.title.fontSize" --value 14
pbir theme set-formatting "Report.Report" "card.*.border.radius" --value 8

# Wildcard: set for ALL visual types
pbir theme set-formatting "Report.Report" "*.*.background.color" --value "#F5F5F5"

# Set text classes (affect all text across report)
pbir theme set-text-classes "Report.Report" title --font-size 16

# Set theme colors
pbir theme set-colors "Report.Report" --good "#00B050" --bad "#FF0000" --neutral "#FFC000"

# Push a well-formatted visual's settings to the theme as defaults for its type
pbir theme push-visual "Report.Report/Page.Page/Visual.Visual"
```

### Step 3: Bespoke Visual Formatting (Only When Necessary)

Only apply formatting directly to a visual when it genuinely needs to differ from the theme. **Use `AskUserQuestion`** to discuss the user's formatting intent -- understanding whether a change is one-off or systematic determines the right approach and avoids rework.

## Discovering Properties

Every visual type has dozens of containers with hundreds of properties. Use the discovery workflow to find the right container and property name before setting values.

```bash
# Step 1: Find what containers exist for a visual type
pbir schema containers "lineChart"
# Output: markers (7 props), lineStyles (24 props), forecast (27 props), etc.

# Step 2: Find what properties a container has (with types, ranges, enums)
pbir schema describe "lineChart.lineStyles"
# Output: markerSize (number 1-50), markerShape (circle/square/diamond/...),
#         showMarker (boolean), lineStyle (solid/dashed/dotted), strokeWidth, etc.

# Step 3: See current values with source attribution on a live visual
pbir visuals format "Report.Report/Page.Page/Visual.Visual"
# Shows ALL containers, all set properties, and source (default/wildcard/visualType/visual)

# Include unset (None) properties too (100% coverage)
pbir visuals format "Report.Report/Page.Page/Visual.Visual" -v

# Filter to a single container
pbir visuals format "Report.Report/Page.Page/Visual.Visual" -p lineStyles

# Fuzzy search for a property by name
pbir visuals properties -s "marker"

# Get a specific property value
pbir get "Report.Report/Page.Page/Visual.Visual.lineStyles.markerSize"
```

**Key insight**: `pbir schema containers` + `pbir schema describe` work from the schema (no visual needed). `pbir visuals format` works from a live visual with theme cascade. Use both: schema to discover what's possible, format to see what's currently set and where it comes from.

## Setting Properties

Once the container and property name are known from discovery, use `pbir set`:

```bash
pbir set "Report.Report/Page.Page/Visual.Visual.lineStyles.markerSize" --value 8
pbir set "Report.Report/Page.Page/Visual.Visual.lineStyles.showMarker" --value true
pbir set "Report.Report/Page.Page/Visual.Visual.grid.gridVertical" --value true
```

## Bulk Formatting with Glob Patterns

`pbir set` supports glob patterns to apply the same property change across many visuals at once. This sets bespoke formatting on each matched visual. For broad changes, prefer theme-level formatting instead.

### Scope Patterns

```bash
# ALL visuals in a report (every page, every visual) -- glob requires -f
pbir set "Report.Report/**/*.Visual.border.show" --value true -f

# All visuals on a SPECIFIC PAGE
pbir set "Report.Report/Sales.Page/*.Visual.border.radius" --value 8 -f

# All visuals of a SPECIFIC TYPE (by naming convention)
pbir set "Report.Report/**/card*.Visual.title.fontSize" --value 12 -f
pbir set "Report.Report/**/lineChart*.Visual.lineStyles.showMarker" --value true -f

# MULTIPLE REPORTS (from working directory)
pbir set "**/**.Report/**/*.Visual.title.show" --value true -f

# Combine page and type patterns
pbir set "Report.Report/Overview.Page/kpi*.Visual.labels.fontSize" --value 24 -f
```

### Dedicated Subcommands with Glob Paths

The dedicated formatting subcommands also accept glob paths:

```bash
# Title on all visuals in a report
pbir visuals title "Report.Report/**/*.Visual" --show --fontSize 12

# Border on all visuals on a page
pbir visuals border "Report.Report/Sales.Page/*.Visual" --show --radius 8

# Sort all charts on a page
pbir visuals sort "Report.Report/Page.Page/*.Visual" -f "Date.Month" -d Ascending
```

### Glob Pattern Reference

| Pattern | Matches |
|---------|---------|
| `*.Visual` | All visuals in current page |
| `Page.Page/*.Visual` | All visuals on one page |
| `**/*.Visual` | All visuals across all pages |
| `**/card*.Visual` | All visuals whose name starts with "card" |
| `*.Report/**/*.Visual` | All visuals in one report |
| `**/*.Report/**/*.Visual` | All visuals across all reports |

## Container Formatting Subcommands

These dedicated subcommands provide convenient flags for common containers. For any container not listed here, use `pbir set` with the discovery workflow above.

### Title and Subtitle

```bash
pbir visuals title "Visual.Visual" --text "Revenue" --show --fontSize 14
pbir visuals title "Visual.Visual" --fontColor "#333333" --alignment center --bold
pbir visuals subtitle "Visual.Visual" --text "YTD Performance" --show --fontSize 10
```

### Background, Border, Shadow

```bash
pbir visuals background "Visual.Visual" --color "#F8F9FA" --transparency 0
pbir visuals border "Visual.Visual" --show --color "#E0E0E0" --radius 8 --width 1
pbir visuals shadow "Visual.Visual" --show
# Drop shadows are a bad practice (accessibility issues). Prefer flat layout.
```

### Padding, Spacing, Divider

```bash
pbir visuals padding "Visual.Visual" --top 10 --bottom 10 --left 15 --right 15
pbir visuals spacing "Visual.Visual"
pbir visuals divider "Visual.Visual" --show
```

### Legend, Axes, Labels, Sort (Charts)

```bash
pbir visuals legend "Visual.Visual" --show --position Right
pbir visuals axis "Visual.Visual" --axis category --show --title "Month"
pbir visuals axis "Visual.Visual" --axis value --show --title "Revenue ($)"
pbir visuals labels "Visual.Visual" --show --fontSize 10
pbir visuals sort "Visual.Visual" -f "Sales.Revenue" -d Descending
```

### Visual Header, Tooltip, Hide

```bash
pbir visuals header "Visual.Visual" --show
pbir visuals tooltip "Visual.Visual"
pbir visuals hide "Visual.Visual"                # Hide in view mode
pbir visuals hide "Visual.Visual" --off          # Show again
```

## Conditional Formatting

### Measure-Based (Preferred Pattern)

Create an extension measure returning theme color tokens ("good", "bad", "neutral"), then apply to a visual component. Theme tokens resolve from the theme -- change the theme and all conditional formatting updates.

```bash
# Step 1: Create formatting measure
pbir dax measures add "Report.Report" -t _Fmt -n "RevenueColor" \
  -e 'IF([Revenue] >= [Target], "good", IF([Revenue] >= [Target] * 0.8, "neutral", "bad"))' \
  --data-type Text

# Step 2: Ensure theme has sentiment colors
pbir theme set-colors "Report.Report" --good "#00B050" --bad "#FF0000" --neutral "#FFC000"

# Step 3: Apply to visual component
pbir visuals cf "Report.Report/Page.Page/Visual.Visual" \
  --measure "labels.color _Fmt.RevenueColor"

# Apply to data points (bar/column fill colors)
pbir visuals cf "Visual.Visual" --measure "dataPoint.fill _Fmt.RevenueColor"
```

### Managing Conditional Formatting

Use `pbir get` / `pbir set` with a `.cf` dot-path tail. The old
`pbir visuals cf --info`/`--list`/`--has`/`--set-color`/`--remove`/`--remove-all`
flags are deprecated and redirect to these commands — see
[conditional-formatting.md](conditional-formatting.md) for the full rewrite
table.

```bash
# Read CF (ASCII summary, or scalar leaf, or JSON)
pbir get "Visual.Visual.dataPoint.fill.cf"
pbir get "Visual.Visual.dataPoint.fill.cf.gradient.min.color"
pbir get "Visual.Visual.dataPoint.fill.cf" --json

# Bulk read across a report (replaces `--list`)
pbir get "Report.Report/**/*.Visual.**.cf"

# Remove CF (aliases: --remove / --clear)
pbir set "Visual.Visual.dataPoint.fill.cf" --remove
pbir set "Visual.Visual.dataPoint.fill.cf" --clear

# Bulk wipe every CF on a visual
pbir set "Visual.Visual.**.cf" --remove -f
```

### Updating CF Colors

Scalar leaf edits on existing CF entries go through `pbir set`:

```bash
# Update gradient stop colors
pbir set "Visual.Visual.dataPoint.fill.cf.gradient.min.color" --value "bad"
pbir set "Visual.Visual.dataPoint.fill.cf.gradient.max.color" --value "good"

# Update 3-color gradient mid stop
pbir set "Visual.Visual.dataPoint.fill.cf.gradient.mid.color" --value "neutral"

# Update a specific rules case color (positional index)
pbir set "Visual.Visual.values.backColor.cf.rules.case[0].color" --value "#E66C37"
pbir set "Visual.Visual.values.backColor.cf.rules.case[1].color" --value "#118DFF"

# Rebind the input measure of a gradient or measure-driven CF
pbir set "Visual.Visual.dataPoint.fill.cf.measure" --value "_Fmt.NewColor"
```

Kind mismatch hard-errors with a pointer at `pbir set ...cf --remove` +
`pbir visuals cf --<kind>` — no automatic morphing.

### Converting Hex Colors to Theme Tokens

Replace hardcoded hex colors with theme sentiment tokens. Already-themed colors are skipped.

```bash
# Replace hex with default tokens (minColor, midColor, maxColor)
pbir visuals cf "Visual.Visual" --theme-colors "dataPoint.fill"

# Use custom token names
pbir visuals cf "Visual.Visual" --theme-colors "dataPoint.fill min=bad max=good"
```

### Converting to Measure-Driven CF

Convert built-in gradient/rules CF to an extension measure (preferred for maintainability). Auto-generates DAX SWITCH expression and creates the measure.

```bash
pbir visuals cf "Visual.Visual" --to-measure dataPoint.fill

# Output:
# Measure: _Fmt.CF Datapoint Fill
# DAX:
# SWITCH(
#     TRUE(),
#     [Revenue] < 0.5, "#E66C37",
#     "#118DFF"
# )
```

### CF via Python Object Model (Fluent API)

```python
# Gradient CF
visual.cf.gradient \
    .field("Sales.Revenue") \
    .on("dataPoint", "fill") \
    .min_color("bad").max_color("good") \
    .apply()

# Rules CF
visual.cf.rules \
    .on("values", "backColor") \
    .when("Sales.Margin").less_than(0).then_color("bad") \
    .when("Sales.Margin").greater_or_equal(0).then_color("good") \
    .apply()

# Update colors in existing CF
visual.cf.update_color("dataPoint", "fill", min_color="bad", max_color="good")

# Convert hex to theme tokens
visual.cf.theme_colors("dataPoint", "fill")

# Convert to measure-driven
result = visual.cf.to_measure("dataPoint", "fill", report)
print(result["dax"])  # Generated DAX expression

# Remove CF
visual.cf.remove("dataPoint")
visual.cf.remove_all()
```

### Per-Field / Per-Series / Interaction State -- Selector Mini-Language

`pbir get` and `pbir set` accept selector tokens embedded in the dot path so
you can target a single series, a single category value, a specific reference
line, or an interaction state. Globs, `--where`, `--dry-run`, `--remove`, and
`--no-validate` all work unchanged.

```bash
# Per-field -- writes selector.metadata, scoped to one series/column
pbir set "Visual.Visual.dataPoint.field(Sales.Revenue).fill" --value "#118DFF"

# Per-category-value -- writes selector.scopeId, scoped to one value
pbir set "Visual.Visual.dataPoint.series(Cities.City=Antwerp Relay).fill" --value "#E66C37"

# Reference line by id -- writes selector.id, scoped to one line
pbir set "Visual.Visual.y1AxisReferenceLine.id(2).lineColor" --value "#FF0000"

# Interaction state -- writes selector.id = interaction:hover / press / selected
pbir set "Visual.Visual.background.hover.color"    --value "#F5F5F5"
pbir set "Visual.Visual.background.press.color"    --value "#E0E0E0"
pbir set "Visual.Visual.background.selected.color" --value "#00B294"

# Read the current override back
pbir get "Visual.Visual.dataPoint.field(Sales.Revenue).fill"

# Drop the override (falls back to visual/theme default)
pbir set "Visual.Visual.dataPoint.field(Sales.Revenue).fill" --remove

# Bulk + conditional -- disable labels on the Cost series across every chart
pbir set "Report.Report/**/*.Visual.labels.field(Sales.Cost).show" \
  --value false --where "visual_type__in=lineChart|clusteredBarChart" -f
```

Notes:

- Hex strings (`#RRGGBB`) on color-named properties (`fill`, `color`,
  `fontColor`, `lineColor`, anything ending in `Color`) are wrapped in
  `solid.color` automatically. No `--json` gymnastics needed.
- `field(X)` references are validated against the connected model and
  against the visual's bound fields (same guarantees as `pbir visuals bind`).
  Model-unreachable degrades to a warning; typos hard-fail with suggestions.
  Bypass with `--no-validate`.
- Setting a plain `dataPoint.fill` after a `dataPoint.field(X).fill` does
  not clobber the scoped override -- the wildcard and scoped entries stack.
- Combined selector + interaction state in one path (e.g.
  `field(X).hover.prop`) is not yet supported and raises an explicit error.
  Apply them in two separate calls.
- `pbir visuals format-field` and `pbir visuals format-state` are deprecated
  aliases that print the equivalent `pbir set` command and exit non-zero.
  Both are removed in 1.0.0.

## Clearing Visual-Level Overrides (Reset to Theme)

When switching themes or enforcing theme consistency, visual-level overrides prevent the theme from taking full effect. Use `pbir visuals clear-formatting` with glob patterns to reset visuals to theme defaults:

```bash
# Clear all formatting from all visuals (preview first)
pbir visuals clear-formatting "Report.Report/**/*.Visual" --dry-run
pbir visuals clear-formatting "Report.Report/**/*.Visual" -f

# Preserve conditional formatting (recommended)
pbir visuals clear-formatting "Report.Report/**/*.Visual" --keep-cf -f

# Clear only container formatting (title, border, background, shadow, padding)
pbir visuals clear-formatting "Report.Report/**/*.Visual" --only-containers -f

# Clear only chart objects (legend, axis, labels, dataPoint)
pbir visuals clear-formatting "Report.Report/**/*.Visual" --only-objects -f
```

See **`references/apply-theme.md` > Clearing Visual-Level Formatting** for the full theme enforcement workflow.

## Recommended Workflow

1. **Discover**: `pbir schema containers "type"` + `pbir schema describe "type.container"` to find container and property names
2. **Inspect**: `pbir visuals format "...Visual" -p container` to see current values and sources
3. **Theme first**: `pbir theme set-formatting` or `pbir theme push-visual` for changes that should apply broadly
4. **Clear overrides** (if enforcing theme): Strip visual-level formatting so theme cascade applies cleanly (see above)
5. **Set bespoke** (only if one-off): `pbir set "...Visual.container.property" --value X`
6. **Bulk apply** (if needed): use glob patterns (`**/*.Visual`) for conditional logic
7. **Verify**: `pbir visuals format "...Visual"` to confirm source is theme (not visual override) where intended
8. **Validate**: `pbir validate "Report.Report"`
