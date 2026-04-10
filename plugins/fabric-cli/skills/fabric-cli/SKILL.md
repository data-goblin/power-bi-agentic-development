---
name: fabric-cli
version: 0.22.3
description: Expert guidance for the fab CLI, nb CLI, and DuckDB; covering workspace navigation, notebook management, data querying, deployment, jobs, APIs, and automation. Automatically invoke when the user mentions "fab", "nb", "Fabric CLI", "OneLake", "Livy", or asks to "deploy Fabric items", "manage Fabric workspaces", "run a Fabric notebook", "refresh a semantic model via CLI", "query a lakehouse", "automate Fabric operations", "use DuckDB with Fabric", "manage OneLake files".
---

# Microsoft Fabric CLI Operations

> **Note:** If you have access to a Bash tool (e.g., Claude Code), execute `fab` commands directly via Bash rather than using an MCP server.

Expert guidance for using the `fab` CLI to programmatically manage Fabric

## When to Use This Skill

Activate automatically when tasks involve:

- Mention of the Fabric CLI, Fabric items, Power BI, `fab`, or `fab` commands
- Managing workspaces, items, or resources
- Querying lakehouse/warehouse data, checking data freshness, or validating data quality
- Exploring lakehouse schemas and source data for semantic model design
- Deploying or migrating semantic models, reports, notebooks, pipelines
- Running or scheduling jobs (notebooks, pipelines, Spark)
- Working with lakehouse/warehouse tables and files
- Using the Fabric, Power BI, or OneLake APIs
- Automating Fabric operations in scripts

## Critical

- Before first use, ask the user if they have Fabric admin access, any API restrictions, or preferences for Fabric/Power BI API usage
- Remind the user to add their Fabric access level and preferences to their agent memory files (e.g., CLAUDE.md) for future sessions
- If workspace or item name is unclear, ask the user first, then verify with `fab ls` or `fab exists` before proceeding
- The first time you use `fab` run `fab auth status` to make sure the user is authenticated. If not, ask the user to run `fab auth login` to login
- Always use `fab --help` and `fab <command> --help` the first time you use a command to understand its syntax, first
- Always try the simple `fab` command alone, first before piping it
- Ensure that you avoid removing or moving items, workspaces, or definitions, or changing properties without explicit user direction
- If a command is blocked in your permissions and you try to use it, stop and ask the user for clarification; never try to circumvent it

### Always use `-f` (force) on every command that supports it

The `fab` CLI prompts for confirmation on many operations. When stdin is not a terminal (agents, scripts, piped commands), the prompt library crashes with `[UnexpectedError] 22` because it cannot read interactive input. **Always append `-f`** to prevent this. Commands that require it:

- `fab get -q "definition"` ; sensitivity label confirmation
- `fab export` ; sensitivity label confirmation
- `fab import` ; overwrite confirmation
- `fab cp` / `fab cp -r` ; overwrite and sensitivity label confirmation
- `fab rm` ; delete confirmation
- `fab assign` / `fab unassign` ; capacity/domain assignment confirmation
- `fab mv` ; rename/move confirmation

If you see `Warning: Input is not a terminal (fd=0)` or `[UnexpectedError] 22`, the missing `-f` flag is almost certainly the cause.

## First Run

```bash
fab auth login          # Authenticate (opens browser)
fab auth status         # Verify authentication
fab config set mode command_line  # Non-interactive mode (required for agents)
fab ls                  # List your workspaces
fab ls "Name.Workspace" # List items in a workspace
```

**Auth methods** (for automation):

```bash
fab auth login -u <client-id> -p <client-secret> --tenant <tenant-id>   # Service principal
fab auth login -u <client-id> --certificate /path/to/cert.pem --tenant <tenant-id>  # Certificate
fab auth login --federated-token <token> -u <client-id> --tenant <tenant-id>  # OIDC
fab auth login --identity                                                # System-assigned managed identity
fab auth login --identity -u <client-id>                                 # User-assigned managed identity
```

## Variable Extraction Pattern

Most workflows need IDs. Extract them like this:

