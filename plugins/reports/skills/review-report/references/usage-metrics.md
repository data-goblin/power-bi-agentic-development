# Power BI Report Usage APIs

Complete reference for retrieving report usage data programmatically. Includes both official (documented) and internal (undocumented) APIs.

## API Tiers Overview

| Tier | Source | Minimum Permission | Scope | View Counts | Page Views | Load Times |
|---|---|---|---|---|---|---|
| 1 | WABI Metrics | Workspace Viewer | Workspace | Yes | Yes | Yes |
| 2 | Usage Metrics Model | Workspace Contributor | Workspace | Yes | Yes | Yes |
| 3 | DataHub V2 | Any authenticated user | Cross-workspace | No | No | No |
| 4 | Activity Events | Fabric Admin (tenant) | Tenant-wide | Yes | No | No |

**Tier 1 is generally the recommended default** -- it provides page views and load times directly via WABI endpoints (`reportpagesectionviews`, `reportloads`) without needing to generate a model. Tier 2 is only needed for the pre-built DAX measures (trend calculations, percentile measures, rank strings). Note that 1-3 are all going via undocumented APIs.

## Permission Requirements by API

| API / Endpoint | Required Role | Notes |
|---|---|---|
| WABI `/reportviews` | Workspace Viewer+ | Any workspace role |
| WABI `/reportpagesectionviews` | Workspace Viewer+ | Any workspace role |
| WABI `/reportloads` | Workspace Viewer+ | Any workspace role |
| WABI `/reportmetadata` | Workspace Viewer+ | Any workspace role |
| WABI `/reportpagesectionmetadata` | Workspace Viewer+ | Any workspace role |
| WABI `/reportrank` | Workspace Viewer+ | Any workspace role |
| Usage Metrics Model generation | Workspace Contributor+ | Contributor, Member, or Admin |
| `executeQueries` (DAX on model) | Workspace Contributor+ | Same as model generation |
| DataHub V2 `/artifacts` | Any authenticated user | Cross-workspace; no role needed |
| `admin/activityevents` | **Fabric Admin (tenant-level)** | Tenant admin role in Fabric/Power BI |
| `admin/reports/{id}/subscriptions` | **Fabric Admin (tenant-level)** | Tenant admin role |
| `admin/reports/{id}/users` | **Fabric Admin (tenant-level)** | Tenant admin; broader than workspace `groups/{id}/reports/{id}/users` |
| `admin/users/{id}/subscriptions` | **Fabric Admin (tenant-level)** | Tenant admin role |
| `admin/widelySharedArtifacts/*` | **Fabric Admin (tenant-level)** | Publish-to-web and org-wide sharing checks |
| `admin/apps` | **Fabric Admin (tenant-level)** | List all org apps |
| `groups/{wsId}/users` | Workspace Admin | Workspace-level admin role |
| `groups/{wsId}/reports/{id}/users` | Workspace Admin | Workspace-level; returns fewer results than admin API |

**Key distinction:**
- **Workspace roles** (Viewer, Contributor, Member, Admin) are per-workspace and control access to items within that workspace
- **Fabric Admin** (also called Power BI Admin or Tenant Admin) is a tenant-wide role granting access to all `admin/*` API endpoints across all workspaces

## Tier 1: WABI Metrics Endpoints (Undocumented)

Internal Power BI endpoints that return usage data without generating a model. These are the same endpoints used by the Power Query M expressions inside the Usage Metrics Report's semantic model.

**Base URL:** `https://{cluster-host}/metadata/v201906/metrics/workspace/{workspaceId}/`

The cluster host is region-specific. Common values:

| Region | Host |
|---|---|
| West Europe | `wabi-west-europe-e-primary-redirect.analysis.windows.net` |
| US East | `wabi-us-east-a-primary-redirect.analysis.windows.net` |
| UK South | `wabi-uk-south-a-primary-redirect.analysis.windows.net` |

