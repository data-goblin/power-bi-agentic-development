---
title: Capturing DAX traces from Desktop with the TOM trace API
summary: Event ids and column rules for server timings, EVALUATEANDLOG capture, and event-driven capture of visual queries.
kind: reference
status: current
sources:
  - url: https://learn.microsoft.com/en-us/analysis-services/trace-events/analysis-services-trace-events
  - url: https://learn.microsoft.com/en-us/dax/evaluateandlog-function-dax
tools:
  te: 0.8.1.1
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
skills: [pbi-desktop/connect-pbid]
---

# Capturing DAX traces from Desktop

Try `te query --local --trace --cold --runs 10` first (Windows): it returns the FE/SE split for a query you write. Use the TOM trace API only for what te does not capture: visual queries as Desktop sends them, and `EVALUATEANDLOG` payloads. Scripts: `scripts/debug-dax.ps1` (EVALUATEANDLOG plus timings) and `scripts/trace-queries.ps1` (visual queries, event-driven).

## Events

```yaml
QueryEnd:                    10   # Duration, CpuTime: total
VertiPaqSEQueryBegin:        82
VertiPaqSEQueryEnd:          83   # per-scan Duration, CpuTime
VertiPaqSEQueryCacheMatch:   85   # supports TextData and EventClass only; adding Duration or CpuTime makes $trace.Update() throw
DAXQueryPlan:               112
DAXEvaluationLog:           135   # EVALUATEANDLOG payload in TextData
```

FE time is QueryEnd duration minus the union of overlapping SE intervals, not the sum. Take 6 to 12 samples, compare medians, drop the first cold run. Clear the cache for cold timings with `$server.Execute('{ "clearCache": { "object": { "database": "<name>" } } }')`.

## Handler scope

`Register-ObjectEvent -Action` runs in another runspace: `$global:` variables are not shared. Pass a synchronized collection with `-MessageData` and add `$Event.SourceEventArgs` to it.

## EVALUATEANDLOG

`EVALUATEANDLOG(<value>, [label], [maxRows])` returns its input unchanged and emits JSON (`expression`, `label`, `inputs`, `outputs`, `data[].rowCount`, the true count even when rows are truncated). Desktop only. `maxRows` defaults to 10. Delivery is asynchronous, usually 2 to 3.5 seconds after the query returns, so poll the captured count (about 10 s in 500 ms steps) instead of sleeping once. Warm-cache runs still emit. Payloads over 1M characters are truncated. Wrap each step of a measure chain with its own label to see input context to output per level, including the grand-total grain.

## Visual queries

Subscribe to `QueryEnd` and read `TextData`, `Duration` and `CpuTime` as events arrive; ignore XMLA, `MDSCHEMA_`, `TMSCHEMA_` and `$SYSTEM` queries. Polling `$SYSTEM.DISCOVER_SESSIONS` keeps one last command per session and misses short queries.
