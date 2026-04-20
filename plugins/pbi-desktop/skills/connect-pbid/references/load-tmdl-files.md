# Loading TMDL / BIM Files into TOM

Load a local semantic model definition (TMDL folder or BIM file) into TOM for programmatic inspection and modification; no running Analysis Services instance required.

## Via Tabular Editor CLI (cross-platform)

Tabular Editor (TE2 or TE3) can load TMDL and BIM natively. Use the CLI (`TabularEditor.exe` on Windows, or the TE3 cross-platform binary) for scripted model inspection and modification.

### Load and inspect

```bash
# Open a TMDL folder in Tabular Editor (GUI)
TabularEditor.exe ./MyModel.SemanticModel/definition

# Open a BIM file in Tabular Editor (GUI)
TabularEditor.exe ./model.bim
```

To inspect model objects programmatically, read the TMDL files directly:

```bash
# List tables
ls ./MyModel.SemanticModel/definition/tables/*.tmdl

# Read a specific table definition (columns, measures, partitions)
cat ./MyModel.SemanticModel/definition/tables/Sales.tmdl

# Find a measure expression
grep -A5 "measure 'Total Revenue'" ./MyModel.SemanticModel/definition/tables/Sales.tmdl
```

### Modify and save

Edit TMDL files directly, or use Tabular Editor:

```bash
# Open in Tabular Editor, make changes, and save
TabularEditor.exe ./MyModel.SemanticModel/definition

# Or edit TMDL files directly; e.g. add a measure to Sales.tmdl:
#   measure 'YTD Revenue' = TOTALYTD([Total Revenue], 'Date'[Date])

# Convert between formats using Tabular Editor CLI (TE2)
TabularEditor.exe ./model.bim -S ./tmdl-out -F TMDL
TabularEditor.exe ./definition -S ./output/model.bim
```

### Deploy to Fabric

```bash
# Deploy local TMDL to a remote workspace via fab CLI
fab import "My Workspace.Workspace/My Model.SemanticModel" -i ./MyModel.SemanticModel -f
```

### Connect to remote model and save locally

```bash
# Export via fab CLI
fab export "My Workspace.Workspace/My Model.SemanticModel" -o ./local-copy -f
```

## Via PowerShell + TOM (Windows)

On Windows, load TMDL/BIM directly via the TOM .NET assemblies. This avoids any running AS instance; TOM deserializes the files into an in-memory Database object.

### Prerequisites

TOM NuGet package installed at `$env:TEMP\tom_nuget`:

```powershell
$pkgDir = "$env:TEMP\tom_nuget"
if (-not (Test-Path "$pkgDir\Microsoft.AnalysisServices.retail.amd64\lib\net45\Microsoft.AnalysisServices.Tabular.dll")) {
    nuget install Microsoft.AnalysisServices.retail.amd64 -OutputDirectory $pkgDir -ExcludeVersion | Out-Null
}
Add-Type -Path "$pkgDir\Microsoft.AnalysisServices.retail.amd64\lib\net45\Microsoft.AnalysisServices.Core.dll"
Add-Type -Path "$pkgDir\Microsoft.AnalysisServices.retail.amd64\lib\net45\Microsoft.AnalysisServices.Tabular.dll"
Add-Type -Path "$pkgDir\Microsoft.AnalysisServices.retail.amd64\lib\net45\Microsoft.AnalysisServices.Tabular.Json.dll"
```

### Load TMDL folder

```powershell
$tmdlPath = "C:\Projects\MyModel.SemanticModel\definition"
$db = [Microsoft.AnalysisServices.Tabular.TmdlSerializer]::DeserializeDatabaseFromFolder($tmdlPath)
$model = $db.Model

Write-Output "Loaded: $($db.Name) (compat $($db.CompatibilityLevel))"
Write-Output "Tables: $($model.Tables.Count)"
```

### Load BIM file

```powershell
$bimPath = "C:\Projects\model.bim"
$json = [System.IO.File]::ReadAllText($bimPath)
$db = [Microsoft.AnalysisServices.Tabular.JsonSerializer]::DeserializeDatabase($json)
$model = $db.Model

Write-Output "Loaded: $($db.Name) (compat $($db.CompatibilityLevel))"
Write-Output "Tables: $($model.Tables.Count)"
```

### Inspect the loaded model

Once loaded, the `$model` object has the same TOM API as a live connection:

```powershell
# List tables
foreach ($table in $model.Tables) {
    Write-Output "$($table.Name): $($table.Columns.Count) cols, $($table.Measures.Count) measures"
}

# Read a measure
$m = $model.Tables["Sales"].Measures["Total Revenue"]
Write-Output "$($m.Name) = $($m.Expression)"

# List relationships
foreach ($rel in $model.Relationships) {
    $r = [Microsoft.AnalysisServices.Tabular.SingleColumnRelationship]$rel
    Write-Output "$($r.FromTable.Name)[$($r.FromColumn.Name)] -> $($r.ToTable.Name)[$($r.ToColumn.Name)]"
}
```

### Modify and save back

```powershell
# Add a measure
$measure = New-Object Microsoft.AnalysisServices.Tabular.Measure
$measure.Name = "YTD Revenue"
$measure.Expression = "TOTALYTD([Total Revenue], 'Date'[Date])"
$model.Tables["Sales"].Measures.Add($measure)

# Save back to TMDL
[Microsoft.AnalysisServices.Tabular.TmdlSerializer]::SerializeDatabaseToFolder($db, $tmdlPath)

# Or save as BIM
$json = [Microsoft.AnalysisServices.Tabular.JsonSerializer]::SerializeDatabase($db)
[System.IO.File]::WriteAllText("C:\export\model.bim", $json)
```

### Deploy the modified model

After modifying the in-memory model, deploy to a remote workspace:

```powershell
# Option 1: save to TMDL, then use fab import
[Microsoft.AnalysisServices.Tabular.TmdlSerializer]::SerializeDatabaseToFolder($db, $tmdlPath)
fab import "WorkspaceName.Workspace/ModelName.SemanticModel" -i $tmdlPath -f

# Option 2: deploy via fab CLI
fab import "WorkspaceName.Workspace/ModelName.SemanticModel" -i $tmdlPath -f
```

## Key Differences: Live Connection vs Local Files

| | Live connection (localhost) | Local files (TMDL/BIM) |
|---|---|---|
| **Source** | Running `msmdsrv.exe` process | Files on disk |
| **SaveChanges** | Writes to AS engine instantly | Must serialize back to disk |
| **Refresh** | Can trigger data refresh | No data; schema only |
| **DAX queries** | Yes (via ADOMD.NET) | No (no engine running) |
| **DMV queries** | Yes | No |
| **Undo** | `UndoLocalChanges()` discards unsaved | Revert files via git |
| **Deploy** | Already live | Needs `fab import` |

## Common Patterns

### Round-trip: pull, modify, push

```bash
# Pull from Fabric
fab export "Prod.Workspace/Sales.SemanticModel" -o ./working -f

# Modify locally (edit TMDL files directly or open in Tabular Editor)
# e.g. add to ./working/Sales.SemanticModel/definition/tables/Sales.tmdl:
#   measure 'New KPI' = DIVIDE([Revenue], [Target])

# Push back
fab import "Prod.Workspace/Sales.SemanticModel" -i ./working/Sales.SemanticModel -f
```

### Convert between formats

```bash
# BIM to TMDL (using Tabular Editor CLI)
TabularEditor.exe ./model.bim -S ./tmdl-output -F TMDL

# TMDL to BIM (using Tabular Editor CLI)
TabularEditor.exe ./definition -S ./output/model.bim
```