Discover the cluster host from any Power BI API response's `home-cluster-uri` header.

### reportviews

Individual report view events for the workspace (last 30 days).

```
GET /metadata/v201906/metrics/workspace/{wsId}/reportviews
```

**Response fields:**

| Field | Type | Description |
|---|---|---|
| ReportId | string | Report GUID |
| ReportType | string | `PowerBIReport` or `PaginatedReport` |
| ReportName | string | Display name |
| CreationTime | datetime | When the view occurred |
| AppName | string | App name if viewed via app, else null |
| UserKey | string | Hashed user identifier |
| UserId | string | User email (if per-user data enabled) |
| UserAgent | string | Browser user agent string |
| DatasetName | string | Connected semantic model name |
| DistributionMethod | string | `Workspace`, `App`, `ShareLink`, etc. |
| CapacityId | string | Capacity GUID |
| CapacityName | string | Capacity display name |
| ConsumptionMethod | string | `Power BI Web`, `Power BI Mobile`, etc. |

### reportmetadata

Report names and IDs for the workspace.

```
GET /metadata/v201906/metrics/workspace/{wsId}/reportmetadata
```

**Response fields:** `ReportId`, `ReportName`, `WorkspaceId`, `OrganizationId`, `IsUsageMetricsReport`

### reportpagesectionmetadata

Page names and section IDs per report (current pages only).

```
GET /metadata/v201906/metrics/workspace/{wsId}/reportpagesectionmetadata
```

**Response fields:** `ReportId`, `SectionId`, `SectionName`, `WorkspaceId`

### reportrank

Report view counts and organization-wide ranking.

```
GET /metadata/v201906/metrics/workspace/{wsId}/reportrank
```

**Response fields:**

| Field | Type | Description |
|---|---|---|
| ReportId | string | Report GUID |
| WorkspaceId | string | Workspace GUID |
| ReportViewCount | int | Total views in ranking period |
| ReportRank | int | Rank among all org reports (1 = most viewed) |
| TotalReportCount | int | Total reports in org |
| TenantId | string | Tenant GUID |

### reportpagesectionviews

Individual page-level view events with section IDs and timestamps. Joins to `reportpagesectionmetadata` for page names.

```
GET /metadata/v201906/metrics/workspace/{wsId}/reportpagesectionviews
```

**Response fields:**

| Field | Type | Description |
|---|---|---|
| Timestamp | datetime | When the page was viewed |
| ReportId | string | Report GUID |
| SectionId | string | Page section GUID (join to reportpagesectionmetadata) |
| UserId | string | User AAD GUID |
| UserKey | string | Hashed user identifier |
| Client | string | `Power BI Web`, `Power BI Mobile`, etc. |
| DeviceOSVersion | string | OS version (e.g. `Mac OS X 10.15`) |
| DeviceBrowserVersion | string | Browser version (e.g. `Chrome 145.0`) |
| GroupId | string | Workspace GUID |
| AppName | string | App name if viewed via app, else null |
| PbiCluster | string | WABI cluster name |

### reportloads

Report load time events with start/end timestamps and geographic location.

```
GET /metadata/v201906/metrics/workspace/{wsId}/reportloads
```

**Response fields:**

| Field | Type | Description |
|---|---|---|
| Timestamp | datetime | Event timestamp |
| ReportId | string | Report GUID |
| UserId | string | User AAD GUID |
| StartTime | datetime | When report load started |
| EndTime | datetime | When report load completed |
| LocationCity | string | City of the viewer (e.g. `Brussels`) |
| LocationCountry | string | Country of the viewer (e.g. `Belgium`) |
| Client | string | `Power BI Web`, `Power BI Mobile`, etc. |
| DeviceOSVersion | string | OS version |
| DeviceBrowserVersion | string | Browser version |
| GroupId | string | Workspace GUID |
| PbiCluster | string | WABI cluster name |
| AppName | string | App name if via app, else null |

