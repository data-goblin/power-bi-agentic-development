# Workspace Operations

Comprehensive guide for managing Fabric workspaces using the Fabric CLI.

## Overview

Workspaces are containers for Fabric items and provide collaboration and security boundaries. This guide covers workspace management, configuration, and operations.

## Planning decisions

Before you create or restructure a workspace, decide at which tier you're working. Microsoft's implementation planning guidance splits workspace decisions into three articles; treat them as the source of truth for strategy and scope, and use this reference for the `fab` commands that act on those decisions.

- [Workspaces overview](https://learn.microsoft.com/en-us/power-bi/guidance/powerbi-implementation-planning-workspaces-overview); three-tier structure (tenant, workspace, item) and article map.
- [Tenant-level planning](https://learn.microsoft.com/en-us/power-bi/guidance/powerbi-implementation-planning-workspaces-tenant-level-planning); strategic decisions that affect every workspace.
- [Workspace-level planning](https://learn.microsoft.com/en-us/power-bi/guidance/powerbi-implementation-planning-workspaces-workspace-level-planning); tactical decisions per workspace.

### Tenant tier (strategic)

Decisions to settle once, then audit periodically:

| Decision | Settled via | Fabric CLI touchpoint |
|---|---|---|
| Who can create workspaces | `Create workspaces` tenant setting + security group | Use the `audit-tenant-settings` skill (in the `fabric-admin` plugin); see [admin.md](./admin.md) |
| Workspace naming conventions | Documented standard (prefix, stage suffix, short form) | `fab mkdir`, `fab set -q displayName` |
| Domains for logical grouping | Domain admins + domain assignment | `fab assign .domains/<d>.Domain -W <ws>.Workspace` |
| Workspace request process | Intake form, SLA, validation rules | Script creation via `fab mkdir` + `fab acl set` |
| Governance level per workspace | Classification (governed vs ungoverned) stored on the workspace | `fab set <ws>.Workspace -q description -i ...` |

### Workspace tier (tactical)

Decisions made per workspace, usually at creation:

| Decision | Why | Fabric CLI touchpoint |
|---|---|---|
| Purpose (collaboration vs viewing) | Drives roles and app use | `fab acl set`, Power BI app APIs |
| Subject and scope | Subject area vs department vs single report | Workspace creation + naming |
| Item types | Data workspace vs reporting workspace (or mixed) | [folders.md](./folders.md), [semantic-models.md](./semantic-models.md) |
| Development stage | Dev/test/prod (and sandbox/private/preprod) | [deployment-pipelines.md](./deployment-pipelines.md), Git integration |
| Workspace type / license | Pro, PPU, Fabric capacity, Trial | `fab mkdir -P capacityname=...`, `fab assign .capacities/...` |
| Access roles | Admin, Member, Contributor, Viewer; prefer groups | `fab acl set/ls/rm` |
| Settings (description, image, contacts, Spark, OneLake defaults, Log Analytics, Git) | Governance, onboarding, usability | `fab set <ws>.Workspace -q <path> -i <value>` |

Common patterns for assigning governance requirements show up repeatedly in the MS Learn articles: use security groups (not individuals) for roles, separate data workspaces from reporting workspaces when ownership differs, use at least two development stages, and record contact/description metadata on every governed workspace.

## Listing Workspaces

### List All Workspaces

```bash
# Simple list
fab ls

# Detailed list with metadata
fab ls -l

# List with hidden tenant-level items
fab ls -la

# Hidden items include: capacities, connections, domains, gateways
```

### Filter Workspaces

```bash
# Native alternative (preferred):
fab ls -q "[].{name: displayName, id: id, type: type}"

# Using API with JMESPath query
fab api workspaces -q "value[].{name: displayName, id: id, type: type}"

# Native alternative (preferred):
fab ls -q "[?contains(displayName, 'Production')]"

# Filter by name pattern
fab api workspaces -q "value[?contains(displayName, 'Production')]"

# Native alternative (preferred):
fab ls -q "[?capacityId=='<capacity-id>']"

# Filter by capacity
fab api workspaces -q "value[?capacityId=='<capacity-id>']"

# Native alternative (preferred):
fab ls -q "length(@)"

# Get workspace count
fab api workspaces -q "value | length"
```

## Cross-Workspace Search (DataHub V2)

`scripts/search_across_workspaces.py` wraps the undocumented DataHub V2 API and exposes metadata that neither `fab api` nor the admin APIs return. Use it for any cross-workspace discovery that needs ownership, storage mode, last-visited timestamps, or capacity SKU; no admin role required.

### Usage

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

### Unique DataHub fields

Not available via `fab api` or admin APIs:

- `lastVisitedTimeUTC` ; when an item was last opened/used
- `storageMode` ; Import, DirectQuery, or DirectLake
- `ownerUser` ; full owner details (name, email)
- `capacitySku` ; F2, F64, PP, etc.
- `isDiscoverable` ; whether the item appears in service search

### Type mappings

The DataHub type names don't match the `fab` item type extensions; memorize these:

- Semantic models ; `--type Model` (not `SemanticModel`)
- Dataflows ; `--type DataFlow` (capital F)
- Notebooks ; `--type SynapseNotebook`

Run `--list-types` to see the full set of supported item types.

## Getting Workspace Information

### Basic Workspace Info

```bash
# Check if workspace exists
fab exists "Production.Workspace"

# Get workspace details
fab get "Production.Workspace"

# Get specific property
fab get "Production.Workspace" -q "id"
fab get "Production.Workspace" -q "capacityId"
fab get "Production.Workspace" -q "description"

# Get all properties (verbose)
fab get "Production.Workspace" -v

# Save to file
fab get "Production.Workspace" -o /tmp/workspace-info.json
```

### Get Workspace Configuration

```bash
# Get Spark settings
fab get "Production.Workspace" -q "sparkSettings"

# Get Spark runtime version
fab get "Production.Workspace" -q "sparkSettings.environment.runtimeVersion"

# Get default Spark pool
fab get "Production.Workspace" -q "sparkSettings.pool.defaultPool"
```

### Workspace Property Surface

`fab get <ws>.Workspace` returns a flat list of queryable paths; `fab get <ws>.Workspace -q "."` dumps the full JSON. The table below summarises the paths exposed by the Fabric API; only a subset is writable via `fab set -q <path> -i <value>`.

| Path | Read | Write | Notes |
|---|---|---|---|
| `id` | yes | no | GUID, stable across renames |
| `displayName` | yes | yes | `fab set ws.Workspace -q displayName -i <new>` renames in place |
| `description` | yes | yes | Up to 4,000 characters; use for governance metadata |
| `type` | yes | no | Always `Workspace` for a workspace |
| `capacityId` | yes | indirect | Set via `fab assign` (F SKU) or Power BI API (Trial/PPU); see Capacity Management |
| `capacityRegion` | yes | no | Derived from the assigned capacity |
| `capacityAssignmentProgress` | yes | no | `Completed`, `InProgress`, or `Failed` |
| `oneLakeEndpoints.blobEndpoint` | yes | no | Regional blob endpoint |
| `oneLakeEndpoints.dfsEndpoint` | yes | no | Regional dfs endpoint |
| `roleAssignments[]` | yes | indirect | Manage through `fab acl set/ls/rm` rather than `fab set` |
| `sparkSettings.environment.runtimeVersion` | yes | yes | Example: `1.2` |
| `sparkSettings.pool.defaultPool` | yes | yes | Inline JSON with `name`, `type`, optional `id` |

For fields outside the Fabric API surface (for example, default semantic model storage format, Azure Data Lake Storage Gen2 connections, Log Analytics workspace binding, Git integration), fall back to the Power BI REST API via `fab api -A powerbi` or the Fabric REST API via `fab api`. Examples appear throughout this document.

```bash
# Discover the full property list for a workspace
fab get "Production.Workspace"

# Dump everything as JSON
fab get "Production.Workspace" -q "."

# Show only the writable Spark surface
fab get "Production.Workspace" -q "sparkSettings"
```

## Creating Workspaces

### Create with Default Capacity

```bash
# Use CLI-configured default capacity
fab mkdir "NewWorkspace.Workspace"

# Verify capacity configuration first
fab api workspaces -q "value[0].capacityId"
```

### Create with Specific Capacity

```bash
# Assign to specific capacity
fab mkdir "Production Workspace.Workspace" -P capacityname=ProductionCapacity

# Get capacity name from capacity list
fab ls -la | grep Capacity
```

### Create without Capacity

```bash
# Create in shared capacity (not recommended for production)
fab mkdir "Dev Workspace.Workspace" -P capacityname=none
```

### Create with Large Semantic Model Storage Format

Large storage format is a workspace-level default that removes the per-model 10 GB cap for import models (PPU or Fabric capacity only). It's not exposed as a `fab mkdir` parameter; set it immediately after creation via the Power BI REST API so every model published afterwards inherits the setting.

```bash
# 1. Create the workspace on a capacity that supports Large (PPU or Fabric)
fab mkdir "Quarterly Financials.Workspace" -P capacityname=ProductionCapacity

# 2. Resolve the workspace ID
WS_ID=$(fab get "Quarterly Financials.Workspace" -q "id" | tr -d '"')

# 3. Set the default storage format to Large
fab api -A powerbi -X patch "groups/$WS_ID" -i '{"defaultDatasetStorageFormat":"Large"}'
```

Existing semantic models already in the workspace are not converted retroactively; republish or run a Large-format update per model to upgrade them. Switching back to `Small` is possible but only affects models published afterwards.

### Optional Parameters for `fab mkdir .Workspace`

`fab mkdir <name>.Workspace -P` lists the supported creation parameters. At time of writing, the Fabric CLI exposes only:

- `capacityName`; optional, assigns the workspace to a named Fabric capacity at creation. Omit or set to `none` for shared capacity.

All other tactical settings (description, domain, Spark, OneLake, Git, Log Analytics, image, contacts, default storage format) are configured after creation via `fab set`, `fab assign`, or the underlying REST APIs shown later in this document.

## Listing Workspace Contents

### List Items in Workspace

```bash
# Simple list
fab ls "Production.Workspace"

# Detailed list with metadata
fab ls "Production.Workspace" -l

# Include hidden items (Spark pools, managed identities, etc.)
fab ls "Production.Workspace" -la

# Hidden workspace items include:
# - External Data Shares
# - Managed Identities
# - Managed Private Endpoints
# - Spark Pools
```

### Filter Items by Type

```bash
WS_ID=$(fab get "Production.Workspace" -q "id")

# Native alternative (preferred):
fab ls "Production.Workspace" -q "[?contains(name, '.SemanticModel')]"

# List semantic models only
fab api "workspaces/$WS_ID/items" -q "value[?type=='SemanticModel']"

# Native alternative (preferred):
fab ls "Production.Workspace" -q "[?contains(name, '.Report')]"

# List reports only
fab api "workspaces/$WS_ID/items" -q "value[?type=='Report']"

# Native alternative (preferred):
fab ls "Production.Workspace" -q "[?contains(name, '.Notebook')]"

# List notebooks
fab api "workspaces/$WS_ID/items" -q "value[?type=='Notebook']"

# Native alternative (preferred):
fab ls "Production.Workspace" -q "[?contains(name, '.Lakehouse')]"

# List lakehouses
fab api "workspaces/$WS_ID/items" -q "value[?type=='Lakehouse']"

# Count items by type
fab api "workspaces/$WS_ID/items" -q "value | group_by(@, &type)"
```

## Updating Workspaces

### Update Display Name

```bash
fab set "OldName.Workspace" -q displayName -i "NewName"

# Note: This changes the display name, not the workspace ID
```

### Update Description

```bash
fab set "Production.Workspace" -q description -i "Production environment for enterprise analytics"
```

### Configure Spark Settings

```bash
# Set Spark runtime version
fab set "Production.Workspace" -q sparkSettings.environment.runtimeVersion -i 1.2

# Set starter pool as default
fab set "Production.Workspace" -q sparkSettings.pool.defaultPool -i '{
  "name": "Starter Pool",
  "type": "Workspace"
}'

# Set custom workspace pool
fab set "Production.Workspace" -q sparkSettings.pool.defaultPool -i '{
  "name": "HighMemoryPool",
  "type": "Workspace",
  "id": "<pool-id>"
}'
```

## Capacity Management

A workspace must be assigned to a capacity for features like XMLA endpoints, semantic model refresh, and Fabric workloads. Without a capacity, these operations fail with permission errors.

### Check Current Capacity

```bash
# Returns the capacity ID, or None if no capacity assigned
fab get "Production.Workspace" -q "capacityId"
```

### List Available Capacities

```bash
# List Fabric capacities (F SKUs only)
fab ls .capacities

# List ALL capacities including Trial and PPU (via Power BI API)
fab api -A powerbi "capacities" -q "value[].{name:displayName, sku:sku, state:state, id:id}"
```

`fab ls .capacities` only shows Fabric (F SKU) capacities. Trial (FT1), PPU (P1), and other non-Fabric SKUs are invisible to it. Use the Power BI API to see everything.

### Assign Workspace to Capacity

There are two methods depending on the capacity SKU:

#### Fabric Capacities (F SKUs)

For F2, F4, F8, F16, F32, F64, F128, F256, F512, F1024, F2048 capacities:

```bash
fab assign .capacities/MyCapacity.Capacity -W "Production.Workspace" -f
```

#### Trial, PPU, and Non-Fabric Capacities

`fab assign` only works with Fabric (F SKU) capacities. For Trial (FT1), Premium Per User (PPU/P1), or other non-Fabric SKUs, use the Power BI API directly:

```bash
# 1. Get the workspace ID
WS_ID=$(fab get "MyWorkspace.Workspace" -q "id" | tr -d '"')

# 2. Get the capacity ID from the Power BI API
fab api -A powerbi "capacities" -q "value[].{name:displayName, sku:sku, id:id}"

# 3. Assign using the Power BI API
CAP_ID="<capacity-id-from-step-2>"
fab api -A powerbi "groups/$WS_ID" -X patch -i "{\"capacityId\":\"$CAP_ID\"}"
```

If `fab assign` fails with `[Not a Fabric capacity]`, the capacity is not an F SKU; fall back to the Power BI API method above.

### Assign Domain to Workspace

```bash
fab assign .domains/Analytics.Domain -W "Production.Workspace" -f
```

### Unassign from Capacity

```bash
# Fabric capacities
fab unassign .capacities/MyCapacity.Capacity -W "Dev.Workspace" -f

# Trial/PPU capacities (move to shared capacity via API)
WS_ID=$(fab get "Dev.Workspace" -q "id" | tr -d '"')
fab api -A powerbi "groups/$WS_ID" -X patch -i '{"capacityId":"00000000-0000-0000-0000-000000000000"}'

# Unassign domain
fab unassign .domains/Analytics.Domain -W "Dev.Workspace" -f
```

### List Workspaces by Capacity

```bash
# Native alternative (preferred):
fab ls -q "group_by(@, &capacityId)"

# Get all workspaces
fab api workspaces -q "value[] | group_by(@, &capacityId)"

# Native alternative (preferred):
fab ls -q "[?capacityId=='<capacity-id>'].displayName"

# List workspaces on specific capacity
fab api workspaces -q "value[?capacityId=='<capacity-id>'].displayName"
```

## Workspace Migration

### Export Entire Workspace

```bash
# Export all items
fab export "Production.Workspace" -o /tmp/workspace-backup -a

# This exports all supported item types:
# - Notebooks
# - Data Pipelines
# - Reports
# - Semantic Models
# - etc.
```

### Selective Export

```bash
#!/bin/bash

WORKSPACE="Production.Workspace"
OUTPUT_DIR="/tmp/migration"

# Export only semantic models
WS_ID=$(fab get "$WORKSPACE" -q "id")
MODELS=$(fab api "workspaces/$WS_ID/items" -q "value[?type=='SemanticModel'].displayName")

for MODEL in $MODELS; do
  fab export "$WORKSPACE/$MODEL.SemanticModel" -o "$OUTPUT_DIR/models"
done

# Export only reports
REPORTS=$(fab api "workspaces/$WS_ID/items" -q "value[?type=='Report'].displayName")

for REPORT in $REPORTS; do
  fab export "$WORKSPACE/$REPORT.Report" -o "$OUTPUT_DIR/reports"
done
```

### Copy Workspace Contents

```bash
# Copy all items to another workspace (interactive selection)
fab cp "Source.Workspace" "Target.Workspace"

# Copy specific items
fab cp "Source.Workspace/Model.SemanticModel" "Target.Workspace"
fab cp "Source.Workspace/Report.Report" "Target.Workspace"
fab cp "Source.Workspace/Notebook.Notebook" "Target.Workspace"
```

#### After copying a semantic model

- The copy includes the model definition (schema, DAX, partition expressions) but not the data. Trigger a full refresh after copying.
- **Credentials**: Only shared cloud connections carry over. Personal credentials or gateway-bound credentials do not; re-authenticate via the dataset settings in the Power BI service.
- **Capacity**: The target workspace must be on a capacity (Fabric, PPU, or Trial) for XMLA endpoints and refresh to work. Assign a capacity before attempting refresh.
- **Reports**: Copied reports retain their original model binding (pointing to the source workspace). Update the `definition.pbir` connection string to point to the copied model in the target workspace, then re-import.

#### Rebinding a copied report

```bash
# 1. Export the report
fab export "Target.Workspace/Report.Report" -o /tmp/report -f

# 2. Edit definition.pbir to update the workspace name and model ID
# Change: myorg/SourceWorkspace -> myorg/TargetWorkspace
# Change: semanticmodelid=<old-id> -> semanticmodelid=<new-id>

# 3. Re-import
fab import "Target.Workspace/Report.Report" -i /tmp/report/Report.Report -f
```

## Deleting Workspaces

### Delete with Confirmation

```bash
# Interactive confirmation (lists items first)
fab rm "OldWorkspace.Workspace"
```

### Force Delete

```bash
# Delete workspace and all contents without confirmation
# Cannot be undone
fab rm "TestWorkspace.Workspace" -f
```

Workspace deletion is not governed by the tenant Item Recovery setting; treat as permanent. For item-level recovery inside a workspace, see [reference.md > Recovering deleted items](reference.md#recovering-deleted-items).

## Navigation

### Change to Workspace

```bash
# Navigate to workspace
fab cd "Production.Workspace"

# Verify current location
fab pwd

# Navigate to personal workspace
fab cd ~
```

### Relative Navigation

```bash
# From workspace to another
fab cd "../Dev.Workspace"

# To parent (tenant level)
fab cd ..
```

## Workspace Inventory

### Get Complete Inventory

```bash
#!/bin/bash

WORKSPACE="Production.Workspace"
WS_ID=$(fab get "$WORKSPACE" -q "id")

echo "=== Workspace: $WORKSPACE ==="
echo

# Get all items
ITEMS=$(fab api "workspaces/$WS_ID/items")

# Count by type
echo "Item Counts:"
echo "$ITEMS" | jq -r '.value | group_by(.type) | map({type: .[0].type, count: length}) | .[] | "\(.type): \(.count)"'

echo
echo "Total Items: $(echo "$ITEMS" | jq '.value | length')"

# List items
echo
echo "=== Items ==="
echo "$ITEMS" | jq -r '.value[] | "\(.type): \(.displayName)"' | sort
```

### Generate Inventory Report

```bash
#!/bin/bash

OUTPUT_FILE="/tmp/workspace-inventory.csv"

echo "Workspace,Item Type,Item Name,Created Date,Modified Date" > "$OUTPUT_FILE"

# Native alternative (preferred):
# WORKSPACES=$(fab ls -q "[].{name: displayName, id: id}")

# Get all workspaces
WORKSPACES=$(fab api workspaces -q "value[].{name: displayName, id: id}")

echo "$WORKSPACES" | jq -r '.[] | [.name, .id] | @tsv' | while IFS=$'\t' read -r WS_NAME WS_ID; do
  # Get items in workspace
  ITEMS=$(fab api "workspaces/$WS_ID/items")

  echo "$ITEMS" | jq -r --arg ws "$WS_NAME" '.value[] | [$ws, .type, .displayName, .createdDate, .lastModifiedDate] | @csv' >> "$OUTPUT_FILE"
done

echo "Inventory saved to $OUTPUT_FILE"
```

## Workspace Permissions

### List Workspace Users

```bash
# Native alternative (preferred):
fab acl ls "Production.Workspace"

WS_ID=$(fab get "Production.Workspace" -q "id")

# List users with access
fab api -A powerbi "groups/$WS_ID/users"
```

### Add User to Workspace

```bash
# Native (preferred) -- roles: Admin, Member, Contributor, Viewer
fab acl set "Production.Workspace" -I <objectId> -R Member
fab acl set "Production.Workspace" -I <objectId> -R Viewer -f

# Via API (if you need email-based assignment):
WS_ID=$(fab get "Production.Workspace" -q "id")
fab api -A powerbi "groups/$WS_ID/users" -X post -i '{
  "emailAddress": "user@company.com",
  "groupUserAccessRight": "Member"
}'
```

### Remove User from Workspace

```bash
# Native (preferred):
fab acl rm "Production.Workspace" -I <upn-or-clientId> -f

# Via API:
WS_ID=$(fab get "Production.Workspace" -q "id")
fab api -A powerbi "groups/$WS_ID/users/user@company.com" -X delete
```

## Workspace Settings

### Git Integration

```bash
WS_ID=$(fab get "Production.Workspace" -q "id")

# Get Git connection status
fab api "workspaces/$WS_ID/git/connection"

# Connect to Git (requires Git integration setup)
fab api -X post "workspaces/$WS_ID/git/initializeConnection" -i '{
  "gitProviderDetails": {
    "organizationName": "myorg",
    "projectName": "fabric-project",
    "repositoryName": "production",
    "branchName": "main",
    "directoryName": "/workspace-content"
  }
}'
```

## Advanced Workflows

### Clone Workspace

```bash
#!/bin/bash

SOURCE_WS="Template.Workspace"
TARGET_WS="New Project.Workspace"
CAPACITY="MyCapacity"

# 1. Create target workspace
fab mkdir "$TARGET_WS" -P capacityname=$CAPACITY

# 2. Export all items from source
fab export "$SOURCE_WS" -o /tmp/clone -a

# 3. Import items to target
for ITEM in /tmp/clone/*; do
  ITEM_NAME=$(basename "$ITEM")
  fab import "$TARGET_WS/$ITEM_NAME" -i "$ITEM"
done

echo "Workspace cloned successfully"
```

### Workspace Comparison

```bash
#!/bin/bash

WS1="Production.Workspace"
WS2="Development.Workspace"

WS1_ID=$(fab get "$WS1" -q "id")
WS2_ID=$(fab get "$WS2" -q "id")

echo "=== Comparing Workspaces ==="
echo

echo "--- $WS1 ---"
fab api "workspaces/$WS1_ID/items" -q "value[].{type: type, name: displayName}" | jq -r '.[] | "\(.type): \(.name)"' | sort > /tmp/ws1.txt

echo "--- $WS2 ---"
fab api "workspaces/$WS2_ID/items" -q "value[].{type: type, name: displayName}" | jq -r '.[] | "\(.type): \(.name)"' | sort > /tmp/ws2.txt

echo
echo "=== Differences ==="
diff /tmp/ws1.txt /tmp/ws2.txt

rm /tmp/ws1.txt /tmp/ws2.txt
```

### Batch Workspace Operations

```bash
#!/bin/bash

# Native alternative (preferred):
# PROD_WORKSPACES=$(fab ls -q "[?contains(displayName, 'Prod')].displayName")

# Update description for all production workspaces
PROD_WORKSPACES=$(fab api workspaces -q "value[?contains(displayName, 'Prod')].displayName")

for WS in $PROD_WORKSPACES; do
  echo "Updating $WS..."
  fab set "$WS.Workspace" -q description -i "Production environment - managed by Data Platform team"
done
```

## Workspace Monitoring

### Monitor Workspace Activity

```bash
WS_ID=$(fab get "Production.Workspace" -q "id")

# Get activity events (requires admin access)
fab api -A powerbi "admin/activityevents?filter=Workspace%20eq%20'$WS_ID'"
```

### Track Workspace Size

```bash
#!/bin/bash

WORKSPACE="Production.Workspace"
WS_ID=$(fab get "$WORKSPACE" -q "id")

# Count items
ITEM_COUNT=$(fab api "workspaces/$WS_ID/items" -q "value | length")

# Count by type
echo "=== Workspace: $WORKSPACE ==="
echo "Total Items: $ITEM_COUNT"
echo

echo "Items by Type:"
fab api "workspaces/$WS_ID/items" -q "value | group_by(@, &type) | map({type: .[0].type, count: length}) | sort_by(.count) | reverse | .[]" | jq -r '"\(.type): \(.count)"'
```

## Troubleshooting

### Workspace Not Found

```bash
# List all workspaces to verify name
fab ls | grep -i "production"

# Get by ID directly
fab api "workspaces/<workspace-id>"
```

### Capacity Issues

```bash
# Check workspace capacity assignment (None = no capacity)
fab get "Production.Workspace" -q "capacityId"

# List Fabric capacities (F SKUs only)
fab ls .capacities

# List ALL capacities including Trial/PPU
fab api -A powerbi "capacities" -q "value[].{name:displayName, sku:sku, state:state, id:id}"

# Start/stop a Fabric capacity
fab start .capacities/MyCapacity.Capacity
fab stop .capacities/MyCapacity.Capacity -f

# Verify capacity status (via Azure API, for detailed state/SKU info)
fab api -A azure "subscriptions/<subscription-id>/providers/Microsoft.Fabric/capacities?api-version=2023-11-01" -q "value[].{name: name, state: properties.state, sku: sku.name}"
```

**Common capacity errors:**

| Error | Cause | Fix |
|-------|-------|-----|
| `[Not a Fabric capacity]` | `fab assign` used with Trial/PPU capacity | Use Power BI API method; see [Capacity Management](#capacity-management) |
| `[UnexpectedError] 22` | Missing `-f` flag; stdin not a terminal | Add `-f` to the command |
| XMLA "does not have permission to call Discover" | Workspace has no capacity or capacity doesn't support XMLA | Assign a capacity that supports XMLA (F64+, PPU, or Trial) |
| `capacityId: None` | Workspace not on any capacity | Assign a capacity; see [Capacity Management](#capacity-management) |

### Permission Errors

```bash
# Native alternative (preferred):
fab acl ls "Production.Workspace"

# Verify your access level
WS_ID=$(fab get "Production.Workspace" -q "id")
fab api -A powerbi "groups/$WS_ID/users" | grep "$(whoami)"

# Check if you're workspace admin
fab api -A powerbi "groups/$WS_ID/users" -q "value[?emailAddress=='your@email.com'].groupUserAccessRight"
```

## Best Practices

1. **Naming conventions**: Use consistent naming (e.g., "ProjectName - Environment")
2. **Capacity planning**: Assign workspaces to appropriate capacities
3. **Access control**: Use least-privilege principle for permissions
4. **Git integration**: Enable for production workspaces
5. **Regular backups**: Export critical workspaces periodically
6. **Documentation**: Maintain workspace descriptions
7. **Monitoring**: Track workspace activity and growth
8. **Cleanup**: Remove unused workspaces regularly
9. **Folder organization**: For workspaces with 15+ items, group items into folders by function (ETL, Reports, Semantic Models) or by domain; see [Folders](./folders.md) for operations and recommended structures

## Performance Tips

1. **Cache workspace IDs**: Don't repeatedly query for same ID
2. **Use JMESPath filters**: Get only needed data
3. **Parallel operations**: Export multiple items concurrently
4. **Batch updates**: Group similar operations
5. **Off-peak operations**: Schedule large migrations during low usage

## Security Considerations

1. **Access reviews**: Regularly audit workspace permissions
2. **Sensitive data**: Use appropriate security labels
3. **Capacity isolation**: Separate dev/test/prod workspaces
4. **Git secrets**: Don't commit credentials in Git-integrated workspaces
5. **Audit logging**: Enable and monitor activity logs

## Related Scripts

- `scripts/download_workspace.py` - Download complete workspace with all items and lakehouse files
