---
name: querying-fabric
description: Use when building, extending or debugging a Claude Dashboard dataset, KPI card, chart or table on a Fabric or Power BI semantic model (or a Fabric SQL endpoint) through the Fabric connector tools such as run_dax_query, get_model_schema, list_models or run_sql_query, or when the user wants numbers "from Fabric", "from the model" or "from Power BI". Covers reusing model measures, the KPI value-target-trend contract, crossfilter parameters and query-shape rules.
---

# Querying Fabric for Claude Dashboards

The model's measures are the business's agreed definitions. A dashboard that reuses them shows the numbers every report on that model shows; one that recomputes them shows numbers that look right and quietly disagree. The job is mostly finding the right measures and slicing them well.

## Rules

1. **Reuse measures.** Every number comes from an existing model measure, referenced as `[Measure]`. No `DEFINE MEASURE` that re-implements business logic, no `SUM` of raw columns beside an existing measure, no ratio computed from two measures when the model has it, no averaging a ratio client-side.
2. **KPI contract.** Every KPI shows value, target and trend. The target comes from the model (budget, plan, goal, SLA, a "vs target" measure) or from the user, labelled as such; if there is none, compare with the prior period and label it "vs last year". Never invent a target or derive one from the data.
3. **Crossfilter through parameters.** Selections reach queries as `@name` parameters in `run_dax_query`'s `parameters`, never spliced into the query text ([crossfilter parameters](../../wiki/dashboard-crossfilter-parameters.md)).
4. **Read before writing.** Schema first, then queries; one query per visual grain ([query shapes](../../wiki/dashboard-dax-query-patterns.md)).
5. **Test every query with `run_dax_query` before the dashboard uses it**, with each parameter set and cleared, and compare one KPI with the unfiltered measure or a figure the user trusts.
6. **Do not format in DAX.** `FORMAT()` returns text that cannot be charted or sorted; return numbers.
7. **Derive "current" from the data** (`MAX` of the fact date or the model's date flags), never a hard-coded year or `DATE(...)` literal.

## Workflow

1. **Find the model.** `list_models`, or `find_items` with `types: ["SemanticModel"]`; `resolve_item` for a URL. Confirm with the user when dev, test and prod copies look alike.
2. **Read the schema.** `get_model_schema` with `part` `Measures`, then `Columns` and `Relationships` for the tables you slice by. Read descriptions, display folders, format strings and expressions. Look for data-quality columns (estimated, imputed, provisional, is-complete) and decide which rows count; apply that filter in every query or the dashboard averages fabricated rows.
3. **Pick the answer.** The measures, the target per KPI, the trend grain (the grain the business reviews, 12 to 24 periods) and the dimensions users will click.
4. **Write, lint, run.** Save each query to a `.dax` file; the plugin's hook lints it on write, or run `python3 <skill dir>/scripts/lint_dax.py queries/*.dax` (exit 1 on a warning, advice never fails). Then `run_dax_query` (`model`, `query`, `parameters`, `maxRows`, default 1000). Zero rows or a column of nulls usually means a missing selection or a filter on the wrong column.
5. **Benchmark when it matters**: `te query --file q.dax --runs 5` ([benchmarks](../../wiki/dashboard-query-benchmarks.md)).

Results are capped by `maxRows` and by some connectors' response size (both flagged `truncated: true`). Aggregate in DAX or use `TOPN` instead of raising the cap. Queries run as the signed-in user, so row-level security applies and two users can see different numbers.

## Measures that need a selection

Many enterprise models return BLANK unless a slicer table has one value selected (reporting currency, value unit, scenario); their expressions start with `HASONEVALUE`, `SELECTEDVALUE` or `IF.EAGER ( HASONEVALUE ( ... ) )`. A measure like `MAX ( 'Exchange Rate'[Rate] )` instead returns a number several times too high with no selection and no warning.

- Read the expression and description of every measure you use, and look for disconnected tables (`Selected Unit`, `Exchange Rate`, `Selected Period`)
- Pass the selection as a filter such as `TREATAS ( { "EUR" }, 'Exchange Rate'[Currency] )` and show the choice in the dashboard (a switch or a label)
- Ask the user for the default when the model documents none
- `get_model_schema` returns empty expressions when the user may not read them: rely on names, descriptions and format strings, and test the measure at a known grain first

When the model lacks a needed metric, say so, name the closest measures and suggest adding it to the model. Only if the user still wants it in the dashboard, compute it from existing measures and label it a dashboard-only calculation.

## Query-shape rules (benchmarked once)

These come from one small Direct Lake benchmark; treat them as defaults to test, not laws. `lint_dax.py` reports them as warnings or advice.

```yaml
one context:   all measures for a visual in ONE filter context: SUMMARIZECOLUMNS, or CALCULATETABLE ( ROW ( ... ), filters ); not CALCULATE per column with the filter repeated
windows:       several periods (7/30/90 days, YTD vs PY) are rows: GENERATE over a DATATABLE of windows
column filters: filter columns with TREATAS or a column predicate rather than FILTER ( 'Table', ... ) over a whole table
iterators:     avoid X-iterators and COUNTROWS ( FILTER ( ... ) ) over fact rows where a measure exists; over a small dimension they are fine
blanks:        let measures return BLANK; + 0 or DIVIDE ( x, y, 0 ) makes SUMMARIZECOLUMNS return every combination
```

## Lakehouses and warehouses

For data that lives only in a warehouse, lakehouse SQL endpoint or SQL database use `get_sql_schema` and `run_sql_query` (one read-only `SELECT`, parameters as `@name`). There are no measures: reuse the views and columns the data owners publish (a `gold` or reporting schema), and ask whether a semantic model already covers the question; it is the better dashboard source because its definitions are shared.

## Troubleshooting

```yaml
model not found:            list_models with part of the name; use workspace/model to disambiguate
blank KPI or empty result:  the measure needs a slicer selection, or a filter hits a column with no matching values
numbers differ from report: the query re-aggregates raw columns or misses a filter the report applies (page, report, slicer default)
every combination returned: a measure in the query never returns BLANK (+ 0, COALESCE, DIVIDE with 0)
time intelligence wrong:    no date context in the query, or the model's date table is not marked
```

Upstream reference for DAX authoring: `dax-authoring` in [microsoft/rayfin](https://github.com/microsoft/rayfin/tree/main/samples/data-app/.agents/skills/dax-authoring) (MIT); attribution in `ATTRIBUTIONS.md`.
