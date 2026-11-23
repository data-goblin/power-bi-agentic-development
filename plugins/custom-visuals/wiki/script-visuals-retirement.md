---
title: Retirement of R and Python visuals
summary: What stops in May 2027, how to find affected reports, and where each visual can go instead.
kind: gotcha
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/create-reports/script-visuals-overview
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 60
skills: [custom-visuals/python-visuals, custom-visuals/r-visuals, custom-visuals/powerbi-custom-visuals]
---

# Retirement of R and Python visuals

Learn ([script visuals overview](https://learn.microsoft.com/en-us/power-bi/create-reports/script-visuals-overview), dated 2026-11-06) states that R and Python visuals, including R-powered custom visuals, retire in May 2027.

```yaml
power_bi_service: R and Python visuals stop rendering in published reports, including reports published before retirement
r_powered_custom_visuals: also stop
future_desktop: the visuals are removed; they cannot be added
older_desktop: keeps rendering locally with the local R or Python installation
not_affected: Python scripts in Power Query that populate tables
no_automatic_migration: each visual must be replaced by a different visualization
```

## Find the affected reports

In a PBIP or Git-integrated workspace, search the report definitions for the `visualType` values:

```bash
grep -rlE '"visualType": "(pythonVisual|scriptVisual)"' --include=visual.json .
```

- `pythonVisual` is a Python visual and `scriptVisual` is an R visual
- Neither value identifies an R-powered custom visual from AppSource; review the custom visuals of every report separately
- Save each script and its package list before replacing the visual

## Where to move each visual

Learn lists these, in this order of preference:

```yaml
built_in_visual: first choice
existing_custom_visual: from AppSource or the organization
new_custom_visual: pbiviz SDK, see the powerbi-custom-visuals skill; Learn notes AI coding tools can help
fabric_notebook: recreate the analysis outside the report
fabric_app: for visualizations a report cannot reproduce
```

This plugin adds two more report-level options that need no SDK: a Deneb Vega-Lite spec (static or interactive chart, cross-filtering) and an SVG measure (small chart in a table or card cell). Statistical plots with no Deneb equivalent (violin, ridgeline, regression diagnostics) usually go to a notebook.
