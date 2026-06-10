# Performance Audit

Complements `performance.md` (which covers load-time telemetry and DAX query inference). This reference covers the query cost model, the Performance Analyzer export artifact, DirectQuery report-layer tuning, and the interaction/navigation audit.

## Query Cost Model

Visual count is a proxy; query cost per visual is the real driver. Opening a page refreshes every visual. Each emits at least one DAX query; several emit more. Parallelism is capped (DirectQuery `Maximum Connections per Data Source` defaults to 10; service capacity imposes additional limits), so total page-load latency grows non-linearly once the parallel cap is hit.

Practical implication: 12 cheap card visuals can be fine; 8 matrices with totals and measure filters may not be.

Visuals that emit more than one query (multipliers):
- Tables/matrices with totals/subtotals (one query per band; DistinctCount/Median are worst)
- Measure filters (two queries)
- Top N filters (two queries; can blow the 1M-row intermediate limit under DirectQuery)
- Field parameters (an extra evaluated-parameters phase)
- Custom/Deneb/Python/R visuals (display phase dominates)

Review without Desktop:
```bash
pbir visuals query   # read queryState per visual; flag measure-filters, TopN, totals, field params
```

Hidden and off-canvas visuals still query on load; include them in counts. Do not clear a flag based on visual count alone; a low-count page can be slow from one expensive visual.

## Performance Analyzer Export

Performance Analyzer (Desktop-only export) produces a JSON log of every recorded operation. It is the one perf artifact parseable from the terminal without a live model. It breaks each visual's wall time into named phases:

```yaml
DAX query:            model/measure work (or DirectQuery source query); fix belongs with the modeler
Direct query:         only present for DirectQuery tables; confirms live source round-trip
Visual display:       render time; high here + low DAX = report-layer cost (fixable)
Other:                queuing/serialization; large value here is a serialization symptom
Evaluated parameters: field-parameter overhead
```

Workflow: generate timings in Desktop, export the JSON, map each `objectId`/`objectName` to a `visual.json` name, apply fixes in PBIR, re-validate. Use the documented export format from `microsoft/powerbi-desktop-samples` rather than reverse-engineering fields.

When Desktop is unavailable, fall back to WABI `reportloads` telemetry (see `performance.md`) for absolute load times; use the Performance Analyzer export for relative attribution.

Notes:
- Durations are queue-inclusive; a high number does not prove a visual is intrinsically slow. Isolate with single-visual refresh before drawing conclusions
- The capturing machine differs from the service; use the export to find the relatively-worst visual, not to promise a specific millisecond figure

## DirectQuery Report-Layer Tuning

Report-layer-only levers, all fixable inside `.Report` with `pbir-cli`. Separates "report agent can fix" from "kick to the modeler". Matters more under DirectQuery because every interaction is a live source round-trip (4-minute service timeout; 5s/30s usable/unusable guideline in practice).

Detect DirectQuery from the report side via the Performance Analyzer "Direct query" phase, or confirm storage mode via model skills before applying.

**Apply before binding fields:** write the `filterConfig` block before field bindings, or order `pbir filters` calls before `pbir visuals bind`. An unfiltered intermediate can hit the 1M-row limit.

**Turn off unused totals/subtotals:**
```bash
pbir visuals format <path> --property totals.show false
```
These generate extra source queries; always extra cost for DistinctCount/Median.

**Avoid measure filters and Top N on high-cardinality columns:** they generate two source queries and can exceed the 1M-row limit. If Top N is required, scope it tight and prefer a model-side aggregation.

**Prefer single-select slicers, or gate multi-select behind an Apply button:** the highest-leverage fix; multi-select fires a query per item added.

**Disable cross-highlight from slicers to expensive visuals:**
```bash
# set a NoFilter pair from slicer to matrix visual
```
Use `visualInteractions[]` with type `NoFilter` for slicer-to-expensive-visual pairs.

**Keep visuals-per-page low:** past the parallel-connection cap, visuals serialize and can show time-inconsistent results; this is a correctness argument, not just a speed one.

**What not to change from `.Report`:** `Maximum Connections per Data Source` is a model setting; recommend raising it but do not attempt to set it from `.Report`. Auto page refresh multiplies everything by frequency and concurrent users; flag it if present.

Do not blanket-apply DirectQuery tuning to Import reports; disabling cross-highlight removes interactivity for no gain.

## Interaction and Navigation Audit

Defects that are invisible in a screenshot and do not fail `pbir validate`.

### Cross-filter graph

Read each page's `visualInteractions`:
- Flag zero overrides on a page with both slicers and KPI cards; the cards likely jump on chart clicks (usually unintended)
- Flag a wall of `NoFilter` everywhere; interactivity may have been disabled rather than configured
- Flag overrides referencing visual `name`s that no longer exist (stale, no-op; find by resolving names against actual visuals on the page)

Note: a `NoFilter` pair is sometimes correct (intentional KPI stability). Flag patterns and stale references, then ask the author about intent.

### Drill propagation

Grep `drillFilterOtherVisuals`:
- Flag drillable visuals where page-wide drill response was clearly intended but left `false`
- Flag the inverse (drill response active on a page where it would confuse users)

Note: `drillFilterOtherVisuals` (hierarchy drill on same page) is distinct from drillthrough (page navigation).

### Navigation integrity

Collect every `visualLink` with `navigationSection`/`drillthroughSection`/`bookmark`, resolve each target against actual page/bookmark `name`s (not `displayName`):
- Flag dangling references
- Flag `WebUrl` pointing at non-HTTPS or empty URLs
- Flag navigator vs button sprawl: a row of near-identical `PageNavigation` buttons that a single `pageNavigator` would replace

### Drillthrough hygiene

- Confirm drillthrough pages are hidden in the view mode or carry a clear-filters reset
- Confirm a `Back` button exists on drillthrough pages
- A missing local target page is expected for cross-report drillthrough; do not flag it

Resolve all targets against `name`, not `displayName`. Stale references resolve empty at runtime without a validation error.