```bash
WS_ID=$(fab get "ws.Workspace" -q "id" | tr -d '"')
MODEL_ID=$(fab get "ws.Workspace/Model.SemanticModel" -q "id" | tr -d '"')

# Then use in API calls
fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID/refreshes" -X post -i '{"type":"Full"}'
```

## Querying Lakehouse Data with DuckDB

DuckDB can query Delta Lake tables and raw files (CSV, JSON, Parquet) directly from OneLake. This is the primary approach for data exploration, freshness checks, quality validation, and schema discovery when planning semantic model design.

**Prerequisites**: DuckDB installed; Azure CLI authenticated (`az login`)

```bash
# Get IDs
WS_ID=$(fab get "ws.Workspace" -q "id" | tr -d '"')
LH_ID=$(fab get "ws.Workspace/LH.Lakehouse" -q "id" | tr -d '"')

# Query a Delta table
duckdb -c "
LOAD delta; LOAD azure;
CREATE SECRET (TYPE azure, PROVIDER credential_chain, CHAIN 'cli');
SELECT * FROM delta_scan('abfss://${WS_ID}@onelake.dfs.fabric.microsoft.com/${LH_ID}/Tables/schema/table') LIMIT 10;
"

# Query raw files (CSV, JSON, Parquet); supports glob patterns
duckdb -c "
LOAD azure;
CREATE SECRET (TYPE azure, PROVIDER credential_chain, CHAIN 'cli');
SELECT * FROM read_csv('abfss://${WS_ID}@onelake.dfs.fabric.microsoft.com/${LH_ID}/Files/data.csv') LIMIT 10;
"
```

Use this approach whenever investigating data issues (freshness, quality, missing records), exploring source data before building a semantic model, or validating lakehouse contents after ETL runs. The same path format works for warehouses.

**Do not assume anything about the data.** Before writing a final query, spot-check first: sample rows to understand units and granularity, check for fan-outs/duplicates, verify row counts match the expected grain, and use `AskUserQuestion` to clarify ambiguities with the user.

For full examples and common patterns, see **`references/querying-data.md`**.

## Command Reference

