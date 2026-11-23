
function Get-DesktopPorts {
    $procs = @(Get-Process msmdsrv -ErrorAction SilentlyContinue)
    if ($procs.Count -eq 0) { return @() }
    $ids = $procs.Id
    $conns = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $ids -contains $_.OwningProcess }
    foreach ($proc in $procs) {
        $port = ($conns | Where-Object OwningProcess -eq $proc.Id | Select-Object -First 1).LocalPort
        $parent = (Get-CimInstance Win32_Process -Filter "ProcessId=$($proc.Id)").ParentProcessId
        [pscustomobject]@{ Port = $port; MsmdsrvPid = $proc.Id; DesktopPid = $parent }
    }
}

function Add-TomAssemblies {
    $newer = "$env:TEMP\tom_nuget\Microsoft.AnalysisServices\lib\net472"
    $retail = "$env:TEMP\tom_nuget\Microsoft.AnalysisServices.retail.amd64\lib\net45"
    $base = if (Test-Path "$newer\Microsoft.AnalysisServices.Tabular.dll") { $newer } else { $retail }
    if (-not (Test-Path "$base\Microsoft.AnalysisServices.Tabular.dll")) {
        throw "TOM not found under $env:TEMP\tom_nuget. Install: nuget install Microsoft.AnalysisServices.retail.amd64 -OutputDirectory $env:TEMP\tom_nuget -ExcludeVersion"
    }
    Add-Type -Path "$base\Microsoft.AnalysisServices.Core.dll"
    Add-Type -Path "$base\Microsoft.AnalysisServices.Tabular.dll"
}

if ($MyInvocation.InvocationName -ne '.') {
    Add-TomAssemblies
    $found = @(Get-DesktopPorts)
    if ($found.Count -eq 0) { Write-Error "No msmdsrv.exe running. Is Power BI Desktop open with a model loaded?"; exit 1 }
    foreach ($f in $found) {
        $server = New-Object Microsoft.AnalysisServices.Tabular.Server
        try {
            $server.Connect("Data Source=localhost:$($f.Port)")
            $db = if ($server.Databases.Count -gt 0) { $server.Databases[0] } else { $null }
            $name = if ($db) { "$($db.Name) (compatibility $($db.CompatibilityLevel))" } else { "no model (thin report)" }
            Write-Output "port $($f.Port) | PBIDesktop pid $($f.DesktopPid) | $name"
        } catch {
            Write-Output "port $($f.Port) | connect failed: $($_.Exception.Message)"
        } finally {
            if ($server.Connected) { $server.Disconnect() }
        }
    }
}
