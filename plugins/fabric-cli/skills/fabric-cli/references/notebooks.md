# Notebooks

Create, import, run, schedule and read results from Fabric notebooks with `fab`. Two notebook kinds exist (Python and PySpark); the `.ipynb` metadata decides which one you get.

## Learn

```yaml
notebook REST: https://learn.microsoft.com/en-us/rest/api/fabric/notebook/items
job scheduler REST: https://learn.microsoft.com/en-us/rest/api/fabric/core/job-scheduler
notebook definition: https://learn.microsoft.com/en-us/rest/api/fabric/articles/item-management/definitions/notebook-definition
notebookutils: https://learn.microsoft.com/en-us/fabric/data-engineering/notebook-utilities
Livy API: https://learn.microsoft.com/en-us/fabric/data-engineering/api-livy-overview
```

- `fab job run` runs a notebook as a batch job and never returns cell output
- To run code and see output without a notebook, use Livy sessions (see [querying-data.md](./querying-data.md)) or the separate `nb` CLI (data-goblin/nb-cli, not part of fab)
- Examples: `examples/python-notebook.ipynb`, `examples/pyspark-notebook.ipynb`

## Choosing a kernel

```yaml
python notebook: single node (2 vCores by default), starts in about 5 s, DuckDB and Polars preinstalled, Delta via delta-rs, T-SQL to warehouses via notebookutils.data; use for data that fits in memory and quick agent work
pyspark notebook: Spark cluster (4+ vCores), starter pool 5 to 10 s, cold start up to minutes, native Delta, distributed; use for large data and Spark SQL
livy sessions: always Spark compute with a `spark` session; there is no lightweight Python runtime through Livy
```

- Spark runtime: GA default is Runtime 2.0 (Spark 4.1); 1.3 is end-of-support-announced and 1.2 is retired, so do not set `runtimeVersion` to 1.2
- `notebookutils.data` (T-SQL: Warehouse and SQL database read/write, Lakehouse and mirrored database read-only) works in Python notebooks only, not PySpark
- The Spark warehouse connector `synapsesql` needs Runtime 1.3 or later and fails with opaque errors through `fab job run`; use `fab open` to read the Spark log in the portal

## Metadata that selects the kernel

Wrong or missing fields give the wrong kernel or a silent import failure.

```yaml
python:
  kernel_info: {name: jupyter, jupyter_kernel_name: python3.11}
  language_info: {name: python}
  microsoft: {language: python, language_group: jupyter_python}
  kernelspec: {name: jupyter, display_name: Jupyter}
pyspark:
  kernel_info: {name: synapse_pyspark}
  language_info: {name: python}
  microsoft: {language: python, language_group: synapse_pyspark}
cells: each cell repeats microsoft.language_group in its own metadata
```

### Attaching data items

Without a `dependencies` block, lakehouse paths and `notebookutils.data` calls fail.

```yaml
lakehouse: {default_lakehouse: <guid>, default_lakehouse_name: <name>, default_lakehouse_workspace_id: <ws guid>, known_lakehouses: [{id: <guid>}]}
warehouse: {default_warehouse: <guid>, known_warehouses: [{id: <guid>, type: Datawarehouse}]}
warehouse type: Datawarehouse (warehouse) | Lakewarehouse (lakehouse SQL endpoint) | MountedWarehouse (SQL database)
```

Get the GUIDs with `fab get "ws.Workspace/Item.Type" -q id`; lakehouse and warehouse may coexist.

## Import and run

```yaml
MyNotebook.Notebook/:
  .platform: required; metadata.displayName must match the item name; metadata.type Notebook
  notebook-content.ipynb: required
```

```bash
fab import "ws.Workspace/MyNotebook.Notebook" -i ./MyNotebook.Notebook -f
fab job run "ws.Workspace/MyNotebook.Notebook" --timeout 600
```

- `fab import` on fab 1.7 or earlier took 25 to 60 s because it polled the create LRO at the server's `Retry-After: 20`, though the work itself finishes in about 1 s; fab 1.9.0 release notes say LRO polling was improved, so re-measure there
- `uv run ${CLAUDE_SKILL_DIR}/scripts/deploy_notebook.py` tight-polls (about 0.3 s, `--poll-interval`) and deploys in 1 to 2 s; it detects create versus update (see [import-download-deploy.md](./import-download-deploy.md))

```yaml
"Not supported language": language_info.name missing
"failed without detail error", instant: bad metadata or missing attachment
"failed without detail error", about 40 s: code error; open in the portal (fab open) for the traceback
NameError spark: no default lakehouse attached (PySpark)
module has no attribute: wrong notebookutils API name; call notebookutils.data.help()
```

