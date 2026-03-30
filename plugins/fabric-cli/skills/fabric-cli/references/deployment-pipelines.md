# Deployment Pipelines

Two API surfaces exist for deployment pipelines. The **Fabric REST API** (default audience) supports all Fabric and Power BI item types. The **Power BI REST API** (`-A powerbi`) supports Power BI items only but exposes additional deploy options not available in the Fabric API.

## API Surface Summary

| Aspect | Fabric API (default) | Power BI API (`-A powerbi`) |
|---|---|---|
| Endpoint prefix | `deploymentPipelines` | `pipelines` |
| Item scope | All Fabric + Power BI items | Power BI only (reports, dashboards, semantic models, dataflows, datamarts) |
| Stage addressing | Stage UUID | Stage order integer (0 = Dev, 1 = Test, 2 = Prod) |
| Deploy endpoint | Single `deploy` | Separate `deployAll` and `deploy` (selective) |
| Extra deploy options | `allowCrossRegionDeployment` only | `allowPurgeData`, `allowTakeOver`, `allowSkipTilesWithMissingPrerequisites`, `allowOverwriteArtifact`, `allowCreateArtifact`, `allowOverwriteTargetArtifactLabel` |

**When to use which:**

- Default to the Fabric API for all new automation -- it covers Fabric items (Lakehouse, Notebook, Warehouse, etc.) and Power BI items alike.
- Fall back to the Power BI API only when per-item deploy options (`allowPurgeData`, `allowTakeOver`, `allowSkipTilesWithMissingPrerequisites`) or `updateAppSettings` are required.

---

## Pipeline CRUD

### List Pipelines

```bash
# Fabric API -- returns all pipelines the caller has access to
fab api "deploymentPipelines" -q "value[].{name: displayName, id: id}"

# Power BI API
fab api -A powerbi "pipelines" -q "value[].{name: displayName, id: id}"

# Admin -- all pipelines in tenant (Power BI API)
fab api -A powerbi "admin/pipelines" -q "value[].{name: displayName, id: id}"
```

### Get a Single Pipeline

```bash
PIPELINE_ID="<pipeline-id>"

# Fabric API -- includes stages array with workspace assignments
fab api "deploymentPipelines/$PIPELINE_ID"

# Power BI API
fab api -A powerbi "pipelines/$PIPELINE_ID"
```

### Create a Pipeline

Stages are defined at creation time. The count (2--10) and order are permanent after creation; only `displayName`, `description`, and `isPublic` on individual stages can be updated later.

```bash
fab api -X post "deploymentPipelines" -i '{
  "displayName": "Sales Pipeline",
  "description": "Dev -> Test -> Prod for sales reports",
  "stages": [
    { "displayName": "Development", "isPublic": false },
    { "displayName": "Test", "isPublic": false },
    { "displayName": "Production", "isPublic": true }
  ]
}'
```

Response (201) includes the full pipeline object with stage IDs and order numbers. Capture the pipeline ID and stage IDs for subsequent calls.

### Update Pipeline Metadata

```bash
fab api -X patch "deploymentPipelines/$PIPELINE_ID" -i '{
  "displayName": "Renamed Pipeline",
  "description": "Updated description"
}'
```

### Delete a Pipeline

Deletion fails if an active deployment operation is in progress.

```bash
fab api -X delete "deploymentPipelines/$PIPELINE_ID"
```

---

## Stage Management

### List Stages

```bash
# Fabric API -- returns stage IDs, order, names, workspace assignments
fab api "deploymentPipelines/$PIPELINE_ID/stages" \
  -q "value[].{id: id, order: order, name: displayName, workspaceId: workspaceId}"

# Power BI API -- stages referenced by order integer
fab api -A powerbi "pipelines/$PIPELINE_ID/stages"
```

### Get a Single Stage

```bash
STAGE_ID="<stage-id>"
fab api "deploymentPipelines/$PIPELINE_ID/stages/$STAGE_ID"
```

### Update Stage Properties

```bash
fab api -X patch "deploymentPipelines/$PIPELINE_ID/stages/$STAGE_ID" -i '{
  "description": "Updated stage description",
  "isPublic": true
}'
```

### Assign a Workspace to a Stage

Requirements:
- The stage must not already have an assigned workspace.
- The workspace must not be assigned to any other pipeline stage.
- Caller must be Admin on the pipeline AND Admin on the workspace.

