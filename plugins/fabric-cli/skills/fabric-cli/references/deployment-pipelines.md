# Deployment pipelines and fab CI/CD

Two routes for promoting content: the config-file driven deploy subcommand of `fab` (wraps the fabric-cicd library, deploys a local folder into a workspace) and the deployment pipelines REST API through `fab api` (promotes between workspaces already assigned to stages).

## Learn

```yaml
pipelines overview: https://learn.microsoft.com/en-us/fabric/cicd/deployment-pipelines/understand-the-deployment-process
automation (Fabric APIs): https://learn.microsoft.com/en-us/fabric/cicd/deployment-pipelines/pipeline-automation-fabric
automation (Power BI APIs): https://learn.microsoft.com/en-us/fabric/cicd/deployment-pipelines/pipeline-automation
deployment rules: https://learn.microsoft.com/en-us/fabric/cicd/deployment-pipelines/create-rules
Fabric REST: https://learn.microsoft.com/en-us/rest/api/fabric/core/deployment-pipelines
Power BI REST: https://learn.microsoft.com/en-us/rest/api/power-bi/pipelines
deploy subcommand docs: https://microsoft.github.io/fabric-cli/commands/fs/deploy/
fabric-cicd: https://github.com/microsoft/fabric-cicd
```

## The deploy subcommand (fab 1.7.0)

Config-file driven; run the subcommand's `--help` for flags: `--config`, `-tenv/--target_env`, `-P` (JSON parameters), `-f`, `--bulk_publish` (experimental). Example shape: `deploy --config config.yml --target_env prod -P '[{"param1":"value1"}]' -f`.

```yaml
core:
  workspace_id: target workspace GUID (wins over workspace)
  workspace: target workspace name
  repository_directory: local item folder (required)
  item_types_in_scope: optional list of item types
  parameter: optional path to the fabric-cicd parameter file
publish: exclude_regex, folder_exclude_regex, folder_path_to_include, items_to_include, skip
unpublish: exclude_regex, items_to_include, skip
features: fabric-cicd feature flags (names not on the fab page; see fabric-cicd docs)
constants: fabric-cicd constant overrides (format not on the fab page)
```

- Publish and unpublish both run by default; set `skip` (per environment such as dev, test, prod) to turn one off
- Unpublish deletes target items missing from the source folder; protect items with `unpublish.exclude_regex` before the first run against a real workspace
- `repository_directory` and `parameter` resolve relative to the config file, not the current directory
- `--target_env` selects the environment only when the config has per-environment mappings; without mappings omit it
- The regex and include keys need matching fabric-cicd feature flags; Unverified which; selective deploy is discouraged by the docs because of dependency handling
- `--bulk_publish` sets the fabric-cicd experimental and bulk-publish flags and imports all items in one API call
- Source the folder from Git-integrated item files; `fab export` output has no logical ids, so cross-item references usually need the parameter file

### Bulk export

```bash
fab bulk-export "ws.Workspace" -o ./out --recursive
fab bulk-export "ws.Workspace/folder1.Folder" -o ./out --recursive
```

- Added in 1.7.0; keeps folder structure and item bindings
- `--recursive` is required for workspace and folder targets; `-f` overwrites a non-empty output and exports without sensitivity label
- Pairs with the deploy subcommand: export from dev, commit, deploy the folder to test and prod

## Pipeline API surfaces

```yaml
Fabric API (default audience):
  prefix: deploymentPipelines
  scope: all Fabric and Power BI items
  stages addressed by: stage UUID
  deploy: one deploy endpoint, full or selective
  extra option: allowCrossRegionDeployment
  roles: roleAssignments, Admin only
Power BI API (-A powerbi):
  prefix: pipelines
  scope: Power BI items only
  stages addressed by: order integer, 0 is first
  deploy: deployAll and deploy (typed arrays datasets, reports, dashboards, dataflows, datamarts)
  extra options: allowPurgeData, allowTakeOver, allowSkipTilesWithMissingPrerequisites, allowOverwriteArtifact, allowCreateArtifact, allowOverwriteTargetArtifactLabel, updateAppSettings
  roles: users endpoint with accessRight
```

Default to the Fabric API; use the Power BI API only for its per-item options or `updateAppSettings`.

## Pipelines and stages (Fabric API)

```bash
fab api deploymentPipelines -q "text.value[].{name:displayName,id:id}"
fab api -X post deploymentPipelines -i '{"displayName":"Sales","stages":[{"displayName":"Dev"},{"displayName":"Test"},{"displayName":"Prod","isPublic":true}]}'
fab api deploymentPipelines/$P/stages -q "text.value[?order==\`0\`].id | [0]"
fab api -X post deploymentPipelines/$P/stages/$S/assignWorkspace -i '{"workspaceId":"<ws-id>"}'
fab api -X post deploymentPipelines/$P/stages/$S/unassignWorkspace
fab api deploymentPipelines/$P/stages/$S/items -q "text.value[].{name:itemDisplayName,type:itemType,src:sourceItemId,tgt:targetItemId}"
```

