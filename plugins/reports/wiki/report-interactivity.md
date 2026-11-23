---
title: "Report interactivity: query reduction, interactions, slicers, field parameters"
summary: pbir wiring for query reduction, cross-filter overrides, slicer sync and reset, and the PBIR-side traps of field parameters.
kind: gotcha
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-optimize-ribbon
  - url: https://learn.microsoft.com/en-us/power-bi/create-reports/service-reports-visual-interactions
  - url: https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-slicers
  - url: https://learn.microsoft.com/en-us/power-bi/create-reports/power-bi-field-parameters
tools:
  pbir: 0.9.33
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - pbir pages interactions --help
  - pbir filters pane-set --help
skills: [reports/create-pbi-report]
---

# Report interactivity with pbir

## Query reduction at creation

[Learn: query reduction options](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-optimize-ribbon) bundles three settings. In PBIR there is no single switch, so set each part:

- Cross-filter pairs: `pbir pages interactions "R.Report/P.Page" --source Slicer --target Matrix --type NoFilter` from each slicer to heavy visuals (matrices, maps, high-cardinality tables). Use the visual `name`, not the title
- Filter pane Apply button: the pane-level setting, then `pbir validate --qa`
- Slicer Apply button: per slicer with `pbir set`; the `slicer` and `advancedSlicerVisual` objects differ, so run `pbir schema describe` first

Do it when creating the page: retrofitting leaves stale pairs. A hard-coded `Highlight` pair survives the preset, so audit each page after. Five slicers need five Apply configurations unless a page-level Apply all or Clear all button exists (`pbir visuals action --type ApplyAllSlicers|ClearAllSlicers`). Disabling cross-highlight is a visible design cost; on cheap Import models it may not be worth it.

## Interactions and navigation

- Default is everything cross-filters everything; author only the exceptions. Pairs are directional (`source` filters `target`)
- Types: `Default`, `DataFilter` (alias `Filter`), `HighlightFilter` (alias `Highlight`), `NoFilter`; `--disable-from` and `--disable-to` cover a whole visual; `--clear` resets
- A pair that names a renamed or regenerated visual silently no-ops; validation does not flag it
- Prefer one `pageNavigator` visual to N hand-built buttons: it follows page adds and renames

## Slicers

- Force single select where the analysis assumes one value: `pbir set "<slicer>.Visual.selection.singleSelect" --value true`, and `strictSingleSelect` for metric-swap and single-entity slicers (multi-select there is the common silent break)
- Sync is not a slicer property. It lives in `report.json` as a named sync group; a trailing space in the name de-syncs silently; one field per slicer only. pbir exposes no sync command in 0.9.33, so report the gap instead of editing `report.json`
- A reset button is a Data-scoped bookmark plus a button action ([bookmarks](pbir-structural-gotchas.md)). The report setting "Don't allow end users to save filters" fits kiosk reports; persistence plus a launch bookmark conflict, so choose one model per report

## Field parameters

[Learn: field parameters](https://learn.microsoft.com/en-us/power-bi/create-reports/power-bi-field-parameters). The table is model work; in PBIR it behaves like a column:

```bash
pbir add visual barChart "R.Report/P.Page" -d "Category:Product.Category" -d "Y:Metric.Metric Fields"
pbir add visual slicer "R.Report/P.Page" -d "Values:Metric.Metric"
pbir validate "R.Report" --fields
```

- An empty selection means all, not none: use strict single select with a default
- Top N on the parameter ranks alphabetically by display name, not value: apply it to a helper measure that reads the active row with `SELECTEDVALUE` and `SWITCH`
- Conditional formatting binds to a concrete field and does not follow the swap: drive it from the same helper
- Parameter fields cannot be drillthrough or tooltip link fields
- Turn off the matrix report setting "Persist hierarchy level", or the hierarchy collapses on every switch
- Mismatched Column versus Measure types pass JSON validation and fail at query time: always `--fields`
