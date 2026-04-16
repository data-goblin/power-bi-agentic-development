# Admin API Operations

Guide for Fabric/Power BI admin-level API operations using `fab`. These APIs require admin privileges and enable cross-workspace discovery, tenant-wide operations, and governance.

## Docs 

For more info use:
- `mslearn search` or `mslearn fetch`
- Microsoft Learn MCP server (`microsoft_docs_search`, `microsoft_docs_fetch`)

## Prerequisites

- Fabric Admin or Power BI Admin role
- Or delegated admin permissions via service principal

Check your access with a cheap read probe; `fab api` returns a `{status_code, text}` envelope, so query the status directly:

```bash
fab api "admin/tenantsettings" -q "status_code"
# 200 = admin read access; 401 = not authed; 403 = not admin
```

Admin access isn't binary. Read-only admin, full admin, and service principals with allowlist scoping behave differently per endpoint, so a successful probe doesn't guarantee the next call will work. For write endpoints there's no safe dry-run; you discover 401/403 on the real call. When in doubt, test the specific endpoint you intend to use.

Rate limit: admin write endpoints are capped at 25 requests/minute; watch for `429` and respect `Retry-After`.

## Tenant Settings, Security Groups, Workspace Permissions

> **Use the `audit-tenant-settings` skill (in the `fabric-admin` plugin) for any audit, drift, change-detection, or governance question** touching tenant settings, delegated overrides, or the Entra ID security groups that scope them. That skill owns the curated baseline, the audit script, and the SG investigation workflow. The patterns below cover the raw API mechanics the skill relies on.

### List tenant settings

```bash
fab api "admin/tenantsettings"

# Filter by keyword in the UI title (note the text. prefix; fab api -q
# runs JMESPath against the full {status_code, text} response envelope)
fab api "admin/tenantsettings" -q "text.tenantSettings[?contains(title, 'recovery')]"

# Just name + enabled state
fab api "admin/tenantsettings" -q "text.tenantSettings[].{name: settingName, enabled: enabled}"
```

Each setting has `settingName`, `title`, `enabled`, `canSpecifySecurityGroups`, `tenantSettingGroup`, and optional `properties`, `enabledSecurityGroups`, `excludedSecurityGroups`, `delegateToCapacity`, `delegateToDomain`, `delegateToWorkspace`.

### Update a tenant setting

```http
POST /v1/admin/tenantsettings/{settingName}/update
```

Pass the body via `-i <file>`. `enabled` is required; other fields are preserved or cleared based on what you send.

```bash
cat > /tmp/setting.json <<'EOF'
{
  "enabled": true,
  "properties": [
    {"name": "ArtifactRetentionPeriod", "value": "7", "type": "Integer"}
  ]
}
EOF
fab api -X post "admin/tenantsettings/ConfigureArtifactRetentionPeriod/update" -i /tmp/setting.json
```

Property `type` values: `Boolean`, `Integer`, `FreeText`, `Url`, `MailEnabledSecurityGroup`. The `value` is always a string.

### Capacity, domain, and workspace overrides

Delegated overrides replace a tenant-wide setting for a specific scope, so any audit must enumerate them before concluding what posture a workspace actually sees. Overrides only exist when the parent setting has `delegateToCapacity` / `delegateToDomain` / `delegateToWorkspace` set to `true`. The three list endpoints below return every override defined at that scope across the tenant in a single call, so you can diff live state vs. parent tenant setting:

**Reads (all scopes):**

```bash
# Tenant-wide: every override across all capacities / domains / workspaces
fab api "admin/capacities/delegatedTenantSettingOverrides"
fab api "admin/domains/delegatedTenantSettingOverrides"
fab api "admin/workspaces/delegatedTenantSettingOverrides"

# Scoped: overrides for a specific capacity (only capacity has a scoped variant;
# domain- and workspace-scoped endpoints return 404 and must be filtered client-side
# from the tenant-wide list above).
fab api "admin/capacities/{capacityId}/delegatedTenantSettingOverrides"
```

The capacity tenant-wide response ships both `overrides` and `value` arrays (legacy + current schema); the domain and workspace responses ship only `value`. All three return `continuationUri` / `continuationToken` when paged.

**Writes (capacity only):** the Fabric admin REST API only exposes Update and Delete for capacity overrides. Domain and workspace overrides are read-only through the admin API and must be managed in the admin portal UI (or via the domain/workspace admin UIs) by someone with the appropriate admin role.

