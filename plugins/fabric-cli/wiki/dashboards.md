---
title: Power BI dashboards REST API limits
summary: "What fab api -A powerbi can and cannot do with dashboards and tiles: no pinning, no tile edit, cross-workspace tile clone rebinding."
kind: gotcha
status: current
sources:
  - url: https://learn.microsoft.com/en-us/rest/api/power-bi/dashboards
  - url: https://learn.microsoft.com/en-us/rest/api/power-bi/dashboards/clone-tile-in-group
  - url: https://learn.microsoft.com/en-us/rest/api/power-bi/admin/dashboards-get-dashboards-as-admin
  - url: https://learn.microsoft.com/en-us/rest/api/power-bi/admin/dashboards-get-dashboard-users-as-admin
  - url: https://learn.microsoft.com/en-us/rest/api/power-bi/admin/dashboards-get-dashboard-subscriptions-as-admin
  - url: https://learn.microsoft.com/en-us/rest/api/power-bi/admin/dashboards-get-tiles-as-admin
tools:
  fab: 1.7.0
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
skills: [fabric-cli/fabric-cli]
---

# Power BI dashboards REST API limits

Learn: [Dashboards REST API](https://learn.microsoft.com/en-us/rest/api/power-bi/dashboards), [Clone Tile In Group](https://learn.microsoft.com/en-us/rest/api/power-bi/dashboards/clone-tile-in-group).

A dashboard is a single-page canvas of pinned tiles, not a report. It is authored only in the Power BI service. fab has no dashboard command; use `fab api -A powerbi` with the workspace-scoped `groups/<ws-id>/dashboards` endpoints.

## What the API cannot do

```yaml
pin a visual, Q&A answer or widget: no endpoint; Power BI service UI only
create tiles: no endpoint; Add Dashboard In Group creates an empty dashboard only
update or delete a tile: no endpoint
clone a whole dashboard: no endpoint; clone tile by tile
edited tile titles: titles changed in the source report before pinning are not returned by the tiles API
```

- The `users` and `subscriptions` arrays on the dashboard payload are being deprecated; use the admin endpoints (`admin/dashboards/<id>/users`, `admin/dashboards/<id>/subscriptions`).
- Tiles from report visuals and Q&A carry `reportId` and `datasetId`; image, text, video and streaming tiles carry neither.
- Admin endpoints need `Tenant.Read.All` and are rate limited: [Get Dashboards As Admin](https://learn.microsoft.com/en-us/rest/api/power-bi/admin/dashboards-get-dashboards-as-admin) allows 50 requests per hour or 5 per minute per tenant; [users](https://learn.microsoft.com/en-us/rest/api/power-bi/admin/dashboards-get-dashboard-users-as-admin), [subscriptions](https://learn.microsoft.com/en-us/rest/api/power-bi/admin/dashboards-get-dashboard-subscriptions-as-admin) and [tiles](https://learn.microsoft.com/en-us/rest/api/power-bi/admin/dashboards-get-tiles-as-admin) allow 200 per hour.

## Clone Tile gotchas

- `targetDashboardId` is required. Omit `targetWorkspaceId` to stay in the same workspace; an all-zero GUID means My workspace.
- Cloning across workspaces without `targetReportId` and `targetModelId` removes the report and dataset links and the tile is broken. Within one workspace the links are copied.
- A cloned tile keeps its original report filters in its query.
- `positionConflictAction` is `Tail` (default, append) or `Abort`.

## Example: clone every tile to another dashboard

```bash
WS_ID=$(fab get "ws.Workspace" -q id)
for TILE in $(fab api -A powerbi "groups/$WS_ID/dashboards/<dash-id>/tiles" -q "text.value[].id" | jq -r '.[]'); do
  fab api -A powerbi -X post "groups/$WS_ID/dashboards/<dash-id>/tiles/$TILE/Clone" -i '{"targetDashboardId": "<target-dash-id>", "targetWorkspaceId": "<target-ws-id>", "targetReportId": "<report-id>", "targetModelId": "<model-id>"}'
done
```
