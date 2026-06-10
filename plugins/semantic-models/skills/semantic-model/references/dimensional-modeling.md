# Dimensional modeling

Companion to the `semantic-model` skill (SKILL.md). Original guidance; each section cites its sources.

**Working with `te`:** build a dimension with `te add table "Dim" --columns "Key:Int64,Attr:String" --save` and relate it via `te add relationship "Fact[Key]->Dim[Key]" --save`. Build junk / bridge / SCD calc tables with `te script` (TOM `CROSSJOIN` / `ADDCOLUMNS`) when there is no source, then hide keys with `te set <col> -q isHidden -i true --save`.

## Slowly changing dimensions (SCD2): durable keys and version-safe counting

A type-2 dimension keeps history by inserting a new row per tracked-attribute change. Each row carries a surrogate key (unique per version), a durable/natural key (stable per business entity), and validity bounds (`ValidFrom`/`ValidTo`, often `IsCurrent`). The fact joins on the surrogate, so each fact row points at the version correct at event time. This is the only shape where "sales by the customer's region at time of sale" and "by current region" coexist.

Two silent bugs appear the moment an SCD2 dimension exists, neither throwing an error:
- `DISTINCTCOUNT('Sales'[CustomerKey])` counts versions, not customers ; a customer who moved twice counts as three. Count the durable key instead, evaluated through the fact so VertiPaq solves it in the storage engine: `COUNTROWS(SUMMARIZE('Sales', 'Customer'[Customer Code]))`
- Slicing by a dimension attribute gives point-in-time history by default (the fact froze the version). Authors expecting current-state grouping get wrong totals. For current-state, do not put the changing attribute on the SCD2 table at all; split it into a separate type-1 (overwrite) dimension keyed on the durable key with its own 1:M to the fact. Then "current region" and "region at time of sale" live on different tables and the author picks. A `LASTNONBLANK`/`ValidTo IS BLANK` re-derivation works but pushes cost to the formula engine

There is no model property that says "this is SCD2"; infer it. A `te query` probe comparing `COUNTROWS(VALUES(Customer[CustomerKey]))` against `COUNTROWS(VALUES(Customer[Customer Code]))` plus a check for `Valid*` columns tells you: surrogate rows greater than durable entities means history is present and every `DISTINCTCOUNT` over the surrogate is suspect. Enumerate offenders with a `te script` C# pass over `Model.AllMeasures`, add corrected durable-key measures, and set the surrogate `IsHidden`, `SummarizeBy=None`, `isAvailableInMDX=false` (high-cardinality VertiPaq hog) ; never delete it, it is the relationship key. Drop to TOM only to read `ValidFrom`/`ValidTo` contents for non-overlap validation. Note `RELATED('Customer'[Region])` in a fact calc column returns the historical region ; usually correct, but it bites agents porting "current attribute" logic.

Sources: SQLBI distinct-count-of-customers-in-SCD2; SQLBI slowly-changing-dimensions-in-powerpivot; learn.microsoft.com star-schema (slowly changing dimensions)

## Junk dimensions: collapsing low-cardinality flag columns

A junk dimension folds several small, independent, low-cardinality attributes (order status, ship method, yes/no flags) into one table whose rows are the Cartesian product of distinct values plus a surrogate. Three status flags with 3, 2, and 4 states collapse from three relationships and three fact FKs into one dimension of at most 24 rows and one FK ; the fact shrinks, the relationship graph simplifies, and the AI schema surface reads cleaner. The payoff is bounded by the product of distinct counts, so it only works for genuinely low-cardinality attributes ; cross two 50-value columns and you have a 2,500-row table that is no longer junk.

Build the Cartesian product upstream (warehouse view, or Power Query full-outer-joins of the distinct lists plus an index surrogate merged back onto the fact). When the source is fixed, build it as a DAX calculated table via `te script` (`CROSSJOIN`/`ADDCOLUMNS` of the distinct flag values, with a concatenated `StatusKey`), hide every column, set `SummarizeBy=None`, and relate on a matching computed `StatusKey` on the fact (1:M, single direction). A calculated-table junk dim avoids ETL but will not materialize in DirectQuery or (mid-2026) Direct Lake; push the build to the Lakehouse/warehouse for those modes. Prefer building from observed tuples over the full Cartesian when many combinations never occur, so slicers do not surface impossible pairs.

