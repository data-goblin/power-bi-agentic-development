# Workspace Operations

Comprehensive guide for managing Fabric workspaces using the Fabric CLI.

## Overview

Workspaces are containers for Fabric items and provide collaboration and security boundaries. This guide covers workspace management, configuration, and operations.

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

### Assign Workspace to Capacity

```bash
# Assign capacity to workspace (capacity is path arg, -W is target workspace)
fab assign .capacities/MyCapacity.Capacity -W "Production.Workspace"

# Assign domain to workspace
fab assign .domains/Analytics.Domain -W "Production.Workspace" -f
```

### Unassign from Capacity

```bash
# Unassign capacity from workspace
fab unassign .capacities/MyCapacity.Capacity -W "Dev.Workspace"

# Unassign domain from workspace
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

## Deleting Workspaces

### Delete with Confirmation

```bash
# Interactive confirmation (lists items first)
fab rm "OldWorkspace.Workspace"
```

### Force Delete

```bash
# Delete workspace and all contents without confirmation
# ⚠️ DANGEROUS - Cannot be undone
fab rm "TestWorkspace.Workspace" -f
```

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
# Check workspace capacity assignment
fab get "Production.Workspace" -q "capacityId"

# List available capacities
fab ls .capacities

# Start/stop a capacity
fab start .capacities/MyCapacity.Capacity
fab stop .capacities/MyCapacity.Capacity -f

# Verify capacity status (via Azure API, for detailed state/SKU info)
fab api -A azure "subscriptions/<subscription-id>/providers/Microsoft.Fabric/capacities?api-version=2023-11-01" -q "value[].{name: name, state: properties.state, sku: sku.name}"
```

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
