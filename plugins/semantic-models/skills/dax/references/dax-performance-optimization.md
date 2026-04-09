# DAX Performance Optimization Guide

Complete framework for optimizing DAX query performance: tier model, workflow phases, engine internals, trace diagnostics, and a full pattern catalog (DAX001–DL002).

## Reading Guide

### Must Read — Every Optimization

Always read these sections fully before starting any optimization session:

- **[Optimization Framework](#optimization-framework)** — tiers, autonomy rules, tool requirements
- **[Phase 1: Establish Baseline](#phase-1-establish-baseline)** — measure resolution, model context, run protocol
- **[Phase 2: Optimization Iterations](#phase-2-optimization-iterations)** — apply, test, compare, iterate
- **[Section 1: How the Engine Works](#section-1-how-the-engine-works)** — FE/SE architecture, xmSQL, segments, fusion
- **[Section 2: Trace Diagnostics](#section-2-reading-and-diagnosing-traces)** — metrics, event waterfall, signal interpretation
- **[Section 3: Tier 1 — DAX Patterns](#section-3-tier-1-dax-optimization-patterns)** — DAX001–DAX021 (auto-apply, no approval needed)

### Consult When Needed

Read these only when directed by the Decision Guide or after Tier 1 is exhausted:

- **[Section 4: Tier 2 — Query Structure](#section-4-tier-2-query-structure-patterns)** — QRY001–QRY004 — requires user approval before applying
- **[Section 5: Tier 3 — Model Changes](#section-5-tier-3-model-optimization-patterns)** — MDL001–MDL010 — high caution, user approval, suggest model copy
- **[Section 6: Tier 4 — Direct Lake](#section-6-tier-4-direct-lake-optimization-patterns)** — DL001–DL002 — high caution, user approval, requires ETL/pipeline changes

---

## Decision Guide

Use to prioritize *where to start* within sections, not to skip them. Section 3 is always read in full — these signals tell you which patterns to try first. Sections 4–6 signals are escalation triggers; consult those sections only when the signal appears.

### Section 3 — Where to Start (read all of §3)

| Signal | Start With |
|--------|------------|
| `CallbackDataID` or `EncodeCallback` in xmSQL | DAX002, DAX007, DAX008, DAX018 (highest priority) |
| `ADDCOLUMNS` or `SUMMARIZE` in measure expression | DAX002, DAX006 |
| `SUMMARIZE` with complex or filtered table as first argument | DAX005 |
| `SUMX(VALUES(col), CALCULATE(...))` pattern in measure | DAX006 |
| Same measure evaluated multiple times | DAX003 |
| Duplicate or redundant `CALCULATE` filter predicates | DAX004 |
| `FILTER(Table, ...)` as `CALCULATE` argument, or `&&` joining predicates in single filter | DAX001 |
| `ALL(table), VALUES(table[col])` in same `CALCULATE` | DAX012 |
| Filter or `TREATAS` passed directly as `SUMMARIZECOLUMNS` argument (not wrapped in `CALCULATETABLE`) | DAX009 |
| SE rows far exceed final result count | DAX010 |
| `DISTINCTCOUNT` in measure expression | DAX011, DAX014 |
| Conditional logic (`IF`, `IIF`) or `DIVIDE()` inside row iterator | DAX007, DAX018 |
| `SWITCH` or `IF` as primary expression body in measure | DAX013 |
| Multiple SE queries hitting same fact table | DAX019 (vertical fusion), DAX020 (horizontal), DAX017 (boolean multiplier) |
| Near-identical SE queries on same fact table differing only by a column filter value or by per-measure `VAND` tuple predicates | DAX017 |
| Bidirectional or M2M relationship causing unexpected SE join expansion, or existing `TREATAS`/`CROSSFILTER` in measure | DAX016 |
| High-cardinality iterator (many distinct rows, low-cardinality attribute) | DAX015 |
| `TREATAS` or `IN` re-filtering same fact with a computed key set; or large compound-tuple semi-join in xmSQL | DAX021 |

> No signal matches? Read all of §3 — patterns DAX001–DAX021 cover the full range.

### Sections 4–6 — Escalation Triggers

Only consult these sections if the corresponding signal is present. All require user approval before applying changes.

| Signal | Escalate To |
|--------|-------------|
| `__ValueFilterDM` in generated query | §4 → QRY002 |
| Groupby column is high-cardinality (e.g., `Calendar[Date]`) | §4 → QRY003 |
| Tier 1 patterns exhausted; output change acceptable | §4 → QRY001–QRY004 |
| Few SE queries, low parallelism, clean xmSQL, high SE duration | §5/§6 → data layout |
| Many-to-many or bidirectional relationship overhead | §5 → MDL001 |
| Direct Lake model + low parallelism or cold cache | §6 → DL001–DL002 |

---

## Optimization Framework

### Tiers and Autonomy

| Tier | Scope | Autonomy |
|------|-------|----------|
| **Tier 1 — DAX Patterns** | Rewrite measure/UDF definitions | Auto-apply. Keep EVALUATE/grouping identical. |
| **Tier 2 — Query Structure** | Modify EVALUATE, grain, filters | Present recommendation. Wait for explicit user approval. |
| **Tier 3 — Model Changes** | Relationships, columns, agg tables, data types | High caution. Discuss trade-offs. Suggest model copy. Warn downstream risk. |
| **Tier 4 — Direct Lake** | OneLake layout, V-ordering, rowgroup sizing | High caution. Requires ETL/pipeline changes outside the model. |

**Success criteria — Tier 1:** ≥10% duration improvement AND semantic equivalence (same row count, column count, data values).
**Success criteria — Tier 2/3/4:** ≥10% improvement AND explicit user approval of output or structural changes.

### Requirements

- **Semantic model connection** — Connect to the target semantic model before starting. For local Power BI Desktop models, use `connect-pbid`. For remote Fabric/XMLA models, use `powerbi-modeling-mcp` or an equivalent XMLA-capable tool.
- **Trace capture** — Requires the ability to execute DAX queries with server timing trace capture. See [Trace Capture Methods](#trace-capture-methods) below.
- **Model metadata** — Requires the ability to read measure definitions, function definitions, calculation group expressions, table metadata, and relationship metadata from the model.
- **Tier 2:** Present the change and its output impact, wait for user approval.
- **Tier 3/4:** Explain trade-offs, warn about downstream report risk, suggest working on a model copy, identify upstream changes (Lakehouse, Warehouse, Power Query) that may require changes beyond the semantic model itself.

### Trace Capture Methods

All methods use the same Analysis Services Trace API and produce identical trace events.

| Method | Scope | Notes |
|--------|-------|-------|
| **`connect-pbid`** (PowerShell/ADOMD) | Local PBI Desktop | See [`performance-profiling.md`](../../../pbi-desktop/skills/connect-pbid/references/performance-profiling.md). Derive FE/SE split manually. |
| **`powerbi-modeling-mcp`** (VS Code extension) | Local + remote (XMLA) | Returns pre-calculated FE/SE split, peak memory, result rows. Install: `code --install-extension analysis-services.powerbi-modeling-mcp` |
| **DAX Studio** | Local + remote | Server Timings pane. Manual, not scriptable. |
| **Fabric Workspace Monitoring** | Fabric workspaces | Built-in workspace-level query monitoring. |

---

## Phase 1: Establish Baseline

### Step 1: Resolve All Measure and Function Definitions

Before optimizing, fully resolve every DAX expression in the query. Partial visibility leads to incorrect or incomplete optimizations.

1. **Identify measure references** in the user's query — any `[MeasureName]` pattern.
2. **Retrieve each measure's expression** — read the measure definition (name, table, DAX expression) from the model.
3. **Recursively resolve dependencies** — read each expression, find nested `[OtherMeasure]` calls, fetch those too.
4. **Retrieve user-defined functions** if referenced.
5. **Build a DEFINE block** that explicitly inlines all resolved measures and functions.
6. **Check for active calculation groups** — list all calculation groups in the model, retrieve their calculation item expressions. Note any that may be active in the query context as they affect query plans for every intercepted measure.

**Example:** If `[Profit Margin]` = `DIVIDE([Total Profit], [Total Revenue])`, retrieve all three definitions and build:

```dax
DEFINE
    MEASURE 'Sales'[Total Revenue] = SUM('Sales'[Revenue])
    MEASURE 'Sales'[Total Profit]  = SUM('Sales'[Revenue]) - SUM('Sales'[Cost])
    MEASURE 'Sales'[Profit Margin] = DIVIDE([Total Profit], [Total Revenue])

EVALUATE
SUMMARIZECOLUMNS ( 'Product'[Category], "Profit Margin", [Profit Margin] )
```

### Step 2: Gather Model Context

1. List all tables — understand table structure and storage modes (Import, DirectQuery, Direct Lake).
2. List all relationships — understand join paths and filter propagation.

This context helps distinguish model design issues (missing star schema, bidirectional relationships) from DAX expression problems.

### Step 3: Execute Baseline (1 warm-up + 2 measured runs)

For each run:

1. **Clear cache** — clear the model's VertiPaq cache to ensure cold-cache timing.
2. **Execute with trace capture** — run the DAX query with server timing trace enabled.
3. **Derive key metrics** — Total Duration, FE/SE split, SE query count, peak memory, and result row count. See [Understanding FE vs. SE Metrics](#understanding-formula-engine-fe-vs-storage-engine-se-metrics) for derivation from trace events.
4. Record all metrics, save the full trace events, and save the baseline result data for semantic equivalence checks.

After all runs: discard warm-up, take the **fastest** of the 2 measured runs as the baseline. Record its full metrics, trace events, and CSV result.

**Isolating measures:** When a query has many measures and the trace is noisy, comment out all but one (or a small group), re-run, and compare. Repeat in groups to isolate which measures drive the majority of total duration.

### Step 4: Analyze Baseline

Apply **Section 2: Trace Diagnostics** to interpret the metrics and events. Use the **Decision Guide** above to identify which Section 3 patterns to try first.

---

## Phase 2: Optimization Iterations

### Step 1: Select and Apply Optimizations

Using Section 3 (Tier 1), identify DAX patterns present in the baseline measures. Apply one or more of DAX001–DAX021.

**CRITICAL:** Modify only the **measure definitions in the DEFINE block**. Do NOT change the EVALUATE clause or SUMMARIZECOLUMNS grouping columns. Query structure must stay identical to preserve semantic equivalence.

```dax
-- BASELINE measure
DEFINE
    MEASURE Products[HighValueCount] = SUMX('Products', IF([Sales Amount] > 10000000, 1, 0))

-- OPTIMIZED measure (DAX007: IF → INT)
DEFINE
    MEASURE Products[HighValueCount] = SUMX('Products', INT([Sales Amount] > 10000000))
```

### Step 2: Execute and Compare

1. Clear the model cache.
2. Execute the query with trace capture enabled.

**During iteration:** 1 run is sufficient — columns are already resident from baseline. Reserve the full 3-run protocol (1 warm-up + 2 measured) for the **final confirmation** against the original baseline.

**Evaluate:**
- **Improvement = (BaselineDuration − OptimizedDuration) / BaselineDuration × 100**
- **Semantic equivalence:** Compare the CSV result from this run against the baseline CSV — same row count, same columns, same data values. If results differ, the change modified calculation semantics — revert it. Check this **immediately** after each iteration, not after multiple changes.

### Step 3: Iterate and Escalate

- **≥10% improvement + semantically equivalent** → Success. Present optimized query and improvement to user. Offer to use it as new baseline for further rounds (compound improvements are common).
- **Further rounds:** When the user opts to continue, re-run Phase 1 Steps 3–4 on the new baseline. The optimized query has different structure — re-analyze against the Decision Guide and full pattern catalog. Patterns that didn't apply before (e.g., fusion opportunities, materialization candidates) may now be relevant.
- **<10% improvement** → Try another Section 3 pattern. Re-examine trace for additional bottlenecks.
- **Results differ** → Revert. The optimization changed calculation semantics. Try a different approach.
- **Tier 1 exhausted** → Move to Phase 3 (Tier 2) with user approval.

---

## Phase 3: Query Structure Changes (Tier 2 — User Approval Required)

> **STOP — Do not modify the query structure without explicit user approval.**

Consult **Section 4: Tier 2 — Query Structure Patterns** (QRY001–QRY004).

Before applying any change:

1. Explain the specific change (e.g., "Group by YearMonth instead of Date reduces result rows from 365K to 12K").
2. Explain what changes in the output and what the user gains in performance.
3. Wait for explicit approval.
4. If approved, modify query structure, run the full baseline cycle, present results.

---

## Phase 4: Model and Data Layout Changes (Tier 3/4 — High Caution, User Approval Required)

> **STOP — Do not modify the model without explicit user approval.**

Consult **Section 5: Tier 3 — Model Patterns** (MDL001–MDL010) and **Section 6: Tier 4 — Direct Lake** (DL001–DL002).

Before proceeding:

1. Present the specific diagnosis and proposed model change.
2. Explain why the model design is causing the performance bottleneck.
3. Warn that model changes can break downstream reports and visuals.
4. Suggest creating a copy of the semantic model to experiment on.
5. Identify if upstream changes are required (Lakehouse tables, Warehouse views, Power Query transformations) — these cannot be done through semantic model tooling alone.
6. If approved, coordinate with the user's CI/CD process.
7. After applying changes, re-run the full baseline optimization workflow to measure impact.

---

## Error Handling

- **Connection failure** — Verify dataset name, workspace name, or XMLA endpoint. For Desktop, ensure Power BI Desktop is running and note the local port. For Service, verify XMLA read/write is enabled on the capacity.
- **Query syntax error** — Validate DAX syntax before executing.
- **Semantic equivalence failure** — Optimization changed calculation semantics. Review filter context, aggregation granularity, and CALCULATE filter arguments. Revert and try differently.
- **No improvement found** — Some queries are already well-optimized at the DAX level. Check whether the bottleneck is data layout (Phase 4) or query structure (Phase 3).
- **Trace events empty** — Ensure server timing / trace capture is enabled before executing the query. Verify the trace is subscribed to the correct event types (`QueryEnd`, `VertiPaqSEQueryEnd`, `VertiPaqSEQueryCacheMatch`).

---

## Section 1: How the Engine Works

### Query Processing Architecture

Every DAX query runs through two components: the **Formula Engine (FE)** and the **Storage Engine (SE)**.

The **FE** handles all DAX — branching logic, context transitions, complex arithmetic, measure evaluation. It is **single-threaded** and the bottleneck in most poorly written queries.

The **SE** reads compressed columnar data from VertiPaq. It is **multi-threaded** and very fast, but supports only a limited set of operations: the four basic arithmetic operators, GROUP BY, LEFT OUTER JOINs, and basic aggregations (SUM, COUNT, MIN, MAX, DISTINCTCOUNT).

For **Direct Query models**, the SE role is played by the underlying data source (SQL, Spark, etc.). The FE generates SQL and pushes it down. The trade-off is network and source latency instead of in-memory scan cost.

**How they interact:** The FE requests data from the SE in one or more scans — each result is a **datacache** (a set of columns and aggregated values). Complex queries may require multiple datacaches: one to build a filter set, another to aggregate the fact. When the SE cannot evaluate an expression natively, it **calls back** to the FE row-by-row — making that SE scan effectively single-threaded.

The core principle of DAX optimization: **push as much work as possible into the SE, minimize SE scans, and eliminate callbacks entirely.**

---

### xmSQL: The Storage Engine Query Language

xmSQL is the human-readable representation of SE scan activity in trace events — it shows which tables are scanned, which columns are aggregated, which filters apply, and how joins resolve. Syntax resembles SQL with key differences:

**Implicit GROUP BY:** Every column in the SELECT list is automatically a grouping column — no GROUP BY keyword.

**Computed expressions:** Row-level calculations use a `WITH` block with `:=`, referenced in aggregations via `@`:
```
WITH $Expr0 := ( 'Sales'[UnitPrice] * 'Sales'[OrderQuantity] )
SELECT Product[Category], SUM ( @$Expr0 )
FROM Sales
    LEFT OUTER JOIN Product ON 'Sales'[ProductKey] = Product[ProductKey]
```

**Joins are always LEFT OUTER:** The many-side table is FROM, the one-side is joined in.

**Semi-join projections:** Appear as `DEFINE TABLE $Filter0 ... ININDEX` in xmSQL — an initial dimension scan builds a key index injected into the fact WHERE clause.

**Callbacks:** Occur whenever the SE must compute an expression that exceeds VertiPaq's native capabilities — forcing row-by-row evaluation back in the FE. Example: `IF('Sales'[Amount] > 1000, 1, 0)` inside an iterator requires a callback because the SE cannot evaluate conditional logic. Replace with `INT('Sales'[Amount] > 1000)` to keep the expression SE-native. See DAX002, DAX007, DAX008, DAX018 for callback elimination patterns.

---

### Compression, Segments, and Parallelism

**Compression** determines scan speed. VertiPaq uses run-length encoding (RLE) and dictionary encoding. **V-ordering** reorders rows within segments to maximize RLE compression. Import models are V-ordered automatically. Direct Lake models are **not** — enable V-ordering explicitly (see DL001).

**Segments** are fixed-size column chunks — the unit of both compression and parallel execution. The SE assigns one CPU thread per segment, so segment count determines how many cores a scan can utilize.

**Parallelism:** A 32M-row table in 2 segments uses 2 threads; in 32 segments it uses all 16 available threads — a 4–8× speedup with zero DAX changes.

**Segment skew matters equally:** if one segment has 15M rows and the rest have 1M, the scan bottlenecks on the oversized segment. Segments must be evenly sized for parallelism to be effective.

**Diagnosing low parallelism:** The **SE Parallelism Factor** (StorageEngineCpuTime ÷ StorageEngineDuration) shows thread utilization. Values near 1.0 mean single-threaded execution; values of 8–16 indicate strong multi-core use. When a trace shows few SE queries (1–4), high SE Duration, Parallelism Factor ≈ 1.0, and clean xmSQL — the bottleneck is too few segments or skewed segment sizes. This cannot be fixed with DAX; the fix is data layout (see General Data Layout Best Practices and DL001–DL002).

---

### SE Query Fusion

Fusion is the engine's ability to combine multiple SE scans into fewer scans. There are two types:

**Vertical fusion** merges multiple measure aggregations that share the same filter context into a single SE query. Three measures on the same fact table under the same filter = one scan instead of three. Gain scales with fact table size.

**What blocks vertical fusion:**
- **Time intelligence functions** (DATESYTD, DATEADD, SAMEPERIODLASTYEAR, etc.) — each TI-modified measure needs its own date-filtered SE scan → see DAX019
- **Per-measure filter predicates** — can cause the FE to materialize separate `VAND` tuple predicates per measure, producing structurally different SE queries even when the underlying logic is identical → see DAX017
- **SWITCH/IF selecting between measures** — engine cannot determine at plan time which aggregation to include
- **Calculation group items** applying different filter modifications — each generates its own SE query

**Horizontal fusion** merges SE queries that differ only in which single value of a column they filter. N separate fact scans collapse to one; the FE partitions the result.

**What blocks horizontal fusion:**
- **Filtered column not in groupby** — engine cannot merge slices if the slicing column is absent from the groupby
- **Table-valued filter per measure** (e.g., time intelligence) — prevents slice merging even when column filters are identical
- **Filter value computed at runtime** (stored in a variable) — engine treats it as dynamic and will not fuse

**Trace diagnosis:** Multiple SE queries hitting the same fact table with same joins → vertical fusion blocked. N near-identical SE queries with only the WHERE filter differing → horizontal fusion blocked. See DAX patterns and Section 2 trace analysis.

---

## Section 2: Reading and Diagnosing Traces

### Understanding Formula Engine (FE) vs. Storage Engine (SE) Metrics

These are the critical metrics for DAX optimization, derived from Analysis Services trace events.

| Metric | How to Derive | Description | Target |
|--------|--------------|-------------|--------|
| **Total Duration** | `QueryEnd.Duration` | End-to-end query time (ms) | Lower is better |
| **FE Duration** | Total Duration − SE wall-clock time | Single-threaded FE processing time (ms) — **the #1 bottleneck in most slow queries** | Lower is better |
| **SE Duration** | Union of overlapping `VertiPaqSEQueryEnd` intervals | Multi-threaded SE query time (ms) | Higher % of total is better |
| **SE Query Count** | Count of `VertiPaqSEQueryEnd` events | Number of SE scans generated | Fewer is better |
| **SE CPU Time** | Sum of all `VertiPaqSEQueryEnd.CpuTime` | Total CPU across all SE threads | Higher ratio to SE Duration is better |
| **SE Parallelism Factor** | SE CPU Time ÷ SE Duration | Thread utilization across all scans | Higher is better (>1 = multi-threaded) |
| **Cache Matches** | Count of `VertiPaqSEQueryCacheMatch` events | Cache hits (SE queries answered from memory) | Only relevant on warm cache |
| **Peak Memory (KB)** | From execution metrics summary | Memory consumed during query execution | Lower is better — high values signal excessive materializations |
| **SE Scan Row Count** | `volume` from `[Estimated size (volume, marshalling bytes): X, Y]` in `VertiPaqSEQueryEnd.TextData` | Rows materialized per SE scan | Large volumes signal excessive materialization — the SE is handing too many rows to the FE |
| **FE %** | FE Duration ÷ Total Duration × 100 | Percentage of time in formula engine | Lower is better |
| **SE %** | SE Duration ÷ Total Duration × 100 | Percentage of time in storage engine | Higher is better |

> **Net wall-clock:** SE Duration is the *union* of overlapping SE intervals — not the sum of individual durations. Three concurrent 100ms scans = ~100ms wall clock, not 300ms.

**Parallelism — aggregate vs. per-scan:** The aggregate parallelism factor is computed across all SE scans. Each individual scan has its own `CpuTime / Duration`. A healthy aggregate factor can mask a single unparallelized scan where `CpuTime ≈ Duration`.

**FE processing gaps:** FE Duration is the sum of all time intervals where no SE query was executing — gaps between SE events on the timeline.

### Analyzing Trace Events

Trace events are captured from the Analysis Services engine during query execution. Each event includes: `EventClass` (event type), `EventSubclass`, `TextData` (xmSQL or DAX), `Duration`, `CpuTime`, `StartTime`, `EndTime`.

**Key event types:**
- `VertiPaqSEQueryBegin` / `VertiPaqSEQueryEnd` — SE scan lifecycle. `Duration` and `CpuTime` are on the End event. `TextData` contains the xmSQL query.
- `VertiPaqSEQueryCacheMatch` — SE query answered from cache (no scan). Count these separately.
- `QueryBegin` / `QueryEnd` — Overall DAX query lifecycle. `Duration` on QueryEnd = total wall-clock time.
- `AggregateTableRewriteQuery` — Fired when the engine rewrites a query to use an aggregation table. `TextData` contains the rewritten query. Presence indicates the engine found and used an agg table hit — absence on an agg-enabled model means the query fell through to the detail table.

> **Filtering trace output:** Focus on the event types above. Ignore `VertiPaqScanInternal` subclass events — these duplicate the outer `VertiPaqScan` with internal detail (e.g., `DC_KIND="DENSE"`) and identical timing. Also ignore `CommandBegin`/`CommandEnd` (DAX execution wrapper, no diagnostic value) and `Error` events (only relevant when errors occur).

**Per-scan derived metrics (from VertiPaqSEQueryEnd events):**

Each `VertiPaqSEQueryEnd` event provides the raw data to derive per-scan diagnostics:

- **Rows scanned / Marshalling KB** — parse `[Estimated size (volume, marshalling bytes): X, Y]` at the end of `TextData`. X = rows, Y = bytes. Identifies excessive materializations on a specific scan.
- **Per-scan parallelism** — `CpuTime / Duration` for that individual scan. A ratio near 1.0 means single-threaded even if the aggregate `storageEngineCpuFactor` looks healthy.
- **Callbacks on slow scans** — scan `TextData` for `CallbackDataID`/`EncodeCallback` to confirm which specific SE query has the callback.

**Building an FE gap waterfall:**

FE processing occurs in the gaps *between* SE events. Use `StartTime`/`EndTime` offsets from `QueryBegin.StartTime` to build a timeline:
1. Gap between `QueryBegin` and the first SE `StartTime` → FE plan compilation
2. Gap between one SE `EndTime` and the next SE `StartTime` → FE processing block
3. Gap between the last SE `EndTime` and `QueryEnd.EndTime` → final FE assembly
4. Overlapping SE events → parallel SE execution; sequential non-overlapping → FE feeding results between scans
5. A large gap (>100ms) signals expensive FE computation — examine the SE query *before* the gap

### What to Look For

Scan for these signals in priority order when analyzing a slow query:

1. **Callbacks** — `CallbackDataID` or `EncodeCallback` in SE TextData. Fix first (DAX002, DAX007, DAX008, DAX018).
2. **High FE %** — FE doing too much work; usually paired with many short SE queries.
3. **High SE query count / repeated fact scans** — multiple SE queries hitting the same fact table with same joins but different WHERE clauses or aggregations → blocked fusion. See SE Query Fusion.
4. **Large materializations** — SE rows far exceed final result, or SE queries with no WHERE clause → FE filtering post-materialization instead of pushing to SE. See DAX009.
5. **Low parallelism factor** — near 1.0 on slow scans → data layout problem, not DAX. See Compression, Segments, and Parallelism.
6. **High KB per SE event** — wide intermediate tables; reduce columns or aggregate earlier.
7. **Two-step dimension pre-scans** — dimension-only SELECT followed by `where predicate` on the fact. Restructure query to collapse into one scan.
8. **Large semi-join index tables** — `DEFINE TABLE` + `ININDEX` or `WHERE ... IN` with hundreds of compound tuples (e.g., `(GroupByCol, FilterKey)` pairs). See DAX021.
9. **Missing aggregate table hit** — Model has agg tables configured but no `AggregateTableRewriteQuery` event in the trace → query fell through to the detail table. Check agg table mappings and query grain.

**Prioritization:** Callbacks → Large FE processing → SE query count (DAX) → parallelism and data volume (data layout). Target the highest-duration SE scan first — ignore 0ms cache-hit scans.

---

### DAX vs. Data Layout: Reading the Signal

**Many SE queries + high FE time + individually short SE scans → DAX problem**

Fusion is blocked, callbacks are present, or filters resolve iteratively. Fix the DAX — see Section 3 and Section 4. *Example:* 109 SE queries, 30% FE → after restructuring: 4 SE queries, 1% FE.

**Few SE queries + low FE time + high SE duration + low parallelism → Data layout problem**

The DAX is clean but SE scans are slow due to insufficient segments or poor compression. DAX changes will not help — see Section 5/6 (General Data Layout Best Practices, DL001–DL002).

---

## Section 3: Tier 1 — DAX Optimization Patterns

> **Autonomy: Auto-apply freely. Modify only measure/UDF definitions in the DEFINE block. Keep EVALUATE and SUMMARIZECOLUMNS grouping identical.**

> **Prefer SUMMARIZECOLUMNS:** Fully supported inside measure definitions — earlier restrictions no longer apply. Use it to replace `ADDCOLUMNS`/`SUMMARIZE` patterns (DAX002), pre-materialize context transitions before iterating (DAX006), and cache repeated evaluations into a single virtual table (DAX003). Prefer it over `ADDCOLUMNS(VALUES(...), ...)` unless a specific scenario prevents it.

### DAX001: Use Simple Column Filter Predicates as CALCULATE Arguments

CALCULATE accepts simple boolean column predicates directly — these are more efficient than wrapping a table in FILTER (causes excessive materialization). Split `&&` into separate filter arguments.

**Anti-pattern — FILTER with table expression uses an iterator:**
```dax
CALCULATE(
    SUM('Sales'[Amount]),
    FILTER('Product', 'Product'[Category] = "Electronics")
)
```

**Preferred — column predicate, no iterator:**
```dax
CALCULATE(
    SUM('Sales'[Amount]),
    KEEPFILTERS( 'Product'[Category] = "Electronics")
)
```

**Anti-pattern — `&&` joins predicates into a single iterator argument:**
```dax
CALCULATETABLE( 'Sales', 'Sales'[Region] = "West" && 'Sales'[Amount] > 1000 )
```

**Preferred — separate predicates for better query plan:**
```dax
CALCULATETABLE( 'Sales', 'Sales'[Region] = "West", 'Sales'[Amount] > 1000 )
```

---

### DAX002: Replace ADDCOLUMNS/SUMMARIZE with SUMMARIZECOLUMNS

SUMMARIZECOLUMNS defines grouping + calculation in one step, enabling better SE fusion. Replace all ADDCOLUMNS/SUMMARIZE patterns.

**Anti-patterns:**
```dax
SUMMARIZE ( 'Sales', 'Sales'[ProductKey], "Total Profit", [Profit] )
ADDCOLUMNS ( SUMMARIZE ( 'Sales', 'Sales'[ProductKey] ), "Total Profit", [Profit] )
ADDCOLUMNS ( 'Sales', "Total Profit", CALCULATE ( [Profit] ) )
ADDCOLUMNS ( VALUES('Sales'[ProductKey]), "Total Profit", [Profit] )
```

**Preferred:**
```dax
SUMMARIZECOLUMNS ( 'Sales'[ProductKey], "Total Profit", [Profit] )
```

---

### DAX003: Cache Repeated and Context-Independent Expressions in Variables

Evaluating the same measure multiple times or placing context-independent expressions inside iterators causes redundant SE queries. Cache in a variable.

**Anti-pattern — repeated measure reference:**
```dax
VAR TotalA = [Sales Amount] * 1.1
VAR TotalB = [Sales Amount] * 0.9
VAR TotalC = [Sales Amount] + 1000
```

**Preferred:**
```dax
VAR _SalesAmount = [Sales Amount]
VAR TotalA = _SalesAmount * 1.1
VAR TotalB = _SalesAmount * 0.9
VAR TotalC = _SalesAmount + 1000
```

**Anti-pattern — same measure iterated twice:**
```dax
VAR A = SUMX ( VALUES('Sales'[ProductKey]), [Total Sales] )
VAR B = AVERAGEX ( VALUES('Sales'[ProductKey]), [Total Sales] )
```

**Preferred — materialize once:**
```dax
VAR Base = SUMMARIZECOLUMNS ( 'Sales'[ProductKey], "@TotalSales", [Total Sales] )
VAR A = SUMX ( Base, [@TotalSales] )
VAR B = AVERAGEX ( Base, [@TotalSales] )
```

**Anti-pattern — context-independent expression inside iterator:**
```dax
SUMX( 'Sales', 'Sales'[Quantity] * [Average Price] * 1.1 )
// [Average Price] doesn't change per row
```

**Preferred:**
```dax
VAR _AvgPrice = [Average Price]
RETURN SUMX( 'Sales', 'Sales'[Quantity] * _AvgPrice * 1.1 )
```

---

### DAX004: Remove Duplicate / Redundant Filters

Applying the same filter condition twice — whether as duplicate CALCULATE arguments or as a variable that restates an existing predicate — causes redundant SE evaluation.

**Anti-pattern — same predicate in CALCULATE + FILTER:**
```dax
CALCULATE(
    SUM('Sales'[Amount]),
    'Sales'[Year] = 2023,
    FILTER('Sales', 'Sales'[Year] = 2023)
)
```

**Anti-pattern — redundant filter variable:**
```dax
VAR FilteredValues = CALCULATETABLE ( DISTINCT ( 'Table'[Key1] ), 'Table'[Amount] > 1000 )
VAR Result =
    CALCULATETABLE (
        SUMMARIZECOLUMNS ( 'Table'[Key2], "TotalQty", SUM ( 'Table'[Quantity] ) ),
        'Table'[Amount] > 1000,
        'Table'[Key1] IN FilteredValues  -- redundant: already filtered by Amount > 1000
    )
```

**Preferred — single filter, no duplication:**
```dax
CALCULATE( SUM('Sales'[Amount]), 'Sales'[Year] = 2023 )

VAR Result =
    CALCULATETABLE (
        SUMMARIZECOLUMNS ( 'Table'[Key2], "TotalQty", SUM ( 'Table'[Quantity] ) ),
        'Table'[Amount] > 1000
    )
```

---

### DAX005: SUMMARIZE with Complex Table Expression

Instead of using SUMMARIZE with complex table expressions as the first argument, wrap with CALCULATETABLE instead.

**Anti-pattern:**
```dax
SUMMARIZE(
    CALCULATETABLE('Sales', 'Sales'[Year] = 2023, 'Sales'[CustomerKey] IN SellingPOCs),
    'Sales'[CustomerKey],
    "DistinctSKUs", DISTINCTCOUNT('Sales'[StoreKey])
)
```

**Preferred:**
```dax
CALCULATETABLE(
    SUMMARIZECOLUMNS(
        'Sales'[CustomerKey],
        "DistinctSKUs", DISTINCTCOUNT('Sales'[StoreKey])
    ),
    'Sales'[Year] = 2023,
    'Sales'[CustomerKey] IN SellingPOCs
)
```

---

### DAX006: Pre-Materialize Context Transitions with SUMMARIZECOLUMNS

Materializing context transition results in SUMMARIZECOLUMNS and iterating over pre-calculated values can improve query plan.

**Anti-pattern:**
```dax
SUMX(
    VALUES('Product'[Attribute]),
    CALCULATE(SUM('Sales'[Amount]))
)
```

**Preferred:**
```dax
SUMX(
    SUMMARIZECOLUMNS(
        'Product'[Attribute],
        "@Amount", SUM('Sales'[Amount])
    ),
    [@Amount]
)
```

---

### DAX007: Replace IF with INT for Boolean Conversion

INT with boolean expressions avoids conditional logic callbacks that IF statements trigger.

**Anti-pattern:**
```dax
SUMX(
    'Products',
    IF([Sales Amount] > 10000000, 1, 0)
)
```

**Preferred:**
```dax
SUMX(
    'Products',
    INT([Sales Amount] > 10000000)
)
```

**When the result is a count of qualifying rows, eliminate the iterator and callback entirely with a simple predicate:**
```dax
-- Anti-pattern: iterator + conditional = callback
SUMX( 'Sales', IF('Sales'[Amount] > 1000, 1, 0) )

-- Preferred: native SE aggregation, no iterator, no callback
CALCULATE( COUNTROWS('Sales'), 'Sales'[Amount] > 1000 )
```

---

### DAX008: Context Transition in Iterator

Context transition is powerful but expensive. Optimize by:

1. **Remove it completely:**
```dax
// Instead of: SUMX( 'Sales', [Sales Amount] )
// Use: SUMX( 'Sales', 'Sales'[Unit Price] * 'Sales'[Quantity] )
```

2. **Reduce number of columns:**
```dax
// Instead of: SUMX( 'Account', [Total Sales] )
// Use: SUMX( VALUES ( 'Account'[Account Key] ), [Total Sales] )
```

3. **Reduce cardinality before iteration:**
```dax
// Instead of: SUMX( 'Account', [Total Sales] * 'Account'[Corporate Discount] )
// Use: SUMX( VALUES ( 'Account'[Corporate Discount] ), [Total Sales] * 'Account'[Corporate Discount] )
```

---

### DAX009: Wrap SUMMARIZECOLUMNS Filters with CALCULATETABLE

Filters passed as direct arguments to SUMMARIZECOLUMNS inside measures can produce unexpected results. Move filters to a wrapping CALCULATETABLE instead.

**Anti-pattern:**
```dax
SUMMARIZECOLUMNS (
    'Table'[Column],
    TREATAS ( { "Value" }, 'Table'[FilterColumn] ),
    "@Calculation", [Measure]
)
```

**Preferred:**
```dax
CALCULATETABLE (
    SUMMARIZECOLUMNS (
        'Table'[Column],
        "@Calculation", [Measure]
    ),
    'Table'[FilterColumn] = "Value"
)
```

---

### DAX010: Apply Filters Using CALCULATETABLE Instead of FILTER

CALCULATETABLE modifies filter context directly for better query plans.

**Anti-pattern:**
```dax
FILTER( 'Sales', 'Sales'[Year] = 2023 )
```

**Preferred:**
```dax
CALCULATETABLE( 'Sales', 'Sales'[Year] = 2023 )
```

---

### DAX011: Distinct Count Alternatives

Depending on cardinality and data layout, moving DISTINCTCOUNT to SUMX(VALUES(),1) can improve performance by forcing FE evaluation.

**Storage Engine Bound:**
```dax
DISTINCTCOUNT('Sales'[CustomerKey])
```

**Formula Engine Bound (sometimes faster):**
```dax
SUMX(VALUES('Sales'[CustomerKey]), 1)
```

---

### DAX012: Use ALLEXCEPT Instead of ALL + VALUES Restoration

When clearing filter context with ALL() and then restoring specific columns via VALUES(), ALLEXCEPT achieves the same in one operation.

**Anti-pattern:**
```dax
CALCULATE( [Total Sales], ALL('Sales'), VALUES('Sales'[Region]) )
```

**Preferred:**
```dax
CALCULATE( [Total Sales], ALLEXCEPT('Sales', 'Sales'[Region]) )
```

> **Note:** Only valid when `'Sales'[Region]` is actively filtered. Without it, `VALUES` returns all regions (no-op restore) while `ALLEXCEPT` still clears other filters — the two forms are not equivalent, and `ALL + VALUES` is required.

---

### DAX013: SWITCH/IF Branch Optimization in SUMMARIZECOLUMNS

SWITCH/IF inside SUMMARIZECOLUMNS enables branch optimization — the engine evaluates only the matching branch. When this fails, it materializes a full cartesian product. Three things break it:

1. **Multiple aggregations in one branch** — merge into single SUMX: `SUMX('Sales', 'Sales'[SalesAmount] - 'Sales'[TotalCost])`
2. **Mismatched data types across branches** — an implicit cast breaks the optimization; use explicit conversion: `CONVERT(SUM('Sales'[OrderQuantity]), CURRENCY)`
3. **Context transition inside a branch iterator** — a measure reference that requires a context transition (e.g., `SUMX(Sales, 'Sales'[Quantity] * [selection])`) forces a full crossjoin. If the measure is context-independent, cache it before the iterator: `VAR _UnitDiscount = [Unit Discount]`

---

### DAX014: Use COUNTROWS Instead of DISTINCTCOUNT on Key Columns

Use when a column is a primary key (one-side of a relationship).

**Anti-pattern:**
```dax
DISTINCTCOUNT ( 'Product'[ProductKey] )
```

**Preferred:**
```dax
COUNTROWS ( 'Product' )
```

For non-key columns where DISTINCTCOUNT is a bottleneck, see DAX011 for alternatives.

---

### DAX015: Move Calculation to Lower Granularity

When an iterator scans a high-cardinality table but the calculation depends on a low-cardinality attribute, iterate over the attribute instead.

**Anti-pattern:**
```dax
-- 100K customers but only 5 distinct DiscountRate values → 100K context transitions
SUMX( 'Customer', CALCULATE(SUM('Sales'[Amount])) * 'Customer'[DiscountRate] )
```

**Preferred:**
```dax
-- 5 iterations instead of 100K
SUMX( VALUES('Customer'[DiscountRate]), CALCULATE(SUM('Sales'[Amount])) * 'Customer'[DiscountRate] )
```

---

### DAX016: Experiment with Relationship Overrides via TREATAS and CROSSFILTER

Relationship direction and filter propagation directly affect SE query plans. Sometimes bidirectional is faster; sometimes explicit filter propagation wins. Use TREATAS and CROSSFILTER to experiment without model changes.

**Example — replace bidirectional bridge with explicit filter:**
```dax
CALCULATE(
    SUM('Sales'[Amount]),
    CROSSFILTER('Customer'[CustomerKey], 'SportBridge'[CustomerKey], NONE),
    TREATAS(VALUES('SportBridge'[CustomerKey]), 'Customer'[CustomerKey])
)
```

---

### DAX017: Apply Boolean Multiplier to Unblock Fusion

**SE signal:** Near-identical SE queries on the same fact table that differ only by a column filter value or by per-measure `VAND` tuple predicates on the same column.

**Fix:** Replace the per-measure filter with `SUMX(KEEPFILTERS(ALL(Column)), expr * boolean)` to move the filter from SE to FE, making SE queries structurally identical across measures.

```dax
-- Anti-pattern: separate SE query per measure
CALCULATE( SUM('Sales'[Amount]), 'Product'[Category] = "Bikes" )
CALCULATE( SUM('Sales'[Amount]), 'Date'[Date] = _dateAnchor )
CALCULATE( MAX('Sales'[DateKey]),  'Sales'[Metric] <> 0 )

-- Fix: boolean multiplier — structurally identical SE queries → engine fuses
SUMX( KEEPFILTERS(ALL('Product'[Category])), CALCULATE(SUM('Sales'[Amount])) * ('Product'[Category] = "Bikes") )
SUMX( KEEPFILTERS(ALL('Date'[Date])),        CALCULATE(SUM('Sales'[Amount])) * ('Date'[Date] = _dateAnchor) )
MAXX( ALL('Date'[Date]),                     CALCULATE(MAX('Sales'[DateKey])) * INT(NOT ISBLANK(CALCULATE(SUM('Sales'[Metric])))) )
```

`KEEPFILTERS` preserves external context; when the column is in the groupby, detail cells iterate only 1 row. Works with all aggregation types.

**BLANK → 0 caveat:** the boolean pattern returns 0 instead of BLANK when no data exists. If `ISBLANK()` checks matter downstream, wrap: `VAR _r = SUMX(...) RETURN IF(_r = 0, BLANK(), _r)`.

---

### DAX018: Replace DIVIDE() with / Operator in Iterators

DIVIDE() includes divide-by-zero protection that forces FE callbacks inside iterators. Use the native `/` operator to keep the expression SE-native. Only use `/` when the denominator is guaranteed non-zero. If zero is possible, pre-filter: `CALCULATETABLE('Items', 'Items'[LocationAdjustment] <> 0)`.

**Anti-pattern:**
```dax
SUMX('Fact', 'Fact'[BaseAmount] * DIVIDE(RELATED('Items'[Discount]), RELATED('Items'[LocationAdjustment])))
```

**Preferred:**
```dax
SUMX('Fact', 'Fact'[BaseAmount] * (RELATED('Items'[Discount]) / RELATED('Items'[LocationAdjustment])))
```

---

### DAX019: Lift Time Intelligence to Outer CALCULATE for Vertical Fusion

TI functions (DATESYTD, DATEADD, etc.) break vertical fusion — each TI-modified measure gets its own SE query. Keep base measures TI-free and apply TI once in an outer wrapper.

> **Custom time intelligence (VAR-based predicates):** When measures use manual date anchoring via `CALCULATE(expr, Column = _var)` instead of built-in TI functions, DAX019 does not apply — see **DAX017** for the boolean multiplier workaround.

**Anti-pattern — each measure applies TI independently (no fusion):**
```dax
MEASURE 'Sales'[Revenue YTD] = CALCULATE ( [Revenue], DATESYTD('Date'[Date]) )
MEASURE 'Sales'[Cost YTD]    = CALCULATE ( [Cost],   DATESYTD('Date'[Date]) )
MEASURE 'Sales'[Margin YTD] =
    [Revenue YTD] - [Cost YTD]
```

**Preferred — base measures fuse, TI applied once:**
```dax
MEASURE 'Sales'[Margin YTD] =
    CALCULATE ( [Revenue] - [Cost], DATESYTD ( 'Date'[Date] ) )
```

---

### DAX020: Unblock Horizontal Fusion by Lifting Filters

Horizontal fusion merges SE queries that differ only by column-slice filter. It breaks when the filtered column is missing from groupby, or when table-valued / runtime-computed filters are applied per measure. Fix: keep only simple column-slice filters inside base measures; lift everything else (TI, dynamic variables) to an outer CALCULATE.

**Anti-pattern — TI inside each slice measure (no fusion):**
```dax
MEASURE 'Sales'[Bikes YTD]       = CALCULATE ( SUM('Sales'[Amount]), 'Product'[Category] = "Bikes",       DATESYTD('Date'[Date]) )
MEASURE 'Sales'[Accessories YTD] = CALCULATE ( SUM('Sales'[Amount]), 'Product'[Category] = "Accessories", DATESYTD('Date'[Date]) )
```

**Preferred — slice measures fuse, TI applied once:**
```dax
MEASURE 'Sales'[Bikes]       = CALCULATE ( SUM('Sales'[Amount]), 'Product'[Category] = "Bikes" )
MEASURE 'Sales'[Accessories] = CALCULATE ( SUM('Sales'[Amount]), 'Product'[Category] = "Accessories" )
MEASURE 'Sales'[Combined YTD] = CALCULATE ( [Bikes] + [Accessories], DATESYTD('Date'[Date]) )
```

Same principle applies to runtime variable filters — move them to the consuming measure. See DAX017 when the filtered column is not in the groupby.

---

### DAX021: Pre-Compute and Join Instead of Filter Round-Trip

When a measure computes a qualifying key set from a filtered aggregation and then uses TREATAS or IN to filter a second aggregation by those keys, the outer SUMMARIZECOLUMNS context compounds the key filter with groupby columns — generating large tuple semi-joins (e.g., 500+ `(Brand, Key)` pairs in a single WHERE clause). The compound-tuple SE scan often dominates total query time.

**SE signal:** `VertiPaqSEQueryEnd` with `DEFINE TABLE ... ININDEX` or `WHERE ... IN` containing hundreds of compound tuples. Single scan duration disproportionately high relative to others.

**Fix:** Pre-compute both aggregations independently at the shared key grain, then join with NATURALINNERJOIN in the FE. The table expression used to build each side — `ADDCOLUMNS(VALUES(...), ...)`, `SUMMARIZECOLUMNS(...)`, etc. — does not matter; the key is that both sides share a common lineage column for the join.

**Anti-pattern — TREATAS pushes key set back to SE, compounded by outer groupby:**
```dax
VAR _FilteredAgg =
    CALCULATETABLE (
        ADDCOLUMNS ( VALUES ( 'Fact'[Key] ), "@Agg1", [Measure] ),
        'Dim'[Filter] = "X"
    )
VAR _Qualifying = FILTER ( _FilteredAgg, [@Agg1] > 1000000 )
VAR _Result =
    CALCULATE (
        [Measure],
        TREATAS ( SELECTCOLUMNS ( _Qualifying, "K", 'Fact'[Key] ), 'Fact'[Key] )
    )
```

**Preferred — both aggregations pre-computed, joined in FE:**
```dax
VAR _FilteredAgg =
    CALCULATETABLE (
        ADDCOLUMNS ( VALUES ( 'Fact'[Key] ), "@Agg1", [Measure] ),
        'Dim'[Filter] = "X"
    )
VAR _Qualifying = FILTER ( _FilteredAgg, [@Agg1] > 1000000 )
VAR _UnfilteredAgg =
    ADDCOLUMNS ( VALUES ( 'Fact'[Key] ), "@Agg2", [Measure] )
VAR _Joined = NATURALINNERJOIN ( _Qualifying, _UnfilteredAgg )
VAR _Result = SUMX ( _Joined, [@Agg2] )
```

> **Why it works:** Each pre-computed table generates independent SE scans — clean, no tuple filters. NATURALINNERJOIN matches on the shared `'Fact'[Key]` lineage column in the FE, replacing the expensive compound-tuple SE round-trip with a fast in-memory join over small pre-materialized tables.

---

## Section 4: Tier 2 — Query Structure Patterns

> **STOP — Requires user approval before applying any change. Explain the impact on query output and wait for explicit confirmation.**

> **Scope: Desktop-Achievable Changes Only**
> 
> Every Tier 2 recommendation must map to an action the report author can perform in Power BI Desktop's UI. The agent optimizes the *generated* DAX query, but the user implements changes through the Desktop interface — not by editing DAX directly in the query pane. Examples of valid changes:
> - **Changing the axis/groupby field** (e.g., swap `Calendar Date` for `Calendar Month` on a visual axis)
> - **Removing or adding visual-level filters** (e.g., drop an unneeded slicer selection)
> - **Changing filter values** (e.g., narrow a date range filter)
> - **Removing measure value filters** (e.g., remove a "Top N" or "> threshold" filter from a visual)
> - **Changing aggregation type** on a column (e.g., Sum → Average)

### QRY001: Remove Unneeded Filters

Every filter adds a `WHERE` clause in xmSQL and may force an extra SE join. Users often apply global slicer or visual-level filters that don't actually affect the calculation being optimized.

**Detection:** `WHERE` clauses on columns not used in the measure logic, or filter variables that restrict to a single value (e.g., `Currency[Code] = "USD"` in a USD-only model).

**Fix:** Experiment — remove filters one at a time and re-run. If the result doesn't change, the filter might be unnecessary. Global filters that are needed across all visuals should be pushed to the data source (model-level change — see Section 5).

```dax
-- Before: filter on Currency adds an SE join for no benefit
SUMMARIZECOLUMNS (
    'Product'[Category],
    KEEPFILTERS ( TREATAS ( {"USD"}, 'Currency'[Code] ) ),
    "Revenue", [Total Revenue]
)

-- After: filter removed, same result, one fewer SE join
SUMMARIZECOLUMNS ( 'Product'[Category], "Revenue", [Total Revenue] )
```

---

### QRY002: Eliminate Report Measure Filters (__ValueFilterDM)

When a visual filters on a measure value (e.g., "Revenue > 1M"), Power BI generates a `__ValueFilterDM` variable that evaluates the measure twice — once for the filter check, once for display. Roughly doubles execution time.

**Detection:** `__ValueFilterDM` in the generated query.

**Fix:** Move the threshold into the measure itself — return BLANK below the cutoff. SUMMARIZECOLUMNS auto-drops blank rows, achieving the same visual result in one pass:
```dax
MEASURE 'Sales'[Total Revenue Filtered] =
    VAR __Rev = [Total Revenue]
    RETURN IF ( __Rev > 1000000, __Rev )
```

---

### QRY003: Reduce Query Grain

Grouping by a high-cardinality column (e.g., `Calendar[Date]` → 365 rows) when the user only needs monthly data (12 rows) inflates SE row count ~30×.

**Detection:** Groupby on a date or high-cardinality column producing far more rows than the visual needs.

**Option A — coarser groupby:**
```dax
-- Daily → monthly
SUMMARIZECOLUMNS ( 'Calendar'[YearMonth], "Revenue", [Total Revenue] )
```

**Option B — period-end axis + measure pin** (show period-end snapshot instead of full-period aggregate):

Requires a period-end column in the date table (e.g., `Calendar[MonthEndDate]`). User changes the visual axis to it, then pins the measure to that date:
```dax
-- User changes axis from Calendar[Date] to Calendar[MonthEndDate]
-- Measure pins CALCULATE to the period-end date to return that day's value only
MEASURE 'Sales'[Active Customers] =
    CALCULATE (
        DISTINCTCOUNT ( 'Sales'[CustomerID] ),
        'Calendar'[Date] = MAX ( 'Calendar'[MonthEndDate] )
    )
```
> Without the pin, grouping by `MonthEndDate` aggregates all days in the month instead of returning the single-day value.

**Option C — return BLANK for non-boundary dates** (keeps all dates in groupby but only computes on end-of-month):
```dax
MEASURE 'Sales'[Revenue EOM] =
    IF ( MAX('Calendar'[Date]) = EOMONTH(MAX('Calendar'[Date]), 0), [Total Revenue] )
```

**Option D — daily additive measure approximated at coarser grain** (divide monthly total by days in month):
```dax
MEASURE 'Sales'[Daily Avg Revenue] =
    DIVIDE (
        [Total Revenue],
        DAY ( EOMONTH ( MAX('Calendar'[Date]), 0 ) )
    )
```

---

### QRY004: Remove BLANK Suppression (Changes Result Shape)

`+ 0`, `IF(ISBLANK([M]), 0, [M])`, or `COALESCE(..., 0)` force SUMMARIZECOLUMNS to evaluate every groupby combination — including rows with no data — inflating the result set.

**Detection:** `+ 0`, `IF(ISBLANK(...))`, or `COALESCE(..., 0)` appended to measures.

**Anti-pattern:**
```dax
MEASURE 'Sales'[Revenue] = SUM ( 'Sales'[SalesAmount] ) + 0
```

**Preferred:**
```dax
MEASURE 'Sales'[Revenue] = SUM ( 'Sales'[SalesAmount] )
```

**If zeros are required selectively**, conditionally add 0 where it makes sense:
```dax
MEASURE 'Sales'[Revenue] =
    VAR _ForceZero = NOT ISEMPTY ( 'Sales' )
    RETURN [Sales Amount] + IF ( _ForceZero, 0 )
```

---

## Section 5: Tier 3 — Model Optimization Patterns

> **STOP — Requires user approval before applying any change. Warn that model changes can break downstream reports. Suggest working on a model copy. Implement via `powerbi-semantic-model` skill; upstream source changes (Lakehouse, Warehouse, Power Query) require `fabric-cli` or pipeline coordination.**

### General Data Layout Best Practices

Data layout decisions affect performance at the source level — before DAX, before the SE. Apply after exhausting DAX and query structure optimizations; changes here require ETL or pipeline modifications. Apply to both Import and Direct Lake.

1. **Remove unused columns and filter rows at the source.**
2. **Drop all-null/all-zero fact rows** that never contribute to results.
3. **Move low-cardinality string attributes off the fact table** into dimensions with integer keys.
4. **Partition on high-filter columns** (DateKey, TenantKey) so the engine skips entire files. Use **Z-order clustering** when partitioning creates too many small files.
5. **Presort on the most filtered/grouped column first** (e.g., DateKey, then ProductKey). RLE compression improves dramatically when values cluster into longer runs per segment.
6. **Use optimal data types.** See MDL003.

---

### MDL001: Many-to-Many Relationship Optimization

Bridge tables create expanded tables the engine materializes every query. The right layout depends on filter paths, bridge cardinality, and RLS. Test each option. Scenario: `User` (security), `Customer` (dimension), `UserCustomer` (bridge), `Fact`.

**A — Canonical (bidir bridge):** `User 1──* UserCustomer *──bidir──1 Customer 1──* Fact`
Customer filters Fact directly; bridge only traversed for User. Best when User is rarely a slicer alongside Customer. Bidir causes high FE cost when both filter together.

**B — M2M bridge to fact (no bidir):**
```
User 1──* UserCustomer *──1 Customer
                │
                *──M2M──* Fact
```
Both dims always filter through bridge M2M. Best when consistent query times matter more than peak Customer-only performance.

**C — Optimized hybrid:** `User 1──* UserCustomer *──M2M──* Fact *──1 Customer`
Customer filters Fact directly; User filters through bridge M2M. No bidir. Best general-purpose layout. Use inactive relationship + `USERELATIONSHIP` if you need Customer↔UserCustomer cross-queries.

**D — Pre-computed combination key:** `User 1──* UserCombinations *──M2M──* Fact *──1 Customer`
ETL assigns a surrogate key per unique set of customers a user can access — users with identical access share one key. Best when bridge is very large or many users share the same access patterns.

---

### MDL002: Star Schema Conformance

Snowflake schemas force multiple SE joins per query. Flatten dimension chains into a single wide dimension to reduce join depth and enable better fusion.

`Sales ──* Product ──* Subcategory ──* Category` → `Sales ──* Product [ProductKey, ProductName, Subcategory, Category]`

---

### MDL003: Column Cardinality and Data Type Optimization

High-cardinality columns inflate dictionary size and segment memory.

- **Integer keys over string keys:** Replace `"PROD-001234"` with integer surrogates.
- **Reduce timestamp precision:** `DateTime` → `Date` when queries only group by date.
- **Bin continuous values:** 50K distinct decimals → binned ranges if measure logic allows.
- **Split high-cardinality columns:** `FullAddress` (100K distinct) → `City`, `State`, `Zip`.

---

### MDL004: Aggregation Table Strategies

Pre-summarized Import tables intercept SE queries before they hit large DQ facts. Aggregate Awareness redirects automatically — no DAX changes.

**Setup:** `GROUP BY [FKs], SUM([Metrics])` → load as Import → connect to same dimensions → map in Manage Aggregations as `SUM OF [FactTable[Column]]`. Fact tables must be DQ.

**Filtered Aggs (hot/cold split):** Import only recent data (e.g., last 3 months). 95%+ queries served from Import.

---

### MDL005: Pre-Compute Period Comparison Columns

Period-over-period calcs (YoY, MoM) require two SE scans. Pre-computing prior-period values as physical columns on the fact row reduces it to one scan.

**Before (two scans):**
```dax
YoY = SUM ( 'Fact'[Sales] ) - CALCULATE ( SUM ( 'Fact'[Sales] ), SAMEPERIODLASTYEAR ( 'Date'[Date] ) )
```
**After (one scan):**
```dax
YoY = SUM ( 'Fact'[Sales] ) - SUM ( 'Fact'[SalesLY] )
```

Wider fact table, but eliminates the TI scan entirely. Best for fixed period comparisons on large DQ tables.

---

### MDL006: Row-Based Time Intelligence Table

DAX TI functions break vertical fusion — each period measure gets its own SE query. A row-based TI table pre-materializes all periods as data rows so all period measures fuse into a single SE scan.

**Table:** `Period` (slicer label), `Date` (actual dates → relationship to fact), `AxisDate` (x-axis anchor). Relate via M2M to Fact or BiDir through Calendar.

---

### MDL007: Eliminate Referential Integrity Violations

Fact FKs with no matching dimension row prevent inner-join rewriting for SWITCH/multi-measure patterns.

**Detection:**
```dax
SELECT [Dimension_Name], [RIVIOLATION_COUNT]
FROM $SYSTEM.DISCOVER_STORAGE_TABLES
WHERE [RIVIOLATION_COUNT] > 0
```

**Fix:** Add an "Unknown" catch-all row to the dimension and map missing foreign keys in fact to "Unknown" record.

---

### MDL008: Replace SEARCH/FIND Filters with Pre-Computed Boolean Columns

`SEARCH()`/`FIND()` in filters forces row-by-row string scanning. Pre-compute the result as a boolean column (cardinality 2, ~1 bit/row) for pure columnar access. Generalizes to any fixed-value logical test — date flags, category indicators, prefix checks.

---

### MDL009: Cardinality Reduction via Historical Value Substitution

Replace old key values beyond a retention window with a single placeholder to collapse cardinality and shrink dictionaries. This can be done in both facts and dimensions.

```sql
CASE WHEN SaleDate >= DATEADD(year, -1, GETDATE()) THEN SalesKey ELSE 'Historical Key' END
```

---

### MDL010: Set IsAvailableInMDX on Disconnected Slicer Tables

Disconnected slicer tables (e.g., a `'Reporting Scenario'[Scenario]` parameter table with no model relationship) are commonly used with `SELECTEDVALUE` inside `IF`/`SWITCH`. When the slicer has no active selection, `SELECTEDVALUE` returns BLANK. With `IsAvailableInMDX = false`, the engine cannot determine this statically — it queries the table and generates two evaluation branches even though only one will execute. With `IsAvailableInMDX = true`, the engine statically resolves the unfiltered state and eliminates the dead branch without an extra SE scan.

> **Scope:** This optimization only applies when the slicer column is **unfiltered**. When a selection is active, the branch is always evaluated regardless of this property — the static resolution path is not available.

---

## Section 6: Tier 4 — Direct Lake Optimization Patterns

> **STOP — Requires user approval before applying any change. Changes here require Spark/ETL jobs or Fabric resource profile configuration outside the semantic model. Coordinate with the user's data engineering workflow.**

Direct Lake reads from OneLake Delta Parquet files instead of importing. Import-like speed when data is memory-resident, but unique characteristics around cold cache and segment loading.

### DL001: V-Ordering for Optimal VertiPaq Compression

Import models are always V-ordered. Direct Lake models are **not** — enable it explicitly. V-ordering reorders rows within each rowgroup to maximize RLE compression (2–5× improvement).

Two approaches:
- **Spark:** `spark.conf.set("spark.microsoft.delta.vorder.enabled", "true")` then run `OPTIMIZE`.
- **Fabric resource profile:** Use the [`readHeavyForPBI` resource profile](https://learn.microsoft.com/en-us/fabric/data-engineering/configure-resource-profile-configurations) which enables V-ordering and optimized write settings automatically.

---

### DL002: Segment Size and Parallelism

Delta rowgroups map directly to VertiPaq segments — one segment per CPU core. More segments = better CPU saturation (see SE Parallelism Factor in Section 1).

**Target: 1–16M rows per rowgroup.** Too few rowgroups → single-threaded scans; too many tiny rowgroups → merge overhead. For small tables (< 1M rows) this rarely matters. Run `OPTIMIZE` regularly to consolidate small files into properly sized rowgroups.

Maximize available cores by choosing a capacity SKU that matches table size — a table with 2 segments on an F64 wastes most of its parallelism budget.
