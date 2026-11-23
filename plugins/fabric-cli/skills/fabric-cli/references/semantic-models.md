# Semantic models

Definition read and write, refresh, copy and storage-mode checks for semantic models through `fab`. For model edits and DAX queries prefer the `te-cli` skill (tabular-editor plugin); this file covers what `fab` itself does.

## Learn

```yaml
semantic model REST: https://learn.microsoft.com/en-us/rest/api/fabric/semanticmodel/items
definition format: https://learn.microsoft.com/en-us/rest/api/fabric/articles/item-management/definitions/semantic-model-definition
TMDL: https://learn.microsoft.com/en-us/analysis-services/tmdl/tmdl-overview
executeQueries: https://learn.microsoft.com/en-us/rest/api/power-bi/datasets/execute-queries
refresh: https://learn.microsoft.com/en-us/power-bi/connect-data/asynchronous-refresh
refresh REST: https://learn.microsoft.com/en-us/rest/api/power-bi/datasets/refresh-dataset
```

## Read the definition

`fab get -q` is applied to the item itself (no `text.` prefix); `-q id` prints the bare value.

```bash
fab get "ws.Workspace/Sales.SemanticModel" -q id
fab get "ws.Workspace/Sales.SemanticModel" -q "definition.parts[].path"
fab get "ws.Workspace/Sales.SemanticModel" -q "definition.parts[?path=='definition/tables/Sales.tmdl'].payload | [0]"
fab get "ws.Workspace/Sales.SemanticModel" -q definition -o ./model-def.json
```

```yaml
model.tmdl / definition/model.tmdl: model properties, culture, compatibility level
definition/database.tmdl: database properties
definition/tables/<Table>.tmdl: columns, measures, hierarchies, partitions
definition/relationships.tmdl: relationships
definition/roles.tmdl: row-level security roles
definition/expressions/*.tmdl: M queries and shared expressions
definition/functions.tmdl: DAX user-defined functions
.platform: Git metadata; omit from updates
```

- Raw API payloads are base64 (`InlineBase64`); decode before reading
- Export to a TMDL folder with `fab export "ws.Workspace/Sales.SemanticModel" -o ./out -f`; for a PBIP project with a report use `pbir` (see [import-download-deploy.md](./import-download-deploy.md)); never hand-write report JSON

## Update the definition

Prefer `fab import` of an edited TMDL folder (see [import-download-deploy.md](./import-download-deploy.md)). Through the raw API:

```bash
fab api -X post "workspaces/$WS/semanticModels/$MODEL/updateDefinition" -i update.json --show_headers
fab api "operations/<operation-id>" -q "text.status"
```

- `update.json` is `{"definition": {"parts": [...]}}`; send every part, modified and unmodified, never `.platform`
- The call is a long-running operation: the operation id is in the `Location` header (`.../operations/<id>`); a failed one carries `error` in the operation body
- After any definition change, run a trivial query (`EVALUATE {1}`) to confirm the model still loads

## DAX queries

```bash
fab api -A powerbi "datasets/$MODEL/executeQueries" -X post -i '{"queries":[{"query":"EVALUATE TOPN(10, Sales, Sales[Amount], DESC)"}],"serializerSettings":{"includeNulls":false}}'
uv run ${CLAUDE_SKILL_DIR}/scripts/execute_dax.py "ws.Workspace/Sales.SemanticModel" -q "EVALUATE VALUES('Date'[Year])"
```

- Results come back under `text.results[0].tables[0].rows`
- executeQueries has hard limits (rows, values and requests per minute, one query per call historically); see the Learn page and use `te query` (te-cli skill) for anything large or repeated
- Parameters use `"parameters": [{"name": "@Year", "value": "2024"}]` with `@Year` in the query
- Needs Build permission on the model; with a service principal also the tenant setting that allows service principals to use Power BI APIs

## Refresh

```bash
fab api -A powerbi "groups/$WS/datasets/$MODEL/refreshes" -X post -i '{"type":"Full"}'
fab api -A powerbi "groups/$WS/datasets/$MODEL/refreshes" -P '$top=1' -q "text.value[0].{status:status,end:endTime}"
fab api -A powerbi "groups/$WS/datasets/$MODEL/refreshes/$REFRESH_ID" -X delete
```

- The POST returns 202; the request id is in the `x-ms-request-id` response header (use `--show_headers`)
- Refresh status values: `Unknown` means in progress, then `Completed`, `Failed`, `Disabled` or `Cancelled`
- Enhanced refresh (per table, partition, commit mode, `applyRefreshPolicy`) takes extra body fields; see the Learn page
- Shared capacity allows 8 refreshes per day through the API; Premium and Fabric capacities do not have that cap
- Schedule: GET or PATCH `datasets/$MODEL/refreshSchedule` with `{"enabled": true, "days": [...], "times": ["02:00"], "localTimeZoneId": "UTC"}`; `{"enabled": false}` disables it
- The `refresh-semantic-model` skill (semantic-models plugin) covers refresh strategy

## Copy and deploy

```bash
fab cp "Dev.Workspace/Sales.SemanticModel" "Prod.Workspace/Sales.SemanticModel" -f
```

- `cp` copies the definition only, not data; refresh the target afterward, and rebind reports and credentials as needed
- Stage promotion belongs to deployment pipelines (see [deployment-pipelines.md](./deployment-pipelines.md))
- `fab set "ws.Workspace/Sales.SemanticModel" -q displayName -i "New name"` renames; `-q description` sets the description

## Storage mode

Read the partition mode from a table part:

```bash
fab get "ws.Workspace/Sales.SemanticModel" -q "definition.parts[?contains(path,'tables/Sales')].payload | [0]"
```

```yaml
Direct Lake: partition Sales = entity, mode: directLake, source with entityName, schemaName, expressionSource
Import: partition Sales = m, mode: import, source is an M expression
DirectQuery: mode: directQuery
```

## Find reports bound to a model

A report's `definition.pbir` holds `datasetReference.byConnection.connectionString` with `semanticmodelid=<guid>`. Match that against the model id from `fab get -q id`. `uv run ${CLAUDE_SKILL_DIR}/scripts/get-downstream-reports.py` does it across a workspace.

## Access

`fab acl` does not work on a semantic model (workspace, connection and gateway only). Workspace members: `fab acl ls "ws.Workspace"`. Model-level users: `fab api -A powerbi "groups/$WS/datasets/$MODEL/users"` ([Get Dataset Users In Group](https://learn.microsoft.com/en-us/rest/api/power-bi/datasets/get-dataset-users-in-group)); see [permissions.md](./permissions.md).

## Source data checks

To diagnose freshness or quality, query the lakehouse Delta tables directly instead of going through the model; see [querying-data.md](./querying-data.md).

## Scripts

```yaml
scripts/create_direct_lake_model.py: create a Direct Lake model from a lakehouse table
scripts/execute_dax.py: run DAX against a model
scripts/get-downstream-reports.py: reports bound to a model
scripts/get_semantic_model_ai_metadata.py: AI metadata for a model
```
