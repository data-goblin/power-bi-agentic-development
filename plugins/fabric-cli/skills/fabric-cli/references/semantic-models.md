# Semantic Model Operations

Comprehensive guide for working with semantic models (Power BI datasets) using the Fabric CLI.

## Overview

Semantic models in Fabric use TMDL (Tabular Model Definition Language) format for their definitions. This guide covers getting, updating, exporting, and managing semantic models.

## Getting Model Information

### Basic Model Info

```bash
# Check if model exists
fab exists "Production.Workspace/Sales.SemanticModel"

# Get model properties
fab get "Production.Workspace/Sales.SemanticModel"

# Get model with all details (verbose)
fab get "Production.Workspace/Sales.SemanticModel" -v

# Get only model ID
fab get "Production.Workspace/Sales.SemanticModel" -q "id"
```

### Get Model Definition

The model definition contains all TMDL parts (tables, measures, relationships, etc.):

```bash
# Get full definition (all TMDL parts)
fab get "Production.Workspace/Sales.SemanticModel" -q "definition"

# Save definition to file
fab get "Production.Workspace/Sales.SemanticModel" -q "definition" -o /tmp/model-def.json
```

### Get Specific TMDL Parts

```bash
# Get model.tmdl (main model properties)
fab get "Production.Workspace/Sales.SemanticModel" -q "definition.parts[?path=='model.tmdl'].payload | [0]"

# Get specific table definition
fab get "Production.Workspace/Sales.SemanticModel" -q "definition.parts[?path=='definition/tables/Customers.tmdl'].payload | [0]"

# Get all table definitions
fab get "Production.Workspace/Sales.SemanticModel" -q "definition.parts[?starts_with(path, 'definition/tables/')]"

# Get relationships.tmdl
fab get "Production.Workspace/Sales.SemanticModel" -q "definition.parts[?path=='definition/relationships.tmdl'].payload | [0]"

# Get functions.tmdl (DAX functions)
fab get "Production.Workspace/Sales.SemanticModel" -q "definition.parts[?path=='definition/functions.tmdl'].payload | [0]"

# Get all definition part paths (for reference)
fab get "Production.Workspace/Sales.SemanticModel" -q "definition.parts[].path"
```

## Exporting Models

### Export as PBIP (Power BI Project)

PBIP format is best for local development in Power BI Desktop or Tabular Editor:

```bash
# Export using the export script
python3 scripts/export_semantic_model_as_pbip.py \
  "Production.Workspace/Sales.SemanticModel" -o /tmp/exports
```

### Export as TMDL

The export script creates PBIP format which includes TMDL in the definition folder:

```bash
python3 scripts/export_semantic_model_as_pbip.py \
  "Production.Workspace/Sales.SemanticModel" -o /tmp/exports

# TMDL files will be in: /tmp/exports/Sales.SemanticModel/definition/
```

### Export Specific Parts Only

```bash
# Export just tables
fab get "Production.Workspace/Sales.SemanticModel" -q "definition.parts[?starts_with(path, 'definition/tables/')]" -o /tmp/tables.json

# Export just measures (within tables)
fab get "Production.Workspace/Sales.SemanticModel" -q "definition.parts[?contains(path, '/tables/')]" | grep -A 20 "measure"
```

## Listing Model Contents

```bash
# List all items in model (if OneLake enabled)
fab ls "Production.Workspace/Sales.SemanticModel"

# Query model structure via API
fab api workspaces -q "value[?displayName=='Production'].id | [0]" | xargs -I {} \
  fab api "workspaces/{}/items" -q "value[?type=='SemanticModel']"

# Native alternative for listing:
fab ls "ws.Workspace" -q "[?contains(name, '.SemanticModel')]"
```

## Updating Model Definitions

**CRITICAL**: When updating semantic models, you must:
1. Get the full definition
2. Modify the specific parts you want to change
3. Include ALL parts in the update request (modified + unmodified)
4. Never include `.platform` file
5. Test immediately

### Update Workflow

```bash
# 1. Get workspace and model IDs
WS_ID=$(fab get "Production.Workspace" -q "id")
MODEL_ID=$(fab get "Production.Workspace/Sales.SemanticModel" -q "id")

# 2. Get current definition
fab get "Production.Workspace/Sales.SemanticModel" -q "definition" -o /tmp/current-def.json

# 3. Modify definition (edit JSON file or use script)
# ... modify /tmp/current-def.json ...

# 4. Wrap definition in update request
cat > /tmp/update-request.json <<EOF
{
  "definition": $(cat /tmp/current-def.json)
}
EOF

# 5. Update via API
fab api -X post "workspaces/$WS_ID/semanticModels/$MODEL_ID/updateDefinition" \
  -i /tmp/update-request.json \
  --show_headers

# 6. Extract operation ID from Location header and poll status
OPERATION_ID="<extracted-from-Location-header>"
fab api "operations/$OPERATION_ID"
```

