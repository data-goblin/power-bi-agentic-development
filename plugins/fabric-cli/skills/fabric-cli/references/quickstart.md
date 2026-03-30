# Fabric CLI Quick Start Guide

Real working examples using Fabric workspaces and items. These commands are ready to copy-paste and modify for your own workspaces.

## Finding Items

### List Workspaces

```bash
# List all workspaces
fab ls

# List with details (shows IDs, types, etc.)
fab ls -l

# Find specific workspace
fab ls | grep "Sales"
```

### List Items in Workspace

```bash
# List all items in workspace
fab ls "Sales.Workspace"

# List with details (shows IDs, modification dates)
fab ls "Sales.Workspace" -l

# Filter by type
fab ls "Sales.Workspace" | grep "Notebook"
fab ls "Sales.Workspace" | grep "SemanticModel"
fab ls "Sales.Workspace" | grep "Lakehouse"

# Native alternative (preferred) — filter with JMESPath:
fab ls "Sales.Workspace" -q "[?contains(name, 'Notebook')]"
```

### Check if Item Exists

```bash
# Check workspace exists
fab exists "Sales.Workspace"

# Check specific item exists
fab exists "Sales.Workspace/Sales Model.SemanticModel"
fab exists "Sales.Workspace/SalesLH.Lakehouse"
fab exists "Sales.Workspace/ETL - Extract.Notebook"
```

### Get Item Details

```bash
# Get basic properties
fab get "Sales.Workspace/Sales Model.SemanticModel"

# Get all properties (verbose)
fab get "Sales.Workspace/Sales Model.SemanticModel" -v

# Get specific property (workspace ID)
fab get "Sales.Workspace" -q "id"

# Get specific property (model ID)
fab get "Sales.Workspace/Sales Model.SemanticModel" -q "id"

# Get display name
fab get "Sales.Workspace/Sales Model.SemanticModel" -q "displayName"
```

## Working with Semantic Models

### Get Model Information

```bash
# Get model definition (full TMDL structure)
fab get "Sales.Workspace/Sales Model.SemanticModel" -q "definition"

# Save definition to file
fab get "Sales.Workspace/Sales Model.SemanticModel" -q "definition" > sales-model-definition.json

# Get model creation date
fab get "Sales.Workspace/Sales Model.SemanticModel" -q "properties.createdDateTime"

# Get model type (DirectLake, Import, etc.)
fab get "Sales.Workspace/Sales Model.SemanticModel" -q "properties.mode"
```

### Check Refresh Status

```bash
# First, get the workspace ID
fab get "Sales.Workspace" -q "id"
# Returns: a1b2c3d4-e5f6-7890-abcd-ef1234567890

# Then get the model ID
fab get "Sales.Workspace/Sales Model.SemanticModel" -q "id"
# Returns: 12345678-abcd-ef12-3456-789abcdef012

# Now use those IDs to get latest refresh (put $top in the URL)
fab api -A powerbi "groups/a1b2c3d4-e5f6-7890-abcd-ef1234567890/datasets/12345678-abcd-ef12-3456-789abcdef012/refreshes?\$top=1"

# Get full refresh history
fab api -A powerbi "groups/a1b2c3d4-e5f6-7890-abcd-ef1234567890/datasets/12345678-abcd-ef12-3456-789abcdef012/refreshes"
```

### Query Model with DAX

```bash
# First, get the model definition to see table/column names
fab get "Sales.Workspace/Sales Model.SemanticModel" -q "definition"

# Get the workspace and model IDs
fab get "Sales.Workspace" -q "id"
fab get "Sales.Workspace/Sales Model.SemanticModel" -q "id"

# Execute DAX query (using proper table qualification)
fab api -A powerbi "groups/a1b2c3d4-e5f6-7890-abcd-ef1234567890/datasets/12345678-abcd-ef12-3456-789abcdef012/executeQueries" -X post -i '{"queries":[{"query":"EVALUATE TOPN(1, '\''Orders'\'', '\''Orders'\''[OrderDate], DESC)"}],"serializerSettings":{"includeNulls":true}}'

# Query top 5 records from a table
fab api -A powerbi "groups/a1b2c3d4-e5f6-7890-abcd-ef1234567890/datasets/12345678-abcd-ef12-3456-789abcdef012/executeQueries" -X post -i '{"queries":[{"query":"EVALUATE TOPN(5, '\''Orders'\'')"}],"serializerSettings":{"includeNulls":true}}'
```

