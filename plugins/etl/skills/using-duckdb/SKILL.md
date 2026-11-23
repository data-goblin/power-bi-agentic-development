---
name: using-duckdb
description: "Query Fabric lakehouse or warehouse Delta tables in OneLake with DuckDB, locally with az login or inside a Fabric Python notebook with a storage token. Use for 'attach DuckDB to a lakehouse', 'query OneLake Delta locally', 'use DuckDB in Fabric', and for the DuckDB 2.0 Delta write support."
---

# DuckDB over OneLake

DuckDB is 2.0 (2.0.1 on PyPI, 2026-11); docs live under https://duckdb.org/docs/2.0/. Not run against OneLake in this audit: every OneLake-specific statement below is from the DuckDB docs or earlier use, marked Unverified where it matters. Install on Linux with your package manager or from duckdb.org, on macOS `brew install duckdb`, on Windows `winget install DuckDB.cli`; ask before installing.

## Rules

- The `delta` and `azure` extensions autoload on first use from the official repository; no `INSTALL` step
- Local auth: `az login`, then `CREATE SECRET (TYPE azure, PROVIDER credential_chain, CHAIN 'cli');`. In a Fabric Python notebook use a `PROVIDER ACCESS_TOKEN` secret from `notebookutils.credentials.getToken('storage')` (the DuckDB docs show it with `ACCOUNT_NAME`; the OneLake form is Unverified on 2.0) and recreate it before the 60 minute expiry, since the extension does not refresh tokens
- OneLake path uses GUIDs, not names (names with spaces break it): `abfss://<workspace-id>@onelake.dfs.fabric.microsoft.com/<item-id>/Tables/<schema>/<table>` and `.../Files/<path>`. Get ids with `fab get "ws.Workspace/LH.Lakehouse" -q id`. Warehouses and SQL databases use the same form
- Use the wrapper instead of rebuilding the path and secret: the `fabric-cli` skill's `scripts/query_lakehouse_duckdb.py "ws.Workspace/LH.Lakehouse" -q "SELECT * FROM tbl LIMIT 10" -t gold.orders` (run with `uv run`; needs the fabric-cli plugin and the duckdb CLI)
- Prefer the SQL endpoint (`fabric-cli` `querying-data.md`) when you need `INFORMATION_SCHEMA`, `sys.*` or T-SQL behaviour
- Cross-item joins work in one query with different `abfss://` paths

## Writes

DuckDB 2.0 can write Delta (https://duckdb.org/docs/2.0/core_extensions/delta.html):

```yaml
CREATE TABLE: since 2.0
INSERT INTO an attached table (ATTACH 'path' AS t (TYPE delta)): append only
CREATE TABLE AS SELECT: since 2.0.1
COPY (query) TO 'path' (FORMAT delta): writes a new Delta table
not supported: UPDATE, DELETE, MERGE INTO, ALTER TABLE, DROP TABLE
```

Whether these writes succeed against `abfss://` OneLake paths is Unverified; test on a scratch table first. For overwrite, merge or schema changes write through Spark (`executing-spark` or a notebook). A SQL-endpoint metadata sync may lag after an external write.

## Reading gotchas (from the Delta extension docs)

- Tables with `interval`, `geometry` or `geography` columns cannot be read (per the docs); read those tables with Spark
- `delta_column_mapping_policy` defaults to `strict` in 2.0 (it was `lenient` in 1.5): an id-mode column-mapped table written without Parquet field IDs errors; set `lenient` to match by name
- Deletion vectors are supported
- Schema-enabled lakehouses have `Tables/<schema>/<table>`; a lakehouse without schemas has `Tables/<table>`
