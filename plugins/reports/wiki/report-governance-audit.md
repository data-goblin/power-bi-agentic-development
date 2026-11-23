---
title: Report governance checks and the admin APIs behind them
summary: Thick or thin detection, endorsement, sensitivity labels, pipelines and the access paths to audit, with the admin REST docs that back each.
kind: reference
status: current
sources:
  - url: https://learn.microsoft.com/en-us/rest/api/power-bi/admin/reports-get-reports-as-admin
  - url: https://learn.microsoft.com/en-us/rest/api/power-bi/admin/widely-shared-artifacts-published-to-web
  - url: https://learn.microsoft.com/en-us/rest/api/power-bi/admin/workspace-info-post-workspace-info
tools:
  pbir: 0.9.33
  fab: 1.7.0
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - pbir access --help
  - fab api --help
skills: [reports/review-report]
---

# Report governance checks

`pbir access` answers "who can open this report and through which channel" in one call. The admin APIs below answer the rest; each needs the Fabric administrator role unless stated. `fab api -A powerbi "<path>"` calls them with your signed-in identity.

## Thick or thin

No API field says it. Infer: a report in a different workspace than its model is thin (`datasetWorkspaceId` against the report's workspace); a workspace with one model per report suggests thick reports; `pbir model "R.Report"` on a local copy states `byPath` (thick) or `byConnection` (thin).

## Metadata

```yaml
endorsement:  scanner API (POST admin/workspaces/getInfo, then GET admin/workspaces/scanResult/<id>) returns endorsementDetails and sensitivity label
sensitivity:  same scan, or the report entry from admin Get Reports as Admin
pipelines:    admin pipelines list and stages; match the workspace id to find the pipeline
format:       report entry 'format' (PBIX or PBIR) from groups/{ws}/reports/{id}
```

Review guidance: Certified for production, Promoted for team use; a sensitivity label where tenant policy requires one; production workspaces belong to a pipeline.

## Access paths to audit

```yaml
workspace role:  groups/{ws}/users (workspace admin); Viewer for consumers, edit only for developers
direct share:    admin Get Report Users as Admin; the workspace-level call returns fewer results
workspace app:   admin Get Apps as Admin, then Get App Users as Admin
org app:         same, filtered by the workspace's reports
publish to web:  admin widely-shared-artifacts published-to-web (a finding unless intended and public data)
org-wide links:  admin widely-shared-artifacts links-shared-to-whole-organization
```

Prefer distribution through an app, access through security groups, and Viewer role for consumers. Direct share links and publish to web are findings to question, not proof of a defect.

## Export behaviour

See [usage sources](report-usage-sources.md) for the export activity types and the activity-event limits.
