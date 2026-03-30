# Fabric API Reference

Direct API access via `fab api` for operations beyond standard commands.

> **Note:** Several operations previously requiring `fab api` now have native commands. Check `fab acl` (permissions), `fab assign/unassign` (capacity/domain), `fab start/stop` (capacities), `fab ls -q` (filtered listing), and `fab label` (sensitivity labels) before using API calls.

## API Basics

```bash
# Fabric API (default)
fab api "<endpoint>"

# Power BI API
fab api -A powerbi "<endpoint>"

# With query
fab api "<endpoint>" -q "value[0].id"

# POST with body
fab api -X post "<endpoint>" -i '{"key":"value"}'
```

## Capacities

```bash
# Native alternatives (preferred):
# fab ls .capacities          # List capacities
# fab start .capacities/X.Capacity  # Start capacity
# fab stop .capacities/X.Capacity   # Stop capacity

# List all capacities
fab api capacities

# Response includes: id, displayName, sku (F2, F64, FT1, PP3), region, state
```

**Pause/resume capacity** (cost savings):

```bash
# CAUTION: Pausing stops all workloads on that capacity

# Native (preferred):
fab stop .capacities/MyCapacity.Capacity -f    # Pause
fab start .capacities/MyCapacity.Capacity      # Resume

# Via Azure CLI (if fab CLI not available):
az resource update --ids "/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Fabric/capacities/{name}" \
  --set properties.state=Paused
```

## Gateways

```bash
# List gateways
fab api -A powerbi gateways

# Get gateway datasources
GATEWAY_ID="<gateway-id>"
fab api -A powerbi "gateways/$GATEWAY_ID/datasources"

# Get gateway users
fab api -A powerbi "gateways/$GATEWAY_ID/users"

# For gateway permissions, use native:
# fab acl ls .gateways/gw.Gateway
# fab acl set .gateways/gw.Gateway -I <objectId> -R ConnectionCreator
```

## Deployment Pipelines

```bash
# List pipelines (user)
fab api -A powerbi pipelines

# List pipelines (admin - all tenant)
fab api -A powerbi admin/pipelines

# Get pipeline stages
PIPELINE_ID="<pipeline-id>"
fab api -A powerbi "pipelines/$PIPELINE_ID/stages"

# Get pipeline operations
fab api -A powerbi "pipelines/$PIPELINE_ID/operations"
```

**Deploy content** (use Fabric API):

```bash
# Note: fab assign handles capacity/domain assignment natively,
# but deployment pipelines still require the API.

# Assign workspace to stage
fab api -X post "deploymentPipelines/$PIPELINE_ID/stages/$STAGE_ID/assignWorkspace" \
  -i '{"workspaceId":"<workspace-id>"}'

# Deploy to next stage
fab api -X post "deploymentPipelines/$PIPELINE_ID/deploy" -i '{
  "sourceStageOrder": 0,
  "targetStageOrder": 1,
  "options": {"allowCreateArtifact": true, "allowOverwriteArtifact": true}
}'
```

## Domains

```bash
# List domains
fab api admin/domains

# Get domain workspaces
DOMAIN_ID="<domain-id>"
fab api "admin/domains/$DOMAIN_ID/workspaces"

# Assign workspaces to domain
fab api -X post "admin/domains/$DOMAIN_ID/assignWorkspaces" \
  -i '{"workspacesIds":["<ws-id-1>","<ws-id-2>"]}'

# Native alternative (preferred):
# fab assign .domains/domain.Domain -W ws.Workspace -f
```

## Dataflows

**Gen1** (Power BI dataflows):

```bash
# List all dataflows (admin)
fab api -A powerbi admin/dataflows

# List workspace dataflows
WS_ID="<workspace-id>"
fab api -A powerbi "groups/$WS_ID/dataflows"

# Refresh dataflow
DATAFLOW_ID="<dataflow-id>"
fab api -A powerbi -X post "groups/$WS_ID/dataflows/$DATAFLOW_ID/refreshes"
```

**Gen2** (Fabric dataflows):

```bash
# Gen2 dataflows are Fabric items - use standard fab commands
fab ls "ws.Workspace" | grep DataflowGen2
fab get "ws.Workspace/Flow.DataflowGen2" -q "id"
```

## Apps

**Workspace Apps** (published from workspaces):

```bash
# List user's apps
fab api -A powerbi apps

# List all apps (admin)
fab api -A powerbi 'admin/apps?$top=100'

# Get app details
APP_ID="<app-id>"
fab api -A powerbi "apps/$APP_ID"

# Get app reports
fab api -A powerbi "apps/$APP_ID/reports"

# Get app dashboards
fab api -A powerbi "apps/$APP_ID/dashboards"
```

**Org Apps** (template apps from AppSource):

```bash
# Org apps are installed from AppSource marketplace
# They appear in the regular apps endpoint after installation
# No separate API for org app catalog - use AppSource
```

## Admin Operations

### Workspaces

```bash
# List all workspaces (requires $top)
fab api -A powerbi 'admin/groups?$top=100'

# Response includes: id, name, type, state, capacityId, pipelineId

# Get workspace users
fab api -A powerbi "admin/groups/$WS_ID/users"

# Native alternative (preferred):
# fab acl ls "ws.Workspace"
```

### Items

```bash
# List all items in tenant
fab api admin/items

# Response includes: id, type, name, workspaceId, capacityId, creatorPrincipal
```

### Security Scanning

```bash
# Reports shared with entire org (security risk)
fab api -A powerbi "admin/widelySharedArtifacts/linksSharedToWholeOrganization"

# Reports published to web (security risk)
fab api -A powerbi "admin/widelySharedArtifacts/publishedToWeb"
```

### Activity Events

```bash
# Get activity events (last 30 days max)
# Dates must be in ISO 8601 format with quotes
START="2025-11-26T00:00:00Z"
END="2025-11-27T00:00:00Z"
fab api -A powerbi "admin/activityevents?startDateTime='$START'&endDateTime='$END'"
```

## Common Patterns

### Extract ID for Chaining

```bash
# Get ID and remove quotes
WS_ID=$(fab get "ws.Workspace" -q "id" | tr -d '"')
MODEL_ID=$(fab get "ws.Workspace/Model.SemanticModel" -q "id" | tr -d '"')

# Use in API call
fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID/refreshes" -X post -i '{"type":"Full"}'
```

### Pagination

```bash
# APIs with $top often have pagination
# Check for @odata.nextLink in response

fab api -A powerbi 'admin/groups?$top=100' -q "@odata.nextLink"
# Use returned URL for next page
```

### Error Handling

```bash
# Check status_code in response
# 200 = success
# 400 = bad request (check parameters)
# 401 = unauthorized (re-authenticate)
# 403 = forbidden (insufficient permissions)
# 404 = not found
```

## API Audiences

| Audience | Flag | Base URL | Use Case |
|----------|------|----------|----------|
| Fabric | (default) | api.fabric.microsoft.com | Fabric items, workspaces, admin |
| Power BI | `-A powerbi` | api.powerbi.com | Reports, datasets, gateways, pipelines |

Most admin operations work with both APIs but return different formats.
