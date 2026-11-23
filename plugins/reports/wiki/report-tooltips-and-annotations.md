---
title: Tooltip pages and annotation primitives
summary: When a report-page tooltip earns its queries, how to size it, and how to compose reference lines and callouts into a guided-analysis layer.
kind: gotcha
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-tooltips
tools:
  pbir: 0.9.33
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - pbir pages set-tooltip --help
  - pbir visuals reference-line add --help
skills: [reports/pbi-report-design]
---

# Tooltip pages and annotations

[Learn: tooltips](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-tooltips) covers the setup.

## Tooltip pages

A report-page tooltip is a small designed canvas. Three legitimate intents: a different view of the same data (hover a month, see the year), more attributes at the same grain, or a static explainer behind the visual header icon.

- One or two extra numbers belong in the Tooltip field well, not a page; anything the reader must interact with is drillthrough, not a tooltip
- `pbir pages set-tooltip "R.Report/Tip.Page" --width 320 --height 240` (defaults); design at final pixels with `ActualSize`, because it does not scale. The report-level "tooltip size affected by canvas size" setting is not a per-page PBIR property: flag it to the owner
- Strip chrome harder than on a normal page (`pbir visuals background "Tip.Page/*.Visual" --no-show`, titles off), one focal visual plus at most a card or two; one page can serve many source visuals
- Hidden tooltip pages still count in page and visual budgets and cost a query per hover: delete one that restates what the point already shows, consolidate near-duplicates
- No page-level filter on a tooltip page: the hover is the filter

## Annotation primitives

Compose existing PBIR parts; do not invent a new object.

```bash
ID=$(pbir visuals reference-line add "P.Page/Hero.Visual" --value "Targets.Revenue")
pbir set "P.Page/Hero.Visual.y1AxisReferenceLine.id($ID).lineColor" --value "#C62828"
```

- Target line: a reference line bound to a target measure with its data label on, labelled by the measure ("Plan: 11.0M"). Adds are not idempotent: capture the returned id ([structural gotchas](pbir-structural-gotchas.md))
- Highlight and grey: the hero series in a brand colour, the rest grey, through a measure-driven conditional colour (more robust than per-series selectors, which break when the data changes)
- Callout: a chrome-off textbox plus a thin shape as leader line, as separate visuals so each can be copied and themed alone
- Reveal pacing: a page sequence with a page navigator beats bookmarks for step-by-step stories; keep bookmarks for in-page state toggles
- Reading order: set `tabOrder` headline, hero visual, callouts, detail

Weak-narrative flags BPA does not catch: a headline that labels the chart type instead of stating a finding, every series at full saturation with no grey context, a target line whose data label is off, callouts whose `tabOrder` ignores the story, a story carried only by a Copilot narrative visual. A wall of callouts hurts accessibility because a screen reader walks them in `tabOrder`.
