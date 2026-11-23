---
title: pbir Desktop bridge setup and limits
summary: Requirements, commands and failure modes of pbir desktop (refresh and screenshot a report open in Power BI Desktop on Windows).
kind: reference
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report
  - url: https://pypi.org/project/pbir-cli/0.9.33/
tools:
  pbir: 0.9.33
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - pbir desktop screenshot --help
  - pbir desktop refresh --help
skills: [reports/pbir-cli]
---

# pbir Desktop bridge

Not on Learn: `pbir desktop` drives a running Power BI Desktop through its local API. Windows only; on macOS and Linux every `pbir desktop` command fails.

## Requirements

- The Desktop preview feature "Enable external tool access to Power BI Desktop through secure local APIs" (the name `pbir desktop --help` prints), then restart Desktop
- The report open as PBIP or PBIR; Desktop in Report view for screenshots

## Commands

```bash
pbir desktop list
pbir desktop refresh "Report.Report" [--model]
pbir desktop screenshot "Report.Report/Page.Page" -o verify.png --scale 2
pbir desktop screenshot "Report.Report" --all --output-dir shots --settle 500
```

- `list` (alias `status`) shows PID, open file, unsaved state and pages; `--pid` targets one instance when the same report is open twice
- `refresh` (alias `reload`) reloads the on-disk definition; `--model` also re-applies the TMDL
- `screenshot` scale is 1 to 3 (default 1); captures follow the canvas zoom, so for pixel checks use `--scale 3` and crop
- `PBIR_DESKTOP_AUTO_REFRESH=1` reloads the canvas after every pbir mutation; off by default

## Limits and failures

- **Themes**: refresh reloads pages and visuals, not StaticResources. pbir itself prints "Theme changes aren't applied by reload; close and reopen the report in Power BI Desktop to pick up theme edits", so close and reopen the file after a theme change
- **Dirty instance**: refresh on a report with unsaved edits makes Desktop save first and rewrite the whole definition (re-indent, schema bumps, active page). Commit or back up first
- **PBIX**: readable and screenshot-able; `refresh` is rejected by Desktop and all writes are rejected with a conversion hint. Convert to PBIP to edit
- **Local model queries**: for a thick (`byPath`) report open in Desktop, `pbir model -q` and `-d` use Desktop's local engine through an ADOMD client library; pbir finds one from DAX Studio or Desktop, or set `PBIR_ADOMD_DIR` to the folder holding `Microsoft.AnalysisServices.AdomdClient.dll`
- **"Report view is not active"**: switch the window to Report view and retry
- **Bridge fault after a Desktop upgrade**: pbir tells this apart from a timeout, prints repair guidance (Settings, Apps, Power BI Desktop, Repair) and a distinct diagnostic. Repair Desktop, reopen the report, run `pbir desktop list`; never retry in a loop
- Globs do not combine with absolute paths: run from the report's parent folder for bulk operations
