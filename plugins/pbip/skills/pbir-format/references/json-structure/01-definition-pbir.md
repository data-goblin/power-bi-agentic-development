# definition.pbir

Semantic model connection file. Defines which dataset the report connects to.

## Location

`Report.Report/definition.pbir` (at report root, NOT inside `definition/`)

## Connection Types

### byPath (local PBIP project)

Local semantic model in same project. Power BI Desktop opens model in full edit mode.

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/1.0.0/schema.json",
  "version": "4.0",
  "datasetReference": {
    "byPath": {
      "path": "../Model.SemanticModel"
    }
  }
}
```

- Path uses forward slashes, relative to the report folder
- No absolute paths

### byConnection (remote/thin report)

External semantic model -- report queries model at runtime. Desktop does NOT open model in edit mode.

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json",
  "version": "4.0",
  "datasetReference": {
    "byConnection": {
      "connectionString": "Data Source=powerbi://api.powerbi.com/v1.0/myorg/WorkspaceName;Initial Catalog=DatasetName"
    }
  }
}
```

Older reports may include additional properties (`pbiServiceModelId`, `pbiModelVirtualServerName`, `pbiModelDatabaseName`, `name`, `connectionType`) but only `connectionString` is required in schema 2.0.0.

## Rebinding

To point the report at a different semantic model, change the `connectionString` or `path`. Field references in visuals must match the new model's schema.

For Fabric REST API deployment, use `byConnection` with `connectionString` containing `semanticmodelid=[id]`.