| Command | Purpose | Example |
|---------|---------|---------|
| **Finding Items** |||
| `fab ls` | List items | `fab ls "Sales.Workspace"` |
| `fab ls -l` | List with details | `fab ls "Sales.Workspace" -l` |
| `fab ls -q` | Filter with JMESPath | `fab ls "Sales.Workspace" -q "[?contains(name, 'Report')]"` |
| `fab exists` | Check if exists | `fab exists "Sales.Workspace/Model.SemanticModel"` |
| `fab get` | Get item details | `fab get "Sales.Workspace/Model.SemanticModel"` |
| `fab get -q` | Query specific field | `fab get "Sales.Workspace" -q "id"` |
| `fab desc` | Check supported commands | `fab desc .SemanticModel` |
| **Definitions** |||
| `fab get -q "definition"` | Get full definition | `fab get "ws.Workspace/Model.SemanticModel" -q "definition" -f` |
| `fab export` | Export to local | `fab export "ws.Workspace/Nb.Notebook" -o ./backup -f` |
| `fab import` | Import from local | `fab import "ws.Workspace/Nb.Notebook" -i ./backup/Nb.Notebook -f` |
| **Running Jobs** |||
| `fab job run` | Run synchronously | `fab job run "ws.Workspace/ETL.Notebook"` |
| `fab job start` | Run asynchronously | `fab job start "ws.Workspace/ETL.Notebook"` |
| `fab job run -P` | Run with params | `fab job run "ws.Workspace/Nb.Notebook" -P date:string=2025-01-01` |
| `fab job run-list` | List executions | `fab job run-list "ws.Workspace/Nb.Notebook"` |
| `fab job run-status` | Check status | `fab job run-status "ws.Workspace/Nb.Notebook" --id <job-id>` |
| **Refreshing Models** |||
| `fab api -A powerbi` | Trigger refresh | `fab api -A powerbi "groups/<ws-id>/datasets/<model-id>/refreshes" -X post -i '{"type":"Full"}'` |
| `fab api -A powerbi` | Check refresh status | `fab api -A powerbi "groups/<ws-id>/datasets/<model-id>/refreshes?\$top=1"` |
| **DAX Queries** |||
| `fab get -q "definition"` | Get model schema first | `fab get "ws.Workspace/Model.SemanticModel" -q "definition" -f` |
| `fab api -A powerbi` | Execute DAX | `fab api -A powerbi "groups/<ws-id>/datasets/<model-id>/executeQueries" -X post -i '{"queries":[{"query":"EVALUATE..."}]}'` |
| **Lakehouse / DuckDB** |||
| `fab ls` | Browse files/tables | `fab ls "ws.Workspace/LH.Lakehouse/Files"` |
| `fab table schema` | Get table schema | `fab table schema "ws.Workspace/LH.Lakehouse/Tables/sales"` |
| `fab cp` | Upload/download | `fab cp ./local.csv "ws.Workspace/LH.Lakehouse/Files/"` |
| `duckdb` + `delta_scan` | Query Delta tables | `duckdb -c "... delta_scan('abfss://<ws-id>@onelake.../<lh-id>/Tables/schema/table')"` |
| `duckdb` + `read_csv/json` | Query raw files | `duckdb -c "... read_csv('abfss://<ws-id>@onelake.../<lh-id>/Files/data.csv')"` |
| **Access Control** |||
| `fab acl ls` | List permissions | `fab acl ls "ws.Workspace"` |
| `fab acl set` | Set permissions | `fab acl set "ws.Workspace" -I <objectId> -R Member` |
| `fab acl rm` | Remove permissions | `fab acl rm "ws.Workspace" -I <upn>` |
| `fab label set` | Set sensitivity label | `fab label set "ws.Workspace/Nb.Notebook" --name Confidential` |
| **Management** |||
| `fab cp` | Copy items | `fab cp "dev.Workspace/Item.Type" "prod.Workspace" -f` |
| `fab cp -r` | Copy recursively | `fab cp "dev.Workspace" "prod.Workspace" -r -f` |
| `fab mv` | Move/rename items | `fab mv "ws.Workspace/Old.Notebook" "ws.Workspace/New.Notebook" -f` |
| `fab set` | Update properties | `fab set "ws.Workspace/Item.Type" -q displayName -i "New Name"` |
| `fab rm` | Delete item | `fab rm "ws.Workspace/Item.Type" -f` |
| `fab assign` | Assign capacity/domain | `fab assign .capacities/cap.Capacity -W ws.Workspace -f` |
| `fab start/stop` | Start/stop resource | `fab start .capacities/cap.Capacity` |

## Core Concepts

### Path Format

Fabric uses filesystem-like paths with type extensions:

`/WorkspaceName.Workspace/ItemName.ItemType`

For lakehouses this is extended into files and tables:

`/WorkspaceName.Workspace/LakehouseName.Lakehouse/Files/FileName.extension` or `/WorkspaceName.Workspace/LakehouseName.Lakehouse/Tables/TableName`

For Fabric capacities you have to use `fab ls .capacities`

Examples:

- `"/Production.Workspace/Sales Model.SemanticModel"`
- `/Data.Workspace/MainLH.Lakehouse/Files/data.csv`
- `/Data.Workspace/MainLH.Lakehouse/Tables/dbo/customers`

### Common Item Types

- `.Workspace` - Workspaces
- `.SemanticModel` - Power BI datasets
- `.Report` - Power BI reports
- `.Notebook` - Fabric notebooks
- `.DataPipeline` - Data pipelines
- `.Lakehouse` / `.Warehouse` - Data stores
- `.SparkJobDefinition` - Spark jobs
- `.AISkill` - AI skills
- `.Eventhouse` / `.Eventstream` - Real-time analytics
- `.MirroredDatabase` / `.MirroredWarehouse` - Mirrored databases
- `.Environment` - Spark environments
- `.SQLDatabase` - SQL databases
- `.UserDataFunction` - User data functions

Full list: 49+ types. Use `fab desc .<ItemType>` to check supported commands for a specific type, or `fab desc` (no argument) to see all available element types.

## Essential Commands

For detailed command examples (navigation, resource management, access control, copy/move/export/import, API operations, jobs, tables), see **`references/essential-commands.md`**.

