---
title: "Report performance audit: query cost, Performance Analyzer, DirectQuery levers"
summary: Why visual count is a weak proxy, reading a Performance Analyzer export, report-layer DirectQuery fixes, defects validation misses.
kind: gotcha
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-performance-analyzer
  - url: https://learn.microsoft.com/en-us/power-bi/guidance/power-bi-optimization
tools:
  pbir: 0.9.33
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - pbir visuals test --help
  - pbir visuals query --help
  - pbir pages interactions --help
skills: [reports/review-report]
---

# Report performance audit

[Learn: optimization guide](https://learn.microsoft.com/en-us/power-bi/guidance/power-bi-optimization) and [Performance Analyzer](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-performance-analyzer) are the base. Learn gives no visual-count threshold, so do not apply one.

## Query cost, not visual count

Opening a page refreshes every visual, hidden and off-canvas ones included, and each emits at least one DAX query. Textboxes, images, shapes and buttons emit none. Parallelism is capped (DirectQuery "Maximum connections per data source" defaults to 10), so total latency is driven by the expensive visuals: twelve cheap cards can be fine while eight matrices with totals are not. Queries multiply for:

- tables and matrices with totals or subtotals (one query per band; DistinctCount and Median are worst)
- measure filters and Top N filters (two queries each; Top N under DirectQuery can exceed the 1M-row intermediate limit)
- field parameters (an extra phase) and custom visuals (display phase dominates)

```bash
pbir visuals query "R.Report/P.Page/V.Visual"
pbir visuals test "R.Report/P.Page"
```

`visuals query` prints the DAX a visual generates; `visuals test` times each visual's query, slowest first.

## Performance Analyzer export

The Desktop-only JSON export splits each visual into: DAX query (model work, the modeler's problem), Direct query (source round trip), Visual display (render; high display with low DAX is report-layer cost you can fix), Other (queuing, serialisation) and Evaluated parameters (field parameters). Map each `objectId` to a visual name, fix in PBIR, re-validate. Durations include queueing, so isolate one visual before calling it slow, and use the export for relative attribution, not millisecond promises.

## Report-layer levers for DirectQuery

- Write filters before binding fields so an unfiltered intermediate never runs
- Turn off unused totals: `pbir set "<visual>.totals.show" --value false`
- Avoid measure filters and Top N on high-cardinality columns
- Prefer single-select slicers or an Apply button; multi-select fires a query per added item
- `NoFilter` interactions from slicers to heavy visuals ([interactivity](report-interactivity.md))
- Raising "maximum connections" is a model setting, not a `.Report` change; flag it. Auto page refresh multiplies load by frequency and users

Do not apply these to cheap Import reports: disabling cross-highlight there removes interactivity for no gain.

## Defects invisible in a screenshot

- **Cross-filter pairs**: zero overrides on a page with slicers and KPI cards means the cards probably jump on chart clicks; a wall of `NoFilter` may mean interactivity was disabled rather than designed; overrides naming visuals that no longer exist are silent no-ops
- **`drillFilterOtherVisuals`** (same-page hierarchy drill) is not drillthrough (page navigation); flag a mismatch with the intent
- **Navigation**: resolve every `visualLink` target against page and bookmark `name`, not `displayName`; flag dangling targets, empty or non-HTTPS `WebUrl`, and rows of identical page buttons a `pageNavigator` would replace
- **Drillthrough pages**: hidden or with a clear-filters reset, and a `Back` button; a missing local target is expected for cross-report drillthrough