Sources: learn.microsoft.com star-schema (junk dimensions); learn.microsoft.com fabric dimensional-modeling-dimension-tables (junk dimensions)

## Header-detail: carrying header-grain measures on a flattened model

Transactional sources arrive as a header (order: date, customer, store, freight, order-level discount) plus detail lines. Denormalize header attributes onto the line fact ; never relate two facts on the order number (SQLBI's benchmark: a 94M-distinct order-number join ran one query at 15x the CPU of the star, and a product filter forcing bidirectional propagation pushed a query from 6 to 17 minutes). The part that bites after flattening: header-grain measures (freight, shipping cost, a flat order fee) double-count when summed off the line fact, because the header value repeats per line.

Two correct shapes, picked by how the header measure is sliced:
1. **Header value additive only over header-grain dimensions.** Keep one line-grain fact and de-dup the header value per order: `SUMX(VALUES('Sales'[Order Number]), CALCULATE(MAX('Sales'[Freight])))`. Correct sliced by date/customer/store, and intentionally won't break down by product (freight has no product grain). Hide the raw `Freight` so nobody drags the `SUM` version onto a visual
2. **Many header measures, heavily used.** Keep two facts at their natural grains (a `Sales Order` header fact, a `Sales` line fact), each related to the shared conformed dimensions, never to each other. Header measures live on the header fact, line measures on the line fact; both filter correctly by shared dimensions and neither double-counts. This is "two facts, conformed dimensions," distinct from the forbidden "two facts related to each other"

Validate the de-dup with a `te query` comparing naive `SUM(Sales[Freight])` against the `SUMX` form ; equal means either one line per order or freight was already allocated upstream. For the two-fact shape, confirm both facts relate only to shared dimensions via `INFO.VIEW.RELATIONSHIPS()`, and validate RI on both (a header customer the lines lack diverges totals). Allocating freight down to the line is a different decision that changes the number; only do it if the business wants freight attributable per product.

Sources: SQLBI header-detail-vs-star-schema-models; learn.microsoft.com relationships-one-to-one

## Bridge tables as factless facts, and degenerate-dim as-table vs as-column

Two nuances the simple framing misses:
- The recommended way to relate two dimensions many-to-many is a **factless-fact bridge** (only the two keys, duplicates allowed) with both dimensions on the one-side and the bridge on the many-side, preferred over a native many-to-many relationship. Both produce the same filtering, but the bridge is a real table you can put RLS on, hang a weighting/allocation measure on, and read in lineage; the native m2m hides that. A native m2m is `Limited`, so RI violations group silently under a blank; two 1:M `Regular` legs surface the same blanks but are inspectable
- A degenerate dimension is not always "a hidden fact column." One degenerate attribute means a hidden fact column. Two or more correlated ones (order number and order line number) mean a separate 1:1 dimension built from a composite surrogate (`OrderNumber * 1000 + OrderLineNumber`), giving clean `Sales Order` / `Sales Order Line` fields while keeping the fact narrow

Build the bridge via `te script` as a calculated table of distinct key pairs (or load from source), hide its columns, add two 1:M relationships, and make exactly one leg bidirectional. m2m grand totals are non-additive (a salesperson in two regions contributes to both, so "All Regions" is less than the sum of parts) ; bake that into the measure `Description` so Copilot and authors do not read it as a bug. The degenerate-as-table only works at exactly one row per fact line with matching surrogate values both sides ; build it at fact grain, never `DISTINCT`. Do not reach for a bridge to fix a snowflake ; that is a normalization issue, flatten upstream.

Sources: learn.microsoft.com star-schema (factless fact tables); learn.microsoft.com relationships-many-to-many; learn.microsoft.com relationships-one-to-one (degenerate dimensions)
