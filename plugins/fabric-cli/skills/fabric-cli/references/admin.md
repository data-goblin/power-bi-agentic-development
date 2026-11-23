# Admin API operations

Tenant-wide reads and governance calls through `fab api`. Needs the Fabric Administrator or Power BI Administrator role, or a service principal allowed by the admin tenant settings. For tenant-setting audits and drift detection use the `audit-tenant-settings` skill in the `fabric-admin` plugin; this file covers only the call mechanics.

## Learn

```yaml
admin REST (Fabric): https://learn.microsoft.com/en-us/rest/api/fabric/admin
admin REST (Power BI): https://learn.microsoft.com/en-us/rest/api/power-bi/admin
metadata scanner: https://learn.microsoft.com/en-us/power-bi/enterprise/service-admin-metadata-scanning
activity events: https://learn.microsoft.com/en-us/rest/api/power-bi/admin/get-activity-events
```

## Access and audiences

Probe with a read; `fab api` wraps every response in `{status_code, text}`:

```bash
fab api admin/tenantsettings -q status_code
```

```yaml
200: admin read works
401: not authenticated
403: not an admin
```

- A passing probe does not prove a write works; there is no dry run for writes, so you learn about 401/403 on the real call
- Admin write rate limit is 25 requests per minute; on 429 wait for `Retry-After`
- `-q` is JMESPath over the envelope, so paths start with `text.` (`text.value[...]`, `text.itemEntities[...]`); a path without it silently returns nothing
- Two audiences: the default Fabric audience (`admin/tenantsettings`, `admin/items`, `admin/workspaces`, `admin/domains`) and `-A powerbi` (`admin/capacities`, `admin/datasets`, `admin/reports`, `admin/groups`, `admin/gatewayClusters`, `admin/pipelines`, `admin/dataflows`, `admin/activityevents`, scanner endpoints)
- `admin/capacities` and `admin/capacities/<id>/workloads` return 404 on the Fabric audience; add `-A powerbi`
- A service principal needs the matching tenant settings (read-only admin APIs, admin APIs used for updates) and membership of the allowed security group, even with `Tenant.ReadWrite.All`; without them writes return 401

## Tenant settings

```bash
fab api admin/tenantsettings -q "text.tenantSettings[?contains(title,'recovery')].{name:settingName,enabled:enabled}"
fab api -X post admin/tenantsettings/<settingName>/update -i body.json
```

```yaml
setting fields: settingName, title, enabled, canSpecifySecurityGroups, tenantSettingGroup, properties, enabledSecurityGroups, excludedSecurityGroups, delegateToCapacity, delegateToDomain, delegateToWorkspace
update body: {"enabled": true, "properties": [{"name": "ArtifactRetentionPeriod", "value": "7", "type": "Integer"}]}
property type: Boolean | Integer | FreeText | Url | MailEnabledSecurityGroup; value is always a string
```

