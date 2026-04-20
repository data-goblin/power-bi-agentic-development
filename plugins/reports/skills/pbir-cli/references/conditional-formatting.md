# Conditional Formatting Reference

Complete guide to managing conditional formatting (CF) in PBIR reports.

Two surfaces share one model:

- **`pbir set` / `pbir get`** — dot-path reads and scalar edits on existing CF entries. Primary surface for daily work.
- **`pbir visuals cf`** — structural authoring: create CF from scratch, copy CF between visuals, convert to theme tokens, convert to measure-driven.

The old `pbir visuals cf --info`/`--list`/`--has`/`--set-color`/`--remove`/`--remove-all` flags are **deprecated** and redirect to `pbir set`/`pbir get`. See the [Deprecated Flags](#deprecated-flags) section.

## CF Types

| Type | Description | Expression |
|------|-------------|------------|
| **Gradient** | 2- or 3-color scale on a numeric field | `FillRule` with `linearGradient2/3` |
| **Rules** | Conditional cases (if/else logic) | `Conditional` with `Cases` |
| **Measure-driven** | Extension measure returns theme token | `Measure` with `dataViewWildcard` |
| **Data bars** | Inline bars showing magnitude | `dataBars` property |
| **Icons** | Icon sets based on thresholds | Icon-specific CF structure |

CF entries live in `visual.objects` (not `visualContainerObjects`). Each container (e.g., `dataPoint`, `labels`) can hold both regular entries and CF entries. CF entries are identified by `dataViewWildcard` selectors, `FillRule`/`Conditional` expressions, or `dataBars` properties.

## Reading CF with `pbir get`

The `.cf` tail on any color-bearing property path surfaces the CF state.

### Summary read

```bash
# ASCII summary (kind, input measure, stops/cases/else, source)
pbir get "Report.Report/Page.Page/Visual.Visual.dataPoint.fill.cf"

# Kind-specific filter
pbir get "Visual.Visual.dataPoint.fill.cf.gradient"
pbir get "Visual.Visual.labels.color.cf.rules"
```

### Scalar leaf read

```bash
# Single leaf value (e.g., min stop color, case threshold, measure ref)
pbir get "Visual.Visual.dataPoint.fill.cf.gradient.min.color"
pbir get "Visual.Visual.dataPoint.fill.cf.gradient.max.value"
pbir get "Visual.Visual.labels.color.cf.rules.case[0].color"
pbir get "Visual.Visual.dataPoint.fill.cf.measure"
```

### Bulk read (glob)

```bash
# All CF across a report (replaces the deprecated `visuals cf --list`)
pbir get "Report.Report/**/*.Visual.**.cf"

# JSON mode
pbir get "Visual.Visual.dataPoint.fill.cf" --json
```

## Editing CF with `pbir set`

Scalar leaf edits on **existing** CF entries. Creating CF from scratch stays in `pbir visuals cf` (see below).

### Gradient leaves

```bash
# Change a gradient stop color
pbir set "Visual.Visual.dataPoint.fill.cf.gradient.min.color" --value "bad"
pbir set "Visual.Visual.dataPoint.fill.cf.gradient.max.color" --value "#00FF00"

# Change a threshold value
pbir set "Visual.Visual.dataPoint.fill.cf.gradient.max.value" --value 250

# Set the null coloring strategy (e.g. for blank values)
pbir set "Visual.Visual.dataPoint.fill.cf.gradient.null.color" --value "#888888"

# Rebind the input measure of a gradient
pbir set "Visual.Visual.dataPoint.fill.cf.gradient.measure" --value "Sales.Margin"
```

### Rules leaves

```bash
# Update a specific case color
pbir set "Visual.Visual.labels.color.cf.rules.case[0].color" --value "alertRed"

# Update a case threshold (op + value)
pbir set "Visual.Visual.labels.color.cf.rules.case[1].value" --value 500
pbir set "Visual.Visual.labels.color.cf.rules.case[1].op" --value "gte"

# Set the else color (default when no case matches)
pbir set "Visual.Visual.labels.color.cf.rules.else.color" --value "foreground"
```

### Measure-driven leaves

```bash
# Rebind the measure driving a measure-based CF
pbir set "Visual.Visual.dataPoint.fill.cf.measure" --value "_Fmt.NewStatusColor"
```

### Bulk edits with glob + `--where`

```bash
# Update the min color of every gradient CF on column charts
pbir set "Report.Report/**/*.Visual.dataPoint.fill.cf.gradient.min.color" \
  --value "bad" --where "visual_type=clusteredBarChart" -f

# Preview before applying
pbir set "Report.Report/**/*.Visual.dataPoint.fill.cf.gradient.min.color" \
  --value "bad" --dry-run
```

### Kind mismatch is a hard error

If a visual has a **gradient** CF on `dataPoint.fill` and you try to write a **rules** leaf there, `pbir set` hard-errors with a pointer at the fix:

```
dataPoint.fill has CF kind 'gradient-2', not 'rules'.
Use `pbir set "...dataPoint.fill.cf" --remove` and then
`pbir visuals cf --rules ...` to change kinds.
```

No automatic morphing. To change CF kind, remove + recreate explicitly.

## Removing CF

Both `--remove` and `--clear` are aliases — use either. For `.cf` paths, the remove verb wipes the CF entry at the addressed depth and preserves sibling state overrides.

```bash
# Wipe CF on one container.prop
pbir set "Visual.Visual.dataPoint.fill.cf" --remove
pbir set "Visual.Visual.dataPoint.fill.cf" --clear     # identical

# Wipe a specific kind (same effect — one CF per container.prop)
pbir set "Visual.Visual.dataPoint.fill.cf.gradient" --remove

# Bulk wipe every CF on a visual
pbir set "Visual.Visual.**.cf" --remove -f

# Bulk wipe across a report
pbir set "Report.Report/**/*.Visual.**.cf" --remove -f --dry-run  # preview first
```

Removal preserves non-CF entries (state overrides like `id: "default"` or `id: "selection:selected"`).

## Creating CF with `pbir visuals cf`

Structural authoring stays in the builder command. Reads and edits live on `pbir set`/`pbir get`.

### Measure-Based CF (Preferred)

Measure-driven CF is the preferred pattern. Create a DAX measure returning theme sentiment tokens (`"good"`, `"bad"`, `"neutral"`), then bind it to a visual property.

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

# Common targets
pbir visuals cf "Visual.Visual" --measure "dataPoint.fill _Fmt.RevenueColor"
pbir visuals cf "Visual.Visual" --measure "values.fontColor _Fmt.OTDColor"
```

The `--measure` format is `"container.prop MeasureRef"` where:
- `container.prop` targets a visual object container and property.
- `MeasureRef` is the measure reference in `Table.Measure` format.

Color properties (fill, color, fontColor, strokeColor, etc.) are automatically wrapped in `{"solid": {"color": ...}}`.

### Measure-bound axis properties

`--measure` also works for non-color properties like axis bounds:

```bash
pbir visuals cf "Visual.Visual" --measure "valueAxis.start _Fmt.Zero"
pbir visuals cf "Visual.Visual" --measure "valueAxis.end _Fmt.AxisCeiling"
```

### Gradient and Data Bars

```bash
# 2-color gradient
pbir visuals cf "Report.Report/Page.Page/Visual.Visual" \
  --gradient --field "Invoices.Net Invoice Value" --min-color bad --max-color good

# 3-color gradient
pbir visuals cf "Visual.Visual" \
  --gradient --field "Table.Field" --min-color "#FF0000" --max-color "#00FF00" --mid-color "#FFFF00"

# Gradient on a specific container.prop
pbir visuals cf "Visual.Visual" \
  --gradient --field "Table.Field" --min-color bad --max-color good --on labels.fontColor

# Data bars
pbir visuals cf "Visual.Visual" \
  --data-bars --field "Invoices.Net Invoice Value"

# Data bars with custom colors
pbir visuals cf "Visual.Visual" \
  --data-bars --field "Table.Field" --positive-color good --negative-color bad
```

### Rules and Icons

```bash
# Rules CF
pbir visuals cf "Visual.Visual" --rules --field "Invoices.Net Invoice Value" \
  --rule "gt 1000 good" --rule "lt 0 bad"

# Rules CF on a specific container
pbir visuals cf "Visual.Visual" --rules --field "Table.Field" \
  --rule "gt 100 good" --rule "lte 100 neutral" --on labels.fontColor

# Icons CF
pbir visuals cf "Visual.Visual" --icons --field "Invoices.Net Invoice Value" \
  --rule "gt 0 circle_green" --rule "lte 0 circle_red"
```

Rule format: `"operator value color_or_icon"`. Operators: `gt`, `lt`, `gte`, `lte`, `eq`, `neq`.

Icon names: `circle_red`, `circle_yellow`, `circle_green`, `arrow_up`, `arrow_right`, `arrow_down`, `flag_red`, `flag_yellow`, `flag_green`, `check`, `x`, `exclamation`.

Shared flags: `--field` (required), `--min-color`, `--max-color`, `--mid-color`, `--positive-color`, `--negative-color`, `--on container.prop`.

## Copying CF Between Visuals

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

target.cf.copy_from(source)                                   # all containers
target.cf.copy_from(source, containers=["dataPoint", "labels"])  # specific
target.save()
```

### Copy Behavior

- Deep copies CF entries from source `visual.objects` to target.
- Removes existing CF on target containers first (overwrite).
- Non-CF entries in target containers are preserved.
- Returns list of container names where CF was copied.
- Source visual is not modified.

### When to use CF copy

- Standardizing CF across multiple visuals of the same type.
- Applying a "CF template" from a reference visual to new visuals.
- Migrating CF after duplicating a page (visuals lose CF on copy in some workflows).
- Batch-applying consistent bar chart data point coloring across a report.

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

## Changing CF Type

No automatic morphing — remove and recreate explicitly:

```bash
pbir set "Visual.Visual.dataPoint.fill.cf" --remove
pbir visuals cf "Visual.Visual" --rules --field "Table.Field" \
  --rule "gt 100 good" --rule "lt 0 bad"
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

## Deprecated Flags

The following `pbir visuals cf` flags are **deprecated** and will be removed in 1.0.0. They emit a red error, print the equivalent `pbir set` / `pbir get` command, and exit with status 1. Update your scripts using the rewrite table below.

| Deprecated flag | Replacement |
|---|---|
| `--info dataPoint.fill` | `pbir get "<path>.dataPoint.fill.cf"` |
| `--list` | `pbir get "<path>.**.cf"` |
| `--has dataPoint` | `pbir get "<path>.dataPoint.**.cf"` (non-empty summary proves CF exists) |
| `--set-color "dataPoint.fill min=bad max=good"` | Two commands: `pbir set "<path>.dataPoint.fill.cf.gradient.min.color" --value bad` and `pbir set "<path>.dataPoint.fill.cf.gradient.max.color" --value good` |
| `--remove dataPoint.fill` | `pbir set "<path>.dataPoint.fill.cf" --remove` |
| `--remove-all` | `pbir set "<path>.**.cf" --remove -f` |

Retained flags (create, copy, convert): `--gradient`, `--rules`, `--icons`, `--data-bars`, `--measure`, `--to-measure`, `--theme-colors`, `--copy-from`.

## Best Practices

1. **Theme colors over hex** — Use sentiment tokens (`good`, `bad`, `neutral`) so theme changes cascade to all CF.
2. **Measure-driven preferred** — Extension measures returning tokens are easier to maintain than built-in gradient/rules.
3. **Apply sparingly** — CF should highlight exceptions, not decorate everything. Format variance columns, not raw values.
4. **Accessible palettes** — Blue/orange instead of red/green. Always pair color with a secondary cue (icon, text).
5. **Theme-first** — Check `pbir theme set-colors` for sentiment colors before applying CF. Create them if missing.

## Copy Formatting Between Visuals

Copy all formatting overrides from one visual to another without affecting field bindings:

```bash
pbir cp "Report/Page.Page/Source.Visual" "Report/Page.Page/Target.Visual" --format-only
```
