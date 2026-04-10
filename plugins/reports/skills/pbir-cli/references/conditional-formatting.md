# Conditional Formatting Reference

Complete guide to managing conditional formatting (CF) in PBIR reports via the `pbir visuals cf` command.

## CF Types

| Type | Description | Expression |
|------|-------------|------------|
| **Measure-driven** | Extension measure returns theme token | `Measure` with `dataViewWildcard` |
| **Gradient** | 2- or 3-color scale on a numeric field | `FillRule` with `linearGradient2/3` |
| **Rules** | Conditional cases (if/else logic) | `Conditional` with `Cases` |
| **Data bars** | Inline bars showing magnitude | `dataBars` property |
| **Icons** | Icon sets based on thresholds | Icon-specific CF structure |

CF entries live in `visual.objects` (not `visualContainerObjects`). Each container (e.g., `dataPoint`, `labels`) can hold both regular entries and CF entries. CF entries are identified by `dataViewWildcard` selectors, `FillRule`/`Conditional` expressions, or `dataBars` properties.

## Listing and Inspecting

```bash
# List all CF containers on a visual (discovers dynamically)
pbir visuals cf "Report.Report/Page.Page/Visual.Visual"

# List CF across all visuals in report
pbir visuals cf "Report.Report/**/*.Visual"

# Check if a container has CF
pbir visuals cf "Visual.Visual" --has dataPoint

# Inspect CF type and details for container.prop
pbir visuals cf "Visual.Visual" --info dataPoint.fill
pbir visuals cf "Visual.Visual" --info labels.fontColor
```

## Applying Measure-Based CF (Preferred)

Measure-driven CF is the preferred pattern. Create a DAX measure returning theme sentiment tokens (`"good"`, `"bad"`, `"neutral"`), then bind it to a visual property. When the theme changes, all CF updates automatically.

```bash
# Step 1: Create formatting measure
pbir dax measures add "Report.Report" -t _Fmt -n "RevenueColor" \
  -e 'IF([Revenue] >= [Target], "good", IF([Revenue] >= [Target] * 0.8, "neutral", "bad"))' \
  --data-type Text

# Step 2: Ensure theme sentiment colors exist
pbir theme set-colors "Report.Report" --good "#00B050" --bad "#FF0000" --neutral "#FFC000"

# Step 3: Apply to visual
pbir visuals cf "Report.Report/Page.Page/Visual.Visual" \
  --measure "labels.color _Fmt.RevenueColor"

# Apply to data point fills (bar/column)
pbir visuals cf "Visual.Visual" --measure "dataPoint.fill _Fmt.RevenueColor"

# Apply to font color
pbir visuals cf "Visual.Visual" --measure "values.fontColor _Fmt.OTDColor"
```

The `--measure` format is `"container.prop MeasureRef"` where:
- `container.prop` targets a visual object container and property (e.g., `labels.color`, `dataPoint.fill`)
- `MeasureRef` is the measure reference in `Table.Measure` format (e.g., `_Fmt.StatusColor`)

Color properties (fill, color, fontColor, strokeColor, etc.) are automatically wrapped in `{"solid": {"color": ...}}` structure.

### Measure-bound axis properties

`--measure` also works for non-color properties like axis bounds. This binds the property to a measure expression rather than a literal:

```bash
# Dynamic Y-axis floor and ceiling
pbir visuals cf "Visual.Visual" --measure "valueAxis.start _Fmt.Zero"
pbir visuals cf "Visual.Visual" --measure "valueAxis.end _Fmt.AxisCeiling"
```

## Removing CF

```bash
# Remove CF from specific container.prop
pbir visuals cf "Visual.Visual" --remove dataPoint.fill

# Remove CF from entire container (all props)
pbir visuals cf "Visual.Visual" --remove dataPoint

# Remove all CF from visual
pbir visuals cf "Visual.Visual" --remove-all

# Bulk remove via glob
pbir visuals cf "Report.Report/**/*.Visual" --remove-all
```

Removal preserves non-CF entries (state overrides like `id: "default"` or `id: "selection:selected"`).

## Updating Colors

Change colors in existing CF without rebuilding:

```bash
# Update gradient colors (theme tokens or hex)
pbir visuals cf "Visual.Visual" --set-color "dataPoint.fill min=bad max=good"

# Update 3-color gradient
pbir visuals cf "Visual.Visual" --set-color "dataPoint.fill min=bad mid=neutral max=good"

# Update rules CF by case index
pbir visuals cf "Visual.Visual" --set-color "values.backColor case0=#E66C37 case1=#118DFF"

# Positional shorthand (min = first case, max = last case)
pbir visuals cf "Visual.Visual" --set-color "values.backColor min=#E66C37 max=#118DFF"
```

## Copying CF Between Visuals

Copy all CF entries from one visual to another. Existing CF on the target is overwritten; non-CF entries are preserved.

```bash
# Copy all CF from source to target
pbir visuals cf "Report.Report/Page.Page/Target.Visual" \
  --copy-from "Report.Report/Page.Page/Source.Visual"

# Works with glob targets (copy same CF to multiple visuals)
pbir visuals cf "Report.Report/Page.Page/*.Visual" \
  --copy-from "Report.Report/Page.Page/Styled.Visual"
```

### Python Object Model

```python
source = Visual.load("Report.Report/Page.Page/Source.Visual")
target = Visual.load("Report.Report/Page.Page/Target.Visual")

# Copy all CF
target.cf.copy_from(source)

# Copy specific containers only
target.cf.copy_from(source, containers=["dataPoint", "labels"])

target.save()
```

