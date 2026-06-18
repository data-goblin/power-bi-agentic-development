# Verifying PBIR edits on the Desktop canvas

PBIR JSON can be schema-valid yet render wrong in Power BI Desktop. To see on-disk PBIR
edits on the canvas without reopening the file, drive an open Desktop instance with the
`pbir desktop` commands (reports plugin, `pbir-cli` skill); they reload the report and
screenshot pages over Desktop's local API.

Requires a **preview setting**: in Power BI Desktop, File > Options and settings >
Options > Preview features, enable "external tool access to Power BI Desktop through
secure local APIs", then restart Desktop.

## The loop

```bash
pbir desktop list                                  # Running instances (PID, open file); `status` is an alias
pbir desktop reload "Sales.Report"                 # Re-read the on-disk PBIR into the live canvas (alias of refresh)
pbir desktop reload "Sales.Report" --pid 1234      # Target a specific instance when several are open
pbir desktop screenshot "Sales.Report/Page.Page" -o shots/page.png
```

Edit PBIR -> `pbir desktop reload` -> `pbir desktop screenshot` -> review the PNG -> fix and repeat.

- Select by PID from `pbir desktop list` when the same project is open in several Desktop processes.
- Screenshots default to scale 2 (clamped 1-3); pass `--scale 3` for detail, or `--all` to capture every page into ./screenshots.
- `reload` covers report-definition (PBIR) changes; for semantic-model / TMDL changes, reopen the PBIP (or `reload --model`).

## Useful side effects

- `pbir desktop list` reports each instance's open file path, so it can tell you where the
  open PBIP folder is on disk, handy when you do not already know the project location.

## Notes

- It drives the Windows Desktop app, so on macOS run it through Parallels.
- For the raw named-pipe JSON-RPC behind this (PowerShell, no CLI), see the `connect-pbid`
  skill's Desktop Bridge reference.
- To CHANGE visuals or pages, use the `pbir-cli` skill; reload/screenshot only verifies.
- Full desktop workflow: the `pbir-cli` skill's `references/desktop-integration.md`.
