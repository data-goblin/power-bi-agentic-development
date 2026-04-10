# SQL Database Operations

Guide for managing Fabric SQL databases; creating, browsing, and querying via DuckDB.

## Creating

```bash
fab mkdir "ws.Workspace/MyDB.SQLDatabase"
```

## Properties

```bash
fab get "ws.Workspace/MyDB.SQLDatabase" -q "properties" -f
```

Returns `connectionInfo`, `databaseName`, `serverFqdn`, `collation`. The SQL endpoint uses `.database.fabric.microsoft.com`.

## Browsing

```bash
fab ls "ws.Workspace/MyDB.SQLDatabase"            # Top-level (Audit, Code, Files, Tables)
fab ls "ws.Workspace/MyDB.SQLDatabase/Tables/dbo"  # Tables
fab table schema "ws.Workspace/MyDB.SQLDatabase/Tables/dbo/customers"
```

## Querying with DuckDB

SQL databases auto-replicate their tables to OneLake as Delta Lake. Query them once replication completes:

```bash
WS_ID=$(fab get "ws.Workspace" -q "id" | tr -d '"')
DB_ID=$(fab get "ws.Workspace/MyDB.SQLDatabase" -q "id" | tr -d '"')

duckdb -c "
LOAD delta; LOAD azure;
CREATE SECRET (TYPE azure, PROVIDER credential_chain, CHAIN 'cli');
SELECT * FROM delta_scan('abfss://${WS_ID}@onelake.dfs.fabric.microsoft.com/${DB_ID}/Tables/dbo/customers') LIMIT 10;
"
```

Mirrored Delta tables include an internal `MSSQL_System_Uniquifier` column; exclude it in SELECT if needed.

## Loading Data

SQL databases support full T-SQL DDL/DML via SSMS, Fabric portal, or notebooks.

### Python Notebook via notebookutils.data

```python
with notebookutils.data.connect_to_artifact('SQLDatabaseName') as conn:
    conn.query('CREATE TABLE dbo.test (id INT, name VARCHAR(100))')
    conn.query("INSERT INTO dbo.test VALUES (1, 'hello')")
```

### T-SQL (Fabric Portal or SSMS)

```sql
CREATE TABLE dbo.customers (customer_id INT PRIMARY KEY, name VARCHAR(100), region VARCHAR(50));
INSERT INTO dbo.customers VALUES (1, 'Contoso', 'Europe');
```

## Auto-Mirroring

SQL database tables are automatically mirrored to OneLake as Delta tables:
- Changes via T-SQL are reflected after a short replication delay (~15 seconds)
- DuckDB queries read the replicated snapshot, not real-time
- The SQL analytics endpoint provides read-only T-SQL access to the OneLake copy

## Cross-Database Queries

SQL databases support three-part naming within the same workspace:

```sql
SELECT * FROM MyWarehouse.dbo.orders o
JOIN MyLakehouse.dbo.customers c ON o.customer_id = c.customer_id;
```

## Deleting

```bash
fab rm "ws.Workspace/MyDB.SQLDatabase" -f
```

Recovery depends on the tenant Item Recovery setting; see [reference.md > Recovering deleted items](reference.md#recovering-deleted-items).