### Copy Behavior

- Deep copies CF entries from source `visual.objects` to target
- Removes existing CF on target containers first (overwrite)
- Non-CF entries in target containers are preserved
- Returns list of container names where CF was copied
- Source visual is not modified

### When to Use CF Copy

- Standardizing CF across multiple visuals of the same type
- Applying a "CF template" from a reference visual to new visuals
- Migrating CF after duplicating a page (visuals lose CF on copy in some workflows)
- Batch-applying consistent bar chart data point coloring across a report

## Converting to Theme Tokens

Replace hardcoded hex colors with theme sentiment tokens. Already-themed colors are skipped.

```bash
# Default tokens (minColor, midColor, maxColor)
pbir visuals cf "Visual.Visual" --theme-colors dataPoint.fill

# Custom token names
pbir visuals cf "Visual.Visual" --theme-colors "dataPoint.fill min=bad max=good"
```

## Converting to Measure-Driven

Convert built-in gradient/rules CF to an auto-generated extension measure. The generated DAX approximates the original CF logic using `SWITCH(TRUE(), ...)`.

```bash
pbir visuals cf "Visual.Visual" --to-measure dataPoint.fill
# Creates measure _Fmt.CF Datapoint Fill with equivalent DAX
```

## Common Containers and Properties

| Container | Property | Typical Use |
|-----------|----------|-------------|
| `dataPoint` | `fill` | Bar/column/area fill color |
| `dataPoint` | `strokeColor` | Data point border |
| `labels` | `color` | Data label font color |
| `labels` | `fontColor` | Data label font color (alias) |
| `values` | `fontColor` | Table/matrix value font color |
| `values` | `backColor` | Table/matrix value background |
| `columnFormatting` | `fontColor` | Matrix column header color |
| `columnFormatting` | `backColor` | Matrix column header background |
| `accentBar` | `color` | KPI accent bar color |
| `fillCustom` | `color` | Card fill color |
| `value` | `color` | Card value font color |
| `referenceLabel` | `color` | KPI reference label color |
| `referenceLabelDetail` | `color` | KPI reference label detail |

## Best Practices

1. **Theme colors over hex** -- Use sentiment tokens ("good", "bad", "neutral") so theme changes cascade to all CF
2. **Measure-driven preferred** -- Extension measures returning tokens are easier to maintain than built-in gradient/rules
3. **Apply sparingly** -- CF should highlight exceptions, not decorate everything. Format variance columns, not raw values
4. **Accessible palettes** -- Blue/orange instead of red/green. Always pair color with a secondary cue (icon, text)
5. **Theme-first** -- Check `pbir theme set-colors` for sentiment colors before applying CF. Create them if missing.

## Gradient and Data Bars via CLI

Apply gradient CF and data bars directly from the CLI using the fluent builder flags:

```bash
# 2-color gradient (min/max)
pbir visuals cf "Report.Report/Page.Page/Visual.Visual" \
  --gradient --field "Invoices.Net Invoice Value" --min-color bad --max-color good

# 3-color gradient (min/mid/max)
pbir visuals cf "Visual.Visual" \
  --gradient --field "Table.Field" --min-color "#FF0000" --max-color "#00FF00" --mid-color "#FFFF00"

# Gradient on specific container.prop
pbir visuals cf "Visual.Visual" \
  --gradient --field "Table.Field" --min-color bad --max-color good --on labels.fontColor

# Data bars
pbir visuals cf "Visual.Visual" \
  --data-bars --field "Invoices.Net Invoice Value"

# Data bars with custom colors
pbir visuals cf "Visual.Visual" \
  --data-bars --field "Table.Field" --positive-color good --negative-color bad
```

Shared flags: `--field` (required), `--min-color`, `--max-color`, `--mid-color`, `--positive-color`, `--negative-color`, `--on container.prop`.

## Changing CF Type

To change a filter's CF type (e.g. gradient to rules), remove and reapply:

```bash
pbir visuals cf "Visual.Visual" --remove dataPoint.fill
pbir visuals cf "Visual.Visual" --gradient --field "Table.Field" --min-color bad --max-color good
```

Built-in CF can also be converted to measure-driven:

```bash
pbir visuals cf "Visual.Visual" --to-measure dataPoint.fill
```

## Rules and Icons CF via CLI

Apply rules-based and icon-based CF using repeatable `--rule` flags:

```bash
# Rules CF: color by value thresholds
pbir visuals cf "Visual" --rules --field "Invoices.Net Invoice Value" \
  --rule "gt 1000 good" --rule "lt 0 bad"

# Rules CF on specific container
pbir visuals cf "Visual" --rules --field "Table.Field" \
  --rule "gt 100 good" --rule "lte 100 neutral" --on labels.fontColor

# Icons CF: icon by value thresholds
pbir visuals cf "Visual" --icons --field "Invoices.Net Invoice Value" \
  --rule "gt 0 circle_green" --rule "lte 0 circle_red"
```

Rule format: `"operator value color_or_icon"`. Operators: `gt`, `lt`, `gte`, `lte`, `eq`, `neq`.

Icon names: `circle_red`, `circle_yellow`, `circle_green`, `arrow_up`, `arrow_right`, `arrow_down`, `flag_red`, `flag_yellow`, `flag_green`, `check`, `x`, `exclamation`.

## Copy Formatting Between Visuals

Copy all formatting overrides from one visual to another without affecting field bindings:

```bash
pbir cp "Report/Page.Page/Source.Visual" "Report/Page.Page/Target.Visual" --format-only
```
