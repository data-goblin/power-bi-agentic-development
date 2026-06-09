# Verifying PBIR edits with the Desktop Bridge

PBIR JSON can be schema-valid yet render wrong in Power BI Desktop. To see on-disk PBIR
edits on the canvas without reopening the file, drive an open Desktop instance with
Microsoft's Desktop Bridge CLI; it reloads the report and screenshots pages.

Two npm packages (Node 20+; install only with the user's go-ahead):

```yaml
"@microsoft/powerbi-desktop-bridge-cli":     provides `powerbi-desktop` (open, status, reload, screenshot)
"@microsoft/powerbi-report-authoring-cli":   provides `powerbi-report-author` (PBIR validate/edit); optional
```

The bridge needs a **preview setting** enabled: in Power BI Desktop, File > Options and
settings > Options > Preview features, turn on the developer-mode / report-bridge
feature, then restart Desktop.

## The loop

```bash
npm install -g @microsoft/powerbi-desktop-bridge-cli
powerbi-desktop open "Sales.pbip"      # start Desktop on the project (or it is already open)
powerbi-desktop status                 # list instances; pick the target PID
powerbi-desktop reload --pid <pid>     # re-read the on-disk PBIR into the live canvas
powerbi-desktop screenshot <pageId> --pid <pid> --output shots/page.png
```

Edit PBIR -> `reload --pid` -> `screenshot --pid` -> review the PNG -> fix and repeat.

- Select by PID from `status`, never by report path; the same project can be open in
  several Desktop processes.
- `<pageId>` is the PBIR section id (for example `ReportSection1a2b3c`), not the page
  display name. Read it from the page folder name.
- Screenshots default to scale 2; pass `--scale 1` for smaller, `--scale 3` for detail.

## Useful side effects

- `status` reports each instance's `currentFilePath`, so the bridge can tell you where
  the open PBIP folder is on disk (auto-discovered PID -> file path), handy when you do
  not already know the project location.
- `reload` covers report-definition (PBIR) changes. For semantic-model / TMDL changes,
  reopen the PBIP if the model change is not reflected.

## Notes

- It drives the Windows Desktop app, so on macOS run it through Parallels.
- For the raw named-pipe JSON-RPC behind this CLI (PowerShell, no npm wrapper), see the
  `connect-pbid` skill's Desktop Bridge reference.
- To CHANGE visuals or pages, use the `pbir-cli` skill; the bridge only reloads and
  screenshots.