- Stage count (2 to 10) and order are fixed at creation; only names, descriptions and `isPublic` change (PATCH on the pipeline or stage); reshaping means a new pipeline
- Assign needs the stage empty, the workspace in no other pipeline, and Admin on both the pipeline and the workspace
- Unassign drops item pairings, so there is no swap; a re-assign re-pairs on type, name and folder path at the next deploy or compare
- Delete and unassign fail with 409 while an operation runs; `sourceItemId` and `targetItemId` in the stage items are the pairing
- Roles: POST `deploymentPipelines/$P/roleAssignments` with `{"principal":{"id":..., "type":"User|ServicePrincipal|Group"},"role":"Admin"}`; Microsoft 365 groups are not supported, use a security group; pipeline Admin grants no workspace content access

## Deploy

```bash
fab api -X post deploymentPipelines/$P/deploy --show_headers -i '{"sourceStageId":"'$SRC'","targetStageId":"'$TGT'","note":"Promote Dev to Test"}'
```

- Returns 202; poll `operations/<x-ms-operation-id>` (`-q "text.status"`: NotStarted, Running, Succeeded, Failed), then read `operations/<id>/result`; the result is kept 24 hours
- Selective: add `"items":[{"sourceItemId":"<id>","itemType":"SemanticModel"}]`, at most 300 per request; dependencies must already exist in the target or be in the same call, there is no select-related flag
- Empty target stage: add `"createdWorkspaceDetails":{"name":"Sales-Prod","capacityId":"<optional>"}`
- Backward deploys (Prod to Test) work only into an empty stage; cross-region needs `"options":{"allowCrossRegionDeployment":true}`; no dry-run exists, so compare `stages/<id>/items` or use the portal Compare view
- One deploy at a time per pipeline; set `note`, it is the history audit message
- Execution plan: `fab api deploymentPipelines/$P/operations/$OP -q "text.executionPlan.steps[].{item:description,status:status,diff:preDeploymentDiffState}"`; diff states New, Different, NoDifference; history (last 20): `deploymentPipelines/$P/operations`

## Deployment rules

Rules rewrite configuration per stage and apply on every deploy into it.

```yaml
semantic model and Gen1 dataflow: data source rule, parameter rule
paginated report and mirrored database: data source rule
notebook: default lakehouse rule
```

- No clean Fabric endpoint; set them in the portal, or POST Power BI `pipelines/<id>/stages/<order>/rules` (Unverified schema)
- The rule owner must own the item and be at least Contributor on the target workspace
- Data source rules only swap sources of the same type; parameters used for rebinding must be `Text`

## What a deploy does not carry

```yaml
copied: item definitions, folder hierarchy changes, incremental refresh policy (partitions and data stay on target)
copied via rules only: data source connections, parameters
not copied: row data (refresh after deploy), credentials, refresh schedules, gateway mappings, RLS role members, item permissions, workspace settings, app content
sensitivity labels: first deploy only, or when the source has a protected label and the target has none
```

- Direct Lake models do not rebind to the target lakehouse on their own; use a data source rule or rebind after deploying
- Items pair on type plus name (plus folder path on duplicates); moving folders breaks pairing
- First deploy transfers semantic model ownership to the deployer; dataflows must be deployed by their owner
- Real-time connectivity models, DirectQuery or composite models using auto date/time or variation tables, and circular dependencies refuse to deploy; PBIR reports are listed as unsupported on Learn (deploys worked via the Fabric API in March 2026; validate per tenant); empty folders are not deployed
- After promoting, refresh: `fab api -A powerbi -X post "groups/$WS/datasets/$MODEL/refreshes" -i '{"type":"Full"}'`

## Linked pipelines

Pipelines splitting data and reports across workspaces auto-bind on stage order, not name: both need the same stage count, the dependency must already exist in the target stage (deploy the data pipeline first), and there is no link API; assigning workspaces links them. To stop auto-binding, keep the items out of the same stage, use a parameter rule (models and dataflows only), or bind reports to a proxy model outside any pipeline. `uv run ${CLAUDE_SKILL_DIR}/scripts/get-downstream-reports.py` walks report-to-model lineage without admin rights.

## Permissions

```yaml
create pipeline: licensed user (Pro, PPU or Premium)
view, edit, delete pipeline, history, role assignments: pipeline Admin
assign workspace: pipeline Admin plus workspace Admin
deploy to empty stage: Contributor on source
deploy to existing stage: Contributor on source and target
set a rule: Contributor on target plus item owner
service principals: need the tenant setting that lets them create workspaces, connections and deployment pipelines
delegated scopes: Pipeline.Read.All, Pipeline.ReadWrite.All, Pipeline.Deploy (plus Workspace.ReadWrite.All to assign)
```

