<#
.SYNOPSIS
    Creates a field parameter table from a list of measures.

.DESCRIPTION
    Connects to PBI Desktop's local Analysis Services, creates a calculated table
    with the field parameter structure (display column, fields column with
    ParameterMetadata, order column), configures all required column properties,
    and saves changes.

    The resulting table appears as a slicer-ready field parameter in Power BI.

.PARAMETER Port
    The local Analysis Services port (from msmdsrv.port.txt or netstat).

.PARAMETER Name
    Name for the field parameter table (e.g. "FP - Metrics").

.PARAMETER Measures
    Comma-separated list of measure names to include (e.g. "Total Revenue,Total Cost,Gross Margin").

.PARAMETER TableGroup
    Optional Tabular Editor table group annotation (default: "05. Parameters").

.EXAMPLE
    .\create-field-parameter.ps1 -Port 54321 -Name "FP - Metrics" -Measures "Total Revenue,Total Cost,Gross Margin"
#>

param(
    [Parameter(Mandatory=$true)]
    [int]$Port,

    [Parameter(Mandatory=$true)]
    [string]$Name,

    [Parameter(Mandatory=$true)]
    [string]$Measures,

    [string]$TableGroup = "05. Parameters"
)

$ErrorActionPreference = "Stop"


#region Prerequisites

$basePath = "$env:TEMP\tom_nuget\Microsoft.AnalysisServices.retail.amd64\lib\net45"
if (-not (Test-Path "$basePath\Microsoft.AnalysisServices.Tabular.dll")) {
    Write-Error "TOM NuGet package not found. Install with: nuget install Microsoft.AnalysisServices.retail.amd64 -OutputDirectory `"$env:TEMP\tom_nuget`" -ExcludeVersion"
    exit 1
}

Add-Type -Path "$basePath\Microsoft.AnalysisServices.Core.dll"
Add-Type -Path "$basePath\Microsoft.AnalysisServices.Tabular.dll"

#endregion


#region Connect

$server = New-Object Microsoft.AnalysisServices.Tabular.Server
$server.Connect("Data Source=localhost:$Port")
$db = $server.Databases[0]
$model = $db.Model

Write-Output "Connected to: $($db.Name)"

#endregion


#region Validate measures exist

$measureList = $Measures -split "," | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }

if ($measureList.Count -eq 0) {
    Write-Error "No measures specified."
    $server.Disconnect()
    exit 1
}

# Verify each measure exists in the model
$allMeasures = $model.Tables | ForEach-Object { $_.Measures } | ForEach-Object { $_.Name }
foreach ($mName in $measureList) {
    if ($mName -notin $allMeasures) {
        Write-Error "Measure [$mName] not found in model. Available: $($allMeasures -join ', ')"
        $server.Disconnect()
        exit 1
    }
}

# Check table name doesn't already exist
if ($model.Tables[$Name]) {
    Write-Error "Table [$Name] already exists in model."
    $server.Disconnect()
    exit 1
}

#endregion


#region Build DAX expression

$rows = for ($i = 0; $i -lt $measureList.Count; $i++) {
    $label = $measureList[$i]
    "    (`"$label`", NAMEOF([$label]), $i)"
}
$daxExpr = "{`n" + ($rows -join ",`n") + "`n}"

Write-Output "DAX expression:"
Write-Output $daxExpr

#endregion


#region Create and configure table

try {
    $fpTable = New-Object Microsoft.AnalysisServices.Tabular.Table
    $fpTable.Name = $Name

    $partition = New-Object Microsoft.AnalysisServices.Tabular.Partition
    $partition.Name = $Name
    $partition.Source = New-Object Microsoft.AnalysisServices.Tabular.CalculatedPartitionSource
    $partition.Source.Expression = $daxExpr
    $fpTable.Partitions.Add($partition)

    $model.Tables.Add($fpTable)
    $model.SaveChanges() | Out-Null

    Write-Output "Table created. Refreshing to populate columns..."

    $model.Tables[$Name].RequestRefresh([Microsoft.AnalysisServices.Tabular.RefreshType]::Calculate)
    $model.SaveChanges() | Out-Null

    # Re-fetch the table after refresh (columns are now auto-inferred)
    $fpTable = $model.Tables[$Name]

    # Identify the three auto-generated CalculatedTableColumns by SourceColumn
    $nameCol = $fpTable.Columns | Where-Object { $_.SourceColumn -eq "[Value1]" }
    $fieldsCol = $fpTable.Columns | Where-Object { $_.SourceColumn -eq "[Value2]" }
    $orderCol = $fpTable.Columns | Where-Object { $_.SourceColumn -eq "[Value3]" }

    if (-not $nameCol -or -not $fieldsCol -or -not $orderCol) {
        throw "Could not identify auto-generated columns. Expected [Value1], [Value2], [Value3]."
    }

    # Rename
    $nameCol.Name = $Name
    $fieldsCol.Name = "$Name Fields"
    $orderCol.Name = "$Name Order"

    # Visibility
    $fieldsCol.IsHidden = $true
    $orderCol.IsHidden = $true

    # Sort name column by order column
    $nameCol.SortByColumn = $orderCol

    # Sort fields column by order column
    $fieldsCol.SortByColumn = $orderCol

    # Set groupBy relationship (name column grouped by fields column)
    $gbc = New-Object Microsoft.AnalysisServices.Tabular.GroupByColumn
    $gbc.GroupingColumn = $fieldsCol
    $rcd = New-Object Microsoft.AnalysisServices.Tabular.RelatedColumnDetails
    $rcd.GroupByColumns.Add($gbc)
    $nameCol.RelatedColumnDetails = $rcd

    # Set ParameterMetadata extended property on fields column
    $ep = New-Object Microsoft.AnalysisServices.Tabular.JsonExtendedProperty
    $ep.Name = "ParameterMetadata"
    $ep.Value = '{"version":3,"kind":2}'
    $fieldsCol.ExtendedProperties.Add($ep)

    # Format order column
    $orderCol.FormatString = "0"

    # Tabular Editor table group annotation
    $fpTable.Annotations.Add(
        (New-Object Microsoft.AnalysisServices.Tabular.Annotation -Property @{
            Name = "TabularEditor_TableGroup"
            Value = $TableGroup
        })
    )

    $model.SaveChanges() | Out-Null
}
catch {
    Write-Output "ERROR: $($_.Exception.Message)"
    # Remove the half-created table so the model is left as found
    $partial = $model.Tables[$Name]
    if ($partial) {
        $model.Tables.Remove($partial)
        $model.SaveChanges() | Out-Null
        Write-Output "Cleanup: removed partially created table [$Name]."
    }
    $server.Disconnect()
    Write-Output "Field parameter creation FAILED; no changes were kept."
    exit 1
}

#endregion


#region Report

Write-Output ""
Write-Output "Field parameter [$Name] created with $($measureList.Count) measures:"
foreach ($m in $measureList) {
    Write-Output "  - $m"
}
Write-Output ""
Write-Output "Columns:"
foreach ($c in $fpTable.Columns | Where-Object { $_ -isnot [Microsoft.AnalysisServices.Tabular.RowNumberColumn] }) {
    $hidden = if ($c.IsHidden) { " (hidden)" } else { "" }
    Write-Output "  [$($c.Name)]$hidden"
}

$server.Disconnect()
Write-Output ""
Write-Output "Done. The field parameter is ready to use as a slicer in Power BI."

#endregion
