# Warehouse Operations

Guide for managing Fabric warehouses; creating, browsing, querying via DuckDB, and loading data.

## Creating a Warehouse

```bash
fab mkdir "ws.Workspace/MyWarehouse.Warehouse"
```

## Properties

```bash
fab get "ws.Workspace/MyWarehouse.Warehouse" -q "properties"
```

Returns `connectionInfo` (SQL endpoint), `connectionString`, `createdDate`, `collationType`.

## Browsing Contents

```bash
fab ls "ws.Workspace/MyWarehouse.Warehouse"           # Top-level (Tables, Files)
fab ls "ws.Workspace/MyWarehouse.Warehouse/Tables/dbo" # Tables in schema
fab table schema "ws.Workspace/MyWarehouse.Warehouse/Tables/dbo/orders"
```

## Querying with DuckDB

Warehouse tables are stored as Delta Lake in OneLake:

```bash
WS_ID=$(fab get "ws.Workspace" -q "id" | tr -d '"')
WH_ID=$(fab get "ws.Workspace/MyWarehouse.Warehouse" -q "id" | tr -d '"')

duckdb -c "
LOAD delta; LOAD azure;
CREATE SECRET (TYPE azure, PROVIDER credential_chain, CHAIN 'cli');
SELECT * FROM delta_scan('abfss://${WS_ID}@onelake.dfs.fabric.microsoft.com/${WH_ID}/Tables/dbo/orders') LIMIT 10;
"
```

## Loading Data

Warehouses do not support `fab cp` to Files or `fab table load`. Load via:

### T-SQL (SSMS or Fabric Portal)

```sql
CREATE TABLE dbo.orders AS
SELECT * FROM OPENROWSET(BULK 'https://storage.blob.core.windows.net/data/orders.parquet');
```

### Python Notebook via notebookutils.data

```python
with notebookutils.data.connect_to_artifact('WarehouseName') as conn:
    conn.query('CREATE TABLE dbo.test (id INT, name VARCHAR(100))')
    conn.query("INSERT INTO dbo.test VALUES (1, 'hello')")
    df = conn.query('SELECT * FROM dbo.test')
```

### PySpark Notebook via synapsesql

```python
import com.microsoft.spark.fabric
from com.microsoft.spark.fabric.Constants import Constants
df.write.synapsesql("WarehouseName.dbo.table", mode="overwrite")
```

Requires Runtime 1.3+. Known to produce opaque errors from `fab job run`; use `fab open` to check Spark logs.

## Key Differences from Lakehouse

| Feature | Lakehouse | Warehouse |
|---------|-----------|-----------|
| File upload (`fab cp`) | Supported | Not supported |
| `fab table load` | Supported | Not supported |
| Shortcuts (`fab ln`) | Supported | Not supported |
| T-SQL DDL/DML | Read-only (SQL endpoint) | Full support |
| DuckDB `delta_scan` | Yes | Yes |

## Deleting

```bash
fab rm "ws.Workspace/MyWarehouse.Warehouse" -f
```

Recovery depends on the tenant Item Recovery setting; see [reference.md > Recovering deleted items](reference.md#recovering-deleted-items).
