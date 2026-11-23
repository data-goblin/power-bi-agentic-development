---
title: Dataflow Gen1 versus Gen2 API differences
summary: Gen1 uses the Power BI API with transactions; Gen2 is a Fabric item with publish and refresh jobs. Refresh, cancel and migration gotchas.
kind: gotcha
status: current
sources:
  - url: https://learn.microsoft.com/en-us/rest/api/power-bi/dataflows
  - url: https://learn.microsoft.com/en-us/rest/api/fabric/dataflow/items
  - url: https://learn.microsoft.com/en-us/rest/api/fabric/core/job-scheduler/run-on-demand-item-job
  - url: https://learn.microsoft.com/en-us/fabric/data-factory/dataflow-gen2-public-apis
  - url: https://microsoft.github.io/fabric-cli/commands/api/
tools:
  fab: 1.9.0
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
skills: [fabric-cli/fabric-cli]
---

# Dataflow Gen1 versus Gen2 API differences

Learn: [Gen1 Dataflows (Power BI)](https://learn.microsoft.com/en-us/rest/api/power-bi/dataflows), [Gen2 Dataflow items (Fabric)](https://learn.microsoft.com/en-us/rest/api/fabric/dataflow/items), [Run On Demand Item Job](https://learn.microsoft.com/en-us/rest/api/fabric/core/job-scheduler/run-on-demand-item-job).

```yaml
Gen1: Power BI REST, fab api -A powerbi, groups/<ws>/dataflows, definition model.json (CDM), refresh tracked by transactionId
Gen2: Fabric REST, default fab api audience, workspaces/<ws>/items?type=Dataflow, definition dataflow-content.json plus mashup.pq (base64 parts), refresh tracked by a job instance id
```

Gen2 uses the Fabric item type `Dataflow`, so `fab ls`, `fab get` and `fab export` see it like other items.

## Gen1 gotchas

- Refresh trigger (`POST groups/<ws>/dataflows/<id>/refreshes`) returns no transaction id. Poll `.../transactions`, sort by `startTime`, and match `refreshType: OnDemand`.
- `notifyOption` accepts `NoNotification` and `MailOnFailure`; `MailOnCompletion` is rejected.
- Cancel sits outside the dataflow path: `POST groups/<ws>/dataflows/transactions/<transaction-id>/cancel`, returning `successfullyMarked`, `alreadyConcluded`, `invalid` or `notFound`.
- `computeEngineBehavior` takes `computeOptimized`, `computeOn` or `computeDisabled`.
- Linked and computed entities and DirectQuery through the dataflow connector need Premium capacity.
- Admin list `admin/dataflows` needs `$top`; the admin datasources call may include deleted datasources.
- `saveAsNativeArtifact` (preview) converts Gen1 to Gen2: the Gen1 original stays, connections migrate, and the schedule copies disabled with `includeSchedule`. Non-fatal problems come back in `errors[]` (`FailedToCopySchedule`, `SetDataflowOriginFailed`, `ConnectionsUpdateFailed`).

## Gen2 gotchas

- Lifecycle is definition, then Publish job, then Refresh job. After `updateDefinition`, a refresh without a completed Publish runs the previous definition.
- Start jobs with `POST workspaces/<ws>/items/<id>/jobs/instances?jobType=Publish` or `Refresh`. Learn now documents `jobs/<jobType>/instances` and keeps the query form for backward compatibility. Both return `202` with a `Location` and `Retry-After` header; poll the job instance until `Completed` or `Failed`.
- Gen2 trigger returns the job instance id, so polling is deterministic; Gen1 is not.
- Service principals are not supported for Gen2 dataflow APIs ([Dataflow Gen2 public APIs, current limitations](https://learn.microsoft.com/en-us/fabric/data-factory/dataflow-gen2-public-apis); the Create Dataflow reference lists them as supported, so treat the limitations page as the stricter rule).
- Notifications are not available through the API; use the Monitoring Hub.
- `getDefinition` is a POST and returns base64 parts. To read one part: `fab api -X post "workspaces/$WS_ID/items/$ITEM_ID/getDefinition" -q "text.definition.parts[?path=='dataflow-content.json'].payload | [0]"`, then base64-decode the output.
- Get Item and List Item Access Details do not return correct information when filtered on the dataflow item type; without a type the API returns the Dataflow Gen2 (CI/CD) item ([current limitations](https://learn.microsoft.com/en-us/fabric/data-factory/dataflow-gen2-public-apis)).

## Example: update definition, publish, refresh (Gen2)

```bash
fab api -X post "workspaces/$WS_ID/items/$ITEM_ID/updateDefinition" -i definition.json
PUBLISH_LOC=$(fab api -X post "workspaces/$WS_ID/items/$ITEM_ID/jobs/instances?jobType=Publish" --show_headers -q "headers.Location")
PUBLISH_JOB=${PUBLISH_LOC##*/}
fab api "workspaces/$WS_ID/items/$ITEM_ID/jobs/instances/$PUBLISH_JOB" -q "text.status"
fab api -X post "workspaces/$WS_ID/items/$ITEM_ID/jobs/instances?jobType=Refresh"
```

Repeat the status call until `Completed` before the refresh. The 202 response has no body: Learn documents only the `Location` header (the job instance URL) and `Retry-After` ([Run On Demand Item Job](https://learn.microsoft.com/en-us/rest/api/fabric/core/job-scheduler/run-on-demand-item-job)), so read the instance id from `Location`. `-i` takes an inline JSON string or a path to a JSON file ([fab api](https://microsoft.github.io/fabric-cli/commands/api/)).
