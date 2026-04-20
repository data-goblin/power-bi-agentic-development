# Debug DAX expressions using EVALUATEANDLOG and the TOM Trace API.
# Captures intermediate results and performance timings programmatically.
#
# Usage: Modify $port and $queries, then run.
# Requires TOM + ADOMD.NET NuGet packages (see connect-pbid skill Section 1).

param(
    [int]$Port = 0,
    [switch]$ColdCache = $false
)


#region Setup

$basePath = "$env:TEMP\tom_nuget\Microsoft.AnalysisServices.retail.amd64\lib\net45"
Add-Type -Path "$basePath\Microsoft.AnalysisServices.Core.dll"
Add-Type -Path "$basePath\Microsoft.AnalysisServices.Tabular.dll"
Add-Type -Path "$env:TEMP\tom_nuget\Microsoft.AnalysisServices.AdomdClient.retail.amd64\lib\net45\Microsoft.AnalysisServices.AdomdClient.dll"

# Auto-detect port if not provided
if ($Port -eq 0) {
    $portFiles = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\Power BI Desktop\AnalysisServicesWorkspaces\*\Data\msmdsrv.port.txt" -ErrorAction SilentlyContinue
    if (-not $portFiles) {
        $portFiles = Get-ChildItem "C:\Users\*\Microsoft\Power BI Desktop Store App\AnalysisServicesWorkspaces\*\Data\msmdsrv.port.txt" -ErrorAction SilentlyContinue
    }
    if ($portFiles) {
        $Port = [int](Get-Content $portFiles[0].FullName).Trim()
    } else {
        $pids = (Get-Process msmdsrv -ErrorAction SilentlyContinue).Id
        if ($pids) {
            $lines = netstat -ano | Select-String "LISTENING" | Where-Object { $pids -contains ($_ -split "\s+")[-1] }
            $Port = [int](($lines[0] -split "\s+")[2] -replace ".*:")
        }
    }
    if ($Port -eq 0) { Write-Error "Cannot find Analysis Services port."; exit 1 }
}

$server = New-Object Microsoft.AnalysisServices.Tabular.Server
$server.Connect("Data Source=localhost:$Port")
$db = $server.Databases[0]
Write-Output "Connected to: $($db.Name) on port $Port"

#endregion


#region Create Traces

# DAX Evaluation Log trace
$evalTrace = $server.Traces.Add("EvalDbg_" + [guid]::NewGuid().ToString("N").Substring(0,8))
$te = $evalTrace.Events.Add([Microsoft.AnalysisServices.TraceEventClass]::DAXEvaluationLog)
$te.Columns.Add([Microsoft.AnalysisServices.TraceColumn]::TextData)
$te.Columns.Add([Microsoft.AnalysisServices.TraceColumn]::EventClass)
$evalTrace.Update()

$evalEvents = [System.Collections.ArrayList]::Synchronized((New-Object System.Collections.ArrayList))
$evalJob = Register-ObjectEvent -InputObject $evalTrace -EventName "OnEvent" -MessageData $evalEvents -Action {
    $Event.MessageData.Add($Event.SourceEventArgs) | Out-Null
}
$evalTrace.Start()

# Performance trace
$perfTrace = $server.Traces.Add("PerfDbg_" + [guid]::NewGuid().ToString("N").Substring(0,8))
foreach ($ec in @([Microsoft.AnalysisServices.TraceEventClass]::QueryEnd,
                  [Microsoft.AnalysisServices.TraceEventClass]::VertiPaqSEQueryEnd)) {
    $pte = $perfTrace.Events.Add($ec)
    $pte.Columns.Add([Microsoft.AnalysisServices.TraceColumn]::TextData)
    $pte.Columns.Add([Microsoft.AnalysisServices.TraceColumn]::EventClass)
    $pte.Columns.Add([Microsoft.AnalysisServices.TraceColumn]::Duration)
    $pte.Columns.Add([Microsoft.AnalysisServices.TraceColumn]::CpuTime)
}
$pte2 = $perfTrace.Events.Add([Microsoft.AnalysisServices.TraceEventClass]::VertiPaqSEQueryCacheMatch)
$pte2.Columns.Add([Microsoft.AnalysisServices.TraceColumn]::TextData)
$pte2.Columns.Add([Microsoft.AnalysisServices.TraceColumn]::EventClass)
$perfTrace.Update()

$perfEvents = [System.Collections.ArrayList]::Synchronized((New-Object System.Collections.ArrayList))
$perfJob = Register-ObjectEvent -InputObject $perfTrace -EventName "OnEvent" -MessageData $perfEvents -Action {
    $Event.MessageData.Add($Event.SourceEventArgs) | Out-Null
}
$perfTrace.Start()

Write-Output "Traces started (DAX Evaluation Log + Performance)"

#endregion


