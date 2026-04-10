---
name: connect-pbid
version: 0.22.4
description: TOM and ADOMD.NET guidance via PowerShell for connecting to Power BI Desktop's local Analysis Services instance. Covers model enumeration, DAX queries, metadata modification, annotations, calendar definitions, field parameters, query tracing, and DAX library package management (daxlib.org). Automatically invoke when the user mentions "Power BI Desktop", "Analysis Services port", "TOM", "ADOMD", "daxlib", "DAX library", "DAX UDF package", or asks to "connect to PBI Desktop", "query PBI Desktop with DAX", "modify PBI Desktop model", "add a measure to PBI", "capture visual queries", "create a field parameter", "validate DAX", "intercept DAX queries", "install daxlib", "add DAX SVG", "add IBCS".
---

# Connect to Power BI Desktop (Local Analysis Services)

> **CRITICAL:** Record mistakes, surprises, and model-specific nuances encountered while using this skill in `.claude/rules/connect-pbid.md`. This file must begin with "Learnings from Claude about connecting to semantic models via the connect-pbid skill". Write only active reference notes (e.g. "QueryGroup property returns an object; access .Folder for the name string"); do not log a changelog or history of events. Omit anything already documented in the skill or its references. Keep the file under 1500 characters at all times; prune stale entries when adding new ones. Do not over-attend to this file; update it only when something genuinely unexpected is discovered.

> **Note:** No MCP server required; do not use this skill with MCP servers or CLI tools. Use this skill to execute PowerShell commands directly via Bash to connect to Power BI Desktop's local Analysis Services instance.

Expert guidance for connecting to Power BI Desktop's local tabular model via the Tabular Object Model (TOM) and ADOMD.NET in PowerShell. Covers connection, enumeration, DAX queries, query traces, and full model modification.


## When to Use This Skill

Activate only when the Tabular Editor CLI or a Power BI MCP server is unavailable. TOM is more reliable than direct TMDL editing because it validates changes against the engine and applies them atomically.

**WARNING:** This skill does NOT support remote models via the XMLA endpoint. For Direct Lake models or models hosted in Fabric, use the Tabular Editor CLI or a Power BI MCP server instead; the local Analysis Services proxy does not expose Direct Lake databases to external TOM/ADOMD.NET connections.


## Critical

- Power BI Desktop must be open with a model loaded before connecting; if there are errors it is likely due to a "thin report" connected to a remote model, or a Direct Lake model (which uses a remote proxy that blocks external connections)
- The local Analysis Services instance only accepts connections from `localhost`
- Multiple PBI Desktop files open means multiple `msmdsrv.exe` processes on different ports. Connect to each port, read `$server.Databases[0].Name`, and ask the user which model to work with if more than one is found
- Always use a timeout of 60000ms or higher for PowerShell commands via Bash
- **Shell escaping**: Bash eats PowerShell `$` variables (`$env:TEMP`, `$server`, etc.) silently. Two options: (1) single-quote the `-Command` arg so Bash passes `$` literally to PowerShell; (2) write a `.ps1` file with a heredoc (single-quoted delimiter preserves `$`) and use `-File`. On macOS via Parallels, the `prlctl` -> `cmd.exe` -> `powershell.exe` chain adds extra escaping layers; `.ps1` files are more reliable for complex scripts but inline `-Command` with single quotes works for short commands.
- **Always use `-ExecutionPolicy Bypass`** when running PowerShell commands or scripts. Windows blocks unsigned scripts by default.
- **Script file location** -- persistent scripts should go in the agent harness's scripts directory for the project (`.claude/scripts/`, `.github/scripts/`, `.cursor/scripts/`, `.gemini/scripts/`, etc. depending on the harness). Ephemeral or throwaway scripts should go in a project `tmp/` directory (which should be `.gitignored`). Do not write scripts to `./` root or `/tmp/`.
- Do not modify model metadata without explicit user direction
- Always call `$model.SaveChanges()` to persist modifications; without it, changes are discarded
- For macOS users running PBI Desktop in Parallels, see [parallels-macos.md](./references/parallels-macos.md)
- **Validation hooks** are active for this plugin; they validate DAX references, enforce measure metadata, check referential integrity, and report compatibility level upgrade opportunities. Toggle checks in `hooks/config.yaml`.


## 1. Prerequisites

