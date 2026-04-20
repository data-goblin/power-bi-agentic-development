# load-tmdl.ps1
# Load a local TMDL folder or BIM file into TOM, enumerate the model, and optionally modify it.
# No running Analysis Services instance required; works entirely offline.
#
# Usage:
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File load-tmdl.ps1 -Path "C:\MyModel\definition"
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File load-tmdl.ps1 -Path "C:\model.bim"
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File load-tmdl.ps1 -Path "C:\MyModel\definition" -AddMeasure "Sales:Test Measure:SUM(Sales[Amount])"

param(
    [Parameter(Mandatory=$true)]
    [string]$Path,

    # Optional: add a measure as "TableName:MeasureName:Expression"
    [string]$AddMeasure = "",

    # Optional: save changes back after modification
    [switch]$Save,

    # Optional: save to a different location
    [string]$SaveTo = ""
)


#region Setup

$pkgDir = "$env:TEMP\tom_nuget"
$basePath = "$pkgDir\Microsoft.AnalysisServices.retail.amd64\lib\net45"

if (-not (Test-Path "$basePath\Microsoft.AnalysisServices.Tabular.dll")) {
    Write-Output "Installing TOM NuGet package..."
    nuget install Microsoft.AnalysisServices.retail.amd64 -OutputDirectory $pkgDir -ExcludeVersion | Out-Null
}

Add-Type -Path "$basePath\Microsoft.AnalysisServices.Core.dll"
Add-Type -Path "$basePath\Microsoft.AnalysisServices.Tabular.dll"
Add-Type -Path "$basePath\Microsoft.AnalysisServices.Tabular.Json.dll"

#endregion


#region Load Model

$db = $null

if (Test-Path $Path -PathType Container) {
    # TMDL folder
    Write-Output "Loading TMDL from: $Path"
    $db = [Microsoft.AnalysisServices.Tabular.TmdlSerializer]::DeserializeDatabaseFromFolder($Path)
}
elseif ($Path -match '\.bim$' -and (Test-Path $Path -PathType Leaf)) {
    # BIM file
    Write-Output "Loading BIM from: $Path"
    $json = [System.IO.File]::ReadAllText($Path)
    $db = [Microsoft.AnalysisServices.Tabular.JsonSerializer]::DeserializeDatabase($json)
}
else {
    Write-Error "Path must be a TMDL folder or .bim file: $Path"
    exit 1
}

$model = $db.Model
Write-Output ""
Write-Output "Database: $($db.Name)"
Write-Output "Compatibility: $($db.CompatibilityLevel)"
Write-Output ""

#endregion


#region Enumerate

Write-Output "=== Tables ($($model.Tables.Count)) ==="
foreach ($table in $model.Tables) {
    $cols = ($table.Columns | Where-Object {
        $_ -isnot [Microsoft.AnalysisServices.Tabular.RowNumberColumn]
    }).Count
    $measures = $table.Measures.Count
    $parts = $table.Partitions.Count
    Write-Output "  $($table.Name)  (cols: $cols, measures: $measures, partitions: $parts)"

    foreach ($m in $table.Measures) {
        $expr = $m.Expression
        if ($expr.Length -gt 60) { $expr = $expr.Substring(0, 60) + "..." }
        Write-Output "    [M] $($m.Name) = $expr"
    }
}

Write-Output ""
Write-Output "=== Relationships ($($model.Relationships.Count)) ==="
foreach ($rel in $model.Relationships) {
    $r = [Microsoft.AnalysisServices.Tabular.SingleColumnRelationship]$rel
    $dir = $r.CrossFilteringBehavior
    Write-Output "  $($r.FromTable.Name)[$($r.FromColumn.Name)] -> $($r.ToTable.Name)[$($r.ToColumn.Name)] ($dir)"
}

if ($model.Roles.Count -gt 0) {
    Write-Output ""
    Write-Output "=== Roles ($($model.Roles.Count)) ==="
    foreach ($role in $model.Roles) {
        Write-Output "  $($role.Name) ($($role.ModelPermission))"
    }
}

if ($model.Expressions.Count -gt 0) {
    Write-Output ""
    Write-Output "=== Expressions ($($model.Expressions.Count)) ==="
    foreach ($expr in $model.Expressions) {
        Write-Output "  $($expr.Name)"
    }
}

#endregion


#region Modify (optional)

if ($AddMeasure -ne "") {
    $parts = $AddMeasure -split ":", 3
    if ($parts.Count -ne 3) {
        Write-Error "AddMeasure format: TableName:MeasureName:Expression"
        exit 1
    }

    $tableName = $parts[0]
    $measureName = $parts[1]
    $expression = $parts[2]

    $table = $model.Tables[$tableName]
    if ($null -eq $table) {
        Write-Error "Table '$tableName' not found."
        exit 1
    }

    if ($table.Measures.ContainsName($measureName)) {
        Write-Error "Measure '$measureName' already exists in '$tableName'."
        exit 1
    }

    $measure = New-Object Microsoft.AnalysisServices.Tabular.Measure
    $measure.Name = $measureName
    $measure.Expression = $expression
    $table.Measures.Add($measure)

    Write-Output ""
    Write-Output "Added measure: $tableName/$measureName = $expression"
}

#endregion


#region Save (optional)

$savePath = ""
if ($SaveTo -ne "") {
    $savePath = $SaveTo
} elseif ($Save) {
    $savePath = $Path
}

if ($savePath -ne "") {
    if ($savePath -match '\.bim$') {
        # Save as BIM
        $json = [Microsoft.AnalysisServices.Tabular.JsonSerializer]::SerializeDatabase($db)
        [System.IO.File]::WriteAllText($savePath, $json)
        Write-Output "Saved BIM to: $savePath"
    }
    else {
        # Save as TMDL folder
        [Microsoft.AnalysisServices.Tabular.TmdlSerializer]::SerializeDatabaseToFolder($db, $savePath)
        Write-Output "Saved TMDL to: $savePath"
    }
}

#endregion
