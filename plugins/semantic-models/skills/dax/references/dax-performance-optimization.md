# DAX Performance Optimization Guide

Complete framework for optimizing DAX query performance: tier model, phased workflow, decision guide, trace diagnostics, and on-demand pattern routing.

## Reading Guide

### Must Read — Every Optimization

Always read these sections fully before starting any optimization session:

- **[Optimization Framework](#optimization-framework)** — tiers, autonomy rules, tool requirements
- **[Phase 1: Establish Baseline](#phase-1-establish-baseline)** — measure resolution, model context, run protocol
- **[Phase 2: Optimization Iterations](#phase-2-optimization-iterations)** — apply, test, compare, iterate
- **[Section 1: How the Engine Works](./engine-internals.md#section-1-how-the-engine-works)** — FE/SE architecture, xmSQL, segments, fusion
- **[Section 2: Trace Diagnostics](./engine-internals.md#section-2-reading-and-diagnosing-traces)** — metrics, event waterfall, signal interpretation

### Consult When Needed

Read these only when directed by the Decision Guide or after Tier 1 is exhausted:

- **[Section 3: Tier 1 — DAX Patterns](./dax-patterns.md#section-3-tier-1-dax-optimization-patterns)** — DAX001–DAX021 — load only routed candidate patterns first
- **[Section 4: Tier 2 — Query Structure](./dax-patterns.md#section-4-tier-2-query-structure-patterns)** — QRY001–QRY004 — requires user approval before applying
- **[Section 5: Tier 3 — Model Changes](./model-optimization.md#section-5-tier-3-model-optimization-patterns)** — MDL001–MDL009 — high caution, user approval, suggest model copy
- **[Section 6: Tier 4 — Direct Lake](./model-optimization.md#section-6-tier-4-direct-lake-optimization-patterns)** — DL001–DL002 — high caution, user approval, requires ETL/pipeline changes

---

## Decision Guide

Use this table as a router into Section 3. Route by trace evidence when available; otherwise route by DAX shape and treat the match as a hypothesis until execution results confirm it. Load only the routed candidate patterns first; read the rest of Section 3 only if no signal matches or routed patterns are exhausted. Sections 4–6 signals are escalation triggers; consult those sections only when the signal appears.

### Section 3 — Where to Start (read all of §3)

| Route when trace shows | Or DAX shape shows | Start With |
|-----------------------|-------------------|------------|
| `CallbackDataID` / callback-like FE row work | `IF`/`SWITCH` or `DIVIDE()` inside row iterators; per-row context transition inside iterators; `ADDCOLUMNS`/`SUMMARIZE` extension patterns | [DAX002](./dax-patterns.md#dax002-use-summarizecolumns-for-grouped-calculations), [DAX007](./dax-patterns.md#dax007-convert-boolean-tests-without-if), [DAX008](./dax-patterns.md#dax008-context-transition-in-iterator), [DAX018](./dax-patterns.md#dax018-keep-iterator-division-se-native) |
| High FE time, many short SE events, or repeated cache hits | repeated measure/expression references; `SUMX(VALUES(col), CALCULATE(...))`; high-cardinality iterator with low-cardinality dependency | [DAX003](./dax-patterns.md#dax003-cache-repeated-expressions-in-variables), [DAX006](./dax-patterns.md#dax006-precompute-iterator-inputs-with-summarizecolumns), [DAX015](./dax-patterns.md#dax015-iterate-at-the-required-grain) |
| SE rows far exceed result rows, or FE filters a broad SE result | `FILTER(Table, ...)` as filter argument; combined predicates; complex `SUMMARIZE` source; filters inside `SUMMARIZECOLUMNS` | [DAX001](./dax-patterns.md#dax001-use-simple-column-filter-predicates-as-calculate-arguments), [DAX005](./dax-patterns.md#dax005-move-complex-summarize-inputs-to-calculatetable), [DAX009](./dax-patterns.md#dax009-externalize-summarizecolumns-filters), [DAX010](./dax-patterns.md#dax010-push-table-filters-with-calculatetable) |
| Multiple SE scans over the same fact with similar joins | sibling time-window measures; slice measures; `SWITCH`/`IF` branches choosing measures | [DAX019](./dax-patterns.md#dax019-move-time-windows-outside-sibling-measures), [DAX020](./dax-patterns.md#dax020-keep-slice-measures-fusion-friendly), [DAX013](./dax-patterns.md#dax013-keep-branch-measures-se-friendly) |
| Near-identical SE scans differ only by filter value | sibling measures differ only by per-measure filters on the same fact | [DAX017](./dax-patterns.md#dax017-align-scan-shape-with-boolean-multipliers) |
| Large `IN`/`INB`, `ININDEX`, or compound tuple predicates | `TREATAS`/`IN` re-filters the same fact with computed keys | [DAX021](./dax-patterns.md#dax021-join-precomputed-key-sets-in-fe) |
| `DCOUNT` in xmSQL | `DISTINCTCOUNT`, including distinct count over known unique key | [DAX011](./dax-patterns.md#dax011-test-distinctcount-alternatives), [DAX014](./dax-patterns.md#dax014-use-countrows-for-recognized-keys) |
| Result changes with grouping/filter context, or repeated predicates appear | `ALLEXCEPT`; `ALL/REMOVEFILTERS + VALUES`; duplicate predicates; redundant key-set filters | [DAX012](./dax-patterns.md#dax012-preserve-filters-deliberately), [DAX004](./dax-patterns.md#dax004-remove-redundant-filters) |
| Unexpected joins or expanded bridge/M2M paths | bidirectional/M2M relationship in filter path; `TREATAS`/`CROSSFILTER` in measure | [DAX016](./dax-patterns.md#dax016-test-relationship-overrides-locally) |

> No signal matches? Read all of §3 — patterns DAX001–DAX021 cover the full range.

### Sections 4–6 — Escalation Triggers

Only consult these sections if the corresponding signal is present. All require user approval before applying changes.

| Signal | Escalate To |
|--------|-------------|
| `__ValueFilterDM` in generated query | §4 → [QRY002](./dax-patterns.md#qry002-eliminate-report-measure-filters-__valuefilterdm) |
| Groupby column is high-cardinality (e.g., `Calendar[Date]`) | §4 → [QRY003](./dax-patterns.md#qry003-reduce-query-grain) |
| Tier 1 patterns exhausted; output change acceptable | §4 → [QRY001](./dax-patterns.md#qry001-remove-unneeded-filters)–[QRY004](./dax-patterns.md#qry004-remove-blank-suppression-changes-result-shape) |
| Few SE queries, low parallelism, clean xmSQL, high SE duration | §5/§6 → [data layout](./model-optimization.md#section-5-tier-3-model-optimization-patterns) |
| Many-to-many or bidirectional relationship overhead | §5 → [MDL001](./model-optimization.md#mdl001-many-to-many-relationship-optimization) |
| Direct Lake model + low parallelism or cold cache | §6 → [DL001](./model-optimization.md#dl001-v-ordering-delta-tables-for-direct-lake)–[DL002](./model-optimization.md#dl002-segment-size-and-parallelism) |

---

## Optimization Framework

### Tiers and Autonomy

| Tier | Scope | Autonomy |
|------|-------|----------|
| **Tier 1 — DAX Patterns** | Rewrite measure/UDF definitions | Auto-apply. Keep EVALUATE/grouping identical. |
| **Tier 2 — Query Structure** | Modify EVALUATE, grain, filters | Present recommendation. Wait for explicit user approval. |
| **Tier 3 — Model Changes** | Relationships, columns, agg tables, data types | High caution. Discuss trade-offs. Suggest model copy. Warn downstream risk. |
| **Tier 4 — Direct Lake** | OneLake layout, V-ordering, rowgroup sizing | High caution. Requires ETL/pipeline changes outside the model. |

**Success criteria — Tier 1:** Query duration improvement AND semantic equivalence (same row count, column count, data values).
**Success criteria — Tier 2/3/4:** Query duration improvement AND explicit user approval of output or structural changes.

### Requirements

- **Semantic model connection** — Any client that satisfies the Trace capture and Model metadata requirements below. See [Trace Capture Methods](#trace-capture-methods) for capability comparison across common clients.
- **Trace capture** — Ability to execute DAX queries with server timing trace capture. See [Trace Capture Methods](#trace-capture-methods).
- **Model metadata** — Ability to read measure definitions, function definitions, calculation group expressions, table metadata, and relationship metadata from the model.

### Trace Capture Methods

| Method | Scope | Capture mode | How you drive it | Notes |
|--------|-------|--------------|------------------|-------|
| **`powerbi-modeling-mcp`** | Local PBI Desktop + remote (Fabric XMLA) | Live trace subscription | Tool calls (agent-friendly) | Returns pre-calculated FE/SE split, peak memory, and result rows. |
| **TOM Trace API (ADOMD.NET / PowerShell)** | Local PBI Desktop + remote (Fabric XMLA) | Live trace subscription | PowerShell / .NET scripts | Subscribe to `QueryEnd`, `VertiPaqSEQueryEnd`, `VertiPaqSEQueryCacheMatch` and derive FE/SE manually (`FE = TotalDuration − union(VertiPaqSEQueryEnd intervals)`; SE wall-clock is the union of overlapping intervals, not the sum). Direct Lake databases are not exposed via the PBI Desktop local AS proxy — connect to the Fabric workspace XMLA endpoint instead. |
| **DAX Studio** | Local PBI Desktop + remote (Fabric XMLA) | Live trace subscription | Interactive UI | Server Timings pane shows pre-calculated FE/SE. Best for hands-on investigation. |
| **Fabric Workspace Monitoring** (`SemanticModelLogs` Eventhouse table) | Fabric workspaces (Workspace Monitoring enabled) | Logged events, queried after the fact | KQL queries against the Eventhouse | Per-row `OperationName`, `DurationMs`, `CpuTimeMs`; correlate events for one query via `OperationId`. Best for after-the-fact production analysis at scale; not suited for tight iterate-and-rerun loops. |

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

### Step 3: Execute Baseline (1 warm-up + 3 measured runs)

For each run:

1. **Clear VertiPaq cache** — clears the SE query cache only; columns stay resident.
   - Warm-up run: cold (on disk) → warm (resident).
   - Measured runs: **warm + no-cache** — the ideal optimization-test state.
2. **Execute with trace capture** — run the DAX query with server timing trace enabled.
3. **Derive key metrics** — Total Duration, FE/SE split, SE query count, peak memory, and result row count. See [Understanding FE vs. SE Metrics](./engine-internals.md#understanding-formula-engine-fe-vs-storage-engine-se-metrics) for derivation from trace events.
4. Record all metrics, save the full trace events, and save the baseline result data for semantic equivalence checks.

After all runs: discard warm-up, take the **median** of the 3 measured runs as the baseline. If results are inconsistent (>20% spread), run up to 5 more iterations to isolate platform noise from actual query performance. Record the baseline's full metrics, trace events, and CSV result.

**Isolating measures:** When a query has many measures and the trace is noisy, comment out all but one (or a small group), re-run, and compare. Repeat in groups to isolate which measures drive the majority of total duration.

### Step 4: Analyze Baseline

Apply **[Section 2: Trace Diagnostics](./engine-internals.md#section-2-reading-and-diagnosing-traces)** to interpret the metrics and events. Use the **Decision Guide** above to identify which Section 3 patterns to try first.

---

## Phase 2: Optimization Iterations

### Step 1: Select and Apply Optimizations

Using [Section 3 (Tier 1)](./dax-patterns.md#section-3-tier-1-dax-optimization-patterns), start from trace identifiers when available; otherwise use the DAX-only fallback patterns as hypotheses. Apply one or more of DAX001–DAX021.

**CRITICAL:** Modify only the **measure definitions in the DEFINE block**. Do NOT change the EVALUATE clause or SUMMARIZECOLUMNS grouping columns. Query structure must stay identical to preserve semantic equivalence.

### Step 2: Execute and Compare

1. Clear the VertiPaq cache (returns the model to the warm + no-cache state — same condition as the baseline measured runs).
2. Execute the query with trace capture enabled.

**During iteration:** 1 run is sufficient — columns are already resident from baseline, so no warm-up is needed; clearing only the SE cache keeps the warm + no-cache state. Reserve the full protocol (1 warm-up + 3 measured, take median) for the **final confirmation** against the original baseline.

**Evaluate:**
- **Improvement = (BaselineDuration − OptimizedDuration) / BaselineDuration × 100**
- **Semantic equivalence:** Compare the CSV result from this run against the baseline CSV — same row count, same columns, same data values. If results differ, the change modified calculation semantics — revert it. Check this **immediately** after each iteration, not after multiple changes.

### Step 3: Iterate and Escalate

- **Meaningful improvement + semantically equivalent** → Success. "Meaningful" = exceeds the baseline's run-to-run noise band (e.g., baseline 1200/1280/1310 ms → 1200 ms is noise; 900 ms is real). Present to user; offer the optimized query as new baseline for further rounds (compound improvements are common).
- **Further rounds:** Re-run Phase 1 Steps 3–4 on the new baseline; re-analyze the new structure against the Decision Guide, as it may expose patterns that didn't apply before (fusion, materialization, etc.).
- **Within the noise band** → Try another Section 3 pattern, or combine patterns. Re-examine trace for other bottlenecks.
- **Results differ** → Revert; the optimization changed semantics. Try another approach.
- **Tier 1 exhausted** → Move to Phase 3 (Tier 2) with user approval. "Exhausted" = every signal-matching pattern tried (individually + combined), measures isolated for multi-measure queries, last 1–2 attempts at noise floor.

---

## Phase 3: Query Structure Changes (Tier 2 — User Approval Required)

> **STOP — Do not modify the query structure without explicit user approval.**

Consult **[Section 4: Tier 2 — Query Structure Patterns](./dax-patterns.md#section-4-tier-2-query-structure-patterns)** (QRY001–QRY004).

Before applying any change:

1. Explain the specific change (e.g., "Group by YearMonth instead of Date reduces result rows from 365K to 12K").
2. Explain what changes in the output and what the user gains in performance.
3. Wait for explicit approval.
4. If approved, modify query structure, run the full baseline cycle, present results.

---

## Phase 4: Model and Data Layout Changes (Tier 3/4 — High Caution, User Approval Required)

> **STOP — Do not modify the model without explicit user approval.**

Consult **[Section 5: Tier 3 — Model Patterns](./model-optimization.md#section-5-tier-3-model-optimization-patterns)** (MDL001–MDL009) and **[Section 6: Tier 4 — Direct Lake](./model-optimization.md#section-6-tier-4-direct-lake-optimization-patterns)** (DL001–DL002).

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

## Reference Files

The detailed reference material is split into focused files for progressive disclosure:

- **[Engine Internals](./engine-internals.md)** — FE/SE architecture, xmSQL, compression/segments, SE fusion, trace diagnostics (Sections 1-2)
- **[DAX and Query Structure Patterns](./dax-patterns.md)** — Tier 1 DAX patterns DAX001-DAX021, Tier 2 query structure QRY001-QRY004 (Sections 3-4)
- **[Model and Direct Lake Optimization](./model-optimization.md)** — Tier 3 model patterns MDL001-MDL009, Tier 4 Direct Lake DL001-DL002 (Sections 5-6)
