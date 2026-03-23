# definition.pbir

Semantic model connection file. Defines which dataset the report connects to.

## Location

`Report.Report/definition.pbir`

## Structure

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/definition/1.0.0/schema.json",
  "datasetReference": {
    "byConnection": {
      "connectionString": "Data Source=powerbi://...",
      "pbiServiceModelId": null,
      "pbiModelVirtualServerName": "sobe_wowvirtualserver",
      "pbiModelDatabaseName": "workspace-guid-dataset-guid",
      "name": "EntityDataSource",
      "connectionType": "pbiServiceXmlaStyleLive"
    }
  }
}
```

## Connection Types

### byConnection (Live/DirectQuery)

External semantic model - report queries model at runtime:

```json
"datasetReference": {
  "byConnection": {
    "connectionString": "Data Source=powerbi://api.powerbi.com/v1.0/myorg/WorkspaceName;Initial Catalog=DatasetName",
    "connectionType": "pbiServiceXmlaStyleLive"
  }
}
```

### byPath (Embedded/Import)

Local semantic model in same project:

```json
"datasetReference": {
  "byPath": {
    "path": "../Model.SemanticModel"
  }
}
```

## Rebinding

To point report at different semantic model, change `connectionString` or `path`:

```json
// Before: Development model
"connectionString": "Data Source=powerbi://...;Initial Catalog=Sales-Dev"

// After: Production model
"connectionString": "Data Source=powerbi://...;Initial Catalog=Sales-Prod"
```

Field references in visuals must match new model's schema.

## Search

```bash
# Find current connection
grep -A5 '"datasetReference"' Report.Report/definition.pbir
```
