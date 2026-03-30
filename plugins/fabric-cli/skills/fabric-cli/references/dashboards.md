# Dashboard Operations

Dashboards are a distinct Power BI item type -- they are **not** reports. A dashboard is a single-page canvas of pinned tiles, where each tile displays a snapshot from a report visual, Q&A query, or standalone widget (image, text, video, streaming data). Unlike reports, dashboards cannot be authored in Power BI Desktop; they exist only in the Power BI service. Dashboards do not have pages, filters, slicers, or interactive visuals -- they are curated, at-a-glance views that link back to the underlying reports.

All examples target the workspace-scoped ("In Group") endpoints unless noted.
Replace `$WS_ID` with the target workspace ID and `$DASH_ID`, `$TILE_ID`
with the relevant object IDs throughout.

```bash
# Resolve workspace ID once
WS_ID=$(fab get "ws.Workspace" -q "id" | tr -d '"')
```

---

## List Dashboards

```bash
fab api -A powerbi "groups/$WS_ID/dashboards"
```

Filter to names and IDs:

```bash
fab api -A powerbi "groups/$WS_ID/dashboards" -q "value[].{id:id, name:displayName}"
```

## Get a Single Dashboard

```bash
fab api -A powerbi "groups/$WS_ID/dashboards/$DASH_ID"
```

## Create a Dashboard

Create an empty dashboard. There is no way to add tiles via REST API -- tiles
are pinned through the Power BI service UI only.

```bash
fab api -A powerbi -X post "groups/$WS_ID/dashboards" \
  -i '{"name": "Sales Overview"}'
```

The response returns the new dashboard object with its `id`, `embedUrl`, and `webUrl`.

## Delete a Dashboard

```bash
fab api -A powerbi -X delete "groups/$WS_ID/dashboards/$DASH_ID"
```

Returns HTTP 200 on success with an empty body.

---

## Tiles

### List Tiles

```bash
fab api -A powerbi "groups/$WS_ID/dashboards/$DASH_ID/tiles"
```

Each tile includes `reportId` and `datasetId` when the tile originates from a
report visual or Q&A query. Standalone widget tiles (image, text, video) do not
carry these fields.

### Get a Single Tile

```bash
fab api -A powerbi "groups/$WS_ID/dashboards/$DASH_ID/tiles/$TILE_ID"
```

### Clone a Tile

Clone a tile to the same or a different dashboard. Optionally rebind the tile to
a different report and/or semantic model in the target workspace.

```bash
fab api -A powerbi -X post \
  "groups/$WS_ID/dashboards/$DASH_ID/tiles/$TILE_ID/Clone" \
  -i '{
    "targetDashboardId": "<target-dash-id>",
    "targetWorkspaceId": "<target-ws-id>",
    "targetReportId": "<target-report-id>",
    "targetModelId": "<target-model-id>",
    "positionConflictAction": "Tail"
  }'
```

Parameter notes:

- `targetDashboardId` -- required. The destination dashboard.
- `targetWorkspaceId` -- optional. Omit or pass an empty GUID to target My Workspace.
- `targetReportId` / `targetModelId` -- optional. When cloning cross-workspace
  without specifying these, the tile's report/semantic model links are removed and the
  tile will appear broken.
- `positionConflictAction` -- `Tail` (append to end) or `Abort` (fail if conflict).

### Clone All Tiles Between Dashboards

No single endpoint clones an entire dashboard. Iterate tiles instead:

```bash
# 1. List source tiles
TILES=$(fab api -A powerbi "groups/$WS_ID/dashboards/$DASH_ID/tiles" \
  -q "value[].id" | jq -r '.[]')

# 2. Clone each tile to the target dashboard
for TILE in $TILES; do
  fab api -A powerbi -X post \
    "groups/$WS_ID/dashboards/$DASH_ID/tiles/$TILE/Clone" \
    -i "{\"targetDashboardId\": \"<target-dash-id>\", \"positionConflictAction\": \"Tail\"}"
done
```

---

## Admin Endpoints

Admin endpoints require `Tenant.Read.All` or `Tenant.ReadWrite.All` and are
rate-limited to 50 requests/hour or 5 requests/minute per tenant.

```bash
# List all dashboards across the tenant
fab api -A powerbi "admin/dashboards"

# List dashboards in a specific workspace (admin scope)
fab api -A powerbi "admin/groups/$WS_ID/dashboards"

# Get tiles for a dashboard (admin scope)
fab api -A powerbi "admin/dashboards/$DASH_ID/tiles"

# Get dashboard users/permissions
fab api -A powerbi "admin/dashboards/$DASH_ID/users"

# Get dashboard subscriptions (preview)
fab api -A powerbi "admin/dashboards/$DASH_ID/subscriptions"
```

Expand tiles inline on the admin list call with OData `$expand`:

```bash
fab api -A powerbi 'admin/groups/$WS_ID/dashboards?$expand=tiles'
```

---

## Object Models

### Dashboard

```
Dashboard {
  id            string (uuid)
  displayName   string
  embedUrl      string
  webUrl        string
  isReadOnly    boolean
  appId         string          -- present only when the dashboard belongs to an app
}
```

The admin variant (`AdminDashboard`) adds `workspaceId` and optionally `tiles[]`
when `$expand=tiles` is used.

### Tile

```
Tile {
  id            string (uuid)
  title         string
  embedUrl      string
  embedData     string
  rowSpan       integer
  colSpan       integer
  reportId      string (uuid)   -- only for report-sourced tiles
  datasetId     string          -- only for report or Q&A tiles
}
```

### Permission Levels

| Value | Access |
|-------|--------|
| None | No access |
| Read | View only |
| ReadWrite | View and edit |
| ReadReshare | View and reshare |
| ReadCopy | View and copy |
| Owner | Full control (view, edit, reshare) |

---

## Limitations

- **No programmatic pin.** Pinning a report visual to a dashboard is a UI-only
  action. The REST API cannot create tiles from report visuals, Q&A queries, or
  standalone widgets (image, text, video, web content, streaming data).
- **No dashboard clone.** There is no endpoint to duplicate an entire dashboard.
  Clone tiles individually to approximate this.
- **No tile update.** Tile position, size, and content cannot be modified via API.
- **No tile delete.** Individual tiles cannot be removed through the API.
- **Tile title gap.** Titles edited in the source report before pinning are not
  returned by the tiles API.
- **Deprecated fields.** The `users` and `subscriptions` arrays on the Dashboard
  response payload are being deprecated. Use the admin endpoints instead.

---

## Related Admin Operations

Several tenant-wide admin operations touch dashboards indirectly:

- **Metadata scanning** (`PostWorkspaceInfo` + `GetScanResult`) -- returns
  dashboards with detailed metadata including tile info.
- **Sensitivity labels** (`SetLabelsAsAdmin` / `RemoveLabelsAsAdmin`) -- apply or
  remove information protection labels on dashboards.
- **Published-to-web audit** (`PublishedToWeb`) -- find dashboards published to
  the public web.
- **Unused artifacts** (`GetUnusedArtifactsAsAdmin`) -- identify dashboards in a
  workspace not accessed within 30 days.
