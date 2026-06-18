---
name: executing-spark
version: 26.25
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

## References

- **`references/livy-api.md`** -- Full API reference with endpoints, request/response formats, and error handling
- **`references/example-script.md`** -- Complete working script that creates a session, queries data, writes results, and cleans up