```bash
fab api -X post "deploymentPipelines/$PIPELINE_ID/stages/$STAGE_ID/assignWorkspace" \
  -i '{"workspaceId": "<workspace-id>"}'
```

### Unassign a Workspace from a Stage

Fails if a deployment is in progress.

```bash
fab api -X post "deploymentPipelines/$PIPELINE_ID/stages/$STAGE_ID/unassignWorkspace"
```

### List Items in a Stage

```bash
fab api "deploymentPipelines/$PIPELINE_ID/stages/$STAGE_ID/items" \
  -q "value[].{name: itemDisplayName, type: itemType, id: itemId}"
```

Response includes `sourceItemId`, `targetItemId`, and `lastDeploymentTime` for each item when available.

---

## Deploying Content

Deployment is the core operation. The Fabric API uses a single `deploy` endpoint for both full and selective deployments; the Power BI API uses separate `deployAll` and `deploy` endpoints.

### Full Deploy (All Items) -- Fabric API

To deploy all items from one stage to another, omit the `items` array:

```bash
SOURCE_STAGE="<source-stage-id>"
TARGET_STAGE="<target-stage-id>"

fab api -X post "deploymentPipelines/$PIPELINE_ID/deploy" -i "{
  \"sourceStageId\": \"$SOURCE_STAGE\",
  \"targetStageId\": \"$TARGET_STAGE\",
  \"note\": \"Full deployment from dev to test\"
}"
```

Response: 202 Accepted. The `x-ms-operation-id` and `Location` headers contain the operation ID for status polling.

### Selective Deploy (Specific Items) -- Fabric API

To deploy specific items, include the `items` array with `sourceItemId` and `itemType` for each:

```bash
fab api -X post "deploymentPipelines/$PIPELINE_ID/deploy" -i "{
  \"sourceStageId\": \"$SOURCE_STAGE\",
  \"targetStageId\": \"$TARGET_STAGE\",
  \"items\": [
    { \"sourceItemId\": \"<semantic-model-id>\", \"itemType\": \"SemanticModel\" },
    { \"sourceItemId\": \"<report-id>\", \"itemType\": \"Report\" }
  ],
  \"note\": \"Selective deploy -- model and report only\"
}"
```

Maximum 300 items per request.

### Deploy to an Empty Stage (New Workspace)

When the target stage has no workspace assigned, provide `createdWorkspaceDetails` to create one:

```bash
fab api -X post "deploymentPipelines/$PIPELINE_ID/deploy" -i "{
  \"sourceStageId\": \"$SOURCE_STAGE\",
  \"targetStageId\": \"$TARGET_STAGE\",
  \"createdWorkspaceDetails\": {
    \"name\": \"Sales-Prod-Workspace\",
    \"capacityId\": \"<capacity-id>\"
  },
  \"note\": \"Initial deployment to prod\"
}"
```

The `capacityId` is optional; if omitted, the service auto-selects a capacity.

### Deploy with Cross-Region Option -- Fabric API

```bash
fab api -X post "deploymentPipelines/$PIPELINE_ID/deploy" -i "{
  \"sourceStageId\": \"$SOURCE_STAGE\",
  \"targetStageId\": \"$TARGET_STAGE\",
  \"options\": { \"allowCrossRegionDeployment\": true },
  \"note\": \"Cross-region deploy\"
}"
```

### Full Deploy -- Power BI API

Use the Power BI API when additional deploy options are needed:

```bash
fab api -A powerbi -X post "pipelines/$PIPELINE_ID/deployAll" -i '{
  "sourceStageOrder": 0,
  "options": {
    "allowOverwriteArtifact": true,
    "allowCreateArtifact": true,
    "allowPurgeData": false,
    "allowTakeOver": false,
    "allowSkipTilesWithMissingPrerequisites": false
  },
  "updateAppSettings": {
    "updateAppInTargetWorkspace": true
  },
  "note": "Deploy all from dev"
}'
```

### Selective Deploy -- Power BI API

Items are specified in typed arrays (`datasets`, `reports`, `dashboards`, `dataflows`, `datamarts`). Per-item `options` override the global `options`:

```bash
fab api -A powerbi -X post "pipelines/$PIPELINE_ID/deploy" -i '{
  "sourceStageOrder": 0,
  "datasets": [
    { "sourceId": "<dataset-id>", "options": { "allowOverwriteArtifact": true } }
  ],
  "reports": [
    { "sourceId": "<report-id>" }
  ],
  "options": {
    "allowCreateArtifact": true,
    "allowOverwriteArtifact": true
  },
  "note": "Selective deploy via PBI API"
}'
```

