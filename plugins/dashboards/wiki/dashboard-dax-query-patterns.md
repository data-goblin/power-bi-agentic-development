---
title: DAX query shapes for dashboard visuals
summary: "One query per visual grain: KPI row, trend, TopN plus other, windows as rows and selection filters, adapted from an MIT upstream skill."
kind: recipe
status: current
sources:
  - url: https://learn.microsoft.com/en-us/dax/dax-queries
  - url: https://github.com/microsoft/rayfin/tree/main/samples/data-app/.agents/skills/dax-authoring
tools:
  te: 0.8.1.1
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - python3 plugins/dashboards/skills/querying-fabric/scripts/lint_dax.py plugins/dashboards/wiki/examples/kpi-row.dax plugins/dashboards/wiki/examples/trend.dax plugins/dashboards/wiki/examples/topn-other.dax plugins/dashboards/wiki/examples/windows.dax plugins/dashboards/wiki/examples/selection-filter.dax
skills: [dashboards/querying-fabric]
---

# DAX query shapes for dashboard visuals

[Learn: DAX queries](https://learn.microsoft.com/en-us/dax/dax-queries) covers `EVALUATE`, `DEFINE` and `ORDER BY`. The fuller upstream skill is `dax-authoring` in [microsoft/rayfin](https://github.com/microsoft/rayfin/tree/main/samples/data-app/.agents/skills/dax-authoring) (MIT). The shapes below were adapted from it for dashboards.

The example files pass `lint_dax.py`, which only checks the query rules in the skill. They were not run against a live model in this pass (Unverified): replace table, column and measure names with the target model's, and run each with `run_dax_query` or `te query --file`.

## One query per visual grain

Every measure for one visual goes in one query; a KPI row and a monthly trend are two queries. Return the model's measure names as result columns so every number traces to the model, and name filters and intermediate tables as `VAR`s so `EVALUATE` reads as one statement.

## KPI row

`examples/kpi-row.dax`: one row with value, target, variance and prior year in one `CALCULATETABLE ( ROW ( ... ), filter )`, so the measures share one filter context. The "current" period comes from `MAX` of the fact date, never a literal year.

## Trend

`examples/trend.dax`: the KPI by month with prior year and target.

- Start the window on the first day of a month: `EOMONTH ( _LastDate, -24 ) + 1`. `DATESINPERIOD ( ..., -24, MONTH )` starts on the same day of the month 24 months back, so the first point is a partial month that dips for no business reason
- The last point is usually a partial month: mark it ("month to date", a hollow point) so it does not read as a collapse
- Group by the sortable columns (`Year`, `Month Number`) next to the label (`Year Month`) so the dashboard sorts the axis without parsing text

## Ranked list with other

`examples/topn-other.dax`: the top members and one "Other" row. The total comes from the model (`EXCEPT ( ALL ( ... ), _TopNames )` inside `CALCULATE`), not from summing the top rows, so non-additive measures stay right. Both inputs of `UNION` need the same number of columns in the same order.

## Several periods as rows

`examples/windows.dax`: a `DATATABLE` of windows driven through `GENERATE`, one `CALCULATETABLE ( ROW ( ... ) )` per window. Details and the benchmark: [query benchmarks](dashboard-query-benchmarks.md).

## Selection filters

`examples/selection-filter.dax`: filters that do nothing when their parameter is empty; the parameter contract is in [crossfilter parameters](dashboard-crossfilter-parameters.md).

## Smaller points

- A detail table is `TOPN ( 50, _ByCustomer, [Total Sales], DESC )` over a `SUMMARIZECOLUMNS` variable, so the result stays small
- Dimension members that occur together without a measure: `SUMMARIZE` over the fact table inside `CALCULATETABLE`, not `SUMMARIZECOLUMNS`
- Members with no data: `FILTER ( VALUES ( 'Product'[Name] ), ISBLANK ( [Total Sales] ) )` uses the existing measure as the test
- A measure returning `BLANK` for empty groups is a feature: `+ 0` or `DIVIDE ( x, y, 0 )` makes `SUMMARIZECOLUMNS` return every combination
