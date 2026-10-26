---
name: querying-fabric
description: >
  Query Microsoft Fabric and Power BI semantic models with DAX (and Fabric SQL endpoints with T-SQL) to feed a
  Claude Dashboard or any dashboard built from a Fabric connector or MCP server. Use this skill whenever you
  build, extend or debug a dashboard, KPI card, chart or table on top of a semantic model, call a tool like
  run_dax_query, get_model_schema or list_models, or the user asks for numbers "from Fabric", "from the model"
  or "from Power BI", even if they never say DAX. Covers reusing the model's measures instead of writing new
  ones, KPI design with a target and a trend, crossfiltering between visuals, DAX query syntax and time
  intelligence, and an execute-inspect-fix test loop.
---

# Querying Fabric for Claude Dashboards

A dashboard is only as trustworthy as its queries. The semantic model already holds the business's agreed
definitions of its metrics: the measures. A dashboard that reuses them shows the same numbers as every Power BI
report on that model; a dashboard that recomputes them shows numbers that look right and quietly disagree.
So the work here is mostly finding the right measures and slicing them well, not writing DAX formulas.

Three rules shape every dashboard this skill builds:

```yaml
reuse measures:  every number comes from an existing model measure; no new measure logic in the queries
kpi contract:    every KPI shows its value, a target, and a trend
crossfiltering:  selecting a mark in one visual filters every other visual
```

## Workflow

1. **Find the model.** `list_models` or `find_items` (type `SemanticModel`); `resolve_item` for a URL. Confirm
   the model with the user when several look alike (dev, test and prod copies are common).