### Trigger Model Refresh

```bash
# Get workspace and model IDs
fab get "Sales.Workspace" -q "id"
fab get "Sales.Workspace/Sales Model.SemanticModel" -q "id"

# Trigger full refresh
fab api -A powerbi "groups/a1b2c3d4-e5f6-7890-abcd-ef1234567890/datasets/12345678-abcd-ef12-3456-789abcdef012/refreshes" -X post -i '{"type": "Full", "commitMode": "Transactional"}'

# Monitor refresh status
fab api -A powerbi "groups/a1b2c3d4-e5f6-7890-abcd-ef1234567890/datasets/12345678-abcd-ef12-3456-789abcdef012/refreshes?\$top=1"
```

## Working with Notebooks

### List Notebooks

```bash
# List all notebooks in workspace
fab ls "Sales.Workspace" | grep "Notebook"

# Get specific notebook details
fab get "Sales.Workspace/ETL - Extract.Notebook"

# Get notebook ID
fab get "Sales.Workspace/ETL - Extract.Notebook" -q "id"
```

### Run Notebook

```bash
# Run notebook synchronously (wait for completion)
fab job run "Sales.Workspace/ETL - Extract.Notebook"

# Run with timeout (300 seconds = 5 minutes)
fab job run "Sales.Workspace/ETL - Extract.Notebook" --timeout 300

# Run with parameters
fab job run "Sales.Workspace/ETL - Extract.Notebook" -P \
  date:string=2025-10-17,\
  debug:bool=true
```

### Run Notebook Asynchronously

```bash
# Start notebook and return immediately
fab job start "Sales.Workspace/ETL - Extract.Notebook"

# Check execution history
fab job run-list "Sales.Workspace/ETL - Extract.Notebook"

# Check specific job status (replace <job-id> with actual ID)
fab job run-status "Sales.Workspace/ETL - Extract.Notebook" --id <job-id>
```

### Get Notebook Definition

```bash
# Get full notebook definition
fab get "Sales.Workspace/ETL - Extract.Notebook" -q "definition"

# Save to file
fab get "Sales.Workspace/ETL - Extract.Notebook" -q "definition" > etl-extract-notebook.json

# Get notebook code content
fab get "Sales.Workspace/ETL - Extract.Notebook" -q "definition.parts[?path=='notebook-content.py'].payload | [0]" | base64 -d
```

## Working with Lakehouses

### Browse Lakehouse

```bash
# List lakehouse contents
fab ls "Sales.Workspace/SalesLH.Lakehouse"

# List Files directory
fab ls "Sales.Workspace/SalesLH.Lakehouse/Files"

# List specific folder in Files
fab ls "Sales.Workspace/SalesLH.Lakehouse/Files/2025/10"

# List Tables
fab ls "Sales.Workspace/SalesLH.Lakehouse/Tables"

# List with details (shows sizes, modified dates)
fab ls "Sales.Workspace/SalesLH.Lakehouse/Tables" -l

# List specific schema tables
fab ls "Sales.Workspace/SalesLH.Lakehouse/Tables/bronze"
fab ls "Sales.Workspace/SalesLH.Lakehouse/Tables/gold"
```

### Get Table Schema

```bash
# View table schema
fab table schema "Sales.Workspace/SalesLH.Lakehouse/Tables/bronze/raw_orders"
fab table schema "Sales.Workspace/SalesLH.Lakehouse/Tables/gold/orders"

# Save schema to file
fab table schema "Sales.Workspace/SalesLH.Lakehouse/Tables/gold/orders" > orders-schema.json
```

### Check Table Last Modified

```bash
# List tables with modification times
fab ls "Sales.Workspace/SalesLH.Lakehouse/Tables/gold" -l

# Get specific table details
fab get "Sales.Workspace/SalesLH.Lakehouse/Tables/gold/orders"
```

## Working with Reports

### List Reports

