# Essential Commands

Detailed command examples for common `fab` CLI operations.

## Navigation & Discovery

```bash
# List resources
fab ls                                    # List workspaces
fab ls "Production.Workspace"             # List items in workspace
fab ls "Production.Workspace" -l          # Detailed listing
fab ls "Data.Workspace/LH.Lakehouse"      # List lakehouse contents

# Filter with JMESPath (replaces many fab api calls)
fab ls "Production.Workspace" -q "[?contains(name, 'Report')]"
fab ls -q "[].name"                       # List all workspace names

# Check existence
fab exists "Production.Workspace/Sales.SemanticModel"

# Get details
fab get "Production.Workspace/Sales.Report"
fab get "Production.Workspace" -q "id"    # Query with JMESPath

# Discover supported commands for item types
fab desc .SemanticModel                   # What commands work on semantic models?
fab desc .Lakehouse                       # What commands work on lakehouses?
```

## Creating & Managing Resources

```bash
# Create workspace after using `fab ls .capacities` to check capacities
fab mkdir "NewWorkspace.Workspace" -P capacityname=MyCapacity

# Create items
fab mkdir "Production.Workspace/NewLakehouse.Lakehouse"
fab mkdir "Production.Workspace/Pipeline.DataPipeline"

# Update properties
fab set "Production.Workspace/Item.Notebook" -q displayName -i "New Name"
fab set "Production.Workspace" -q description -i "Production environment"

# Assign capacity or domain to workspace
fab assign .capacities/MyCapacity.Capacity -W "Production.Workspace"
fab assign .domains/Analytics.Domain -W "Production.Workspace" -f
fab unassign .capacities/MyCapacity.Capacity -W "Production.Workspace"

# Start/stop capacities
fab start .capacities/MyCapacity.Capacity
fab stop .capacities/MyCapacity.Capacity -f
```

## Access Control & Labels

```bash
# List workspace permissions
fab acl ls "Production.Workspace"
fab acl ls "Production.Workspace" -l      # Detailed output
fab acl get "Production.Workspace" -q "[*].principal"

# Set permissions (roles: Admin, Member, Contributor, Viewer)
fab acl set "Production.Workspace" -I <objectId> -R Member
fab acl set "Production.Workspace" -I <objectId> -R Viewer -f

# Remove permissions
fab acl rm "Production.Workspace" -I <upn-or-clientId> -f

# Connection permissions (roles: Owner, User, UserWithReshare)
fab acl set .connections/conn1.Connection -I <objectId> -R User

# Gateway permissions (roles: Admin, ConnectionCreator, ConnectionCreatorWithResharing)
fab acl set .gateways/gw1.Gateway -I <objectId> -R ConnectionCreator

# Sensitivity labels
fab label list-local                      # List configured labels
fab label set "ws.Workspace/Nb.Notebook" --name Confidential
fab label rm "ws.Workspace/Nb.Notebook" -f
```

## Copy, Move, Export, Import

```bash
# Copy between workspaces
fab cp "Dev.Workspace/Pipeline.DataPipeline" "Production.Workspace"
fab cp "Dev.Workspace/Report.Report" "Production.Workspace/ProdReport.Report"

# Copy entire workspace recursively (includes subfolders)
fab cp "Dev.Workspace" "Production.Workspace" -r -f

# Block copy if same-name item exists in different folder
fab cp "Dev.Workspace/Report.Report" "Production.Workspace" -bpc

# Move with recursive support
fab mv "Dev.Workspace" "Production.Workspace" -r -f

# Export to local (--format for specific definition format)
fab export "Production.Workspace/Model.SemanticModel" -o /tmp/exports
fab export "Production.Workspace" -o /tmp/backup -a  # Export all items
fab export "ws.Workspace/Nb.Notebook" -o /tmp --format py  # Export as Python

# Import from local
fab import "Production.Workspace/Pipeline.DataPipeline" -i /tmp/exports/Pipeline.DataPipeline -f

# IMPORTANT: Use -f flag for non-interactive execution
# Without -f, import/export operations expect an interactive terminal for confirmation
# This will fail in scripts, automation, or when stdin is not a terminal
fab import "ws.Workspace/Item.Type" -i ./Item.Type -f  # Required for scripts
```

### Export/Import Troubleshooting

