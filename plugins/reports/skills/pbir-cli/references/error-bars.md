# Error Bars Reference

Guide to adding and styling error bars, confidence bands, and bullet-chart range markers on chart visuals via the `pbir visuals error-bars` command and `pbir set`.

## What error bars are

Error bars are per-series range markers on a chart, rendered as whiskers, caps, or a shaded band between an upper and lower bound. The range is typically expressed as two measures (upper and lower) that may or may not be the same series. The classic bullet-chart pattern uses a target measure for both bounds, which renders as a small marker on top of each bar showing "this bar should have reached here".

Power BI stores error bars as a two-entry pattern in the `visual.objects.error` container:

1. A **range-binding entry** that defines the upper and lower bound expressions and binds them to a specific series via a compound selector `{data: [{dataViewWildcard: {matchingOption: 0}}], metadata: "<queryRef>", highlightMatching: 1}`. The `errorRange` struct holds `kind: "ErrorRange"`, `explicit.isRelative`, `explicit.upperBound`, and `explicit.lowerBound`.
2. A **styling entry** keyed by a simple metadata selector `{metadata: "<queryRef>"}`. This holds every other error-bar property: `enabled`, `barWidth`, `barColor`, `barShow`, `barBorderSize`, `barBorderColor`, `barMatchSeriesColor`, `markerShow`, `markerShape`, `markerSize`, `labelShow`, `labelFormat`, `labelColor`, `labelFontSize`, `tooltipShow`, `tooltipFormat`.

Every series gets its own pair of entries. Adding error bars to "Revenue" does not affect error bars on "Cost".

## Supported visual types

Error bars are supported on 10 visual types: `barChart`, `clusteredBarChart`, `hundredPercentStackedBarChart`, `columnChart`, `clusteredColumnChart`, `hundredPercentStackedColumnChart`, `lineChart`, `lineClusteredColumnComboChart`, `lineStackedColumnComboChart`, `ribbonChart`.

Not supported on: `areaChart` and its stacked variants, `scatterChart`, `waterfallChart`, pie/donut, cards, KPIs, slicers, tables, matrices. Power BI's area charts do not support error bars; use reference lines or `shadedRegion` instead for confidence bands on area charts. The command rejects unsupported types with a clear error listing what does work.

## Split responsibilities

The CLI splits the work across two commands with clear boundaries:

- **`pbir visuals error-bars add|list|remove`** creates, enumerates, and deletes the two-entry pair per series. It owns queryRef resolution (looking up the projection that binds the series on the visual), the `errorRange` struct, and the upsert-by-series semantics.
- **`pbir set "error.field(<queryRef>).<property>" <value>`** sets every styling property on the styling entry after it exists. The `field(<queryRef>)` selector form maps to `{metadata: "<queryRef>"}` and merges into the styling entry, leaving the range-binding entry untouched.

This split exists because `pbir set` cannot array-append into a container, cannot build the `errorRange` struct from CLI args, and cannot emit the compound selector used on the range-binding entry. Once both entries exist, all styling is just `pbir set`.

## Add error bars for a series

```bash
# Bullet marker: upper and lower both point at a target measure
pbir visuals error-bars add "Test.Report/P.Page/barChart_Revenue.Visual" \
  --series "Sales.Revenue" \
  --upper "Sales.Target" \
  --lower "Sales.Target"

# Confidence band: different upper and lower
pbir visuals error-bars add "Test.Report/P.Page/columnChart_Forecast.Visual" \
  --series "Sales.Forecast" \
  --upper "Sales.Forecast Upper" \
  --lower "Sales.Forecast Lower"

# Relative bounds (percentage offsets from the series value)
pbir visuals error-bars add "Test.Report/P.Page/lineChart_KPI.Visual" \
  --series "Sales.Revenue" \
  --upper "Sales.Revenue Upper Pct" \
  --lower "Sales.Revenue Lower Pct" \
  --relative
```

Flags:

- `--series <Table.Measure>` ... required. The series to attach error bars to. Must be bound to a role on the visual; otherwise the command errors with "Field '...' is not bound to this visual".
- `--upper <Table.Measure>` ... required. Upper-bound measure reference.
- `--lower <Table.Measure>` ... optional; defaults to the upper bound. Useful for bullet markers where a single target becomes both bounds.
- `--relative` ... treats bounds as percentage offsets from the series value instead of absolute values.

**Upsert semantics.** Calling `add` for the same `--series` twice replaces both entries rather than appending. This is deliberate: error-bars-per-series is a logical singleton in Power BI. Rerunning the command with different bounds updates the binding without duplicating entries.

Output:

- stdout ... the resolved queryRef (one line per visual). Use this for shell chaining into `pbir set "error.field($QR).<property>" <value>`.
- stderr ... decorative confirmation with the visual path.

Chaining example:

```bash
QR=$(pbir visuals error-bars add "V.Visual" \
  --series "Sales.Revenue" --upper "Sales.Target" --lower "Sales.Target")
pbir set "V.Visual.error.field($QR).markerShape" "diamond"
pbir set "V.Visual.error.field($QR).markerSize" 10
pbir set "V.Visual.error.field($QR).barShow" false
```

## Style error bars with `pbir set`

All styling lives on the second (styling) entry and is reachable via the `field(<queryRef>)` selector form:

