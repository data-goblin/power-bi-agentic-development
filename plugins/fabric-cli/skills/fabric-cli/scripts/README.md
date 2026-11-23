# Fabric CLI Utility Scripts

Python scripts extending `fab` CLI with common operations. All scripts use the same path syntax as fab commands.

## Path Syntax

All scripts use Fabric path format: `Workspace.Workspace/Item.ItemType`

```bash
# Examples
"Sales.Workspace/Model.SemanticModel"
"Production.Workspace/LH.Lakehouse"
"Dev.Workspace/Report.Report"
```

## Scripts

### create_direct_lake_model.py

Create a Direct Lake semantic model from lakehouse tables. This is the recommended approach for querying lakehouse data via DAX.

```bash
uv run create_direct_lake_model.py "src.Workspace/LH.Lakehouse" "dest.Workspace/Model.SemanticModel" -t schema.table
uv run create_direct_lake_model.py "Sales.Workspace/SalesLH.Lakehouse" "Sales.Workspace/Sales Model.SemanticModel" -t gold.orders
```

Arguments:

- `source` - Source lakehouse: Workspace.Workspace/Lakehouse.Lakehouse
- `dest` - Destination model: Workspace.Workspace/Model.SemanticModel
- `-t, --table` - Table in schema.table format (required)

### execute_dax.py

Execute DAX queries against semantic models.

```bash
uv run execute_dax.py "ws.Workspace/Model.SemanticModel" -q "EVALUATE VALUES('Date'[Year])"
uv run execute_dax.py "Sales.Workspace/Sales Model.SemanticModel" -q "EVALUATE TOPN(10, 'Orders')" --format csv
uv run execute_dax.py "ws.Workspace/Model.SemanticModel" -q "EVALUATE ROW(\"Total\", SUM('Sales'[Amount]))" -o results.json
```

Options:

- `-q, --query` - DAX query (required)
- `-o, --output` - Output file
- `--format` - Output format: table (default), csv, json
- `--include-nulls` - Include null values

### query_lakehouse_duckdb.py

Query Delta tables in a Fabric Lakehouse or Warehouse via DuckDB against OneLake. Resolves workspace and item IDs via `fab`, builds the `abfss://` path, and shells out to `duckdb` with the `delta` and `azure` extensions preloaded. Reuses the current `az login` session through the `credential_chain` provider ; no password, SPN secret, or token file is needed.

```bash
# Single-table query: `tbl` is substituted with delta_scan() of the given table
uv run query_lakehouse_duckdb.py "ws.Workspace/LH.Lakehouse" \
    -q "SELECT * FROM tbl LIMIT 10" -t gold.orders

# Raw SQL with your own delta_scan() calls (multi-table joins, Files/* reads)
uv run query_lakehouse_duckdb.py "ws.Workspace/LH.Lakehouse" \
    --sql "SELECT count(*) FROM delta_scan('abfss://.../Tables/silver/events')"

# CSV output, save to file
uv run query_lakehouse_duckdb.py "ws.Workspace/LH.Lakehouse" \
    -q "SELECT * FROM tbl" -t regions --format csv -o regions.csv
```

Options:

- `-q, --query` - SQL query with `tbl` placeholder (requires `-t`)
- `--sql` - Raw SQL script with your own `delta_scan()` / `read_csv` / `read_json_auto` calls
- `-t, --table` - Table name as `schema.table` or just `table` for default schema
- `-o, --output` - Output file
- `--format` - Output format: table (default), csv, json
- `--print-path` - Print the resolved `abfss://` path and exit (useful for debugging)

Requires `duckdb` CLI (`brew install duckdb`) and `az login`.

### query_sql_endpoint.py

Query a Fabric Lakehouse SQL endpoint, Warehouse, or SQL Database via `sqlcmd`. Detects the item type from the path, resolves the SQL host via the correct property (`properties.sqlEndpointProperties.connectionString` for lakehouses, `properties.connectionString` for warehouses, `properties.serverFqdn` for SQL databases), and invokes `sqlcmd` with `--authentication-method ActiveDirectoryAzCli` so the current `az login` session is reused.

```bash
# Inline query against a lakehouse SQL endpoint
uv run query_sql_endpoint.py "ws.Workspace/LH.Lakehouse" \
    -q "SELECT TOP 10 * FROM dbo.orders"

# Warehouse, csv output, save to file
uv run query_sql_endpoint.py "ws.Workspace/WH.Warehouse" \
    -q "SELECT name FROM sys.tables" --format csv -o tables.csv

# SQL Database, multi-statement .sql file
uv run query_sql_endpoint.py "ws.Workspace/MyDB.SQLDatabase" --file ./migration.sql

# JSON output for piping
uv run query_sql_endpoint.py "ws.Workspace/LH.Lakehouse" \
    -q "SELECT TOP 3 Territory, Region FROM dbo.regions" --format json
```

Options:

- `-q, --query` - Inline T-SQL query
- `--file` - Path to a `.sql` file (supports multi-statement with `GO` separators)
- `-d, --database` - Override database name (defaults to item display name)
- `-o, --output` - Output file
- `--format` - Output format: table (default), csv, json (json is emitted via CSV + parser)
- `--print-host` - Print the resolved SQL host and exit

Requires `sqlcmd` (go-sqlcmd >= 1.9; `brew install sqlcmd` or `winget install --id Microsoft.Sqlcmd`) and `az login`.

### get_semantic_model_ai_metadata.py