**`[InvalidPath] No such file or directory`** -- the output directory does not exist. `fab export` does not create intermediate directories. Always create the output path first:

```bash
mkdir -p /tmp/exports
fab export "ws.Workspace/Report.Report" -o /tmp/exports -f
```

Names with apostrophes (e.g. `Claude Code's Workspace`) work fine inside double quotes -- no special escaping needed:

```bash
mkdir -p /tmp/exports
fab export "Claude Code's Workspace.Workspace/Report.Report" -o /tmp/exports -f
```

**`-f` flag behavior on export:** The `-f` (force) flag skips the sensitivity label confirmation prompt AND exports the item definition without its sensitivity label. The warning `Item definition is exported without its sensitivity label and its data` is informational, not an error. The actual error, if any, follows on the next line.

**Item not exportable:** Not all item types support export. Check with `fab desc .<ItemType>` to verify export is supported for the item type. Common non-exportable types include `.Dashboard`, `.Lakehouse` (files are copied with `fab cp`, not exported), and `.SQLEndpoint`.

## API Operations

Direct REST API access with automatic authentication.

**Audiences:**

- `fabric` (default) - Fabric REST API
- `powerbi` - Power BI REST API
- `storage` - OneLake Storage API
- `azure` - Azure Resource Manager

```bash
# Fabric API (default)
fab api workspaces
fab api workspaces -q "value[?type=='Workspace']"
fab api "workspaces/<workspace-id>/items"

# Power BI API (for DAX queries, dataset operations)
fab api -A powerbi groups
fab api -A powerbi "datasets/<model-id>/executeQueries" -X post -i '{"queries": [{"query": "EVALUATE VALUES(Date[Year])"}]}'

# POST/PUT/DELETE
fab api -X post "workspaces/<ws-id>/items" -i '{"displayName": "New Item", "type": "Lakehouse"}'
fab api -X put "workspaces/<ws-id>/items/<item-id>" -i /tmp/config.json
fab api -X delete "workspaces/<ws-id>/items/<item-id>"

# OneLake Storage API
fab api -A storage "WorkspaceName.Workspace/LH.Lakehouse/Files" -P resource=filesystem,recursive=false
```

## Job Management

```bash
# Run synchronously (wait for completion)
fab job run "Production.Workspace/ETL.Notebook"
fab job run "Production.Workspace/Pipeline.DataPipeline" --timeout 300

# Run with custom polling interval (seconds)
fab job run "Production.Workspace/ETL.Notebook" --polling_interval 30

# Run with parameters
fab job run "Production.Workspace/ETL.Notebook" -P date:string=2024-01-01,batch:int=1000,debug:bool=false

# Start asynchronously
fab job start "Production.Workspace/LongProcess.Notebook"

# Monitor
fab job run-list "Production.Workspace/ETL.Notebook"
fab job run-list "Production.Workspace/ETL.Notebook" --schedule  # Scheduled runs only
fab job run-status "Production.Workspace/ETL.Notebook" --id <job-id>

# Schedule
fab job run-sch "Production.Workspace/Pipeline.DataPipeline" --type daily --interval 10:00,16:00 --start 2024-11-15T09:00:00 --enable
fab job run-sch "Production.Workspace/Pipeline.DataPipeline" --type weekly --interval 10:00 --days Monday,Friday --enable

# Update schedule
fab job run-update "Production.Workspace/Pipeline.DataPipeline" --id <schedule-id> --disable
fab job run-update "Production.Workspace/Pipeline.DataPipeline" --id <schedule-id> --type cron --interval 5 --enable

# Remove schedule
fab job run-rm "Production.Workspace/Pipeline.DataPipeline" --id <schedule-id> -f

# Cancel (with optional --wait)
fab job run-cancel "Production.Workspace/ETL.Notebook" --id <job-id> --wait
```

## Table Operations

```bash
# View schema
fab table schema "Data.Workspace/LH.Lakehouse/Tables/dbo/customers"

# Load data (non-schema lakehouses only)
fab table load "Data.Workspace/LH.Lakehouse/Tables/sales" --file "Data.Workspace/LH.Lakehouse/Files/daily_sales.csv" --mode append

# Optimize (lakehouses only)
fab table optimize "Data.Workspace/LH.Lakehouse/Tables/transactions" --vorder --zorder customer_id,region

# Vacuum (lakehouses only)
fab table vacuum "Data.Workspace/LH.Lakehouse/Tables/temp_data" --retain_n_hours 48
```

