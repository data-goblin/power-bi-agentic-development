---
name: dax
version: 0.21.0
description: Optimize DAX query performance using a structured tier framework, trace diagnostics, and a comprehensive pattern catalog (DAX001–DL002). Automatically invoke when the user asks to "optimize DAX", "improve query performance", "fix slow DAX", "tune a measure", "analyze server timings", "reduce query duration", "DAX performance", "callback in trace", "FE vs SE", "storage engine optimization", or mentions slow queries, DAX anti-patterns, or performance profiling.
---

# DAX Performance Optimization

Structured framework for optimizing DAX query performance: tiered autonomy model, phased workflow, engine internals, trace diagnostics, and a comprehensive pattern catalog covering DAX rewrites (Tier 1), query structure changes (Tier 2), model modifications (Tier 3), and Direct Lake layout (Tier 4).

## When to Use

- A DAX query or measure is slow and needs optimization
- Server timings show high Formula Engine (FE) percentage or callbacks
- The user wants to systematically improve query performance
- Trace analysis reveals blocked fusion, excessive SE queries, or large materializations
- Pre-production performance validation of measures or reports
- The user asks about DAX anti-patterns, xmSQL interpretation, or SE/FE diagnostics

## When NOT to Use

- For general model auditing or best practice review → use [`review-semantic-model`](../review-semantic-model/)
- For naming conventions → use [`standardize-naming-conventions`](../standardize-naming-conventions/)
- For refresh issues → use [`refreshing-semantic-model`](../refreshing-semantic-model/)
- For memory/size analysis without DAX performance concerns → see `review-semantic-model` references

## Optimization Workflow Overview

The full workflow, tier definitions, autonomy rules, decision guide, engine internals, trace diagnostics, and all patterns are in the reference guide. Read it in full before starting any optimization session.

### Tier Model

| Tier | Scope | Autonomy |
|------|-------|----------|
| **Tier 1 — DAX Patterns** (§3) | Rewrite measure/UDF definitions | Auto-apply. Keep EVALUATE/grouping identical. |
| **Tier 2 — Query Structure** (§4) | Modify EVALUATE, grain, filters | Present recommendation. Wait for user approval. |
| **Tier 3 — Model Changes** (§5) | Relationships, columns, agg tables | High caution. Discuss trade-offs. Suggest model copy. |
| **Tier 4 — Direct Lake** (§6) | OneLake layout, V-ordering, segments | High caution. Requires ETL/pipeline changes. |

### Phased Approach

1. **Phase 1 — Establish Baseline:** Resolve all measure definitions, gather model context, execute baseline runs with trace capture, analyze trace diagnostics using the Decision Guide.
2. **Phase 2 — Optimize (Tier 1):** Apply DAX patterns (DAX001–DAX021) to measure definitions. One iteration at a time, verify semantic equivalence after each change.
3. **Phase 3 — Query Structure (Tier 2):** If Tier 1 is exhausted, propose query structure changes (QRY001–QRY004) with user approval.
4. **Phase 4 — Model/Layout (Tier 3/4):** If query-level optimization is exhausted, propose model or data layout changes (MDL001–MDL010, DL001–DL002) with user approval.

### Trace Capture

Trace capture is essential for diagnosing performance issues. The approach depends on available tooling:

- **With `pbi-desktop` plugin (Power BI Desktop):** Use the PowerShell-based Trace API documented in the [`connect-pbid` skill](../../pbi-desktop/skills/connect-pbid/) — specifically `performance-profiling.md` for FE/SE timing and `evaluateandlog-debugging.md` for intermediate result inspection. The `Measure-QueryMedian` helper provides statistical sampling.
- **With MCP server (`powerbi-modeling-mcp`):** Use `trace_operations` → Start, Stop, Fetch for trace capture and `dax_query_operations` → Execute with `GetExecutionMetrics=true` for inline metrics.
- **With DAX Studio:** Enable Server Timings manually and capture xmSQL + FE/SE split.
- **With Fabric Workspace Monitoring:** Query historical trace events from the KQL database.

