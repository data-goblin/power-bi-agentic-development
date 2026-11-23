---
title: TOM against Desktop gotchas
summary: Package choice, RowNumber columns, explicit columns, batching relationships, Function objects and PowerShell quoting.
kind: gotcha
status: current
sources:
  - url: https://learn.microsoft.com/en-us/analysis-services/tom/introduction-to-the-tabular-object-model-tom-in-analysis-services-amo
  - url: https://learn.microsoft.com/en-us/analysis-services/client-libraries
tools:
  te: 0.8.1.1
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
skills: [pbi-desktop/connect-pbid]
---

# TOM against Desktop: gotchas

For ordinary CRUD, prefer `te --local` (Windows): `te add`, `te set`, `te validate`. Use TOM when te cannot do it. Reference: https://learn.microsoft.com/en-us/dotnet/api/microsoft.analysisservices.tabular

## Packages

- `Microsoft.AnalysisServices.retail.amd64` and `...AdomdClient.retail.amd64` stopped at 19.84.1 (DLLs under `lib\net45`). They lack types for newer metadata (`Function`, calendars) and compatibility level 1702
- `Microsoft.AnalysisServices` and `Microsoft.AnalysisServices.AdomdClient` are current (19.120.1 checked 2026-11-23): `lib\net472` for Windows PowerShell 5.1, `lib\net8.0` for PowerShell 7. The Tabular package depends on Microsoft.Identity.Client; install with `nuget install <id> -OutputDirectory <dir>` so dependencies land beside it. Loading these under PowerShell is Unverified here

## Model behaviour

- Every table has a hidden `RowNumberColumn` managed by the engine; filter it out: `$table.Columns | Where-Object { $_ -isnot [Microsoft.AnalysisServices.Tabular.RowNumberColumn] }`
- A table created through TOM needs explicit `DataColumn` objects, each with `SourceColumn` matching the M output exactly; Desktop does not infer columns
- A relationship to a table added in the same script must reference the column object, and the table and relationship go in one `SaveChanges()`. Looking the column up by name before saving fails with "invalid table ID 0"
- `$model.SaveChanges()` applies live, and Desktop has no Ctrl+Z for it. Changes are discarded without it. `Disconnect()` when done
- User-defined functions are `Function` objects in `$model.Functions`; there is no `UserDefinedFunction` class. GA from the June 2026 release (compatibility level 1702): see `semantic-models/wiki/udf-authoring.md`
- TOM has no public `Validate()`; validation happens in `SaveChanges()`, which rolls the batch back. A test `EVALUATE ROW(expr)` cannot reveal a circular dependency that only exists once the measure is added. Use `te validate`

## PowerShell from a Bash tool

- Bash eats `$` variables: single-quote the `-Command` argument or write a `.ps1` and use `-File`
- Always `-ExecutionPolicy Bypass`; give calls 60 s or more
- `Get-WmiObject` does not exist in PowerShell 7; use `Get-CimInstance Win32_Process`
- Port discovery and thin-report handling are in `scripts/connect-and-enumerate.ps1`
