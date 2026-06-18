# Renderers, Execution Environments, and Pagination

Two distinct things get called "the renderer." Keep them separate:

1. **Rendering extensions** are the output formats (HTML, PDF, Excel, etc.). They decide how a report paginates and what it preserves. The same `.rdl` looks different through each.
2. **Execution environments** (standard vs optimized) are the Power BI service's two data-processing paths. They decide how fast and how much data a report can handle. This is "the two renderers" people mean when they talk about the service being slow.

## Rendering extensions

Three categories, differing in how they paginate:

```
Renderer       Category   Pagination     Margins   Interactivity   Notes
─────────────────────────────────────────────────────────────────────────────
PDF            Hard       vertical+horiz Yes       No              fixed page size; clips overflow
Image/TIFF     Hard       vertical+horiz Yes       No              one image per page
PowerPoint     Hard       vertical+horiz Yes       No              one slide per page
HTML           Soft       vertical only  No        Full            preview always uses this
MHTML          Soft       vertical only  No        No              web archive
Excel          Soft       vertical only  No        Partial         ignores InteractiveHeight; PageName -> tab
Word           Soft       vertical only  No        Partial         logical breaks only
CSV / XML      Data       none           No        No              values only, layout stripped
```

- **Hard page-break renderers** (PDF, Image, PowerPoint) paginate at the exact physical `PageHeight` and `PageWidth`, apply margins, and are static. Content taller/wider than a page is clipped and continued. Headers/footers are fixed height and clip overflow.
- **Soft page-break renderers** (HTML, MHTML, Excel, Word) paginate vertically only and do not apply page margins. HTML/MHTML use `InteractiveHeight` as the soft page height; Excel and Word ignore the interactive size and paginate by logical breaks (`PageName` becomes the Excel worksheet tab). `InteractiveWidth` is not used by any renderer (Microsoft's docs state this for both soft and hard renderers). Horizontal overflow becomes a scrollbar, not a new page. Headers/footers grow to fit in HTML/MHTML.
- **Data renderers** (CSV, XML) drop all layout; page breaks have no effect.

Two consequences for an authoring agent:

- **Preview never equals PDF.** Report Builder and the service browser always preview through HTML. Page counts, header height, and margins differ from a PDF export. Verify the actual delivery format by exporting to it (`ExportTo` via `fab`, see the `fabric-cli` paginated-reports reference), not by trusting the preview.
- **The PDF width trap.** Body `<Width>` + `LeftMargin` + `RightMargin` must be `<= PageWidth`. Exceed it and hard renderers emit blank pages to the right of every page. This is the most common PDF layout bug. For landscape Letter, that means body width `<= 11 - 0.5 - 0.5 = 10in`.

## Standard vs optimized execution environments (the Power BI service)

When a paginated report runs in the service it is assigned, automatically and invisibly, to one of two environments. The user cannot choose; the assignment depends entirely on which RDL expressions the report uses.

```
Environment   Recommended volume ceiling             Hard abort
──────────────────────────────────────────────────────────────
Standard      1M rows x 15-20 mixed-type cols         2 GB per query
Optimized     2M rows x 15-20 mixed-type cols         2 GB per query
```

The **2 GB-per-query limit is the unambiguous hard abort**: a single dataset query that fetches more than ~2,000,000,000 bytes is aborted and the render fails. The row/column figures are Microsoft's documented recommended ceiling before processing slows significantly; the same docs note this behavior was "changed to failure by design," so treat the ceiling as the point beyond which to expect failure, not merely slowness. The optimized path's ceiling is double the standard one. There is no partial optimization: if any single expression in the report falls outside the supported subset, the whole report falls back to standard. Image (`byte[]`) columns inflate volume sharply, so a data dump with images hits the limit far sooner.

### What the limitation actually costs

The unsupported expressions block an efficient initialization/container-reuse path, so the cost lands at **report open and parameter processing (startup)**, not in the per-row rendering loop. This is why "fixing" expressions to regain the optimized path sometimes does not speed up, or even worsens, wall-clock render time for a given report: rendering time is dominated by data volume and layout, not by the optimized-vs-standard distinction. Chase the optimized path for startup latency and headroom, not as a general performance fix. Profile before and after.

### Which expressions break optimization

Microsoft does not publish a complete static list. The documented pattern: **VB.NET runtime functions that compute or transform data inline in the RDL** push the report to standard. The one explicit example in the docs:

```vb
=If(Weekday(Fields!SalesDate.Value) > 5, "Relax", "Work")   ' Weekday() is not optimized
```

The fix is always the same: move the computation upstream out of the RDL, into the dataset query (T-SQL `DATEPART`/`CASE`, or DAX), a Power Query step, or a model calculated column/measure. A report whose RDL expressions are limited to field references, simple aggregates (`Sum`, `Count`), and formatting tends to stay optimized.

### Reading the diagnostics

In the service, open the report and go to **View > Diagnostics** (needs at least Contributor on the workspace; unavailable inside apps or the paginated visual). Key fields:

- **Execution environment** / **Non-optimized expressions** the second is populated only when running standard, and names the exact expressions that forced the fallback. This is the authoritative way to find what to fix.
- Data Retrieval time, Row Count, Processing Time, Rendering Time, Render Format, Content Size, Capacity Throttled. Use these to locate the actual bottleneck (data retrieval vs processing vs rendering) before optimizing.

### Service performance rules (do not apply to PBIRS/SSRS)

- No dataset caches in the service. Every parameter query and every cascading-parameter change re-queries the source.
- Cascading parameters run sequentially, one query per change; keep cascades shallow, especially over a gateway.
- Filters declared in the RDL (dataset/tablix/group filters) are applied **after** the full fetch, in memory. They do not reduce data pulled. Filter in the query.
- Prefer semantic models or Azure SQL (built for aggregation) over gateway-backed on-prem sources. Avoid multi-geo (report and source in different regions).

## Pagination control

### Physical vs interactive size

```
PageHeight / PageWidth   used by hard renderers; where physical breaks occur; fixed (does not grow)
InteractiveHeight        HTML/MHTML soft page height (approximate); Excel/Word ignore it
InteractiveWidth         not used by any renderer
```

Set `InteractiveHeight` to `0` to suppress automatic soft breaks in HTML and leave only explicit logical breaks. Default page size is 8.5in x 11in.

### Logical (explicit) page breaks

Page breaks attach to rectangles, tablix data regions, and groups, never to a textbox or image directly. `PageBreak` properties:

- `BreakLocation`: `Start` | `End` | `StartAndEnd` | `Between` (groups only). **Constant only, never an expression.**
- `Disabled`: bool or expression to suppress a break dynamically.
- `ResetPageNumber`: resets `Globals!PageNumber` to 1 at this break (`OverallPageNumber` never resets).
- `PageName`: names the page; surfaces as `Globals!PageName` in header/footer and becomes the Excel worksheet tab name. `InitialPageName` names the first page / default tab.

Breaks on always-hidden items are ignored; breaks on conditionally hidden items apply when visible. Breaks defined inside a tablix cell are not honored (the tablix controls the break).

### Keeping content together

- `KeepTogether` (bool, on members and report items): keep the item plus nested members on one page if it fits. Ignored if the item is larger than the page (then it clips).
- `KeepWithGroup` (`Before`/`After`, on static members): keep a static row (group header/footer) with the adjacent dynamic group.
- `RepeatOnNewPage` (on static members, needs `KeepWithGroup`): repeat the header on every page the group spans.

Conflict priority, highest to lowest: lines/charts/images, widow/orphan control, repeated headers, small `KeepTogether` items, large `KeepTogether` items, tablix `KeepTogether`.

## Expression scope quirks

RDL expressions are VB.NET, prefixed `=`. Common scope traps:

- `=Globals!PageNumber` and `=Globals!TotalPages` work **only in page headers/footers**; in the body they evaluate to nothing.
- `=ReportItems!Box.Value` in a header/footer references one textbox per expression, and shows `#Error` on pages where that box did not render (e.g. a box that only appears on page 1).
- Aggregates take an optional scope: `=Sum(Fields!Sales.Value, "DataSet1")` or `=Max(Fields!X.Value, "GroupName")`. With no scope they use the innermost scope; pass the name explicitly when in doubt.
- `=Parameters!Multi.Value(0)`, `.Count`, `.IsMultiValue` for multi-value parameters.
- `=Fields(Parameters!FieldName.Value).Value` for dynamic field selection.
- Cast `Globals` values: `=CDate(Globals!ExecutionTime)`.
- Remember the optimization cost of VB date/string transforms in the body (above); prefer doing them in the query.
