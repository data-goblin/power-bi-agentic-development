# query-dax.ps1
# Execute a DAX query against Power BI Desktop's local Analysis Services instance via ADOMD.NET.
# Usage: powershell.exe -NoProfile -ExecutionPolicy Bypass -File query-dax.ps1 -Port <port> -Query "<DAX>"
#
# Examples:
#   .\query-dax.ps1 -Port 53706 -Query "EVALUATE TOPN(5, 'Sales')"
#   .\query-dax.ps1 -Port 53706 -Query "EVALUATE SUMMARIZECOLUMNS('Date'[Year], ""@Total"", SUM('Sales'[Amount]))"
#   .\query-dax.ps1 -Port 53706 -Query "EVALUATE ROW(""Count"", COUNTROWS('Sales'))"
#   .\query-dax.ps1 -Port 53706 -Query "SELECT * FROM `$SYSTEM.TMSCHEMA_MEASURES"

param(
    [Parameter(Mandatory=$true)]
    [int]$Port,

    [Parameter(Mandatory=$true)]
    [string]$Query
)


#region Setup

$pkgDir = "$env:TEMP\tom_nuget"
$dllPath = "$pkgDir\Microsoft.AnalysisServices.AdomdClient.retail.amd64\lib\net45\Microsoft.AnalysisServices.AdomdClient.dll"

# Install ADOMD.NET if missing
if (-not (Test-Path $dllPath)) {
    Write-Output "Installing ADOMD.NET NuGet package..."
    nuget install Microsoft.AnalysisServices.AdomdClient.retail.amd64 -OutputDirectory $pkgDir -ExcludeVersion | Out-Null
}

Add-Type -Path $dllPath

#endregion


#region Execute Query

$conn = New-Object Microsoft.AnalysisServices.AdomdClient.AdomdConnection
$conn.ConnectionString = "Data Source=localhost:$Port"

try {
    $conn.Open()
    Write-Output "Connected to localhost:$Port"
    Write-Output "Executing: $Query"
    Write-Output ""

    $cmd = $conn.CreateCommand()
    $cmd.CommandText = $Query
    $cmd.CommandTimeout = 120

    $reader = $cmd.ExecuteReader()

    # Print header
    $headers = @()
    for ($i = 0; $i -lt $reader.FieldCount; $i++) {
        $headers += $reader.GetName($i)
    }
    Write-Output ($headers -join "`t")
    Write-Output (($headers | ForEach-Object { "-" * $_.Length }) -join "`t")

    # Print rows
    $rowCount = 0
    while ($reader.Read()) {
        $values = @()
        for ($i = 0; $i -lt $reader.FieldCount; $i++) {
            $val = $reader.GetValue($i)
            if ($val -is [System.DBNull]) { $val = "(null)" }
            $values += $val.ToString()
        }
        Write-Output ($values -join "`t")
        $rowCount++
    }

    Write-Output ""
    Write-Output "($rowCount rows returned)"

    $reader.Close()
}
catch {
    Write-Error "Query failed: $($_.Exception.Message)"
}
finally {
    $conn.Close()
}

#endregion
