---
name: refresh-semantic-model
description: Refresh a published semantic model with the Enhanced Refresh REST API through `fab api`: refresh selected tables or partitions, two-phase dataOnly plus calculate, commit modes, status by request id, cancel, and refresh troubleshooting. Use for service models. For Direct Lake framing or models reachable over XMLA use `te refresh`; for Desktop use connect-pbid.
---

# Refresh a published semantic model

## Decide the route

```yaml
te refresh (XMLA write access, any type incl. add): te refresh --type full --table Sales --max-parallelism 4 --execute
REST via fab api (no XMLA, or you need requestId status, cancel, commitMode): this skill
Direct Lake: te refresh --type automatic --execute is the framing (see the semantic-model skill)
```

`te refresh` prints the TMSL and does nothing without `--execute`; there is no `--dry-run` flag. Enhanced refresh needs Premium, PPU, Embedded or Fabric capacity; Pro supports only full-model standard refresh.

## Request

```bash
WS=$(fab get "Workspace.Workspace" -q "id" | tr -d '"')
MODEL=$(fab get "Workspace.Workspace/Model.SemanticModel" -q "id" | tr -d '"')
fab api -A powerbi "groups/$WS/datasets/$MODEL/refreshes" -X post --show_headers -i '{"type":"full","commitMode":"transactional","objects":[{"table":"FactSales","partition":"FactSales_2025"}]}'
```

The `Location` header ends in the `requestId`. Types: `full`, `automatic`, `dataOnly`, `calculate`, `clearValues`, `defragment`; `add` is TMSL-only. Defaults: `commitMode` transactional, `maxParallelism` 10, `retryCount` 0, `timeout` 05:00:00 (24 h total cap), `applyRefreshPolicy` true.

Rules Learn confirms:

- `dataOnly` clears calculated columns and tables without recalculating: follow it with `{"type":"calculate"}`. Two-phase pattern: `dataOnly` with `partialBatch`, then `calculate` transactional
- `partialBatch` requires `"applyRefreshPolicy": false`
- One refresh at a time per model: a second request returns 400
- Keep shell quoting simple: single-quote the JSON and write DAX bodies to a file when they contain single quotes

## Status and cancel

```bash
fab api -A powerbi "groups/$WS/datasets/$MODEL/refreshes/<requestId>"      # status, extendedStatus, per-object messages
fab api -A powerbi "groups/$WS/datasets/$MODEL/refreshes?\$top=5"          # history
fab api -A powerbi "groups/$WS/datasets/$MODEL/refreshes/<requestId>" -X delete
```

An enhanced refresh in progress shows `Unknown` in the history list and `InProgress` by `requestId`; read `extendedStatus` (NotStarted, InProgress, TimedOut, ...) and stop polling on `TimedOut`. Only refreshes started through the enhanced API can be cancelled; scheduled and portal refreshes cannot. Source: https://learn.microsoft.com/en-us/power-bi/connect-data/asynchronous-refresh

## Verify data actually changed

Snapshot before and after: `te test snapshot --output-file before.json -s <ws> -d <model>`, refresh, then `te test snapshot --diff before.json`. A successful refresh with an unchanged snapshot means the source is stale: run the upstream job (`fab job run "Workspace.Workspace/Pipeline.DataPipeline"`, synchronous; `fab job start` is asynchronous) and refresh again.

## Failures that are not obvious

- Credential errors after `fab cp`: only shared cloud connections transfer; rebind the rest in the model settings
- "Column does not exist" or type mismatch: the source schema moved; fix the partition M or `te set <table> --update-schema --save`
- Calculated tables empty after `dataOnly`: run `calculate`
- Circular dependency after a SUMMARIZECOLUMNS change inside CALCULATETABLE: see the SelfValue note in the `dax` skill
- Timeouts: partition-level refresh or incremental refresh ([wiki/incremental-refresh.md](../../wiki/incremental-refresh.md)); the default refresh timeout is a request option (`timeout`, default 05:00:00)
