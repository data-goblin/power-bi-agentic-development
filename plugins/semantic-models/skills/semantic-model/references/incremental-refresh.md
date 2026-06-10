# Incremental refresh and refresh strategy

Companion to the `semantic-model` skill (SKILL.md). Original guidance; each section cites its sources.

**Working with `te`:** read the (preview, unstable) flags with `te incremental-refresh set --help`, then `te incremental-refresh set ...`, `te incremental-refresh apply`, and `te incremental-refresh show`. Targeted refresh: `te refresh --table <t> --partition "<t>.<p>" --type full`. Properties not exposed drop to TOM / TMSL or the `refreshPolicy` TMDL block.

## Configure an incremental refresh policy from a terminal

A `refreshPolicy` on one table tells the service how to auto-partition by date and which partitions to re-process. Two windows: archive (rolling) = history kept; incremental = recent slice re-queried per refresh. The service rolls both forward, merges aged partitions, drops out-of-archive ones. None are visible in Desktop or the service UI until the first service refresh applies the policy. It is the biggest lever on large-fact refresh cost (a 10k-rows/day fact with a 3-day window re-queries ~30k rows, not all history) and a one-way door: once published you cannot re-publish from Desktop (it wipes partitions) or download the `.pbix`, so the policy must be right before first service refresh, and edits after that go only through XMLA/te-cli.

