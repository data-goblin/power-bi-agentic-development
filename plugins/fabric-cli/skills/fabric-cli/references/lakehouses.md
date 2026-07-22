# Lakehouse Operations

Guide for managing Fabric lakehouses; browsing files and tables, retrieving connection endpoints, uploading data, and optimizing tables.

## Properties and Endpoints

Lakehouse connection details live under `properties` on the `.Lakehouse` item. The `.SQLEndpoint` type does not support `fab get`; always query the `.Lakehouse` item instead.

### Get All Properties

```bash
fab get "ws.Workspace/LH.Lakehouse" -q "properties"
```

Returns:

```json
{
  "oneLakeTablesPath": "https://onelake.dfs.fabric.microsoft.com/<ws-id>/<lh-id>/Tables",
  "oneLakeFilesPath": "https://onelake.dfs.fabric.microsoft.com/<ws-id>/<lh-id>/Files",
  "sqlEndpointProperties": {
    "connectionString": "<cluster>.datawarehouse.fabric.microsoft.com",
    "id": "<sql-endpoint-id>",
    "provisioningStatus": "Success"
  }
}
```

### Get Specific Endpoints

```bash
# SQL connection string (for JDBC/ODBC/sqlcmd/Python clients)
fab get "ws.Workspace/LH.Lakehouse" -q "properties.sqlEndpointProperties.connectionString"

# OneLake Tables path (for Spark, TMDL partitions, Direct Lake)
fab get "ws.Workspace/LH.Lakehouse" -q "properties.oneLakeTablesPath"

# OneLake Files path (for raw file access)
fab get "ws.Workspace/LH.Lakehouse" -q "properties.oneLakeFilesPath"
```

### Common Gotcha

`fab get` on `.SQLEndpoint` fails with `[UnsupportedCommand]`. Always query the `.Lakehouse` item to get SQL endpoint details.

The SQL endpoint id above (`properties.sqlEndpointProperties.id`) is **not** the lakehouse id. It's what you pass to `refreshMetadata` to force the endpoint to pick up freshly-written Delta tables instead of waiting out the 10-60s sync lag -- see [Force the SQL endpoint metadata sync](./querying-data.md#force-the-sql-endpoint-metadata-sync-skip-the-sleep).

## Browsing Contents

```bash
# List files
fab ls "ws.Workspace/LH.Lakehouse/Files"

# List tables (with schema)
fab ls "ws.Workspace/LH.Lakehouse/Tables/dbo"

# List all lakehouse contents
fab ls "ws.Workspace/LH.Lakehouse" -l
```

## File Operations

```bash
# Upload a file
fab cp ./local-data.csv "ws.Workspace/LH.Lakehouse/Files/data.csv"

# Download a file
fab cp "ws.Workspace/LH.Lakehouse/Files/data.csv" ~/Downloads/

# List files via OneLake storage API
fab api -A storage "ws.Workspace/LH.Lakehouse/Files" -P resource=filesystem,recursive=false
```

`fab export` and `fab import` work on the lakehouse item itself (schemas, shortcuts, properties); they do not move the underlying Files/ or Tables/ payload. Use `fab cp` for file content and `fab table load` for table data.

```bash
# Export the lakehouse definition (schemas, shortcuts, properties)
fab export "ws.Workspace/LH.Lakehouse" -o /tmp/lh -f

# Recreate the lakehouse in another workspace from the exported definition
fab import "Prod.Workspace/LH.Lakehouse" -i /tmp/lh/LH.Lakehouse -f
```

## Table Operations

### Schema

```bash
fab table schema "ws.Workspace/LH.Lakehouse/Tables/dbo/customers"
```

### Load Data

```bash
# Load CSV into a table (non-schema lakehouses only)
fab table load "ws.Workspace/LH.Lakehouse/Tables/sales" \
  --file "ws.Workspace/LH.Lakehouse/Files/daily_sales.csv" \
  --mode append
```

### Optimize and Vacuum