---

## Checking Deployment Status

Deployments are long-running operations (LRO). After a deploy call returns 202, poll for completion.

### Generic LRO Polling (Fabric API)

```bash
OPERATION_ID="<operation-id-from-deploy-response>"

# Poll until status is Succeeded or Failed
fab api "operations/$OPERATION_ID"
```

Response:

```json
{
  "status": "Running",
  "createdTimeUtc": "2026-03-28T10:00:00Z",
  "lastUpdatedTimeUtc": "2026-03-28T10:01:30Z",
  "percentComplete": 45
}
```

Status values: `Undefined`, `NotStarted`, `Running`, `Succeeded`, `Failed`.

### Detailed Operation Info (Pipeline-Specific)

For execution plan details including per-step status and error information:

```bash
fab api "deploymentPipelines/$PIPELINE_ID/operations/$OPERATION_ID"
```

Response includes:

- `status` -- overall operation status
- `executionPlan.steps[]` -- each step with `description`, `status`, `preDeploymentDiffState` (`New`, `Different`, `NoDifference`), item mapping, and any `error`
- `preDeploymentDiffInformation` -- counts of new, different, and unchanged items
- `note` -- deployment note
- `performedBy` -- identity that triggered the deploy

### List Recent Operations

Returns up to 20 most recent operations for a pipeline:

```bash
fab api "deploymentPipelines/$PIPELINE_ID/operations" \
  -q "value[].{id: id, status: status, type: type, time: executionStartTime}"

# Power BI API
fab api -A powerbi "pipelines/$PIPELINE_ID/operations"
```

### LRO Result

Available for 24 hours after completion:

```bash
fab api "operations/$OPERATION_ID/result"
```

---

## Role and User Management

### Fabric API -- Role Assignments

The Fabric API uses RBAC-style role assignments. Currently only the `Admin` role exists.

```bash
# List role assignments
fab api "deploymentPipelines/$PIPELINE_ID/roleAssignments"

# Add a user as Admin
fab api -X post "deploymentPipelines/$PIPELINE_ID/roleAssignments" -i '{
  "principal": { "id": "<user-object-id>", "type": "User" },
  "role": "Admin"
}'

# Add a service principal as Admin
fab api -X post "deploymentPipelines/$PIPELINE_ID/roleAssignments" -i '{
  "principal": { "id": "<sp-object-id>", "type": "ServicePrincipal" },
  "role": "Admin"
}'

# Add a group as Admin
fab api -X post "deploymentPipelines/$PIPELINE_ID/roleAssignments" -i '{
  "principal": { "id": "<group-object-id>", "type": "Group" },
  "role": "Admin"
}'

# Delete a role assignment
ROLE_ASSIGNMENT_ID="<role-assignment-id>"
fab api -X delete "deploymentPipelines/$PIPELINE_ID/roleAssignments/$ROLE_ASSIGNMENT_ID"
```

### Power BI API -- User Management

```bash
# List pipeline users
fab api -A powerbi "pipelines/$PIPELINE_ID/users"

# Add user
fab api -A powerbi -X post "pipelines/$PIPELINE_ID/users" -i '{
  "identifier": "user@domain.com",
  "accessRight": "Admin",
  "principalType": "User"
}'

# Remove user
fab api -A powerbi -X delete "pipelines/$PIPELINE_ID/users/<user-identifier>"
```

---

## Common Workflows

### Full Pipeline Setup (Dev to Test to Prod)

```bash
# 1. Create the pipeline
fab api -X post "deploymentPipelines" -i '{
  "displayName": "Sales Pipeline",
  "stages": [
    { "displayName": "Development" },
    { "displayName": "Test" },
    { "displayName": "Production" }
  ]
}'
# Capture PIPELINE_ID, DEV_STAGE_ID, TEST_STAGE_ID, PROD_STAGE_ID from response

# 2. Assign workspaces to each stage
fab api -X post "deploymentPipelines/$PIPELINE_ID/stages/$DEV_STAGE_ID/assignWorkspace" \
  -i '{"workspaceId": "<dev-workspace-id>"}'

fab api -X post "deploymentPipelines/$PIPELINE_ID/stages/$TEST_STAGE_ID/assignWorkspace" \
  -i '{"workspaceId": "<test-workspace-id>"}'

fab api -X post "deploymentPipelines/$PIPELINE_ID/stages/$PROD_STAGE_ID/assignWorkspace" \
  -i '{"workspaceId": "<prod-workspace-id>"}'

# 3. Deploy dev to test
fab api -X post "deploymentPipelines/$PIPELINE_ID/deploy" -i "{
  \"sourceStageId\": \"$DEV_STAGE_ID\",
  \"targetStageId\": \"$TEST_STAGE_ID\",
  \"note\": \"Initial deploy to test\"
}"

# 4. Poll until complete
fab api "operations/$OPERATION_ID"

# 5. Deploy test to prod
fab api -X post "deploymentPipelines/$PIPELINE_ID/deploy" -i "{
  \"sourceStageId\": \"$TEST_STAGE_ID\",
  \"targetStageId\": \"$PROD_STAGE_ID\",
  \"note\": \"Promote to production\"
}"

# 6. Poll until complete
fab api "operations/$OPERATION_ID"
```