| Requirement | Description |
|-------------|-------------|
| **Power BI Desktop** | Open with a model loaded (`.pbix` or `.pbip`) |
| **PowerShell** | Available on the machine running PBI Desktop |
| **NuGet CLI** | For package installation (`winget install Microsoft.NuGet`) |
| **TOM NuGet Package** | `Microsoft.AnalysisServices.retail.amd64` -- model metadata |
| **ADOMD.NET Package** | `Microsoft.AnalysisServices.AdomdClient.retail.amd64` -- DAX queries |

Install both packages only if not already present:

```powershell
$pkgDir = "$env:TEMP\tom_nuget"
if (-not (Test-Path "$pkgDir\Microsoft.AnalysisServices.retail.amd64")) {
    nuget install Microsoft.AnalysisServices.retail.amd64 -OutputDirectory $pkgDir -ExcludeVersion
}
if (-not (Test-Path "$pkgDir\Microsoft.AnalysisServices.AdomdClient.retail.amd64")) {
    nuget install Microsoft.AnalysisServices.AdomdClient.retail.amd64 -OutputDirectory $pkgDir -ExcludeVersion
}
```

Packages install DLLs under `lib\net45\`. Load with `Add-Type -Path`.

> **If a TOM operation fails** with a compatibility level error or missing type, the `.retail.amd64` package may be too old. A newer package (`Microsoft.AnalysisServices`, .NET 8+) ships with more recent TOM features. See [daxlib.md](./references/daxlib.md) for details on package differences.


## 2. Quickstart

Find the port, load TOM, connect, enumerate -- in one script:

```powershell
# Find port
$pids = (Get-Process msmdsrv -ErrorAction SilentlyContinue).Id
$ports = netstat -ano | Select-String "LISTENING" |
    Where-Object { $pids -contains ($_ -split "\s+")[-1] } |
    ForEach-Object { ($_ -split "\s+")[2] -replace ".*:" }

# Load TOM
$basePath = "$env:TEMP\tom_nuget\Microsoft.AnalysisServices.retail.amd64\lib\net45"
Add-Type -Path "$basePath\Microsoft.AnalysisServices.Core.dll"
Add-Type -Path "$basePath\Microsoft.AnalysisServices.Tabular.dll"

# Connect to first port
$server = New-Object Microsoft.AnalysisServices.Tabular.Server
$server.Connect("Data Source=localhost:$($ports[0])")
$model = $server.Databases[0].Model

# Enumerate
foreach ($table in $model.Tables) {
    Write-Output "TABLE: [$($table.Name)] ($($table.Columns.Count) cols, $($table.Measures.Count) measures)"
}
Write-Output "Relationships: $($model.Relationships.Count)"

$server.Disconnect()
```

**Port discovery methods:**

| Method | Install Type | Command |
|--------|-------------|---------|
| Port file | Non-Store PBI Desktop | `Get-Content "$env:LOCALAPPDATA\Microsoft\Power BI Desktop\AnalysisServicesWorkspaces\*\Data\msmdsrv.port.txt"` |
| Port file | Store PBI Desktop | `Get-Content "$env:LOCALAPPDATA\Packages\Microsoft.MicrosoftPowerBIDesktop_*\LocalState\AnalysisServicesWorkspaces\*\Data\msmdsrv.port.txt"` |
| netstat | Any | `netstat -ano \| findstr LISTENING \| findstr <PID>` |


## 3. Loading TOM, Connecting, and Saving Changes

### Load Assemblies

```powershell
$basePath = "$env:TEMP\tom_nuget\Microsoft.AnalysisServices.retail.amd64\lib\net45"
Add-Type -Path "$basePath\Microsoft.AnalysisServices.Core.dll"
Add-Type -Path "$basePath\Microsoft.AnalysisServices.Tabular.dll"
Add-Type -Path "$basePath\Microsoft.AnalysisServices.Tabular.Json.dll"
```

### Connect

```powershell
$server = New-Object Microsoft.AnalysisServices.Tabular.Server
$server.Connect("Data Source=localhost:<PORT>")

