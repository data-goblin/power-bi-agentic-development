# Power BI Desktop Integration; Live Canvas Refresh and Screenshots

Drive a running Power BI Desktop instance from the CLI: reload the on-disk report into the canvas, capture page screenshots as PNG, and query the local model engine. This closes the edit-verify loop locally; no publishing to a sandbox workspace required.

## Table of Contents
- [Requirements](#requirements)
- [Commands](#commands)
- [The Edit-Verify Loop](#the-edit-verify-loop)
- [Auto-Refresh on Save](#auto-refresh-on-save)
- [Live Local Model Queries](#live-local-model-queries)
- [PBIX Support and Limits](#pbix-support-and-limits)
- [Multiple Desktop Instances](#multiple-desktop-instances)
- [Caveats and Troubleshooting](#caveats-and-troubleshooting)

## Requirements

- Windows only; Power BI Desktop must be running with the report open
- The Desktop preview feature must be enabled: File > Options and settings > Options > Preview features > "Enable external tool access to Power BI Desktop through secure local APIs"; restart Desktop after enabling
- Screenshots additionally require the Desktop window to be in the **Report view** (not Model or Table view)

When the bridge is unreachable, the CLI prints the preview-feature hint; when no instance has the target report open, it says so and names the report it looked for.

## Commands

```bash
pbir desktop list                                    # Running Desktop instances (PID, open file)
pbir desktop refresh "Report.Report"                 # Reload on-disk definition into the canvas
pbir desktop screenshot "Report.Report"              # PNG of the first page
pbir desktop screenshot "Report.Report/Page.Page"    # PNG of a specific page
pbir desktop screenshot "Report.Report/Page.Page" -o out.png --scale 2
pbir desktop screenshot "Report.Report" --pid 1234   # Target a specific instance
```

Paths accept the usual report resolution plus absolute filesystem paths:

```bash
pbir desktop refresh "C:\Temp\Sales.Report"          # Absolute path to a .Report folder
pbir desktop screenshot "C:\Reports\Flash.pbix"      # Absolute path to an open .pbix
```

Default screenshot file name derives from the page display name (forbidden characters replaced); default scale is 2 (retina-quality, suitable for inspection).

## The Edit-Verify Loop

The core workflow this enables: make a change, reload the canvas, capture the page, and look at the rendered result.

```bash
pbir set "Report.Report/Page.Page/Card.Visual.title.text" --value "Revenue"
pbir desktop refresh "Report.Report"
pbir desktop screenshot "Report.Report/Page.Page" -o verify.png
# Read verify.png to confirm the change rendered as intended
```

Inspect the PNG after every meaningful change; rendered output catches problems that validation cannot (overlap, truncation, color contrast, wrong field bound). Prefer this loop over publish-to-sandbox whenever the report is open in Desktop.

## Auto-Refresh on Save

Set `PBIR_DESKTOP_AUTO_REFRESH=1` to make every pbir mutation reload the canvas automatically, removing the explicit `pbir desktop refresh` step:

```bash
# PowerShell
$env:PBIR_DESKTOP_AUTO_REFRESH = "1"
# bash
export PBIR_DESKTOP_AUTO_REFRESH=1
```

Auto-refresh never raises; if no Desktop instance has the report open, saves proceed silently. It is off by default so that scripted bulk edits do not trigger a canvas reload per command.

## Live Local Model Queries

For thick reports (model referenced `byPath`) open in Desktop, `pbir model -q` executes DAX against Desktop's local Analysis Services engine, and field validation resolves the schema live:

```bash
pbir model "Thick.Report" -q "EVALUATE TOPN(5, VALUES(Brands[Brand]))"
pbir model "Thick.Report" -d                          # Live schema: tables, columns, measures
```

This requires the .NET Framework build of the ADOMD client library. The CLI finds one automatically from DAX Studio or Power BI Desktop installs; override the search with `PBIR_ADOMD_DIR` pointing at a folder containing `Microsoft.AnalysisServices.AdomdClient.dll`. Note that Tabular Editor 3 ships a .NET 8 build that cannot be loaded; install DAX Studio if no compatible library is found.

Thin reports (`byConnection`) are unaffected: their queries go to the Power BI / Fabric service as before, and DMV-style queries (INFO.TABLES() etc.) remain unsupported on that route.

## PBIX Support and Limits

A `.pbix` file with PBIR metadata is readable everywhere (`ls`, `tree`, `cat`, `get`, `validate`, `model`) via a read-only extraction cache, and `pbir desktop screenshot` works against the open PBIX instance.

- `pbir desktop refresh` on a PBIX is rejected by Desktop itself ("Reload is only supported for PBIP/PBIR files"); there is no on-disk PBIR definition to reload
- All write commands (`set`, `add`, `rm`, ...) are rejected with a conversion hint; convert to PBIP first to edit
- Glob patterns do not combine with absolute paths; run from the report's parent directory or use relative paths for bulk operations

## Multiple Desktop Instances

Each open report is a separate Desktop process with its own bridge endpoint and local engine. The CLI correlates by the report folder (or source .pbix) each instance reports as open, so refresh and screenshot target the right instance automatically; the local engine port is matched to the owning Desktop process when several engines are running. Use `--pid` (from `pbir desktop list`) only when the same report is open twice.

## Caveats and Troubleshooting

- **Refresh reloads the definition, not themes.** `file.reload` re-reads pages and visuals from disk but not StaticResources: edits to theme JSON files (custom or base) only render after closing and reopening the file in Desktop. Desktop also resolves base themes by name from its internal store; the materialized `BaseThemes/*.json` is a snapshot it writes, not a file it reads (verified empirically; custom themes in `RegisteredResources` are read at open).
- **Refresh on a dirty instance saves first.** If the report has unsaved changes in Desktop, `file.reload` makes Desktop save before reloading; the whole definition is rewritten (re-indented, schema versions bumped, active page recorded). Expect git churn; commit or stash before iterating on a report a user has open with edits.
- **"Report view is not active"**: switch the Desktop window to the Report view and retry the screenshot.
- **Transient errors right after a refresh** (HostNotReady): handled automatically; the CLI honors the bridge's retry protocol.
- **Bridge unreachable**: enable the preview feature (see Requirements) and restart Desktop.
- **ADOMD client not found** when querying a local model: install DAX Studio or set `PBIR_ADOMD_DIR`.