### Selective Deploy Workflow

```bash
# 1. List items in the source stage
fab api "deploymentPipelines/$PIPELINE_ID/stages/$DEV_STAGE_ID/items" \
  -q "value[].{name: itemDisplayName, type: itemType, id: itemId}"

# 2. Deploy only the items that changed
fab api -X post "deploymentPipelines/$PIPELINE_ID/deploy" -i "{
  \"sourceStageId\": \"$DEV_STAGE_ID\",
  \"targetStageId\": \"$TEST_STAGE_ID\",
  \"items\": [
    { \"sourceItemId\": \"<model-id>\", \"itemType\": \"SemanticModel\" },
    { \"sourceItemId\": \"<report-id>\", \"itemType\": \"Report\" }
  ],
  \"note\": \"Selective deploy -- model + report\"
}"

# 3. Check detailed execution plan
fab api "deploymentPipelines/$PIPELINE_ID/operations/$OPERATION_ID" \
  -q "executionPlan.steps[].{step: description, status: status, diff: preDeploymentDiffState}"
```

### CI/CD Automation with Service Principal

```bash
# Prerequisites:
# - Fabric admin has enabled "Service principals can create workspaces, connections,
#   and deployment pipelines"
# - Service principal has Admin role on the pipeline
# - Service principal has Contributor role on source and target workspaces

# 1. Find pipeline by name
PIPELINE_ID=$(fab api "deploymentPipelines" \
  -q "value[?displayName=='Sales Pipeline'].id | [0]" | tr -d '"')

# 2. Get stage IDs
DEV_STAGE=$(fab api "deploymentPipelines/$PIPELINE_ID/stages" \
  -q "value[?order==\`0\`].id | [0]" | tr -d '"')
TEST_STAGE=$(fab api "deploymentPipelines/$PIPELINE_ID/stages" \
  -q "value[?order==\`1\`].id | [0]" | tr -d '"')

# 3. Deploy
fab api -X post "deploymentPipelines/$PIPELINE_ID/deploy" -i "{
  \"sourceStageId\": \"$DEV_STAGE\",
  \"targetStageId\": \"$TEST_STAGE\",
  \"note\": \"Automated CI/CD deploy\"
}"

# 4. Poll LRO
while true; do
  STATUS=$(fab api "operations/$OPERATION_ID" -q "status" | tr -d '"')
  echo "Status: $STATUS"
  [ "$STATUS" = "Succeeded" ] || [ "$STATUS" = "Failed" ] && break
  sleep 30
done

# 5. On failure, inspect errors
fab api "deploymentPipelines/$PIPELINE_ID/operations/$OPERATION_ID" \
  -q "executionPlan.steps[?status=='Failed'].{step: description, error: error}"
```

---

## Permissions Summary

### Required Scopes (Delegated)

| Action | Scope |
|---|---|
| Read pipelines, stages, items, operations | `Pipeline.Read.All` or `Pipeline.ReadWrite.All` |
| Create, update, delete pipelines | `Pipeline.ReadWrite.All` |
| Assign / unassign workspace | `Pipeline.ReadWrite.All` + `Workspace.ReadWrite.All` |
| Deploy content | `Pipeline.Deploy` |
| Manage role assignments | `Pipeline.ReadWrite.All` |

### Permission Matrix

| Action | Pipeline Role | Workspace Role |
|---|---|---|
| View pipeline | Admin | -- |
| Create pipeline | Licensed user (Pro/PPU/Premium) | -- |
| Delete pipeline | Admin | -- |
| Assign workspace | Admin | Workspace Admin |
| Unassign workspace | Admin | -- |
| Deploy to empty stage | Admin | Contributor on source |
| Deploy to existing stage | Admin | Contributor on source AND target |
| View stage items | Admin | Reader+ on stage workspace |

