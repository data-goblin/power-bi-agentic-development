---
title: Reading usage metrics and deciding keep, redesign or retire
summary: What modern Usage Metrics numbers mean, their structural blind spots, and a defensible retire, keep or redesign verdict.
kind: decision
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/collaborate-share/service-modern-usage-metrics
  - url: https://learn.microsoft.com/en-us/rest/api/power-bi/admin/get-activity-events
tools:
  pbir: 0.9.33
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - pbir usage --help
  - pbir access --help
skills: [reports/review-report]
---

# Reading usage metrics

[Learn: modern usage metrics](https://learn.microsoft.com/en-us/power-bi/collaborate-share/service-modern-usage-metrics) defines the report. `pbir usage` pulls the same numbers; sources are in [usage sources](report-usage-sources.md).

## What the numbers mean

- **Report view** is server side, one event per open, and matches the audit log. **Report page view** is client side, one per page render; opening a report counts only the landing page, so a page with fewer views than the report is normal
- Page views are a floor: ad blockers, firewalls, offline use and embedding drop client telemetry silently. Call a page unused only when the whole report is unused, and first check it is reachable (`pbir ls --tree`) and is not a tooltip or drillthrough target
- A `Blank` page entry is a page added in the last 24 hours or since deleted
- Window: 30 days of data with daily refresh and up to 24 hours of lag. "No views" means none in 30 days, which is the wrong window for quarterly or annual reports; archive for longer trends
- App report pages and paginated reports are missing from the page table; the platform slicer understates mobile and embedded use
- "Unnamed users" is a tenant privacy setting, not missing data; a drop against the legacy report is a definition change

Confidence: report-level views, viewers and rank are high; page-level verdicts are lower and need a telemetry-loss caveat; "no views in 30 days" is medium until window and cadence are checked.

## Verdict

1. Match the window to the cadence: read date slicers, "as of" titles and period filters. An annual audit model untouched for 11 months stays; a weekly operational report with no views in 30 days is a real signal
2. Separate reach from adoption: 8 viewers out of 500 with access is a distribution problem before it is a report problem
3. Strip non-consumers before counting: service principals, creators and owners (activity events `CreateReport`, `UpdateReportContent`), IT and support, and one or two views near the creation date
4. Do not retire exception classes: executive scorecards with few high-value users, compliance content, seasonal reports
5. Read the trend: decline on a once-used report beats flat-low with no history
6. Emit one of: keep; investigate distribution (low actual against potential reach); redesign (used but poorly); retire (low reach, downward trend, no exception class, owner confirms)
7. Never retire without the owner or a subject expert confirming. For code-managed reports, soft-retire with a deprecation prefix and keep the definition in source control. `Get Unused Artifacts as Admin` looks back 30 days only

Subscriptions deliver snapshots without view events: a report with zero views and active subscribers is consumed passively (admin API `reports-get-report-subscriptions-as-admin`). Permission breadth is not consumption, and a small loyal team report is a valid case. Do not apply fixed "healthy" thresholds; they depend on audience and purpose.

## Trend

Use a rolling seven-day average of views and compare the current seven days with the prior seven; raw daily counts are noisy. Adjust for subscription recipients when comparing a subscribed report with an unsubscribed one.