### Example: Add a Measure

```python
# Python script to add measure to definition
import json

with open('/tmp/current-def.json', 'r') as f:
    definition = json.load(f)

# Find the table's TMDL part
for part in definition['parts']:
    if part['path'] == 'definition/tables/Sales.tmdl':
        # Decode base64 content
        import base64
        tmdl_content = base64.b64decode(part['payload']).decode('utf-8')

        # Add measure (simplified - real implementation needs proper TMDL syntax)
        measure_tmdl = """
measure 'Total Revenue' = SUM(Sales[Amount])
    formatString: #,0.00
    displayFolder: "KPIs"
"""
        tmdl_content += measure_tmdl

        # Re-encode
        part['payload'] = base64.b64encode(tmdl_content.encode('utf-8')).decode('utf-8')

# Save modified definition
with open('/tmp/modified-def.json', 'w') as f:
    json.dump(definition, f)
```

## Executing DAX Queries

Use Power BI API to execute DAX queries against semantic models:

```bash
# Get model ID
MODEL_ID=$(fab get "Production.Workspace/Sales.SemanticModel" -q "id")

# Execute simple DAX query
fab api -A powerbi "datasets/$MODEL_ID/executeQueries" -X post -i '{
  "queries": [{
    "query": "EVALUATE VALUES(Date[Year])"
  }]
}'

# Execute TOPN query
fab api -A powerbi "datasets/$MODEL_ID/executeQueries" -X post -i '{
  "queries": [{
    "query": "EVALUATE TOPN(10, Sales, Sales[Amount], DESC)"
  }]
}'

# Execute multiple queries
fab api -A powerbi "datasets/$MODEL_ID/executeQueries" -X post -i '{
  "queries": [
    {"query": "EVALUATE VALUES(Date[Year])"},
    {"query": "EVALUATE SUMMARIZE(Sales, Date[Year], \"Total\", SUM(Sales[Amount]))"}
  ],
  "serializerSettings": {
    "includeNulls": false
  }
}'

# Execute query with parameters
fab api -A powerbi "datasets/$MODEL_ID/executeQueries" -X post -i '{
  "queries": [{
    "query": "EVALUATE FILTER(Sales, Sales[Year] = @Year)",
    "parameters": [
      {"name": "@Year", "value": "2024"}
    ]
  }]
}'
```

#### Using the DAX query script

```bash
python3 scripts/execute_dax.py \
  --workspace "Production.Workspace" \
  --model "Sales.SemanticModel" \
  --query "EVALUATE TOPN(10, Sales)" \
  --output /tmp/results.json
```

## Refreshing Models

```bash
# Get workspace and model IDs
WS_ID=$(fab get "Production.Workspace" -q "id")
MODEL_ID=$(fab get "Production.Workspace/Sales.SemanticModel" -q "id")

# Trigger full refresh
fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID/refreshes" -X post -i '{"type":"Full"}'

# Check latest refresh status
fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID/refreshes?\$top=1"

# Get refresh history
fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID/refreshes"

# Cancel refresh
REFRESH_ID="<refresh-request-id>"
fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID/refreshes/$REFRESH_ID" -X delete
```

## Model Refresh Schedule

```bash
MODEL_ID=$(fab get "Production.Workspace/Sales.SemanticModel" -q "id")

# Get current schedule
fab api -A powerbi "datasets/$MODEL_ID/refreshSchedule"

# Update schedule (daily at 2 AM)
fab api -A powerbi "datasets/$MODEL_ID/refreshSchedule" -X patch -i '{
  "enabled": true,
  "days": ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  "times": ["02:00"],
  "localTimeZoneId": "UTC"
}'

# Disable schedule
fab api -A powerbi "datasets/$MODEL_ID/refreshSchedule" -X patch -i '{
  "enabled": false
}'
```

## Copying Models

```bash
# Copy semantic model between workspaces (full paths required)
fab cp "Dev.Workspace/Sales.SemanticModel" "Production.Workspace/Sales.SemanticModel" -f

# Copy with new name
fab cp "Dev.Workspace/Sales.SemanticModel" "Production.Workspace/SalesProduction.SemanticModel" -f

# Note: Both source and destination must include workspace.Workspace/model.SemanticModel
# This copies the definition, not data or refreshes
```

