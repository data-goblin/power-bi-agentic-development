---
title: Benchmarking dashboard queries and one measured result
summary: How to time a DAX query with te query --runs, and a single small-model benchmark for windows as rows, column filters and one filter context.
kind: gotcha
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
  - te query --help
  - python3 plugins/dashboards/skills/querying-fabric/scripts/lint_dax.py plugins/dashboards/wiki/examples/windows.dax
skills: [dashboards/querying-fabric]
---

# Benchmarking dashboard queries

## Measure, do not assume

```bash
te -s <workspace> -d "<model>" --non-interactive query --file q.dax --runs 5 --output-format json --limit 1
```

`--runs` implies `--trace --cold`, so each run starts from a cold cache. Read the median, the formula-engine (FE) and storage-engine (SE) split and the SE query count:

```yaml
total median:  what the user waits for; compare with run-to-run noise before claiming a win
se queries:    scans the engine needed; the best predictor of how the query scales
fe time:       row-by-row work; high FE with few SE queries points at iterators or callbacks
result:        run old and new to CSV and diff; a faster query with different numbers is a bug
```

The first run on a Direct Lake model pages columns in from OneLake: ignore it. `te` goes through the XMLA endpoint, which can reject syntax the Fabric MCP accepts (`DEFINE COLUMN`), so keep queries to `VAR`, `MEASURE` and `EVALUATE` and both clients run them.

## One result, one model

Three heuristics from the skill were benchmarked on a single small Direct Lake model, not across models or modes. Treat them as defaults to test, not laws.

```yaml
windows as rows:  8 measures over 3 windows as UNION of ROW blocks, each column its own CALCULATE: 109 ms, 87 SE queries
                  one DATATABLE of windows with GENERATE and one CALCULATETABLE ( ROW ( ... ) ) per window: 62 ms, 35 SE queries, identical numbers
column filters:   FILTER ( 'Fact', ... ) materialises the fact rows and tests them in the FE; TREATAS ( { FALSE }, 'Fact'[Flag] ) or 'Fact'[Flag] = FALSE becomes an SE predicate
repeated filter:  write a filter once (VAR, or one CALCULATETABLE) instead of once per column
```

The measures inside one `ROW` share a filter context, so the engine fuses them into a few scans; the gap grows with the fact table. Periods that match the date table (years, months, quarters) need no windows table: group by the date column in `SUMMARIZECOLUMNS`. Use `KEEPFILTERS` when a filter must intersect an existing dashboard filter instead of replacing it.

## Iterating fact rows

`AVERAGEX ( FILTER ( _Rows, ... ), 'Fact'[Col] )` recomputes what a measure already holds and drifts from the model's definition. When a statistic has no measure (median, percentile), compute it once per grain with the plain aggregate inside the same `CALCULATETABLE` as the measures and label it as a dashboard-only calculation. Iterating a small dimension is fine; `lint_dax.py` reports iterators as advice for that reason.

## Checklist

```yaml
- one query per visual, every measure for it in that query
- no filter expression written twice
- column predicates, not FILTER over a table
- periods as windows rows or a date column
- data-quality filter (estimated, imputed, provisional) applied wherever it matters
- benchmarked with --runs 5 and the result diffed against the previous version
```
