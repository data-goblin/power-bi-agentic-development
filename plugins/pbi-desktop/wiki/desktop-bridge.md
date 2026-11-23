---
title: Desktop Bridge for reload and screenshot of the open report
summary: The local JSON-RPC pipe of Power BI Desktop, the preview setting that enables it, and the pbir commands that wrap it.
kind: reference
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-overview
  - url: https://pypi.org/project/pbir-cli/0.9.33/
tools:
  pbir: 0.9.32
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 60
verified_by:
  - pbir desktop refresh --help
  - pbir desktop --help
skills: [pbi-desktop/connect-pbid]
---

# Desktop Bridge

Windows only, preview. Enable the Desktop preview feature named **Enable external tool access to Power BI Desktop through secure local APIs** (File, Options and settings, Options, Preview features), then restart Desktop. Without it no pipe exists. Use that exact label: earlier notes called it "developer mode" and "report bridge".

## Use pbir, not the raw pipe

```bash
pbir desktop list                                   # PID, open file, unsaved state, pages per instance
pbir desktop refresh "Report.Report"                # reload the on-disk report into the canvas
pbir desktop refresh "Report.Report" -m             # also re-apply the model (TMDL changes)
pbir desktop screenshot "Report.Report/Page.Page" -o page.png
pbir desktop screenshot "Report.Report" --all
```

- `-m` re-applies on-disk TMDL edits to the open model. Older notes said a TMDL edit needs closing Desktop; that is wrong for current builds. There is no report-only or model-only switch: the report is always reloaded
- Target a specific instance with `--pid`; `--wait-seconds` retries while an instance is still loading
- If the instance has unsaved changes, Desktop saves first and may overwrite the on-disk edit. Theme files under `StaticResources` are not picked up by a reload: pbir prints "Theme changes aren't applied by reload; close and reopen the report in Power BI Desktop to pick up theme edits"
- Visual and page edits belong to `pbir-cli`; the bridge reloads and captures only

## The pipe (only when pbir is not installed)

```yaml
pipe: \\.\pipe\pbi-desktop-bridge-<PID>   # one per PBIDesktop.exe; list with [System.IO.Directory]::GetFiles("\\.\pipe\")
protocol: JSON-RPC 2.0, LSP Content-Length framing, no handshake
methods (as implemented in the pbir 0.9.33 Desktop bridge client; the bridge is a Desktop preview feature, so the set can change):
  bridge.manifest: capability manifest, call first
  application.state.get/v1: { currentFilePath, hasUnsavedChanges }
  file.reload/v1: { reloadModelDefinition: bool } -> { success }
  report.snapshot.capture/v1: { pageId, scale 1..3 } -> base64 PNG in payload
```

`pageId` is the PBIR page folder id, not the display name. Read header bytes one at a time up to the blank line, then exactly `Content-Length` body bytes; a buffering reader swallows the next frame. `application.state.get/v1` returns the open file, which is more reliable than Desktop's recent-file history for locating the PBIP.

## Model and report loop

Change the model (`te`, TOM, or TMDL plus `pbir desktop refresh -m`), change visuals with `pbir`, reload, screenshot, repeat. On macOS the bridge runs inside the Parallels VM.
