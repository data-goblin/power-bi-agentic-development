# Warehouses

Warehouse basics through `fab`; T-SQL access and queries are in [querying-data.md](./querying-data.md).

## Learn

```yaml
warehouse REST: https://learn.microsoft.com/en-us/rest/api/fabric/warehouse/items
warehouse overview: https://learn.microsoft.com/en-us/fabric/data-warehouse/data-warehousing
```

```bash
fab mkdir "ws.Workspace/MyWarehouse.Warehouse"
fab get "ws.Workspace/MyWarehouse.Warehouse" -q properties
fab ls "ws.Workspace/MyWarehouse.Warehouse/Tables/dbo"
fab table schema "ws.Workspace/MyWarehouse.Warehouse/Tables/dbo/orders"
```

- `properties` carries `connectionInfo`, `connectionString`, `createdDate`, `collationType`
- Tables are Delta in OneLake, so DuckDB `delta_scan` over `.../MyWarehouse.Warehouse/Tables/dbo/orders` works (read-only)
- `fab cp` to Files and `fab table load` do not work on warehouses; load with T-SQL (`CREATE TABLE ... AS SELECT * FROM OPENROWSET(BULK ...)` or `COPY INTO`), a Python notebook via `notebookutils.data.connect_to_artifact`, or Spark `synapsesql` (Runtime 1.3 or later; opaque errors through `fab job run`, so check the Spark log with `fab open`)
- Unlike a lakehouse SQL endpoint, a warehouse accepts full T-SQL DDL and DML
- Unverified: whether warehouses support shortcuts (earlier text said no); check Learn before relying on it
- `fab rm` is permanent unless tenant item recovery is on (see [commands.md](./commands.md)); `WarehouseSnapshot` items need fab 1.9.0 or later
