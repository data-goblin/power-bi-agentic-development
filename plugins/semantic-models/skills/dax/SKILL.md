---
name: dax
description: Tune slow DAX with server timings. Use when a measure, visual query or DAX query is slow, when reading a Formula Engine / Storage Engine trace (xmSQL, CallbackDataID, fusion, parallelism), when a rewrite must be proven equal to the original, or when a SUMMARIZECOLUMNS or calendar time intelligence result looks wrong. Not for writing ordinary DAX, which needs no skill; UDF details are in the wiki page linked below.
---

# DAX performance tuning

Rules

- Measure first, then rewrite. A rewrite without a before/after trace and an equal-result check is a guess
- Object reference format (`'Table'[Column]`, `[Measure]`) is owned by the `semantic-model` skill; follow it in every rewrite
- Rewriting a measure or UDF is yours to do. Changing the report query, the model (relationships, columns, aggregations) or Delta layout needs the user's approval first, and a model copy for model changes
- Equal output is the success test: same rows, columns and values (`te query -o a.csv` before, `-o b.csv` after, then diff)

## Loop

```bash
te query --file q.dax --trace --cold --runs 10 --plan -s <workspace> -d <model>
te query --file q.dax -o before.csv
te validate --errors-only --model <folder>
```

- `--runs N` implies `--trace --cold` per run; compare medians and drop the first run. `--plan` needs `--trace` and may be missing on Fabric
- Local Desktop model on Windows: add `--local`. Direct Lake models are not exposed through the Desktop proxy; use the workspace endpoint
- Visual queries: get the real query from Performance Analyzer (copy query) or `connect-pbid` trace capture, then `DEFINE` every measure it uses so the trace shows the full expression
- Per-step values inside a measure: `EVALUATEANDLOG` (Desktop only, `connect-pbid`)

## Reading the trace

Fix in this order: callbacks, FE time, SE query count, then data volume and parallelism. Full cue table: [references/signals.md](references/signals.md)

## Gotchas Learn documents and models get wrong

- SUMMARIZECOLUMNS in measures changed in June 2024: GroupBy columns are no longer filtered by columns of other tables (SelfValue), rows fully covered by one TREATAS are validated, and mixing KeepFilters with plain filters in one table cluster errors. A "faster" rewrite to SUMMARIZECOLUMNS can change rows. `SUMMARIZE` keeps the old behaviour. Source: https://learn.microsoft.com/en-us/dax/summarizecolumns-function-dax
- A bare predicate in CALCULATE replaces an existing filter on that column; `FILTER(table, ...)` intersects. Only `KEEPFILTERS(predicate)` matches it
- Calendar-based time intelligence is still preview and Desktop/TMDL-authored only (no service authoring, no live or composite models); Learn advises against offset columns on date tables except in special cases. `DATEADD` takes `extension` (precise, extended, endaligned) and `truncation` (anchored, blank) with calendars. Source: https://learn.microsoft.com/en-us/power-bi/transform-model/desktop-time-intelligence
- UDFs: [wiki/udf-authoring.md](../../wiki/udf-authoring.md)
- Model metadata through DAX: `INFO.*` functions run in `te query` and DAX query view
