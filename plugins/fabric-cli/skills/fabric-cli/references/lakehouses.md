# Lakehouses

Endpoints, files, tables, shortcuts and maintenance for lakehouses through `fab`.

## Learn

```yaml
lakehouse REST: https://learn.microsoft.com/en-us/rest/api/fabric/lakehouse/items
OneLake shortcuts: https://learn.microsoft.com/en-us/fabric/onelake/onelake-shortcuts
shortcuts REST: https://learn.microsoft.com/en-us/rest/api/fabric/core/onelake-shortcuts
table maintenance: https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-table-maintenance
```

## Properties and endpoints

Connection details sit under `properties` on the `.Lakehouse` item. `fab get` on the `.SQLEndpoint` item fails with `[UnsupportedCommand]`; always query the lakehouse.

```bash
fab get "ws.Workspace/LH.Lakehouse" -q "properties.sqlEndpointProperties.connectionString"
fab get "ws.Workspace/LH.Lakehouse" -q "properties.sqlEndpointProperties.id"
fab get "ws.Workspace/LH.Lakehouse" -q "properties.oneLakeTablesPath"
fab get "ws.Workspace/LH.Lakehouse" -q "properties.oneLakeFilesPath"
```

- The SQL endpoint id is not the lakehouse id; it is what `refreshMetadata` takes to force a sync after a Spark write (see [querying-data.md](./querying-data.md))
- Create: `fab mkdir "ws.Workspace/NewLakehouse.Lakehouse"`; list item-specific creation parameters with `fab mkdir "ws.Workspace/NewLakehouse.Lakehouse" -P` (for example schema-enabled lakehouses; verify the key there)

## Files and tables

```bash
fab ls "ws.Workspace/LH.Lakehouse/Files"
fab ls "ws.Workspace/LH.Lakehouse/Tables/dbo"
fab cp ./data.csv "ws.Workspace/LH.Lakehouse/Files/data.csv"
fab cp "ws.Workspace/LH.Lakehouse/Files/data.csv" ./downloads/
fab api -A storage "ws.Workspace/LH.Lakehouse/Files" -P resource=filesystem,recursive=false
fab table schema "ws.Workspace/LH.Lakehouse/Tables/dbo/customers"
fab table load "ws.Workspace/LH.Lakehouse/Tables/sales" --file "ws.Workspace/LH.Lakehouse/Files/daily_sales.csv" --mode append
fab table optimize "ws.Workspace/LH.Lakehouse/Tables/transactions" --vorder --zorder customer_id,region
fab table vacuum "ws.Workspace/LH.Lakehouse/Tables/temp_data" --retain_n_hours 48
```

- `fab export` and `fab import` move the lakehouse definition (schemas, shortcuts, properties), not `Files/` or `Tables/` content; use `fab cp` for files and `fab table load` for table data
- `table load` is not supported on schema-enabled lakehouses; `--mode` defaults to overwrite in 1.7.0 help (earlier text of this file said append), so pass `--mode append` explicitly; `--format` default is `format=csv,header=true,delimiter=','`
- `table optimize` and `table vacuum` are lakehouse only; vacuum retention default is 168 hours (7 days)

## OneLake shortcuts

Use `fab ln` (alias `mklink`); the path ends in `.Shortcut`.

```bash
fab ln "ws.Workspace/LH.Lakehouse/Tables/shared_orders.Shortcut" --type oneLake --target "../../SrcWs.Workspace/SrcLH.Lakehouse/Tables/gold/orders" -f
fab ln "ws.Workspace/LH.Lakehouse/Tables/ext.Shortcut" --type adlsGen2 -i ./shortcut.json -f
```

- `--type`: oneLake, adlsGen2, amazonS3, googleCloudStorage, dataverse, s3Compatible
- Internal shortcuts take `--target` as a relative path; external ones need a `-i` JSON body with the location subpath and connection GUID
- `fab rm` on a shortcut removes the reference, never the data
- Options `fab ln` lacks, such as `shortcutConflictPolicy` (a query parameter, not a body field), need the raw `POST workspaces/{ws}/items/{lh}/shortcuts`

## Querying

Delta tables and `Files/` are readable with DuckDB over OneLake without a semantic model; the path-format gotchas (friendly names for non-`dbo` schemas) are in [querying-data.md](./querying-data.md).

## Related

- [notebooks.md](./notebooks.md): loading tables from a notebook
- [warehouses.md](./warehouses.md), [sql-databases.md](./sql-databases.md): the other SQL-capable items
- `using-duckdb` and `executing-spark` skills (etl plugin)