For item-type-specific workflows, see the topic references listed under [References](#references).

## Cross-Workspace Search

### DataHub V2 API (Recommended)

Use `scripts/search_across_workspaces.py` for cross-workspace search with rich metadata not available elsewhere:

```bash
# Find all semantic models (use "Model" not "SemanticModel")
python3 scripts/search_across_workspaces.py --type Model

# Find models by name
python3 scripts/search_across_workspaces.py --type Model --filter "Sales"

# Find stale items (not visited in 6+ months)
python3 scripts/search_across_workspaces.py --type Model --not-visited-since 2024-06-01

# Find items by owner
python3 scripts/search_across_workspaces.py --type PowerBIReport --owner "kurt"

# Find Direct Lake models only
python3 scripts/search_across_workspaces.py --type Model --storage-mode directlake

# Find items in workspace
python3 scripts/search_across_workspaces.py --type Lakehouse --workspace "fit-data"

# Get JSON output
python3 scripts/search_across_workspaces.py --type Model --output json

# Sort by last visited (oldest first)
python3 scripts/search_across_workspaces.py --type Model --sort last-visited --sort-order asc

# List all available types
python3 scripts/search_across_workspaces.py --list-types
```

**Unique DataHub fields** (not available via fab api or admin APIs):

- `lastVisitedTimeUTC` - When item was last opened/used
- `storageMode` - Import, DirectQuery, or DirectLake
- `ownerUser` - Full owner details (name, email)
- `capacitySku` - F2, F64, PP, etc.
- `isDiscoverable` - Whether item appears in search

**Important type mappings:**

- Semantic models: use `--type Model` (not SemanticModel)
- Dataflows: use `--type DataFlow` (capital F)
- Notebooks: use `--type SynapseNotebook`

### Admin APIs (Requires Admin Role)

If you have Fabric/Power BI admin access:

```bash
# Find semantic models by name (cross-workspace)
fab api "admin/items" -P "type=SemanticModel" -q "itemEntities[?contains(name, 'Sales')]"

# Find all notebooks
fab api "admin/items" -P "type=Notebook" -q "itemEntities[].{name:name,workspace:workspaceId}"

# Find all lakehouses
fab api "admin/items" -P "type=Lakehouse"

# Common types: SemanticModel, Report, Notebook, Lakehouse, Warehouse, DataPipeline, Ontology
```

For full admin API reference: [admin.md](./references/admin.md)

## Key Patterns

### JMESPath Queries

Filter and transform JSON responses with `-q`:

```bash
# Get single field
-q "id"
-q "displayName"

# Get nested field
-q "properties.sqlEndpointProperties"
-q "definition.parts[0]"

# Filter arrays
-q "value[?type=='Lakehouse']"
-q "value[?contains(name, 'prod')]"

# Get first element
-q "value[0]"
-q "definition.parts[?path=='model.tmdl'] | [0]"
```

### Error Handling & Debugging

```bash
# Show response headers
fab api workspaces --show_headers

# Verbose output
fab get "Production.Workspace/Item" -v

# Save responses for debugging
fab api workspaces -o /tmp/workspaces.json
```

### Performance Optimization

1. **Use `ls` for fast listing** - Much faster than `get`
2. **Use `exists` before operations** - Check before get/modify
3. **Filter with `-q`** - Get only what you need
4. **Use GUIDs in automation** - More stable than names

## Common Flags

- `-f, --force` - Skip confirmation prompts (also skips sensitivity label on export/get/cp)
- `-v, --verbose` - Verbose output
- `-l` - Long format listing
- `-a` - Show hidden items
- `-r, --recursive` - Recursive copy/move (workspaces and folders)
- `-o, --output` - Output file path
- `-i, --input` - Input file or JSON string
- `-q, --query` - JMESPath query (works on `ls`, `get`, `api`, `acl ls`, `acl get`)
- `-P, --params` - Parameters (key=value)
- `-W, --workspace` - Target workspace (for assign/unassign)
- `-I, --identity` - Entra identity (for acl set/rm)
- `-R, --role` - Role to assign (for acl set)
- `-X, --method` - HTTP method (get/post/put/delete/patch)
- `-A, --audience` - API audience (fabric/powerbi/storage/azure)
- `-bpc` - Block on path collision (cp only)
- `--format` - Definition format (export/import)
- `--show_headers` - Show response headers
- `--timeout` - Timeout in seconds
- `--polling_interval` - Job polling interval in seconds
- `-w, --wait` - Wait for completion (job run-cancel)

## Important Notes

- **All examples assume `fab` is installed and authenticated**
- **Paths require proper extensions** (`.Workspace`, `.SemanticModel`, etc.)
- **Quote paths with spaces**: `"My Workspace.Workspace"`
- **Create output directories before export**: `fab export` does not create intermediate directories; `mkdir -p` the output path first or the command fails with `[InvalidPath]`
- **Always use `-f`** on commands that support it; see the [Critical](#always-use--f-force-on-every-command-that-supports-it) section for the full list and why
- **Semantic model updates**: Use Power BI API (`-A powerbi`) for DAX queries and dataset operations

## Need More Details?

For specific item type help:

```bash
fab desc .<ItemType>
```

For command help:

```bash
fab --help
fab <command> --help
```

## References

**Skill references:**

- [Quick Start Guide](./references/quickstart.md) - Copy-paste examples for getting started
- [Essential Commands](./references/essential-commands.md) - Detailed command examples and common workflows
- [Querying Data](./references/querying-data.md) - Query semantic models in DAX and lakehouses or warehouses in SQL with DuckDB
- [Lakehouses](./references/lakehouses.md) - Endpoints, file/table operations, OneLake paths
- [Warehouses](./references/warehouses.md) - Create, browse, query via DuckDB, load data
- [SQL Databases](./references/sql-databases.md) - Create, browse, query via DuckDB, auto-mirroring
- [Semantic Models](./references/semantic-models.md) - TMDL, DAX, refresh, storage mode
- [Reports](./references/reports.md) - Export, import, visuals, fields
- [Paginated Reports](./references/paginated-reports.md) - RDL upload, export-to-file, datasources, parameters
- [Notebooks](./references/notebooks.md) - Python/PySpark kernels, metadata, cell CRUD, Livy execution, scheduling
- [Workspaces](./references/workspaces.md) - Create, manage, permissions
- [Deployment Pipelines](./references/deployment-pipelines.md) - CI/CD, deploy stages, selective deploy, LRO polling
- [Dataflows](./references/dataflows.md) - Gen1 and Gen2, refresh, publish, admin
- [Dashboards](./references/dashboards.md) - Tiles, clone (dashboards are not reports)
- [Org Apps](./references/org-apps.md) - Read-only API for distributed content packages
- [Scorecards](./references/scorecards.md) - Goals, check-ins, status rules (Preview API)
- [Gateways](./references/gateways.md) - Datasources, credentials, dataset binding
- [Folders](./references/folders.md) - Organize items into folders via API; includes best practices for structuring workspaces
- [fab vs az CLI](./references/fab-vs-az-cli.md) - When to use which; capacity, networking, Key Vault, monitoring, CMK, CI/CD
- [Admin APIs](./references/admin.md) - Cross-workspace search, tenant operations, governance
- [API Reference](./references/fab-api.md) - Capacities, domains, misc API patterns
- [Connections](./references/connections.md) - Create, update, list connections programmatically; credential types (WorkspaceIdentity, SPN, Basic); OAuth2 limitations
- [Full Command Reference](./references/reference.md) - All commands detailed

**External references** (request markdown when possible):

- fab CLI: [GitHub Source](https://github.com/microsoft/fabric-cli) | [Docs](https://microsoft.github.io/fabric-cli/)
- Microsoft: [Fabric CLI Learn](https://learn.microsoft.com/en-us/rest/api/fabric/articles/fabric-command-line-interface)
- APIs: [Fabric API](https://learn.microsoft.com/en-us/rest/api/fabric/articles/) | [Power BI API](https://learn.microsoft.com/en-us/rest/api/power-bi/)
- DAX: [dax.guide](https://dax.guide/) - use `dax.guide/<function>/` e.g. `dax.guide/addcolumns/`
- Power Query: [powerquery.guide](https://powerquery.guide/) - use `powerquery.guide/function/<function>`
- [Power Query Best Practices](https://learn.microsoft.com/en-us/power-query/best-practices)
