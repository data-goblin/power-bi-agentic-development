---
name: power-query
description: Run and test Power Query M partition expressions against real data through the Fabric Dataflow executeQuery API (custom mashup document, Arrow result), and fix incremental-refresh, Lakehouse navigation and folding problems in partition M. Use when an M expression must be proven against the source, a partition step needs previewing, or query folding must be checked. Plain M authoring needs no skill.
---

# Power Query partitions

## Rules

- Prove folding with evidence, not a function list: no Microsoft page lists which functions fold. Use View Native Query in Desktop, or the source database's own query history. Do not trust per-function folding claims (older notes contradicted themselves on `Table.TransformColumnTypes` and `Table.Combine`); `Table.Buffer` and M-only `each` logic do break folding, and so does every step after a break. Guidance: https://learn.microsoft.com/en-us/power-bi/guidance/power-query-folding
- Incremental refresh: filter `>= RangeStart and < RangeEnd` (half-open) on a DateTime column, and the filter must fold. Policy and prerequisites: [wiki/incremental-refresh.md](../../wiki/incremental-refresh.md)
- `Value.NativeQuery(Source, sql, null, [EnableFolding = true])` lets later steps fold over the native query

## Run an expression against the source

`POST https://api.fabric.microsoft.com/v1/workspaces/{ws}/dataflows/{df}/executeQuery` with `{"queryName": "Result", "customMashupDocument": "<section document>"}`. Learn: https://learn.microsoft.com/en-us/rest/api/fabric/dataflow/query-execution/execute-query

- Needs a Dataflow Gen2 you may execute, with the source connection bound to it (the runner). Scope `Dataflow.Execute.All` or `Item.Execute.All`. Creating and binding the runner is portal work; Unverified whether `fab` can do it
- Maximum run time is 230 seconds; the response may be 202 (long running operation, poll `Location`) or 429 (honour `Retry-After`)
- `Accept: application/vnd.apache.arrow.stream;pq-arrow-version=1` (version 2 is not supported through an on-premises gateway). Errors arrive in an extra column named `PQ Arrow Metadata`
- The document is a section: `section Section1; shared SqlEndpoint = "..."; shared Result = let ... in ...;` with model parameters inlined as `shared` values and `RangeStart`/`RangeEnd` as concrete datetimes. The `shared` name must equal `queryName`
- Preview a step by ending the `let` at it, and add `Table.FirstN(step, 100)`

```bash
az login
uv run --with pyarrow --with pandas python scripts/execute_m.py -w <workspace-guid> -d <dataflow-guid> --stdin -n 20 < mashup.m
```

Get the partition and parameters from the model: `fab get "<ws>.Workspace/<model>.SemanticModel" -f -q "definition.parts[?path=='definition/expressions.tmdl'].payload"`.

`te validate` does not parse M, so the run above is the only machine check of a partition expression.
