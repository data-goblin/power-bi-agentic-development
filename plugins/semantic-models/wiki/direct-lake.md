---
title: Direct Lake on OneLake versus on SQL
summary: The behaviour differences that change what an agent should do, with the te commands for framing and fallback.
kind: gotcha
status: current
sources:
  - url: https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-overview
  - url: https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-how-it-works
tools:
  te: 0.8.1.1
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 60
skills: [semantic-models/semantic-model]
---

# Direct Lake on OneLake versus on SQL

Learn's comparison tables own the facts. These are the ones that change commands.

```yaml
fallback:
  SQL endpoint flavor: falls back to DirectQuery when it cannot load Delta directly (SQL view, SQL-based row security); controlled by DirectLakeBehavior
  OneLake flavor: never falls back; guardrail breach fails the refresh and queries error
composite:
  OneLake: can mix Import tables (and DirectQuery over XMLA)
  SQL: no mixing storage modes in the model
calculated columns and tables over Direct Lake columns:
  OneLake: calculated columns supported, user context only (preview)
  SQL: not supported; calculation groups, what-if and field parameters are allowed
row security:
  OneLake: SQL-endpoint RLS is not applied; use semantic model RLS with a fixed identity cloud connection
  SQL: SQL RLS forces fallback (or failure when fallback is off)
deployment pipelines:
  OneLake: data source rules unsupported; use M parameters with parameter rules
  SQL: data source rules supported
gateways: neither flavor works through a gateway
```

Which flavor a table is: a SQL endpoint URL in the shared expression means SQL; an `abfss` OneLake path means OneLake.

## Commands

```bash
te refresh --type automatic --execute          # framing; without --execute only the TMSL prints
te set . -p DirectLakeBehavior=DirectLakeOnly --save   # dev only: makes hidden fallback fail loudly (SQL flavor)
te add Orders -t Table --mode directlake --source-table dbo.Orders --save
```

- Framing is a metadata refresh. A Direct Lake table created over XMLA is unprocessed until a refresh runs; queries error (OneLake) or fall back (SQL)
- One-side relationship keys must be unique; duplicates fail at query time. Assert it with a `te test` COUNTROWS versus DISTINCTCOUNT check
- Guardrails: model size is evaluated once; Parquet files, row groups, rows and memory are per query. Max memory is a paging ceiling, not a guardrail
- Delta column types: no complex types, binary or GUID; strings over 32,764 characters and NaN are unsupported
- The Desktop local proxy does not expose Direct Lake databases; connect to the workspace endpoint
