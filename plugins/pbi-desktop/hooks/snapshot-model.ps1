# Snapshot model metadata to JSON for DAX validation hooks.
# Outputs JSON with tables, columns, measures, and calculated tables.
# Usage: powershell -ExecutionPolicy Bypass -File snapshot-model.ps1 -Port <port> -OutFile <path>

param(
    [Parameter(Mandatory=$true)][int]$Port,
    [Parameter(Mandatory=$true)][string]$OutFile
)

#region Imports
$basePath = "$env:TEMP\tom_nuget\Microsoft.AnalysisServices.retail.amd64\lib\net45"
Add-Type -Path "$basePath\Microsoft.AnalysisServices.Core.dll"
Add-Type -Path "$basePath\Microsoft.AnalysisServices.Tabular.dll"
#endregion


#region Connect
$server = New-Object Microsoft.AnalysisServices.Tabular.Server
$server.Connect("Data Source=localhost:$Port")
$model = $server.Databases[0].Model
$dbName = $server.Databases[0].Name
#endregion


#region Build metadata
$tables = @()
foreach ($table in $model.Tables) {
    $cols = @()
    foreach ($col in $table.Columns) {
        if ($col.Type -ne 'RowNumber') {
            $cols += @{
                name = $col.Name
                dataType = "$($col.DataType)"
                type = "$($col.Type)"
            }
        }
    }

    $measures = @()
    foreach ($m in $table.Measures) {
        $measures += @{
            name = $m.Name
            expression = $m.Expression
        }
    }

    $tables += @{
        name = $table.Name
        columns = $cols
        measures = $measures
    }
}

# Query engine for max supported compatibility level
$maxCL = 0
try {
    Add-Type -Path "$env:TEMP\tom_nuget\Microsoft.AnalysisServices.AdomdClient.retail.amd64\lib\net45\Microsoft.AnalysisServices.AdomdClient.dll"
    $conn = New-Object Microsoft.AnalysisServices.AdomdClient.AdomdConnection
    $conn.ConnectionString = "Data Source=localhost:$Port"
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT [Value] FROM `$SYSTEM.DISCOVER_PROPERTIES WHERE [PropertyName] = 'SupportedCompatibilityLevels'"
    $reader = $cmd.ExecuteReader()
    if ($reader.Read()) {
        $levels = "$($reader.GetValue(0))" -split ','
        $maxCL = ($levels | ForEach-Object { [int]$_.Trim() } | Measure-Object -Maximum).Maximum
    }
    $reader.Close()
    $conn.Close()
} catch {}

$snapshot = @{
    port = $Port
    database = $dbName
    compatibilityLevel = $server.Databases[0].CompatibilityLevel
    maxCompatibilityLevel = $maxCL
    snapshotTime = (Get-Date -Format "o")
    tables = $tables
}
#endregion


#region Write JSON
$json = $snapshot | ConvertTo-Json -Depth 5 -Compress
[System.IO.File]::WriteAllText($OutFile, $json, [System.Text.Encoding]::UTF8)
Write-Output "OK: $($tables.Count) tables snapshotted to $OutFile"
#endregion


#region Disconnect
$server.Disconnect()
#endregion