# PBI Desktop always has exactly one database
$db = $server.Databases[0]
$model = $db.Model
```

### Save Changes

Only save after all changes are made. After modifications, persist with:

```powershell
$model.SaveChanges()
```

Changes appear immediately in PBI Desktop. The user cannot undo with `Ctrl+Z` in Power BI, which is a disadvantage of this approach.

### Disconnect

**IMPORTANT:** Remember to disconnect after modifications are done. NEVER remain connected, which can lead to orphaned processes.

```powershell
$server.Disconnect()
```

### Connection Properties

```powershell
Write-Output "Server: $($server.Name)"
Write-Output "Version: $($server.Version)"
Write-Output "Database: $($db.Name)"
Write-Output "Compatibility: $($db.CompatibilityLevel)"
```


## 4. Refreshing the Model

Trigger a data refresh via TMSL (Tabular Model Scripting Language) or TOM's `RequestRefresh` API. This re-executes Power Query/M expressions and reloads data into the VertiPaq engine.

```powershell
# Full refresh of a single table via TMSL
$dbName = $server.Databases[0].Name
$tmsl = '{ "refresh": { "type": "full", "objects": [{ "database": "' + $dbName + '", "table": "Sales" }] } }'
$server.Execute($tmsl)

# Or via TOM RequestRefresh API
$model.Tables["Sales"].RequestRefresh([Microsoft.AnalysisServices.Tabular.RefreshType]::Full)
$model.SaveChanges()
```

| Refresh Type | Behaviour |
|-------------|-----------|
| `full` | Drop data, re-query source, recalculate DAX |
| `calculate` | Recalculate DAX only (no source query) |
| `automatic` | Engine decides per-partition what's needed |
| `dataOnly` | Re-query source but skip DAX recalculation |

For detailed examples and all refresh methods, see [refresh-model.md](./references/refresh-model.md).


## 5. Querying with DAX

### Load ADOMD.NET

```powershell
Add-Type -Path "$env:TEMP\tom_nuget\Microsoft.AnalysisServices.AdomdClient.retail.amd64\lib\net45\Microsoft.AnalysisServices.AdomdClient.dll"
```

### Open a Connection

```powershell
$conn = New-Object Microsoft.AnalysisServices.AdomdClient.AdomdConnection
$conn.ConnectionString = "Data Source=localhost:<PORT>"
$conn.Open()
```

### Execute a Query

All queries should preferably use `SUMMARIZECOLUMNS`.
Check `dax.guide` online for information about DAX functions, if necessary.

**Important:** ADOMD.NET returns fully-qualified column names (e.g., `'Monsters'[Name]` not `Name`). Do not access columns by short name (`$reader["Name"]`) -- it fails silently and returns blank. Use `$reader.GetName($i)` to discover column names, then access by index:

```powershell
$cmd = $conn.CreateCommand()
$cmd.CommandText = "EVALUATE SUMMARIZECOLUMNS('Table'[Column], ""@MeasureName"", [Measure])"

$reader = $cmd.ExecuteReader()

# Always iterate by index and use GetName() to map columns
while ($reader.Read()) {
    for ($i = 0; $i -lt $reader.FieldCount; $i++) {
        Write-Output "$($reader.GetName($i)): $($reader.GetValue($i))"
    }
    Write-Output "---"
}
$reader.Close()
```

### DAX Rules

- **Always fully qualify column references** with single-quoted table names: `'Sales'[Amount]`, not `[Amount]`. This applies everywhere -- measures, calculated columns, queries. Unqualified columns cause ambiguity errors.
- Table names are **always** single-quoted in DAX: `'Sales'[Amount]`, `'D&D 5E Monsters'[CR]`. Even simple names like `Sales` should be quoted as `'Sales'` for consistency.
- **Measure references are the only exception** -- they are always unqualified: `[Total Revenue]`
- String literals in DAX use double quotes, escaped as `""` inside PowerShell here-strings

### Query Patterns

```powershell
# Full table scan
$cmd.CommandText = "EVALUATE 'Sales'"

# Filtered with CALCULATETABLE
$cmd.CommandText = "EVALUATE CALCULATETABLE('Sales', 'Sales'[Region] = ""West"")"

# Aggregation
$cmd.CommandText = "EVALUATE SUMMARIZECOLUMNS('Date'[Year], ""@Total"", SUM('Sales'[Amount]))"

# Scalar via ROW
$cmd.CommandText = "EVALUATE ROW(""Result"", COUNTROWS('Sales'))"

