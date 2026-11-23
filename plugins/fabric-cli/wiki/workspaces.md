---
title: Workspace creation, capacity, Spark defaults and git status gotchas
summary: Gotchas for creating a workspace with fab, assigning Trial or PPU capacity, large storage format, Spark settings and the git sync check.
kind: gotcha
status: current
sources:
  - url: https://learn.microsoft.com/en-us/rest/api/fabric/core/workspaces
  - url: https://learn.microsoft.com/en-us/rest/api/power-bi/groups/update-group
  - url: https://learn.microsoft.com/en-us/rest/api/power-bi/capacities/groups-assign-to-capacity
  - url: https://learn.microsoft.com/en-us/rest/api/fabric/core/git/get-status
tools:
  fab: 1.7.0
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
skills: [fabric-cli/fabric-cli]
---

# Workspace creation, capacity, Spark defaults and git status gotchas

Learn: [Workspaces REST API](https://learn.microsoft.com/en-us/rest/api/fabric/core/workspaces), [Groups Update Group](https://learn.microsoft.com/en-us/rest/api/power-bi/groups/update-group), [Groups AssignToCapacity](https://learn.microsoft.com/en-us/rest/api/power-bi/capacities/groups-assign-to-capacity), [Git Get Status](https://learn.microsoft.com/en-us/rest/api/fabric/core/git/get-status). Planning guidance (tenant, workspace and item tiers) is in the Power BI implementation planning workspace articles on Learn.

## Create and read

```bash
fab mkdir "Quarterly.Workspace" -P capacityname=<CapacityName>
fab get "Quarterly.Workspace" -q capacityId
fab get "Quarterly.Workspace" -q "licensingInfo.licensingMode"
fab get "Quarterly.Workspace" -q sparkSettings
```

- `capacityName` is the only creation parameter the earlier notes found; `capacityname=none` creates it without a capacity. Every other setting is changed after creation with `fab set`, `fab assign` or REST. Do not run `fab mkdir ... -P` with no value to list parameters: it attempts the create.
- `fab get ws.Workspace -q "."` dumps these top-level fields (observed on 1.7.0): `id`, `displayName`, `description`, `type`, `capacityId`, `capacityRegion`, `oneLakeEndpoints`, `capacityAssignmentProgress`, `licensingInfo`, `managedPrivateEndpoints`, `sparkSettings`.
- Writable through `fab set -q <path> -i <value>`: `displayName` (renames in place, id stays), `description`, `sparkSettings.environment.runtimeVersion`, `sparkSettings.pool.defaultPool`. `capacityId` and `roleAssignments` change through `fab assign` and `fab acl`.
- `fab acl set -I` takes an Entra objectId; roles are `Admin`, `Member`, `Contributor`, `Viewer`.
- `fab rm "ws.Workspace" -f` deletes the workspace and all its items, and tenant item recovery does not cover a workspace; treat it as permanent.
- Search across workspaces with `fab find 'text' -P type=[Report,SemanticModel] -l`; the DataHub script in this plugin adds last visited, last refreshed and owner fields that `fab find` lacks.

## Capacity

- `fab ls .capacities` shows only Fabric F SKU capacities. `fab assign .capacities/<Name>.Capacity -W "ws.Workspace" -f` is for F SKUs; the earlier notes report `[Not a Fabric capacity]` for Trial and PPU (Unverified on 1.7.0).
- For Trial or PPU use the Power BI API: `fab api -A powerbi "capacities" -q "text.value[].{name:displayName, sku:sku, id:id}"`, then `fab api -A powerbi -X post "groups/$WS_ID/AssignToCapacity" -i '{"capacityId": "<capacity-id>"}'`. An all-zero capacityId unassigns. The earlier notes used `PATCH groups/<id>` with `capacityId`, but Learn's Update Group lists only `name` and `defaultDatasetStorageFormat`; use AssignToCapacity.
- Without a capacity, XMLA and refresh fail with permission errors such as "does not have permission to call Discover"; XMLA needs F64 or higher, PPU or Trial per the earlier notes (Unverified).
- A missing `-f` in a script fails with `[UnexpectedError] 22` because stdin is not a terminal.

## Large semantic model storage format

Not a `fab mkdir` parameter. Set it after creation so later models inherit it; Learn allows it only on Premium and Fabric capacities (shared capacity can only rename):

```bash
WS_ID=$(fab get "Quarterly.Workspace" -q id)
fab api -A powerbi -X patch "groups/$WS_ID" -i '{"defaultDatasetStorageFormat": "Large"}'
```

Existing models are not converted; republish or update each one. Switching back to `Small` affects only models published afterwards.

## Spark settings

- Observed default on a Trial workspace: runtime `1.3`, default pool `Starter Pool` of type `Workspace` with a zero GUID id. Runtime 2.0 (Spark 4.1) is the GA default for new work; 1.3 is end-of-support-announced and 1.2 is retired, so never set `1.2`.
- Set them with `fab set "ws.Workspace" -q sparkSettings.environment.runtimeVersion -i 2.0` and `fab set "ws.Workspace" -q sparkSettings.pool.defaultPool -i '{"name": "Starter Pool", "type": "Workspace"}'`. A custom pool adds its `id`. Unverified: writing these on 1.7.0.

## Git sync check before deploying

```bash
fab api "workspaces/$WS_ID/git/status" -q "text.{head:workspaceHead, remote:remoteCommitHash, changes:length(changes)}"
```

In sync means `workspaceHead == remoteCommitHash` and an empty `changes` array. A workspace without Git returns status 400 `WorkspaceNotConnectedToGit` (observed). The call is a long-running operation and needs contributor role. Reconcile with `commitToGit` (push) or `updateFromGit` (pull), both long running. Unverified: how `fab api` handles the `202` of a connected workspace.
