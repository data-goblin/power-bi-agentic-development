# Trace cue to cause

Capture with `te query --trace --cold --runs 10 --plan`. Cues are from `VertiPaqSEQueryEnd.TextData` (xmSQL) and the event timeline.

```yaml
CallbackDataID or EncodeCallback in an SE query:
  cause: per-row FE logic inside an iterator (IF, SWITCH, DIVIDE, context transition) that the SE cannot push down
  fix: move the logic out of the iterator, precompute at the grain you need, or use boolean multipliers; re-trace until the callback is gone
high FE share, many short SE queries:
  cause: the FE stitches many scans; measure or expression is re-evaluated
  fix: VAR the repeated expression, iterate the lowest grain that is needed, not the fact table
many SE scans over one fact with the same joins:
  cause: vertical fusion blocked, usually by sibling measures with different time windows or branch measures chosen by SWITCH/IF
  fix: move shared filters outside the sibling measures, keep branch measures SE-friendly
near-identical scans differing only by WHERE values:
  cause: horizontal fusion blocked
  fix: express the difference as a boolean multiplier on the same scan
SE rows far above result rows, or no WHERE on a big scan:
  cause: the FE filters after materialising
  fix: push the filter into CALCULATE/CALCULATETABLE as a column predicate
DCOUNT in xmSQL:
  note: distinct count is a heavier SE operation; test COUNTROWS over a key already known to be unique
large IN / ININDEX / compound tuple predicates:
  cause: a computed key set re-filters the fact (TREATAS with many tuples)
  fix: join the precomputed key set once in the FE
__ValueFilterDM in the visual query:
  cause: report-level measure filter; changes the query shape, so it needs the user's approval to remove
few SE queries, clean xmSQL, long SE duration, parallelism near 1 (CpuTime / Duration per scan):
  cause: data layout (segments, dictionary size, high-cardinality columns, Delta rowgroups on Direct Lake)
  fix: DAX will not help; go to te vertipaq (--columns --detail) and the model
no AggregateTableRewriteQuery on a model with aggregations:
  cause: the query missed the aggregation; check mappings and query grain
```

FE time is total duration minus the union (not the sum) of overlapping SE intervals. Look at per-scan parallelism, not only the aggregate. Ignore 0 ms cache-match scans and `VertiPaqScanInternal` rows.

Sources: https://learn.microsoft.com/en-us/analysis-services/trace-events/analysis-services-trace-events ; https://www.sqlbi.com/ ; https://daxstudio.org/
