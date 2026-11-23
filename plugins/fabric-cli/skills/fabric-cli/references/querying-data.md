# Querying data

DAX against semantic models; T-SQL, DuckDB and Spark against lakehouses, warehouses and SQL databases.

## Learn

```yaml
SQL analytics endpoint: https://learn.microsoft.com/en-us/fabric/data-warehouse/data-warehousing
refresh SQL endpoint metadata: https://learn.microsoft.com/en-us/rest/api/fabric/sqlendpoint/items/refresh-sql-endpoint-metadata
Livy API: https://learn.microsoft.com/en-us/fabric/data-engineering/api-livy-overview
executeQueries: https://learn.microsoft.com/en-us/rest/api/power-bi/datasets/execute-queries
OneLake paths: https://learn.microsoft.com/en-us/fabric/onelake/onelake-access-api
DuckDB delta and azure extensions: https://duckdb.org/docs/extensions/delta
```

## Choosing a route

```yaml
T-SQL via sqlcmd: first choice for SQL-endpoint tables (lakehouse, warehouse, SQL database); fast, reuses `az login`; uv run ${CLAUDE_SKILL_DIR}/scripts/query_sql_endpoint.py
fabric-sql MCP (preview): zero local setup, server-side, CSV back; one extra gateway hop and intermittent failures ("Could not obtain activation parameters": retry once)
DuckDB over OneLake: reads Delta files directly, no SQL-endpoint sync lag, joins across workspaces, DuckDB functions; uv run ${CLAUDE_SKILL_DIR}/scripts/query_lakehouse_duckdb.py
Spark via Livy: writes, distributed transforms, Delta features (time travel, OPTIMIZE, VACUUM); 30 to 90 s cold start, slowest for reads
DAX via executeQueries: when measures, relationships and RLS must apply; uv run ${CLAUDE_SKILL_DIR}/scripts/execute_dax.py
```

## fabric-sql MCP

Server `https://api.fabric.microsoft.com/v1/mcp/dataPlane/sqlEndpoint`, tool `execute_query(workspaceId, itemId, query)`; for a lakehouse `itemId` is the lakehouse id or the SQL endpoint id.

- Claude Code's interactive `/mcp` OAuth fails here ("does not support dynamic client registration"); send a bearer header with a Power BI token from the environment instead: `Authorization: Bearer ${FABRIC_PBI_TOKEN}`
- Token comes from `az account get-access-token --resource https://analysis.windows.net/powerbi/api --query accessToken -o tsv`; it lasts about an hour; keep it in the environment only
- The lakehouse endpoint is read-only; warehouse and SQL database endpoints accept writes

## sqlcmd

Needs go-sqlcmd 1.9.0 or later and an `az login` identity with Viewer on the workspace. Host property differs per item type; the `-d` database is the display name without extension.

```bash
fab get "ws.Workspace/LH.Lakehouse" -q "properties.sqlEndpointProperties.connectionString"
fab get "ws.Workspace/WH.Warehouse" -q properties.connectionString
fab get "ws.Workspace/DB.SQLDatabase" -q properties.serverFqdn
sqlcmd -S "$HOST" -d LH --authentication-method ActiveDirectoryAzCli -W -s "|" -Q "SELECT TOP 10 * FROM dbo.orders"
```

- `-W` strips padding (without it columns wrap off-screen); `-s "|"` separator; `-h -1` no repeated headers; `-y 0 -Y 0` no truncation of max types; `-b` non-zero exit on error; `-m 11` hides informational noise; `-i file.sql` runs `GO` scripts; `-Q` runs one query and exits
- Every success prints a `Statement ID | Query hash | Distributed request ID` footer; use it for support tickets and `queryinsights.exec_requests_history`
- `INFORMATION_SCHEMA` and `sys.*` work here, not in DuckDB
- Lakehouse endpoint: read-only; schema and table names are case-sensitive when the Delta path is mixed case; three-part names work inside one endpoint, cross-endpoint four-part names do not

### SQL endpoint metadata lag

A Spark write can take 10 to 60 s to appear (`Invalid object name`). Force the sync instead of sleeping; `sqlEndpointId` is the SQL endpoint id, not the lakehouse id:

```bash
SQLEP=$(fab get "ws.Workspace/LH.Lakehouse" -q "properties.sqlEndpointProperties.id")
fab api "workspaces/$WS/sqlEndpoints/$SQLEP/refreshMetadata" -X post -i '{"recreateTables": false}'
```