### Identity Support

- User principals, service principals, managed identities, and service principal profiles are all supported across all endpoints.
- Service principal automation requires the Fabric admin setting "Service principals can create workspaces, connections, and deployment pipelines" to be enabled.

---

## Supported Item Types (Fabric API)

The Fabric API `deploy` endpoint supports the `itemType` values:

`Dashboard`, `Report`, `SemanticModel`, `PaginatedReport`, `Datamart`, `Lakehouse`, `Eventhouse`, `Environment`, `KQLDatabase`, `KQLQueryset`, `KQLDashboard`, `DataPipeline`, `Notebook`, `SparkJobDefinition`, `MLExperiment`, `MLModel`, `Warehouse`, `Eventstream`, `SQLEndpoint`, `MirroredWarehouse`, `MirroredDatabase`, `Reflex`, `GraphQLApi`, `SQLDatabase`, `CopyJob`, `VariableLibrary`, `Dataflow`

The Power BI API selective deploy accepts items in typed arrays: `datasets`, `reports`, `dashboards`, `dataflows`, `datamarts`.

---

## Limitations and Gotchas

- **Max 300 items** per deploy request.
- **Stage count is permanent** -- the number of stages (2--10) and their order cannot be changed after pipeline creation.
- **No concurrent deployments** -- a pipeline cannot accept a new deploy while one is in progress. Delete also fails during active deployment.
- **Backward deployment** -- only works when the target stage is empty (Fabric API). The Power BI API has an explicit `isBackwardDeployment` flag.
- **Data is NOT copied** -- deployment copies definitions only. Semantic models must be refreshed after deployment to populate data.
- **Item identity preserved** -- item IDs, URLs, and permissions in the target stage remain unchanged on overwrite.
- **Gateway mappings** -- not automatically configured after initial deployment. Manual or scripted configuration is required.
- **Fabric API gaps** -- `allowPurgeData`, `allowTakeOver`, `allowSkipTilesWithMissingPrerequisites`, and `updateAppSettings` are only available in the Power BI API. To use them, fall back to `fab api -A powerbi`.
- **Dataflows** -- currently better supported via the Power BI API for some deployment scenarios.
- **Empty folders** -- cannot be deployed. Only folders containing items are included.
- **Folder hierarchy** -- updated during deployment, not during workspace assignment.
- **LRO results** -- available for 24 hours after operation completion; fetch them promptly for audit purposes.
- **PBIR reports** -- the Microsoft docs claim PBIR is unsupported, but PBIR reports deploy successfully (verified March 2026).
- **Sensitivity labels** -- only copied on first deployment or when the source has a protected label and target does not.
- **Semantic model ownership** -- first deployment transfers ownership to the deployer; subsequent deployments leave ownership unchanged.
- **Direct Lake semantic models** -- do not autobind to target-stage lakehouses after deployment. Use datasource rules to rebind manually.
- **Incremental refresh** -- partitions and data are preserved during deployment; the refresh policy is copied. Settings are not copied for Gen1 dataflows.

---

## Content Lifecycle Management Patterns

Deployment pipelines are one component of a broader content lifecycle management strategy. The patterns below are drawn from Microsoft's Power BI implementation planning guidance and describe how deployment pipelines fit into workspace planning, environment separation, and CI/CD workflows.

### The Content Lifecycle

Power BI content follows six stages: plan/design, develop, validate, deploy, support/monitor, retire/archive. Deployment pipelines primarily serve stage 4 (deploy) and partially stage 3 (validate, by comparing stages).

### Workspace Strategy

Separate workspaces by environment (dev/test/prod) and optionally by item type (data workspaces vs reporting workspaces). Each workspace maps to one deployment pipeline stage.

**Single pipeline (most common):**

All content in one workspace per stage. One deployment pipeline handles everything.

```
Dev Workspace  -->  Test Workspace  -->  Prod Workspace
     [stage 0]          [stage 1]          [stage 2]
```

**Multiple pipelines (separated by item type):**

Data items (semantic models, lakehouses) in one pipeline, reporting items (reports, dashboards) in another. Use auto-binding across pipelines to maintain connections between items in the same stage.

```
Pipeline A (Data):     Dev-Data  -->  Test-Data  -->  Prod-Data
Pipeline B (Reports):  Dev-Rpt   -->  Test-Rpt   -->  Prod-Rpt
                         |               |               |
                    auto-binds      auto-binds      auto-binds
```