**Note:** Load time in seconds = `(EndTime - StartTime).total_seconds()`. This is the raw measurement; the Usage Metrics Model computes `loadTime` as a calculated column from these fields.

### dashboardviews

Individual dashboard view events (same structure as reportviews).

```
GET /metadata/v201906/metrics/workspace/{wsId}/dashboardviews
```

## Tier 2: Usage Metrics Model (Undocumented Generation, Official Querying)

The Usage Metrics Model is a hidden semantic model generated per workspace. It contains detailed page-level views, load times, and performance data collected from client telemetry.

### Generating the Model

```
GET https://{cluster-host}/beta/myorg/groups/{wsId}/usageMetricsReportV2
```

Returns 200 or 202. The response includes the model metadata with `models[0].dbName` containing the dataset GUID. This is the same action as clicking "View usage metrics" in the Power BI service UI.

**Requirements:** Workspace Contributor, Member, or Admin role.

### Querying the Model

Use the standard Power BI `executeQueries` API:

```
POST https://api.powerbi.com/v1.0/myorg/groups/{wsId}/datasets/{datasetId}/executeQueries

{
  "queries": [{"query": "EVALUATE 'Report page views'"}],
  "serializerSettings": {"includeNulls": true}
}
```

### Available Tables

**Report views** -- Individual report open events (server-side telemetry).

Columns: `ReportId`, `ReportType`, `ReportName`, `AppName`, `UserKey`, `UserId`, `UserAgent`, `DatasetName`, `CapacityId`, `CapacityName`, `Date`, `CreationTime`, `DistributionMethod`, `OriginalConsumptionMethod`, `ConsumptionMethod`

**Report page views** -- Page-level view events (client-side telemetry).

Columns: `AppName`, `UserId`, `ReportId`, `Date`, `Timestamp`, `AppGuid`, `Client`, `DeviceBrowserVersion`, `DeviceOSVersion`, `WorkspaceId`, `OriginalWorkspaceId`, `OriginalReportId`, `SectionId`, `TenantId`, `SessionSource`, `UserKey`

Note: `SectionId` joins to `Report pages.SectionId` for page names.

**Report pages** -- Current page names per report.

Columns: `ReportId`, `SectionId`, `SectionName`, `WorkspaceId`

**Report load times** -- Performance data per report load (client-side telemetry).

Columns: `Timestamp`, `PbiCluster`, `AppName`, `TenantId`, `UserId`, `ReportId`, `GroupId`, `Client`, `StartTime`, `EndTime`, `DeviceOSVersion`, `LocationCity`, `Country`, `loadTime`, `Date`, `OriginalReportId`, `OriginalGroupId`, `DeviceBrowserVersion`, `Browser`, `AppGuid`, `SessionSource`

**Reports** -- Report catalog for the workspace.

Columns: `OrganizationId`, `ReportGuid`, `ReportName`, `WorkspaceId`, `IsUsageMetricsReport`

**Users** -- User lookup (derived from Report views).

Columns: `UserId`, `UserKey`, `UserGuid`, `UniqueUser`

**Report rank** -- Organization-wide report ranking.

Columns: `ReportId`, `WorkspaceId`, `ReportViewCount`, `ReportRank`, `TotalReportCount`, `TenantId`

**Workspace views** -- Aggregated views per report/user/method.

Columns: `ReportId`, `UserId`, `DistributionMethod`, `ConsumptionMethod`, `Views`, `UserKey`, `UniqueUser`

**Model measures** -- Pre-built DAX measures.

| Measure | Formula | Description |
|---|---|---|
| Report views | `COUNTROWS('Report views')` | Total report opens |
| Report viewers | `DISTINCTCOUNT('Report views'[UserKey])` | Unique viewers |
| Page view share | `DIVIDE(COUNTROWS('Report page views'), CALCULATE(COUNTROWS('Report page views'), ALL(...)))` | Page's share of total |
| View trend | Compares first vs second half of period | Engagement trend |
| P-50 | `PERCENTILE.INC('Report load times'[loadTime], 0.5)` | Median load time |
| P-10 / P-90 | PERCENTILE at 0.1 / 0.9 | Load time range |

