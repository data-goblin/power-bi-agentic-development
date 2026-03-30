# Report Performance Analysis

Reference for evaluating Power BI report performance through load time metrics, visual complexity analysis, and query inference from report metadata.

## Load Time Metrics

### Percentiles Explained

| Metric | Meaning | Target | Investigate |
|---|---|---|---|
| P10 | 90% of loads were slower than this (fastest 10%) | <1s | -- |
| P50 (median) | Half of loads were faster, half slower | <3s | >5s |
| P90 | Only 10% of loads were slower (slowest 10%) | <8s | >15s |

**P50** is the typical user experience. **P90** reveals the worst-case experience for the slowest 10% of users -- often caused by slow networks, mobile devices, complex filter states, or cold cache.

A large P50-to-P90 gap indicates inconsistent performance. Investigate:
- Geographic distribution (users far from the data region)
- Browser/device variation (mobile vs desktop)
- Filter-dependent query complexity (some slicer combinations produce expensive queries)
- Cache miss patterns (first view after refresh vs subsequent views)

### Retrieving Load Times

Load time data comes from the WABI `reportloads` endpoint (Tier 1, workspace Viewer role):

```bash
python3 scripts/get_report_usage.py -w <workspace-id>
python3 scripts/get_report_detail.py -w <workspace-id> -r <report-id>
```

The `reportloads` endpoint returns `StartTime` and `EndTime` per load event. Load time in seconds = `EndTime - StartTime`. Fields include `LocationCity`, `LocationCountry`, `DeviceBrowserVersion`, and `Client` for diagnosing environment-specific slowness.

For the pre-computed percentile DAX measures (P-10, P-50, P-90, P-25, 7-day variants), generate the Usage Metrics Model (Tier 2, workspace Contributor+). See `references/usage-metrics.md`.

## Performance Audit Script

Use `scripts/performance_audit.py` to audit a single report's performance:

```bash
# Performance audit for a report
python3 scripts/performance_audit.py -w <workspace-id> -r <report-id>

# JSON output
python3 scripts/performance_audit.py -w <workspace-id> -r <report-id> --output json
```

The script collects load time metrics and analyzes the report definition for visual complexity indicators.

## Visual Complexity Analysis

Performance problems in Power BI reports are almost always caused by what the visuals ask the semantic model to compute. Analyze the report definition to identify complexity hotspots.

### Complexity Indicators

| Indicator | How to Check | Impact |
|---|---|---|
| Visual count per page | Count `visual.json` files per page directory | Each visual generates a separate DAX query |
| Field count per visual | Count projections in `visual.query.queryState` | More fields = wider query, more computation |
| Grouping column count | Count Column projections in grouping roles (Category, Rows, Series) | Grouping columns multiply cardinality exponentially |
| Extension measures | Check `reportExtensions.json` for measure definitions | Complex DAX in extension measures evaluates per data point |
| Conditional formatting | Check `objects` for rules, gradients, or measure-driven fill/color | Conditional formatting adds overhead to visual queries; measure-driven formatting adds extra query columns, but even rule-based and gradient formatting increases rendering cost |
| Tooltip pages | Check for pages with `type: "Tooltip"` | Tooltip pages execute additional queries on hover |
| Cross-filtering | Check `drillFilterOtherVisuals` in visual config | Cross-filtering chains cause cascading re-queries |

### Reading Visual Field Bindings

Each visual's query is defined in `visual.json` under `visual.query.queryState`. The structure maps directly to the DAX query Power BI generates:

**Field binding structure:**
```
visual.query.queryState
  .<RoleName>                    -- Category, Y, Values, Rows, Columns, Series, etc.
    .projections[]
      .field
        .Column|Measure          -- Dimension or measure reference
          .Expression.SourceRef
            .Entity              -- Table name
            .Schema              -- "extension" if report-level measure
          .Property              -- Column/measure name
      .queryRef                  -- "Table.Field" fully qualified reference
```

**Role names vary by visual type:**

| Visual Type | Grouping Roles | Measure Roles |
|---|---|---|
| lineChart, barChart, columnChart, areaChart | Category, Series | Y (Y2 for combo) |
| tableEx | Values (both dims and measures) | Values |
| pivotTable (matrix) | Rows, Columns | Values |
| card, cardVisual | -- | Values / Data |
| scatterChart | Category | X, Y, Size |
| slicer | Values | -- |

### Inferring DAX Queries from Visual Metadata

Power BI translates each visual's field bindings into a `SUMMARIZECOLUMNS` query. Understanding this mapping reveals which visuals generate expensive queries.

**Base pattern:**
```dax
EVALUATE
SUMMARIZECOLUMNS(
    'Table1'[GroupingColumn1],              -- From Category/Rows role
    'Table2'[GroupingColumn2],              -- From Series/Columns role
    "Measure1_Alias", 'Table'[Measure1],   -- From Y/Values role
    "Measure2_Alias", 'Table'[Measure2]
)
```

**To construct the query for a visual:**
1. Collect all Column-type projections from grouping roles -- these become the first arguments to SUMMARIZECOLUMNS
2. Collect all Measure-type projections from measure roles -- these become `"alias", Table[Measure]` pairs
3. Check `reportExtensions.json` for extension measure definitions -- these may need a DEFINE block
4. Check `objects` for conditional formatting using measures -- these add hidden query columns

**Example:** A bar chart with `Category: Date[Month]`, `Y: Sales[Revenue], Sales[Margin %]` generates:
```dax
EVALUATE
SUMMARIZECOLUMNS(
    'Date'[Month],
    "Revenue", 'Sales'[Revenue],
    "Margin", 'Sales'[Margin %]
)
```

### Hidden Query Overhead

Not all DAX computation is visible in the visual's field wells. Additional query columns are generated by:

1. **Conditional formatting** -- All forms of conditional formatting add overhead. Measure-driven formatting (where `objects.dataPoint.fill` references a measure via `expr.Measure`) is the most expensive because it adds extra query columns evaluated per data point. Rule-based formatting and gradient fills are lighter but still increase rendering cost, especially on visuals with many data points.

2. **Tooltip fields** -- Custom tooltips may bind additional measures not shown in the main visual.

3. **Sort-by-column** -- If a column has a `sortByColumn` property in the model, the sort column is automatically added to the query even though it isn't displayed.

4. **Data labels** -- Dynamic data label formats or values may add measure evaluations.

### Using DAX Queries for Performance Diagnosis

To identify which visual causes performance bottlenecks:

1. **Extract field bindings** from each visual's `visual.json`
2. **Construct the equivalent SUMMARIZECOLUMNS query** using the pattern above
3. **Execute each query** against the semantic model using the `executeQueries` API or DAX Studio
4. **Measure execution time** per query
5. **Rank visuals** by query cost

```bash
# Execute a DAX query against the model
fab api -A powerbi "groups/{wsId}/datasets/{datasetId}/executeQueries" \
  -X post -i '{"queries":[{"query":"EVALUATE SUMMARIZECOLUMNS(...)"}]}'
```

The most expensive queries reveal the visuals that need optimization. Common fixes:
- Reduce grouping columns or filter the data (page or report filters) (fewer dimensions = smaller result set)
- Simplify or remove conditional formatting where not essential
- Avoid or remove custom visuals that are overly-complex
- Audit the DAX and semantic model for issues there (see the semantic-models plugin and related skills like `review-semantic-model`)