```bash
# List all reports
fab ls "Sales.Workspace" | grep "Report"

# Get report details
fab get "Sales.Workspace/Sales Dashboard.Report"

# Get report ID
fab get "Sales.Workspace/Sales Dashboard.Report" -q "id"
```

### Export Report Definition

```bash
# Get report definition as JSON
fab get "Sales.Workspace/Sales Dashboard.Report" -q "definition" > sales-report.json

# Export report to local directory (creates PBIR structure)
fab export "Sales.Workspace/Sales Dashboard.Report" -o ./reports-backup -f
```

### Get Report Metadata

```bash
# Get connected semantic model ID
fab get "Sales.Workspace/Sales Dashboard.Report" -q "properties.datasetId"

# Get report connection string
fab get "Sales.Workspace/Sales Dashboard.Report" -q "definition.parts[?path=='definition.pbir'].payload.datasetReference"
```

## Download and Re-upload Workflows

### Backup Semantic Model

```bash
# 1. Get model definition
fab get "Sales.Workspace/Sales Model.SemanticModel" -q "definition" > backup-sales-model-$(date +%Y%m%d).json

# 2. Get model metadata
fab get "Sales.Workspace/Sales Model.SemanticModel" > backup-sales-model-metadata-$(date +%Y%m%d).json
```

### Export and Import Notebook

```bash
# Export notebook
fab export "Sales.Workspace/ETL - Extract.Notebook" -o ./notebooks-backup

# Import to another workspace (or same workspace with different name)
fab import "Dev.Workspace/ETL Extract Copy.Notebook" -i ./notebooks-backup/ETL\ -\ Extract.Notebook
```

### Copy Items Between Workspaces

```bash
# Copy semantic model
fab cp "Sales.Workspace/Sales Model.SemanticModel" "Dev.Workspace"

# Copy with new name
fab cp "Sales.Workspace/Sales Model.SemanticModel" "Dev.Workspace/Sales Model Test.SemanticModel"

# Copy notebook
fab cp "Sales.Workspace/ETL - Extract.Notebook" "Dev.Workspace"

# Copy report
fab cp "Sales.Workspace/Sales Dashboard.Report" "Dev.Workspace"
```

## Combined Workflows

### Complete Model Status Check

```bash
# Check last refresh
fab api -A powerbi "groups/a1b2c3d4-e5f6-7890-abcd-ef1234567890/datasets/12345678-abcd-ef12-3456-789abcdef012/refreshes?\$top=1"

# Check latest data in model
fab api -A powerbi "groups/a1b2c3d4-e5f6-7890-abcd-ef1234567890/datasets/12345678-abcd-ef12-3456-789abcdef012/executeQueries" -X post -i '{"queries":[{"query":"EVALUATE TOPN(1, '\''Orders'\'', '\''Orders'\''[OrderDate], DESC)"}],"serializerSettings":{"includeNulls":true}}'

# Check lakehouse data freshness
fab ls "Sales.Workspace/SalesLH.Lakehouse/Tables/gold/orders" -l
```

### Check All Notebooks in Workspace

```bash
# List all notebooks
fab ls "Sales.Workspace" | grep Notebook

# Check execution history for each
fab job run-list "Sales.Workspace/ETL - Extract.Notebook"
fab job run-list "Sales.Workspace/ETL - Transform.Notebook"
```

### Monitor Lakehouse Data Freshness

```bash
# Check gold layer tables
fab ls "Sales.Workspace/SalesLH.Lakehouse/Tables/gold" -l

# Check bronze layer tables
fab ls "Sales.Workspace/SalesLH.Lakehouse/Tables/bronze" -l

# Check latest files
fab ls "Sales.Workspace/SalesLH.Lakehouse/Files/2025/10" -l
```

## Tips and Tricks

### Get IDs for API Calls

```bash
# Get workspace ID
fab get "Sales.Workspace" -q "id"

# Get model ID
fab get "Sales.Workspace/Sales Model.SemanticModel" -q "id"

# Get lakehouse ID
fab get "Sales.Workspace/SalesLH.Lakehouse" -q "id"

# Then use the IDs directly in API calls
fab api "workspaces/a1b2c3d4-e5f6-7890-abcd-ef1234567890/items"
# Native alternative (preferred):
fab ls "Sales.Workspace"

fab api -A powerbi "groups/a1b2c3d4-e5f6-7890-abcd-ef1234567890/datasets/12345678-abcd-ef12-3456-789abcdef012/refreshes"
```