```bash
# Update a capacity override (same body shape as tenant-wide update)
cat > /tmp/override.json <<'EOF'
{
  "enabled": true,
  "properties": [
    {"name": "ArtifactRetentionPeriod", "value": "14", "type": "Integer"}
  ]
}
EOF
fab api -X post \
  "admin/capacities/{capacityId}/delegatedTenantSettingOverrides/{settingName}/update" \
  -i /tmp/override.json

# Remove a capacity override
fab api -X delete \
  "admin/capacities/{capacityId}/delegatedTenantSettingOverrides/{settingName}"
```

Ref: [Admin - Tenants REST API](https://learn.microsoft.com/en-us/rest/api/fabric/admin/tenants). The doc enumerates Delete/List/Update operations and none exist for domain or workspace overrides.

A setting that is `enabled: true` tenant-wide can still be disabled (or security-group-restricted) on a specific capacity/domain/workspace via an override, and vice versa; always check overrides before concluding a governance finding.

### Worked example: workspace retention

Setting name: `ConfigureFolderRetentionPeriod`. Controls how long deleted collaborative workspaces can be restored. Default enabled at 7 days; valid range 7 to 90. Personal workspaces (My workspace) are fixed at 30 days and cannot be changed.

```bash
echo '{"enabled": true, "properties": [{"name": "FolderRetentionPeriod", "value": "7", "type": "Integer"}]}' \
  > /tmp/ws-retention.json
fab api -X post "admin/tenantsettings/ConfigureFolderRetentionPeriod/update" -i /tmp/ws-retention.json
```

### Worked example: enable Fabric item recovery

The **Fabric item recovery** setting (`ConfigureArtifactRetentionPeriod`) controls whether `fab rm` soft-deletes items into a workspace recycle bin. Default is off; valid retention range is 7 to 90 days.

```bash
# Current state
fab api "admin/tenantsettings" \
  -q "text.tenantSettings[?settingName=='ConfigureArtifactRetentionPeriod']"

# Enable with 7-day retention
cat > /tmp/recovery.json <<'EOF'
{
  "enabled": true,
  "properties": [
    {"name": "ArtifactRetentionPeriod", "value": "7", "type": "Integer"}
  ]
}
EOF
fab api -X post "admin/tenantsettings/ConfigureArtifactRetentionPeriod/update" -i /tmp/recovery.json

# Disable
echo '{"enabled": false}' > /tmp/recovery-off.json
fab api -X post "admin/tenantsettings/ConfigureArtifactRetentionPeriod/update" -i /tmp/recovery-off.json
```

Once enabled, deletes land in `workspaces/{workspaceId}/recoverableItems`; see [reference.md > Recovering deleted items](reference.md#recovering-deleted-items) for the restore flow.

### Gotchas

- `fab api -q <jmespath>` runs against the full `{status_code, text}` envelope, so filters must start with `text.` (e.g. `text.tenantSettings[?...]`, `text.value[?...]`). Queries that forget the prefix silently return `None`.
- Empty-body POSTs to endpoints that return `202 null` (e.g. `recoverableItems/.../recover`) can occasionally surface `[UnexpectedError] Expecting value: line 1 column 1 (char 0)` from `fab api`'s JSON parser. The operation still succeeds; verify with a follow-up `fab exists` or list call and retry if necessary.
- API setting names differ from admin portal UI titles; always list first.
- `enabled: false` on update does not preserve prior `properties`; resend them if needed.
- Updating a parent setting does not retroactively rewrite existing capacity/domain/workspace overrides; adjust overrides explicitly.
- Security-group-scoped settings require `canSpecifySecurityGroups: true` and a valid `graphId` in `enabledSecurityGroups` / `excludedSecurityGroups`.
- Service principals hit 401 on write endpoints unless the **Service principals can access admin APIs used for updates** tenant setting is on, even with `Tenant.ReadWrite.All`.

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

# Get workspace users (preferred: native command)
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

# Get dataset users (preferred: native command at workspace scope)
fab acl ls "ws.Workspace/Model.SemanticModel"

# Get datasources for a dataset
fab api -A powerbi "admin/datasets/<dataset-id>/datasources"
```

## Report Administration

```bash
# Get all reports in tenant
fab api -A powerbi "admin/reports"

# Get report users (preferred: native command)
fab acl ls "ws.Workspace/Report.Report"

# Get reports in a workspace
fab api -A powerbi "admin/groups/<workspace-id>/reports"
```

## Governance: Metadata Scanner API

**Use case:** catalogue every workspace, item, table, column, measure, DAX expression, and data source in the tenant for data-governance, Purview ingestion, or lineage tooling. This is the only admin API that returns subartifact metadata (model schemas, M queries, DAX).

### Scanner API flow

Four endpoints under the `powerbi` audience:

```
GET  admin/workspaces/modified              (which workspaces changed)
POST admin/workspaces/getInfo               (start a scan for up to 100 workspaces)
GET  admin/workspaces/scanStatus/{scanId}   (poll until Succeeded)
GET  admin/workspaces/scanResult/{scanId}   (fetch metadata payload)
```

Rules:
- Max 100 workspace IDs per `getInfo` call.
- No more than 16 concurrent scans per tenant.
- Poll `scanStatus` at 30-60 second intervals.
- `modifiedSince` accepts ISO 8601 and must be within the last 30 days.
- Tenant admin must have **Enhance admin APIs responses with detailed metadata** and **Enhance admin APIs responses with DAX and mashup expressions** enabled (see Tenant Settings above; setting names `AdminApisIncludeDetailedMetadata` and `AdminApisIncludeExpressions`).

### Full scan

```bash
# 1. List every workspace in the tenant (exclude personal workspaces)
fab api -A powerbi "admin/workspaces/modified" -P "excludePersonalWorkspaces=true" \
  -q "text[].id" > /tmp/ws-all.json

# 2. Kick off a scan for a batch of up to 100 workspace IDs
cat > /tmp/scan-body.json <<'EOF'
{
  "workspaces": [
    "aaaaaaaa-0000-1111-2222-333333333333",
    "bbbbbbbb-0000-1111-2222-333333333333"
  ]
}
EOF
SCAN_ID=$(fab api -A powerbi -X post \
  "admin/workspaces/getInfo" \
  -P "lineage=true,datasourceDetails=true,datasetSchema=true,datasetExpressions=true,getArtifactUsers=true" \
  -i /tmp/scan-body.json \
  -q "text.id" | tr -d '"')

# 3. Poll scan status
while :; do
  STATUS=$(fab api -A powerbi "admin/workspaces/scanStatus/$SCAN_ID" -q "text.status" | tr -d '"')
  echo "status: $STATUS"
  [ "$STATUS" = "Succeeded" ] && break
  [ "$STATUS" = "Failed" ] && { echo "scan failed"; exit 1; }
  sleep 30
done

# 4. Fetch results
fab api -A powerbi "admin/workspaces/scanResult/$SCAN_ID" > /tmp/scan-result.json
```

### Incremental scan

```bash
# Workspaces changed since the last scan time
LAST_SCAN="2026-04-13T00:00:00.0000000Z"
fab api -A powerbi "admin/workspaces/modified" \
  -P "modifiedSince=$LAST_SCAN,excludePersonalWorkspaces=true"
# ...then batch into getInfo / scanStatus / scanResult as above
```

### Scanner gotchas

- Semantic models that haven't been refreshed or republished return lineage only, no subartifact schema.
- DirectQuery-only semantic models need at least one report interaction before subartifact metadata is populated.
- Shared-workspace semantic models over 1 GB return no subartifact metadata (Premium/Fabric capacities have no limit).
- Unsupported types surface a `schemaRetrievalError` field instead of schema: real-time datasets, OLS-enabled models, live-connect AS Azure / AS on-prem, Excel full fidelity.
- Scanner APIs require `-A powerbi`; hitting them under the default `fabric` audience returns 404.
- Running under a service principal requires **Service principals can access read-only admin APIs** enabled and the SP added to an allowed security group.

## Audit: Activity Events

**Use case:** investigate who did what during an incident, export audit trails for compliance, feed a SIEM.

```bash
# Activity events for a single day (max window per call = 1 day; 30-day history)
fab api -A powerbi "admin/activityevents" \
  -P "startDateTime='2026-04-13T00:00:00Z',endDateTime='2026-04-13T23:59:59Z'"

# Activity for a specific operation
fab api -A powerbi "admin/activityevents" \
  -P "startDateTime='2026-04-13T00:00:00Z',endDateTime='2026-04-13T23:59:59Z',$filter=Activity eq 'DeleteDataset'"
```

Continuation token pattern:

```bash
URI="admin/activityevents?startDateTime='2026-04-13T00:00:00Z'&endDateTime='2026-04-13T23:59:59Z'"
while :; do
  RESP=$(fab api -A powerbi "$URI")
  echo "$RESP" | jq '.text.activityEventEntities[]'
  TOKEN=$(echo "$RESP" | jq -r '.text.continuationToken // empty')
  [ -z "$TOKEN" ] && break
  URI="admin/activityevents?continuationToken='$TOKEN'"
done
```

Common `Activity` values: `ViewReport`, `ViewDashboard`, `CreateDataset`, `DeleteDataset`, `ExportReport`, `UpdateWorkspaceAccess`, `ShareReport`, `Admin` settings changes (`UpdatedAdminFeatureSwitch`).

## Audit: User Access and Orphans

**Use case:** offboarding, license reviews, finding workspaces with no owners, finding items a departing user owns.

```bash
# What items does this user have access to across the tenant
fab api -A powerbi "admin/users/{userGraphId}/artifactAccess"

# Workspace users (preferred: native command)
fab acl ls "ws.Workspace"

# Find workspaces with no active admins (orphan hunt)
fab api -A powerbi "admin/groups?%24expand=users&%24filter=state eq 'Active'" \
  -q "text.value[?!users[?groupUserAccessRight=='Admin']].{id:id,name:name}"
```

## Monitoring: Refreshes

**Use case:** detect failing refreshes across every workspace, build a refresh SLA dashboard, catch stuck semantic models.

```bash
# Top refreshables across tenant (sorted by last refresh)
fab api -A powerbi "admin/capacities/refreshables?%24top=50&%24expand=capacity,group"

# Refresh history for a specific dataset
fab api -A powerbi "admin/groups/{workspaceId}/datasets/{datasetId}/refreshes?%24top=10"

# Refresh schedule
fab api -A powerbi "admin/groups/{workspaceId}/datasets/{datasetId}/refreshSchedule"

# Datasets pinned to a capacity
fab api -A powerbi "admin/capacities/{capacityId}/refreshables"
```

Fields worth tracking per refreshable: `lastRefresh.status`, `lastRefresh.endTime`, `averageDuration`, `medianDuration`, `refreshCount`, `refreshFailures`, `refreshesPerDay`.

## Capacity Health

**Use case:** which workspaces live on which capacity, workload enablement, pause/resume, throttling events.

```bash
# List all capacities with SKU and state
fab api -A powerbi "admin/capacities"

# Workloads enabled on a capacity
fab api -A powerbi "admin/capacities/{capacityId}/Workloads"

# Pause / resume a Fabric capacity
fab stop .capacities/{capacity-name}
fab start .capacities/{capacity-name}

# Reassign a stranded workspace to a healthy capacity (preferred: native)
fab assign .capacities/{capacity-name} -W ws.Workspace -f
```

## Gateways and Data Sources

**Use case:** find which items depend on an on-premises gateway, audit gateway admins, locate a stale gateway cluster.

```bash
# All gateway clusters in tenant
fab api -A powerbi "admin/gatewayClusters"

# Data sources attached to a gateway
fab api -A powerbi "admin/gatewayClusters/{clusterId}/datasources"

# Which datasets use a given data source
fab api -A powerbi "admin/datasources/{datasourceId}/datasets"
```

## Deployment Pipelines

**Use case:** audit pipeline stage assignments, diff dev/test/prod content, bulk-inspect pipeline users.

```bash
fab api -A powerbi "admin/pipelines"
fab api -A powerbi "admin/pipelines/{pipelineId}/users"
fab api -A powerbi "admin/pipelines/{pipelineId}/stages"
fab api -A powerbi "admin/pipelines/{pipelineId}/operations"
```

## Dataflows

**Use case:** tenant-wide dataflow inventory, usage of a specific dataflow across workspaces.

```bash
# All dataflows in tenant
fab api -A powerbi "admin/dataflows"

# Downstream datasets for a dataflow
fab api -A powerbi "admin/dataflows/{dataflowId}/datasources"

# Users with access
fab api -A powerbi "admin/dataflows/{dataflowId}/users"
```

## Workspace Lifecycle

**Use case:** recover deleted workspaces during their retention window, reassign a workspace owner after offboarding.

```bash
# List deleted workspaces still within retention
fab api "admin/workspaces?%24filter=state eq 'Deleted'"

# Restore a deleted workspace (assign a new owner)
cat > /tmp/restore.json <<'EOF'
{
  "emailAddress": "new.owner@contoso.com",
  "name": "Recovered Workspace"
}
EOF
fab api -A powerbi -X post "admin/groups/{workspaceId}/restore" -i /tmp/restore.json

# Update workspace properties (rename, change description)
fab api -A powerbi -X patch "admin/groups/{workspaceId}" -i /tmp/update.json
```

Workspace retention (separate from Item Recovery; default 90 days after deletion) is controlled by `ConfigureFolderRetentionPeriod` in Tenant Settings.

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

Use native ACL commands; they cover workspace, semantic model, and report permissions without admin API calls.

```bash
# Workspace permissions
fab acl ls "ws.Workspace"
fab acl get "ws.Workspace"

# Semantic model permissions
fab acl ls "ws.Workspace/Model.SemanticModel"

# Report permissions
fab acl ls "ws.Workspace/Report.Report"

# Grant or revoke access
fab acl set "ws.Workspace" -I <objectId> -R Member
fab acl rm  "ws.Workspace" -I <upn-or-clientId> -f
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
