---
title: Crossfilter selections as DAX query parameters
summary: Passing dashboard selections to run_dax_query as @parameters that do nothing when empty; multi-select; which visuals re-query.
kind: recipe
status: current
sources:
  - url: https://learn.microsoft.com/en-us/dax/dax-queries
  - url: https://learn.microsoft.com/en-us/dax/pathcontains-function-dax
tools:
  te: 0.8.1.1
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - python3 plugins/dashboards/skills/querying-fabric/scripts/lint_dax.py plugins/dashboards/wiki/examples/selection-filter.dax
skills: [dashboards/querying-fabric]
---

# Crossfilter selections as query parameters

In a crossfiltered dashboard every visual is also a filter: selecting a mark filters every other visual, selecting it again clears it.

## Selection state

One selection object for the whole dashboard, keyed by the model column each visual groups by:

```yaml
selection:
  "'Customer'[Segment]": ["Enterprise"]
  "'Product'[Category]": ["Bikes", "Helmets"]
```

Ctrl or Cmd click adds, a plain click replaces; slicers and date pickers write into the same object; one visible strip lists active selections with a clear control.

## Parameters, never string splicing

`run_dax_query` takes `parameters` as `{"name": value}` and the query references `@name`. This avoids quoting bugs and injection from member names with quotes. Make every filter a no-op when its parameter is empty (`""` for text, a sentinel such as `0` or a separate flag for numbers): `examples/selection-filter.dax`.

Multi-select: pass the members as one `|`-delimited string and test with `PATHCONTAINS ( @categories, 'Product'[Category] )` ([Learn](https://learn.microsoft.com/en-us/dax/pathcontains-function-dax)). If a member name can contain `|`, filter by a key column or use one parameter per member. Repeat the filter once per crossfilter column and pass all of them to every query; empty ones cost almost nothing.

## Which visuals re-query

```yaml
re-query: ratios, percentages, averages, distinct counts and other non-additive measures; KPI cards and targets; measures with hidden or selection-dependent logic
client-side only: the measure is additive, the loaded grain contains the selected column, and the row count is small
```

When unsure, re-query: only the model knows how a measure behaves for a subset, and summing per-row ratios client-side is a new, wrong definition. Debounce selection changes, run the affected queries in parallel, and keep the old result visible while the new one loads.

## The visual that owns a selection

It must not filter itself: leave its own column out of its query and highlight the selected members against the rest. The trend chart owns the date selection the same way: selecting a month filters the other visuals while the trend keeps its whole window.

## Test each query three ways

1. All parameters empty: totals match the unfiltered dashboard
2. One member per crossfilter column: the KPI total equals that member's value in the visual that owns the selection
3. Two members: additive measures equal the sum of the two, ratios equal the model's own value, not the sum
