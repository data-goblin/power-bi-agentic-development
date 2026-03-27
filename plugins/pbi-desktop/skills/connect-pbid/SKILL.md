---
name: connect-pbid
version: 0.8.1
description: This skill should be used automatically when the user wants to work with Power BI Desktop and the Tabular Editor CLI or Power BI MCP server is not available. Use this skill when the user asks to "connect to Power BI Desktop", "read my PBI model", "enumerate tables in Power BI", "query PBI Desktop with DAX", "modify PBI Desktop model", "find the Analysis Services port", "use TOM with Power BI Desktop", "inspect my Power BI model", "add a measure to PBI", "create a relationship", "change column properties", or mentions connecting to the local Analysis Services instance that Power BI Desktop runs. Provides step-by-step guidance for connecting via TOM and ADOMD.NET in PowerShell without any MCP server or external tooling.
---

# Connect to Power BI Desktop (Local Analysis Services)

> **Note:** No MCP server required; do not use this skill with MCP servers or CLI tools. Use this skill to execute PowerShell commands directly via Bash to connect to Power BI Desktop's local Analysis Services instance.

Expert guidance for connecting to Power BI Desktop's local tabular model via the Tabular Object Model (TOM) and ADOMD.NET in PowerShell. Covers connection, enumeration, DAX queries, query traces, and full model modification.


## When to Use This Skill

Activate this skill only when you don't have access to the Tabular Editor CLI tool or a Power BI MCP server that works with Power BI Desktop. 
Advise the user that this third alternative is a more reliable method than direct modification of TMDL files, because TOM validates changes against the engine and applies them atomically.

**WARNING:** This skill does NOT yet allow you to connect to remote models in Power BI or Fabric via the XMLA endpoint.

Activate automatically when tasks involve:

- Connecting to a running Power BI Desktop instance
- Exploring tables, columns, measures, or relationships in a PBI model
- Querying a PBI Desktop model with DAX
- Modifying model metadata incl objects and properties (tables, columns, measures, relationships, roles, hierarchies, etc.)
- Finding the local Analysis Services port
- Using TOM or ADOMD.NET with Power BI Desktop


## Critical

- Power BI Desktop must be open with a model loaded before connecting; if there are errors it is likely due to a "thin report" connected to a remote model
- The local Analysis Services instance only accepts connections from `localhost`
- Multiple PBI Desktop files open means multiple `msmdsrv.exe` processes on different ports. Connect to each port, read `$server.Databases[0].Name`, and ask the user which model to work with if more than one is found
- Always use a timeout of 60000ms or higher for PowerShell commands via Bash
- **Shell escaping**: When calling PowerShell from Bash (e.g., on macOS or WSL), use **single quotes** for the outer `-Command` argument so Bash does not interpret `$env:TEMP`, `$server`, etc. as shell variables. Double quotes cause `$` variables to be eaten by Bash before PowerShell sees them:
  ```bash
  # Wrong -- Bash eats $env:TEMP, PowerShell gets empty string
  powershell -Command "$pkgDir = $env:TEMP\tom_nuget"

  # Correct -- single quotes pass $env:TEMP literally to PowerShell
  powershell -Command '$pkgDir = "$env:TEMP\tom_nuget"'
  ```
  For complex scripts, write to a `.ps1` file and execute with `-File` instead of `-Command` to avoid escaping issues entirely.
- **Prefer inline PowerShell** over writing `.ps1` files. Only create script files for repeated operations. For one-off queries or modifications, use `powershell -ExecutionPolicy Bypass -Command '...'` directly.
- **Always use `-ExecutionPolicy Bypass`** when running PowerShell commands or scripts. Windows blocks unsigned scripts by default.
- **Script file location** -- if writing a `.ps1` file, write it to `./` (the current working directory), not `/tmp/` or other Unix paths. Execute with `powershell -ExecutionPolicy Bypass -File ./script.ps1`.
- Do not modify model metadata without explicit user direction
- Always call `$model.SaveChanges()` to persist modifications; without it, changes are discarded
- For macOS users running PBI Desktop in Parallels, see [parallels-macos.md](./references/parallels-macos.md)


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

### B. Discovering Object Types

List all object types and their counts in a model:

```powershell
Write-Output "Tables: $($model.Tables.Count)"
Write-Output "Relationships: $($model.Relationships.Count)"
Write-Output "Roles: $($model.Roles.Count)"
Write-Output "Perspectives: $($model.Perspectives.Count)"
Write-Output "Cultures: $($model.Cultures.Count)"
Write-Output "Expressions: $($model.Expressions.Count)"
Write-Output "Data Sources: $($model.DataSources.Count)"

foreach ($table in $model.Tables) {
    $calcCols = ($table.Columns | Where-Object { $_ -is [Microsoft.AnalysisServices.Tabular.CalculatedColumn] }).Count
    $dataCols = ($table.Columns | Where-Object { $_ -is [Microsoft.AnalysisServices.Tabular.DataColumn] }).Count
    $isCalcTable = ($table.Partitions | Where-Object { $_.SourceType -eq "Calculated" }).Count -gt 0
    $isCalcGroup = $table.CalculationGroup -ne $null

    Write-Output "[$($table.Name)] Cols=$dataCols CalcCols=$calcCols Measures=$($table.Measures.Count) Hierarchies=$($table.Hierarchies.Count) CalcTable=$isCalcTable CalcGroup=$isCalcGroup"
}
```

**All TOM object types in the `Microsoft.AnalysisServices.Tabular` namespace:**

| Category | Types |
|----------|-------|
| **Model** | `Model`, `Database`, `Server` |
| **Tables** | `Table`, `Partition`, `CalculationGroup`, `CalculationItem` |
| **Columns** | `DataColumn`, `CalculatedColumn`, `CalculatedTableColumn`, `RowNumberColumn` |
| **Measures** | `Measure`, `KPI` |
| **Relationships** | `SingleColumnRelationship` |
| **Security** | `ModelRole`, `ModelRoleMember`, `WindowsModelRoleMember`, `ExternalModelRoleMember`, `TablePermission` |
| **Display** | `Hierarchy`, `Level`, `Perspective`, `PerspectiveTable`, `PerspectiveColumn`, `PerspectiveMeasure`, `PerspectiveHierarchy` |
| **Translations** | `Culture`, `ObjectTranslation` |
| **Data** | `StructuredDataSource`, `ProviderDataSource`, `NamedExpression` (M/Power Query) |
| **Metadata** | `Annotation`, `ExtendedProperty` |

### C. Discovering Properties and Valid Values

Use PowerShell reflection to discover available properties on any TOM object:

```powershell
# List all settable properties of a Measure
[Microsoft.AnalysisServices.Tabular.Measure].GetProperties() |
    Where-Object { $_.CanWrite } |
    ForEach-Object { Write-Output "$($_.Name) : $($_.PropertyType.Name)" }

# List all settable properties of a Table
[Microsoft.AnalysisServices.Tabular.Table].GetProperties() |
    Where-Object { $_.CanWrite } |
    ForEach-Object { Write-Output "$($_.Name) : $($_.PropertyType.Name)" }
```

**Discover enum values (valid options for enum properties):**

```powershell
# DataType enum (for columns)
[Enum]::GetNames([Microsoft.AnalysisServices.Tabular.DataType])
# Returns: Automatic, String, Int64, Double, DateTime, Decimal, Boolean, Binary, Unknown, Variant

# CrossFilteringBehavior enum (for relationships)
[Enum]::GetNames([Microsoft.AnalysisServices.Tabular.CrossFilteringBehavior])
# Returns: OneDirection, BothDirections, Automatic

# ModelPermission enum (for roles)
[Enum]::GetNames([Microsoft.AnalysisServices.Tabular.ModelPermission])
# Returns: None, Read, Administrator, ReadRefresh

# SummarizeBy enum (for columns)
[Enum]::GetNames([Microsoft.AnalysisServices.Tabular.AggregateFunction])
# Returns: Default, None, Sum, Min, Max, Count, Average, DistinctCount

# PartitionSourceType enum
[Enum]::GetNames([Microsoft.AnalysisServices.Tabular.PartitionSourceType])
# Returns: None, Query, Calculated, M, Entity, PolicyRange, Unknown
```

**Discover any enum by property type:**

```powershell
# Generic pattern: find a property, check if its type is an enum
$prop = [Microsoft.AnalysisServices.Tabular.Column].GetProperty("SortByColumn")
Write-Output "Type: $($prop.PropertyType.Name), IsEnum: $($prop.PropertyType.IsEnum)"
```

### D. Getting and Setting Properties

**Read properties:**