#region Query Helper

function Invoke-DebugQuery {
    param([string]$Label, [string]$Query)

    if ($ColdCache) {
        $tmsl = '{ "clearCache": { "object": { "database": "' + $db.Name + '" } } }'
        try { $server.Execute($tmsl) | Out-Null } catch {}
    }

    $esi = $evalEvents.Count
    $psi = $perfEvents.Count

    $conn = New-Object Microsoft.AnalysisServices.AdomdClient.AdomdConnection
    $conn.ConnectionString = "Data Source=localhost:$Port"
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = $Query

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $rows = 0
    try {
        $reader = $cmd.ExecuteReader()
        while ($reader.Read()) {
            if ($rows -lt 5) {
                $vals = @()
                for ($i = 0; $i -lt $reader.FieldCount; $i++) {
                    $v = $reader.GetValue($i)
                    if ("$v" -eq "") { $v = "(BLANK)" }
                    $vals += "$($reader.GetName($i))=$v"
                }
                Write-Output "    $($vals -join ' | ')"
            }
            $rows++
        }
        $reader.Close()
    } catch {
        Write-Output "    ERROR: $($_.Exception.Message)"
    }
    $sw.Stop()
    $conn.Close()

    Start-Sleep -Milliseconds 800

    # Performance
    $qe = @($perfEvents[$psi..($perfEvents.Count-1)] | Where-Object { $_.EventClass -eq "QueryEnd" })
    $se = @($perfEvents[$psi..($perfEvents.Count-1)] | Where-Object { $_.EventClass -eq "VertiPaqSEQueryEnd" })
    $ch = @($perfEvents[$psi..($perfEvents.Count-1)] | Where-Object { $_.EventClass -eq "VertiPaqSEQueryCacheMatch" })
    $totalMs = if ($qe.Count -gt 0) { $qe[0].Duration } else { $sw.ElapsedMilliseconds }
    $seMs = 0; foreach ($s in $se) { $seMs += $s.Duration }
    $feMs = [Math]::Max(0, $totalMs - $seMs)

    Write-Output "  Perf: Total=${totalMs}ms FE=${feMs}ms SE=${seMs}ms SE#=$($se.Count) Cache=$($ch.Count) Rows=$rows"

    # EVALUATEANDLOG events
    $newEvents = $evalEvents.Count - $esi
    if ($newEvents -gt 0) {
        Write-Output "  EvalLog: $newEvents events"
        for ($i = $esi; $i -lt $evalEvents.Count; $i++) {
            $json = $evalEvents[$i].TextData | ConvertFrom-Json
            $inputStr = if ($json.inputs.Count -gt 0) { " grouped by $($json.inputs -join ', ')" } else { "" }
            Write-Output "    [$($json.label)] $($json.expression)$inputStr"
            $shown = 0
            foreach ($d in $json.data) {
                if ($d.rowCount) {
                    Write-Output "      -> table ($($d.rowCount) rows)"
                } else {
                    $inp = if ($d.input.Count -gt 0) { "($($d.input -join ', ')) -> " } else { "" }
                    $out = if ($d.output -eq $null -or "$($d.output)" -eq "") { "(BLANK)" } else { $d.output }
                    Write-Output "      ${inp}${out}"
                    $shown++; if ($shown -ge 8) { Write-Output "      ... (truncated)"; break }
                }
            }
        }
    }
}

#endregion


#region Run Queries
# Modify this section with your debug queries.
# Wrap expressions with EVALUATEANDLOG("expr", "Label") to trace intermediate values.

Write-Output ""
Write-Output "=== Debug Session ==="
Write-Output ""

# Example: enumerate model measures for reference
Write-Output "Model measures:"
foreach ($t in $db.Model.Tables) {
    foreach ($m in $t.Measures) {
        $expr = $m.Expression -replace "`r`n", " " -replace "`n", " " -replace "\s+", " "
        if ($expr.Length -gt 60) { $expr = $expr.Substring(0, 57) + "..." }
        Write-Output "  [$($t.Name)].[$($m.Name)] = $expr"
    }
}

Write-Output ""
Write-Output "Add your debug queries below, then rerun this script."
Write-Output "Example:"
Write-Output '  Invoke-DebugQuery -Label "Test" -Query "EVALUATE ROW(""@R"", EVALUATEANDLOG([MyMeasure], ""Debug""))"'

#endregion


#region Cleanup

$evalTrace.Stop()
$perfTrace.Stop()
Unregister-Event -SourceIdentifier $evalJob.Name -ErrorAction SilentlyContinue
Unregister-Event -SourceIdentifier $perfJob.Name -ErrorAction SilentlyContinue
$evalTrace.Drop()
$perfTrace.Drop()
$server.Disconnect()

Write-Output ""
Write-Output "Done. Traces cleaned up."

#endregion
