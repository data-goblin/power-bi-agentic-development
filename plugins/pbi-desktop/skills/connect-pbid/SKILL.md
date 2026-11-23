---
name: connect-pbid
description: Windows only. Use with a running Power BI Desktop instance for what `te --local` cannot do, such as applying TMDL edited on disk to the open model (pbir desktop refresh -m), reloading or screenshotting the report canvas through the Desktop Bridge, finding the local msmdsrv port and mapping it to the open file, capturing traces (EVALUATEANDLOG payloads, visual queries, server timings), raw TOM or ADOMD.NET from PowerShell, and daxlib packages. Not for service or Direct Lake models, and not the first choice for ordinary model edits.
---

# Power BI Desktop (local engine)

## Rules

- Try `te --local` first on Windows (`te ls --local`, `te add`, `te set`, `te validate --local`, `te query --local --trace --cold --runs 10`). It attaches to the same engine, so the older claim that te cannot reach Desktop is wrong. Use this skill for what te does not do: visual-query capture, `EVALUATEANDLOG` payloads, raw TOM objects, the Desktop Bridge, daxlib
- Object references in DAX follow the rule owned by the `semantic-model` skill
- Do not change model metadata without the user's direction. `$model.SaveChanges()` applies live and Desktop has no undo for it; unsaved TOM changes are discarded. Disconnect when finished
- Desktop must have a model loaded. The local engine accepts `localhost` only
- Several open files mean several `msmdsrv.exe` ports. Run `scripts/find-desktop.ps1`: it maps each port to its Desktop PID and database. A port with 0 databases is a thin report (live connection to a remote model) or a Direct Lake model behind a remote proxy; neither has a connectable local model. For a thin report use `pbir model -q` or `te query -s <workspace> -d <model>`
- To know which file is open, use `pbir desktop list`, not Desktop's recent-file history
- PowerShell from a Bash tool: single-quote `-Command` or write a `.ps1` and use `-File`; always `-ExecutionPolicy Bypass`; allow 60 s or more. Details: [wiki/tom-gotchas.md](../../wiki/tom-gotchas.md)

## Pick the tool

```yaml
list tables, measures, relationships: te ls --local, te get --local
change a model object: te add / te set --local --save, then te validate --local
run a DAX query with FE/SE timings: te query --local --trace --cold --runs 10
visual queries as Desktop sends them: scripts/trace-queries.ps1 (or the query-listener agent)
intermediate values inside a measure: EVALUATEANDLOG with scripts/debug-dax.ps1
raw TOM, ADOMD.NET, DMVs: PowerShell with TOM, see wiki/tom-gotchas.md
apply TMDL edited on disk to the open model: pbir desktop refresh "Report.Report" -m
reload or screenshot the report canvas: pbir desktop refresh / screenshot (wiki/desktop-bridge.md)
DAX library packages: daxlib.sh (wiki/daxlib-packages.md)
macOS with Desktop in Parallels: wiki/parallels-macos.md
```

## Model and report loop

Change the model with te or TOM, change visuals with `pbir-cli` (never patch report JSON directly), then `pbir desktop refresh` and `pbir desktop screenshot` to confirm the canvas. The Desktop Bridge needs the Desktop preview feature **Enable external tool access to Power BI Desktop through secure local APIs**.

## Gotchas

- TOM packages: `Microsoft.AnalysisServices.retail.amd64` is frozen at 19.84.1; use `Microsoft.AnalysisServices` and `Microsoft.AnalysisServices.AdomdClient` (19.120.1) for functions, calendars and compatibility level 1702
- A table made through TOM needs explicit `DataColumn` objects with `SourceColumn`; a relationship to a table added in the same script needs the column object and one `SaveChanges()`
- Filter the hidden `RowNumberColumn` out of column lists
- `VertiPaqSEQueryCacheMatch` accepts only TextData and EventClass columns
- `EVALUATEANDLOG` events arrive 2 to 3.5 s after the query: poll, do not sleep once ([wiki/trace-capture.md](../../wiki/trace-capture.md))
- Raising the compatibility level (daxlib add, UDFs need 1702) is one-way and can stop older Desktop or deployment targets opening the model: ask first

## Hooks

The plugin's hooks run on Windows only and say so when they are off. After a PowerShell command that saves model changes they run `te validate --local`; see `hooks/README.md` and the toggles in `hooks/config.yaml`.

## Scripts

```yaml
scripts/find-desktop.ps1: ports, Desktop PIDs, database names; dot-source for Get-DesktopPorts
scripts/trace-queries.ps1: event-driven capture of visual queries
scripts/debug-dax.ps1: EVALUATEANDLOG capture plus FE/SE timings via Invoke-DebugQuery
scripts/connect-from-mac.sh: run a .ps1 inside a Parallels VM
daxlib.sh, scripts/daxlib-tom: daxlib.org client (needs bash, jq, .NET 8 SDK for model operations)
```

Reference: TOM https://learn.microsoft.com/en-us/dotnet/api/microsoft.analysisservices.tabular ; ADOMD.NET https://learn.microsoft.com/en-us/dotnet/api/microsoft.analysisservices.adomdclient ; DAX https://dax.guide
