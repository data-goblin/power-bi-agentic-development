# Admin API Operations

Guide for Fabric/Power BI admin-level API operations using `fab`. These APIs require admin privileges and enable cross-workspace discovery, tenant-wide operations, and governance.

> **Note:** `fab acl`, `fab label`, and `fab assign`/`fab unassign` now provide native commands for many admin operations previously requiring `fab api`. Prefer native commands where available; the `fab api` examples below remain necessary for admin-specific endpoints that have no native equivalent.

## Prerequisites

- Fabric Admin or Power BI Admin role
- Or delegated admin permissions via service principal

Check your access:

```bash
fab api "admin/capacities" 2>&1 | head -5
# If you see results, you have admin access
```

## Cross-Workspace Item Discovery

The admin API is the fastest way to find items across ALL workspaces without iterating.

### Find Items by Type

```bash
# Find all semantic models across tenant
fab api "admin/items" -P "type=SemanticModel"

# Find all notebooks
fab api "admin/items" -P "type=Notebook"

# Find all lakehouses
fab api "admin/items" -P "type=Lakehouse"

# Find specific item by name pattern
fab api "admin/items" -P "type=SemanticModel" -q "itemEntities[?contains(name, 'Sales')]"
```

### Available Item Types

```
SemanticModel    Report          Dashboard       Notebook
Lakehouse        Warehouse       DataPipeline    Dataflow
Environment      SparkJobDef     CopyJob         Reflex
Ontology         GraphModel      Exploration     OrgApp
```

### Extract Item Details

```bash
# Get item IDs and workspace IDs
fab api "admin/items" -P "type=Lakehouse" -q "itemEntities[].{name:name,id:id,workspace:workspaceId}"

# Find item's workspace name
ITEM=$(fab api "admin/items" -P "type=SemanticModel" -q "itemEntities[?name=='Sales Model'] | [0]")
WS_ID=$(echo "$ITEM" | jq -r '.workspaceId')
fab api "admin/workspaces/$WS_ID" -q "displayName"
```

## Workspace Administration

### List All Workspaces

```bash
# All workspaces in tenant
fab api "admin/workspaces"

# Filter by state
fab api "admin/workspaces" -q "workspaces[?state=='Active']"

# Get workspace details with users
fab api "admin/workspaces/<workspace-id>/users"

# Native alternative (preferred):
fab acl ls "ws.Workspace"
fab acl get "ws.Workspace"
```

### Workspace Governance

```bash
# Get workspace capacity assignment
fab api "admin/workspaces/<workspace-id>" -q "capacityId"

# List workspaces on a capacity
fab api "admin/capacities/<capacity-id>/workspaces"
```

## Capacity Administration

```bash
# List all capacities
fab api "admin/capacities"

# Get capacity details
fab api "admin/capacities/<capacity-id>"

# Get capacity workloads
fab api "admin/capacities/<capacity-id>/workloads"

# Native alternatives for capacity management:
fab start .capacities/<capacity-name>
fab stop .capacities/<capacity-name>
fab assign .capacities/<capacity-name> -W ws.Workspace
```

## Dataset/Model Administration

```bash
# Get all datasets in tenant (Power BI API)
fab api -A powerbi "admin/datasets"

# Get dataset users
fab api -A powerbi "admin/datasets/<dataset-id>/users"
# For workspace-level permissions, use native: fab acl ls "ws.Workspace"

# Get datasources for a dataset
fab api -A powerbi "admin/datasets/<dataset-id>/datasources"
```

## Report Administration

```bash
# Get all reports in tenant
fab api -A powerbi "admin/reports"

# Get report users
fab api -A powerbi "admin/reports/<report-id>/users"

# Get reports in a workspace
fab api -A powerbi "admin/groups/<workspace-id>/reports"
```

## Common Patterns

### Find Item Across Workspaces

```bash
# Search for a model by name
fab api "admin/items" -P "type=SemanticModel" \
  -q "itemEntities[?contains(name, 'keyword')] | [0].{name:name,id:id,workspace:workspaceId}"
```

### Get Full Item Path

```bash
# Get workspace name + item name for fab path
ITEM=$(fab api "admin/items" -P "type=Notebook" -q "itemEntities[?name=='ETL Pipeline'] | [0]")
WS_ID=$(echo "$ITEM" | jq -r '.workspaceId')
ITEM_NAME=$(echo "$ITEM" | jq -r '.name')
WS_NAME=$(fab api "admin/workspaces/$WS_ID" -q "displayName" | tr -d '"')
echo "$WS_NAME.Workspace/$ITEM_NAME.Notebook"
```

### Audit Item Modifications

```bash
# Get items modified recently
fab api "admin/items" -P "type=Report" \
  -q "itemEntities | sort_by(@, &lastUpdatedDate) | reverse(@) | [:10]"
```

## Security & Governance

### Get Item Permissions

```bash
# Dataset permissions
fab api -A powerbi "admin/datasets/<dataset-id>/users"

# Report permissions
fab api -A powerbi "admin/reports/<report-id>/users"

# Workspace permissions
fab api "admin/workspaces/<workspace-id>/users"

# Native alternative (preferred):
fab acl ls "ws.Workspace"
fab acl get "ws.Workspace"
```

### Encryption Keys

```bash
# Get tenant encryption keys
fab api -A powerbi "admin/tenantKeys"
```

## Pagination

Admin APIs return paginated results. Check for continuation:

```bash
# First page
RESULT=$(fab api "admin/items" -P "type=SemanticModel")

# Check for more
echo "$RESULT" | jq '.continuationUri'

# If not null, fetch next page
fab api "<continuation-uri>"
```

## Error Handling

Common admin API errors:

| Error | Cause | Solution |
|-------|-------|----------|
| 401 | Not authenticated | Run `fab auth login` |
| 403 | Not admin | Request admin role |
| 404 | Item not found | Check item exists |
| 429 | Rate limited | Wait and retry |

## Best Practices

1. **Cache results** - Admin APIs can be slow; cache for repeated queries
2. **Use filters** - Always filter by type when possible
3. **Paginate** - Handle continuation for large tenants
4. **Rate limit** - Space out bulk operations
5. **Audit** - Log admin operations for compliance