Retrieve semantic model AI instructions and AI schema using `fab get -q definition -f`. The parser understands both documented Copilot sidecars and TMDL culture `linguisticMetadata`.

```bash
uv run get_semantic_model_ai_metadata.py "ws.Workspace/Model.SemanticModel"
uv run get_semantic_model_ai_metadata.py "ws.Workspace/Model.SemanticModel" \
  --instructions-out instructions.md --schema-out schema.json
fab get "ws.Workspace/Model.SemanticModel" -q "definition" -f > definition.json
uv run get_semantic_model_ai_metadata.py --definition-file definition.json
```

Options:

- `--culture` - filter TMDL culture metadata to one culture
- `--instructions-out` - write the first instruction payload to a Markdown file
- `--schema-out` - write the first schema payload to a JSON file
- `--format text` - print only the first instructions payload

### get_semantic_model_ai_metadata.py

Read semantic model AI instructions and AI schema from a Fabric semantic model
definition. This is the service-definition roundtrip path for metadata managed
through Tabular Editor or the VS Code extension.

```bash
uv run get_semantic_model_ai_metadata.py \
  "Sales.Workspace/Sales Model.SemanticModel" --format json

uv run get_semantic_model_ai_metadata.py \
  "Sales.Workspace/Sales Model.SemanticModel" \
  --instructions-out instructions.md --schema-out schema.json
```

For offline parsing of a saved Fabric definition payload:

```bash
fab get "Sales.Workspace/Sales Model.SemanticModel" -q definition -f > definition.json
uv run get_semantic_model_ai_metadata.py --definition-file definition.json --format json
```

The script reads friendly Copilot files and culture `linguisticMetadata`,
preferring friendly files when both are present.

### run_notebook_checked.py

Run a Fabric notebook and check its **real** outcome, not just the job status. `fab job run` reports `Completed` whenever the notebook process finished -- even when the notebook caught its own exception and returned `notebookutils.notebook.exit(json.dumps({"ok": False, ...}))`. This script starts the run (via `fab job start`, so `-P` param translation is fab's job), polls the GA instance endpoint to a terminal status, then reads `properties.exitValue` from the notebook job-instance beta endpoint and turns the notebook's own verdict into an exit code.

```bash
# Run and verify
uv run run_notebook_checked.py "ws.Workspace/ETL.Notebook"

# With parameters, JSON output
uv run run_notebook_checked.py "ws.Workspace/ETL.Notebook" -P "date:string=2025-01-01" --format json

# Read the exit value of an existing run without starting a new one
uv run run_notebook_checked.py "ws.Workspace/ETL.Notebook" --run-id <instance-id>
```

Exit codes: `0` completed and exit-value verdict ok; `2` completed but the notebook's `{ok:false}` verdict failed; `1` job Failed/Cancelled or an operational error; `3` `Deduped` (skipped, did not run).

Options:

- `-P, --params` - Parameters as `name:type=value`, comma-separated (passed to fab)
- `-C, --config` - Notebook config JSON, inline or path (passed to fab)
- `--run-id` - Read an existing run's exit value; do not start a new run
- `--timeout` - Poll timeout in seconds (default: 1800)
- `--poll-interval` - Poll interval in seconds (default: 5)
- `--format` - Output format: table (default), json

The `?beta=true` notebook job-instance route is an officially documented but Beta Fabric API (the GA status route does not expose `exitValue`); Microsoft marks it not-for-production and it may change. Requires `fab` and `az login`.

### task_flow.py

Create, update, export and delete a workspace task flow (the canvas at the top of the workspace view). Task flows have no public API and no `fab` command; the script calls the internal Power BI metadata endpoints the Fabric UI uses (`taskflow202602` to list, `taskflow202512` to write, `If-Match` on the etag), so it can break without notice.

```bash
uv run task_flow.py list "Sales"
uv run task_flow.py get "Sales" > flow.json            # current flow as a spec apply takes back
uv run task_flow.py apply "Sales" -s flow.json          # create, or update the existing flow in place
uv run task_flow.py apply "Sales" -s flow.json --dry-run
uv run task_flow.py delete "Sales" --flow "Order to cash"
uv run task_flow.py types                               # public item type -> internal artifactType
```

A spec names tasks (`get data`, `store data`, `prepare data`, `develop`, `visualize`, ...), their canvas position, their items as `<displayName>.<Type>`, and edges between task keys; see the script docstring. Fabric items are stored as `<artifactType>:<guid>` with internal type names (Notebook is `SynapseNotebook`, GraphModel is `GraphIndex`); Power BI items keep a classic form the UI requires: report `2:<guid>`, semantic model `3:<numeric model id>`. Dashboards, paginated reports and datamarts are refused because their form has not been observed.

Options:

- `--flow` - Flow name, id or resourceId; needed only when a workspace has several
- `--raw` - `get` prints the backend JSON instead of a spec
- `--dry-run` - `apply` prints the request body and sends nothing
- `--format` - Output format before the subcommand: text (default), json

### download_workspace.py

Download complete workspace with all items and lakehouse files.

```bash
uv run download_workspace.py "Sales.Workspace"
uv run download_workspace.py "Production.Workspace" ./backup
uv run download_workspace.py "Dev.Workspace" --no-lakehouse-files
```

Options:

- `output_dir` - Output directory (default: ./workspace_downloads/<name>)
- `--no-lakehouse-files` - Skip lakehouse file downloads

## Requirements

- Python 3.10+
- `fab` CLI installed and authenticated
- For lakehouse file downloads: `azure-storage-file-datalake`, `azure-identity`
