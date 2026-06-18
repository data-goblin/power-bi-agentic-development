---
name: using-duckdb
version: 26.25
description: Query Fabric lakehouse and warehouse data using DuckDB, either locally or inside a Fabric notebook. Automatically invoke when the user mentions "DuckDB", "query Delta tables locally", or asks to "attach DuckDB to a lakehouse", "query OneLake data", "explore lakehouse data", "data freshness check", "validate data quality", "use DuckDB in Fabric".
---

# Using DuckDB with Fabric

Query Delta Lake tables and raw files in OneLake using DuckDB. Works both locally (CLI/Python) and inside Fabric notebooks. Read-only; for writes, use the `executing-spark` skill.

## Two Modes

| Mode | Where it runs | Auth | Best for |
|------|--------------|------|----------|
| **Local** | Developer machine | Azure CLI (`az login`) | Exploration, validation, ad-hoc analysis |
| **In-notebook** | Fabric Spark container | `notebookutils.credentials.getToken('storage')` | Combining DuckDB speed with Spark write-back |

## Local: Prerequisites

- DuckDB installed (`brew install duckdb` on macOS)
- Azure CLI authenticated (`az login`)
- Extensions installed: `INSTALL delta; INSTALL azure;` (one-time)

## Local: Querying Delta Tables

```bash
WS_ID=$(fab get "Workspace.Workspace" -q "id" | tr -d '"')
LH_ID=$(fab get "Workspace.Workspace/LH.Lakehouse" -q "id" | tr -d '"')

duckdb -c "
LOAD delta; LOAD azure;
CREATE SECRET (TYPE azure, PROVIDER credential_chain, CHAIN 'cli');

SELECT * FROM delta_scan(
  'abfss://${WS_ID}@onelake.dfs.fabric.microsoft.com/${LH_ID}/Tables/schema/table'
) LIMIT 10;
"
```

The `CHAIN 'cli'` parameter uses Azure CLI credentials. Without it, DuckDB tries managed identity first (fails on local machines).

## Local: Querying Raw Files

```bash
BASE="abfss://${WS_ID}@onelake.dfs.fabric.microsoft.com/${LH_ID}/Files"

duckdb -c "
LOAD azure;
CREATE SECRET (TYPE azure, PROVIDER credential_chain, CHAIN 'cli');

SELECT * FROM read_csv('${BASE}/data.csv') LIMIT 10;
SELECT * FROM read_parquet('${BASE}/facts.parquet') LIMIT 10;
SELECT * FROM read_json('${BASE}/events/*.json');
"
```

Glob patterns (`*`, `**`) work for reading multiple files.

## In-Notebook: Attaching DuckDB to a Lakehouse

Inside a Fabric notebook, DuckDB can query lakehouse Delta tables directly using a storage token. This approach is faster than Spark SQL for analytical queries on single-node data.

```python
import duckdb
import time

# Get storage token from notebook context
token = notebookutils.credentials.getToken('storage')

# Create DuckDB connection
con = duckdb.connect(f'temp_{time.time_ns()}.duckdb')
con.sql('SET enable_object_cache=true')

# Register OneLake secret
con.sql(f"""
    CREATE OR REPLACE SECRET onelake (
        TYPE AZURE,
        PROVIDER ACCESS_TOKEN,
        ACCESS_TOKEN '{token}'
    )
""")

# Query Delta tables
workspace = "<workspace-id>"
lakehouse = "<lakehouse-name>"
path = f"abfss://{workspace}@onelake.dfs.fabric.microsoft.com/{lakehouse}.Lakehouse/Tables"

df = con.sql(f"""
    SELECT * FROM delta_scan('{path}/schema/table_name') LIMIT 100
""").df()
print(df)
```

### Auto-Discovering Tables

Dynamically find all Delta tables in a lakehouse:

```python
tables = con.sql(f"""
    SELECT DISTINCT split_part(file, '_delta_log', 1) as table_path
    FROM glob('{path}/*/*/*_delta_log/*.json')
""").df()['table_path'].tolist()

for t in tables:
    view_name = t.split('/')[-1]
    con.sql(f"CREATE OR REPLACE VIEW {view_name} AS SELECT * FROM delta_scan('{t}')")
    print(f"Created view: {view_name}")
```

## OneLake Path Format

```
abfss://<workspace-id>@onelake.dfs.fabric.microsoft.com/<item-id>/Tables/<schema>/<table>
abfss://<workspace-id>@onelake.dfs.fabric.microsoft.com/<item-id>/Files/<path>
```

| Item type | ID source |
|-----------|-----------|
| Lakehouse | `fab get "ws/LH.Lakehouse" -q "id"` |
| Warehouse | `fab get "ws/WH.Warehouse" -q "id"` |
| SQL Database | `fab get "ws/DB.SQLDatabase" -q "id"` |

Cross-item joins work in a single DuckDB query; use different `abfss://` paths.

## Common Patterns

For data freshness checks, quality validation, schema discovery, cross-table joins, and row count audits, see **`references/common-patterns.md`**.

## References

- **`references/common-patterns.md`** -- Data freshness, quality, schema discovery, cross-joins
- **`references/in-notebook-setup.md`** -- Full notebook setup with auto-discovery and write-back patterns
- [DuckDB Azure Extension](https://duckdb.org/docs/extensions/azure.html)
- [DuckDB Delta Extension](https://duckdb.org/docs/extensions/delta.html)
- [djouallah/Fabric_Notebooks_Demo](https://github.com/djouallah/Fabric_Notebooks_Demo/blob/main/Attach_LH/Attach_Lakehouse_v2.ipynb) -- Original notebook-attachment approach