### Pipe to jq for Pretty JSON

```bash
# Pretty print JSON output
fab get "Sales.Workspace/Sales Model.SemanticModel" | jq .

# Extract specific fields
fab get "Sales.Workspace/Sales Model.SemanticModel" | jq '{id: .id, name: .displayName, created: .properties.createdDateTime}'

# Get workspace ID first, then filter arrays
fab get "Sales.Workspace" -q "id"
fab api "workspaces/a1b2c3d4-e5f6-7890-abcd-ef1234567890/items" | jq '.value[] | select(.type=="Notebook") | .displayName'
# Native alternative (preferred):
fab ls "Sales.Workspace" -q "[?contains(name, 'Notebook')]"
```

### Use with grep for Filtering

```bash
# Find items by pattern
fab ls "Sales.Workspace" | grep -i "etl"
fab ls "Sales.Workspace" | grep -i "sales"

# Count items by type
fab ls "Sales.Workspace" | grep -c "Notebook"
fab ls "Sales.Workspace" | grep -c "SemanticModel"
```

### Create Aliases for Common Commands

```bash
# Add to ~/.bashrc or ~/.zshrc
alias sales-ls='fab ls "Sales.Workspace"'
alias sales-notebooks='fab ls "Sales.Workspace" | grep Notebook'
alias sales-refresh='fab api -A powerbi "groups/<ws-id>/datasets/<model-id>/refreshes?\$top=1"'

# Then use:
sales-ls
sales-notebooks
sales-refresh
```

## Common Patterns

### Get All Items of a Type

```bash
# Get workspace ID first
fab get "Sales.Workspace" -q "id"

# Get all notebooks
fab api "workspaces/a1b2c3d4-e5f6-7890-abcd-ef1234567890/items" -q "value[?type=='Notebook']"
# Native alternative (preferred):
fab ls "Sales.Workspace" -q "[?contains(name, 'Notebook')]"

# Get all semantic models
fab api "workspaces/a1b2c3d4-e5f6-7890-abcd-ef1234567890/items" -q "value[?type=='SemanticModel']"
# Native alternative (preferred):
fab ls "Sales.Workspace" -q "[?contains(name, 'SemanticModel')]"

# Get all lakehouses
fab api "workspaces/a1b2c3d4-e5f6-7890-abcd-ef1234567890/items" -q "value[?type=='Lakehouse']"
# Native alternative (preferred):
fab ls "Sales.Workspace" -q "[?contains(name, 'Lakehouse')]"

# Get all reports
fab api "workspaces/a1b2c3d4-e5f6-7890-abcd-ef1234567890/items" -q "value[?type=='Report']"
# Native alternative (preferred):
fab ls "Sales.Workspace" -q "[?contains(name, 'Report')]"
```

### Export Entire Workspace

```bash
# Export all items in workspace
fab export "Sales.Workspace" -o ./sales-workspace-backup -a

# This creates a full backup with all items
```

### Find Items by Name Pattern

```bash
# Get workspace ID first
fab get "Sales.Workspace" -q "id"

# Find items with "ETL" in name
fab api "workspaces/a1b2c3d4-e5f6-7890-abcd-ef1234567890/items" -q "value[?contains(displayName, 'ETL')]"
# Native alternative (preferred):
fab ls "Sales.Workspace" -q "[?contains(name, 'ETL')]"

# Find items with "Sales" in name
fab api "workspaces/a1b2c3d4-e5f6-7890-abcd-ef1234567890/items" -q "value[?contains(displayName, 'Sales')]"
# Native alternative (preferred):
fab ls "Sales.Workspace" -q "[?contains(name, 'Sales')]"
```

## Next Steps

- See [semantic-models.md](./semantic-models.md) for advanced model operations
- See [notebooks.md](./notebooks.md) for notebook scheduling and orchestration
- See [reports.md](./reports.md) for report deployment workflows
- See [scripts/README.md](../scripts/README.md) for helper scripts
