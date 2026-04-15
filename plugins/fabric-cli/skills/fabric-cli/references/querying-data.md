# Querying Data

How to query semantic models in DAX and lakehouses, warehouses, or SQL databases in SQL.

## Wrapper scripts (recommended)

Three Python scripts in `scripts/` wrap the raw `fab api` / `duckdb` / `sqlcmd` invocations and handle path resolution, ID lookup, host discovery, auth, and output formatting for you. Prefer them over hand-rolled commands unless you need a feature they don't expose.

- **DAX against a semantic model** ; [`scripts/execute_dax.py`](../scripts/execute_dax.py): resolves workspace and model IDs, posts to `executeQueries`, and formats results as table/csv/json.
- **Delta over OneLake (lakehouse / warehouse)** ; [`scripts/query_lakehouse_duckdb.py`](../scripts/query_lakehouse_duckdb.py): resolves workspace and lakehouse IDs, builds the `abfss://` path, shells out to `duckdb` with the `delta` and `azure` extensions preloaded, and strips the `CREATE SECRET` preamble noise from the output.
- **T-SQL over any SQL-capable item** ; [`scripts/query_sql_endpoint.py`](../scripts/query_sql_endpoint.py): detects item type (Lakehouse, Warehouse, SQLDatabase), resolves the SQL host via the right property path, and invokes `sqlcmd --authentication-method ActiveDirectoryAzCli`. See [scripts/README.md](../scripts/README.md) for full argument reference.

The sections below explain the raw commands these scripts wrap ; use them when you need to extend, debug, or understand what the scripts do.

## Query Lakehouse or Warehouse Data with DuckDB

DuckDB can query Delta Lake tables and raw files directly from OneLake using the `delta` and `azure` core extensions. This is the fastest way to explore, validate, and analyze lakehouse data without creating a semantic model. For routine single-table queries, prefer [`scripts/query_lakehouse_duckdb.py`](../scripts/query_lakehouse_duckdb.py); the raw form is documented below for reference and for multi-table joins or `Files/` raw-file reads.

### Prerequisites

- DuckDB installed (`brew install duckdb` on macOS)
- Azure CLI authenticated (`az login`); the same session used by `fab`

### Setup

```sql
INSTALL delta;
INSTALL azure;
```

### Querying Delta Tables

Delta tables in a lakehouse are stored at `Tables/<schema>/<table>`. Query them with `delta_scan()`:

```bash
# Query a delta table using friendly names (recommended)
duckdb -c "
LOAD delta; LOAD azure;
CREATE SECRET (TYPE azure, PROVIDER credential_chain, CHAIN 'cli');

SELECT * FROM delta_scan(
  'abfss://my-workspace@onelake.dfs.fabric.microsoft.com/MyLH.Lakehouse/Tables/schema/table_name'
) LIMIT 10;
"
```

The `CHAIN 'cli'` parameter tells the azure extension to use Azure CLI credentials; without it, DuckDB tries managed identity first (which fails on local machines).

