# Fabric CLI Command Reference

Comprehensive reference for Microsoft Fabric CLI commands, flags, and patterns.

## Table of Contents

- [Item Types](#item-types)
- [File System Commands](#file-system-commands)
- [ACL Commands](#acl-commands)
- [Label Commands](#label-commands)
- [API Commands](#api-commands)
- [Job Commands](#job-commands)
- [Table Commands](#table-commands)
- [Util Commands](#util-commands)
- [Advanced Patterns](#advanced-patterns)

## Item Types

All 49 supported item types:

| Extension | Description |
|-----------|-------------|
| `.AISkill` | AI skills |
| `.ApacheAirflowJob` | Apache Airflow jobs |
| `.Capacity` | Capacities |
| `.Connection` | Connections |
| `.CopyJob` | Copy jobs |
| `.CosmosDBDatabase` | Cosmos DB databases |
| `.Dashboard` | Power BI dashboards |
| `.Dataflow` | Dataflows |
| `.Datamart` | Datamarts |
| `.DataPipeline` | Data pipelines |
| `.DigitalTwinBuilder` | Digital twin builder |
| `.Domain` | Domains |
| `.Environment` | Spark environments |
| `.Eventhouse` | Eventhouses |
| `.Eventstream` | Event streams |
| `.Exploration` | Explorations |
| `.ExternalDataShare` | External data shares |
| `.Folder` | Folders |
| `.Gateway` | Gateways |
| `.GraphQLApi` | GraphQL APIs |
| `.GraphQuerySet` | Graph query sets |
| `.Healthcaredatasolution` | Healthcare data solution |
| `.KQLDashboard` | KQL dashboards |
| `.KQLDatabase` | KQL databases |
| `.KQLQueryset` | KQL querysets |
| `.Lakehouse` | Lakehouses |
| `.ManagedIdentity` | Managed identities |
| `.ManagedPrivateEndpoint` | Managed private endpoints |
| `.MetricSet` | Metric sets |
| `.MirroredDatabase` | Mirrored databases |
| `.MirroredWarehouse` | Mirrored warehouses |
| `.MLExperiment` | ML experiments |
| `.MLModel` | ML models |
| `.MountedDataFactory` | Mounted data factories |
| `.Notebook` | Fabric notebooks |
| `.OrgApp` | Org apps |
| `.PaginatedReport` | Paginated reports |
| `.Personal` | Personal workspaces |
| `.Reflex` | Reflex items |
| `.Report` | Power BI reports |
| `.RetailDataManager` | Retail data manager |
| `.SemanticModel` | Power BI datasets/semantic models |
| `.SparkJobDefinition` | Spark job definitions |
| `.SparkPool` | Spark pools |
| `.SQLDatabase` | SQL databases |
| `.SQLEndpoint` | SQL endpoints |
| `.SustainabilityDataSolution` | Sustainability data solution |
| `.UserDataFunction` | User data functions |
| `.VariableLibrary` | Variable libraries |
| `.Warehouse` | Warehouses |
| `.Workspace` | Workspaces (containers) |

## File System Commands

### ls (dir) - List Resources

#### Syntax

```bash
fab ls [path] [-l] [-a] [-q <jmespath>]
```

#### Flags

- `-l` - Long format (detailed)
- `-a` - Show hidden items
- `-q, --query` - JMESPath query to filter results

#### Examples

```bash
# List workspaces
fab ls

# List items in workspace with details
fab ls "Production.Workspace" -l

# Show hidden items (capacities, connections, domains, gateways)
fab ls -la

# List lakehouse contents
fab ls "Data.Workspace/LH.Lakehouse"
fab ls "Data.Workspace/LH.Lakehouse/Files"
fab ls "Data.Workspace/LH.Lakehouse/Tables/dbo"

# Filter with JMESPath query
fab ls -q "[].name"
fab ls "Production.Workspace" -q "[?contains(name, 'Report')]"
```

### cd - Change Directory

#### Syntax

```bash
fab cd <path>
```

#### Examples

```bash
# Navigate to workspace
fab cd "Production.Workspace"

# Navigate to item
fab cd "/Analytics.Workspace/Sales.SemanticModel"

# Relative navigation
fab cd "../Dev.Workspace"

# Personal workspace
fab cd ~
```

### pwd - Print Working Directory

#### Syntax

```bash
fab pwd
```

### exists - Check Existence

#### Syntax

```bash
fab exists <path>
```

#### Returns

`* true` or `* false`

#### Examples

```bash
fab exists "Production.Workspace"
fab exists "Production.Workspace/Sales.SemanticModel"
```

### get - Get Resource Details

#### Syntax

```bash
fab get <path> [-v] [-q <jmespath>] [-o <output>] [-f]
```

#### Flags

- `-v, --verbose` - Show all properties
- `-q, --query` - JMESPath query
- `-o, --output` - Save to file
- `-f, --force` - Gets item definition without sensitivity label

#### Examples

```bash
# Get workspace
fab get "Production.Workspace"

# Get item with all properties
fab get "Production.Workspace/Sales.Report" -v

# Query specific property
fab get "Production.Workspace" -q "id"
fab get "Production.Workspace/Sales.SemanticModel" -q "definition.parts[0]"

# Save to file
fab get "Production.Workspace/Sales.SemanticModel" -o /tmp/model.json
```

### set - Set Resource Properties

#### Syntax

```bash
fab set <path> -q <property_path> -i <value>
```

#### Flags

- `-q, --query` - Property path (JMESPath-style)
- `-i, --input` - New value (string or JSON)

#### Examples

```bash
# Update display name
fab set "Production.Workspace/Item.Notebook" -q displayName -i "New Name"

# Update description
fab set "Production.Workspace" -q description -i "Production environment"

# Update Spark runtime
fab set "Production.Workspace" -q sparkSettings.environment.runtimeVersion -i 1.2

# Assign Spark pool
fab set "Production.Workspace" -q sparkSettings.pool.defaultPool -i '{"name": "Starter Pool", "type": "Workspace"}'

# Rebind report to model
fab set "Production.Workspace/Report.Report" -q semanticModelId -i "<model-id>"
```

### mkdir (create) - Create Resources

#### Syntax

```bash
fab mkdir <path> [-P <param=value>]
```

#### Flags

- `-P, --params` - Parameters (key=value format)

#### Examples

```bash
# Create workspace
fab mkdir "NewWorkspace.Workspace"
fab mkdir "NewWorkspace.Workspace" -P capacityname=MyCapacity
fab mkdir "NewWorkspace.Workspace" -P capacityname=none

# Create items
fab mkdir "Production.Workspace/NewLakehouse.Lakehouse"
fab mkdir "Production.Workspace/Notebook.Notebook"

# Create with parameters
fab mkdir "Production.Workspace/LH.Lakehouse" -P enableSchemas=true
fab mkdir "Production.Workspace/DW.Warehouse" -P enableCaseInsensitive=true

# Check supported parameters
fab mkdir "Item.Lakehouse" -P
```

### cp (copy) - Copy Resources

#### Syntax

```bash
fab cp <source> <destination> [-r] [-f] [-bpc]
```

#### Flags

- `-r, --recursive` - Copies all items recursively (workspaces and folders)
- `-f, --force` - Skip confirmation
- `-bpc, --block_on_path_collision` - Prevents copying when same-name item exists in different folder

#### Supported types

`.Notebook`, `.SparkJobDefinition`, `.DataPipeline`, `.Report`, `.SemanticModel`, `.KQLDatabase`, `.KQLDashboard`, `.KQLQueryset`, `.Eventhouse`, `.Eventstream`, `.MirroredDatabase`, `.Reflex`, `.MountedDataFactory`, `.CopyJob`, `.VariableLibrary`

#### Examples

```bash
# Copy item to workspace (keeps same name)
fab cp "Dev.Workspace/Pipeline.DataPipeline" "Production.Workspace"

# Copy with new name
fab cp "Dev.Workspace/Pipeline.DataPipeline" "Production.Workspace/ProdPipeline.DataPipeline"

# Copy to folder
fab cp "Dev.Workspace/Report.Report" "Production.Workspace/Reports.Folder"

# Copy files to/from lakehouse
fab cp ./local-data.csv "Data.Workspace/LH.Lakehouse/Files/data.csv"
fab cp "Data.Workspace/LH.Lakehouse/Files/data.csv" ~/Downloads/

# Recursive copy of entire workspace
fab cp "Dev.Workspace" "Prod.Workspace" -r -f

# Copy with path collision protection
fab cp "Dev.Workspace/Report.Report" "Prod.Workspace" -bpc
```

### mv (move) - Move Resources

#### Syntax

```bash
fab mv <source> <destination> [-r] [-f]
```

#### Flags

- `-r, --recursive` - Moves all items recursively
- `-f, --force` - Skip confirmation

#### Examples

```bash
# Move item to workspace
fab mv "Dev.Workspace/Pipeline.DataPipeline" "Production.Workspace"

# Move with rename
fab mv "Dev.Workspace/Pipeline.DataPipeline" "Production.Workspace/NewPipeline.DataPipeline"

# Move to folder
fab mv "Dev.Workspace/Report.Report" "Production.Workspace/Archive.Folder"

# Recursive move of entire workspace
fab mv "Dev.Workspace" "Prod.Workspace" -r -f
```

### rm (del) - Delete Resources

#### Syntax

```bash
fab rm <path> [-f]
```

#### Flags

- `-f, --force` - Skip confirmation

#### Examples

```bash
# Delete with confirmation (interactive)
fab rm "Dev.Workspace/OldReport.Report"

# Force delete
fab rm "Dev.Workspace/OldLakehouse.Lakehouse" -f

# Delete workspace and all contents
fab rm "OldWorkspace.Workspace" -f
```

### export - Export Item Definitions

#### Syntax

```bash
fab export <item_path> -o <output_path> [-a] [--format <format>] [-f]
```

#### Flags

- `-o, --output` - Output directory (local or lakehouse Files)
- `-a` - Export all items (when exporting workspace)
- `--format` - Format of the item definition to export
- `-f, --force` - Export without sensitivity label

#### Supported types

Same as `cp` command

#### Examples

```bash
# Export item to local
fab export "Production.Workspace/Sales.SemanticModel" -o /tmp/exports

# Export all workspace items
fab export "Production.Workspace" -o /tmp/backup -a

# Export to lakehouse
fab export "Production.Workspace/Pipeline.DataPipeline" -o "Data.Workspace/Archive.Lakehouse/Files/exports"

# Export notebook as Python file
fab export "ws.Workspace/Nb.Notebook" -o /tmp --format py
```

### import - Import Item Definitions

#### Syntax

```bash
fab import <item_path> -i <input_path> [--format <format>]
```

#### Flags

- `-i, --input` - Input directory or file
- `--format` - Format override (e.g., `py` for notebooks)

#### Examples

```bash
# Import item from local
fab import "Production.Workspace/Pipeline.DataPipeline" -i /tmp/exports/Pipeline.DataPipeline

# Import notebook from Python file
fab import "Production.Workspace/ETL.Notebook" -i /tmp/etl_script.py --format py

# Import from lakehouse
fab import "Production.Workspace/Report.Report" -i "Data.Workspace/Archive.Lakehouse/Files/exports/Report.Report"
```

### open - Open in Browser

#### Syntax

```bash
fab open <path>
```

#### Examples

```bash
fab open "Production.Workspace"
fab open "Production.Workspace/Sales.Report"
```

### ln (mklink) - Create Shortcuts

#### Syntax

```bash
fab ln <source> <destination>
```

### assign / unassign - Assign Resources

#### Syntax

```bash
fab assign <resource_path> -W <workspace> [-f]
fab unassign <resource_path> -W <workspace> [-f]
```

#### Flags

- `-W, --workspace` - Target workspace
- `-f, --force` - Skip confirmation

#### Examples

```bash
# Assign capacity to workspace
fab assign .capacities/capac1.Capacity -W ws1.Workspace

# Assign domain to workspace
fab assign .domains/domain1.Domain -W ws1.Workspace -f

# Unassign capacity from workspace
fab unassign .capacities/capac1.Capacity -W ws1.Workspace

# Unassign domain from workspace
fab unassign .domains/domain1.Domain -W ws1.Workspace -f
```

### start / stop - Start/Stop Resources

#### Syntax

```bash
fab start <path> [-f]
fab stop <path> [-f]
```

#### Supported

`.MirroredDatabase`, `.Capacity`

#### Examples

```bash
# Start/stop a capacity
fab start .capacities/capac1.Capacity
fab stop .capacities/capac1.Capacity -f

# Start/stop a mirrored database
fab start "Data.Workspace/Mirror.MirroredDatabase" -f
fab stop "Data.Workspace/Mirror.MirroredDatabase" -f
```

## ACL Commands

### acl ls - List Access Control

#### Syntax

```bash
fab acl ls <path> [-l] [-q <jmespath>]
```

#### Flags

- `-l` - Long format (detailed)
- `-q, --query` - JMESPath query to filter results

#### Examples

```bash
# List workspace ACLs
fab acl ls "Production.Workspace"

# List with details
fab acl ls "Production.Workspace" -l

# Filter ACLs
fab acl ls "Production.Workspace" -q "[?role=='Admin']"
```

### acl get - Get Access Details

#### Syntax

```bash
fab acl get <path> [-q <jmespath>] [-o <output>]
```

#### Flags

- `-q, --query` - JMESPath query
- `-o, --output` - Save to file

#### Examples

```bash
# Get ACL details
fab acl get "Production.Workspace"

# Query specific role
fab acl get "Production.Workspace" -q "[?role=='Viewer']"

# Save ACL to file
fab acl get "Production.Workspace" -o /tmp/acl.json
```

### acl set - Set Access Control

#### Syntax

```bash
fab acl set <path> -I <objectId> -R <role> [-f]
```

#### Flags

- `-I` - Object ID (user, group, or service principal)
- `-R` - Role to assign
- `-f, --force` - Skip confirmation

#### Workspace Roles

| Role | Description |
|------|-------------|
| `Admin` | Full control |
| `Member` | Edit and share |
| `Contributor` | Edit items |
| `Viewer` | Read-only |

#### Connection Roles

| Role | Description |
|------|-------------|
| `Owner` | Full control |
| `User` | Use connection |
| `UserWithReshare` | Use and reshare |

#### Gateway Roles

| Role | Description |
|------|-------------|
| `Admin` | Full control |
| `ConnectionCreator` | Create connections |
| `ConnectionCreatorWithResharing` | Create and reshare connections |

#### Examples

```bash
# Grant workspace viewer access
fab acl set "Production.Workspace" -I <object-id> -R Viewer

# Grant admin access with force
fab acl set "Production.Workspace" -I <object-id> -R Admin -f

# Set connection role
fab acl set .connections/conn1.Connection -I <object-id> -R User

# Set gateway role
fab acl set .gateways/gw1.Gateway -I <object-id> -R ConnectionCreator
```

### acl rm - Remove Access Control

#### Syntax

```bash
fab acl rm <path> -I <identity> [-f]
```

#### Flags

- `-I` - Object ID to remove
- `-f, --force` - Skip confirmation

#### Examples

```bash
# Remove workspace access
fab acl rm "Production.Workspace" -I <object-id>

# Force remove
fab acl rm "Production.Workspace" -I <object-id> -f
```

## Label Commands

### label list-local - List Configured Labels

#### Syntax

```bash
fab label list-local
```

Lists sensitivity labels configured locally via `config set local_definition_labels`.

### label set - Set Sensitivity Label

#### Syntax

```bash
fab label set <path> -n <name> [-f]
```

#### Flags

- `-n, --name` - Label name
- `-f, --force` - Skip confirmation

#### Prerequisites

Configure label definitions first:

```bash
fab config set local_definition_labels /path/to/labels.json
```

#### Examples

```bash
fab label set "Production.Workspace/Sales.Report" -n "Confidential"
fab label set "Production.Workspace/Sales.SemanticModel" -n "Internal" -f
```

### label rm - Remove Sensitivity Label

#### Syntax

```bash
fab label rm <path> [-f]
```

#### Flags

- `-f, --force` - Skip confirmation

#### Examples

```bash
fab label rm "Production.Workspace/Sales.Report"
fab label rm "Production.Workspace/Sales.Report" -f
```

## API Commands

### api - Make API Requests

#### Syntax

```bash
fab api <endpoint> [-A <audience>] [-X <method>] [-i <input>] [-q <query>] [-P <params>] [-H <headers>] [--show_headers]
```

#### Flags

- `-A, --audience` - API audience (fabric, powerbi, storage, azure)
- `-X, --method` - HTTP method (get, post, put, delete, patch)
- `-i, --input` - Request body (JSON string or file path)
- `-q, --query` - JMESPath query to filter response
- `-P, --params` - Query parameters (key=value format)
- `-H, --headers` - Additional headers (key=value format)
- `--show_headers` - Include response headers

#### Audiences

| Audience | Base URL | Use For |
|----------|----------|---------|
| `fabric` (default) | `https://api.fabric.microsoft.com` | Fabric REST API |
| `powerbi` | `https://api.powerbi.com` | Power BI REST API, DAX queries |
| `storage` | `https://*.dfs.fabric.microsoft.com` | OneLake Storage API |
| `azure` | `https://management.azure.com` | Azure Resource Manager |

#### Examples

#### Fabric API

```bash
# GET requests
fab api workspaces
fab api "workspaces/<workspace-id>"
fab api "workspaces/<workspace-id>/items"
fab api workspaces -q "value[?type=='Workspace']"

# POST request with inline JSON
fab api -X post "workspaces/<workspace-id>/items" -i '{"displayName": "New Item", "type": "Lakehouse"}'

# POST with file
fab api -X post "workspaces/<workspace-id>/lakehouses" -i /tmp/config.json

# PUT to update
fab api -X put "workspaces/<workspace-id>/items/<item-id>" -i '{"displayName": "Updated"}'

# DELETE
fab api -X delete "workspaces/<workspace-id>/items/<item-id>"

# Update semantic model definition
fab api -X post "workspaces/<workspace-id>/semanticModels/<model-id>/updateDefinition" -i /tmp/definition.json --show_headers
```

#### Power BI API

```bash
# List groups (workspaces)
fab api -A powerbi groups

# Get datasets in workspace
fab api -A powerbi "groups/<workspace-id>/datasets"

# Execute DAX query
fab api -A powerbi "datasets/<model-id>/executeQueries" -X post -i '{"queries": [{"query": "EVALUATE VALUES(Date[Year])"}]}'

# Refresh dataset
fab api -A powerbi "datasets/<model-id>/refreshes" -X post -i '{}'

# Get refresh history
fab api -A powerbi "datasets/<model-id>/refreshes"
```

#### OneLake Storage API

```bash
# List files with parameters
fab api -A storage "WorkspaceName.Workspace/LH.Lakehouse/Files" -P resource=filesystem,recursive=false

# With query string
fab api -A storage "WorkspaceName/LH.Lakehouse/Files?resource=filesystem&recursive=false"
```

#### Azure Resource Manager

```bash
# List Fabric capacities
fab api -A azure "subscriptions/<subscription-id>/providers/Microsoft.Fabric/capacities?api-version=2023-11-01"

# Get available SKUs
fab api -A azure "subscriptions/<subscription-id>/providers/Microsoft.Fabric/skus?api-version=2023-11-01"
```

## Job Commands

### job run - Run Job Synchronously

#### Syntax

```bash
fab job run <item_path> [--timeout <seconds>] [--polling_interval <seconds>] [-P <params>] [-C <config>] [-i <input>]
```

#### Flags

- `--timeout` - Timeout in seconds
- `--polling_interval` - Custom job status polling interval in seconds
- `-P, --params` - Job parameters (typed: `name:type=value`)
- `-C, --config` - Configuration JSON (file or inline)
- `-i, --input` - Raw JSON input (file or inline)

#### Supported items

`.Notebook`, `.DataPipeline`, `.SparkJobDefinition`, `.Lakehouse` (maintenance)

#### Parameter types

- **Notebook**: `string`, `int`, `float`, `bool`
- **DataPipeline**: `string`, `int`, `float`, `bool`, `object`, `array`, `secureString`

#### Examples

```bash
# Run notebook
fab job run "Production.Workspace/ETL.Notebook"

# Run with timeout
fab job run "Production.Workspace/LongProcess.Notebook" --timeout 300

# Run with parameters
fab job run "Production.Workspace/ETL.Notebook" -P date:string=2024-01-01,batch_size:int=1000,debug:bool=false

# Run pipeline with complex parameters
fab job run "Production.Workspace/Pipeline.DataPipeline" -P 'config:object={"source":"s3","batch":100},ids:array=[1,2,3],secret:secureString=mysecret'

# Run with Spark configuration
fab job run "Production.Workspace/ETL.Notebook" -C '{"conf": {"spark.executor.memory": "8g"}, "environment": {"id": "<env-id>", "name": "ProdEnv"}}'

# Run with default lakehouse
fab job run "Production.Workspace/Process.Notebook" -C '{"defaultLakehouse": {"name": "MainLH", "id": "<lh-id>"}}'

# Run with workspace pool
fab job run "Production.Workspace/BigData.Notebook" -C '{"useStarterPool": false, "useWorkspacePool": "HighMemoryPool"}'

# Run with raw JSON
fab job run "Production.Workspace/ETL.Notebook" -i '{"parameters": {"date": {"type": "string", "value": "2024-01-01"}}, "configuration": {"conf": {"spark.conf1": "value"}}}'

# Run with custom polling interval
fab job run "ws.Workspace/Nb.Notebook" --polling_interval 30
```

### job start - Start Job Asynchronously

#### Syntax

```bash
fab job start <item_path> [-P <params>] [-C <config>] [-i <input>]
```

#### Examples

```bash
# Start and return immediately
fab job start "Production.Workspace/ETL.Notebook"

# Start with parameters
fab job start "Production.Workspace/Pipeline.DataPipeline" -P source:string=salesdb,batch:int=500
```

### job run-list - List Job History

#### Syntax

```bash
fab job run-list <item_path> [--schedule]
```

#### Flags

- `--schedule` - Show only scheduled job runs

#### Examples

```bash
# List all job runs
fab job run-list "Production.Workspace/ETL.Notebook"

# List scheduled runs only
fab job run-list "Production.Workspace/ETL.Notebook" --schedule
```

### job run-status - Get Job Status

#### Syntax

```bash
fab job run-status <item_path> --id <job_id> [--schedule]
```

#### Flags

- `--id` - Job or schedule ID
- `--schedule` - Check scheduled job status

#### Examples

```bash
# Check job instance status
fab job run-status "Production.Workspace/ETL.Notebook" --id <job-id>

# Check schedule status
fab job run-status "Production.Workspace/Pipeline.DataPipeline" --id <schedule-id> --schedule
```

### job run-cancel - Cancel Job

#### Syntax

```bash
fab job run-cancel <item_path> --id <job_id> [-w]
```

#### Flags

- `--id` - Job instance ID
- `-w, --wait` - Wait for the job to cancel

#### Examples

```bash
fab job run-cancel "Production.Workspace/ETL.Notebook" --id <job-id>

# Wait for cancellation to complete
fab job run-cancel "ws.Workspace/Nb.Notebook" --id <job-id> --wait
```

### job run-sch - Schedule Job

#### Syntax

```bash
fab job run-sch <item_path> --type <type> --interval <interval> [--days <days>] --start <datetime> [--end <datetime>] [--enable] [-i <json>]
```

#### Flags

- `--type` - Schedule type (cron, daily, weekly)
- `--interval` - Interval (minutes for cron, HH:MM for daily/weekly)
- `--days` - Days for weekly (Monday,Friday)
- `--start` - Start datetime (ISO 8601)
- `--end` - End datetime (ISO 8601)
- `--enable` - Enable schedule immediately
- `-i, --input` - Raw JSON schedule configuration

#### Examples

```bash
# Cron schedule (every 10 minutes)
fab job run-sch "Production.Workspace/Pipeline.DataPipeline" --type cron --interval 10 --start 2024-11-15T09:00:00 --end 2024-12-15T10:00:00 --enable

# Daily schedule
fab job run-sch "Production.Workspace/Pipeline.DataPipeline" --type daily --interval 10:00,16:00 --start 2024-11-15T09:00:00 --end 2024-12-16T10:00:00

# Weekly schedule
fab job run-sch "Production.Workspace/Pipeline.DataPipeline" --type weekly --interval 10:00,16:00 --days Monday,Friday --start 2024-11-15T09:00:00 --end 2024-12-16T10:00:00 --enable

# Custom JSON configuration
fab job run-sch "Production.Workspace/Pipeline.DataPipeline" -i '{"enabled": true, "configuration": {"startDateTime": "2024-04-28T00:00:00", "endDateTime": "2024-04-30T23:59:00", "localTimeZoneId": "Central Standard Time", "type": "Cron", "interval": 10}}'
```

### job run-update - Update Job Schedule

#### Syntax

```bash
fab job run-update <item_path> --id <schedule_id> [--type <type>] [--interval <interval>] [--days <days>] [--start <datetime>] [--end <datetime>] [--enable] [--disable] [-i <json>]
```

#### Flags

- `--id` - Schedule ID
- `--enable` - Enable the schedule
- `--disable` - Disable the schedule
- `--type` - Schedule type (cron, daily, weekly)
- `--interval` - Interval (minutes for cron, HH:MM for daily/weekly)
- `--start` - Start datetime (ISO 8601)
- `--end` - End datetime (ISO 8601)
- `--days` - Days for weekly (Monday,Friday)
- `-i, --input` - Raw JSON schedule configuration

#### Examples

```bash
# Disable schedule
fab job run-update "Production.Workspace/Pipeline.DataPipeline" --id <schedule-id> --disable

# Enable schedule
fab job run-update "Production.Workspace/Pipeline.DataPipeline" --id <schedule-id> --enable

# Update frequency with direct flags
fab job run-update "Production.Workspace/Pipeline.DataPipeline" --id <schedule-id> --type cron --interval 5 --enable

# Update weekly schedule
fab job run-update "Production.Workspace/Pipeline.DataPipeline" --id <schedule-id> --type weekly --interval 10:00,16:00 --days Monday,Wednesday,Friday --start 2024-12-01T00:00:00 --end 2025-03-01T00:00:00

# Update with JSON
fab job run-update "Production.Workspace/Pipeline.DataPipeline" --id <schedule-id> -i '{"enabled": false}'
```

### job run-rm - Delete Job Schedule

#### Syntax

```bash
fab job run-rm <item_path> --id <schedule_id> [-f]
```

#### Flags

- `--id` - Schedule ID
- `-f, --force` - Force delete without confirmation

#### Supported items

`.DataPipeline`, `.Notebook`, `.SparkJobDefinition`, `.Lakehouse`

#### Examples

```bash
# Delete schedule with confirmation
fab job run-rm "Production.Workspace/Pipeline.DataPipeline" --id <schedule-id>

# Force delete
fab job run-rm "Production.Workspace/ETL.Notebook" --id <schedule-id> -f
```

## Table Commands

### table schema - View Table Schema

#### Syntax

```bash
fab table schema <table_path>
```

#### Supported items

`.Lakehouse`, `.Warehouse`, `.MirroredDatabase`, `.SQLDatabase`, `.SemanticModel`, `.KQLDatabase`

#### Examples

```bash
fab table schema "Data.Workspace/LH.Lakehouse/Tables/dbo/customers"
fab table schema "Analytics.Workspace/DW.Warehouse/Tables/sales/orders"
```

### table load - Load Data

#### Syntax

```bash
fab table load <table_path> --file <file_path> [--mode <mode>] [--format <format>] [--extension <ext>]
```

#### Flags

- `--file` - Source file or folder path (lakehouse Files location)
- `--mode` - Load mode (append, overwrite) - default: append
- `--format` - Format options (e.g., `format=csv,header=true,delimiter=;`)
- `--extension` - File extension filter

#### Note

Not supported in schema-enabled lakehouses.

#### Examples

```bash
# Load CSV from folder
fab table load "Data.Workspace/LH.Lakehouse/Tables/customers" --file "Data.Workspace/LH.Lakehouse/Files/csv/customers"

# Load specific CSV with append mode
fab table load "Data.Workspace/LH.Lakehouse/Tables/sales" --file "Data.Workspace/LH.Lakehouse/Files/daily_sales.csv" --mode append

# Load with custom CSV format
fab table load "Data.Workspace/LH.Lakehouse/Tables/products" --file "Data.Workspace/LH.Lakehouse/Files/data" --format "format=csv,header=false,delimiter=;"

# Load Parquet files
fab table load "Data.Workspace/LH.Lakehouse/Tables/events" --file "Data.Workspace/LH.Lakehouse/Files/parquet/events" --format format=parquet --mode append
```

### table optimize - Optimize Table

#### Syntax

```bash
fab table optimize <table_path> [--vorder] [--zorder <columns>]
```

#### Flags

- `--vorder` - Enable V-Order optimization
- `--zorder` - Z-Order columns (comma-separated)

#### Note

Lakehouse only.

#### Examples

```bash
# Basic optimization
fab table optimize "Data.Workspace/LH.Lakehouse/Tables/transactions"

# V-Order optimization
fab table optimize "Data.Workspace/LH.Lakehouse/Tables/sales" --vorder

# V-Order + Z-Order
fab table optimize "Data.Workspace/LH.Lakehouse/Tables/customers" --vorder --zorder customer_id,region_id
```

### table vacuum - Vacuum Table

#### Syntax

```bash
fab table vacuum <table_path> [--retain_n_hours <hours>]
```

#### Flags

- `--retain_n_hours` - Retention period in hours (default: 168 = 7 days)

#### Note

Lakehouse only.

#### Examples

```bash
# Vacuum with default retention (7 days)
fab table vacuum "Data.Workspace/LH.Lakehouse/Tables/transactions"

# Vacuum with custom retention (48 hours)
fab table vacuum "Data.Workspace/LH.Lakehouse/Tables/temp_data" --retain_n_hours 48
```

## Util Commands

### desc - Describe Item Types and Commands

#### Syntax

```bash
fab desc <type_or_path>
```

#### Examples

```bash
# Check supported commands for an item type
fab desc .SemanticModel

# Check commands for an existing item
fab desc /ws1.Workspace/nb1.Notebook

# List all elements
fab desc all
```

### config - CLI Configuration

#### Syntax

```bash
fab config <subcommand> [key] [value]
```

#### Subcommands

- `clear-cache` - Clear CLI cache
- `get <key>` - Get config value
- `ls` - List all configuration
- `set <key> <value>` - Set config value

#### Config keys

- `mode` - CLI mode
- `default_capacity` - Default capacity
- `local_definition_labels` - Path to sensitivity labels JSON

#### Examples

```bash
# List all config
fab config ls

# Get a config value
fab config get mode
fab config get default_capacity

# Set config values
fab config set mode interactive
fab config set default_capacity "MyCapacity"
fab config set local_definition_labels /path/to/labels.json

# Clear cache
fab config clear-cache
```

## Advanced Patterns

### Batch Operations with Shell Scripts

```bash
#!/bin/bash

# Export all semantic models from workspace
WORKSPACE="Production.Workspace"
MODELS=$(fab api workspaces -q "value[?displayName=='Production'].id | [0]" | xargs -I {} fab api workspaces/{}/items -q "value[?type=='SemanticModel'].displayName")

for MODEL in $MODELS; do
  fab export "$WORKSPACE/$MODEL.SemanticModel" -o /tmp/exports
done
```

### DAX Query Workflow

```bash
# 1. Get model ID
MODEL_ID=$(fab get "Production.Workspace/Sales.SemanticModel" -q "id")

# 2. Execute DAX query
fab api -A powerbi "datasets/$MODEL_ID/executeQueries" -X post -i '{
  "queries": [{
    "query": "EVALUATE TOPN(10, Sales, Sales[Amount], DESC)"
  }],
  "serializerSettings": {
    "includeNulls": false
  }
}'

# 3. Execute multiple queries
fab api -A powerbi "datasets/$MODEL_ID/executeQueries" -X post -i '{
  "queries": [
    {"query": "EVALUATE VALUES(Date[Year])"},
    {"query": "EVALUATE SUMMARIZE(Sales, Date[Year], \"Total\", SUM(Sales[Amount]))"}
  ]
}'
```

### Semantic Model Update Workflow

```bash
# 1. Get current definition
fab get "Production.Workspace/Sales.SemanticModel" -q definition -o /tmp/current-def.json

# 2. Modify definition (edit JSON file)
# ... edit /tmp/current-def.json ...

# 3. Get workspace and model IDs
WS_ID=$(fab get "Production.Workspace" -q "id")
MODEL_ID=$(fab get "Production.Workspace/Sales.SemanticModel" -q "id")

# 4. Prepare update request (wrap definition)
cat > /tmp/update-request.json <<EOF
{
  "definition": $(cat /tmp/current-def.json)
}
EOF

# 5. Update definition
fab api -X post "workspaces/$WS_ID/semanticModels/$MODEL_ID/updateDefinition" -i /tmp/update-request.json --show_headers

# 6. Poll operation status (extract operation ID from Location header)
# Operation ID is in Location header: .../operations/{operation-id}
fab api "operations/<operation-id>"
```

### Environment Migration Script

```bash
#!/bin/bash

SOURCE_WS="Dev.Workspace"
TARGET_WS="Production.Workspace"

# Export all exportable items
fab export "$SOURCE_WS" -o /tmp/migration -a

# Import items to target workspace
for ITEM in /tmp/migration/*.Notebook; do
  ITEM_NAME=$(basename "$ITEM")
  fab import "$TARGET_WS/$ITEM_NAME" -i "$ITEM"
done

for ITEM in /tmp/migration/*.DataPipeline; do
  ITEM_NAME=$(basename "$ITEM")
  fab import "$TARGET_WS/$ITEM_NAME" -i "$ITEM"
done
```

### Job Monitoring Loop

```bash
#!/bin/bash

# Start job
JOB_ID=$(fab job start "Production.Workspace/ETL.Notebook" | grep -o '"id": "[^"]*"' | cut -d'"' -f4)

# Poll status every 10 seconds
while true; do
  STATUS=$(fab job run-status "Production.Workspace/ETL.Notebook" --id "$JOB_ID" -q "status")
  echo "Job status: $STATUS"

  if [[ "$STATUS" == "Completed" ]] || [[ "$STATUS" == "Failed" ]]; then
    break
  fi

  sleep 10
done

echo "Job finished with status: $STATUS"
```

### Workspace Inventory

```bash
#!/bin/bash

# Get all workspaces and their item counts
WORKSPACES=$(fab api workspaces -q "value[].{name: displayName, id: id}")

echo "$WORKSPACES" | jq -r '.[] | [.name, .id] | @tsv' | while IFS=$'\t' read -r NAME ID; do
  ITEM_COUNT=$(fab api "workspaces/$ID/items" -q "value | length")
  echo "$NAME: $ITEM_COUNT items"
done
```

## JMESPath Quick Reference

Common JMESPath patterns for `-q` flag:

```bash
# Get field
-q "id"
-q "displayName"

# Get nested field
-q "properties.sqlEndpointProperties"
-q "definition.parts[0]"

# Filter array
-q "value[?type=='Lakehouse']"
-q "value[?contains(name, 'prod')]"
-q "value[?starts_with(displayName, 'Test')]"

# Get first/last element
-q "value[0]"
-q "value[-1]"

# Pipe operations
-q "definition.parts[?path=='model.tmdl'] | [0]"
-q "definition.parts[?path=='definition/tables/Sales.tmdl'].payload | [0]"

# Projections (select specific fields)
-q "value[].{name: displayName, id: id, type: type}"

# Length/count
-q "value | length"

# Multi-select list
-q "value[].[displayName, id, type]"

# Flatten
-q "value[].items[]"

# Sort
-q "sort_by(value, &displayName)"

# Boolean logic
-q "value[?type=='Lakehouse' && contains(displayName, 'prod')]"
-q "value[?type=='Lakehouse' || type=='Warehouse']"

# Contains
-q "contains(value[].type, 'Lakehouse')"
```

## Common Error Scenarios

### Authentication Issues

```bash
# 403 Forbidden - Check authentication
fab auth login

# 401 Unauthorized - Token expired, re-authenticate
fab auth login

# Use service principal for automation
fab auth login -u <client-id> -p <client-secret> --tenant <tenant-id>

# Service principal with PEM certificate
fab auth login -u <client-id> --certificate /path/to/cert.pem --tenant <tenant-id>

# OIDC federated token exchange
fab auth login -u <client-id> --federated-token <token> --tenant <tenant-id>

# System-assigned managed identity
fab auth login -I
```

### Resource Not Found

```bash
# 404 Not Found - Check resource exists
fab exists "Production.Workspace/Sales.SemanticModel"

# List available resources
fab ls "Production.Workspace"

# Get resource ID for API calls
fab get "Production.Workspace/Sales.SemanticModel" -q "id"
```

### Job Failures

```bash
# Check job status
fab job run-status "Production.Workspace/ETL.Notebook" --id <job-id>

# View job history for patterns
fab job run-list "Production.Workspace/ETL.Notebook"

# Run with timeout to prevent hanging
fab job run "Production.Workspace/ETL.Notebook" --timeout 300
```

### API Errors

```bash
# 400 Bad Request - Check JSON payload
fab api -X post "workspaces/<ws-id>/items" -i /tmp/payload.json --show_headers

# Debug with headers
fab api workspaces --show_headers

# Save response to inspect
fab api workspaces -o /tmp/debug.json
```

## Performance Tips

1. **Use `ls` instead of `get` for checking existence** - 10-20x faster
2. **Use `exists` before `get` operations** - Avoids expensive failed gets
3. **Filter with JMESPath `-q`** - Reduce response size
4. **Use GUIDs in automation** - More stable than display names
5. **Batch exports** - Export workspace with `-a` instead of individual items
6. **Parallel job execution** - Use `job start` + polling for multiple jobs
7. **Cache workspace/item IDs** - Avoid repeated `get` calls for IDs
8. **Use appropriate API audience** - Power BI API is faster for dataset queries

## Security Best Practices

1. **Use service principals for automation** - Don't use interactive auth in scripts
2. **Store credentials securely** - Use environment variables or key vaults
3. **Use least-privilege access** - Grant minimal required permissions
4. **Audit API calls** - Log all API operations in production
5. **Validate inputs** - Sanitize user inputs before passing to API
6. **Use force flag carefully** - `-f` skips confirmations, easy to delete wrong resources
