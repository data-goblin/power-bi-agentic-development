# DuckDB in a Fabric Python notebook

Pattern from https://github.com/djouallah/Fabric_Notebooks_Demo (Attach_LH). Unverified on DuckDB 2.0: the DuckDB azure docs show `ACCESS_TOKEN` secrets with an `ACCOUNT_NAME` and never mention OneLake.

```python
import duckdb, time

token = notebookutils.credentials.getToken('storage')
con = duckdb.connect(f'temp_{time.time_ns()}.duckdb')
con.sql('SET enable_object_cache=true')

def set_secret(token: str) -> None:
    con.sql(f"""CREATE OR REPLACE SECRET onelake (
        TYPE AZURE, PROVIDER ACCESS_TOKEN, ACCESS_TOKEN '{token}')""")

set_secret(token)
```

Refresh before the token expires (about 60 minutes) in long sessions: call `set_secret(notebookutils.credentials.getToken('storage'))` again.

Outside a notebook, get the token with `az account get-access-token --resource https://storage.azure.com --query accessToken -o tsv` or use the `credential_chain` secret from SKILL.md; do not hide failures with a bare `except`.

Attach every table as a view:

```python
base = f"abfss://{workspace_id}@onelake.dfs.fabric.microsoft.com/{lakehouse_id}/Tables"
tables = con.sql(f"""
    SELECT DISTINCT split_part(file, '_delta_log', 1) AS table_path
    FROM glob('{base}/*/*/_delta_log/*.json')""").df()['table_path'].tolist()
for t in tables:
    con.sql(f"CREATE OR REPLACE VIEW {t.rstrip('/').split('/')[-1]} AS SELECT * FROM delta_scan('{t}')")
```

The glob assumes schema-enabled lakehouse paths (`Tables/<schema>/<table>/_delta_log`); drop one `*/` for a lakehouse without schemas. Unverified: the original notebook used the lakehouse name in the path; GUIDs are the form that works with `fab` ids.

Write back with Spark when you need overwrite or merge: `spark.createDataFrame(con.sql("SELECT ...").df()).write.mode("overwrite").saveAsTable("out")`. DuckDB 2.0 can append and create Delta tables itself (SKILL.md).