### Limitations

- Page views use client telemetry; can be undercounted due to ad blockers or network issues
- Load times use client telemetry; similar undercounting risk
- Model data covers last 30 days
- Private link environments may not capture client telemetry

## Tier 3: DataHub V2 API (Undocumented)

Cross-workspace metadata including `lastVisitedTimeUTC` -- when any user last accessed an item. The existing `search_across_workspaces.py` script in the `fabric-cli` skill provides full access to this API.

```
POST https://{cluster-host}/metadata/datahub/V2/artifacts

{
  "filters": [{"datahubFilterType": "workspace", "values": ["<wsId>"]}],
  "supportedTypes": ["PowerBIReport"],
  "tridentSupportedTypes": ["powerbireport"],
  "pageSize": 200,
  "pageNumber": 1
}
```

**Unique fields not available elsewhere:**

| Field | Description |
|---|---|
| `lastVisitedTimeUTC` | When item was last opened by any user |
| `lastRefreshTime` | When model data was last refreshed |
| `isDiscoverable` | Whether item appears in search |
| `permissions` | Numeric permission level |

## Tier 4: Activity Events API (Official, Admin Required)

The official admin API for audit logging. Returns server-side activity events for the entire tenant.

```
GET https://api.powerbi.com/v1.0/myorg/admin/activityevents?startDateTime='YYYY-MM-DDT00:00:00'&endDateTime='YYYY-MM-DDT23:59:59'
```

**Key activity types for reports:** `ViewReport`, `ShareReport`, `UpdateReportContent`, `CreateReport`, `DeleteReport`, `ExportReport`

**Limitations:**
- Only report-level events (no page views)
- Admin role required
- Maximum 1 day per request
- Up to 28 days of history
- Continuation token pagination required for large result sets
- Rate limited to 200 requests per hour

**ViewReport event fields:** `ReportId`, `ReportName`, `ReportType`, `DatasetId`, `DatasetName`, `WorkspaceId`, `WorkSpaceName`, `UserId`, `CreationTime`, `DistributionMethod`, `ConsumptionMethod`, `CapacityId`, `CapacityName`, `UserAgent`, `ClientIP`

## Email Subscriptions

Email subscriptions deliver report snapshots to users on a schedule. Subscription recipients receive the report without actively viewing it in the Power BI service. This means **subscription-delivered views do not count as report views** in the usage metrics data. A report may have active subscribers who never appear in the view counts.

When evaluating adoption, check subscriptions separately to get a complete picture of report consumption.

### Get Report Subscriptions (Admin)

```bash
fab api -A powerbi "admin/reports/{reportId}/subscriptions"
```

**Response fields:**

| Field | Type | Description |
|---|---|---|
| id | string | Subscription GUID |
| title | string | Subscription name |
| artifactId | string | Report GUID |
| artifactDisplayName | string | Report name |
| subArtifactDisplayName | string | Subscribed page name (if page-specific) |
| isEnabled | bool | Whether subscription is active |
| frequency | string | Delivery cadence (Daily, Weekly, etc.) |
| startDate | datetime | Subscription start |
| endDate | datetime | Subscription end |
| users | array | Recipients (email addresses) |

### Get User Subscriptions (Admin)

```bash
fab api -A powerbi "admin/users/{userId}/subscriptions"
```

Returns all subscriptions for a specific user across all workspaces.

### Subscription Activity Events

Subscription-related activities in the activity log:

| Activity | Description |
|---|---|
| `CreateEmailSubscription` | New subscription created |
| `UpdateEmailSubscription` | Subscription modified |
| `DeleteEmailSubscription` | Subscription deleted |

### Interpreting Subscriptions in a Review

