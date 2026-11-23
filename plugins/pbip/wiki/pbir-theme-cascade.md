---
title: Which formatting wins in a PBIR report
summary: The order of precedence between defaults, theme wildcards, theme visual types and visual.json, and what to put where
kind: reference
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-report-themes
tools:
  pbir: 0.9.33
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - pbir theme --help
skills: [pbip/pbir-format]
---

# Which formatting wins in a PBIR report

From weakest to strongest:

1. Power BI defaults
2. theme wildcard (`*`) entries
3. theme entries for one visual type
4. the `objects` and `visualContainerObjects` in a single `visual.json`

This is the cascade in the report themes documentation as read for this page; the order was not re-tested by rendering. Consequence: put shared formatting in the theme, so a change happens once, and keep `visual.json` for what one visual does differently. `pbir theme push-visual` moves a formatted visual's settings into the theme.

- Theme files live in `StaticResources/RegisteredResources/` (custom) and `StaticResources/SharedResources/BaseThemes/` (Microsoft base themes). `report.json` `themeCollection` points at them, and a resource listed there but missing on disk blocks opening the report. `validate_pbip.py` in the pbip skill checks that the files exist
- `objects` formats the visual's content; `visualContainerObjects` formats the container (title, background, border, tooltip, alt text). A name Desktop does not know in `visualContainerObjects` is ignored without an error; `pbir validate --semantic` checks the names against the core visual catalog
- Theme changes need a Desktop restart to show, per the pbip skill
