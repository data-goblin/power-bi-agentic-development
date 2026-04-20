# Deployment Pipelines

`fab` has no first-class deployment pipeline commands; all operations go through `fab api`. Two API surfaces coexist:

| Aspect | Fabric API (default) | Power BI API (`-A powerbi`) |
|---|---|---|
| Endpoint prefix | `deploymentPipelines` | `pipelines` |
| Item scope | All Fabric + Power BI items | Power BI items only (reports, dashboards, semantic models, dataflows, datamarts) |
| Stage addressing | Stage UUID | Stage order integer (0 = first stage) |
| Deploy endpoints | Single `deploy` (full or selective) | Separate `deployAll` and `deploy` (selective) |
| Extra deploy options | `allowCrossRegionDeployment` | `allowPurgeData`, `allowTakeOver`, `allowSkipTilesWithMissingPrerequisites`, `allowOverwriteArtifact`, `allowCreateArtifact`, `allowOverwriteTargetArtifactLabel`, `updateAppSettings` |
| Role model | RBAC role assignments (`Admin` only) | `users` endpoint with `accessRight` |

**When to use which:**

- Default to the Fabric API; it covers Fabric items (Lakehouse, Notebook, Warehouse, etc.) and Power BI items alike.
- Fall back to the Power BI API only when you need per-item deploy options (`allowPurgeData`, `allowTakeOver`, `allowSkipTilesWithMissingPrerequisites`) or want to refresh the workspace app via `updateAppSettings`.

---

## Command reference

