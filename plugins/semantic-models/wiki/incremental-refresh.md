---
title: Incremental refresh policy with te
summary: Set, apply and remove a refresh policy with te set and te refresh, plus the prerequisites that make the first refresh fail.
kind: recipe
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/connect-data/incremental-refresh-overview
  - url: https://learn.microsoft.com/en-us/power-bi/connect-data/incremental-refresh-configure
tools:
  te: 0.8.1.1
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - te validate -m plugins/semantic-models/wiki/examples/incremental-refresh --errors-only
skills: [semantic-models/semantic-model, semantic-models/refresh-semantic-model]
---

# Incremental refresh policy with te

There is no `te incremental-refresh` command. The policy is the `RefreshPolicy` object on a table, set with `te set`.

```bash
te set Orders/RefreshPolicy -p RollingWindowPeriods=5 -p RollingWindowGranularity=Year -p IncrementalPeriods=10 -p IncrementalGranularity=Day --save
te get Orders/RefreshPolicy --properties          # PolicyType, Mode (Import, Hybrid), IncrementalPeriodsOffset, PollingExpression, SourceExpression
te set Orders -p RefreshPolicy=null --save        # remove
te refresh --apply-refresh-policy Orders --execute   # create the partitions; scopes the refresh to that table
te refresh --table Orders --type full --apply-refresh-policy false --execute   # refresh data without rolling the window
```

`te refresh --partition` takes `Table.Partition` and cannot be combined with `--table`. On a local Desktop model the policy is not applied by default.

## Prerequisites in order

1. Two Date/Time parameters named exactly `RangeStart` and `RangeEnd`
2. The partition M filters half-open: `>= RangeStart and < RangeEnd`, so a boundary row is not counted twice
3. The filter folds to the source. If it does not, every partition loads the whole table and the first refresh times out. Check with a trace that one source query carries both bounds
4. If the source keys on an integer date key, convert the parameters inside the filter, not the column

Partitions appear only after the first service refresh applies the policy. Service refresh runs in UTC unless a time zone is set, which changes what counts as a complete period.

## Detect data changes, hybrid

- A polling expression or a detect-changes column skips unchanged periods; the column must differ from the `RangeStart`/`RangeEnd` column
- `Mode=Hybrid` adds a DirectQuery partition for the newest slice. Related dimensions must be Dual, and reports need automatic page refresh to show the live rows

Verified example: [examples/incremental-refresh](examples/incremental-refresh/tables/Orders.tmdl) holds the two parameters, a filtered M partition and the policy written by the command above.
