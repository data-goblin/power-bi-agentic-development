# Dataflow Operations

Dataflows come in two generations with completely different API surfaces. Gen1 dataflows use the Power BI REST API; Gen2 dataflows are Fabric items managed through the generic Items API.

## Gen1 vs Gen2 Comparison

| Aspect | Gen1 (Power BI Dataflows) | Gen2 (Fabric Dataflow Gen2) |
|---|---|---|
| API audience | `powerbi` | Fabric (default) |
| Endpoint prefix | `groups/<ws-id>/dataflows` | `workspaces/<ws-id>/items` |
| Storage | Internal PBI storage or ADLS Gen2 | Lakehouse, Warehouse, Azure SQL, etc. |
| Definition format | model.json (CDM) | dataflow-content.json (base64 mashup) |
| Refresh model | Transaction-based (`transactionId`) | Job-based (`jobInstanceId`) |
| CI/CD | Export/Import JSON | Git integration + deployment pipelines |
| Admin APIs | Dedicated `/admin/dataflows/` | Generic Fabric admin item APIs |
| Multiple destinations | No | Yes |
| Monitoring Hub | No | Yes |
| Incremental refresh | Premium only | Yes |

---

## Gen1 Operations

All Gen1 endpoints require the `-A powerbi` audience flag and operate under the `groups/<ws-id>/dataflows` path.

### List Dataflows

```bash
WS_ID="<workspace-id>"
fab api -A powerbi "groups/$WS_ID/dataflows"
```

Returns an array of objects with `objectId`, `name`, `description`, `modelUrl`, and `configuredBy`.

Filter to names only:

```bash
fab api -A powerbi "groups/$WS_ID/dataflows" -q "value[].{id:objectId, name:name}"
```

### Get Dataflow Definition

Retrieve the full CDM model.json definition for a dataflow.

```bash
DF_ID="<dataflow-id>"
fab api -A powerbi "groups/$WS_ID/dataflows/$DF_ID"
```

The response is the raw JSON definition (CDM format), not a wrapper object.

### Update Dataflow Properties

```bash
fab api -A powerbi -X patch "groups/$WS_ID/dataflows/$DF_ID" -i '{
  "name": "Renamed Dataflow",
  "description": "Updated description",
  "allowNativeQueries": true,
  "computeEngineBehavior": "computeOptimized"
}'
```

Valid `computeEngineBehavior` values: `computeOptimized`, `computeOn`, `computeDisabled`.

### Delete Dataflow

```bash
fab api -A powerbi -X delete "groups/$WS_ID/dataflows/$DF_ID"
```

### Get Data Sources

```bash
fab api -A powerbi "groups/$WS_ID/dataflows/$DF_ID/datasources"
```

Returns data source type, gateway ID, and connection details (server, database, URL) for each source.

### Trigger Refresh

```bash
fab api -A powerbi -X post "groups/$WS_ID/dataflows/$DF_ID/refreshes" -i '{
  "notifyOption": "NoNotification"
}'
```

Valid `notifyOption` values: `NoNotification`, `MailOnFailure`. Note that `MailOnCompletion` is not supported for dataflows.

Optionally append a process type: `groups/$WS_ID/dataflows/$DF_ID/refreshes?processType=default`.

### Get Transactions (Refresh History)

```bash
fab api -A powerbi "groups/$WS_ID/dataflows/$DF_ID/transactions"
```

Returns an array of transaction objects with `id` (the transactionId), `refreshType`, `startTime`, `endTime`, and `status`.

### Cancel a Transaction

Note the path structure -- the cancel endpoint sits under `/dataflows/transactions/`, not under a specific dataflow.

```bash
TX_ID="<transaction-id>"
fab api -A powerbi -X post "groups/$WS_ID/dataflows/transactions/$TX_ID/cancel"
```

Returns `{ transactionId, status }`. Status values: `successfullyMarked`, `alreadyConcluded`, `invalid`, `notFound`.

### Get Upstream Dataflows

Identify dataflows that the target depends on (linked/computed entities).

```bash
fab api -A powerbi "groups/$WS_ID/dataflows/$DF_ID/upstreamDataflows"
```

Returns `{ value: [{ targetDataflowId, groupId }] }`.

### Update Refresh Schedule

```bash
fab api -A powerbi -X patch "groups/$WS_ID/dataflows/$DF_ID/refreshSchedule" -i '{
  "value": {
    "days": ["Monday", "Wednesday", "Friday"],
    "times": ["07:00", "13:00", "19:00"],
    "enabled": true,
    "localTimeZoneId": "UTC",
    "notifyOption": "NoNotification"
  }
}'
```

Day values: `Sunday` through `Saturday`. Times use 24-hour `HH:mm` format.

### Migrate Gen1 to Gen2

Convert a Gen1 dataflow to a Gen2 (Fabric) artifact. This is a preview feature.

```bash
fab api -A powerbi -X post "groups/$WS_ID/dataflows/$DF_ID/saveAsNativeArtifact" -i '{
  "displayName": "Migrated Dataflow",
  "description": "Converted from Gen1",
  "includeSchedule": true,
  "targetWorkspaceId": "<target-workspace-id>"
}'
```