| Command | Purpose | Example |
|---|---|---|
| `fab api "deploymentPipelines"` | List pipelines | `fab api "deploymentPipelines" -q "value[].{name:displayName,id:id}"` |
| `fab api "deploymentPipelines/<id>"` | Get pipeline + stages | `fab api "deploymentPipelines/$PIPELINE_ID"` |
| `fab api -X post "deploymentPipelines"` | Create pipeline | see [Create](#create-a-pipeline) |
| `fab api -X patch "deploymentPipelines/<id>"` | Rename / describe | see [Update](#update-pipeline-metadata) |
| `fab api -X delete "deploymentPipelines/<id>"` | Delete pipeline | `fab api -X delete "deploymentPipelines/$PIPELINE_ID"` |
| `fab api ".../stages"` | List stages | `fab api "deploymentPipelines/$PIPELINE_ID/stages"` |
| `fab api -X post ".../assignWorkspace"` | Assign workspace | see [Assign](#assign-a-workspace-to-a-stage) |
| `fab api -X post ".../unassignWorkspace"` | Unassign workspace | see [Unassign](#unassign-a-workspace-from-a-stage) |
| `fab api ".../stages/<id>/items"` | List items in stage | `fab api "deploymentPipelines/$PIPELINE_ID/stages/$STAGE_ID/items"` |
| `fab api -X post ".../deploy"` | Promote content | see [Deploying](#deploying-content) |
| `fab api ".../operations"` | Deployment history | `fab api "deploymentPipelines/$PIPELINE_ID/operations"` |
| `fab api "operations/<op-id>"` | Poll LRO status | `fab api "operations/$OPERATION_ID"` |
| `fab api ".../roleAssignments"` | Pipeline access | see [Access](#access-management) |

Flags (common):

- `-X post|patch|delete` (HTTP method)
- `-i '<json>'` (request body; pass a file path for larger payloads)
- `-q "<jmespath>"` (filter response)
- `-A powerbi` (switch to Power BI API surface)
- `--show_headers` (surface `x-ms-operation-id` and `Location` for LROs)

---

## Pipeline CRUD

### Create a pipeline

Stage count (2...10) and order are locked at creation. Only `displayName`, `description`, and per-stage `isPublic` can change later; stages cannot be added, removed, or reordered after the first request returns.

```bash
fab api -X post "deploymentPipelines" -i '{
  "displayName": "Sales Pipeline",
  "description": "Dev, Test, Prod for sales content",
  "stages": [
    { "displayName": "Development", "isPublic": false },
    { "displayName": "Test",        "isPublic": false },
    { "displayName": "Production",  "isPublic": true  }
  ]
}'
```

Response (201) contains the pipeline ID and the generated stage IDs / order numbers. Capture these before any further calls.

### Read a pipeline

```bash
# Whole pipeline (metadata + stages + workspace assignments)
fab api "deploymentPipelines/$PIPELINE_ID"

# Single stage
fab api "deploymentPipelines/$PIPELINE_ID/stages/$STAGE_ID"

# Find a pipeline by name
PIPELINE_ID=$(fab api "deploymentPipelines" \
  -q "value[?displayName=='Sales Pipeline'].id | [0]" | tr -d '"')

# Stage IDs by order
DEV_STAGE=$(fab api "deploymentPipelines/$PIPELINE_ID/stages" \
  -q "value[?order==\`0\`].id | [0]" | tr -d '"')
```

Admins can list all pipelines in the tenant via the Power BI API: `fab api -A powerbi "admin/pipelines"`.

### Update pipeline metadata

```bash
# Rename / redescribe
fab api -X patch "deploymentPipelines/$PIPELINE_ID" -i '{
  "displayName": "Sales Pipeline (FY27)",
  "description": "Updated for FY27 dataflow split"
}'

# Per-stage edits (isPublic, description)
fab api -X patch "deploymentPipelines/$PIPELINE_ID/stages/$STAGE_ID" -i '{
  "description": "Consumer-facing production stage",
  "isPublic": true
}'
```

To add or remove stages, you must create a new pipeline, reassign workspaces to it, then delete the old one. There is no in-place reshape.

### Delete a pipeline

```bash
fab api -X delete "deploymentPipelines/$PIPELINE_ID"
```

Fails (409) while an operation is in progress. Unassigning all workspaces first is not required but makes intent explicit.

---

## Stage and workspace assignment

### Assign a workspace to a stage

Requirements:

- Stage must not already have an assigned workspace.
- Workspace must not be assigned to any other pipeline stage.
- Caller must be Admin on the pipeline AND Admin on the workspace.

```bash
fab api -X post "deploymentPipelines/$PIPELINE_ID/stages/$STAGE_ID/assignWorkspace" \
  -i '{"workspaceId": "<workspace-id>"}'
```

### Unassign a workspace from a stage

```bash
fab api -X post "deploymentPipelines/$PIPELINE_ID/stages/$STAGE_ID/unassignWorkspace"
```

Fails if a deployment is in progress on that pipeline. Item pairing metadata is dropped; re-assigning a workspace creates a fresh pairing on next compare or deploy.

### Swap a workspace between stages

There is no native "move workspace between stages" operation. To swap, unassign then re-assign:

```bash
# 1. Unassign from the current stage
fab api -X post "deploymentPipelines/$PIPELINE_ID/stages/$OLD_STAGE/unassignWorkspace"

# 2. Assign to the target stage
fab api -X post "deploymentPipelines/$PIPELINE_ID/stages/$NEW_STAGE/assignWorkspace" \
  -i "{\"workspaceId\": \"$WORKSPACE_ID\"}"
```

This resets item pairings for that workspace. Deploying afterwards re-pairs items by type + name + folder path.

### List items in a stage

```bash
fab api "deploymentPipelines/$PIPELINE_ID/stages/$STAGE_ID/items" \
  -q "value[].{name:itemDisplayName, type:itemType, sourceId:sourceItemId, targetId:targetItemId, lastDeployed:lastDeploymentTime}"
```

`sourceItemId` is the item's ID in this stage; `targetItemId` is its paired ID in the next stage (if any). These IDs are what selective deploys reference.

---

## Access management

Two role models coexist. Prefer the Fabric RBAC endpoint; it's the forward direction.

### Fabric RBAC (role assignments)

Only the `Admin` role exists today.

```bash
# List current assignments
fab api "deploymentPipelines/$PIPELINE_ID/roleAssignments"

# Add user
fab api -X post "deploymentPipelines/$PIPELINE_ID/roleAssignments" -i '{
  "principal": { "id": "<user-object-id>", "type": "User" },
  "role": "Admin"
}'

# Add service principal
fab api -X post "deploymentPipelines/$PIPELINE_ID/roleAssignments" -i '{
  "principal": { "id": "<sp-object-id>", "type": "ServicePrincipal" },
  "role": "Admin"
}'

# Add security group (M365 groups are NOT supported)
fab api -X post "deploymentPipelines/$PIPELINE_ID/roleAssignments" -i '{
  "principal": { "id": "<group-object-id>", "type": "Group" },
  "role": "Admin"
}'

# Remove
fab api -X delete "deploymentPipelines/$PIPELINE_ID/roleAssignments/$ROLE_ASSIGNMENT_ID"
```

### Power BI users endpoint

```bash
fab api -A powerbi "pipelines/$PIPELINE_ID/users"

fab api -A powerbi -X post "pipelines/$PIPELINE_ID/users" -i '{
  "identifier":    "user@contoso.com",
  "accessRight":   "Admin",
  "principalType": "User"
}'

fab api -A powerbi -X delete "pipelines/$PIPELINE_ID/users/user@contoso.com"
```

Restrict pipeline admin to release managers and technical owners. Pipeline admin alone grants no access to workspace content; the caller still needs a workspace role to deploy or compare stages.

---

## Deploying content

Deployment is an LRO. The `deploy` endpoint returns `202 Accepted` with `x-ms-operation-id` and `Location` headers; use those to poll.

### Full deploy (all items)

Omit the `items` array to push everything from source to target.

```bash
fab api -X post "deploymentPipelines/$PIPELINE_ID/deploy" -i "{
  \"sourceStageId\": \"$SOURCE_STAGE\",
  \"targetStageId\": \"$TARGET_STAGE\",
  \"note\":          \"Full promote Dev to Test\"
}" --show_headers
```

### Selective deploy (individual items)

Promote one or a handful of items; the Fabric API flattens them into a single array. Max 300 items per request.

```bash
fab api -X post "deploymentPipelines/$PIPELINE_ID/deploy" -i "{
  \"sourceStageId\": \"$SOURCE_STAGE\",
  \"targetStageId\": \"$TARGET_STAGE\",
  \"items\": [
    { \"sourceItemId\": \"<semantic-model-id>\", \"itemType\": \"SemanticModel\" },
    { \"sourceItemId\": \"<report-id>\",         \"itemType\": \"Report\" }
  ],
  \"note\": \"Selective; model + single report\"
}"
```

Pick `sourceItemId` values from `stages/<id>/items`. Dependent items must already exist in the target stage or be included in the same call; otherwise the deployment fails. There is no `selectRelated` flag via the API; you have to resolve dependencies yourself.

### Deploy to an empty stage (create target workspace)

When the target stage has no workspace, provide `createdWorkspaceDetails` and the service provisions one.

```bash
fab api -X post "deploymentPipelines/$PIPELINE_ID/deploy" -i "{
  \"sourceStageId\": \"$SOURCE_STAGE\",
  \"targetStageId\": \"$TARGET_STAGE\",
  \"createdWorkspaceDetails\": {
    \"name\":       \"Sales-Prod\",
    \"capacityId\": \"<capacity-id>\"
  },
  \"note\": \"Initial promote to Prod\"
}"
```

`capacityId` is optional; omit it to let the service auto-pick.

### Backward deployment

Deploying from a later stage back to an earlier one (e.g. Prod to Test) is only supported when the target stage is empty (no workspace assigned). Use the `createdWorkspaceDetails` pattern above, or unassign the target first. The Power BI API exposes an explicit `isBackwardDeployment` flag; the Fabric API infers it.

### Cross-region deploy (Fabric API)

```bash
fab api -X post "deploymentPipelines/$PIPELINE_ID/deploy" -i "{
  \"sourceStageId\": \"$SOURCE_STAGE\",
  \"targetStageId\": \"$TARGET_STAGE\",
  \"options\": { \"allowCrossRegionDeployment\": true },
  \"note\": \"Cross-region promote\"
}"
```

### Power BI API deploys (when you need the extra options)

```bash
# Full deploy with PBI-specific options
fab api -A powerbi -X post "pipelines/$PIPELINE_ID/deployAll" -i '{
  "sourceStageOrder": 0,
  "options": {
    "allowOverwriteArtifact": true,
    "allowCreateArtifact":    true,
    "allowPurgeData":         false,
    "allowTakeOver":          false,
    "allowSkipTilesWithMissingPrerequisites": false
  },
  "updateAppSettings": { "updateAppInTargetWorkspace": true },
  "note": "Deploy all; refresh Prod app"
}'

# Selective deploy; typed arrays instead of a flat items array
fab api -A powerbi -X post "pipelines/$PIPELINE_ID/deploy" -i '{
  "sourceStageOrder": 0,
  "datasets": [
    { "sourceId": "<dataset-id>", "options": { "allowOverwriteArtifact": true } }
  ],
  "reports": [
    { "sourceId": "<report-id>" }
  ],
  "options": { "allowCreateArtifact": true, "allowOverwriteArtifact": true }
}'
```

---

## Reviewing diffs and deployment history

Always compare before you deploy, then capture the operation for audit afterwards.

### Pre-deployment diff

The Fabric API returns per-item diff state inside the operation's execution plan. To preview a diff without deploying, either compare stage item lists directly or (simpler) dry-run in the portal.

```bash
# Flat list comparison via items endpoints
fab api "deploymentPipelines/$PIPELINE_ID/stages/$DEV_STAGE/items" -o /tmp/dev.json
fab api "deploymentPipelines/$PIPELINE_ID/stages/$TEST_STAGE/items" -o /tmp/test.json
diff \
  <(jq -S 'sort_by(.itemDisplayName)' /tmp/dev.json) \
  <(jq -S 'sort_by(.itemDisplayName)' /tmp/test.json)
```

Pairing is created on first deploy or workspace assignment. Items pair on type + display name; if multiple items share a name, the folder path has to match too. Moving or renaming folders breaks pairing and surfaces items as `Different`.

### Post-deploy execution plan

After the deploy call returns, fetch the detailed execution plan; it contains one step per item with diff state and error info:

```bash
fab api "deploymentPipelines/$PIPELINE_ID/operations/$OPERATION_ID" \
  -q "executionPlan.steps[].{
    item:   description,
    status: status,
    diff:   preDeploymentDiffState
  }"
```

`preDeploymentDiffState` values:

- `New` ; the item exists only in the source stage and was cloned
- `Different` ; paired items differ; the source overwrote the target
- `NoDifference` ; nothing changed (still logged for audit)

`preDeploymentDiffInformation` on the operation root contains the roll-up counts. The portal's Compare view renders the same data as `New`, `Different from source`, `Only in source`, `Same as source`, and `Not in source` (items that exist only in the target and are left untouched).

### LRO polling

```bash
OPERATION_ID="<x-ms-operation-id header>"

fab api "operations/$OPERATION_ID" \
  -q "{status:status, pct:percentComplete, updated:lastUpdatedTimeUtc}"
```

`status` cycles through `NotStarted`, `Running`, then terminates at `Succeeded` or `Failed`. Polling loop:

```bash
while true; do
  STATUS=$(fab api "operations/$OPERATION_ID" -q "status" | tr -d '"')
  echo "status: $STATUS"
  [ "$STATUS" = "Succeeded" ] || [ "$STATUS" = "Failed" ] && break
  sleep 30
done
```

The LRO result is retained for 24 hours after completion; fetch it promptly for audit purposes via `fab api "operations/$OPERATION_ID/result"`.

### Deployment history

Returns up to the last 20 operations with status, type (`Deploy`, `AssignWorkspace`, etc.), who triggered them, and the attached note.

```bash
# Fabric API
fab api "deploymentPipelines/$PIPELINE_ID/operations" \
  -q "value[].{time:executionStartTime, type:type, status:status, note:note, by:performedBy}"

# Power BI API (equivalent)
fab api -A powerbi "pipelines/$PIPELINE_ID/operations"
```

Review history regularly when multiple admins can deploy; it's the primary audit trail for spotting unapproved or failed promotes.

---

## Deployment rules

Rules rewrite item configuration during deployment so each stage can point at its own data source, parameter, or lakehouse. They're configured on the target stage and apply every time the paired item is deployed into that stage.

| Item type | Data source rule | Parameter rule | Default lakehouse rule |
|---|---|---|---|
| Semantic model | yes | yes | ; |
| Dataflow Gen1 | yes | yes | ; |
| Paginated report | yes | ; | ; |
| Mirrored database | yes | ; | ; |
| Notebook | ; | ; | yes |

Rules cannot be managed with a clean native endpoint in the Fabric API; in practice they're set in the portal or via the Power BI pipelines `updatePipelineConfiguration` endpoint. When you need automated rule management at scale, `fab api -A powerbi -X post "pipelines/<id>/stages/<order>/rules"` with a JSON body matching the Power BI REST schema is the supported path.

Caveats:

- The rule owner must be the item owner AND at least a contributor on the target workspace.
- Data source rules only work when swapping between data sources of the same type.
- Rules applied to semantic models flag paired items as `Different` until you deploy (because the rule hasn't been materialised yet).
- Parameters used for rule-based rebinding must be of type `Text`.

---

## Content lifecycle management patterns

These patterns are distilled from Microsoft's Power BI implementation planning series on content lifecycle management. Deployment pipelines serve one stage of a broader lifecycle; they aren't a substitute for source control or testing.

### The six lifecycle stages

Power BI content moves through `plan/design`, `develop`, `validate`, `deploy`, `support/monitor`, and `retire/archive`. Deployment pipelines primarily serve `deploy`, with a side role in `validate` through the Compare view.

### Workspace strategy

Separate workspaces by environment and optionally by item type. Each workspace maps to exactly one deployment pipeline stage.

**Single pipeline ; the common case.**

All content in one workspace per stage, one pipeline.

```
Dev Workspace  ...  Test Workspace  ...  Prod Workspace
   stage 0           stage 1              stage 2
```

**Multiple linked pipelines ; separating by item type.**

When you split content across workspaces by item type (e.g. a data workspace holding semantic models, lakehouses, and dataflows; a reporting workspace holding reports, dashboards, and paginated reports), you need one pipeline per workspace. These pipelines link automatically through cross-pipeline auto-binding, so a report in the Test stage of the reporting pipeline stays connected to the semantic model in the Test stage of the data pipeline after every deploy.

```
Pipeline A (Data):     Dev-Data  ...  Test-Data  ...  Prod-Data
                          |              |              |
                      auto-binds     auto-binds     auto-binds
                          |              |              |
Pipeline B (Reports):  Dev-Rpt   ...  Test-Rpt   ...  Prod-Rpt
```

Requirements for the link to work:

- **Both pipelines must have the same number of stages.** A 3-stage data pipeline cannot link to a 4-stage reporting pipeline.
- **Stage order matters, not stage name.** Pipeline A stage 0 binds to Pipeline B stage 0 regardless of what they're called.
- **The dependency must already exist in the target stage** when the dependent item is deployed, or the deploy fails with a lineage error. If you're promoting together, deploy the data pipeline first, then the reporting pipeline, so reports find their freshly promoted models.
- **Reports / dashboards stay bound to data items** through the auto-bind even when the two pipelines are in different workspaces.

Common topologies:

| Topology | Pipelines | When to use |
|---|---|---|
| Single pipeline, single workspace per stage | 1 | All content owned by one team; simplest case |
| Two linked pipelines (data + reporting) | 2 | Separate data engineering and report authoring teams; different release cadences |
| Three linked pipelines (ingestion + modelling + reporting) | 3 | Medallion-style separation; lakehouse/warehouse in one, semantic models in another, reports in a third |
| Pipeline per domain | N | Federated ownership; each data domain has its own dev/test/prod |

Example cross-pipeline layout with three data domains plus a shared reporting pipeline:

```
Sales-Data:      Dev  ...  Test  ...  Prod
Finance-Data:    Dev  ...  Test  ...  Prod
HR-Data:         Dev  ...  Test  ...  Prod
                  |         |         |     (auto-bind per matching stage)
Reports:         Dev  ...  Test  ...  Prod
```

Each `Reports` stage can reference models from any of the three data pipelines, as long as the matching stage exists in the source data pipeline. When you want to break auto-binding (e.g. reports should always read from Prod-Data regardless of stage), use one of the opt-outs under [Auto-binding behavior](#auto-binding-behavior).

To link pipelines programmatically, there's no explicit "link" API call; linking is implicit through workspace assignment. You create each pipeline, assign the appropriate workspaces to matching stages, and the binding resolves on the next deploy or compare. Review item lineage after linking to confirm the bindings are correct:

```bash
# Find reports and the semantic models they depend on, per workspace
fab api "workspaces/<reporting-ws-id>/items" -q "value[?type=='Report']"
# Use Power BI scanner API or the get-downstream-reports.py script for full lineage
```

See [`scripts/get-downstream-reports.py`](../scripts/get-downstream-reports.py) for a lineage walker that works across workspaces without admin access.

### Auto-binding behavior

Deployment pipelines automatically reconnect deployed items to their dependencies in the target stage:

- Same workspace ; the paired dependency is picked up automatically.
- Across pipelines ; works only when both pipelines have identical stage counts and the dependency already exists in the target stage.
- Missing dependency ; the deploy fails with a lineage error.

When auto-binding is undesirable (e.g. all reports should always point at the Prod semantic model regardless of stage), choose one of:

1. Don't connect the items in the same stage ; pipelines keep the original connection.
2. Define a parameter rule (semantic models and dataflows only; not reports).
3. Connect reports / dashboards to a proxy semantic model that isn't connected to any pipeline.

### Deployment approaches

The implementation planning guidance lists five deployment approaches. Pipelines are one of them:

| Approach | Complexity | Best for |
|---|---|---|
| Publish from Power BI Desktop | Lowest | Self-service creators, manual control |
| Publish via XMLA endpoint | Moderate | Tabular Editor users, semantic-model-only work |
| OneDrive refresh | Moderate | Self-service with simple version control |
| Fabric Git integration | Higher | Azure DevOps / GitHub users on Fabric capacity with .pbip files |
| Azure Pipelines (CI/CD) | Highest | Enterprise teams, full automation, custom validation and release approvals |

Deployment pipelines are complementary to the others, not competing. The canonical enterprise pattern is: Git for source control and code review, deployment pipelines for the promote between workspaces, Azure Pipelines to orchestrate both and to run validation + build + release stages with approvals.

Typical Fabric Git branching topology:

- `dev` branch syncs to the dev workspace
- Pull request `dev` to `test` promotes via the test workspace sync
- Pull request `test` to `main` promotes to prod

### Deployment rules in a lifecycle context

Use rules to model environment differences the code doesn't carry:

- Data source rules ; swap Dev DB for Prod DB on each stage.
- Parameter rules ; swap connection strings, feature flags, or row limits per stage.
- Default lakehouse rule ; rebind notebooks to the stage-appropriate lakehouse.

Rules are the right lever when config differs by stage. When everything changes (data, permissions, credentials), you're looking at post-deployment activities, not rules.

### Post-deployment activities

Deployment copies definitions only. After a deploy, handle these manually or via automation:

| Activity | Copied during deploy? | Notes |
|---|---|---|
| Item definitions (model, visuals, pages) | yes | ; |
| Data source connections | via rules | Set data source rules per stage |
| Parameters | via rules | Set parameter rules per stage |
| Actual row data | no | Refresh semantic models after deploy |
| Data source credentials | no | Set per stage |
| Scheduled refresh config | no | Configure on target model after first deploy |
| Gateway mappings | no | Configure after first deploy |
| RLS role members | no | Assign per stage |
| Item permissions | no | Manage per stage |
| Sensitivity labels | conditional | Copied on first deploy; later only when source has a protected label and target doesn't |
| Workspace-level settings | no | Each stage has its own workspace |
| Power BI app content | no | Republish per stage (use `updateAppSettings` via PBI API) |

Trigger a refresh of the promoted model right after deployment so users aren't staring at stale data:

```bash
MODEL_ID=$(fab get "Prod.Workspace/Sales.SemanticModel" -q "id" | tr -d '"')
WS_ID=$(fab get "Prod.Workspace" -q "id" | tr -d '"')
fab api -A powerbi -X post "groups/$WS_ID/datasets/$MODEL_ID/refreshes" -i '{"type":"Full"}'
```

### Governance

- **Deploy in one direction.** Dev to Test to Prod. Don't make changes directly in later stages; they'll just get overwritten on the next deploy, or worse, they won't and you'll drift.
- **Restrict pipeline admin.** Grant it to release managers and technical owners, not to every content creator. Pipeline admin plus workspace admin is the combination that can deploy.
- **Review deployment history regularly.** It's your audit trail for unapproved or failed promotes. When auto-binding is in play, also review item lineage to catch broken bindings from someone publishing to the wrong stage.
- **Use the Compare view before deploy.** Especially when you don't have a Git remote for source control; the diff is the only record of what's about to change.
- **Always attach a note.** The `note` field on the deploy call shows up in deployment history; treat it like a commit message.
- **Release approvals.** When orchestrating deploys with Azure Pipelines, require explicit sign-off from a release manager for test and prod stages.

---

## Permissions summary

### Pipeline + workspace role matrix

| Action | Pipeline role | Workspace role |
|---|---|---|
| View list of pipelines | ; (free user) | ; |
| Create a pipeline | Licensed user (Pro / PPU / Premium) | ; |
| View pipeline metadata / stages | Admin | ; |
| Share, edit, delete pipeline | Admin | ; |
| Assign workspace to a stage | Admin | Workspace admin |
| Unassign workspace from a stage | Admin | ; (or Workspace admin via PBI unassign API) |
| View items in a stage | Admin | Workspace reader+ |
| Compare two stages | Admin | Contributor, member, or admin on both |
| Deploy to an empty stage | Admin | Contributor on source |
| Deploy to an existing stage | Admin | Contributor on source AND target |
| View or set a deployment rule | Admin | Contributor+ on target AND item owner |
| View deployment history | Admin | ; |
| Manage role assignments | Admin | ; |

Extra item-specific twists:

- **Dataflows** ; the deployer must be the dataflow owner.
- **Semantic models** ; if the tenant admin switch "block republish and disable package refresh" is on, only the model owner can deploy updates to it.
- **GCC environment** ; deployers need workspace Member on both stages (Contributor isn't enough).

### Required delegated scopes

| Action | Scope |
|---|---|
| Read pipelines, stages, items, operations | `Pipeline.Read.All` or `Pipeline.ReadWrite.All` |
| Create, update, delete pipelines | `Pipeline.ReadWrite.All` |
| Assign / unassign workspace | `Pipeline.ReadWrite.All` + `Workspace.ReadWrite.All` |
| Deploy content | `Pipeline.Deploy` |
| Manage role assignments | `Pipeline.ReadWrite.All` |

### Identity support

User principals, service principals, managed identities, and SPN profiles all work across every endpoint. Service principal automation additionally requires the Fabric admin setting "Service principals can create workspaces, connections, and deployment pipelines" to be enabled. Microsoft 365 groups are not supported as pipeline admins; use a security group instead.

---

## Supported item types (Fabric API)

The Fabric `deploy` endpoint accepts these `itemType` values:

`Dashboard`, `Report`, `SemanticModel`, `PaginatedReport`, `Datamart`, `Lakehouse`, `Eventhouse`, `Environment`, `KQLDatabase`, `KQLQueryset`, `KQLDashboard`, `DataPipeline`, `Notebook`, `SparkJobDefinition`, `MLExperiment`, `MLModel`, `Warehouse`, `Eventstream`, `SQLEndpoint`, `MirroredWarehouse`, `MirroredDatabase`, `Reflex`, `GraphQLApi`, `SQLDatabase`, `CopyJob`, `VariableLibrary`, `Dataflow`.

The Power BI selective deploy uses typed arrays instead: `datasets`, `reports`, `dashboards`, `dataflows`, `datamarts`.

---

## Limitations and gotchas

- **Stage count is permanent.** 2...10 stages, fixed at creation. You can rename them or toggle `isPublic`; you cannot add, remove, or reorder.
- **Max 300 items** per deploy request.
- **No concurrent deployments** on the same pipeline. Delete also fails while a deploy is running.
- **Backward deploy needs an empty target.** Unassign the target workspace first, or use `createdWorkspaceDetails` to provision a new one.
- **No data copy.** Deployment carries definitions only; refresh semantic models after the promote.
- **Item identity preserved.** IDs, URLs, and permissions in the target stage survive overwrite.
- **Gateway mappings** aren't configured after the first deploy; script them separately.
- **Fabric API gaps.** `allowPurgeData`, `allowTakeOver`, `allowSkipTilesWithMissingPrerequisites`, and `updateAppSettings` are Power BI API only.
- **Empty folders** aren't deployed. Folder hierarchy changes ship on deploy, not on workspace assignment.
- **Direct Lake semantic models** don't auto-rebind to target-stage lakehouses; use a data source rule (or post-deploy rebind) to fix this.
- **Incremental refresh policy** copies cleanly; existing partitions and data are preserved on the target model. Gen1 dataflow refresh settings don't copy.
- **Sensitivity labels** copy on first deploy only, or when the source has a protected label and the target doesn't.
- **Semantic model ownership.** First deploy transfers ownership to the deployer; subsequent deploys leave it alone.
- **PBIR reports.** Microsoft's docs list PBIR as unsupported; in practice PBIR reports deploy through the Fabric API (verified March 2026). Treat this as undocumented and validate per-tenant before relying on it.
- **Real-time connectivity semantic models**, DQ / Composite models using auto date/time or variation tables, and datasets with circular dependencies all refuse to deploy.
- **LRO results** expire 24 hours after completion. Capture them into your audit log promptly.
- **`.pbix` download** from a stage that was populated by deployment is not supported; export from Desktop or via `fab export` instead.

---

## Full end-to-end workflow

```bash
# 1. Create the pipeline with three stages
fab api -X post "deploymentPipelines" -i '{
  "displayName": "Sales Pipeline",
  "stages": [
    { "displayName": "Development" },
    { "displayName": "Test" },
    { "displayName": "Production" }
  ]
}'
# Capture PIPELINE_ID, DEV_STAGE, TEST_STAGE, PROD_STAGE from the response

# 2. Assign workspaces
fab api -X post "deploymentPipelines/$PIPELINE_ID/stages/$DEV_STAGE/assignWorkspace" \
  -i '{"workspaceId": "<dev-ws-id>"}'
fab api -X post "deploymentPipelines/$PIPELINE_ID/stages/$TEST_STAGE/assignWorkspace" \
  -i '{"workspaceId": "<test-ws-id>"}'
fab api -X post "deploymentPipelines/$PIPELINE_ID/stages/$PROD_STAGE/assignWorkspace" \
  -i '{"workspaceId": "<prod-ws-id>"}'

# 3. Compare Dev and Test before deploying
fab api "deploymentPipelines/$PIPELINE_ID/stages/$DEV_STAGE/items"  -o /tmp/dev.json
fab api "deploymentPipelines/$PIPELINE_ID/stages/$TEST_STAGE/items" -o /tmp/test.json
diff <(jq -S 'sort_by(.itemDisplayName)' /tmp/dev.json) \
     <(jq -S 'sort_by(.itemDisplayName)' /tmp/test.json)

# 4. Promote Dev to Test
fab api -X post "deploymentPipelines/$PIPELINE_ID/deploy" -i "{
  \"sourceStageId\": \"$DEV_STAGE\",
  \"targetStageId\": \"$TEST_STAGE\",
  \"note\": \"Initial promote to Test\"
}" --show_headers
# Capture OPERATION_ID from x-ms-operation-id

# 5. Poll until complete
while true; do
  STATUS=$(fab api "operations/$OPERATION_ID" -q "status" | tr -d '"')
  [ "$STATUS" = "Succeeded" ] || [ "$STATUS" = "Failed" ] && break
  sleep 30
done

# 6. On failure, inspect the execution plan
fab api "deploymentPipelines/$PIPELINE_ID/operations/$OPERATION_ID" \
  -q "executionPlan.steps[?status=='Failed'].{item:description, error:error}"

# 7. Refresh the promoted model
MODEL_ID=$(fab get "TestWorkspace.Workspace/Sales.SemanticModel" -q "id" | tr -d '"')
WS_ID=$(fab get "TestWorkspace.Workspace" -q "id" | tr -d '"')
fab api -A powerbi -X post "groups/$WS_ID/datasets/$MODEL_ID/refreshes" -i '{"type":"Full"}'
```

---

## External references

- Deployment process overview: [understand-the-deployment-process](https://learn.microsoft.com/fabric/cicd/deployment-pipelines/understand-the-deployment-process)
- Compare content between stages: [compare-pipeline-content](https://learn.microsoft.com/fabric/cicd/deployment-pipelines/compare-pipeline-content)
- Deployment history: [deployment-history](https://learn.microsoft.com/fabric/cicd/deployment-pipelines/deployment-history)
- Deployment rules: [create-rules](https://learn.microsoft.com/fabric/cicd/deployment-pipelines/create-rules)
- Pipeline automation with Fabric APIs: [pipeline-automation-fabric](https://learn.microsoft.com/fabric/cicd/deployment-pipelines/pipeline-automation-fabric)
- Pipeline automation with Power BI APIs: [pipeline-automation](https://learn.microsoft.com/fabric/cicd/deployment-pipelines/pipeline-automation)
- Content lifecycle management overview: [powerbi-implementation-planning-content-lifecycle-management-overview](https://learn.microsoft.com/power-bi/guidance/powerbi-implementation-planning-content-lifecycle-management-overview)
- Content lifecycle management; deploy content: [powerbi-implementation-planning-content-lifecycle-management-deploy](https://learn.microsoft.com/power-bi/guidance/powerbi-implementation-planning-content-lifecycle-management-deploy)
- Self-service content publishing usage scenario: [powerbi-implementation-planning-usage-scenario-self-service-content-publishing](https://learn.microsoft.com/power-bi/guidance/powerbi-implementation-planning-usage-scenario-self-service-content-publishing)
- Enterprise content publishing usage scenario: [powerbi-implementation-planning-usage-scenario-enterprise-content-publishing](https://learn.microsoft.com/power-bi/guidance/powerbi-implementation-planning-usage-scenario-enterprise-content-publishing)
- Fabric REST API ; Deployment Pipelines: [rest/api/fabric/core/deployment-pipelines](https://learn.microsoft.com/rest/api/fabric/core/deployment-pipelines)
- Power BI REST API ; Pipelines: [rest/api/power-bi/pipelines](https://learn.microsoft.com/rest/api/power-bi/pipelines)
