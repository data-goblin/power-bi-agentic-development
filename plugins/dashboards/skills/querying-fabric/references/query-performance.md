# Query performance

A dashboard query is fast when the storage engine (SE) answers it in a few scans and the formula engine (FE)
has little left to do. Most slow dashboard queries are slow for one reason: the same measure is asked for many
times under slightly different filters, and each request becomes its own scan.

## Contents

- Benchmarking a query
- Many periods: windows as rows
- Repeated filters
- Filtering columns, not tables
- Iterating fact rows
- Checklist

## Benchmarking a query

Run each query several times and read the median, the FE/SE split and the SE query count:

```bash
te -s <workspace> -d "<model>" --non-interactive query --file q.dax --runs 5 --output-format json --limit 1
```

```yaml
total median:   what the user waits for; compare against the run-to-run noise before calling a change a win
se queries:     scans the engine needed; the best predictor of how the query scales with data
fe time:        work the engine did row by row; high FE with few SE queries points to iterators or callbacks
result:         run the old and new query to CSV and diff them; a faster query with different numbers is a bug
```

The first run of a Direct Lake model pages columns in from OneLake; ignore it. te uses the XMLA endpoint, which
rejects some query syntax the Fabric MCP accepts (`DEFINE COLUMN`); keep queries to `VAR`, `MEASURE` and
`EVALUATE` so both run them.

## Many periods: windows as rows

A summary of the last 30 days, last 90 days and all time is one table with a row per window. Do not write a copied
block per window.

```dax
// Slow: 3 ROWs x 8 columns, each its own CALCULATE with the same window repeated (109 ms, 87 SE queries)
EVALUATE
    UNION (
        ROW ( "Window", "30d",
              "Total Sales", CALCULATE ( [Total Sales], DATESBETWEEN ( 'Date'[Date], _Last - 29, _Last ), _Final ),
              "Margin %", CALCULATE ( [Gross Margin %], DATESBETWEEN ( 'Date'[Date], _Last - 29, _Last ), _Final ),
              ... ),
        ROW ( "Window", "90d", ... ),
        ROW ( "Window", "All", ... )
    )
```

```dax
// Fast: one windows table, one CALCULATETABLE per window (62 ms, 35 SE queries, identical numbers)
DEFINE
    VAR _Final = TREATAS ( { FALSE }, 'Sales'[Is Provisional] )
    VAR _Last = CALCULATE ( MAX ( 'Sales'[OrderDate] ), _Final )
    VAR _Windows = DATATABLE ( "Window", STRING, "Days", INTEGER, { { "30d", 30 }, { "90d", 90 }, { "All", 100000 } } )

EVALUATE
    GENERATE (
        _Windows,
        CALCULATETABLE (
            ROW (
                "Total Sales", [Total Sales],
                "Gross Margin %", [Gross Margin %],
                "Sales vs Target %", [Sales vs Target %],
                "Orders", [Order Count]
            ),
            DATESBETWEEN ( 'Date'[Date], _Last - [Days] + 1, _Last ),
            _Final
        )
    )
ORDER BY [Days]
```

The measures inside one `ROW` share a filter context, so the engine fuses them into a few scans. Measured on a
small Direct Lake model; the gap grows with the fact table.

Periods that line up with the date table (years, months, quarters) need no windows table at all: group by the
date column in `SUMMARIZECOLUMNS`.

## Repeated filters

A filter written into every column is applied, parsed and planned once per column. Write it once:

```yaml
whole query:     a VAR filter table passed as a SUMMARIZECOLUMNS filter argument
a block of KPIs: CALCULATETABLE ( ROW ( ... ), filter ), not CALCULATE ( [m], filter ) per column
```

## Filtering columns, not tables

`FILTER ( 'Fact', ... )` materializes every row of the fact table with all its columns, then tests each one in
the FE. A column filter becomes a predicate inside the SE scan.

```dax
// Slow
CALCULATETABLE ( ..., FILTER ( 'Sales', 'Sales'[Is Provisional] <> TRUE ) )

// Fast
CALCULATETABLE ( ..., TREATAS ( { FALSE }, 'Sales'[Is Provisional] ) )
CALCULATETABLE ( ..., 'Sales'[Is Provisional] = FALSE )
```

Use `KEEPFILTERS` when the filter must intersect a filter the dashboard already applies rather than replace it.

## Iterating fact rows

`AVERAGEX ( FILTER ( _Rows, ... ), 'Fact'[Col] )` recomputes what a measure already holds, row by row, and drifts
from the model's definition. When a statistic has no measure (a median, a percentile), compute it once per
grain with the plain aggregate (`MEDIAN ( 'Fact'[Col] )`) inside the same `CALCULATETABLE` as the measures, and
label it as a dashboard-only calculation.

A daily series is `SUMMARIZECOLUMNS ( 'Date'[Date], "Total Sales", [Total Sales] )`, not `SELECTCOLUMNS` over
the fact table: it reuses the measure, drops empty days, and returns one row per day even when the fact has
several.

## Checklist

```yaml
- one query per visual, every measure for that visual in it
- no filter expression written twice
- no FILTER over a table; no X-iterator over fact rows where a measure exists
- periods as rows of a windows table or a date column, never copied blocks
- data-quality filter (estimated, imputed, provisional rows) applied in every query that needs it
- benchmarked with te query --runs 5, result diffed against the previous version
```