Prerequisites in order: (1) two `Date/Time` model parameters named exactly `RangeStart`/`RangeEnd` (reserved, case-sensitive); (2) the partition M filters its date column half-open `>= RangeStart and < RangeEnd` (upper-exclusive so boundary rows aren't double-counted); (3) the filter and column are `Date/Time` and **query-fold** (if the source keys on an integer like `OrderDateKey`, convert the params inside the filter via `Int32.From(DateTime.ToText(RangeStart,[Format="yyyyMMdd"]))` rather than abandoning folding ; a non-folding filter is the dominant cause of initial-refresh timeouts).

`te incremental-refresh` is the operable entry point, but exact flag names are not stable across preview builds, so read them from the binary first (`te incremental-refresh set --help`). `set` writes the policy (rolling-window granularity/periods, incremental granularity/periods, `incrementalPeriodsOffset` for complete-periods-only, `policyType=basic`, `mode=import|hybrid`); `apply` materializes/expands the partition set (equivalent to TOM `ApplyRefreshPolicies` = RequestRefresh + SaveChanges). If a flag is missing (e.g. `pollingExpression`), fall to TOM/TMSL or hand-edit the `refreshPolicy` block. Compat level must be >= 1550 (>= 1565 hybrid). Pitfalls: every table reuses the same `RangeStart`/`RangeEnd` (no per-table pairs); size the incremental window to the late-arrival margin, not wider; enable Large model storage before the first refresh if over ~1 GB; a backdated update to the partition date column itself breaks IR (engine reads delete+insert, the delete is never picked up) ; treat transaction dates as immutable and selectively refresh from the change point; the first service refresh loads the whole store window (bootstrap on Premium to dodge the 5h/2h ceilings).

Sources: learn.microsoft.com incremental-refresh-overview / -configure / -xmla / -troubleshoot; repo te-cli command-reference, workflows; repo tmdl object-properties; repo c-sharp-scripting partitions

## Detect data changes and custom polling queries

An optional refinement: instead of unconditionally re-querying every period in the incremental window, the service tracks the max of a dedicated audit date/time column (e.g. `ModifiedDate`) per period and skips periods whose max hasn't moved. This can collapse a 3-day refresh to 1 day or fewer when most days are quiet, cutting work without shrinking the window (so you keep a late-arrival safety margin). Hard constraints: the audit column must differ from the `RangeStart`/`RangeEnd` partition column (same column = no signal); default behavior caches that column into memory for comparison, costing RAM proportional to cardinality (reduce it first, or use a polling query to avoid materializing it); it detects soft deletes only ; a hard delete (row physically gone) is invisible.

A custom polling query (Premium, TOM/TMSL only) sets `pollingExpression` to a lightweight M scalar run once per partition; a changed scalar flags that partition for full processing. This avoids caching the audit column and lets an ETL process drive refresh by writing a control table the polling expression reads, so a backdated change to one month reprocesses one month cheaply. No Desktop UI ; set via te-cli (if exposed), TOM, or TMSL. Microsoft's `120 months` granularity example is deliberate: a month-grain rolling window over 10 years lets a backdated change reprocess a single month but sacrifices some compression vs coarser yearly partitions ; surface that RAM-vs-refresh tradeoff, don't silently pick.

Sources: learn.microsoft.com incremental-refresh-overview (real-time data); learn.microsoft.com incremental-refresh-xmla (custom queries for detect data changes); repo tmdl object-properties

## Hybrid (real-time) tables: the DirectQuery partition and its blast radius

Setting the policy `mode` to `hybrid` (Premium) appends one DirectQuery partition covering the slice newer than the incremental window; the table then serves imported history and live source rows in one query. Compat >= 1565, AS client libs >= 19.27.1.8. "Add one DQ partition" is misleadingly small: it converts the table to hybrid storage and propagates to related tables and report caching. Two consequences an agent must address:
1. **Related dimensions must move to Dual.** A hybrid table is queried in both Import and DQ contexts; any related table must be Dual or the relationship degrades to limited (over-fetch, slow). Desktop reminds on toggle but does not auto-fix import dims (a DQ dim flips to Dual trivially; an import dim must be recreated in DQ then switched by hand). Through TOM/te-cli there is no reminder, so check every related table's mode after enabling hybrid
2. **Report visuals cache and won't show the live partition by default.** Power BI caches visual results, defeating the DQ partition unless reports use Automatic Page Refresh (fixed-interval, or change-detection ; the latter Premium-only). This is a report-side setting; the model change alone doesn't deliver real-time

"Only refresh complete days" is mandatory under hybrid (auto-enabled) ; with partial periods allowed, the boundary between the live DQ partition and the newest import partition can double-count or drop rows mid-day. It is also useful standalone when partial-day metrics are meaningless or upstream data finalizes late (set incremental period = 1 month, schedule for the close date). Service refreshes run in UTC unless you set a refresh time zone, which shifts what counts as a complete day.

Sources: learn.microsoft.com incremental-refresh-xmla (partitions); learn.microsoft.com incremental-refresh-troubleshoot (hybrid in the service); learn.microsoft.com incremental-refresh-overview

## Refresh-strategy decision guide for large fact tables

A decision path before reaching for configuration, since agents tend to jump to "enable incremental refresh" when the real constraint is folding, freshness, or capacity tier ; picking the wrong layer wastes a one-way-door publish:
- **Does the source query-fold on the date filter?** If not, incremental refresh is off the table until folding is fixed (the per-partition queries won't filter at the source and the initial refresh times out). Verify with a tracing tool that one folded query carries the `RangeStart`/`RangeEnd` filter
- **Large but static history?** Plain incremental refresh (import); archive window to reporting need, incremental window to the late-arrival margin
- **Most of the window quiet day-to-day?** Add detect-data-changes (or a polling expression for ETL-driven control); watch the audit-column RAM cost
- **Sub-hour freshness on the newest slice?** Hybrid (Premium) + Dual dimensions + report Automatic Page Refresh; accept the storage-mode and caching complexity
- **Initial load can't finish?** Bootstrap the first refresh on Premium (create partitions empty, backfill via XMLA) and enable Large model storage beforehand; for small per-external-query sources (ADX, Log Analytics, App Insights) shrink store/refresh granularity to avoid truncation

After publish you never touch Desktop again for that model: inspect with `te incremental-refresh show`, trigger targeted refresh with `te refresh --table <t> --partition "<t>.<part>" --type full` (note `--apply-refresh-policy true` is the default and re-evaluates the rolling window; pass `false` to refresh data without rolling it). Fix a backdated-data conflict by refreshing every partition from the change point to current to keep the one-side key unique. Metadata-only changes deploy through XMLA (ALM Toolkit, TMSL, `te deploy --skip-refresh-policy`), never a re-publish.

Sources: learn.microsoft.com incremental-refresh-troubleshoot / -overview / -xmla; repo te-cli command-reference; repo refresh-semantic-model SKILL