Choose whichever approach matches your environment. The optimization patterns themselves are tool-agnostic — only the trace capture mechanism differs.

### Decision Guide (Quick Reference)

Use to prioritize *where to start* within the pattern catalog:

| Signal | Start With |
|--------|------------|
| `CallbackDataID` or `EncodeCallback` in xmSQL | DAX002, DAX007, DAX008, DAX018 |
| `ADDCOLUMNS` or `SUMMARIZE` in measure | DAX002, DAX006 |
| Same measure evaluated multiple times | DAX003 |
| `FILTER(Table, ...)` as CALCULATE argument | DAX001 |
| IF/SWITCH as primary measure body | DAX013 |
| Multiple SE queries on same fact table | DAX017, DAX019, DAX020 |
| Few SE queries + high SE duration + low parallelism | §5/§6 → data layout |

> Full decision guide with all signals is in the reference.

## Pattern Catalog Summary

### Tier 1 — DAX Patterns (auto-apply)

| ID | Pattern | Core Fix |
|----|---------|----------|
| DAX001 | FILTER → column predicate | Replace `FILTER(table)` with direct column predicates in CALCULATE |
| DAX002 | ADDCOLUMNS/SUMMARIZE → SUMMARIZECOLUMNS | Better SE fusion |
| DAX003 | Cache repeated expressions | Variables for repeated measures/context-independent values |
| DAX004 | Remove duplicate filters | Eliminate redundant CALCULATE predicates |
| DAX005 | SUMMARIZE with complex table | Wrap with CALCULATETABLE |
| DAX006 | Pre-materialize context transitions | SUMMARIZECOLUMNS before iterating |
| DAX007 | IF → INT for boolean | Eliminate callbacks in iterators |
| DAX008 | Context transition in iterator | Remove, reduce columns, or reduce cardinality |
| DAX009 | SUMMARIZECOLUMNS filter wrapping | Move filters to outer CALCULATETABLE |
| DAX010 | FILTER → CALCULATETABLE | Direct filter context modification |
| DAX011 | DISTINCTCOUNT alternatives | SUMX(VALUES(),1) for FE-bound path |
| DAX012 | ALL+VALUES → ALLEXCEPT | Single operation filter restoration |
| DAX013 | SWITCH/IF branch optimization | Fix type mismatches, single aggregation per branch |
| DAX014 | DISTINCTCOUNT → COUNTROWS on keys | Exploit primary key knowledge |
| DAX015 | Move to lower granularity | Iterate attribute values, not full table |
| DAX016 | Relationship overrides | TREATAS/CROSSFILTER experiments |
| DAX017 | Boolean multiplier for fusion | Unblock vertical fusion across measures |
| DAX018 | DIVIDE() → / in iterators | Eliminate FE callbacks |
| DAX019 | Lift time intelligence | Outer CALCULATE for vertical fusion |
| DAX020 | Horizontal fusion enablement | Ensure filter column in groupby |
| DAX021 | TREATAS/IN optimization | Reduce compound-tuple semi-join overhead |

### Tier 2–4 (user approval required)

| ID | Pattern | Scope |
|----|---------|-------|
| QRY001–QRY004 | Query structure changes | Grain reduction, filter rewriting |
| MDL001–MDL010 | Model changes | Relationships, agg tables, columns, data types |
| DL001–DL002 | Direct Lake layout | V-ordering, segment sizing |

## References

- [DAX Performance Optimization Guide](./references/dax-performance-optimization.md) — Complete framework: tiers, workflow phases, engine internals (FE/SE architecture, xmSQL, segments, fusion), trace diagnostics, and full pattern catalog (DAX001–DL002)

## Related Skills

- [`review-semantic-model`](../review-semantic-model/) — Model auditing including DAX anti-patterns, memory analysis, and best practices
- [`connect-pbid` (pbi-desktop plugin)](../../pbi-desktop/skills/connect-pbid/) — PowerShell-based trace capture, performance profiling, EVALUATEANDLOG debugging
- [`lineage-analysis`](../lineage-analysis/) — Impact analysis before model changes (Tier 3/4)
