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

Lakehouses do not support `fab export`; use `fab cp` for files.

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
