# Interactivity: Slicers, Interactions, Field Parameters, and Filter Persistence

## Query Reduction at Creation

The "Query reduction" preset bundles three settings that collapse unnecessary visual queries. Apply at report creation; retrofitting leaves stale interaction pairs.

The three components set directly in PBIR:

- **Cross-interaction default**: add `NoFilter` pairs in `page.json` `visualInteractions[]` from each slicer to heavy visuals (matrices, maps, high-cardinality tables). There is no single report-wide off key; write per-pair overrides.
- **Filter-pane Apply button**: set via `pbir filters pane-set`; validate with `--qa` after.
- **Slicer Apply button**: set per-slicer via `pbir visuals format`. The `slicer` and `advancedSlicerVisual` object models differ; confirm the container key with `pbir schema describe` first.

Microsoft's optimization guidance shows these three changes cutting a page's visual queries by a large factor, which is why the "fewer visuals / apply buttons" audit rules exist.

Pitfalls:
- A hard-coded `Highlight` pair in `visualInteractions[]` survives the preset; audit per page after applying
- Apply buttons are per-slicer/per-pane; five slicers need five configurations unless you also add page-level Apply-all/Clear-all button visuals
- Disabling cross-highlight is a visible design tradeoff (selecting a bar no longer dims others); flag this on Import-mode reports where query cost is already cheap


## Wiring Interactions and Navigation

After placing and formatting visuals, set interaction overrides and build navigation before final validation. A page of correctly bound visuals still ships poorly if every selection cross-filters everything or if a multi-page report has no way to move between pages.

1. Decide the cross-filter graph per page before touching JSON. Default is everything cross-filters everything, so author only the exceptions: KPI cards that should stay stable when a detail chart is clicked; charts that should not filter a slicer back.
2. Write overrides as page-level `visualInteractions` entries (`{source, target, type}`) using the visual `name`, not the title. Use `Highlight`/`Filter` only when overriding a default (charts default to Highlight, line/scatter/map to Filter).
3. For multi-page reports, prefer a native `pageNavigator` visual over hand-built buttons. One navigator auto-syncs to the page list; N buttons are N blobs to re-point on every page add or rename.
4. Validate, then reload+screenshot to confirm a slicer click filters the intended visuals and leaves the cards alone.

```bash
# Example: set KPI card to NoFilter from bar chart clicks
pbir visuals interactions "Sales.Report/Overview.Page" \
  --source "Bar Chart.Visual" --target "Revenue KPI.Visual" --type NoFilter

# Add a page navigator
pbir add visual pageNavigator "Sales.Report/Overview.Page" \
  --x 24 --y 680 --width 400 --height 32
```

Pitfalls:
- `visualInteractions` pairs are directional (`source` filters `target`, not the reverse)
- Stale pairs referencing a renamed or regenerated visual `name` silently no-op; they do not error during validate
- Override exceptions, keep the default elsewhere; do not over-suppress interactivity


## Slicer Type, Sync, and Reset

### Type and single-select

Map slicer intent to type and mode:

```
low cardinality, single pick   -> slicer (data.mode=Dropdown) or advancedSlicerVisual with singleSelect
measure beside each option     -> listSlicer (Values: Column/Hierarchy; Tooltips: Measure)
date window                    -> slicer (data.mode=Between) or relative-date mode
```

Force single-select where the analysis assumes one value:

```bash
pbir set <page>/<slicer> 'visual.objects.selection[0].properties.singleSelect' true
pbir set <page>/<slicer> 'visual.objects.selection[0].properties.strictSingleSelect' true   # removes clear-to-all
```

Default to `strictSingleSelect` for metric-swap slicers (field parameter pickers) and single-entity slicers. Multi-select on those is the most common silent break.

### Sync groups

Sync is not a slicer property; it lives in `report.json` as a sync group keyed by name. A slicer joins a group by sharing the name. Two independent toggles:
- sync filter state: selection follows the reader page to page
- sync visibility: whether the slicer is drawn on each page

The common pattern is sync-state everywhere, show-on-one-page. After hand-editing sync groups, validate and reload (a silent group-name typo de-syncs with no error). Sync supports one field per slicer only; a two-field slicer opts out.

### Reset and persist filters

Power BI has no native reset button; build it from a bookmark:

1. Set every slicer/filter to its intended default state
2. Capture a **Data-scoped** (not Display) bookmark: `pbir bookmark add "Default View"`
3. Bind a button to it via `pbir visuals action`

Use the same bookmark as the page launch bookmark so the report opens at the baseline regardless of persisted state.

The "Don't allow end users to save filters" report setting turns off per-reader persistence. Select it for shared/kiosk reports that must open clean; leave persistence on for personal analytical reports. Persistence-on plus a launch bookmark conflict; decide one model per report.

Pitfalls:
- A Display-scoped reset bookmark moves/shows/hides visuals unexpectedly; always use Data scope for filter resets
- The reset button only restores what the bookmark captured; re-capture when slicers change
- Sync group names must match exactly; a trailing space de-syncs silently


## Field Parameters

A field parameter is a calculated table in the model whose rows each name a column or measure (`NAMEOF`) plus a sort order. Bind the table's value column to a visual drop zone and to a single-select slicer; readers pick which measure or dimension renders without bookmarks or visual stacking. It collapses N near-duplicate visuals into one.

The table is model work (define exactly three columns per row, all values unique, or the parameter produces unexpected results). In PBIR the parameter participates like any column:

```bash
# Add the chart bound to the parameter
pbir add visual barChart "Sales.Report/Overview.Page" \
  --title "by Metric" \
  -d "Category:Product.Category" \
  -d "Y:Metric.Metric Fields" \
  --x 24 --y 120 --width 600 --height 360

# Add the slicer to pick the metric
pbir add visual slicer "Sales.Report/Overview.Page" \
  -d "Values:Metric.Metric" \
  --x 24 --y 72 --width 200 --height 40

# Force single-select so the report never opens showing every measure at once
pbir set "Sales.Report/Overview.Page/<slicer-name>.Visual" \
  'visual.objects.selection[0].properties.singleSelect' true

# Validate that the parameter field binding resolves
pbir validate "Sales.Report" --fields
```

### PBIR-side pitfalls

These are the parts that break after the model is correct:

- **Blank/"none" selection means ALL, not nothing**: there is no empty state; use strict single-select plus a default selection so the report never opens showing every measure collapsed together
- **Top N filters break on the parameter**: they rank alphabetically by display name, not by the measure value. Fix: author a helper measure reading the active row via `SELECTEDVALUE` over the parameter's hidden column + `SWITCH`, then apply Top N on that helper
- **CF does not follow the swap**: conditional formatting binds to a concrete field. Drive CF from the same `SELECTEDVALUE` + `SWITCH` helper measure
- **Implicit measures**: an explicit measure must exist first; no implicit aggregation is created for the parameter column
- **Drillthrough/tooltip link fields**: not usable as drillthrough or tooltip link fields; link the underlying dimensions instead
- **Live connection models**: field parameters require a local model; a pure live connection cannot host one
- **Matrix "Persist hierarchy level"**: turn this report setting off; otherwise the hierarchy level collapses on every parameter switch

### Validate and render

Always validate with `--fields` after binding a field parameter; mismatched Column vs Measure types pass JSON validation but fail at query time.
