---
name: executing-spark
description: "Run PySpark or Python on Fabric Spark compute through the Livy API without creating a notebook item: ephemeral sessions or one-shot batches against a lakehouse. Use for 'run Spark without a notebook', 'create a Livy session', 'submit code to Fabric compute'. Not for scheduled notebook or pipeline runs."
---

# Executing Spark in Fabric without a notebook

Livy sessions and batches run Spark code against a lakehouse and leave no item behind. A session consumes capacity until it is deleted or idles out, so the CU gate from the `fabric-cli` skill applies before you start one. Endpoints, states, scopes and errors: [livy-api.md](../../wiki/livy-api.md). Learn: https://learn.microsoft.com/en-us/fabric/data-engineering/api-livy-overview

## Rules

- Base URL `https://api.fabric.microsoft.com/v1/workspaces/{wsId}/lakehouses/{lhId}/livyapi/versions/2023-12-01`; ids from `fab get ... -q id`
- Auth: an Entra token with the four scopes in [livy-api.md](../../wiki/livy-api.md); never print or log it. A `fab` token fails on OneLake reads
- Always delete the session, in a `finally` block in automation. Idle sessions burn CUs; Learn gives a 20 minute inactivity limit
- Prefer a batch (`/batches`, file in OneLake, poll to `success`, `dead` or `killed`) for unattended work; use a session for interactive multi-statement work
- A statement reports its own outcome in `output.status`. A notebook run by `fab job run` does not: `Completed` can hide a caught exception, so read its exit value (`fabric-cli` `notebooks.md`, `scripts/run_notebook_checked.py`)
- Spark is background compute, smoothed over 24 hours; estimate the cost first (`fabric-cli` `capacity-cost.md`)
- Choosing: read-only exploration, use DuckDB (`using-duckdb`); scheduled ETL, a notebook with `fab job run`; ephemeral transform or orchestrator-driven compute, Livy

## Persisting code as a notebook

That is a definition change, not Livy. `fab import` polled the long-running operation slowly on fab 1.7.0; see `fabric-cli` for `scripts/deploy_notebook.py` and the note to re-measure on fab 1.9.0.
