---
title: "Filter pane decisions: lock, hide, rename, order"
summary: Which filter cards to lock or hide, how renaming and ordering work, and the report settings that change the pane for every reader.
kind: decision
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/create-reports/power-bi-report-filter
tools:
  pbir: 0.9.33
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - pbir filters lock --help
  - pbir filters hide --help
  - pbir filters pane-set --help
skills: [reports/pbi-report-design]
---

# Filter pane decisions

[Learn: filters in reports](https://learn.microsoft.com/en-us/power-bi/create-reports/power-bi-report-filter) covers the UI. These are the decisions it leaves to you.

## Lock or hide

```yaml
lock: card stays visible and read-only. Use for scope guards the reader should see ("Region = EMEA")
hide: card is removed. Use for data cleanup (exclude nulls, test SKUs)
rule: lock to inform, hide to clean. Never hide a business filter the reader expects: they cannot tell why numbers look filtered
```

`pbir filters lock`, `unlock`, `hide`; hiding the whole pane does not lock or hide individual cards (Learn).

## Rename and order

- The card title is independent of the model field: `pbir filters rename` replaces jargon (`'D_SHOP'[Reporting Row Name]`) with "Report Line". A matching slicer keeps its old header: rename it too
- The pane groups cards by scope (report, page, visual); order can change only inside a scope. A page-level filter the reader must reach first belongs in a slicer on the canvas

## Applied versus available

Style the two card states differently in the theme with the `$id` discriminator (`Available`, `Applied`) so readers see what is active. Pane styling is set at theme or page level, not report level: `pbir filters pane-set "R.Report" --bg-color "#F0F8FF"`. See [theme cascade](report-theme-cascade.md).

## Report-level settings

- Search in the pane: on when there are many cards, off for a curated two or three
- Allow users to change filter types: off when a card is deliberately Top N or relative date
- Apply button (Options, Query reduction): on for slow DirectQuery or large Import models, off when instant cross-filtering is better ([interactivity](report-interactivity.md))
- "Don't allow end users to save filters": for shared or kiosk reports that must open clean

## Pitfalls

- Publish-to-web does not show the filter pane ([Learn](https://learn.microsoft.com/en-us/power-bi/create-reports/power-bi-report-filter#considerations-and-limitations)): put essential filters in canvas slicers
- Renaming a card does not rename slicers on the same field
