---
name: review-report
version: 0.22.3
description: Actionable feedback on the quality, usage, and effectiveness of Power BI reports. Automatically invoke when the user asks to "review a report", "audit a report", "report usage analysis", "report health check", "find unused reports", "check if a report is being used", "assess report performance", "evaluate report quality".
---

# Reviewing Power BI Reports

Structured evaluation of Power BI reports to produce actionable feedback for developers and consultants. A report review assesses whether a report is effective, well-built, and actually being used. The output is a prioritized list of findings with concrete recommendations.

Note that the skill works on one of three scenarios:

1. Report under development: In this scenario, the focus is more on the report content, structure, organization, and performance based on accurately gathered requirements.
2. Report in testing: In this scenario, the focus might incorporate user feedback or check basic information about the deployed report in Power BI / Fabric.
3. Report in use: This is the ideal scenario, where the focus is usage; the ultimate definition of success is whether the report is being used; what percentage of the people who have access to the report have accessed it in the last 28 days, and how much? Bad reports aren't used, or have declining usage. 

In scenario 2-3 you may still provide feedback on the report content / structure, but prioritizing other things first.

## When to Use

Activate when conducting a report review, audit, or health check. Common triggers:

- Reviewing report quality before a release or handoff
- Assessing whether existing reports are worth maintaining
- Identifying optimization opportunities across a workspace
- Evaluating report design and data presentation effectiveness
- Investigating report performance issues

## Review Dimensions

A comprehensive report review evaluates six dimensions. Not every review needs all six -- scope to what the user needs.

### 1. Usage and Adoption

**The most objective signal of report value.** A report that nobody views is a maintenance liability regardless of its design quality.

**Retrieve usage data** with the scripts in `scripts/`:

```bash
# Workspace overview (views, rank, page views, load times)
python3 scripts/get_report_usage.py -w <workspace-id>
python3 scripts/get_report_usage.py -w <workspace-id> --include-datahub

# Single report deep-dive (daily views, per-viewer breakdown, page views by day)
python3 scripts/get_report_detail.py -w <workspace-id> -r <report-id>

# Distribution audit (who has access, through what channels)
python3 scripts/get_report_distribution.py -w <workspace-id> -r <report-id>
```

**Filtering viewers:** Exclude non-consumer users from adoption metrics. Service principals (type `App`), report developers, and IT / support personnel inflate viewer counts and distort reach. See `references/usage-metrics.md` for identification heuristics and `references/distribution.md` for resolving security groups and distribution lists via the Microsoft Graph API.

**Evaluate usage signals:**

- **Audience reach** is the most important metric: what percentage of users with access have actually viewed the report in the last 7, 28, and 60 days? See `references/distribution.md` for how to calculate reach and what the numbers mean.
- **View trends:** Is viewership stable, growing, or declining? Use the rolling 7D average (see `references/usage-metrics.md`).
- **Page view distribution:** Are views concentrated on one page or spread across the report? Concentration may indicate low-value pages.
- **Last visited:** When was the report last accessed by anyone? Cross-reference with DataHub `lastVisitedTimeUTC`.
- **Load times:** Are P50 and P90 load times acceptable for the audience? See `references/performance.md` for interpretation.

Do not use arbitrary thresholds for what constitutes "healthy" or "concerning"; these depend entirely on the report's audience, purpose, and lifecycle stage. A report for 3 analysts has different expectations than one for 300 executives.

**Subscriptions are not views.** Email subscriptions deliver report snapshots without generating view events. Check `admin/reports/{id}/subscriptions` (requires Fabric Admin) for active subscribers. A report with 0 views but active subscriptions is being consumed passively.

**Use rolling 7-day averages** for view trends. Raw daily counts are noisy. Compare the current 7D average to the prior 7D to identify trajectory. See `references/usage-metrics.md` for methodology.

**Key insight:** Reports with 0 views are not necessarily bad -- they may be new, seasonal, consumed via subscriptions, or used via embedded scenarios not captured in telemetry. Cross-reference with the `last_visited` timestamp from DataHub.

**Permissions:** Tier 1 (WABI) needs any workspace role. Tier 2 (model) needs workspace Contributor+. Distribution and subscription checks need Fabric Admin (tenant-level). See `references/usage-metrics.md` for the full permission matrix.

For additional context on the usage metrics dataset schema and available tables, see `usage-metrics-dataset/`.