## Run options

```bash
fab job run "ws.Workspace/ETL.Notebook" -P date:string=2025-01-01,batch:int=500
fab job run "ws.Workspace/ETL.Notebook" -C '{"defaultLakehouse": {"name": "MainLH", "id": "<lh-id>", "workspaceId": "<ws-id>"}, "conf": {"spark.sql.shuffle.partitions": "200"}}'
fab job start "ws.Workspace/ETL.Notebook"
fab job run-status "ws.Workspace/ETL.Notebook" --id <job-id>
fab job run-cancel "ws.Workspace/ETL.Notebook" --id <job-id> --wait
```

- Parameter types for notebooks: `string`, `int`, `float`, `bool`; `-C` Spark configuration applies to PySpark only
- `fab job start` is async only in 1.7.0; 1.9.0 adds `--wait`, `--timeout` and `--polling_interval`
- Python notebooks default to 2 vCores and 16 GB; scale in the first cell with `%%configure -f` and `{"vCores": 8, ...}` (4, 8, 16, 32 or 64, 8 GB per vCore)
- Startup: starter pool 5 to 10 s; custom libraries need a custom pool with a Full-mode environment (about 5 s with a Live Pool); several notebooks sharing config can use High Concurrency mode; Private Link or managed VNet forces a custom pool and 2 to 5 min startup

## Reading results

Rendered cell output (stdout, `df.show()`) of a finished run is not available from any REST API; `fab export` returns source only. Write results to a lakehouse table or file inside the notebook and read them back with DuckDB or `fab cp`.

### The exit value is the only real success signal

`Completed` means the process ended, not that the ETL worked: a notebook that catches its own exception and calls `notebookutils.notebook.exit(json.dumps({"ok": False, ...}))` still reports `Completed`. The exit value comes from the notebook job-instance route, which is documented but Beta and needs `beta=true`:

```bash
fab api "workspaces/$WS/notebooks/$NB/jobs/execute/instances/$RUN" -P beta=true -q "text.properties.exitValue"
```

- `exitValue` is a string; parse it when it is JSON
- The GA route `items/{id}/jobs/instances/{run}` returns `status` and `failureReason` only, no `exitValue`
- Get `$RUN` from `fab job run-list "ws.Workspace/Nb.Notebook"` or from the `--id` you passed to `fab job run-status`
- The same beta response has `properties.computeDetails.monitoringInfo` with `executionSnapshotUrl` (portal snapshot with the traceback) and, for Spark, `sparkUiUrl`, `driverLogUrl`, `activityDetails.sparkApplicationId`
- Status `Deduped` means the same job was already running and the notebook did not execute; treat it as not run
- `uv run ${CLAUDE_SKILL_DIR}/scripts/run_notebook_checked.py` starts the run, polls, reads the exit value and exits 2 when the notebook says `ok: false` despite `Completed`, 1 for Failed or Cancelled, 3 for Deduped; end notebooks with `notebookutils.notebook.exit(json.dumps({"ok": True, "summary": "..."}))`
- The `executing-spark` skill (etl plugin) covers Livy statements, which return output directly

## Scheduling

```bash
fab job run-sch "ws.Workspace/ETL.Notebook" --type daily --interval 02:00 --enable
fab job run-sch "ws.Workspace/Nb.Notebook" --type weekly --interval 10:00 --days Monday,Friday --enable
fab job run-sch "ws.Workspace/Nb.Notebook" --type cron --interval 5 --enable
fab job run-list "ws.Workspace/ETL.Notebook" --schedule
fab job run-update "ws.Workspace/ETL.Notebook" --id <schedule-id> --disable
fab job run-rm "ws.Workspace/ETL.Notebook" --id <schedule-id> -f
```

- `--start` and `--end` are UTC; in the raw scheduler JSON `localTimeZoneId` is a Windows time-zone id (`Central Standard Time`), not an IANA name; the wrong one shifts every run
- Maximum 20 schedules per item
- Schedules survive git sync and deployment-pipeline promotion while the item keeps its id
- An on-demand run is `POST items/{id}/jobs/{jobType}/instances` (notebook jobType `RunNotebook`), which `fab job run` and `fab job start` call

## Export, copy, delete

```bash
fab export "ws.Workspace/ETL.Notebook" -o ./out --format py -f
fab cp "Dev.Workspace/ETL.Notebook" "Prod.Workspace" -f
```

- `--format ipynb` (default) keeps cell structure; `py` is flat source
- `fab rm` is permanent unless the tenant has item recovery on (see [commands.md](./commands.md))