```bash
# Optimize with V-Order and Z-Order
fab table optimize "ws.Workspace/LH.Lakehouse/Tables/transactions" \
  --vorder --zorder customer_id,region

# Vacuum old files
fab table vacuum "ws.Workspace/LH.Lakehouse/Tables/temp_data" \
  --retain_n_hours 48
```

## Creating a Lakehouse

```bash
# Via CLI
fab mkdir "ws.Workspace/NewLakehouse.Lakehouse"

# Via API
WS_ID=$(fab get "ws.Workspace" -q "id" | tr -d '"')
fab api -X post "workspaces/$WS_ID/items" -i '{"displayName": "NewLakehouse", "type": "Lakehouse"}'
```

## OneLake Shortcuts

Shortcuts let a lakehouse reference data in another lakehouse/warehouse, ADLS Gen2, S3, GCS, or Dataverse without copying it -- useful for ETL that reads external sources in place. Use the native `fab ln` (alias `mklink`); the shortcut path takes a `.Shortcut` suffix:

```bash
# Internal OneLake shortcut (points at another lakehouse's Tables/Files)
fab ln "ws.Workspace/LH.Lakehouse/Tables/shared_orders.Shortcut" \
  --type oneLake \
  --target "../../SrcWs.Workspace/SrcLH.Lakehouse/Tables/gold/orders" -f

# External shortcut (ADLS Gen2 / S3 / GCS / Dataverse): pass location + connectionId as JSON
fab ln "ws.Workspace/LH.Lakehouse/Tables/ext.Shortcut" --type adlsGen2 -i ./shortcut.json -f
```

`--type` accepts `oneLake`, `adlsGen2`, `amazonS3`, `googleCloudStorage`, `dataverse`, `s3Compatible`; external types need a `-i` JSON body carrying the location subpath and connection GUID. Deleting a shortcut (`fab rm`) removes the reference, never the underlying data. Fall back to the raw `POST workspaces/{ws}/items/{lh}/shortcuts` API only for options `fab ln` doesn't expose, such as `shortcutConflictPolicy` (a query parameter, not a body field). See [reference.md](./reference.md#ln-mklink---create-shortcuts) for the full command.

## Querying Lakehouse Data

Query lakehouse Delta tables and raw files directly using DuckDB with the `delta` and `azure` extensions. This reads from OneLake's ADLS Gen2-compatible endpoint; no semantic model required.

```bash
WS_ID=$(fab get "ws.Workspace" -q "id" | tr -d '"')
LH_ID=$(fab get "ws.Workspace/LH.Lakehouse" -q "id" | tr -d '"')

duckdb -c "
LOAD delta; LOAD azure;
CREATE SECRET (TYPE azure, PROVIDER credential_chain, CHAIN 'cli');
SELECT * FROM delta_scan('abfss://${WS_ID}@onelake.dfs.fabric.microsoft.com/${LH_ID}/Tables/schema/table') LIMIT 10;
"
```

Also works for CSV, JSON, and Parquet files under `Files/`:

```bash
duckdb -c "
LOAD azure;
CREATE SECRET (TYPE azure, PROVIDER credential_chain, CHAIN 'cli');
SELECT * FROM read_csv('abfss://${WS_ID}@onelake.dfs.fabric.microsoft.com/${LH_ID}/Files/data.csv') LIMIT 10;
"
```

For full examples including data freshness checks, quality validation, and schema discovery, see [querying-data.md](./querying-data.md).

## Related

- [querying-data.md](./querying-data.md) -- DuckDB/sqlcmd/MCP query routes and the [SQL-endpoint metadata sync](./querying-data.md#force-the-sql-endpoint-metadata-sync-skip-the-sleep)
- [notebooks.md](./notebooks.md) -- loading these tables from a notebook, then checking the run's exit value
- [warehouses.md](./warehouses.md) and [sql-databases.md](./sql-databases.md) -- the other SQL-capable item types
- `using-duckdb` and `executing-spark` skills (in the `etl` plugin) -- local Delta querying and ephemeral Spark writes against these tables