# DMV queries (model metadata via SQL-like syntax)
$cmd.CommandText = "SELECT * FROM `$SYSTEM.TMSCHEMA_TABLES"
$cmd.CommandText = "SELECT * FROM `$SYSTEM.TMSCHEMA_MEASURES"
$cmd.CommandText = "SELECT * FROM `$SYSTEM.TMSCHEMA_COLUMNS"
$cmd.CommandText = "SELECT * FROM `$SYSTEM.TMSCHEMA_RELATIONSHIPS"
```

### Close Connection

```powershell
$conn.Close()
```


## 6. Modifying a Semantic Model

All modifications require a TOM connection (section 3). Call `$model.SaveChanges()` after each batch of changes.

### A. CRUD by Object Type

For full CRUD examples of every object type, see [tom-object-types.md](./references/tom-object-types.md).

**Common object types and their TOM collections** (not exhaustive -- see [Microsoft TOM API docs](https://learn.microsoft.com/en-us/dotnet/api/microsoft.analysisservices.tabular) for the full namespace):

| Object | Collection | Create | Read | Update | Delete |
|--------|-----------|--------|------|--------|--------|
| Table | `$model.Tables` | `New-Object ...Table` | `$model.Tables["Name"]` | Set properties | `.Remove($obj)` |
| Column | `$table.Columns` | `New-Object ...DataColumn` | `$table.Columns["Name"]` | Set properties | `.Remove($obj)` |
| Measure | `$table.Measures` | `New-Object ...Measure` | `$table.Measures["Name"]` | Set properties | `.Remove($obj)` |
| Calculated Column | `$table.Columns` | `New-Object ...CalculatedColumn` | Filter by type | Set `.Expression` | `.Remove($obj)` |
| Calculated Table | `$model.Tables` | Table + calculated partition | Check partition type | Set partition expr | `.Remove($obj)` |
| Relationship | `$model.Relationships` | `New-Object ...SingleColumnRelationship` | Index or filter | Set properties | `.Remove($obj)` |
| Hierarchy | `$table.Hierarchies` | `New-Object ...Hierarchy` | `$table.Hierarchies["Name"]` | Modify levels | `.Remove($obj)` |
| Role | `$model.Roles` | `New-Object ...ModelRole` | `$model.Roles["Name"]` | Set permissions | `.Remove($obj)` |
| Perspective | `$model.Perspectives` | `New-Object ...Perspective` | `$model.Perspectives["Name"]` | Toggle membership | `.Remove($obj)` |
| Culture | `$model.Cultures` | `New-Object ...Culture` | `$model.Cultures["en-US"]` | Set translations | `.Remove($obj)` |
| Partition | `$table.Partitions` | `New-Object ...Partition` | `$table.Partitions["Name"]` | Set source/expression | `.Remove($obj)` |
| Annotation | Any object | `$obj.Annotations.Add(...)` | `$obj.Annotations["Key"]` | Set `.Value` | `.Remove($obj)` |
| Expression | `$model.Expressions` | `New-Object ...NamedExpression` | `$model.Expressions["Name"]` | Set `.Expression` | `.Remove($obj)` |
| Data Source | `$model.DataSources` | `New-Object ...StructuredDataSource` | `$model.DataSources["Name"]` | Set connection | `.Remove($obj)` |
| Calculation Group | `$model.Tables` | Table with `CalculationGroup` | Filter by type | Add/remove items | `.Remove($obj)` |

**Quick examples (inline):**

```powershell
# Add a measure
$m = New-Object Microsoft.AnalysisServices.Tabular.Measure
$m.Name = "Total Revenue"
$m.Expression = "SUM(Sales[Amount])"
$m.FormatString = "`$#,0"
$m.Description = "Sum of all sales amounts"
$model.Tables["Sales"].Measures.Add($m)

# Add a relationship
$rel = New-Object Microsoft.AnalysisServices.Tabular.SingleColumnRelationship
$rel.Name = "Sales_to_Date"
$rel.FromColumn = $model.Tables["Sales"].Columns["DateKey"]
$rel.ToColumn = $model.Tables["Date"].Columns["DateKey"]
$rel.FromCardinality = [Microsoft.AnalysisServices.Tabular.RelationshipEndCardinality]::Many
$rel.ToCardinality = [Microsoft.AnalysisServices.Tabular.RelationshipEndCardinality]::One
$model.Relationships.Add($rel)

# Rename a column
$model.Tables["Sales"].Columns["amt"].Name = "Amount"

# Hide a table
$model.Tables["Bridge"].IsHidden = $true

# Delete a measure
$m = $model.Tables["Sales"].Measures["Old Measure"]
$model.Tables["Sales"].Measures.Remove($m)

