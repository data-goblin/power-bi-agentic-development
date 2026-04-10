# DuckDB in Fabric Notebooks

Full setup for attaching DuckDB to a Fabric lakehouse inside a notebook, including auto-discovery and write-back.

Based on [djouallah/Fabric_Notebooks_Demo](https://github.com/djouallah/Fabric_Notebooks_Demo/blob/main/Attach_LH/Attach_Lakehouse_v2.ipynb).

## Setup

```python
import duckdb
import time

def get_token():
    """Get storage token; works in notebook and external environments."""
    try:
        return notebookutils.credentials.getToken('storage')
    except:
        from azure.identity import InteractiveBrowserCredential
        return InteractiveBrowserCredential().get_token(
            "https://storage.azure.com/.default").token

token = get_token()

con = duckdb.connect(f'temp_{time.time_ns()}.duckdb')
con.sql('SET enable_object_cache=true')
con.sql(f"""
    CREATE OR REPLACE SECRET onelake (
        TYPE AZURE,
        PROVIDER ACCESS_TOKEN,
        ACCESS_TOKEN '{token}'
    )
""")
```

## Auto-Discover Tables

```python
workspace = "<workspace-id>"  # use GUID if name has spaces
lakehouse = "<lakehouse-name>"  # or GUID
base_path = f"abfss://{workspace}@onelake.dfs.fabric.microsoft.com/{lakehouse}.Lakehouse/Tables"

# Find all Delta tables
tables = con.sql(f"""
    SELECT DISTINCT split_part(file, '_delta_log', 1) as table_path
    FROM glob('{base_path}/*/*/*_delta_log/*.json')
""").df()['table_path'].tolist()

# Create views
for t in tables:
    view_name = t.split('/')[-1]
    con.sql(f"CREATE OR REPLACE VIEW {view_name} AS SELECT * FROM delta_scan('{t}')")
    count = con.sql(f"SELECT count(*) FROM {view_name}").fetchone()[0]
    print(f"  {view_name}: {count:,} rows")
```

## Query

```python
df = con.sql("SELECT * FROM my_table WHERE date > '2025-01-01' LIMIT 1000").df()
```

## Write Back via Spark

DuckDB is read-only for Delta; write back through Spark:

```python
# DuckDB result -> Spark DataFrame -> Delta table
pandas_df = con.sql("SELECT ...").df()
spark_df = spark.createDataFrame(pandas_df)
spark_df.write.mode("overwrite").saveAsTable("output_table")
```

## Token Refresh

Storage tokens expire after ~60 minutes. For long sessions, refresh:

```python
new_token = get_token()
con.sql(f"""
    CREATE OR REPLACE SECRET onelake (
        TYPE AZURE, PROVIDER ACCESS_TOKEN, ACCESS_TOKEN '{new_token}'
    )
""")
```