2. **Read the schema before writing any query.** `get_model_schema` with part `Measures`, then `Columns` and
   `Relationships` for the tables you will slice by. Read measure descriptions, display folders, format strings
   and expressions. See [Reusing the model's measures](#reusing-the-models-measures). Look for data-quality
   columns too (estimated, imputed, provisional, source, is-complete flags): decide which rows count and apply
   that filter to every query, or the dashboard averages fabricated rows.
3. **Answer one business question.** Pick the measures that answer it, the target each KPI is judged against,
   the date grain of its trend, and the dimensions the user will click to crossfilter.
4. **Write one query per visual grain.** One `EVALUATE` per visual; see
   [references/dax-query-patterns.md](./references/dax-query-patterns.md).
5. **Test every query** with `run_dax_query` before the dashboard uses it. See [Testing](#testing-and-iteration).
6. **Wire crossfiltering** through query parameters; see [references/crossfiltering.md](./references/crossfiltering.md).
7. **Check the numbers against a known total.** Compare one KPI against the same measure with no filters, or
   against a figure the user already trusts from a report. A dashboard that is wrong by a filter is worse than
   no dashboard.

## Reusing the model's measures

Measures are the governed definitions. Use them by name, `[Measure]`, and let the dashboard decide only *how
the measure is sliced*: which columns group it, which filters apply, which period it covers.

```yaml
do:
  - reference model measures directly: "Turnover", [Turnover]
  - prefer an existing variant over deriving one: use [Turnover 1YP] or [Budget YTD] when the model has them
  - shift or filter an existing measure when no variant exists: CALCULATE([Turnover], DATEADD('Date'[Date], -1, YEAR))
  - keep the model's format strings (FormatString or FormatStringDefinition in the schema) for display
avoid:
  - re-aggregating raw columns when a measure exists: SUM('Sales'[Amount]) next to an existing [Total Sales]
  - DEFINE MEASURE blocks that re-implement business logic (margins, rates, OTD %, conversions)
  - ratios computed in the dashboard from two measures when the model has the ratio measure
  - averaging or summing a ratio measure client-side; ask the model for the ratio at the grain you need
```

Why this matters: a model's `[Turnover]` may add surcharges, subtract fees and convert currency; a
`SUM('Invoices'[Net Value])` returns a plausible figure that matches no report. Users notice when two tools
disagree, and they stop trusting both.

When the question needs a metric the model does not have:

1. Say so plainly, and name the closest existing measures.
2. Suggest adding the measure to the model, where the model owner can review it and every report can share it.
3. Only if the user wants it in the dashboard anyway, compute it from existing measures (never from raw
   columns when a measure covers them), and label it in the dashboard as a dashboard-only calculation.

### Measures that need a selection

Many enterprise models have measures that return BLANK unless a slicer table has one value selected: a
reporting currency, a value unit, a selected metric or period. Their expressions start with `HASONEVALUE`,
`SELECTEDVALUE` or `IF.EAGER(HASONEVALUE(...))`, and good models say so in the description. A dashboard that
ignores this shows empty cards. Worse, a measure that reads `MAX ( 'Exchange Rate'[Rate] )` or sums across a
currency table returns a number with no selection, just the wrong one: several times too high, with nothing to
say so.

- Read the expression and description of every measure you use, and look for disconnected tables (tables with
  no relationships, often named like `Selected Unit`, `Exchange Rate`, `Selected Period`)
- Pass the selection as a filter, e.g. `TREATAS({"EUR"}, 'Exchange Rate'[Currency])`, and show that choice
  in the dashboard (a currency switch, or a label stating the currency)
- Ask the user which default to use when the model does not document one

### When expressions are hidden

`get_model_schema` returns empty expressions when the user may not read them. Rely on names, descriptions,
display folders and format strings, and test the measure at a known grain before relying on it.

## The KPI contract: value, target, trend

A number on its own does not tell anyone whether to act. Every KPI in the dashboard carries three things:

```yaml
value:   the measure for the selected period and filters
target:  what the value is judged against, from the model, with the variance to it
trend:   the same measure over time, so the reader sees direction, not just position
```

Read [references/kpi-design.md](./references/kpi-design.md) for finding targets, choosing the trend grain and
the query shapes. The short version:

- **Target from the model first:** budget, plan, goal, target, forecast or SLA measures, or a "vs target"
  measure already in the model. Use the model's variance measures (`[Budget vs. Turnover (%)]`) when they exist
- **No target in the model:** ask the user for one and show it as a stated target ("Target 95%, set by the
  user"), or fall back to a prior-period comparison and label it as such. Never invent a target
- **Trend:** the KPI measure by month (or the grain the business reviews) over enough history to see a
  pattern, typically 12 to 24 periods, with the same period last year where it helps

## Crossfiltering

Every visual is also a filter. Clicking a bar, a row or a point sets a selection, and every other visual
re-queries with that selection applied; clicking again clears it. This is what makes a dashboard an analysis
tool rather than a poster.

- Keep one selection state for the whole dashboard, keyed by model column (`'Customers'[Key Account]`)
- Pass the selection into each query as parameters (`@account`) and apply it with a filter that is a no-op when
  nothing is selected
- Re-query rather than filter client-side whenever the visual shows a ratio, a distinct count or any
  non-additive measure; only the model can compute those correctly for a subset
- The visual that owns a selection keeps showing all its members and highlights the selected one, so the user
  can see what they clicked and change it
- Show active selections in one place with a way to clear them

Read [references/crossfiltering.md](./references/crossfiltering.md) for the tested DAX patterns.

## Writing DAX queries

Query rules that prevent most errors:

```yaml
references:  columns fully qualified with quoted table names, 'Table'[Column]; measures unqualified, [Measure]
evaluate:    EVALUATE takes a table expression; wrap scalars in ROW(...)
define:      one DEFINE block; VAR and MEASURE separated by new lines, no commas
grouping:    SUMMARIZECOLUMNS(group-by columns, then filter tables, then "Name", [Measure] pairs)
filters:     filter arguments to SUMMARIZECOLUMNS are tables: TREATAS({...}, 'T'[C]) or FILTER(ALL('T'[C]), ...)
ordering:    ORDER BY for any multi-row result, so results are stable between runs
no sql:      no SELECT, WHERE, HAVING or method chaining inside DAX
blanks:      let measures return BLANK; adding + 0 or DIVIDE(x, y, 0) makes SUMMARIZECOLUMNS return every combination
dates:       derive "current" periods from the data (MAX of the fact date) or the model's date flags, not hard-coded years
formatting:  return raw numbers and format in the dashboard; FORMAT() turns numbers into text that cannot be charted or sorted
```

A typical dashboard query:

```dax
DEFINE
    VAR _Region = TREATAS ( { "EMEA" }, 'Geography'[Region] )
    VAR _Years = TREATAS ( { 2024, 2025 }, 'Date'[Year] )

EVALUATE
    SUMMARIZECOLUMNS (
        'Date'[Year],
        'Date'[Month Number],
        _Region,
        _Years,
        "Total Sales", [Total Sales],
        "Total Sales PY", [Total Sales PY],
        "Sales Target", [Sales Target]
    )
ORDER BY 'Date'[Year], 'Date'[Month Number]
```

Every column in it is a model measure; the query only decides the grain and the filters.

Query rules that keep queries small and fast. They are checked: a query that breaks one is rewritten before
the dashboard uses it.

```yaml
one context:  all measures for one visual are evaluated in ONE filter context: SUMMARIZECOLUMNS, or
              CALCULATETABLE ( ROW ( ... ), filters ); never CALCULATE ( [m], filters ) once per column, and
              never ADDCOLUMNS ( table, "a", CALCULATE ( ... ), "b", CALCULATE ( ... ) ) with the filter repeated
windows:      several periods (7/30/90 days, YTD vs PY) are rows: GENERATE over a DATATABLE of windows, below
no FILTER:    never FILTER ( 'Table', ... ) over a whole table, in a VAR or anywhere else; filter columns with
              TREATAS or a column predicate ('T'[Flag] = FALSE, 'T'[Date] >= _From)
no iterating: no AVERAGEX / MEDIANX / COUNTROWS ( FILTER ( ... ) ) / GROUPBY ( CURRENTGROUP ) over fact rows;
              buckets (price bands, order-size bands) are a column or a DATATABLE of bands with the measures
              evaluated per band, like windows
no dates:     no DATE ( 2025, ... ) literals; every boundary derives from _Last = MAX of the fact date
```

```dax
DEFINE
    VAR _Valid = TREATAS ( { FALSE }, 'Fact'[Is Provisional] )
    VAR _Last = CALCULATE ( MAX ( 'Fact'[Date] ), _Valid )
    VAR _Windows = DATATABLE ( "Window", STRING, "Days", INTEGER, { { "7d", 7 }, { "30d", 30 }, { "90d", 90 } } )

EVALUATE
    GENERATE (
        _Windows,
        CALCULATETABLE (
            ROW ( "Average", [Average Value], "Target Rate", [Target Rate], "Days", [Days] ),
            DATESBETWEEN ( 'Date'[Date], _Last - [Days] + 1, _Last ),
            _Valid
        )
    )
ORDER BY [Days]
```

On the test model this shape returned the same numbers as the copied-block version in 62 ms instead of 109,
with 35 storage-engine queries instead of 87.

Read [references/query-performance.md](./references/query-performance.md) for the measured before-and-after
of each rule and how to benchmark a query with `te query --runs`.

References, read when you need them:

- [references/query-performance.md](./references/query-performance.md): fewer storage-engine scans, the
  windows pattern, benchmarking
- [references/dax-query-patterns.md](./references/dax-query-patterns.md): query structure, worked patterns for
  dashboard visuals (KPI row, trend, ranked list, TopN with "other", small multiples), anti-patterns
- [references/dax-core-reference.md](./references/dax-core-reference.md): CALCULATE filter arguments,
  SUMMARIZECOLUMNS, TREATAS, ALL and ALLEXCEPT, BLANK semantics, common syntax mistakes
- [references/dax-time-intelligence.md](./references/dax-time-intelligence.md): trends, prior year, YTD, rolling
  windows, and establishing date context inside a query
- [references/kpi-design.md](./references/kpi-design.md): targets, variance and trend queries per KPI
- [references/crossfiltering.md](./references/crossfiltering.md): selection state, parameterised filters,
  multi-select, and which visuals re-query

## Lakehouses and warehouses

When the data lives only in a warehouse, lakehouse SQL endpoint or SQL database, use `get_sql_schema` and
`run_sql_query` (one read-only `SELECT`, parameters as `@name`). There are no measures there, so the
measure-reuse rule becomes: reuse the views and columns the data owners publish (a `gold` or reporting schema)
before writing aggregations, and ask whether a semantic model already covers the question. A semantic model,
when one exists, is the better source for a dashboard because its definitions are shared.

## Testing and iteration

1. Write the query
2. Run it with `run_dax_query` (`model`, `query`, `parameters`, `maxRows`)
3. Inspect column names, types, row count and the values themselves; a row count of 0 or a column of nulls
   usually means a missing selection (see [Measures that need a selection](#measures-that-need-a-selection)) or
   a filter on the wrong column
4. On an error, check the syntax rules above and [references/dax-core-reference.md](./references/dax-core-reference.md)
5. Re-run with each crossfilter parameter set and cleared, so both states are known to work

Results are capped by `maxRows` (1000 by default), and some connectors also cut a response by its size, so a
wide result can stop short of `maxRows`; both are flagged with `truncated: true`. A dashboard visual rarely
needs that many rows: aggregate in DAX to the visual's grain, or use TOPN, rather than raising the cap. Queries
run as the signed-in user, so row-level security applies; two users can see different numbers, which is
correct.

## Troubleshooting

```yaml
model not found:            list_models with part of the name; use workspace/model to disambiguate
blank KPI or empty result:  measure needs a slicer selection, or a filter hits a column with no matching values
numbers differ from report: query re-aggregates raw columns, or misses a filter the report applies (page, report
                            or slicer default); compare against the report's filters
every combination returned: a measure in the query never returns BLANK (+ 0, COALESCE, DIVIDE with 0)
time intelligence wrong:    no date context in the query, or the model's date table is not marked; see
                            references/dax-time-intelligence.md
syntax error near VAR:      commas between VARs, or a second DEFINE
```