## Model Deployment Workflow

### Dev to Production

```bash
#!/bin/bash

DEV_WS="Development.Workspace"
PROD_WS="Production.Workspace"
MODEL_NAME="Sales.SemanticModel"

# 1. Export from dev
fab export "$DEV_WS/$MODEL_NAME" -o /tmp/deployment

# 2. Test locally (optional - requires Power BI Desktop)
# Open /tmp/deployment/Sales/*.pbip in Power BI Desktop

# 3. Import to production
fab import "$PROD_WS/$MODEL_NAME" -i /tmp/deployment/$MODEL_NAME

# 4. Trigger refresh in production
PROD_MODEL_ID=$(fab get "$PROD_WS/$MODEL_NAME" -q "id")
fab api -A powerbi "datasets/$PROD_MODEL_ID/refreshes" -X post -i '{"type": "Full"}'

# 5. Monitor refresh
sleep 10
fab api -A powerbi "datasets/$PROD_MODEL_ID/refreshes" -q "value[0]"
```

## Working with Model Metadata

### Update Display Name

```bash
fab set "Production.Workspace/Sales.SemanticModel" -q displayName -i "Sales Analytics Model"
```

### Update Description

```bash
fab set "Production.Workspace/Sales.SemanticModel" -q description -i "Primary sales analytics semantic model for production reporting"
```

## Advanced Patterns

### Extract All Measures

```bash
# Get all table definitions containing measures
fab get "Production.Workspace/Sales.SemanticModel" -q "definition.parts[?contains(path, '/tables/')]" -o /tmp/tables.json

# Process with script to extract measures
python3 << 'EOF'
import json
import base64

with open('/tmp/tables.json', 'r') as f:
    parts = json.load(f)

measures = []
for part in parts:
    if 'tables' in part['path']:
        content = base64.b64decode(part['payload']).decode('utf-8')
        # Extract measure definitions (simple regex - real parser needed for production)
        import re
        measure_blocks = re.findall(r'measure\s+[^\n]+\s*=.*?(?=\n\s*(?:measure|column|$))', content, re.DOTALL)
        measures.extend(measure_blocks)

for i, measure in enumerate(measures, 1):
    print(f"\n--- Measure {i} ---")
    print(measure)
EOF
```

### Compare Models (Diff)

```bash
# Export both models
fab get "Production.Workspace/Sales.SemanticModel" -q "definition" -o /tmp/model1-def.json
fab get "Dev.Workspace/Sales.SemanticModel" -q "definition" -o /tmp/model2-def.json

# Use diff tool
diff <(jq -S . /tmp/model1-def.json) <(jq -S . /tmp/model2-def.json)

# jq -S sorts keys for consistent comparison
```

### Backup Model Definition

```bash
#!/bin/bash

WORKSPACE="Production.Workspace"
MODEL="Sales.SemanticModel"
BACKUP_DIR="/backups/$(date +%Y%m%d)"

mkdir -p "$BACKUP_DIR"

# Export as multiple formats for redundancy
fab get "$WORKSPACE/$MODEL" -q "definition" -o "$BACKUP_DIR/definition.json"

# Export as PBIP
python3 scripts/export_semantic_model_as_pbip.py \
  "$WORKSPACE/$MODEL" -o "$BACKUP_DIR/pbip"

# Save metadata
fab get "$WORKSPACE/$MODEL" -o "$BACKUP_DIR/metadata.json"

echo "Backup completed: $BACKUP_DIR"
```

## TMDL Structure Reference

A semantic model's TMDL definition consists of these parts:

```
model.tmdl                          # Model properties, culture, compatibility
.platform                           # Git integration metadata (exclude from updates)
definition/
├── model.tmdl                     # Alternative location for model properties
├── database.tmdl                  # Database properties
├── roles.tmdl                     # Row-level security roles
├── relationships.tmdl             # Relationships between tables
├── functions.tmdl                 # DAX user-defined functions
├── expressions/                   # M queries for data sources
│   ├── Source1.tmdl
│   └── Source2.tmdl
└── tables/                        # Table definitions
    ├── Customers.tmdl             # Columns, measures, hierarchies
    ├── Sales.tmdl
    ├── Products.tmdl
    └── Date.tmdl
```

### Common TMDL Parts to Query