- A report with 0 views but active subscriptions is being consumed passively -- it is not unused
- Count subscription recipients as part of the effective audience, but note they are passive consumers
- If subscription recipients never also view the report interactively, the report may benefit from being converted to a paginated report or automated email (lower overhead)

## Analyzing View Trends

### Rolling 7-Day Average

Raw daily view counts are noisy (weekends, holidays, one-off spikes). Use a rolling 7-day average to identify the underlying trend. When presenting usage data:

1. Calculate the 7-day rolling average of daily views
2. Compare the current 7-day average to the previous period
3. Flag reports where the 7-day average is declining consistently

**Interpretation:**

| 7D Avg Trend | Signal |
|---|---|
| Stable or rising | Report has consistent, healthy adoption |
| Declining over 2+ weeks | Adoption is dropping; investigate cause |
| Spike then decline | One-time interest (launch, presentation); not sustained |
| Flat near zero | Report is unused or only viewed occasionally |

**Implementation:** The `reportviews` endpoint (Tier 1) returns individual view events with `CreationTime`. Group by day, compute the rolling average over 7-day windows, and compare the most recent window to the prior window.

### Adjusting for Subscription Recipients

When reporting total consumption, combine:

```
Total active consumers = unique interactive viewers + unique subscription recipients
```

But note that interactive viewers and subscription recipients may overlap. Deduplicate by email address when possible.

## Filtering Viewers for Accurate Adoption Metrics

Raw usage data includes views from developers, admins, and service principals alongside real consumers. For an accurate picture of report adoption, filter the viewer data.

### Exclude from Consumer Metrics

| Principal Type | Identification | Rationale |
|---|---|---|
| Service principals | `principalType: App` in ACL data; no email address | Automation, not human consumption |
| Report developers | Workspace Admin/Member/Contributor who also have `UpdateReportContent` or `CreateReport` activity events for this report | Development views, not consumption |
| IT/support admins | Users with Fabric Admin role; users whose only activity is admin operations | Maintenance access |

### Identification via Activity Events

Cross-reference viewer `UserId` values against the Activity Events API (Tier 4). A user whose activities for a report include `UpdateReportContent`, `CreateReport`, or `DeleteReport` is likely a developer, not a consumer. A user whose only activity is `ViewReport` is likely a consumer.

```bash
# Get activity events and filter for a specific user + report
fab api -A powerbi "admin/activityevents?startDateTime='...'&endDateTime='...'"
# Filter results by UserId and ReportId, check Activity field
```

### View Pattern Heuristics

When activity event access is unavailable, use view patterns as a proxy:

- **Developer pattern:** Burst of views clustered around report edit dates, then drops off
- **Consumer pattern:** Regular views spread across days/weeks (daily check-in, weekly review)
- **One-time tester:** Views only in a narrow window near the report's creation date

### Security Groups and Distribution Lists

Power BI APIs do not expand group membership. A group like `Sales-Team@contoso.com` appears as one ACL entry but may represent dozens of users. See `references/distribution.md` for how to expand groups via the Microsoft Graph API (`/groups/{id}/transitiveMembers`).

When group expansion is not possible, note the group names and flag that the actual audience size is unknown. The reach percentage will be inaccurate if significant access is granted via groups.

## Authentication

All APIs use Azure AD bearer tokens with the Power BI API resource scope:

```
Resource: https://analysis.windows.net/powerbi/api
```

Obtain via Azure CLI:
```bash
az account get-access-token --resource https://analysis.windows.net/powerbi/api
```

Or via `fab` CLI (handles auth internally for standard API calls via `fab api -A powerbi`).

## Exported Dataset Schema

The `usage-metrics-dataset/` directory contains a full export of the Usage Metrics Report (both the `.Report` and `.SemanticModel` definitions). The TMDL files in `Usage Metrics Report.SemanticModel/definition/tables/` document the complete schema including:

- Column definitions and data types
- Power Query M source expressions revealing WABI endpoint patterns
- Pre-built DAX measures for common analytics
- Relationships between tables
