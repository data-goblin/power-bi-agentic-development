# Reference Lines Reference

Guide to adding and styling reference lines (constant lines, target lines, axis markers) on chart visuals via the `pbir visuals reference-line` command and `pbir set`.

## What a reference line is

A reference line is a horizontal or vertical line drawn at a constant value across a chart's plot area; for example a target of 100 on a bar chart, or a threshold of zero on a variance chart. Reference lines live in the visual's `y1AxisReferenceLine` (horizontal lines) or `xAxisReferenceLine` (vertical lines) container. Each line is one entry, keyed by a numeric id selector `{"id": "1"}`, `{"id": "2"}`, and so on.

Power BI supports multiple reference lines per visual; you can have a target, a minimum, a maximum, and an average line all on the same chart. Each is a separate entry with a separate id.

## Supported visual types

Reference lines are supported on 15 visual types: `barChart`, `clusteredBarChart`, `hundredPercentStackedBarChart`, `columnChart`, `clusteredColumnChart`, `hundredPercentStackedColumnChart`, `lineChart`, `lineClusteredColumnComboChart`, `lineStackedColumnComboChart`, `ribbonChart`, `areaChart`, `stackedAreaChart`, `hundredPercentStackedAreaChart`, `scatterChart`, `waterfallChart`.

Not supported on: pie, donut, cards, KPIs, slicers, tables, matrices, treemaps, maps, gauges, funnels, and other non-axis visuals. The command rejects unsupported types with a clear error message listing what does work.

## Split responsibilities

The CLI splits the work across two commands with clear boundaries:

- **`pbir visuals reference-line add|list|remove`** creates, enumerates, and deletes the reference-line entries. The only things it controls are value (literal number or bound measure), axis (`y` or `x`), and entry id (auto-assigned).
- **`pbir set "<container>.id(N).<property>" <value>`** sets every styling property on an existing entry: label, color, line style, transparency, data label visibility, data label text, label font, and so on.

This split exists because `pbir set` cannot array-append into a container or invent id selectors; those are the structural operations only `reference-line add` can do. Once the entry exists, the id selector form `id(N)` lets `pbir set` reach it like any other property path.

## Add a reference line

```bash
# Literal target at y=100 on a column chart
pbir visuals reference-line add "Test.Report/P.Page/barChart_Revenue.Visual" --value 100

# Bound measure as target (the measure must be bound to the visual)
pbir visuals reference-line add "Test.Report/P.Page/lineChart_Trend.Visual" --value "Measures.Revenue Target"

# X-axis reference line on a scatter chart at x=50
pbir visuals reference-line add "Test.Report/P.Page/scatterChart_A.Visual" --value 50 --axis x
```

Flags:

- `--value <literal-or-measure>` ... required. A finite number (literal) or a bound `Table.Measure` reference. If the value contains a dot, the command tries to resolve it as a measure first; only if resolution fails does it fall back to literal parsing. This prevents silent misinterpretation of measure names that look like numbers.
- `--axis y|x` ... defaults to `y`. `y` writes to `y1AxisReferenceLine` (horizontal line); `x` writes to `xAxisReferenceLine` (vertical line).

Output:

- stdout ... bare entry id (one integer per visual) for shell chaining.
- stderr ... decorative confirmation with the container and visual path.

Chaining example:

```bash
ID=$(pbir visuals reference-line add "Test.Report/P.Page/V.Visual" --value 100)
pbir set "Test.Report/P.Page/V.Visual.y1AxisReferenceLine.id($ID).displayName" "Target"
```

## Style a reference line with `pbir set`

Every other property is schema-backed and reachable via `pbir set` with the `id(N)` selector form:

```bash
# Label text
pbir set "V.Visual.y1AxisReferenceLine.id(1).displayName" "Target"

# Show the data label
pbir set "V.Visual.y1AxisReferenceLine.id(1).dataLabelShow" true
pbir set "V.Visual.y1AxisReferenceLine.id(1).dataLabelText" "ValueAndName"

# Line styling
pbir set "V.Visual.y1AxisReferenceLine.id(1).style" "dashed"
pbir set "V.Visual.y1AxisReferenceLine.id(1).transparency" 20

# Color -- hex strings on color-named properties are auto-wrapped in solid.color
pbir set "V.Visual.y1AxisReferenceLine.id(1).lineColor" --value "#7EB2BB"
```

