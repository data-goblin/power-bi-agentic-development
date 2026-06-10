# Usage Interpretation

Guidance for reading modern Usage Metrics data accurately and converting view counts into a retire/keep/redesign decision. Avoids the failure mode of drawing wrong conclusions from structural telemetry limitations.

## Modern Usage Metrics: What the Numbers Actually Mean

The modern Usage Metrics report has different metric definitions from the legacy report; treating them as equivalent produces wrong adoption verdicts.

### Report View vs Report Page View

- **Report View** (server-side): one event per report open, reliable, matches audit logs
- **Report Page View** (client-side): one event per page render

Opening a report increments page views only for the landing page. "Page X has fewer page views than the report has views" is normal, not evidence the page is unused.

### Structural Undercounting

Page-view undercounting is structural: ad blockers, firewalls, offline sessions, and embedded scenarios drop client telemetry silently. Low page-view counts are a floor, not a ceiling. Conclude "unused page" only when the whole report is unused, not from a page-level view count alone.

Before flagging an unused page, check:
- `pbir pages list` + navigators to confirm the page is reachable
- Whether the page is a tooltip page or drillthrough target (these legitimately have no direct views)

### The `Blank` Page Entry

`Blank` in the page slicer is not a real page; it represents pages added in the last 24h or since deleted. Do not investigate it.

### Window and Retention

- 30-day window, 30-day retention, daily refresh with up to 24h lag
- "No views" means no views in 30 days; that is the wrong window for quarterly or annual reports
- Archive via Analyze in Excel or a scheduled extract for longer trends

### Blind Spots

- App report pages and paginated reports are not in the Report pages table; absence of page views does not mean no engagement
- The platform slicer understates mobile/embedded usage precisely where client telemetry drops hardest; do not cite it as proof nobody uses mobile

### Confidence Calibration

Tag conclusions by confidence:
- Report-level verdicts (views, viewers, rank): high confidence
- Page-level verdicts: lower confidence; always add an explicit telemetry-loss caveat
- "No views in 30 days": medium confidence; check window vs cadence before acting

Other notes:
- `Unnamed Users` is a tenant privacy setting, not missing data
- A modern-vs-legacy "drop" in metrics is a definition change, not a regression

## Retire / Keep / Redesign Verdict

Low usage is a question, not an answer. Use the following steps to turn view counts into a defensible action.

### 1. Match the window to the cadence

Read date-slicer grain, "as of" titles, and period filters to infer the report's cadence before applying a 30-day lens. An annual auditor model untouched for 11 months must be kept; a weekly operational report with no views in 30 days is a real signal.

### 2. Separate reach from adoption

Potential reach (people with access) vs actual reach (people who viewed it) are different numbers. A 500-person group with 8 viewers is an adoption problem, not necessarily a report problem. Investigate distribution and onboarding before touching the report.

### 3. Filter the viewer list

Strip before counting:
- Service principals (`principalType: App`)
- Report creators/owners (identified via `UpdateReportContent`/`CreateReport` activity events)
- IT/support/admin users whose only activity is maintenance access
- One-or-two-time viewers in a narrow window near the report's creation date (likely developers or testers)

After filtering, work with the remaining consumer-only count.

### 4. Honor exception classes

Do not retire:
- Exec scorecards viewed by a small number of high-value users
- Compliance or audit content used intermittently but critical when needed
- Reports serving a seasonal cadence outside the 30-day window

### 5. Read trend, not level

A downward trend on a previously-used report is a stronger retire signal than flat-low with no prior history.

### 6. Emit a verdict

One of four outcomes:
- **Keep:** active reach, trend stable or rising, exception class, or cadence outside window
- **Investigate-distribution:** low actual reach relative to potential reach; distribution or onboarding issue
- **Redesign:** used but poorly (low per-viewer frequency, declining trend, design issues explaining the drop)
- **Retire:** low actual reach + downward trend + no exception class + confirmed by owner/SME

Always require owner/SME confirmation as the final gate before retiring.

### 7. Soft-retire for code-managed reports

Rename with a deprecation prefix rather than delete; leave the definition in source control. The admin REST `Get Unused Artifacts as Admin` only looks back 30 days, so trend decisions need archived activity history.

Notes:
- Never recommend deletion off a single 30-day "no views"
- Permission breadth is not consumption; a widely-shared report can still be unused
- A low-but-loyal personal/team-BI report with a small dedicated audience is a valid scenario, not a failure
