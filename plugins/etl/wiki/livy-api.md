---
title: Livy API for Fabric lakehouses
summary: Session and batch endpoints, states, token scopes and error patterns for running Spark code without a notebook item
kind: reference
status: current
sources:
  - url: https://learn.microsoft.com/en-us/fabric/data-engineering/api-livy-overview
  - url: https://learn.microsoft.com/en-us/fabric/data-engineering/get-started-api-livy-session
  - url: https://learn.microsoft.com/en-us/fabric/data-engineering/get-started-api-livy-batch
  - url: https://learn.microsoft.com/en-us/fabric/data-engineering/high-concurrency-livy
  - url: https://learn.microsoft.com/en-us/fabric/data-engineering/runtime-2-0
tools:
  fab: 1.9.0
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
skills: [etl/executing-spark]
---

# Livy API for Fabric lakehouses

Learn covers the endpoints and a full session walkthrough: https://learn.microsoft.com/en-us/fabric/data-engineering/get-started-api-livy-session. This page keeps what Learn leaves out. Nothing here was run in this audit: a session consumes capacity, so run-time claims are from earlier use.

## Endpoint

```text
https://api.fabric.microsoft.com/v1/workspaces/{wsId}/lakehouses/{lhId}/livyapi/versions/2023-12-01
  POST   /sessions                       create (202, body {"kind": "pyspark"}; {} also works per Learn)
  GET    /sessions/{id}                  poll until state idle
  POST   /sessions/{id}/statements       {"code": "...", "kind": "pyspark"}
  GET    /sessions/{id}/statements/{n}   poll until state available; text in output.data["text/plain"]
  DELETE /sessions/{id}
  GET    /sessions                       find orphaned sessions
  POST   /batches                        {"file": "abfss://<ws>@onelake.dfs.fabric.microsoft.com/<lh>/Files/job.py", "args": [], "conf": {}}
  GET    /batches/{id}                   terminal states: success, dead, killed; logs at /batches/{id}/log
  DELETE /batches/{id}                   cancel
```

Get the ids with `fab get "ws.Workspace" -q id` and `fab get "ws.Workspace/LH.Lakehouse" -q id`.

## States

```yaml
session: not_started, starting, idle, busy, dead, error, killed
statement: waiting, running, available, error, cancelling, cancelled
statement result: output.status ok | error; on error read ename, evalue, traceback
```

Learn's sample submits `spark.sql(...)` with `kind: "spark"`; `pyspark` also runs it. A `NameError: spark` means the statement kind and session kind do not match.

## Tokens

Learn requires a Microsoft Entra app token (user or service principal) for the Livy endpoint. For a user token these scopes are required:

```yaml
Lakehouse.Execute.All: execute operations in lakehouses
Lakehouse.Read.All: read lakehouse metadata
Code.AccessFabric.All: Fabric API access from the Spark runtime
Code.AccessStorage.All: OneLake and Azure storage access from the Spark runtime
optional: Code.AccessAzureKeyvault.All, Code.AccessAzureDataLake.All, Code.AccessAzureDataExplorer.All, Code.AccessSQL.All
```

A service principal token uses audience `https://analysis.windows.net/powerbi/api/.default` (Learn shows certificate authentication).

Earlier use of this skill found that a token from `az account get-access-token --resource https://api.fabric.microsoft.com` created sessions but failed reading OneLake with `REQUEST_INVALID_RESOURCE_NONRETRIABLE` or `MetaException: Unable to fetch mwc token`, and that a `fab` token failed the same way. Learn lists `Code.AccessStorage.All` as required for reading and writing lakehouse data, so use an app registration that requests all four scopes.

## Lifecycle rules

- Idle sessions keep consuming CUs; Learn says a session ends after 20 minutes of inactivity. Delete in a `finally` block
- Spark is background compute, smoothed over 24 hours: see `fabric-cli` `capacity-cost.md`
- Prefer a batch for unattended work: no idle session to forget. A batch takes a file in OneLake, not inline code
- For concurrent statements Learn recommends high concurrency sessions, a separate Livy job type: https://learn.microsoft.com/en-us/fabric/data-engineering/high-concurrency-livy
- Pass an environment with `"conf": {"spark.fabric.environmentDetails": "{\"id\": \"<environment-id>\"}"}`; default is the workspace starter pool
- Runtime: new workspaces default to Runtime 2.0 (Spark 4.1, Python 3.13; [Runtime 2.0](https://learn.microsoft.com/en-us/fabric/data-engineering/runtime-2-0))

## Errors

```yaml
REQUEST_INVALID_RESOURCE_NONRETRIABLE: seen with az and fab tokens; see Tokens
"MetaException: Unable to fetch mwc token": seen in the same case
session dead right after create: bad config or no capacity; check the Monitoring hub
```