A 200 returns per-table `TableSyncStatuses` (Success, Failure, NotRun); a 202 returns a `Location` header to poll. Or read the Delta files with DuckDB, which has no lag.

## DuckDB over OneLake

```bash
duckdb -c "
INSTALL delta; INSTALL azure; LOAD delta; LOAD azure;
CREATE SECRET (TYPE azure, PROVIDER credential_chain, CHAIN 'cli');
SELECT * FROM delta_scan('abfss://my-workspace@onelake.dfs.fabric.microsoft.com/MyLH.Lakehouse/Tables/schema/table') LIMIT 10;
"
```

- `CHAIN 'cli'` makes DuckDB use Azure CLI credentials; without it DuckDB tries managed identity first and fails locally
- Use friendly names (`<workspace name>@onelake.../<Item>.<Type>/Tables/<schema>/<table>`): the GUID form works for `dbo` tables but fails with Bad Request on tables in other schemas
- The same path works for `.Warehouse` and `.SQLDatabase` items; SQL databases are auto-mirrored with about 15 s delay and an extra `MSSQL_System_Uniquifier` column
- `Files/` reads: `read_csv`, `read_json`, `read_parquet` with globs (`*`, `**`)
- Read-only in practice; needs Azure CLI login or a service principal (Fabric-only tokens do not work)
- Profiling: `DESCRIBE SELECT * FROM delta_scan(...)` and `SELECT * FROM (SUMMARIZE delta_scan(...))`
- Cross-item joins work in one query with a different `abfss://` path per item

## Spark through Livy (no notebook)

```yaml
base: https://api.fabric.microsoft.com/v1/workspaces/{wsId}/lakehouses/{lhId}/livyapi/versions/2023-12-01
POST /sessions: body {"kind": "pyspark"}
GET /sessions/{id}: poll until state is idle
POST /sessions/{id}/statements: body {"code": ..., "kind": "pyspark"}
GET /sessions/{id}/statements/{n}: poll until state is available; output in output.data["text/plain"]
DELETE /sessions/{id}: always
```

- Always delete the session (use `finally`); an idle session burns capacity units until its idle timeout (default 20 minutes)
- Token: `az account get-access-token --resource https://api.fabric.microsoft.com`; it expires after about 60 minutes. Learn's Livy session guide requires an app registration token with the `Code.AccessFabric.All` and `Code.AccessStorage.All` scopes to read and write lakehouse data ([Livy session](https://learn.microsoft.com/en-us/fabric/data-engineering/get-started-api-livy-session)); see the etl plugin `livy-api` page
- `deltalake` (delta-rs) is not preinstalled in the Spark runtime; use Spark SQL. `notebookutils` has no FUSE mount and no `/lakehouse/default/` here
- A `spark` session always exists; JDBC reads and `saveAsTable` writes work
- The `executing-spark` skill (etl plugin) covers this route; the separate `nb` CLI (data-goblin/nb-cli) wraps it as `nb exec code`

## DAX over executeQueries

Prefer `SUMMARIZECOLUMNS` for grouped queries; rows where every extension column is BLANK are dropped. `TREATAS` applies filters without a relationship.

```bash
fab api -A powerbi "groups/$WS/datasets/$MODEL/executeQueries" -X post -i dax.json
```

```json
{"queries": [{"query": "EVALUATE SUMMARIZECOLUMNS ( 'Date'[Year], 'Customer'[Region], \"@Revenue\", [Total Revenue], TREATAS ( { \"Europe\", \"Asia\" }, 'Customer'[Region] ) )"}], "serializerSettings": {"includeNulls": false}}
```

- DAX sits inside a JSON string inside a shell string: write the body to a file with a quoted heredoc instead of escaping; inline needs `\"` for DAX double quotes and `'\''` for DAX single quotes inside bash single quotes
- Results: `text.results[0].tables[0].rows`; limits and permissions are in [semantic-models.md](./semantic-models.md)
- To query a lakehouse table with DAX when DuckDB is unavailable: `uv run ${CLAUDE_SKILL_DIR}/scripts/create_direct_lake_model.py "src.Workspace/LH.Lakehouse" "dest.Workspace/Model.SemanticModel" -t schema.table`, query it, then remove the temporary model (permanent unless item recovery is on; see [commands.md](./commands.md))

## Related

- [notebooks.md](./notebooks.md): jobs, exit values, scheduling
- [lakehouses.md](./lakehouses.md): endpoints, OneLake paths, table operations
- `using-duckdb` and `executing-spark` skills (etl plugin)