When separating workspaces this way, deploy the data pipeline first, then the reporting pipeline, so that reports bind to the correct semantic models in the target stage.

### Auto-Binding Behavior

Deployment pipelines automatically reconnect deployed items to their dependencies in the target stage. This works within a pipeline and across pipelines (if both have the same number of stages).

**When auto-binding is undesirable** (e.g., all reports should always point to the production semantic model regardless of pipeline stage):

- Do not connect the items in the same stage
- Use parameter rules to control the connection
- Use a proxy semantic model not connected to any pipeline

### Deployment Rules

Configure different settings per stage. Common use cases:

- **Data source rules** -- dev stage points to dev database, production stage points to production database
- **Parameter rules** -- change connection strings, feature flags, or config values per stage

Set rules via the Fabric portal or the REST API. The deployer must be the item owner and at least a contributor on the target workspace.

### Deployment Approaches

Five approaches exist for deploying content, ranging from simple to advanced:

| Approach | Complexity | Best For |
|----------|-----------|----------|
| **Publish from Power BI Desktop** | Simplest | Self-service creators, manual control |
| **Publish via XMLA endpoint** | Moderate | Tabular Editor users, semantic model-only |
| **OneDrive refresh** | Moderate | Self-service, .pbix version control |
| **Fabric Git integration** | Advanced | Azure DevOps/GitHub users, .pbip files, Fabric capacity |
| **Azure Pipelines (CI/CD)** | Most advanced | Enterprise teams, full automation, custom testing |

For Fabric Git integration, the typical pattern is:
- `dev` branch syncs to dev workspace
- Pull request merges `dev` into `test` branch (syncs to test workspace)
- Pull request merges `test` into `main` branch (syncs to production workspace)

This approach and deployment pipelines are complementary -- Git handles source control and code review, deployment pipelines handle the actual promotion between workspaces.

### Post-Deployment Activities

Deployment copies definitions only. After deploying to a new stage, handle these manually or via automation:

1. **Refresh semantic models** -- data is not copied during deployment
2. **Configure data source credentials** -- credentials are not copied between stages
3. **Set up gateway mappings** -- not automatic after initial deployment
4. **Configure scheduled refresh** -- refresh schedules are not copied
5. **Update Power BI app** -- deployment does not auto-publish the workspace app; re-publish manually or via the Power BI API
6. **Set role assignments** -- RLS role members are not copied
7. **Update endorsement settings** -- not copied during deployment

Automate post-deployment tasks with the Power BI REST APIs. For example, after deploying to production:

```bash
# Trigger a full refresh of the deployed semantic model
MODEL_ID=$(fab get "Prod.Workspace/Sales.SemanticModel" -q "id" | tr -d '"')
WS_ID=$(fab get "Prod.Workspace" -q "id" | tr -d '"')
fab api -A powerbi -X post "groups/$WS_ID/datasets/$MODEL_ID/refreshes" -i '{"type":"Full"}'
```

### Environment Isolation

| Property | Copied During Deployment | Must Configure Per Stage |
|----------|-------------------------|--------------------------|
| Item definitions (visuals, pages, model metadata) | Yes | -- |
| Data source connections | Yes (with deployment rules) | Set rules per stage |
| Parameters | Yes (with deployment rules) | Set rules per stage |
| Data | No | Refresh after deployment |
| Credentials | No | Configure per stage |
| Scheduled refresh | No | Configure per stage |
| Gateway mappings | No | Configure after first deployment |
| RLS role members | No | Assign per stage |
| Item permissions | No | Manage per stage |
| Sensitivity labels | Conditional (see limitations) | May need manual assignment |
| Workspace settings | No | Each stage has its own workspace |
| App content and settings | No | Re-publish app per stage |

### Review and Governance

- **Deployment history** -- review regularly via portal or API (`fab api "deploymentPipelines/<id>/operations"`) to identify unapproved deployments or failures
- **Release approvals** -- when using Azure Pipelines, configure release approvals so that test and production deployments require explicit sign-off from a release manager
- **Stage comparison** -- compare stages before deploying to understand what will change (`fab api "deploymentPipelines/<id>/stages/<stageId>/items"`)
- **Restrict pipeline access** -- grant pipeline admin only to release managers or technical owners, not all content creators
- **Single-direction deployment** -- always deploy dev -> test -> prod; avoid making changes directly in later stages
