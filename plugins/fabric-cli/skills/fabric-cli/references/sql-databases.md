# SQL databases

Fabric SQL database basics through `fab`; T-SQL access is in [querying-data.md](./querying-data.md).

## Learn

```yaml
SQL database REST: https://learn.microsoft.com/en-us/rest/api/fabric/sqldatabase/items
SQL database overview: https://learn.microsoft.com/en-us/fabric/database/sql/overview
```

```bash
fab mkdir "ws.Workspace/MyDB.SQLDatabase"
fab get "ws.Workspace/MyDB.SQLDatabase" -q properties -f
fab ls "ws.Workspace/MyDB.SQLDatabase/Tables/dbo"
fab table schema "ws.Workspace/MyDB.SQLDatabase/Tables/dbo/customers"
```

- `properties` carries `connectionInfo`, `databaseName`, `serverFqdn`, `collation`; the host ends in `.database.fabric.microsoft.com`
- `mkdir` accepts optional creation parameters including `creationMode` values New, Restore and RestoreDeletedDatabase; list them with `fab mkdir "ws.Workspace/MyDB.SQLDatabase" -P`
- `fab ls` on the item shows Audit, Code, Files and Tables
- Tables auto-mirror to OneLake as Delta with about 15 s delay; DuckDB `delta_scan` reads that snapshot (not real time) and sees an extra `MSSQL_System_Uniquifier` column; the SQL analytics endpoint on the copy is read-only
- Full T-SQL DDL and DML works from the portal, SSMS, or a Python notebook with `notebookutils.data.connect_to_artifact('SQLDatabaseName')`
- Cross-database three-part-name queries work through the SQL analytics endpoint of the database ([limitations](https://learn.microsoft.com/en-us/fabric/database/sql/limitations))
- `fab rm` is permanent unless tenant item recovery is on (see [commands.md](./commands.md))