# Add a role with RLS
$role = New-Object Microsoft.AnalysisServices.Tabular.ModelRole
$role.Name = "Region Filter"
$role.ModelPermission = [Microsoft.AnalysisServices.Tabular.ModelPermission]::Read
$model.Roles.Add($role)
$tp = New-Object Microsoft.AnalysisServices.Tabular.TablePermission
$tp.Table = $model.Tables["Sales"]
$tp.FilterExpression = "[Region] = USERNAME()"
$role.TablePermissions.Add($tp)

$model.SaveChanges()
```

### B. Discovering Object Types, Properties, and Setting Values

For complete TOM object type tables, PowerShell reflection patterns for discovering properties and enum values, and reading/setting property examples, see **`references/tom-object-types.md`**.


## 7. Validating DAX Expressions

Before saving measure/column expressions, validate them by test-executing against the live model. This catches syntax errors, missing column references, and circular dependencies without persisting bad metadata.

```powershell
# Validate a DAX expression before adding it as a measure
$testExpr = "SUM('Sales'[Amount]) / COUNTROWS('Sales')"
$cmd = $conn.CreateCommand()
$cmd.CommandText = "EVALUATE ROW(`"@Test`", $testExpr)"
try {
    $reader = $cmd.ExecuteReader()
    $reader.Close()
    Write-Output "VALID"
} catch {
    Write-Output "INVALID: $($_.Exception.Message)"
}
```

For calculated table expressions, wrap in `COUNTROWS`:

```powershell
$tableExpr = "CALENDAR(DATE(2020,1,1), DATE(2030,12,31))"
$cmd.CommandText = "EVALUATE ROW(`"@Count`", COUNTROWS($tableExpr))"
```

For filter expressions (RLS), test with `CALCULATETABLE`:

```powershell
$filterExpr = "'Sales'[Region] = `"West`""
$cmd.CommandText = "EVALUATE CALCULATETABLE(ROW(`"@OK`", 1), $filterExpr)"
```


## 8. Transactions and Rollback

`SaveChanges()` applies all pending modifications in a single implicit transaction. If any object fails validation, the entire batch rolls back automatically.

For multi-step workflows where inspection or rollback is needed before committing:

```powershell
try {
    # Make changes (not yet persisted)
    $model.Tables["Sales"].Measures["Revenue"].Name = "Total Revenue"
    $model.Tables["Sales"].Measures["Cost"].Name = "Total Cost"

    # Inspect before committing (changes are local to this connection)
    foreach ($m in $model.Tables["Sales"].Measures) {
        Write-Output "  [$($m.Name)]"
    }

    # Commit all changes atomically
    $model.SaveChanges()
    Write-Output "Committed"
} catch {
    # Discard all uncommitted changes
    $model.UndoLocalChanges()
    Write-Output "Rolled back: $($_.Exception.Message)"
}
```

`UndoLocalChanges()` discards all modifications made since the last `SaveChanges()`. This is the rollback mechanism for PBI Desktop; there is no explicit begin/commit transaction API on the local Analysis Services instance.


## 9. Model Validation

### Validate Before Saving

The TOM API does not expose a public `Validate()` method. Validation happens implicitly during `SaveChanges()` (which rolls back the entire batch on failure). For pre-save validation, inspect objects manually:

```powershell
# Check measures have valid expressions (non-empty)
foreach ($m in ($model.Tables | ForEach-Object { $_.Measures }) ) {
    if ([string]::IsNullOrWhiteSpace($m.Expression)) {
        Write-Output "WARNING: Measure [$($m.Name)] in [$($m.Table.Name)] has no expression"
    }
}

# Check relationships reference valid columns
foreach ($rel in $model.Relationships) {
    $sr = [Microsoft.AnalysisServices.Tabular.SingleColumnRelationship]$rel
    if ($sr.FromColumn -eq $null -or $sr.ToColumn -eq $null) {
        Write-Output "WARNING: Relationship [$($sr.Name)] has null column references"
    }
}