### 2. Design and Layout

Evaluate the visual design and information architecture. Consult the `pbi-report-design` skill for detailed guidelines. Reference: [Data Goblins Report Checklist](https://data-goblins.com/power-bi/report-checklist).

**Checklist:**

- [ ] Page titles present and descriptive
- [ ] Visual spacing consistent (equal gaps between visuals and margins)
- [ ] Detail gradient followed (KPIs top-left, detail bottom-right)
- [ ] Color usage intentional and accessible (no gratuitous color, no red/green for colorblind users)
- [ ] Font family, size, and formatting consistent throughout
- [ ] Visual count reasonable (loosely 12-15 max per page, depends on complexity)
- [ ] No empty visuals (all visuals have field bindings)
- [ ] Theme applied (not default Power BI theme)
- [ ] Chart axes begin at zero (unless intentional)
- [ ] Default sort configured on all visuals
- [ ] Visual objects labelled clearly in the selection pane (grouped with descriptive names)
- [ ] Mobile layout provided if relevant audience
- [ ] Visual headers configured (disable when drill-down/through not needed)
- [ ] Interactions configured (cross-filtering/highlighting intentional, not default)
- [ ] Slicer 'Apply' buttons considered for performance-sensitive pages
- [ ] Synchronized slicers where required across pages

### 3. Data Model Binding

Evaluate the connection between the report and its underlying semantic model.

**Checklist:**

- [ ] Report connects to a published semantic model ("thin report") rather than embedding its own ("thick report")
- [ ] All field bindings resolve to existing model columns/measures
- [ ] Extension measures (thin report measures) used sparingly and only for report-specific logic
- [ ] No broken or orphaned field references
- [ ] Appropriate use of measures vs. columns in visuals (aggregation context)
- [ ] Separate filters are not active on visual-level

### 4. Performance

Assess report load time and visual complexity. Run the performance audit script:

```bash
python3 scripts/performance_audit.py -w <workspace-id> -r <report-id>
```

See `references/performance.md` for percentile interpretation, DAX query inference from visual field bindings, and common anti-patterns.

**Key indicators:** P50 and P90 load times, visual count per page (loosely 12-15 max, but depends on complexity), extension measure count. See the reference for interpretation; do not apply rigid thresholds.

### 5. Report Metadata and Governance

Assess the report's governance posture. See `references/report-metadata.md`.

**Checklist:**

- [ ] Thin report (connected to published model, not embedded thick model)
- [ ] Endorsement status appropriate for its audience (Certified for production, Promoted for team use)
- [ ] Sensitivity label applied if tenant policy requires it
- [ ] Part of a deployment pipeline if in a production workspace
- [ ] Distribution via workspace app or org app (not direct links or publish-to-web)
- [ ] Access granted via security groups, not individual users
- [ ] View-only access for consumers (Viewer role), edit access only for developers
- [ ] Export-to-Excel patterns reviewed for data governance risks (see `references/export-to-excel.md`)

### 6. Accessibility, Standards, and Documentation

Evaluate whether the report meets accessibility, organizational standards, and documentation requirements.

**Accessibility:**

- [ ] Alt text present on data visuals
- [ ] Color contrast meets WCAG 2.1 AA (4.5:1 for text, 3:1 for UI)
- [ ] No reliance on color alone to convey meaning
- [ ] Font sizes legible (min 9pt for data, 12pt for labels)
- [ ] Tab order and visual layer order established
- [ ] No unnecessary animations or shadows
- [ ] Tested across different screens, browsers, and contexts

**Standards:**

- [ ] Sensitivity labels applied if required by governance policy
- [ ] Naming conventions followed (report name, page names, visual titles)
- [ ] Link provided for users to report issues or submit feedback
- [ ] Filter combinations tested thoroughly

**Documentation (for handover/production):**

- [ ] Purpose statement: what business questions does the report answer?
- [ ] Intended audience and user segments identified
- [ ] Atypical features documented (visual-level filters, hidden slicers, bookmarks, custom visuals)
- [ ] Support personnel and procedures identified
- [ ] Training/adoption materials available for business users

## Review Workflow

### Step 1: Scope

Clarify what the user wants reviewed. Ask:
- Single report or workspace-wide audit?
- Which dimensions matter most? (usage, design, performance, all?)
- Is there a specific concern prompting the review?
- Where should findings be documented? (scratchpad, agent-docs, obsidian notebook, wiki, etc.)

### Step 1a: Determine Scope and Access

Ask the user:

- Do they have access to the underlying semantic model?
- Are they the developer of both the report and model, or only one?

If the semantic model is in scope, use the `review-semantic-model` skill in parallel. Many report issues (slow visuals, (Blank) values, missing fields) originate in the model. See `references/best-practices.md` for model symptoms that surface in reports.

### Step 1b: Determine Report Lifecycle Stage

If the report is local-only or not yet published, ask the user:

> "Is this a report in development which doesn't yet have users, a report in testing with a subset of the user audience, or a report that's already distributed and should be seeing active usage and value generation?"

This determines which dimensions are applicable:

| Stage | Usage data? | What to review |
|---|---|---|
| **Development** | No | Design, data model binding, performance, accessibility, structure |
| **Testing** | Partial | All of the above + verify testers are actually testing (views from test audience) |
| **Production** | Yes | All dimensions including full usage, distribution, and export analysis |

Remind the user: a report's success lives and dies on whether it is being used and delivering business value. Design, performance, and structure can be reviewed proactively, but usage data is the only objective measure of whether the report is working. Good requirements gathering helps achieve adoption, but it can never be guaranteed.

If the report is local-only, ask where the published version is (or will be). Usage metrics require a published report in the Power BI service.

### Step 2: Gather Data

Run the usage script for quantitative data. Export or inspect the report definition for qualitative assessment.

### Step 3: Evaluate

Walk through each relevant dimension using the checklists above. Score each finding by severity:

- **Critical**: Broken functionality, security risk, or completely unused report consuming capacity
- **High**: Performance issues impacting users, major design violations, missing data bindings
- **Medium**: Design inconsistencies, moderate performance concerns, partial accessibility gaps
- **Low**: Minor polish items, style preferences, optimization opportunities

### Step 4: Report Findings

Present findings as a structured summary. Lead with the most impactful findings.

**Format:**

```
REPORT REVIEW: <Report Name>
===============================

USAGE SIGNAL
  Views (30d): 47  |  Viewers: 8  |  Rank: #3/22
  Top pages: Overview (60%), Detail (30%), Trends (10%)
  Load time P50: 3.2s  |  P90: 7.1s

CRITICAL
  - [Performance] P90 load time exceeds 7s due to 14 visuals on Overview page

HIGH
  - [Design] No page titles on 2 of 3 pages
  - [Binding] 3 visuals have broken field references

MEDIUM
  - [Design] Inconsistent margins (24px left, 32px right)
  - [Accessibility] Missing alt text on 5 data visuals

LOW
  - [Design] Default theme applied; consider custom theme
  - [Standards] Report name uses spaces instead of hyphens
```

## Prerequisites

> Before running usage scripts, ensure:
> - Azure CLI authenticated: run `az login` if needed
> - `fab` CLI authenticated: run `fab auth login` if needed (for distribution script)
> - Python `requests` package: `uv pip install requests`

## References

- **`references/usage-metrics.md`** -- Full documentation of all usage data APIs (official and undocumented)
- **`references/distribution.md`** -- All report access paths and how to audit them
- **`scripts/get_report_usage.py`** -- Workspace-level usage overview
- **`scripts/get_report_detail.py`** -- Single report deep-dive (daily, per-viewer, per-page)
- **`scripts/get_report_distribution.py`** -- Distribution audit (ACL, apps, publish-to-web)
- **`scripts/performance_audit.py`** -- Load times + visual complexity analysis
- **`references/performance.md`** -- Percentile interpretation, DAX query inference from visual metadata
- **`references/report-metadata.md`** -- Thick/thin, endorsement, sensitivity, pipeline, model properties
- **`references/export-to-excel.md`** -- Export activity analysis, data governance implications
- **`references/best-practices.md`** -- Data visualization principles, chart selection, color, interaction design
- **`usage-metrics-dataset/`** -- Exported Usage Metrics dataset (TMDL schema + report definition)

## Related Skills

- **`review-semantic-model`** -- Companion skill for semantic model review (run in parallel when model is in scope)
- **`pbi-report-design`** -- Detailed report design guidelines and layout rules
- **`modifying-theme-json`** -- Theme authoring, compliance auditing, formatting promotion
- **`deneb-visuals`**, **`python-visuals`**, **`r-visuals`**, **`svg-visuals`** -- Visual-specific review criteria
