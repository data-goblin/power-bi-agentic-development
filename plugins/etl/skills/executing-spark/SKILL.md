---
name: executing-spark
description: Execute arbitrary Python or PySpark code on Fabric Spark compute without creating a notebook artifact; ephemeral Livy sessions with full Delta table access. Automatically invoke when the user asks to "run PySpark in Fabric", "create a Livy session", "execute Python on Fabric compute", "run Spark without a notebook", "submit code to Fabric", "ephemeral Spark execution", "run ETL in Fabric".
---

# Executing Spark Code in Fabric (No Notebook)

Run arbitrary PySpark or Python code on Fabric Spark compute via the Livy API. No notebook artifact is created or persisted; sessions are ephemeral. Full read/write access to lakehouse Delta tables via Spark SQL.

## Prerequisites

- Azure CLI authenticated (`az login`)
- A lakehouse in the target workspace (the Livy session runs against it)
- Fabric capacity (F or trial)

## Critical: Authentication

The Livy API requires a token from `az account get-access-token --resource https://api.fabric.microsoft.com`. Tokens from `fab auth` do **not** work for OneLake storage access inside the Spark session.

```python
import subprocess, json

result = subprocess.run(
    ["az", "account", "get-access-token", "--resource", "https://api.fabric.microsoft.com"],
    capture_output=True, text=True
)
token = json.loads(result.stdout)["accessToken"]
```

Do not output or log the token. Pass it directly to the API call.

## Lifecycle

```
1. Create session   POST .../sessions              {"kind": "pyspark"}
2. Wait for idle    GET  .../sessions/{id}          poll until state: "idle" (~30-90s)
3. Submit code      POST .../sessions/{id}/statements   {"code": "...", "kind": "pyspark"}
4. Get result       GET  .../sessions/{id}/statements/{n}   poll until state: "available"
5. Delete session   DELETE .../sessions/{id}        ALWAYS do this
```

Base URL: `https://api.fabric.microsoft.com/v1/workspaces/{wsId}/lakehouses/{lhId}/livyapi/versions/2023-12-01`

**CRITICAL: Always delete sessions when done.** Idle sessions consume Fabric capacity units (CUs). A forgotten session burns compute until it times out (default: 20 minutes). In automation, wrap cleanup in a `finally` block.

## Getting IDs

```bash
WS_ID=$(fab get "Workspace.Workspace" -q "id" | tr -d '"')
LH_ID=$(fab get "Workspace.Workspace/Lakehouse.Lakehouse" -q "id" | tr -d '"')
```

## Submitting Code

Submit PySpark or pure Python as statements. The `spark` object is available automatically.

```python
# Statement payload
{"code": "df = spark.sql('SELECT * FROM products LIMIT 10')\ndf.show()", "kind": "pyspark"}
```

Results are in `output.data["text/plain"]` when `state: "available"` and `output.status: "ok"`.

## What Works

- `spark.sql("SELECT ...")` ; full Spark SQL against lakehouse tables
- `spark.sql("SHOW TABLES")` ; metastore access
- `df.write.mode("overwrite").saveAsTable(...)` ; write Delta tables
- Pure Python (pandas, numpy, pyarrow); runs on Spark container
- In-memory Spark DataFrames and transformations
- Multiple sequential statements in one session

## What Does Not Work

- `deltalake` (delta-rs) is not pre-installed; use Spark SQL instead
- `notebookutils` has limited functionality (no FUSE mount at `/lakehouse/default/`)
- Tokens from `fab auth` ; must use `az` CLI token
- Tokens expire after ~60 minutes; long sessions need token refresh

## When to Use This vs Alternatives

| Scenario | Approach |
|----------|----------|
| Quick read-only exploration | DuckDB locally (fastest; see `using-duckdb` skill) |
| Write data back to lakehouse | Livy session or notebook |
| Ephemeral transform; no artifact | Livy session (this skill) |
| Complex multi-cell workflow | Notebook (`nb exec` or portal) |
| Scheduled ETL | Notebook via `fab job run` |
| Agent-driven compute (Dagster, orchestrators) | Livy session |

## Persisting code as a notebook: poll the definition LRO tightly

This skill is for ephemeral execution with no artifact. When you instead want to **persist or change** a notebook (deploy new code, iterate on an existing one), that is an item-definition change, and the poll interval is the single biggest performance lever. `fab import`, `nb create`, and `nb cell edit` take 25-60s because they poll the create/update long-running operation at the server's advertised `Retry-After: 20`; the work itself finishes in ~1s, and neither CLI lets you change that interval. Poll the LRO at ~0.3s and the same deploy takes ~1-2s. The `fabric-cli` skill ships [`scripts/deploy_notebook.py`](../../../fabric-cli/skills/fabric-cli/scripts/deploy_notebook.py) which does this (auto-detects create vs update, `--poll-interval` default 0.3s); strongly prefer it over `fab import` / `nb` for any notebook definition change.

## Sessions vs Batch Jobs

A Livy **session** (this skill) is interactive: create it, submit statements, read output as it runs, delete it. It stays alive and you pay for idle time until you delete it or it times out (~20 min).

A Livy **batch** is one-shot: submit a single job (a file or inline job spec), poll it to a terminal state, done. No idle-CU footgun, nothing to remember to delete. For scheduled or fire-and-forget agent ETL, prefer a batch over a session; keep sessions for interactive, multi-statement work. Same base URL, `/batches` instead of `/sessions` -- see [`references/livy-api.md`](./references/livy-api.md#batch-jobs-one-shot).

## Livy vs Notebook Jobs: reading the outcome

A Livy statement returns its result **directly** in the response (`output.status` = `ok`/`error`), so you always know whether it worked. A notebook run via `fab job run` does not -- its job status reports `Completed` even when the notebook caught an exception and exited a failure payload. If you run notebooks as batch jobs instead of Livy, you must read the notebook's **exit value** to get its real verdict. The `fabric-cli` skill (in the `fabric-cli` plugin) documents that endpoint and ships `scripts/run_notebook_checked.py` for it.

## References

- **`references/livy-api.md`** -- Full API reference with endpoints (sessions + batches), request/response formats, and error handling
- **`references/example-script.md`** -- Complete working script that creates a session, queries data, writes results, and cleans up

## Related

- `using-duckdb` skill (same `etl` plugin) -- read-only Delta querying, local or in-notebook, when you don't need Spark compute
- `fabric-cli` skill (`fabric-cli` plugin) -- `nb exec` / `fab job run` for notebooks, reading a notebook's exit value, the SQL-endpoint metadata sync after a Spark write, and `scripts/deploy_notebook.py` for fast notebook definition changes (tight LRO polling)