Key behavior:

- The original Gen1 dataflow is preserved; a new Gen2 item is created
- Connections are migrated to Fabric format
- If `includeSchedule` is true, the schedule is copied in a disabled state
- Non-fatal errors appear in the response `errors[]` array: `FailedToCopySchedule`, `SetDataflowOriginFailed`, `ConnectionsUpdateFailed`

---

## Gen2 Operations

Gen2 dataflows are standard Fabric items of type `Dataflow`. All operations use the default Fabric audience (no `-A` flag needed).

### List Dataflows

```bash
WS_ID="<workspace-id>"
fab api "workspaces/$WS_ID/items?type=Dataflow"
```

Returns standard item objects with `id`, `type`, `displayName`, `description`, and `workspaceId`.

Filter to names:

```bash
fab api "workspaces/$WS_ID/items?type=Dataflow" -q "[].{id:id, name:displayName}"
```

### Get Dataflow Properties

```bash
ITEM_ID="<item-id>"
fab api "workspaces/$WS_ID/items/$ITEM_ID"
```

### Get Dataflow Definition

```bash
fab api -X post "workspaces/$WS_ID/items/$ITEM_ID/getDefinition"
```

Returns `{ definition: { parts: [{ path, payload, payloadType }] } }`. Common parts include `dataflow-content.json`, `.platform`, `queryMetadata.json`, and `mashup.pq`. Payloads are base64-encoded.

Decode a specific part:

```bash
fab api -X post "workspaces/$WS_ID/items/$ITEM_ID/getDefinition" \
  -q "definition.parts[?path=='dataflow-content.json'].payload | [0]" \
  | base64 -d | jq .
```

### Create Dataflow

Create a dataflow with metadata only (define content in the UI or via update):

```bash
fab api -X post "workspaces/$WS_ID/items" -i '{
  "displayName": "New Dataflow",
  "description": "ETL pipeline for sales data",
  "type": "Dataflow"
}'
```

Create with an inline definition by including `definition.parts[]` containing a base64-encoded `dataflow-content.json`. The mashup document holds Power Query M code, host properties, and connection overrides.

### Update Properties

```bash
fab api -X patch "workspaces/$WS_ID/items/$ITEM_ID" -i '{
  "displayName": "Renamed Dataflow",
  "description": "Updated description"
}'
```

### Update Definition

Push a new definition (Power Query M, connections, destinations):

```bash
fab api -X post "workspaces/$WS_ID/items/$ITEM_ID/updateDefinition" -i '{
  "definition": {
    "parts": [
      {
        "path": "dataflow-content.json",
        "payload": "<base64-encoded-content>",
        "payloadType": "InlineBase64"
      }
    ]
  }
}'
```

After updating the definition, a Publish job must run before the new definition takes effect on refresh.

### Delete Dataflow

```bash
fab api -X delete "workspaces/$WS_ID/items/$ITEM_ID"
```

### Trigger Publish Job

Publish validates and activates a definition change. Run this after any definition update and before triggering a refresh.

```bash
fab api -X post "workspaces/$WS_ID/items/$ITEM_ID/jobs/instances?jobType=Publish"
```

Returns `202 Accepted` with a job instance object containing `jobInstanceId` and `status`.

### Trigger Refresh Job

```bash
fab api -X post "workspaces/$WS_ID/items/$ITEM_ID/jobs/instances?jobType=Refresh"
```

Returns `202 Accepted`. The response includes `jobInstanceId` for monitoring.

### Monitor Job Instance

```bash
JOB_ID="<job-instance-id>"
fab api "workspaces/$WS_ID/items/$ITEM_ID/jobs/instances/$JOB_ID"
```

Returns job metadata: `id`, `itemId`, `jobType`, `invokeType`, `status`, `rootActivityId`, `startTimeUtc`, `endTimeUtc`, `failureReason`.

Status progression: `Accepted` -> `Running` -> `Completed` or `Failed`.

### Cancel Job Instance

```bash
fab api -X post "workspaces/$WS_ID/items/$ITEM_ID/jobs/instances/$JOB_ID/cancel"
```

Returns a `Location` header and `Retry-After: 60`.

---

## Gen2 Lifecycle

The Gen2 dataflow lifecycle follows three stages:

1. **Definition** -- Create or update the dataflow content (Power Query M, connections, destinations)
2. **Publish** -- Validate and activate the definition via a Publish job
3. **Refresh** -- Execute the ETL via a Refresh job

This differs from Gen1, where calling the refresh endpoint directly is sufficient. In Gen2, skipping the Publish step after a definition change causes the refresh to run against the previous definition.

---

## Common Workflows

### Gen1: Trigger and Monitor Refresh

```bash
WS_ID="<workspace-id>"
DF_ID="<dataflow-id>"

# 1. Trigger
fab api -A powerbi -X post "groups/$WS_ID/dataflows/$DF_ID/refreshes" -i '{
  "notifyOption": "NoNotification"
}'

# 2. Poll transactions for latest status
fab api -A powerbi "groups/$WS_ID/dataflows/$DF_ID/transactions" \
  -q "value | sort_by(@, &startTime) | [-1]"

# 3. Cancel if needed (use transactionId from step 2)
TX_ID="<transaction-id>"
fab api -A powerbi -X post "groups/$WS_ID/dataflows/transactions/$TX_ID/cancel"
```

