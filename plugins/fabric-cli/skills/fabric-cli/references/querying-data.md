# Querying Data

## Query a Semantic Model (DAX)

```bash
# 1. Get workspace and model IDs
fab get "ws.Workspace" -q "id"
fab get "ws.Workspace/Model.SemanticModel" -q "id"

# 2. Execute DAX query
fab api -A powerbi "groups/<ws-id>/datasets/<model-id>/executeQueries" \
  -X post -i '{"queries":[{"query":"EVALUATE TOPN(10, '\''TableName'\'')"}]}'
```

Or use the helper script:

```bash
python3 scripts/execute_dax.py "ws.Workspace/Model.SemanticModel" -q "EVALUATE TOPN(10, 'Table')"
```

## Query a Lakehouse Table

Lakehouse tables cannot be queried directly via API. Create a Direct Lake semantic model first.

```bash
# 1. Create Direct Lake model from lakehouse table
python3 scripts/create_direct_lake_model.py \
  "src.Workspace/LH.Lakehouse" \
  "dest.Workspace/Model.SemanticModel" \
  -t schema.table

# 2. Query via DAX
python3 scripts/execute_dax.py "dest.Workspace/Model.SemanticModel" -q "EVALUATE TOPN(10, 'table')"

# 3. (Optional) Delete temporary model
fab rm "dest.Workspace/Model.SemanticModel" -f
```

## Get Lakehouse SQL Endpoint

For external SQL clients:

```bash
fab get "ws.Workspace/LH.Lakehouse" -q "properties.sqlEndpointProperties"
```

Returns `connectionString` and `id` for SQL connections.