# Check for duplicate measure names across tables
$names = @{}
foreach ($m in ($model.Tables | ForEach-Object { $_.Measures })) {
    if ($names.ContainsKey($m.Name)) {
        Write-Output "WARNING: Duplicate measure name [$($m.Name)] in [$($m.Table.Name)] and [$($names[$m.Name])]"
    }
    $names[$m.Name] = $m.Table.Name
}
```

## 10. Finding the File Path and Editing Metadata Files

### Find the Open File Path

TOM does not expose the `.pbix`/`.pbip` file path directly. The most reliable method across all PBI Desktop install types is reading the `FileHistory` from `User.zip` in the PBI Desktop app data folder.

**Primary method — FileHistory in User.zip (works for Store and non-Store):**

```powershell
# Read the most recently opened file from PBI Desktop's settings
$userZip = "$env:USERPROFILE\Microsoft\Power BI Desktop Store App\User.zip"
# For non-Store installs: "$env:LOCALAPPDATA\Microsoft\Power BI Desktop\User.zip"

Add-Type -Assembly System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead($userZip)
$entry = $z.Entries | Where-Object { $_.Name -eq 'Settings.xml' }
$reader = New-Object System.IO.StreamReader($entry.Open())
$content = $reader.ReadToEnd()
$reader.Close()
$z.Dispose()

