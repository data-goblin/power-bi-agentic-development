---
title: Where report usage data comes from and who can read it
summary: The four usage data tiers, their permissions and limits, and which parts are undocumented.
kind: reference
status: current
sources:
  - url: https://learn.microsoft.com/en-us/rest/api/power-bi/admin/get-activity-events
  - url: https://learn.microsoft.com/en-us/fabric/enterprise/powerbi/service-admin-auditing
  - url: https://learn.microsoft.com/en-us/power-bi/collaborate-share/service-modern-usage-metrics
  - url: https://learn.microsoft.com/en-us/rest/api/power-bi/admin/reports-get-report-subscriptions-as-admin
tools:
  pbir: 0.9.33
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 60
verified_by:
  - pbir usage --help
  - pbir access --help
skills: [reports/review-report]
---

# Where report usage data comes from

Start with `pbir usage` and `pbir access`: they use your `az login` token, resolve a local report to its published identity (`pbir report link`) and wrap the sources below.

```yaml
pbir usage <workspace|report>:  views, viewers, pages, load times, last visited. Add --model for richer page and viewer detail
pbir access <report>:           who can open it and at what tier; tries admin APIs first, falls back to a limited workspace-role view
```

## The tiers

```yaml
tier 1 (undocumented): workspace metrics endpoints behind the Usage Metrics report; any workspace role; 30 days; views, pages, load times
tier 2 (generation undocumented, querying official): the workspace usage metrics model; Contributor or higher; pbir usage --model generates a hidden model in the workspace
tier 3 (undocumented): the DataHub V2 listing; any signed-in user; last-visited timestamps across workspaces; no counts
tier 4 (official): admin Get Activity Events; Fabric administrator or a service principal; tenant-wide; no page views or load times
```

Tiers 1 to 3 are internal Microsoft surfaces that can change without notice: label any finding built on them as undocumented, and prefer tier 4 when admin access exists.

## Activity events (tier 4)

[Learn: Get Activity Events](https://learn.microsoft.com/en-us/rest/api/power-bi/admin/get-activity-events), page last updated 2025-10-08:

- `startDateTime` and `endDateTime` must fall in the same UTC day, within the last 28 days, wrapped in single quotes; follow the continuation token
- At most 200 requests per hour; most events show up within 30 minutes and can lag up to 60 ([Learn: track user activities](https://learn.microsoft.com/en-us/fabric/enterprise/powerbi/service-admin-auditing))
- `ExportReport` covers visual data export and report export (PDF, PPTX, PNG), `DownloadReport` covers PBIX download, and `AnalyzeInExcel` is a live connection, not an export; the list is on [Learn: operation list](https://learn.microsoft.com/en-us/fabric/admin/operation-list)
- Frequent Excel exports from a report mean it does not answer its users' questions; PDF and PPTX exports are usually benign snapshots

## Viewer hygiene

Exclude service principals (`principalType: App`), report creators, IT and support from adoption metrics. Identify them by activity (`CreateReport`, `UpdateReportContent`, `DeleteReport` on this report) and by one or two views close to creation. Expand security groups with Microsoft Graph `transitiveMembers`, since nested groups hide members; reach is then viewers in the window divided by people with access.

## Subscriptions

Email subscriptions produce no view events. Admin APIs list them per report ([Learn](https://learn.microsoft.com/en-us/rest/api/power-bi/admin/reports-get-report-subscriptions-as-admin)); a report with no views and active subscribers is consumed passively.