- API setting names differ from portal titles: list first, then match
- `enabled: false` does not preserve earlier `properties`; resend them
- Security-group scoping needs `canSpecifySecurityGroups: true` and the group's Entra object id (`graphId`)
- Updating a parent setting does not rewrite existing capacity, domain or workspace overrides
- Item recovery is `ConfigureArtifactRetentionPeriod` (property `ArtifactRetentionPeriod`, 7 to 90 days, off by default); it decides whether `fab rm` is recoverable (see [commands.md](./commands.md))
- Workspace retention is `ConfigureFolderRetentionPeriod` (property `FolderRetentionPeriod`); default 7 days, configurable from 7 to 90 ([workspace retention](https://learn.microsoft.com/en-us/fabric/admin/workspace-retention))
- Personal workspaces keep a fixed 30 days

### Delegated overrides

A setting enabled tenant-wide can be off or group-restricted on a capacity, domain or workspace. Enumerate overrides before concluding what posture a workspace sees; they exist only where the parent has `delegateToCapacity`, `delegateToDomain` or `delegateToWorkspace` true.

```bash
fab api admin/capacities/delegatedTenantSettingOverrides
fab api admin/domains/delegatedTenantSettingOverrides
fab api admin/workspaces/delegatedTenantSettingOverrides
fab api admin/capacities/<capacityId>/delegatedTenantSettingOverrides
```

- Only capacity has a scoped variant; filter domain and workspace overrides client-side
- Only capacity overrides can be updated (POST `.../delegatedTenantSettingOverrides/<settingName>/update`, same body as the tenant update) or deleted (DELETE on `.../<settingName>`); domain and workspace overrides are portal-only
- Capacity responses carry both `overrides` and `value` (legacy and current); domain and workspace carry `value` only; all page with `continuationUri` / `continuationToken`
- If a 202 empty-body POST surfaces `[UnexpectedError] Expecting value: line 1 column 1`, the operation still ran; verify with a read

## Item discovery

For ordinary lookups use `fab find`, which needs no admin role (see [../../../wiki/workspaces.md](../../../wiki/workspaces.md)). The admin path returns every item in every workspace regardless of the caller's permissions.

```bash
fab api admin/items -P type=SemanticModel -q "text.itemEntities[?contains(name,'Sales')].{name:name,id:id,ws:workspaceId}"
fab api admin/workspaces/<workspaceId> -q "text.name"
```

Results page with `continuationUri`; fetch it with another `fab api` call.

## Endpoint cheat list (all `-A powerbi` unless noted)

```yaml
workspaces (Fabric audience): admin/workspaces, filter -q "text.workspaces[?state=='Active']"
workspaces on a capacity: admin/capacities/<id>/workspaces
datasets and datasources: admin/datasets, admin/datasets/<id>/datasources
reports: admin/reports, admin/groups/<workspaceId>/reports
user access across tenant: admin/users/<userGraphId>/artifactAccess
orphan workspaces: admin/groups?%24expand=users&%24filter=state eq 'Active', then -q "text.value[?!users[?groupUserAccessRight=='Admin']].{id:id,name:name}"
refreshables: admin/capacities/refreshables?%24top=50&%24expand=capacity,group
refresh history: admin/groups/<ws>/datasets/<ds>/refreshes?%24top=10
refresh schedule: admin/groups/<ws>/datasets/<ds>/refreshSchedule
gateways: admin/gatewayClusters, admin/gatewayClusters/<id>/datasources, admin/datasources/<id>/datasets
deployment pipelines: admin/pipelines, .../<id>/users, .../<id>/stages, .../<id>/operations
dataflows: admin/dataflows, admin/dataflows/<id>/datasources, admin/dataflows/<id>/users
encryption keys: admin/tenantKeys
```

- Refreshable fields worth tracking: `lastRefresh.status`, `lastRefresh.endTime`, `averageDuration`, `refreshFailures`, `refreshesPerDay`
- Restore a deleted workspace: list with `admin/workspaces?%24filter=state eq 'Deleted'` (Fabric audience), then POST `admin/groups/<id>/restore` with `{"emailAddress": ..., "name": ...}` under `-A powerbi`
- Capacity pause, resume and assign have native commands: `fab stop .capacities/<name>`, `fab start .capacities/<name>`, `fab assign .capacities/<name> -W ws.Workspace`

## Metadata scanner

The only admin API returning subartifact metadata (tables, columns, measures, DAX, M, data sources). Four calls, all `-A powerbi`:

```yaml
admin/workspaces/modified: workspaces changed (modifiedSince must be within 30 days; excludePersonalWorkspaces=true)
POST admin/workspaces/getInfo: start a scan, at most 100 workspace ids per call, body {"workspaces": [ids]}
admin/workspaces/scanStatus/<scanId>: poll every 30 to 60 s until Succeeded
admin/workspaces/scanResult/<scanId>: fetch the payload
```

```bash
SCAN=$(fab api -A powerbi -X post admin/workspaces/getInfo \
  -P "lineage=true,datasourceDetails=true,datasetSchema=true,datasetExpressions=true,getArtifactUsers=true" \
  -i scan-body.json -q "text.id")
fab api -A powerbi admin/workspaces/scanStatus/$SCAN -q "text.status"
fab api -A powerbi admin/workspaces/scanResult/$SCAN > scan-result.json
```

- At most 16 concurrent scans per tenant
- Needs the tenant settings `AdminApisIncludeDetailedMetadata` and `AdminApisIncludeExpressions` for schema and expressions
- Models never refreshed or republished return lineage only; DirectQuery-only models need one report interaction first; shared-capacity models over 1 GB return no subartifact data
- Unsupported types return `schemaRetrievalError`: real-time datasets, OLS models, live-connect AS, Excel full fidelity
- Incremental scan: call `modified` with `modifiedSince=<ISO 8601>`, then feed those ids to `getInfo`

## Activity events

```bash
fab api -A powerbi admin/activityevents -P "startDateTime='2026-04-13T00:00:00Z',endDateTime='2026-04-13T23:59:59Z'"
```

- One call covers at most one UTC day, history is 30 days, and both datetimes are quoted inside the value
- Follow `text.continuationToken` with `admin/activityevents?continuationToken='<token>'` until it is empty
- Filter with `$filter=Activity eq 'DeleteDataset'`; common values: ViewReport, CreateDataset, DeleteDataset, ExportReport, ShareReport, UpdateWorkspaceAccess, UpdatedAdminFeatureSwitch

## Permissions

`fab acl` covers workspaces, connections and gateways only, not items. For who can reach an item tenant-wide, use `admin/users/<userGraphId>/artifactAccess` above, or the item-permission REST APIs described in [permissions.md](./permissions.md).
