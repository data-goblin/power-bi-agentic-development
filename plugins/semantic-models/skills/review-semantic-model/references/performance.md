# Semantic Model Performance

Methodology and guidance for evaluating semantic model performance: memory analysis, query optimization, unused column detection, and benchmarking.

## Performance Analysis Tools

| Tool | What It Provides | When to Use |
|---|---|---|
| **Tabular Editor 3 - VertiPaq Analyzer** | Per-column memory footprint, dictionary sizes, encoding types, cardinality | First step for any memory/size investigation |
| **Tabular Editor 3 - Best Practice Analyzer** | Rule-based structural checks against configurable BPA rules | Automated detection of anti-patterns and design issues |
| **DAX Studio** | Server timings, VertiPaq scan statistics, query plans, xmSQL | Diagnosing slow individual DAX queries |
| **Performance Analyzer (Power BI Desktop)** | Per-visual query timing in a report context | Identifying which report visuals cause bottlenecks |
| **Workspace Monitoring (Fabric)** | Historical query logs, trace events in KQL database | Ongoing production monitoring |

### Recommended Workflow

1. Run **VertiPaq Analyzer** in Tabular Editor to identify memory hotspots (large dictionaries, high-cardinality columns)
2. Run **Best Practice Analyzer** in Tabular Editor with an appropriate rule set to catch structural issues
3. Use **DAX Studio** to test specific slow queries with server timings enabled
4. Use **Performance Analyzer** in Power BI Desktop to identify which report visuals generate the most expensive queries
5. For production monitoring, enable **Workspace Monitoring** and deploy the monitoring dashboards from microsoft/fabric-toolbox

## Memory and Size Analysis

### What to Look For

- **Total model size** relative to capacity SKU; large models increase refresh time and memory pressure
- **Column cardinality**; high distinct-value counts (GUIDs, transaction IDs, composite keys) inflate dictionary size and hurt query performance
- **DateTime columns**; combined DateTime columns create near-unique cardinality with massive dictionaries; split into separate Date and Time columns
- **Text column average length**; long text values increase dictionary size
- **Unused columns**; columns not referenced by any measure or visual waste memory and slow refresh

### Unused Column Detection

Unused columns waste memory and slow refresh without contributing to any report or measure. Detection approaches:

**Via TMDL analysis (static):** Grep all `.tmdl` files for column references in measures, calculated columns, and relationships. Columns not referenced anywhere are candidates for removal. Caveat: this misses references from report visual bindings.

**Via Workspace Monitoring (runtime):** Query logs reveal which columns are actually scanned during queries. Columns never scanned over a sustained period are candidates for removal.

**Via SemanticModelAudit (automated):** The [SemanticModelAudit](https://github.com/microsoft/fabric-toolbox/tree/main/tools/SemanticModelAudit) notebook in microsoft/fabric-toolbox automates unused column detection for Direct Lake models by comparing Delta table schemas with model columns.

### Common Memory Optimization Patterns

- Remove or hide unnecessary columns (especially GUIDs, composite keys, transaction IDs)
- Split DateTime columns into separate Date and Time columns
- Disable Auto Date/Time tables (hidden `LocalDateTable_*` bloating memory)
- Disable attribute hierarchies (`IsAvailableInMDX`) on hidden or high-cardinality columns
- Replace calculated columns with Power Query computed columns where possible
- Reduce text column precision (trim, truncate long descriptions)
- Use appropriate data types (Integer instead of Double for whole numbers)

## DAX Query Performance

### Cache States

DAX query performance depends heavily on cache state. Always specify which state was measured.

| Cache State | What It Means | How to Achieve |
|---|---|---|
| **Cold** | No data in memory; everything must be loaded from disk | Pause/resume capacity (Import), clearValues refresh (Direct Lake) |
| **Warm** | Data framed in memory but VertiPaq cache cleared | Run a priming query, then clear VertiPaq cache via `CALL [ClearCache]` in DAX Studio |
| **Hot** | Data and VertiPaq cache both populated | Run the query twice; second run is hot |

**Always test with warm or hot cache** for typical user experience. Cold cache represents worst-case (first user after refresh or capacity resume).

### Testing Methodology

1. Run each query 3+ times per cache state (ideally 10+)
2. Measure in the Power BI service, not locally (local doesn't reflect production capacity)
3. Use DAX Studio server timings to separate Storage Engine (SE) from Formula Engine (FE) time
4. A single test yields misleading conclusions -- always use multiple iterations
5. Compare before/after when making optimization changes under controlled conditions

### Common DAX Performance Issues

| Pattern | Why It's Slow | Fix |
|---|---|---|
| Nested CALCULATE with complex filters | Multiple context transitions | Simplify; use variables to cache intermediate results |
| SUMX/AVERAGEX over large unfiltered tables | Row-by-row evaluation | Add filters to reduce iteration scope; consider pre-aggregation |
| Division without DIVIDE() | Error propagation | Use DIVIDE(numerator, denominator, 0) |
| ALL() instead of REMOVEFILTERS() | Semantic ambiguity; can override intended filters | Use REMOVEFILTERS() for explicit filter removal |
| Calculated columns with complex DAX | Evaluated during refresh for every row | Move to Power Query; use measures instead where possible |
| High-cardinality DISTINCTCOUNT | Full dictionary scan | Consider approximate DISTINCTCOUNT or pre-aggregation |

## Benchmarking DAX Queries

For systematic benchmarking across multiple queries and cache states, consider the [DAXPerformanceTesting](https://github.com/microsoft/fabric-toolbox/tree/main/tools/DAXPerformanceTesting) notebook from microsoft/fabric-toolbox. It automates cache clearing, capacity management, and trace capture for reliable comparisons.

For AI-assisted query optimization, consider the [DAXPerformanceTunerMCPServer](https://github.com/microsoft/fabric-toolbox/tree/main/tools/DAXPerformanceTunerMCPServer) which identifies anti-patterns and suggests optimizations with semantic equivalence checking.

## Performance Targets

There are no universal performance targets -- always consider targets from the consumer's perspective. Generally aim for sub-second queries for visuals.

Performance targets should be documented and communicated to model developers. Consider including them as prerequisites for endorsing (certifying) models.