Discover available styling properties with:

```bash
pbir schema describe clusteredBarChart.y1AxisReferenceLine
```

Common properties include `displayName`, `value`, `lineColor`, `style` (`solid`/`dashed`/`dotted`), `transparency`, `position` (`front`/`behind`), `dataLabelShow`, `dataLabelText`, `dataLabelColor`, `dataLabelFontFamily`, `dataLabelFontSize`, `dataLabelDisplayUnits`, `dataLabelHorizontalPosition`, `dataLabelVerticalPosition`. Shading between the line and the axis lives under `shadeColor`/`shadeShow`/`shadeTransparency`/`shadeRegion` on the same entry.

## List reference lines

```bash
pbir visuals reference-line list "Test.Report/P.Page/V.Visual"
```

Returns a table with id, axis, and the current value (literal or `Entity.Property` for measure bindings) for every reference line across both axis containers.

## Remove reference lines

```bash
# Remove a single reference line by id
pbir visuals reference-line remove "Test.Report/P.Page/V.Visual" --id 2

# Remove every reference line on this visual (both axes)
pbir visuals reference-line remove "Test.Report/P.Page/V.Visual" --all
```

`--id` and `--all` are mutually exclusive; one must be supplied. Removal is idempotent; if nothing matches, the command prints a warning and exits successfully.

## Batch workflow

Reference lines compose well with `pbir batch` when you want to add and style lines declaratively as part of a repeatable report build. A batch step can call `reference-line add` and follow it with `set` steps targeting the id returned on stdout. For ad-hoc agent loops, the shell-chaining form above is simpler.

## Common patterns

**Target line on a KPI bar chart:**

```bash
ID=$(pbir visuals reference-line add "V.Visual" --value "Measures.Target")
pbir set "V.Visual.y1AxisReferenceLine.id($ID).displayName" "Target"
pbir set "V.Visual.y1AxisReferenceLine.id($ID).style" "dashed"
pbir set "V.Visual.y1AxisReferenceLine.id($ID).dataLabelShow" true
```

**Zero line on a variance column chart:**

```bash
ID=$(pbir visuals reference-line add "V.Visual" --value 0)
pbir set "V.Visual.y1AxisReferenceLine.id($ID).style" "solid"
pbir set "V.Visual.y1AxisReferenceLine.id($ID).transparency" 40
```

**Min and max bracket lines:**

```bash
MIN=$(pbir visuals reference-line add "V.Visual" --value "Measures.Min")
MAX=$(pbir visuals reference-line add "V.Visual" --value "Measures.Max")
pbir set "V.Visual.y1AxisReferenceLine.id($MIN).displayName" "Min"
pbir set "V.Visual.y1AxisReferenceLine.id($MAX).displayName" "Max"
```

## Notes and caveats

- **`reference-line add` is NOT idempotent.** Rerunning the same command appends a new entry with a new id. Agents retrying a failed call risk duplicating reference lines; check `list` before retrying, or call `remove --all` then re-add, or use `pbir batch` for deterministic rebuilds.
- **Glob + shell capture don't mix.** When `visual_path` matches multiple visuals via a glob pattern, `add` prints one id per visual to stdout. `ID=$(pbir visuals reference-line add "**/*.Visual" --value 100)` captures a multi-line string that is not safe to interpolate into a single `pbir set` call. Target one visual at a time when chaining.
- The `--value` measure must already be bound to a role on the visual; otherwise the command falls through to literal parsing and raises a clear error pointing at `pbir visuals bind`. Bind measures with `pbir visuals bind` first.
- Id selectors are assigned by incrementing the highest existing id in the target container. Concurrent `add` calls against the same visual can race; avoid this in parallel agent loops by chaining or by using `pbir batch`.
- `pbir set` reaches range-binding entries via `id(N)`. It will create a new entry if the id does not match anything; use `list` first if you are unsure which ids exist.
- Removing a reference line does not renumber the remaining ids. Later `add` calls still pick up from the old maximum, so ids on a single visual can become sparse over time. This is cosmetic and does not affect rendering.