## Common Workflows

### Semantic Model Management

```bash
# Find models
fab ls "ws.Workspace" | grep ".SemanticModel"

# Get definition
fab get "ws.Workspace/Model.SemanticModel" -q definition

# Trigger refresh
fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID/refreshes" -X post -i '{"type":"Full"}'

# Check refresh status
fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID/refreshes?\$top=1"
```

**Execute DAX:**

```bash
fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID/executeQueries" -X post \
  -i '{"queries":[{"query":"EVALUATE TOPN(5, '\''TableName'\'')"}]}'
```

**DAX rules:** EVALUATE required, single quotes around tables (`'Sales'`), qualify columns (`'Sales'[Amount]`).

For full details: [semantic-models.md](./semantic-models.md) | [querying-data.md](./querying-data.md)

### Report Operations

```bash
# Get report definition
fab get "ws.Workspace/Report.Report" -q definition

# Export to local
fab export "ws.Workspace/Report.Report" -o /tmp/exports -f

# Import from local
fab import "ws.Workspace/Report.Report" -i /tmp/exports/Report.Report -f

# Rebind to different model
fab set "ws.Workspace/Report.Report" -q semanticModelId -i "<new-model-id>"
```

For full details: [reports.md](./reports.md)

### Lakehouse/Warehouse Operations

```bash
# Browse contents
fab ls "Data.Workspace/LH.Lakehouse/Files"
fab ls "Data.Workspace/LH.Lakehouse/Tables/dbo"

# Upload/download files
fab cp ./local-data.csv "Data.Workspace/LH.Lakehouse/Files/data.csv"
fab cp "Data.Workspace/LH.Lakehouse/Files/data.csv" ~/Downloads/

# Load and optimize tables
fab table load "Data.Workspace/LH.Lakehouse/Tables/sales" --file "Data.Workspace/LH.Lakehouse/Files/sales.csv"
fab table optimize "Data.Workspace/LH.Lakehouse/Tables/sales" --vorder --zorder customer_id
```

### Supported Export/Import Item Types

| Type | Local Format | Notes |
|------|-------------|-------|
| `.Report` | PBIR folder | Double-click `.pbir` to open in Power BI Desktop (Developer Mode) |
| `.SemanticModel` | TMDL folder | Open with Power BI Desktop or Tabular Editor |
| `.Notebook` | `.py` or folder | Fabric notebook format; use `--format py` for plain Python |
| `.DataPipeline` | JSON folder | Pipeline definition |
| `.Lakehouse` | Metadata only | Files must be copied separately with `fab cp` |

### Export Output Structure

```
output/
  Report.Report/
    .platform
    definition.pbir
    definition/
      report.json
      pages/
  Model.SemanticModel/
    .platform
    definition/
      model.tmdl
      database.tmdl
      tables/
```

### Bulk Export/Import

```bash
# Export all semantic models from a workspace
fab ls "ws.Workspace" | grep ".SemanticModel" | while read item; do
  fab export "ws.Workspace/$item" -o ./models -f
done

# Export all reports
fab ls "ws.Workspace" | grep ".Report" | while read item; do
  fab export "ws.Workspace/$item" -o ./reports -f
done

# Bulk import all items in a directory
for item in ./exports/*; do
  name=$(basename "$item")
  fab import "ws.Workspace/$name" -i "$item" -f
done
```

### Environment Migration

```bash
# Export from dev
mkdir -p /tmp/migration
fab export "Dev.Workspace" -o /tmp/migration -a -f

# Import to production (item by item)
fab import "Production.Workspace/Pipeline.DataPipeline" -i /tmp/migration/Pipeline.DataPipeline -f
fab import "Production.Workspace/Report.Report" -i /tmp/migration/Report.Report -f

# Reports deployed without their model need rebinding
fab set "Production.Workspace/Report.Report" -q semanticModelId -i "<model-id>"
```

### Download as PBIP Project

To export a semantic model as a complete PBIP project (openable in Power BI Desktop):

```bash
python3 scripts/export_semantic_model_as_pbip.py \
  "Workspace.Workspace" "Model.SemanticModel" ./output
```
