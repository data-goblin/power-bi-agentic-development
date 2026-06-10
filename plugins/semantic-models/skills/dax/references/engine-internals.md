# Engine Internals

How the DAX engine works: Formula Engine (FE) vs. Storage Engine (SE) architecture, xmSQL query language, compression and segments, SE query fusion, and trace diagnostics.

> **Related references:** [DAX and Query Structure Patterns](./dax-patterns.md) · [Model and Direct Lake Optimization](./model-optimization.md)

---

## Section 1: How the Engine Works

### Query Processing Architecture

Every DAX query runs through two components: the **Formula Engine (FE)** and the **Storage Engine (SE)**.

The **FE** handles all DAX — branching logic, context transitions, complex arithmetic, measure evaluation. It is **single-threaded** and the bottleneck in most poorly written queries.

The **SE** reads compressed columnar data from VertiPaq. It is **multi-threaded** and very fast, but supports only a limited set of operations: the four basic arithmetic operators, GROUP BY, LEFT OUTER JOINs, and basic aggregations (SUM, COUNT, MIN, MAX, DISTINCTCOUNT).

For **DirectQuery models**, the data source serves as the SE role: the FE generates and pushes down SQL, trading network/source latency for in-memory scan cost.

**How they interact:**
- FE requests data via one or more SE scans; each result is a **datacache** (columns + aggregated values).
- Complex queries need multiple datacaches (e.g., one builds a filter set, one aggregates the fact).
- If the SE can't evaluate an expression natively → **callback** to FE row-by-row → that scan is effectively single-threaded.

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

**Relationship joins are LEFT OUTER unless otherwise stated:** the many-side table is FROM, the one-side is joined in. Other internal forms (`INNER JOIN`, `REDUCED BY`, reverse joins) can also appear depending on the operation.

**Semi-join projections:** Appear as `DEFINE TABLE $Filter0 ... ININDEX` in xmSQL — an initial dimension scan builds a key index injected into the fact WHERE clause.

**Callbacks:** Occur whenever the SE must compute an expression that falls outside of VertiPaq's native capabilities. Forms include `CallbackDataID` (arbitrary expressions, most common) and specialized variants exposing individual FE functions (rounding, log/abs math). See [DAX002](./dax-patterns.md#dax002-use-summarizecolumns-for-grouped-calculations), [DAX007](./dax-patterns.md#dax007-convert-boolean-tests-without-if), [DAX008](./dax-patterns.md#dax008-context-transition-in-iterator), [DAX018](./dax-patterns.md#dax018-keep-iterator-division-se-native) for callback elimination patterns.

---

### Compression, Segments, and Parallelism

**Compression** determines scan speed. VertiPaq uses dictionary and run-length-style encodings to reduce scan work. For Direct Lake, source Delta/Parquet layout affects how quickly columns load into VertiPaq; V-Order improves RLE-friendly layout for read-heavy Power BI tables (see [DL001](./model-optimization.md#dl001-v-ordering-delta-tables-for-direct-lake)).

**Segments** are fixed-size column chunks — the unit of both compression and parallel execution. The SE assigns one CPU thread per segment, so segment count determines how many cores a scan can utilize.

**Parallelism:** A 32M-row table in 2 segments uses 2 threads; in 32 segments it uses all 16 available threads — a 4–8× speedup with zero DAX changes.

**Segment skew matters equally:** if one segment has 15M rows and the rest have 1M, the scan bottlenecks on the oversized segment. Segments must be evenly sized for parallelism to be effective.

**Diagnosing low parallelism:** The **SE Parallelism Factor** (StorageEngineCpuTime ÷ StorageEngineDuration) shows thread utilization. Values near 1.0 mean single-threaded execution; values of 8–16 indicate strong multi-core use. When a trace shows few SE queries (1–4), high SE Duration, Parallelism Factor ≈ 1.0, and clean xmSQL — the bottleneck is likely too few segments or skewed segment sizes. DAX changes are unlikely to help; use data layout instead (see [General Data Layout Best Practices](./model-optimization.md#section-5-tier-3-model-optimization-patterns) and [DL001–DL002](./model-optimization.md#section-6-tier-4-direct-lake-optimization-patterns)).

---

### SE Query Fusion

Fusion is the engine's ability to combine multiple SE scans into fewer scans. Two flavors:

- **Vertical fusion** merges multiple measure aggregations that share the same filter context into a single SE query. Three measures on the same fact table under the same filter = one scan instead of three. Gain scales with fact table size.
- **Horizontal fusion** merges SE queries that differ only in which value(s) of a column they filter. N separate fact scans collapse to one; the FE partitions the result.

**Why fusion breaks.** Fusion needs the competing SE requests to have compatible scan shapes — the same filter context for vertical fusion, compatible single-column filter differences for horizontal. Common triggers that break that:

- **FE chooses the branch** — SWITCH/IF between measures, or per-measure filter predicates that materialize separate `VAND` tuples → structurally different SE queries → see [DAX017](./dax-patterns.md#dax017-align-scan-shape-with-boolean-multipliers)
- **Table- or range-valued filter** — time intelligence (DATESYTD, DATEADD, etc.) injects a per-measure date/range scan the SE can't fold in → see [DAX019](./dax-patterns.md#dax019-move-time-windows-outside-sibling-measures)
- **Slicing column not in the groupby** — horizontal fusion can only merge slices the result groups by; absent that, scans stay separate
- **Runtime-computed filter value** — a predicate held in a variable is treated as dynamic and won't fuse
- **Calculation group items** — each item applies its own filter modification → structurally different SE query

**Trace diagnosis:** Same fact table + same joins across multiple SE queries → missed vertical fusion. Near-identical queries differing only by `WHERE` values → blocked horizontal fusion. See [Section 3](./dax-patterns.md#section-3-tier-1-dax-optimization-patterns) and [Section 2 trace analysis](#section-2-reading-and-diagnosing-traces).

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

Fusion is blocked, callbacks are present, or filters resolve iteratively. Fix the DAX — see [Section 3](./dax-patterns.md#section-3-tier-1-dax-optimization-patterns) and [Section 4](./dax-patterns.md#section-4-tier-2-query-structure-patterns). *Example:* 109 SE queries, 30% FE → after restructuring: 4 SE queries, 1% FE.

**Few SE queries + low FE time + high SE duration + low parallelism → Data layout problem**

The DAX is clean but SE scans are slow due to insufficient segments or poor compression. DAX changes will not help — see [Section 5](./model-optimization.md#section-5-tier-3-model-optimization-patterns) / [Section 6](./model-optimization.md#section-6-tier-4-direct-lake-optimization-patterns) (General Data Layout Best Practices, DL001–DL002).

---

## Further Reading

- [Analysis Services trace events](https://learn.microsoft.com/analysis-services/trace-events/analysis-services-trace-events)
- [Horizontal fusion in Power BI and Analysis Services](https://powerbi.microsoft.com/en-us/blog/announcing-horizontal-fusion-a-query-performance-optimization-in-power-bi-and-analysis-services/)
- [Understand Direct Lake query performance](https://learn.microsoft.com/fabric/fundamentals/direct-lake-understand-storage)