```bash
MODEL="Production.Workspace/Sales.SemanticModel"

# Model properties
fab get "$MODEL" -q "definition.parts[?path=='model.tmdl'].payload | [0]"

# Roles and RLS
fab get "$MODEL" -q "definition.parts[?path=='definition/roles.tmdl'].payload | [0]"

# Relationships
fab get "$MODEL" -q "definition.parts[?path=='definition/relationships.tmdl'].payload | [0]"

# Data source expressions
fab get "$MODEL" -q "definition.parts[?starts_with(path, 'definition/expressions/')]"

# All tables
fab get "$MODEL" -q "definition.parts[?starts_with(path, 'definition/tables/')].path"
```

## Troubleshooting

### Model Not Found

```bash
# Verify workspace exists
fab exists "Production.Workspace"

# List semantic models in workspace
WS_ID=$(fab get "Production.Workspace" -q "id")
fab api "workspaces/$WS_ID/items" -q "value[?type=='SemanticModel']"

# Native alternative:
fab ls "Production.Workspace" -l -q "[?contains(name, '.SemanticModel')]"
```

### Update Definition Fails

Common issues:
1. **Included `.platform` file**: Never include this in updates
2. **Missing parts**: Must include ALL parts, not just modified ones
3. **Invalid TMDL syntax**: Validate TMDL before updating
4. **Encoding issues**: Ensure base64 encoding is correct

```bash
# Debug update operation
fab api "operations/$OPERATION_ID" -q "error"
```

### DAX Query Errors

```bash
# Check model is online
fab get "Production.Workspace/Sales.SemanticModel" -q "properties"

# Try simple query first
MODEL_ID=$(fab get "Production.Workspace/Sales.SemanticModel" -q "id")
fab api -A powerbi "datasets/$MODEL_ID/executeQueries" -X post -i '{
  "queries": [{"query": "EVALUATE {1}"}]
}'
```

## Storage Mode

Check table partition mode to determine if model is Direct Lake, Import, or DirectQuery.

```bash
# Get table definition and check partition mode
fab get "ws.Workspace/Model.SemanticModel" -q "definition.parts[?contains(path, 'tables/TableName')].payload | [0]"
```

Output shows partition type:

```
# Direct Lake
partition TableName = entity
    mode: directLake
    source
        entityName: table_name
        schemaName: schema
        expressionSource: DatabaseQuery

# Import
partition TableName = m
    mode: import
    source =
        let
            Source = Sql.Database("connection", "database"),
            Data = Source{[Schema="schema",Item="table"]}[Data]
        in
            Data
```

## Workspace Access

```bash
# Native (preferred):
fab acl ls "ws.Workspace"                              # List users
fab acl set "ws.Workspace" -I <objectId> -R Member     # Grant access
fab acl rm "ws.Workspace" -I <upn-or-clientId> -f      # Revoke access

# Via API (if needed):
fab get "ws.Workspace" -q "id"
fab api -A powerbi "groups/<workspace-id>/users"
```

Output:

```json
{
  "value": [
    {
      "emailAddress": "user@domain.com",
      "groupUserAccessRight": "Admin",
      "displayName": "User Name",
      "principalType": "User"
    }
  ]
}
```

Access rights: `Admin`, `Member`, `Contributor`, `Viewer`

## Find Reports Using a Model

Check report's `definition.pbir` for `byConnection.semanticmodelid`:

```bash
# Get model ID
fab get "ws.Workspace/Model.SemanticModel" -q "id"

# Check a report's connection
fab get "ws.Workspace/Report.Report" -q "definition.parts[?contains(path, 'definition.pbir')].payload | [0]"
```

Output:

```json
{
  "datasetReference": {
    "byConnection": {
      "connectionString": "...semanticmodelid=bee906a0-255e-..."
    }
  }
}
```

To find all reports using a model, check each report's definition.pbir for matching `semanticmodelid`.

## Performance Tips

1. **Cache model IDs**: Don't repeatedly query for the same ID
2. **Use JMESPath filtering**: Get only what you need
3. **Batch DAX queries**: Combine multiple queries in one request
4. **Export during off-hours**: Large model exports can be slow
5. **Use Power BI API for queries**: It's optimized for DAX execution

## Security Considerations

1. **Row-Level Security**: Check roles before exposing data
2. **Credentials in data sources**: Don't commit data source credentials
3. **Sensitive measures**: Review calculated columns/measures for sensitive logic
4. **Export restrictions**: Ensure exported models don't contain sensitive data

## Related Scripts

- `scripts/create_direct_lake_model.py` - Create Direct Lake model from lakehouse table
- `scripts/export_semantic_model_as_pbip.py` - Export model as PBIP
- `scripts/execute_dax.py` - Execute DAX queries
