---
title: Org apps versus workspace apps
summary: Org apps are Fabric items with a REST API; workspace apps are a read-only legacy API. How access propagates and what fab can reach.
kind: gotcha
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/explore-reports/org-app-items
  - url: https://learn.microsoft.com/en-us/rest/api/fabric/orgapp/items
  - url: https://learn.microsoft.com/en-us/rest/api/power-bi/apps
tools:
  fab: 1.7.0
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
skills: [fabric-cli/fabric-cli]
---

# Org apps versus workspace apps

Learn: [Get started with org apps](https://learn.microsoft.com/en-us/power-bi/explore-reports/org-app-items), [OrgApp Items REST API](https://learn.microsoft.com/en-us/rest/api/fabric/orgapp/items), [Apps REST API (workspace apps)](https://learn.microsoft.com/en-us/rest/api/power-bi/apps).

Two systems exist and coexist in one workspace. Do not mix their APIs.

```yaml
org app: Fabric item type OrgApp; generally available per the org apps article; many per workspace; live references to included items
workspace app (legacy Power BI app): one per workspace; versioned snapshot; published from workspace settings
```

## Tool reach

- Org app item API (Fabric audience, default `fab api`): create, get, list, update, delete, get and update definition, for example `fab api "workspaces/<ws-id>/orgApps"` (path from the Learn List Org Apps page). fab 1.7.0 lists `.OrgApp` in `fab desc`, but its release notes put OrgApp support at 1.9.0; Unverified which `fab ls`, `fab get` and `fab export` behaviours work on 1.7.0, so use REST.
- Workspace app API (`-A powerbi`): read-only. `apps`, `apps/<id>`, `apps/<id>/reports`, `apps/<id>/dashboards`, `apps/<id>/dashboards/<id>/tiles`. No create, publish, update, delete or audience endpoints.
- Admin: `admin/apps` requires `$top` (error without it); `admin/apps/<id>/users` lists users. Both need `Tenant.Read.All`; the earlier note gave 200 requests per hour (Unverified).
- User-scoped workspace app endpoints do not support service principals; admin endpoints do.

## Behaviour that differs from workspace apps

- Access to an org app grants at least read on included items and on the semantic models behind included reports and paginated reports, even in other workspaces. Removing a user revokes only the access that came through the org app.
- Changes are live after Save; a workspace app needs a republish.
- Adding or removing items or changing access needs write and reshare on the included items and their models. In practice that means workspace admin or member; contributors can edit only when access is unaffected.
- No automatic access for a paginated report visual's paginated report, or for the related items a Fabric App uses; grant those directly.
- Dashboards and scorecards cannot be included.
- Not supported yet: report toolbar comments, SSO for custom visuals, audience tabs and Fabric items on mobile.
- Audiences exist only in new org apps and are child items (`OrgAppAudience`).
