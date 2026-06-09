# Chart Selection, Data Labels, and Small Multiples

## Encoding Hierarchy: Match the Task to the Channel

Encode the value the reader needs to compare most precisely on the highest perceptual channel available. The Cleveland-McGill accuracy ranking: position on a common scale > length > angle/slope > area > color hue/saturation.

Useful inverse for an agent: given a `visual.json` on disk, decide whether `visualType` matches the analytical task and what the minimal repair is.

```
ranking / magnitude compare -> length on common axis  -> barChart / columnChart
trend over time             -> position + slope        -> lineChart / areaChart
two measures correlated     -> 2D position             -> scatterChart
part-to-whole, <=3-4 parts  -> angle/area (accept)     -> pie/donut OR stacked bar
part-to-whole, >4 parts     -> length (prefer)         -> stackedBarChart, not pie
single value vs target      -> position vs marker      -> kpi / card + reference line
```

Read the actual type and roles before judging:
```bash
pbir get "Page/MyVisual.Visual" .visual.visualType
pbir visuals bind "Page/MyVisual.Visual" --list-roles
```

Repair is usually a type swap preserving bindings (pie, donut, and stackedBarChart share Category/Y roles):
```bash
pbir set "Page/MyVisual.Visual" .visual.visualType '"clusteredBarChart"'
```
Then sort and validate.

### The sampling gate

A type can be schema-valid and role-correct yet wrong because the data shape defeats the encoding. Sample with `pbir model -q` before trusting a line chart (are there enough distinct x-points to form a trend?) or a bar chart (are there more than two bars?). Two rows back means a line chart is wasted; one dominant slice plus a long tail means the pie should be a sorted bar with the tail grouped into "Other".

### Pitfalls

- Pie/donut beyond ~4 slices forces the weakest channels; apply Top N + "Other" rather than adding colors
- A combo chart second axis is justified only when two genuinely different units share a category axis
- Hue is last; do not solve a comparison problem by adding more colors

---

## Data-Label Discipline

Labels earn their place only when the exact value matters and cannot be read off the axis: line endpoints, a single highlighted bar, KPI deltas. Per-segment labels and stacked totals are two different objects:

```bash
pbir visuals format "Page.Page/Visual.Visual" labels --on       # per-data-point labels
pbir set "Page.Page/Visual.Visual" \
  '.visual.objects.totals[0].properties.show.expr.Literal.Value' "true"  # stacked totals
```

### The stacked-total "incorrect number" trap

The recurring symptom where a stacked total does not match a hand-summed expectation is almost always a measure problem, not a label problem. The engine's stacked-group sum diverges from the expected total when the underlying measure is non-additive: a ratio, distinct count, or time-intelligence expression. Verify with `pbir model -q "EVALUATE SUMMARIZECOLUMNS(...)"` before touching the label. If the total is the "wrong" number, the label is honest and the measure needs an explicit aggregation strategy.

### Preferred pattern: endpoint-only labels

Prefer binding a measure that returns the value at the last/relevant point and BLANK elsewhere, rather than global labels plus conditional-formatting-based hiding. The chart stays clean and only the number that matters is annotated. This is the extension-measure label pattern described in `thin-report-measures` references.

### Pitfalls

- Small multiples disable stacked total labels entirely (see below)
- Label display units must match the axis units
- A measure returning BLANK beats global-labels-plus-CF: less JSON, less fragile

---

## Small Multiples

Choose small multiples over a legend when the question is "does this pattern hold across a dimension" and there are more series than a legend reads cleanly (roughly more than 3-4). A legend overlays series in one frame for value comparison; small multiples separate them into a synchronized grid so you compare shapes across many categories.

Supported only on bar, column, line, and area charts. The grid synchronizes axes and fills left-to-right then top-to-bottom in sort order, with overflow scrolling beyond the visible grid.

### The Series vs SmallMultiples role distinction

`Series`/`Legend` overlays series in a single frame; true small multiples use the dedicated `SmallMultiples` role that partitions into the grid. The `smallMultiplesLayout` object only takes effect when the `SmallMultiples` role is populated. Confirm before editing:

```bash
pbir visuals bind "Page/MyVisual.Visual" --list-roles
```

### Features that are inert once a visual is trellised

Do not waste edits on these; they silently have no effect in a small-multiples context:

- Total labels for stacked charts
- Trend lines and forecasting
- Zoom sliders
- Line high-density sampling
- Concatenated axis labels and hierarchical axis (falls back to concatenated)
- Scroll-to-load-more
- Small-multiple cell title display units/decimals/format (control via the model's format string instead)

Check for the `SmallMultiples` role before adding any analytics overlays.

### Pitfalls

- A 6x6 grid of dense charts defeats the purpose; apply Top N on the partition field and group the remainder into "Other"
- Synchronized axes are a feature, not a bug; do not give each cell its own scale unless the analytical intent is explicitly within-series comparison