```bash
# Whisker width and color
pbir set "V.Visual.error.field(Sales.Revenue).barWidth" 1
pbir set "V.Visual.error.field(Sales.Revenue).barShow" true

# Marker shape and size at the endpoints
pbir set "V.Visual.error.field(Sales.Revenue).markerShape" "diamond"
pbir set "V.Visual.error.field(Sales.Revenue).markerSize" 10
pbir set "V.Visual.error.field(Sales.Revenue).markerShow" true

# Data labels on the error bar itself
pbir set "V.Visual.error.field(Sales.Revenue).labelShow" true
pbir set "V.Visual.error.field(Sales.Revenue).labelFormat" "range"
pbir set "V.Visual.error.field(Sales.Revenue).labelFontSize" 10

# Tooltip integration
pbir set "V.Visual.error.field(Sales.Revenue).tooltipShow" true
pbir set "V.Visual.error.field(Sales.Revenue).tooltipFormat" "range"
```

Discover all available properties with:

```bash
pbir schema describe clusteredBarChart.error
```

Available `markerShape` values: `circle`, `square`, `diamond`, `triangle`, `x`, `shortDash`, `longDash`, `plus`, `none`. Available `labelFormat` values: `absolute`, `relativeNumeric`, `relativePercentage`, `range`.

## List error bars

```bash
pbir visuals error-bars list "Test.Report/P.Page/V.Visual"
```

Shows a table grouped by queryRef (series) with entry type (`range` or `styling`), upper and lower bound measures, and `isRelative`. Every series with error bars produces two rows in the listing.

## Remove error bars

```bash
# Remove error bars for a specific series
pbir visuals error-bars remove "V.Visual" --series "Sales.Revenue"

# Remove all error bars on the visual (every series)
pbir visuals error-bars remove "V.Visual" --all
```

`--series` and `--all` are mutually exclusive; one must be supplied. Removal is idempotent; if nothing matches, the command prints a warning and exits successfully.

## Why there are no styling flags on `add`

Earlier iterations of this command accepted `--bar-width`, `--bar-color`, `--marker-size`, `--shade`, `--shade-color`, `--shade-transparency`, and similar flags on `add`. These have been removed for two reasons:

1. Most of them duplicated what `pbir set` already does through the schema-backed selector DSL. Maintaining them meant serializing every PBIR expression type twice and rotting the flags whenever the `error` schema changed.
2. The `--shade*` flags in particular wrote `shadeShow`, `shadeColor`, and `shadeTransparency` properties into the `error` container, but those properties are **not in the error schema**. They belong to `y1AxisReferenceLine` (reference-line shading between the line and the axis) and to `shadedRegion` (confidence bands on line/area charts). Writing them to the error container produced silently ignored or invalid JSON.

`add` now owns only the structural work (append + compound selector + `errorRange` struct + queryRef resolution + upsert). Everything else routes through `pbir set`, which stays aligned with the schema automatically.

## Common patterns

**Bullet chart markers** (target on top of each bar):

```bash
QR=$(pbir visuals error-bars add "V.Visual" \
  --series "Sales.Revenue" \
  --upper "Sales.Target" \
  --lower "Sales.Target")
pbir set "V.Visual.error.field($QR).markerShape" "longDash"
pbir set "V.Visual.error.field($QR).markerSize" 12
pbir set "V.Visual.error.field($QR).barShow" false
```

**Forecast confidence band** with colored whiskers:

```bash
QR=$(pbir visuals error-bars add "V.Visual" \
  --series "Sales.Forecast" \
  --upper "Sales.Forecast High" \
  --lower "Sales.Forecast Low")
pbir set "V.Visual.error.field($QR).barWidth" 2
pbir set "V.Visual.error.field($QR).markerSize" 0
```

**Range labels on every bar:**

```bash
QR=$(pbir visuals error-bars add "V.Visual" \
  --series "Sales.Revenue" \
  --upper "Sales.Max" \
  --lower "Sales.Min")
pbir set "V.Visual.error.field($QR).labelShow" true
pbir set "V.Visual.error.field($QR).labelFormat" "range"
```

## Notes and caveats

- **`error-bars add` is idempotent per series** via the upsert in point 1 above. Retrying a failed add with the same `--series` replaces the existing pair cleanly; no duplication. Retries against different series accumulate as separate pairs, which is the intended behavior.
- **Glob + shell capture don't mix.** When `visual_path` matches multiple visuals, `add` prints one queryRef per visual to stdout; `QR=$(pbir visuals error-bars add "**/*.Visual" ...)` captures multiple lines. Target one visual at a time when chaining to `pbir set`.
- **`--series` must be bound first.** `pbir visuals bind --add "Role:Table.Measure" --type Measure` before calling `error-bars add`. The command looks the queryRef up from the visual's `queryState.projections`; if the series is not bound, it raises a clear error pointing at `pbir visuals bind` instead of silently writing invalid JSON. Implicit measures (a column dropped on Y without an explicit Sum/Avg wrapper) are supported through queryRef equality matching.
- **Range bounds are not reachable via `pbir set`.** The range-binding entry uses a compound selector that `pbir set`'s `field()` form does not match. To change the upper or lower bound measures after creation, rerun `error-bars add` with the new values; the upsert will replace the range entry.
- **Confidence bands on line charts.** The `error` container does not render a filled band between bounds. For true shaded confidence bands use `shadedRegion` (line and area charts) or reference-line `shadeColor`/`shadeShow`. Error bars render whiskers, caps, markers, and labels; they do not fill.
- **Bullet charts** are just a specific combination of flags: whisker hidden (`barShow=false`), a dash marker (`markerShape=longDash`), and upper equal to lower (a single target measure used for both bounds). See the plugin's bullet-chart example JSON `examples/visuals/formatted/barChart-bullet.json` for the full structure.