Gen1 does not return a transaction ID from the trigger call. Poll the transactions endpoint and sort by `startTime` to find the latest entry. Match on `refreshType: "OnDemand"` if multiple entries exist.

### Gen2: Trigger and Monitor Refresh

```bash
WS_ID="<workspace-id>"
ITEM_ID="<item-id>"

# 1. Trigger -- capture jobInstanceId from response
fab api -X post "workspaces/$WS_ID/items/$ITEM_ID/jobs/instances?jobType=Refresh" \
  -q "id"

# 2. Poll job instance directly
JOB_ID="<job-instance-id>"
fab api "workspaces/$WS_ID/items/$ITEM_ID/jobs/instances/$JOB_ID"

# 3. Cancel if needed
fab api -X post "workspaces/$WS_ID/items/$ITEM_ID/jobs/instances/$JOB_ID/cancel"
```

Gen2 returns a `jobInstanceId` in the trigger response, enabling deterministic polling without timestamp sorting.

### Gen2: Update Definition, Publish, and Refresh

```bash
# 1. Push new definition
fab api -X post "workspaces/$WS_ID/items/$ITEM_ID/updateDefinition" -i '{
  "definition": {
    "parts": [
      {
        "path": "dataflow-content.json",
        "payload": "<base64>",
        "payloadType": "InlineBase64"
      }
    ]
  }
}'

# 2. Publish
fab api -X post "workspaces/$WS_ID/items/$ITEM_ID/jobs/instances?jobType=Publish" -q "id"

# 3. Wait for publish to complete, then refresh
PUBLISH_JOB="<publish-job-id>"
fab api "workspaces/$WS_ID/items/$ITEM_ID/jobs/instances/$PUBLISH_JOB"
# When status is "Completed":
fab api -X post "workspaces/$WS_ID/items/$ITEM_ID/jobs/instances?jobType=Refresh"
```

---

## Admin Endpoints

### Gen1 Admin: Tenant-Wide Inventory

All Gen1 admin endpoints require the Fabric Admin role or a service principal with `Tenant.Read.All` / `Tenant.ReadWrite.All`. Rate limit: 200 requests per hour.

List all Gen1 dataflows across the tenant:

```bash
fab api -A powerbi "admin/dataflows?\$top=5000"
```

Paginate with `$skip`:

```bash
fab api -A powerbi "admin/dataflows?\$top=5000&\$skip=5000"
```

List dataflows in a specific workspace (admin context):

```bash
fab api -A powerbi "admin/groups/$WS_ID/dataflows"
```

### Gen1 Admin: Dataflow Audit

Retrieve data sources, users, definition, and upstream dependencies without workspace membership:

```bash
DF_ID="<dataflow-id>"

# Data sources
fab api -A powerbi "admin/dataflows/$DF_ID/datasources"

# Access permissions
fab api -A powerbi "admin/dataflows/$DF_ID/users"

# Full definition export
fab api -A powerbi "admin/dataflows/$DF_ID/export"

# Upstream dependencies (requires workspace ID)
fab api -A powerbi "admin/groups/$WS_ID/dataflows/$DF_ID/upstreamDataflows"
```

The users endpoint returns `dataflowUserAccessRight` values: `None`, `Read`, `ReadWrite`, `ReadReshare`, `Owner`.

Note: The datasources admin endpoint may return deleted data sources in the response.

### Gen2 Admin: Fabric Item APIs

Gen2 dataflows appear as Fabric items. Use the generic admin item endpoints:

```bash
fab api "admin/workspaces/$WS_ID/items?type=Dataflow"
```

---

## Permissions

### Gen1 Scopes

| Operation | Required Scope |
|---|---|
| List, get, datasources, transactions, upstream | `Dataflow.Read.All` or `Dataflow.ReadWrite.All` |
| Delete, update, refresh, cancel, schedule | `Dataflow.ReadWrite.All` |
| All admin endpoints | `Tenant.Read.All` or `Tenant.ReadWrite.All` |

### Gen2 Scopes

Gen2 dataflows use Fabric item-level scopes: `Workspace.ReadWrite.All` or `Item.ReadWrite.All`.

---

## Limitations

### Gen1

- `MailOnCompletion` notification is not supported -- only `NoNotification` and `MailOnFailure`
- Computed and linked entities require Premium capacity
- DirectQuery via the dataflow connector requires Premium capacity
- No native Git integration or Monitoring Hub support
- Refresh triggers return no transaction ID; identify the active transaction by polling and sorting by timestamp

### Gen2

- Service principal authentication is not currently supported for Gen2 dataflow APIs
- `Get Item` and `List Item Access Details` may not return correct information when filtering on the Dataflow type
- The Publish job must complete before a Refresh job reflects definition changes
- Gen2 notifications are not available via the API -- use the Monitoring Hub instead
- Check current documentation for updates on Run API reliability; earlier previews had limitations where triggered runs would accept but not execute