**Note:** The `.Lakehouse` suffix is required when using friendly names. For tables in the default `dbo` schema, GUID-based paths also work (see [OneLake Path Format](#onelake-path-format)).

### Querying Raw Files

Files stored under `Files/` can be queried directly by format:

```bash
BASE="abfss://${WS_ID}@onelake.dfs.fabric.microsoft.com/${LH_ID}/Files"

duckdb -c "
LOAD azure;
CREATE SECRET (TYPE azure, PROVIDER credential_chain, CHAIN 'cli');

-- CSV files
SELECT * FROM read_csv('${BASE}/data/sales.csv') LIMIT 10;

-- JSON files
SELECT * FROM read_json('${BASE}/exports/report.json') LIMIT 10;

-- Parquet files
SELECT * FROM read_parquet('${BASE}/warehouse/facts.parquet') LIMIT 10;

-- Glob pattern: read all JSON files in a directory tree
SELECT count(*) FROM read_json('${BASE}/2025/01/*/activity_*.json');
"
```

Supported formats: CSV, JSON, Parquet. Glob patterns (`*`, `**`) work for reading multiple files at once.

### OneLake Path Format

OneLake supports two path formats: **friendly names** and **GUIDs**.

```
# Friendly names (recommended for schema tables)
abfss://<workspace-name>@onelake.dfs.fabric.microsoft.com/<item-name>.<ItemType>/Tables/<schema>/<table>

# GUIDs
abfss://<workspace-id>@onelake.dfs.fabric.microsoft.com/<item-id>/Tables/<schema>/<table>
```

**IMPORTANT: Use friendly names for schema-namespaced tables.** The GUID format fails with "Bad Request" when reading parquet files from schema subfolders (e.g., `Tables/bronze/orders`). Friendly names work reliably for all table paths including nested schemas.

```bash
# GUID format -- works for dbo tables, FAILS for schema tables
WS_ID=$(fab get "ws.Workspace" -q "id" | tr -d '"')
LH_ID=$(fab get "ws.Workspace/LH.Lakehouse" -q "id" | tr -d '"')
delta_scan('abfss://${WS_ID}@onelake.dfs.fabric.microsoft.com/${LH_ID}/Tables/dbo/my_table')          # OK
delta_scan('abfss://${WS_ID}@onelake.dfs.fabric.microsoft.com/${LH_ID}/Tables/bronze/my_table')       # FAILS

# Friendly name format -- works for ALL tables including schemas
delta_scan('abfss://my-workspace@onelake.dfs.fabric.microsoft.com/MyLH.Lakehouse/Tables/bronze/my_table')  # OK
delta_scan('abfss://my-workspace@onelake.dfs.fabric.microsoft.com/MyLH.Lakehouse/Tables/dbo/my_table')     # OK
```

| Item type | Friendly name format | Notes |
|-----------|---------------------|-------|
| Lakehouse | `abfss://ws@onelake.../LH.Lakehouse/Tables/...` | Direct Delta tables |
| Warehouse | `abfss://ws@onelake.../WH.Warehouse/Tables/...` | Direct Delta tables |
| SQL Database | `abfss://ws@onelake.../DB.SQLDatabase/Tables/...` | Auto-mirrored Delta; ~15s replication delay; extra `MSSQL_System_Uniquifier` column |

Cross-item joins work in a single DuckDB query; use different `abfss://` paths for each item.

### Common Use Cases

#### Data freshness check

```sql
-- Find the most recent records in a table
SELECT max(date_column) as latest_date, count(*) as total_rows
FROM delta_scan('abfss://.../<lh-id>/Tables/gold/orders');
```

#### Data quality validation

```sql
-- Check for nulls, duplicates, and value distributions
SELECT
  count(*) as total,
  count(DISTINCT customer_id) as unique_customers,
  count(*) FILTER (WHERE amount IS NULL) as null_amounts,
  min(order_date) as earliest,
  max(order_date) as latest
FROM delta_scan('abfss://.../<lh-id>/Tables/silver/orders');
```

#### Schema discovery for semantic model design

```sql
-- Explore column names, types, and sample values before building a model
DESCRIBE SELECT * FROM delta_scan('abfss://.../<lh-id>/Tables/gold/customers');

-- Profile a table to understand cardinality and distributions
SELECT
  column_name,
  column_type,
  count,
  approx_count_distinct,
  null_percentage
FROM (SUMMARIZE delta_scan('abfss://.../<lh-id>/Tables/gold/customers'));
```

#### Cross-table joins without a semantic model

```sql
-- Join multiple lakehouse tables directly
SELECT o.order_date, c.customer_name, sum(o.amount) as total
FROM delta_scan('.../Tables/gold/orders') o
JOIN delta_scan('.../Tables/gold/customers') c ON o.customer_id = c.customer_id
GROUP BY 1, 2
ORDER BY 3 DESC
LIMIT 20;
```

#### Row count audit across schemas

```sql
SELECT 'gold.orders' as tbl, count(*) as rows FROM delta_scan('.../Tables/gold/orders')
UNION ALL
SELECT 'gold.customers', count(*) FROM delta_scan('.../Tables/gold/customers')
UNION ALL
SELECT 'silver.orders', count(*) FROM delta_scan('.../Tables/silver/orders')
ORDER BY tbl;
```

### Limitations

- **Read-only**: DuckDB reads Delta tables but cannot write back (append-only writes exist but are not recommended for lakehouse tables)
- **Auth**: Requires Azure CLI login or service principal; does not work with Fabric-only tokens
- **Path format matters**: Use friendly names (not GUIDs) for tables in non-default schemas; see [OneLake Path Format](#onelake-path-format)

## sqlcmd Over Lakehouse, Warehouse, and SQL Database

Every Fabric Lakehouse exposes a read-only T-SQL endpoint, every Warehouse and SQL Database is fully T-SQL native, and all three accept the same `sqlcmd` invocation. When the table you need is already surfaced through the SQL endpoint, `sqlcmd` is often simpler than DuckDB (no `abfss://` path construction, no Azure extension setup, full T-SQL including `INFORMATION_SCHEMA`, `sys.*`, CTEs, window functions) and simpler than PySpark (no session warmup, no notebook plumbing).

For routine queries, prefer [`scripts/query_sql_endpoint.py`](../scripts/query_sql_endpoint.py); it auto-detects item type, resolves the SQL host, and handles all of the flag plumbing below. The raw-`sqlcmd` walkthrough that follows explains what the script does under the hood and is worth reading before you extend it.

The pattern below reuses your existing `az login` session via the `ActiveDirectoryAzCli` authentication method. No password, no service principal, no token file ; `sqlcmd` reads the token straight from the `az` cache.

### Prerequisites

- `sqlcmd` (go-sqlcmd, v1.9.0 or later): `brew install sqlcmd` or `winget install --id Microsoft.Sqlcmd`
- `az login` with an identity that has at least `Viewer` on the workspace and `Read` on the SQL-side object
- `fab auth login` for endpoint discovery

### Discover the SQL endpoint

Fabric stores the SQL host under a different property depending on item type:

```bash
# Lakehouse SQL endpoint host (resolves to <id>.datawarehouse.pbidedicated.windows.net)
fab get "ws.Workspace/LH.Lakehouse" -q "properties.sqlEndpointProperties.connectionString"

# Warehouse host (resolves to <id>.datawarehouse.fabric.microsoft.com)
fab get "ws.Workspace/WH.Warehouse" -q "properties.connectionString"

# SQL Database host
fab get "ws.Workspace/SQLDB.SQLDatabase" -q "properties.serverFqdn"
```

The database name to pass to `sqlcmd -d` is the item's display name without the type extension (e.g. `LH` for `LH.Lakehouse`).

### Query a lakehouse table

```bash
SQL_HOST=$(fab get "ws.Workspace/LH.Lakehouse" -q "properties.sqlEndpointProperties.connectionString" | tr -d '"')

sqlcmd -S "$SQL_HOST" -d LH \
  --authentication-method ActiveDirectoryAzCli \
  -W -s "|" \
  -Q "SELECT TOP 10 * FROM dbo.orders"
```

Output:

```
OrderID|CustomerID|OrderDate|Amount
-------|----------|---------|------
1001|42|2024-03-15|199.50
1002|17|2024-03-15|83.20
...

Statement ID: {...} | Query hash: 0x... | Distributed request ID: {...}
(10 rows affected)
```

Fabric appends a `Statement ID | Query hash | Distributed request ID` footer to every successful query; use those values when opening a Fabric support ticket or correlating with `queryinsights.exec_requests_history`.

### Query a warehouse

Identical pattern, different property name for the host:

```bash
SQL_HOST=$(fab get "ws.Workspace/WH.Warehouse" -q "properties.connectionString" | tr -d '"')

sqlcmd -S "$SQL_HOST" -d WH \
  --authentication-method ActiveDirectoryAzCli \
  -W -s "|" \
  -Q "SELECT schema_name(schema_id) AS schema_name, name FROM sys.tables"
```

### Query a SQL Database

```bash
SQL_HOST=$(fab get "ws.Workspace/SQLDB.SQLDatabase" -q "properties.serverFqdn" | tr -d '"')

sqlcmd -S "$SQL_HOST" -d SQLDB \
  --authentication-method ActiveDirectoryAzCli \
  -W -s "|" \
  -Q "SELECT name FROM sys.objects WHERE type = 'U'"
```

### Useful sqlcmd flags

- `-W` ; strip trailing whitespace. Without this every column is padded to its max declared length and wraps off-screen; it is the single most important flag.
- `-s "|"` ; column separator. Pipe or tab works better than spaces for downstream parsing.
- `-h -1` ; suppress repeating column headers between result blocks.
- `-y 0 -Y 0` ; disable column truncation for `varchar(max)` / `nvarchar(max)`.
- `-o out.tsv` ; write to a file instead of stdout.
- `-Q "..."` ; run one query and exit (vs `-q` which keeps the session open).
- `-i query.sql` ; read SQL from a file; useful for multi-statement scripts with `GO` separators.
- `-b` ; return a non-zero exit code if any statement fails; essential inside CI/CD.
- `-m 11` ; only print error messages with severity >= 11 (suppresses DBCC / informational noise).

### Query a schema at once

The Fabric SQL endpoint supports `INFORMATION_SCHEMA` and `sys.*` metadata views, which DuckDB does not. Use them to explore a lakehouse without guessing table names:

```bash
sqlcmd -S "$SQL_HOST" -d LH \
  --authentication-method ActiveDirectoryAzCli \
  -W -s "|" \
  -Q "SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA NOT IN ('sys','INFORMATION_SCHEMA') ORDER BY TABLE_SCHEMA, TABLE_NAME"
```

### Lakehouse SQL endpoint quirks

- **Read-only**: the Lakehouse SQL endpoint does not support `INSERT`, `UPDATE`, `DELETE`, or `CREATE TABLE`. Use DuckDB, PySpark, or Warehouse T-SQL for writes.
- **Lag behind OneLake**: the SQL endpoint has its own metadata sync. A table created via Spark may take 10-60 seconds to appear in `INFORMATION_SCHEMA.TABLES`; if you just wrote and a query fails with `Invalid object name`, retry after a short sleep rather than debugging auth.
- **Schemas are case-sensitive**: `dbo.Orders` and `dbo.orders` are different objects if the underlying Delta path uses mixed case. Always confirm with `INFORMATION_SCHEMA.TABLES`.
- **Three-part names work within the same endpoint** (`<database>.<schema>.<table>`); four-part cross-endpoint queries do not.

### When to use sqlcmd vs DuckDB vs PySpark

- **sqlcmd**: you already know the table names, the query is standard T-SQL, and the host is reachable. First choice for ad-hoc exploration, schema discovery, data validation, smoke tests, and anything you'd paste into SSMS.
- **DuckDB**: you need to read Delta files directly (bypass the SQL endpoint sync lag), join across lakehouses in different workspaces, or use DuckDB-specific functions (`PIVOT`, `UNPIVOT`, `read_json_auto`). See [Query Lakehouse or Warehouse Data with DuckDB](#query-lakehouse-or-warehouse-data-with-duckdb).
- **PySpark**: you need to write back to Delta, run distributed transforms on large tables, use Delta-specific features (time travel, OPTIMIZE, VACUUM), or call the Fabric runtime's pre-installed libraries. See [Execute PySpark/Python Directly Against a Lakehouse](#execute-pysparkpython-directly-against-a-lakehouse-no-notebook).

## Execute PySpark/Python Directly Against a Lakehouse (No Notebook)

Run arbitrary PySpark or Python code on Fabric Spark compute without creating a notebook. Useful for ephemeral ETL, one-off transforms, data validation, or agent-driven compute that doesn't need a persistent artifact. Full read/write access to lakehouse Delta tables via Spark SQL.

### Using `nb exec code` (Recommended)

The `nb` CLI (`cargo install nb-fabric`) wraps the full session lifecycle: create, wait, submit, poll, print, and cleanup. Sessions are always cleaned up, even on errors.

```bash
# Python (default)
nb exec code "MyWorkspace/MyLH.Lakehouse" "print('hello')"

# PySpark (includes Spark context for SQL and DataFrames)
nb exec code "MyWorkspace/MyLH.Lakehouse" "spark.sql('SHOW TABLES').show()"

# Pipe code via stdin
echo "spark.sql('SELECT COUNT(*) FROM gold.orders').show()" | nb exec code "WS/LH.Lakehouse" -

# Multi-line code
nb exec code "MyWorkspace/MyLH.Lakehouse" "
df = spark.sql('SELECT category, COUNT(*) as n FROM products GROUP BY category ORDER BY n DESC')
df.show()
df.write.mode('overwrite').saveAsTable('product_summary')
print('Done')
"
```

Output goes to stdout; status and metadata go to stderr:

```
---- exec: PySpark ----
  Creating session...
  Waiting for idle...  (session a1b2c3d4)
  Session ready.
  Submitting code...
<your output here>
  Session cleaned up.
---- result ----
  session  a1b2c3d4-...
  runtime  PySpark
  duration 25.3s
  status   ok
```

Exit code is non-zero when the submitted code fails, so agents can check `$?`.

### Using the API Directly

For programmatic use without the `nb` CLI, call the Fabric REST API directly.

#### Prerequisites

- Azure CLI authenticated (`az login`)
- A lakehouse in the target workspace

#### How it works

1. **Create a session** against a lakehouse (provisions Spark compute)
2. **Submit code statements** one at a time; poll for results
3. **Read output** from the statement response (`output.data["text/plain"]`)
4. **Delete the session** when done

**CRITICAL: Always delete sessions when done.** Idle sessions consume Fabric capacity units (CUs). A forgotten session burns compute until it times out (default: 20 minutes idle). In a loop or automation, wrap session cleanup in a `finally` block.

#### Authentication

The API requires a token from `az account get-access-token --resource https://api.fabric.microsoft.com`. Tokens from `fab auth` do **not** work for storage access; the Fabric Token Manager rejects them for OneLake operations.

```python
import subprocess, json

result = subprocess.run(
    ["az", "account", "get-access-token", "--resource", "https://api.fabric.microsoft.com"],
    capture_output=True, text=True
)
token = json.loads(result.stdout)["accessToken"]
```

#### API Endpoints

```
Base: https://api.fabric.microsoft.com/v1/workspaces/{wsId}/lakehouses/{lhId}/livyapi/versions/2023-12-01

POST   /sessions                      Create session (kind: "pyspark")
GET    /sessions/{id}                 Check state (poll until "idle")
POST   /sessions/{id}/statements      Submit code
GET    /sessions/{id}/statements/{n}  Get result (poll until state: "available")
DELETE /sessions/{id}                 Delete session (always do this)
```

#### Example: Query and Transform

```python
import json, time, urllib.request

WS_ID = "<workspace-id>"
LH_ID = "<lakehouse-id>"
BASE = f"https://api.fabric.microsoft.com/v1/workspaces/{WS_ID}/lakehouses/{LH_ID}/livyapi/versions/2023-12-01"

def api(path, method="GET", body=None):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(f"{BASE}{path}", data=data, method=method, headers=headers)
    resp = urllib.request.urlopen(req)
    raw = resp.read().decode()
    return json.loads(raw) if raw else {}

# 1. Create session
session = api("/sessions", "POST", {"kind": "pyspark"})
session_id = session["id"]

try:
    # 2. Wait for idle
    while api(f"/sessions/{session_id}").get("state") != "idle":
        time.sleep(5)

    # 3. Submit code
    code = '''
    df = spark.sql("SELECT category, COUNT(*) as n, ROUND(AVG(price),2) as avg_price FROM products GROUP BY category")
    df.show()
    df.write.mode("overwrite").saveAsTable("product_summary")
    print("Done")
    '''
    stmt = api(f"/sessions/{session_id}/statements", "POST", {"code": code, "kind": "pyspark"})

    # 4. Poll for result
    while True:
        result = api(f"/sessions/{session_id}/statements/{stmt['id']}")
        if result.get("state") == "available":
            output = result["output"]
            if output["status"] == "ok":
                print(output["data"]["text/plain"])
            else:
                print(f"Error: {output['evalue']}")
            break
        time.sleep(5)

finally:
    # 5. ALWAYS clean up
    api(f"/sessions/{session_id}", "DELETE")
```

### What works

- `spark.sql("SELECT ...")` -- full Spark SQL against lakehouse tables
- `spark.sql("SHOW TABLES")` -- metastore access
- `df.write.saveAsTable(...)` -- write Delta tables back to the lakehouse
- JDBC reads from external SQL Server, PostgreSQL, etc.
- Pure Python (pandas, numpy, pyarrow, etc.)
- In-memory Spark DataFrames

### Limitations

- `deltalake` (delta-rs) is not pre-installed in the PySpark runtime; use Spark SQL instead
- `notebookutils` APIs have limited functionality (no FUSE mount, no `/lakehouse/default/`)
- Session startup takes 30-90 seconds (cold start); subsequent statements are fast
- Tokens expire after ~60 minutes; long-running sessions need token refresh

### When to use each approach

| Scenario | Use |
|----------|-----|
| Quick read-only exploration | DuckDB (fastest; no Spark overhead) |
| Write data back to lakehouse | `nb exec code` or notebook |
| Ephemeral transform; no persistent artifact | `nb exec code` |
| Complex multi-cell workflow with debugging | Notebook (`nb exec` or portal) |
| Scheduled ETL | Notebook via `fab job run` |
| Agent-driven compute (Dagster, orchestrators) | `nb exec code` or API directly |

## Query a Semantic Model (DAX)

DAX queries run against semantic models via the Power BI API. This is the standard approach for querying modeled data; measures, calculated columns, relationships, and RLS are all applied.

### SUMMARIZECOLUMNS (Preferred)

`SUMMARIZECOLUMNS` is the preferred function for querying semantic models. It groups by columns, adds extension columns (measures or expressions), and accepts filter arguments.

```
SUMMARIZECOLUMNS (
    <GroupBy_Column> [, <GroupBy_Column> [, ...]],
    [<FilterTable> [, <FilterTable> [, ...]]],
    ["<Name>", <Expression> [, "<Name>", <Expression> [, ...]]]
)
```

- **GroupBy columns**: Column references like `'Table'[Column]` to group by
- **Extension columns**: Named columns prefixed with `@`; paired as `"@Name", <Expression>`
- **Filter arguments**: Table expressions that restrict results; use `TREATAS` to apply filter values from outside the model

Rows where all extension columns evaluate to BLANK are automatically excluded.

### Escaping in DAX via fab API

DAX queries are embedded inside a JSON string passed to `fab api`. This creates two layers of escaping:

| Character | In DAX | Escaped in JSON string |
|-----------|--------|----------------------|
| Single quote `'` | `'Table'[Column]` | `'\''Table'\''[Column]` (break out of bash single-quote) |
| Double quote `"` | `"@ExtCol"` | `\"@ExtCol\"` (escaped for JSON) |

The safest approach is to write the JSON payload to a temp file:

```bash
WS_ID=$(fab get "ws.Workspace" -q "id" | tr -d '"')
MODEL_ID=$(fab get "ws.Workspace/Model.SemanticModel" -q "id" | tr -d '"')

cat > /tmp/dax-query.json << 'DAXEOF'
{
  "queries": [{
    "query": "EVALUATE SUMMARIZECOLUMNS ( 'Date'[Year], 'Product'[Category], \"@TotalSales\", [Total Sales], \"@AvgPrice\", AVERAGE ( 'Product'[UnitPrice] ) )"
  }],
  "serializerSettings": { "includeNulls": false }
}
DAXEOF

fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID/executeQueries" \
  -X post -i /tmp/dax-query.json
```

### Filtering with TREATAS

Apply ad-hoc filters without needing a relationship by using `TREATAS` as a filter argument:

```json
{
  "queries": [{
    "query": "EVALUATE SUMMARIZECOLUMNS ( 'Date'[Year], 'Customer'[Region], \"@Revenue\", [Total Revenue], \"@Orders\", COUNTROWS ( 'Sales' ), TREATAS ( { \"Europe\", \"Asia\" }, 'Customer'[Region] ) )"
  }]
}
```

### Inline (without temp file)

For simple queries, inline works; escape `"` as `\"` inside the JSON:

```bash
fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID/executeQueries" \
  -X post -i "{\"queries\":[{\"query\":\"EVALUATE SUMMARIZECOLUMNS ( 'Date'[Year], \\\"@Total\\\", [Total Sales] )\"}]}"
```

### Helper script

```bash
python3 scripts/execute_dax.py "ws.Workspace/Model.SemanticModel" \
  -q "EVALUATE SUMMARIZECOLUMNS ( 'Date'[Year], \"@Total\", [Total Sales] )"
```

For full DAX query patterns, parameters, and troubleshooting, see [semantic-models.md](./semantic-models.md).

## Query a Lakehouse Table via Direct Lake (Alternative)

When DuckDB is not available, create a temporary Direct Lake semantic model to query lakehouse tables via DAX:

```bash
# 1. Create Direct Lake model from lakehouse table
python3 scripts/create_direct_lake_model.py \
  "src.Workspace/LH.Lakehouse" \
  "dest.Workspace/Model.SemanticModel" \
  -t schema.table

# 2. Query via DAX
python3 scripts/execute_dax.py "dest.Workspace/Model.SemanticModel" -q "EVALUATE TOPN(10, 'table')"

# 3. (Optional) Delete temporary model (recovery depends on tenant Item Recovery setting)
fab rm "dest.Workspace/Model.SemanticModel" -f
```

For lakehouse properties, endpoints, and file/table operations, see [lakehouses.md](./lakehouses.md).
