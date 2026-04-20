# Notebook Operations

Guide for working with Fabric notebooks via `fab` and [`nb`](https://github.com/data-goblin/nb-cli). Covers both Python and PySpark kernels, metadata formats, data item attachments, reading/writing from OneLake, and interactive execution with cell output.

## The `nb` CLI

The [`nb` CLI](https://github.com/data-goblin/nb-cli) (`cargo install nb-fabric`) extends `fab` with capabilities that `fab` does not have: **interactive execution with output retrieval**, cell-level CRUD, and proper Python/PySpark notebook creation with correct metadata.

The key differentiator: `fab job run` executes a notebook as a batch job but never returns cell output. `nb exec` creates a session, submits code, and returns the output directly to the terminal.

```bash
# Run code directly against a lakehouse (no notebook needed)
nb exec code "My Workspace/MainLH.Lakehouse" "print('hello')"
nb exec code "My Workspace/MainLH.Lakehouse" "spark.sql('SHOW TABLES').show()"

# Execute a specific notebook cell by index
nb exec cell "My Workspace/Analytics" 0 --lakehouse MainLH

# Pipe code via stdin (for agents)
echo "spark.sql('SELECT count(*) FROM gold.orders').show()" | nb exec code "WS/LH.Lakehouse" -
```

### `nb` Command Reference

```
nb auth status                                Check Azure CLI authentication

nb list <workspace>                           List notebooks
nb create <ws/name>                           Create notebook
  --kernel python|pyspark                       Kernel type (default: python)
  --lakehouse <name>                            Attach lakehouse
  --warehouse <name>                            Attach warehouse

nb cells <ws/name>                            List all cells (index, type, preview)
nb cell view <ws/name> <index>                View single cell source
nb cell add <ws/name> --code "..."            Add a cell
  --markdown                                    Markdown cell (default: code)
  --at <index>                                  Insert position (default: append)
nb cell edit <ws/name> <index> --code "..."   Replace cell source
nb cell rm <ws/name> <index>                  Remove a cell

nb exec code <ws/lakehouse> <code>            Run code against a lakehouse (no notebook)
nb exec cell <ws/notebook> <index>            Execute a notebook cell interactively
  --lakehouse <name>                            Lakehouse (auto-detected from notebook)

nb job run <ws/name> [--wait --timeout]       Batch execution
nb job list <ws/name>                         List run history

nb session <ws/name>                          Show active sessions

nb schedule list <ws/name>                    List schedules
nb schedule create <ws/name>                  Create schedule
  --type Cron|Daily|Weekly                      Schedule type (default: Cron)
  --interval <n>                                Interval (minutes for Cron)
  --start <datetime> --enable                   Start time + enable
nb schedule update <ws/name> <id>             Update schedule
nb schedule delete <ws/name> <id>             Delete schedule

nb export <ws/name> -o <path>                 Download .ipynb
nb open <ws/name>                             Open in browser
nb delete <ws/name> --force                   Delete notebook
```

### How `nb exec` Works

`nb exec` creates an interactive session, submits code, and returns output:

1. **`exec code`**: Resolves workspace and lakehouse directly; code is a positional arg
2. **`exec cell`**: Resolves workspace, notebook, and lakehouse; auto-detects kernel from notebook metadata
3. Both: create a session, wait for idle, submit code, poll for result, print output, clean up session

Sessions are always cleaned up, even on Ctrl+C (signal handler). Exit code is non-zero when code fails. Structured metadata (session ID, runtime, duration, status) is printed to stderr.

#### Python vs PySpark in Livy sessions

Fabric's Livy API always runs against Spark compute attached to a lakehouse. There is no lightweight "pure Python" runtime via the Livy API. A full `spark` (SparkSession) variable is always available, giving you `spark.sql()`, DataFrames, and full lakehouse read/write.

The Python vs PySpark distinction is only meaningful in **Fabric Notebooks** (the UI experience), not in `nb exec code`:

| Aspect | Python Notebook (UI) | PySpark Notebook (UI) |
|--------|---------------------|----------------------|
| Compute | 2-core lightweight container | Spark cluster |
| Startup | Seconds | Seconds (starter pool) to minutes |
| Cost | Min 2 vCores | Min 4 vCores |
| Delta Lake | Partial (via delta-rs) | Fully native |
| Distributed compute | No | Yes |

### Install

**Option 1: Download a prebuilt binary** (no Rust needed)

Download the binary for your platform from [GitHub Releases](https://github.com/data-goblin/nb-cli/releases) and add it to your PATH.

**Option 2: Install via Cargo** (requires Rust toolchain)

```bash
# Install Rust if not already installed
# macOS/Linux:
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# Windows:
winget install Rustlang.Rustup

# Install nb
cargo install nb-fabric
```

**Verify:**

```bash
nb --version
nb auth status
```

`nb` requires Azure CLI (`az`) for authentication. Run `az login` before first use.

### Notebook-less Execution

`nb exec code` runs Python on Fabric Spark compute without creating a notebook. The session is created, used, and cleaned up automatically. The `spark` variable (SparkSession) is always available for querying lakehouse tables.

```bash
# Simple Python
nb exec code "MyWorkspace/MyLH.Lakehouse" "print('hello')"

# Query lakehouse tables via Spark SQL
nb exec code "MyWorkspace/MyLH.Lakehouse" "spark.sql('SELECT count(*) FROM gold.orders').show()"

# Multi-line ETL
nb exec code "MyWorkspace/MyLH.Lakehouse" "
df = spark.sql('SELECT category, COUNT(*) as n FROM products GROUP BY category')
df.write.mode('overwrite').saveAsTable('product_summary')
print('Done')
"

# Pipe from file or script
cat transform.py | nb exec code "MyWorkspace/MyLH.Lakehouse" -
```

Use this when: agent-driven ephemeral ETL, one-off transforms, data validation, or any scenario where a persistent notebook artifact adds unnecessary overhead.

For the direct API approach (without the `nb` CLI), see [querying-data.md](./querying-data.md#using-the-api-directly).

### When to Use `nb` vs `fab` vs Livy API

| Task | Use `nb` | Use `fab` | Use Livy API directly |
|------|---------|-----------|----------------------|
| Execute code and see output | `nb exec` | Not possible | Submit statements, poll results |
| View/edit individual cells | `nb cell view/add/edit/rm` | Not possible | Not applicable |
| Create notebook with correct metadata | `nb create` | `fab mkdir` (no metadata) | Not applicable |
| Run notebook as batch job | `nb run` or `fab job run` | `fab job run` | Not applicable (use session statements) |
| Ephemeral ETL; no artifact | Not applicable | Not applicable | Create session, submit, delete |
| Schedule notebooks | `nb schedule` | `fab job run-sch` | Not applicable |
| Export/import notebook files | `nb export` or `fab export` | `fab export/import` | Not applicable |
| Upload files, manage lakehouses | Not applicable | `fab cp`, `fab table` | Not applicable |

## Choosing a Kernel

Fabric notebooks support two runtime types. **Prefer Python for agent work**; it starts in seconds, has DuckDB/Polars/delta-rs pre-installed, and can run T-SQL against warehouses via `notebookutils.data`.

| | Python Notebook | PySpark Notebook |
|---|---|---|
| Startup | ~5 seconds | 5s-5min (cold start) |
| Compute | Single-node container (2 vCores) | Spark cluster (4+ vCores) |
| Delta Lake | via delta-rs (< v1.0.0) | Native; full support |
| T-SQL (warehouse/SQL DB) | `notebookutils.data.connect_to_artifact()` | Not available |
| DuckDB/Polars | Pre-installed | Not pre-installed |
| Use when | Data fits in memory; T-SQL; quick tasks | Distributed compute; large data; Spark SQL |

## Notebook Metadata Format

The kernel type is determined by metadata fields in the `.ipynb` file. Getting these wrong causes silent failures or the wrong kernel.

### Python Notebook

```json
{
  "kernel_info": { "name": "jupyter", "jupyter_kernel_name": "python3.11" },
  "language_info": { "name": "python" },
  "microsoft": { "language": "python", "language_group": "jupyter_python" },
  "kernelspec": { "name": "jupyter", "display_name": "Jupyter" }
}
```

### PySpark Notebook

```json
{
  "kernel_info": { "name": "synapse_pyspark" },
  "language_info": { "name": "python" },
  "microsoft": { "language": "python", "language_group": "synapse_pyspark" }
}
```

### Key Differentiators

| Field | Python | PySpark |
|---|---|---|
| `kernel_info.name` | `"jupyter"` | `"synapse_pyspark"` |
| `kernel_info.jupyter_kernel_name` | `"python3.11"` or `"python3.10"` | not present |
| `microsoft.language_group` | `"jupyter_python"` | `"synapse_pyspark"` |
| `kernelspec.name` | `"jupyter"` | `"python3"` |

### Cell Metadata

Each cell carries `cell_type` (`"code"` or `"markdown"`) and its own `microsoft.language_group`:

```json
{
  "cell_type": "code",
  "source": ["print('hello')"],
  "outputs": [],
  "execution_count": null,
  "metadata": {
    "microsoft": { "language": "python", "language_group": "jupyter_python" }
  }
}
```

Markdown cells use `"cell_type": "markdown"` with the same metadata structure.

## Attaching Data Items

Data items (lakehouse, warehouse, SQL database) are attached via the `dependencies` field in notebook metadata. Without attachments, lakehouse paths and `notebookutils.data` calls may fail.

### Lakehouse Attachment

```json
"dependencies": {
  "lakehouse": {
    "default_lakehouse": "<lakehouse-guid>",
    "default_lakehouse_name": "<LakehouseName>",
    "default_lakehouse_workspace_id": "<workspace-guid>",
    "known_lakehouses": [{ "id": "<lakehouse-guid>" }]
  }
}
```

### Warehouse Attachment

```json
"dependencies": {
  "warehouse": {
    "default_warehouse": "<warehouse-guid>",
    "known_warehouses": [
      { "id": "<warehouse-guid>", "type": "Datawarehouse" }
    ]
  }
}
```

Warehouse types: `Datawarehouse` (warehouse), `Lakewarehouse` (lakehouse SQL endpoint), `MountedWarehouse` (SQL database).

### Combined Attachments

Lakehouse and warehouse can coexist:

```json
"dependencies": {
  "lakehouse": { ... },
  "warehouse": { ... }
}
```

Get the GUIDs with `fab get "ws.Workspace/Item.Type" -q "id"`.

## Creating and Importing Notebooks

### Directory Structure

```
MyNotebook.Notebook/
  .platform                    # Required; displayName must match item name
  notebook-content.ipynb       # Required; .ipynb JSON format
```

### .platform File

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
  "metadata": { "type": "Notebook", "displayName": "MyNotebook" },
  "config": { "version": "2.0", "logicalId": "00000000-0000-0000-0000-000000000001" }
}
```

### Import and Run

```bash
mkdir -p /tmp/MyNotebook.Notebook
# Create .platform and notebook-content.ipynb files (see examples/)
fab import "ws.Workspace/MyNotebook.Notebook" -i /tmp/MyNotebook.Notebook -f
fab job run "ws.Workspace/MyNotebook.Notebook"
```

### Common Import Failures

| Error | Cause | Fix |
|---|---|---|
| "Not supported language" | Missing `language_info.name` | Add `"language_info": {"name": "python"}` |
| "failed without detail error" (instant) | Bad metadata or missing attachment | Check `kernel_info`, `language_group`, `dependencies` |
| "failed without detail error" (~40s) | Code error; no detail via CLI | Open in portal (`fab open`) to see Spark/Python traceback |
| `NameError: spark` | No lakehouse attached (PySpark only) | Add `default_lakehouse` to dependencies |
| `module has no attribute` | Wrong API name | Check `notebookutils.data.help()` for correct methods |

## Reading and Writing Data

### PySpark: Lakehouse Tables

```python
# Read with three-part naming
df = spark.sql("SELECT * FROM LakehouseName.schema.table")

# Write to lakehouse table
df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable("LakehouseName.schema.table")
```

### Python: Lakehouse with delta-rs

```python
from deltalake import DeltaTable

# Local path (attached lakehouse)
dt = DeltaTable('/lakehouse/default/Tables/my_table')
df = dt.to_pandas()

# ABFS path (any lakehouse; no attachment needed)
access_token = notebookutils.credentials.getToken('storage')
storage_options = {'bearer_token': access_token, 'use_fabric_endpoint': 'true'}
dt = DeltaTable(
    'abfss://<ws-guid>@onelake.dfs.fabric.microsoft.com/<lh-guid>/Tables/schema/table',
    storage_options=storage_options
)
df = dt.to_pandas()
```

### Python: Lakehouse with DuckDB

```python
import duckdb
from deltalake import DeltaTable

access_token = notebookutils.credentials.getToken('storage')
storage_options = {'bearer_token': access_token, 'use_fabric_endpoint': 'true'}
dt = DeltaTable('abfss://...', storage_options=storage_options)
arrow_ds = dt.to_pyarrow_dataset()

# DuckDB queries Arrow datasets with filter pushdown
result = duckdb.sql("SELECT count(*) FROM arrow_ds").df()
```

### Python: Write to Lakehouse with delta-rs

```python
from deltalake.writer import write_deltalake
write_deltalake('/lakehouse/default/Tables/output', df, mode='overwrite')
```

### Python: T-SQL via notebookutils.data (Warehouse, SQL Database, Lakehouse)

```python
# connect_to_artifact supports: Warehouse (full DML), Lakehouse (read-only),
# SQLDatabase (full DML), MirroredDatabase (read-only)
with notebookutils.data.connect_to_artifact('WarehouseName') as conn:
    conn.query('CREATE TABLE dbo.test (id INT, name VARCHAR(100))')
    conn.query("INSERT INTO dbo.test VALUES (1, 'hello')")
    df = conn.query('SELECT * FROM dbo.test')
    print(df)

# Cross-workspace
conn = notebookutils.data.connect_to_artifact(
    'warehouse_name', workspace='<workspace-guid>', artifact_type='Warehouse'
)
```

`notebookutils.data` is Python notebook only; not available in PySpark.

### PySpark: Write to Warehouse (synapsesql connector)

```python
import com.microsoft.spark.fabric
from com.microsoft.spark.fabric.Constants import Constants

df.write.synapsesql("WarehouseName.dbo.table", mode="overwrite")
df = spark.read.synapsesql("WarehouseName.dbo.table")
```

Requires Runtime 1.3+. Known to fail with opaque errors from `fab job run`; use `fab open` to check Spark logs in the portal.

## Running Notebooks

```bash
# Synchronous (wait for completion)
fab job run "ws.Workspace/ETL.Notebook"

# With timeout
fab job run "ws.Workspace/ETL.Notebook" --timeout 600

# Asynchronous
fab job start "ws.Workspace/ETL.Notebook"
fab job run-status "ws.Workspace/ETL.Notebook" --id <job-id>

# With parameters
fab job run "ws.Workspace/ETL.Notebook" -P date:string=2025-01-01,batch:int=500

# With Spark configuration (PySpark only)
fab job run "ws.Workspace/ETL.Notebook" -C '{
  "defaultLakehouse": {"name": "MainLH", "id": "<lh-id>", "workspaceId": "<ws-id>"},
  "conf": {"spark.sql.shuffle.partitions": "200"}
}'
```

## Getting Notebook Run Outputs

Cell outputs from completed runs are **not available via any REST API**. The `fab export` and `fab get -q definition` commands return cell source code only; outputs are stored in portal-only snapshots.

**Workaround**: write notebook results to a lakehouse table or file, then read them back with DuckDB or `fab cp`:

```python
# In notebook: write results to lakehouse instead of just printing
import pandas as pd
from deltalake.writer import write_deltalake

results = pd.DataFrame({'metric': ['latest_date', 'row_count'], 'value': ['2025-10-14', '541']})
write_deltalake('/lakehouse/default/Tables/notebook_results', results, mode='overwrite')
```

```bash
# From CLI: read results with DuckDB
duckdb -c "
LOAD delta; LOAD azure;
CREATE SECRET (TYPE azure, PROVIDER credential_chain, CHAIN 'cli');
SELECT * FROM delta_scan('abfss://<ws-id>@onelake.../<lh-id>/Tables/notebook_results');
"
```

## Reducing Startup Times

| Scenario | Approach | Startup |
|----------|----------|---------|
| No custom libs | Starter pool (default) | 5-10s |
| Need T-SQL, DuckDB, or quick tasks | Python notebook | ~5s |
| Custom libs, scheduled work | Custom Live Pool + Full mode env | ~5s |
| Multiple notebooks, same config | High Concurrency Mode | First: normal; rest: instant |
| Private Link / Managed VNet | Custom pool (unavoidable) | 2-5 min |

**Custom Live Pools**: Workspace Settings > Spark > Pool > New Pool; attach Environment with Full mode publish; enable Live Pool schedule.

**High Concurrency Mode**: Multiple notebooks share one Spark session. Enable in Workspace Settings > Spark > High Concurrency. Use session tags in pipelines to group notebooks.

**Python notebooks**: Skip Spark entirely. DuckDB, Polars, and delta-rs handle most single-node workloads.

## Python %%configure (Scale Up)

Python notebooks default to 2 vCores / 16GB. Scale up with `%%configure` in the first cell:

```json
%%configure -f
{
    "vCores": 8,
    "defaultLakehouse": {
        "name": "MyLH",
        "id": "<lakehouse-guid>",
        "workspaceId": "<workspace-guid>"
    },
    "mountPoints": [
        {
            "mountPoint": "/myMount",
            "source": "abfss://<container>@<account>.dfs.core.windows.net/<path>"
        }
    ]
}
```

Supported vCores: 4, 8, 16, 32, 64 (8GB RAM per vCore).

## Scheduling

`fab job run-sch` creates per-item schedules. Schedules survive workspace git sync and deployment-pipeline promotion as long as the item keeps its ID.

```bash
# Daily at 02:00 (single time)
fab job run-sch "ws.Workspace/ETL.Notebook" \
  --type daily \
  --interval 02:00 \
  --enable

# Daily at two times (comma-separated) starting from an explicit datetime
fab job run-sch "ws.Workspace/Pipeline.DataPipeline" \
  --type daily \
  --interval 10:00,16:00 \
  --start 2024-11-15T09:00:00 \
  --enable

# Weekly on specific days
fab job run-sch "ws.Workspace/Pipeline.DataPipeline" \
  --type weekly \
  --interval 10:00 \
  --days Monday,Friday \
  --enable

# Cron-style: every 5 minutes
fab job run-sch "ws.Workspace/Nb.Notebook" \
  --type cron \
  --interval 5 \
  --enable
```

### Update or disable an existing schedule

Each schedule has its own ID; list with `fab job run-list --schedule` or read from `fab api "workspaces/<ws-id>/items/<item-id>/jobs/.../schedules"`.

```bash
# Disable without deleting (pauses runs; preserves the schedule record)
fab job run-update "ws.Workspace/Pipeline.DataPipeline" \
  --id <schedule-id> \
  --disable

# Switch a daily schedule to cron-every-5-minutes in place
fab job run-update "ws.Workspace/Pipeline.DataPipeline" \
  --id <schedule-id> \
  --type cron \
  --interval 5 \
  --enable

# Remove a schedule entirely
fab job run-rm "ws.Workspace/Pipeline.DataPipeline" \
  --id <schedule-id> -f
```

### List execution history

```bash
# All runs (manual + scheduled)
fab job run-list "ws.Workspace/ETL.Notebook"

# Scheduled runs only
fab job run-list "ws.Workspace/ETL.Notebook" --schedule
```

## Monitoring and Management

```bash
# Cancel running job
fab job run-cancel "ws.Workspace/ETL.Notebook" --id <job-id>

# Cancel and wait for the cancellation to complete
fab job run-cancel "ws.Workspace/ETL.Notebook" --id <job-id> --wait

# Export / import
fab export "ws.Workspace/ETL.Notebook" -o /tmp/notebooks -f
fab import "ws.Workspace/ETL.Notebook" -i /tmp/notebooks/ETL.Notebook -f

# Copy between workspaces
fab cp "Dev.Workspace/ETL.Notebook" "Prod.Workspace" -f

# Delete (recovery depends on tenant Item Recovery setting; see reference.md)
fab rm "ws.Workspace/Old.Notebook" -f

# Open in browser
fab open "ws.Workspace/ETL.Notebook"

# Open in VS Code (Synapse extension required)
# vscode://SynapseVSCode.synapse?workspaceId=<ws-id>&artifactId=<nb-id>&tenantId=<tenant-id>
```

## Example Notebooks

Working examples in `examples/`:

- **`examples/python-notebook.ipynb`** -- Python kernel with delta-rs, DuckDB, and `notebookutils.data` T-SQL patterns
- **`examples/pyspark-notebook.ipynb`** -- PySpark kernel with Spark SQL read and `saveAsTable` write patterns