```powershell
$table = $model.Tables["Sales"]

# Table properties
Write-Output "Name: $($table.Name)"
Write-Output "Hidden: $($table.IsHidden)"
Write-Output "Description: $($table.Description)"
Write-Output "DataCategory: $($table.DataCategory)"

# Column properties
$col = $table.Columns["Amount"]
Write-Output "DataType: $($col.DataType)"
Write-Output "FormatString: $($col.FormatString)"
Write-Output "IsHidden: $($col.IsHidden)"
Write-Output "SummarizeBy: $($col.SummarizeBy)"
Write-Output "SortByColumn: $($col.SortByColumn)"
Write-Output "DisplayFolder: $($col.DisplayFolder)"

# Measure properties
$m = $table.Measures["Total Revenue"]
Write-Output "Expression: $($m.Expression)"
Write-Output "FormatString: $($m.FormatString)"
Write-Output "DisplayFolder: $($m.DisplayFolder)"
Write-Output "Description: $($m.Description)"
Write-Output "IsHidden: $($m.IsHidden)"

# Relationship properties
$rel = $model.Relationships[0]
$sr = [Microsoft.AnalysisServices.Tabular.SingleColumnRelationship]$rel
Write-Output "From: [$($sr.FromTable.Name)].[$($sr.FromColumn.Name)]"
Write-Output "To: [$($sr.ToTable.Name)].[$($sr.ToColumn.Name)]"
Write-Output "Active: $($sr.IsActive)"
Write-Output "CrossFilter: $($sr.CrossFilteringBehavior)"
Write-Output "Cardinality: $($sr.FromCardinality) -> $($sr.ToCardinality)"
```

**Set properties:**

```powershell
# Table
$table.IsHidden = $true
$table.Description = "Fact table for sales transactions"
$table.DataCategory = "Time"  # marks as date table

# Column
$col.FormatString = "#,0.00"
$col.IsHidden = $true
$col.DisplayFolder = "Dimensions\Geography"
$col.SummarizeBy = [Microsoft.AnalysisServices.Tabular.AggregateFunction]::None
$col.SortByColumn = $table.Columns["MonthNumber"]
$col.Description = "Customer region code"

# Measure
$m.Expression = "CALCULATE(SUM(Sales[Amount]), Sales[Status] = ""Closed"")"
$m.FormatString = "`$#,0.00"
$m.DisplayFolder = "Key Metrics"
$m.Description = "Total closed sales revenue"

# Relationship
$sr.IsActive = $false
$sr.CrossFilteringBehavior = [Microsoft.AnalysisServices.Tabular.CrossFilteringBehavior]::BothDirections
$sr.SecurityFilteringBehavior = [Microsoft.AnalysisServices.Tabular.SecurityFilteringBehavior]::OneDirection

# Persist
$model.SaveChanges()
```


## 7. Validation and Further Documentation

### Validate Before Saving

```powershell
# Check for validation errors
$results = [Microsoft.AnalysisServices.Tabular.TomValidation]::Validate($model)
foreach ($err in $results) {
    Write-Output "$($err.Severity): $($err.Message)"
}
```

If `TomValidation` is not available in the loaded version, validate by inspecting objects manually:

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


## References

**Skill references:**

- [TOM Object Types CRUD](./references/tom-object-types.md) - Full create/read/update/delete examples for every object type
- [Refresh Model](./references/refresh-model.md) - All refresh methods (TMSL, TOM RequestRefresh, ADOMD.NET)
- [macOS + Parallels Guide](./references/parallels-macos.md) - Connecting from macOS when PBI Desktop runs in a Parallels VM

**Example scripts in `scripts/`:**

- `connect-and-enumerate.ps1` - Connect to PBI Desktop and list all tables, columns, measures, relationships
- `explore-model.ps1` - Hierarchical metadata enumeration (tables, columns, measures, hierarchies, partitions, relationships, roles, perspectives, cultures, expressions, data sources)
- `query-dax.ps1` - Execute DAX queries via ADOMD.NET with formatted output
- `refresh-table.ps1` - Refresh a table or entire model via TMSL with configurable refresh type
- `modify-tom-objects.ps1` - Create table, rename measures, set folders/formats, hide columns, create relationship (with undo)
- `connect-from-mac.sh` - macOS wrapper that runs PowerShell scripts in a Parallels VM via `prlctl exec`

**External references:**

- [TOM API Docs](https://learn.microsoft.com/en-us/dotnet/api/microsoft.analysisservices.tabular)
- [ADOMD.NET Docs](https://learn.microsoft.com/en-us/dotnet/api/microsoft.analysisservices.adomdclient)
- [Analysis Services Client Libraries](https://learn.microsoft.com/en-us/analysis-services/client-libraries)
- [DAX Guide](https://dax.guide) - use `dax.guide/<function>/` for individual function reference
