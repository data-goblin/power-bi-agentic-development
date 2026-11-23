---
title: Verifying a report change rendered
summary: Which checks prove a PBIR change worked, which only prove structure, and the round-trip noise to ignore when comparing.
kind: gotcha
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report
  - url: https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-performance-analyzer
tools:
  pbir: 0.9.33
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - pbir validate plugins/reports/wiki/examples/K201-MonthSlicer.Report
  - pbir visuals test --help
skills: [reports/pbir-cli]
---

# Verifying a report change rendered

[Learn: PBIR format](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report) explains the folder layout. It does not say what a structurally valid report can still get wrong.

## What each check proves

```yaml
pbir validate --all:   JSON, schema, field existence, layout QA, catalog names. Not rendering
pbir bpa run:          governance and layout rules. A clean run is not a good design
pbir visuals test:     times each visual's DAX query; proves the query runs, not how it looks
pbir desktop screenshot: the only local proof of rendering (Windows only, report view active)
publish to sandbox + browser screenshot: the proof everywhere else; ask before publishing
```

A valid write can be renderer-inert: modern visuals keep many objects under instance selectors, and a plain value in the wrong shape passes the schema and renders nothing. Prefer plain paths on a current `pbir` (it routes known objects to the selector Desktop expects). If a value reads back but does not render, `pbir cat` a visual that was formatted by hand in Desktop and compare the selector shape before adding a one-off path.

## Fast loop for renderer-sensitive work

```bash
pbir schema describe cardVisual label
pbir visuals format "Report.Report/Page.Page/Card.Visual" -p label -v
pbir validate "Report.Report"
pbir visuals test "Report.Report/Page.Page/Changed.Visual"
```

Publish after each coherent batch once the user has authorised regular publishing; take `pbir backup` first when a before-state matters. Verify conditional formatting in the service reading view on a fresh load: an open edit canvas renders session state, not the published definition.

## Comparing a user's manual edit

Download into a new folder (`pbir download`), never over the working copy. Compare effective formatting with `pbir visuals format --json` (it merges theme and local layers); raw JSON diffs are mostly noise. Ignore these unless a renderer or semantic effect is shown:

- `.platform` display names and other service-owned metadata
- base theme rewrites and key ordering
- visual schema URL and version advances
- escaping inside custom format strings
- selector or order canonicalisation

Power BI Desktop can declare a visual schema version before Microsoft publishes it; keep the declared version and accept degraded validation (`SCHEMA_PROCESSED_SUPPORT_UNAVAILABLE`, severity info) instead of downgrading.

## New Card (`cardVisual`)

- `layout.alignment = top` moves the whole callout, image and reference-label group; `image.verticalAlignment = middle` centres only the icon. Setting the second alone leaves the group misplaced.
- Use the container title or the internal `label`, not both.
- Native table width modes are mutually exclusive: `--stretch-columns` sets `autoSizeColumnWidth=false` and `columnAdjustment=growToFit`; `--fit-columns-to-content` sets `autoSizeColumnWidth=true` and `columnAdjustment=fitToContent`. Remove stale `customColumnWidth` overrides when switching.

## Orphaned resources

Service and Desktop round trips can drop unreferenced registered resources. After clearing a page or theme background image, check `RegisteredResources` for orphans, including references from bookmarks, before removing one explicitly with `pbir rm "Report.Report" --image <item_name> -f`.

## Example

`examples/K201-MonthSlicer.Report` is a real PBIR report with a before and an after page; `pbir validate` accepts it with warnings and info only (hidden visual, undersized slicer, schema versions newer than the bundled catalog).
