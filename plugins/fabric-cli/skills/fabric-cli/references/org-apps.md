# Org App Operations

Org apps are the Fabric-native way to distribute curated content packages to consumers within an organization. They are a **Fabric item type** -- managed like any other item (with source control, access management, and sharing) -- and replace the older "workspace apps" (also called "Power BI apps") for new development.

## Workspace Apps vs Org Apps

Two app systems exist. Workspace apps are the legacy Power BI mechanism; org apps are the Fabric-native successor (currently in preview). Both can coexist in the same workspace.

| Aspect | Workspace Apps (legacy) | Org Apps (preview) |
|--------|------------------------|-------------------|
| **Platform** | Power BI only | Microsoft Fabric |
| **Item type** | Not a standalone item; published from workspace settings | First-class Fabric item (`.OrgApp`); appears in workspace list |
| **Source control** | No Git integration | Supports Git integration like other Fabric items |
| **Apps per workspace** | One app per workspace (use audiences to segment) | Multiple org apps per workspace |
| **Supported content** | Power BI reports, dashboards, semantic models | Power BI reports, paginated reports, Fabric notebooks, maps, real-time dashboards |
| **Content model** | Snapshot -- versioned copy at publish time; consumers see frozen state | Live references -- included items are the originals, not copies; consumers see current state |
| **Consumer access** | Must install the app to see it in lists | No install required; appears in Recents, Favorites, and Apps list automatically |
| **Semantic model access** | Manual -- authors must grant access to models for paginated reports and cross-workspace models | Automatic -- consumers get read access to associated semantic models, even in other workspaces |
| **Access revocation** | Removing a user from the app does NOT revoke semantic model access (must be done manually) | Removing a user revokes all org app-based access to included items and associated semantic models |
| **Sharing** | Only specific workspace roles can share | Any user with share permission on the org app item can share it |
| **REST API** | Read-only (list, get content); no create/publish/delete | Read-only via legacy API; lifecycle managed in Fabric portal |

### When to use which

- **New projects:** Use org apps. They support Fabric items (notebooks, real-time dashboards, maps), provide live content, automatic semantic model access, and Git integration.
- **Existing workspace apps:** Continue using them; they work alongside org apps. Migrate to org apps when ready.
- **Org app limitations (preview):** Some workspace app features are not yet available in org apps, including subscriptions, bookmarks, and comments in the report toolbar. The Fabric navigation sidebar remains visible by default (use Focus mode to hide it).

---

## REST API

The REST API currently covers **workspace apps** (the legacy type). There are no dedicated REST API endpoints for creating or managing org app items yet -- org apps are managed through the Fabric portal. The workspace app API endpoints documented below remain useful for querying installed apps and admin operations.

Replace `$APP_ID` with the app ID throughout.

---

## List Installed Apps

List apps the current user has installed or has access to:

```bash
fab api -A powerbi "apps"
```

Filter to names:

```bash
fab api -A powerbi "apps" -q "value[].{id:id, name:name}"
```

## Get App Details

```bash
fab api -A powerbi "apps/$APP_ID"
```

Returns the app object including `name`, `description`, `publishedBy`, and `lastUpdate`.

---

## App Content

### Get App Dashboards

```bash
fab api -A powerbi "apps/$APP_ID/dashboards"
```

### Get a Specific App Dashboard

```bash
fab api -A powerbi "apps/$APP_ID/dashboards/$DASH_ID"
```

### Get App Dashboard Tiles

```bash
fab api -A powerbi "apps/$APP_ID/dashboards/$DASH_ID/tiles"
```

### Get App Reports

```bash
fab api -A powerbi "apps/$APP_ID/reports"
```

### Get a Specific App Report

```bash
fab api -A powerbi "apps/$APP_ID/reports/$REPORT_ID"
```

---

## Admin Endpoints

Admin app endpoints require `Tenant.Read.All` or `Tenant.ReadWrite.All` and are
rate-limited to 200 requests/hour per tenant.

```bash
# List all apps across the tenant (pagination required -- $top is mandatory)
fab api -A powerbi 'admin/apps?$top=100'

# Page through results
fab api -A powerbi 'admin/apps?$top=100&$skip=100'

# Get users/permissions for an app
fab api -A powerbi "admin/apps/$APP_ID/users"
```

The `$top` parameter is mandatory on `admin/apps`. Omitting it returns an error.

---

## Object Models

### App

```
App {
  id            string (uuid)
  name          string
  description   string
  publishedBy   string
  lastUpdate    datetime
}
```

The admin variant (`AdminApp`) adds `workspaceId` linking the app to its source workspace.

### AppUser

```
AppUser {
  displayName         string
  emailAddress        string
  identifier          string
  graphId             string              -- MS Graph ID (admin APIs only)
  principalType       string              -- None | User | Group | App
  appUserAccessRight  string              -- see permission table below
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
| ReadExplore | View and explore underlying data |
| ReadExploreCopy | View, explore, and copy |
| ReadReshareExplore | View, reshare, and explore |
| ReadReshareExploreCopy | View, reshare, explore, and copy |
| All | Full access (view, edit, explore, reshare, copy) |

---

## Authentication Notes

- User-scoped app endpoints do **not** support service principal authentication. Use delegated (user) auth with `App.Read.All` scope.
- Admin endpoints support both delegated and service principal auth.

---

## Limitations

### Workspace App API Limitations
- **Entirely read-only API.** There are no endpoints to create, update, publish, republish, or delete a workspace app. All lifecycle management happens through the Power BI service UI.
- **No audience management.** App audiences (which users/groups see which content) cannot be configured or read through user-scoped endpoints. Admin endpoints provide read-only user lists.
- **No service principal support** on user-scoped endpoints. Service principals can only access admin app endpoints.
- **Mandatory pagination.** The admin `GetAppsAsAdmin` endpoint requires the `$top` query parameter; it does not return results without it.
- **Snapshot content.** Workspace app dashboards and reports are read-only copies of the workspace content at the time of last publish. They reflect the workspace state at publish, not the current workspace state.
- **No programmatic publish.** To update a workspace app after workspace changes, re-publish manually through the Power BI service UI. There is no REST API for this.

### Org App Limitations (Preview)
- **No dedicated REST API yet.** Org apps are managed through the Fabric portal. The workspace app REST API does not cover org app items.
- **Preview feature.** Org apps are in preview and subject to change. Some features available in workspace apps are not yet available in org apps.
- **Missing toolbar features.** Subscriptions, bookmarks, and comments are not yet supported in org app report views.
- **Navigation sidebar.** The Fabric navigation sidebar remains visible by default in org apps (use Focus mode to hide it).
- **Mobile support.** Fabric items (notebooks, maps) included in org apps are not yet viewable in the Power BI mobile app -- only Power BI reports, paginated reports, overview pages, sections, and links are supported on mobile.