# Extract FileHistory entries (ordered by lastAccessedDate, most recent first)
$history = ($content -split '(?=<Entry)' | Where-Object { $_ -match 'FileHistory' })[0]
$json = [regex]::Match($history, 'Value="s\[(.*?)\]"').Groups[1].Value -replace '&quot;', '"'
$files = $json | ConvertFrom-Json
$files | Select-Object filePath, lastAccessedDate | Format-Table -AutoSize
```

The first entry is the most recently opened file. Files on the Mac (via Parallels) appear as `\\Mac\Home\...` paths.

> **Limitation:** This is an imperfect method — it reads recent file history, not the currently open file. If multiple PBI Desktop instances are open, or the most recently accessed file in history isn't the one currently open, the result may be wrong. Confirm with the user if there is any ambiguity.

**Fallback — window title (non-Store PBI Desktop only):**

```powershell
Get-Process PBIDesktop -ErrorAction SilentlyContinue | Select-Object Id, MainWindowTitle
```

> **Note:** Store PBI Desktop (from Microsoft Store / WindowsApps) does not expose the file path in the window title — use the User.zip method above instead.

**Fallback — msmdsrv command line (gives workspace path, not file path):**

```powershell
# Useful for finding the port; does NOT reveal the source file path
(Get-WmiObject Win32_Process -Filter "Name='msmdsrv.exe'").CommandLine
```

### Editing PBIP Metadata Files (Connection, Report, Model)

For `.pbip` projects, metadata files are human-readable JSON/TMDL on disk and can be read and modified directly.

**Common targets:**

| File | Purpose | Skill |
|------|---------|-------|
| `<Name>.Report/definition.pbir` | Report-to-model connection (`byPath` or `byConnection`) | `pbip` |
| `<Name>.Report/definition/report.json` | Report-level settings, theme, filters | `pbir-format` |
| `<Name>.SemanticModel/definition/*.tmdl` | Model metadata (tables, measures, relationships) | `tmdl` |
| `<Name>.SemanticModel/definition/expressions.tmdl` | M/Power Query shared expressions and parameters | `tmdl` |

For syntax, structure, and editing patterns for these files, load the relevant skill from the **pbip plugin**:
- **`pbip`** -- project structure, file types, `.pbir` connection, forking
- **`pbir-format`** -- `report.json`, `visual.json`, themes, filters, PBIR JSON schemas
- **`tmdl`** -- TMDL syntax, measures, columns, roles, relationships

### No Hot-Reload — Close and Reopen Required

**IMPORTANT:** Power BI Desktop does **not** watch for external file changes. If you edit metadata files on disk while the report is open, the changes will be silently ignored or overwritten when PBI Desktop next saves.

To apply external file edits:

1. Close Power BI Desktop completely
2. Make your changes to the files on disk
3. Reopen the `.pbix` or `.pbip` file

This is different from TOM modifications via `$model.SaveChanges()`, which apply immediately to the running instance without requiring a restart.

### Microsoft Documentation

| Topic | URL |
|-------|-----|
| **TOM API Reference** | `learn.microsoft.com/en-us/dotnet/api/microsoft.analysisservices.tabular` |
| **TOM Overview** | `learn.microsoft.com/en-us/analysis-services/tom/introduction-to-the-tabular-object-model-tom-in-analysis-services-amo` |
| **ADOMD.NET Reference** | `learn.microsoft.com/en-us/dotnet/api/microsoft.analysisservices.adomdclient` |
| **Client Libraries** | `learn.microsoft.com/en-us/analysis-services/client-libraries` |
| **DMV Reference** | `learn.microsoft.com/en-us/analysis-services/instances/use-dynamic-management-views-dmvs-to-monitor-analysis-services` |
| **DAX Reference** | `dax.guide` |
| **Compatibility Levels** | `learn.microsoft.com/en-us/analysis-services/tabular-models/compatibility-level-for-tabular-models-in-analysis-services` |

To retrieve current TOM/ADOMD.NET reference docs, use `microsoft_docs_search` + `microsoft_docs_fetch` (MCP) if available, otherwise `mslearn search` + `mslearn fetch` (CLI). Search based on the user's request and run multiple searches as needed to ensure sufficient context before proceeding.


## 11. Debugging DAX with EVALUATEANDLOG

`EVALUATEANDLOG(<Value>, [Label], [MaxRows])` wraps any DAX expression, returns it unchanged, and emits intermediate results as JSON via a trace event. Works in PBI Desktop only.

**Programmatic capture** via the TOM Trace API eliminates the need for external tools (DAX Debug Output, SQL Server Profiler, DAX Studio). Subscribe to the `DAXEvaluationLog` trace event (enum ID 135), capture events with a synchronized `ArrayList` via `Register-ObjectEvent`, and parse the JSON from `$Event.SourceEventArgs.TextData`.

**Critical implementation detail:** `Register-ObjectEvent -Action` runs in a separate PowerShell runspace. `$global:` variables inside the action block do not share scope. Pass a synchronized collection via `-MessageData`:

```powershell
$evalEvents = [System.Collections.ArrayList]::Synchronized((New-Object System.Collections.ArrayList))
$job = Register-ObjectEvent -InputObject $trace -EventName "OnEvent" -MessageData $evalEvents -Action {
    $Event.MessageData.Add($Event.SourceEventArgs) | Out-Null
}
```

**Always clear the VertiPaq cache** before debug queries; cached results prevent EVALUATEANDLOG from firing:

```powershell
$server.Execute('{ "clearCache": { "object": { "database": "' + $db.Name + '" } } }') | Out-Null
```

**Common debugging patterns:**

| Pattern | Approach |
|---------|----------|
| Measure chain decomposition | Wrap each intermediate step: `EVALUATEANDLOG([Step1], "Label1")` |
| Filter context inspection | Trace CALCULATE with vs without ALL/REMOVEFILTERS |
| BLANK vs zero detection | Trace the value before a comparison; BLANK = 0 is TRUE in DAX |
| Variable context trap | Trace VAR value alongside CALCULATE result; proves VAR is not re-evaluated |
| Grand total diagnosis | Trace numerator + denominator at row vs total grain |
| Table expression inspection | Wrap CALCULATETABLE result; trace shows actual rows feeding an aggregate |

For full setup, JSON payload structure, event batching behavior, and all debugging patterns, see [evaluateandlog-debugging.md](./references/evaluateandlog-debugging.md).


## 12. Performance Profiling

Programmatic equivalent of DAX Studio's Server Timings. Subscribe to `QueryEnd`, `VertiPaqSEQueryEnd`, and `VertiPaqSEQueryCacheMatch` trace events to measure Formula Engine (FE) vs Storage Engine (SE) time per query.

**Key formula:** FE time = Total duration - sum(SE scan durations)

**Important:** `VertiPaqSEQueryCacheMatch` does NOT support `Duration` or `CpuTime` columns; adding them causes `$trace.Update()` to throw. Only add `TextData` + `EventClass` for cache match events.

**Workflow:**
1. Create trace with performance events (see reference for column compatibility)
2. Clear cache (TMSL `clearCache`) for cold timings
3. Execute DAX via ADOMD.NET
4. Parse trace events: `QueryEnd` for total, `VertiPaqSEQueryEnd` for per-scan SE durations
5. Compare cold vs warm cache to measure cache benefit

**Statistical sampling:** Single measurements are noisy. Always take 6-12 samples and compare medians (not means) before and after a change. If ranges overlap significantly, the difference is likely noise. Discard the first cold-cache run as warm-up. See the reference for a `Measure-QueryMedian` helper.

**Visual query profiling:** Construct SUMMARIZECOLUMNS queries from PBIR `visual.json` definitions. Column projections become group-by columns; measure projections become measure references; `Aggregation.Function` maps to SUM (0), MIN (1), MAX (2), COUNT (3), AVERAGE (4).

For full setup, timing interpretation, sampling patterns, and PBIR-to-DAX translation, see [performance-profiling.md](./references/performance-profiling.md).


## References

**Skill references:**

- [TOM Object Types CRUD](./references/tom-object-types.md) - Full CRUD examples for every object type including UDFs, Direct Lake, KPI note
- [Annotations and Extended Properties](./references/annotations.md) - Standard PBI annotations, Tabular Editor table groups, auto date/time, field parameters, query groups, custom annotations
- [Calendar Column Groups](./references/calendar-column-groups.md) - Gregorian, fiscal, and ISO week-based calendar definitions via TOM; time units, primary/associated columns
- [DAX Expression Locations](./references/dax-expressions.md) - Where DAX appears in a model: measures, calculated columns/tables, calc items, format strings, detail rows, RLS, UDFs
- [DAX Pitfalls](./references/dax-pitfalls.md) - Deprecated/not-recommended functions, non-existent functions agents hallucinate from SQL/Python/M, common syntax mistakes, BLANK vs NULL
- [EVALUATEANDLOG Debugging](./references/evaluateandlog-debugging.md) - Programmatic DAX debugging via TOM Trace API; capture intermediate results, cache clearing, six debugging patterns for common DAX issues
- [Performance Profiling](./references/performance-profiling.md) - DAX Server Timings via Trace API; FE/SE time split, cold/warm cache comparison, PBIR visual-to-DAX translation, trace event column compatibility
- [Query Listener](./references/query-listener.md) - Capture live visual DAX queries via DMV polling; interpret query structure, timings, filter patterns
- [Export Model](./references/export-model.md) - Export to BIM/TMDL via Tabular Editor CLI, fab CLI, or TOM serializer
- [VertiPaq Statistics](./references/vertipaq-stats.md) - Column cardinality, dictionary/data size, memory by table, server timings via DMVs
- [Refresh Model](./references/refresh-model.md) - All refresh methods (TMSL, TOM RequestRefresh, ADOMD.NET)
- [macOS + Parallels Guide](./references/parallels-macos.md) - Connecting from macOS when PBI Desktop runs in a Parallels VM
- [DAX Library Packages](./references/daxlib.md) - Installing reusable DAX UDF packages from daxlib.org; DaxLib.SVG, PowerofBI.IBCS, package structure, annotations

**CLI tools in `bin/`:**

- **`daxlib`** -- CLI for browsing, downloading, and installing DAX library packages from daxlib.org. Script at `daxlib.sh` (requires bash + jq). Model operations (add/update/remove) call `scripts/daxlib-tom/` via `dotnet run` (requires .NET 8 SDK). On macOS, model operations route through Parallels automatically. See [daxlib.md](./references/daxlib.md) for full command reference.

**Agents:**

- **`query-listener`** -- Dispatch to capture live visual DAX queries in real time; polls `DISCOVER_SESSIONS` and reports query text + timings

**Example scripts in `scripts/`:**

- `connect-and-enumerate.ps1` - Connect to PBI Desktop and list all tables, columns, measures, relationships
- `explore-model.ps1` - Hierarchical metadata enumeration (tables, columns, measures, hierarchies, partitions, relationships, roles, perspectives, cultures, expressions, data sources)
- `query-dax.ps1` - Execute DAX queries via ADOMD.NET with formatted output
- `refresh-table.ps1` - Refresh a table or entire model via TMSL with configurable refresh type
- `modify-tom-objects.ps1` - Create table, rename measures, set folders/formats, hide columns, create relationship (with undo)
- `create-field-parameter.ps1` - Create a field parameter table from a list of measures with all required metadata
- `debug-dax.ps1` - Debug DAX with EVALUATEANDLOG trace capture and performance timings; auto-detects port, enumerates model measures, provides `Invoke-DebugQuery` helper
- `connect-from-mac.sh` - macOS wrapper that runs PowerShell scripts in a Parallels VM via `prlctl exec`

**External references:**

- [TOM API Docs](https://learn.microsoft.com/en-us/dotnet/api/microsoft.analysisservices.tabular)
- [ADOMD.NET Docs](https://learn.microsoft.com/en-us/dotnet/api/microsoft.analysisservices.adomdclient)
- [Analysis Services Client Libraries](https://learn.microsoft.com/en-us/analysis-services/client-libraries)
- [DAX Guide](https://dax.guide) - use `dax.guide/<function>/` for individual function reference
