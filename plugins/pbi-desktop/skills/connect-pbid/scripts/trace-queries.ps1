
param(
    [int]$Port = 0,
    [int]$Seconds = 60,
    [string]$Out = ""
)

. "$PSScriptRoot\find-desktop.ps1"
Add-TomAssemblies

if ($Port -eq 0) {
    $first = @(Get-DesktopPorts) | Select-Object -First 1
    if (-not $first) { Write-Error "No msmdsrv.exe running."; exit 1 }
    $Port = $first.Port
}

$server = New-Object Microsoft.AnalysisServices.Tabular.Server
$server.Connect("Data Source=localhost:$Port")
if ($server.Databases.Count -eq 0) { Write-Error "localhost:$Port hosts no model (thin report)."; $server.Disconnect(); exit 1 }

$trace = $server.Traces.Add("Queries_" + [guid]::NewGuid().ToString("N").Substring(0, 8))
$qe = $trace.Events.Add([Microsoft.AnalysisServices.TraceEventClass]::QueryEnd)
foreach ($c in @("TextData", "EventClass", "Duration", "CpuTime")) {
    [void]$qe.Columns.Add([Microsoft.AnalysisServices.TraceColumn]::$c)
}
$trace.Update()

$events = [System.Collections.ArrayList]::Synchronized((New-Object System.Collections.ArrayList))
$job = Register-ObjectEvent -InputObject $trace -EventName "OnEvent" -MessageData $events -Action {
    $Event.MessageData.Add($Event.SourceEventArgs) | Out-Null
}

try {
    $trace.Start()
    Write-Output "Tracing localhost:$Port for $Seconds s. Use the report now."
    $deadline = (Get-Date).AddSeconds($Seconds)
    $seen = 0
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 250
        while ($seen -lt $events.Count) {
            $e = $events[$seen]; $seen++
            $text = "$($e.TextData)".Trim()
            if ($text -eq "" -or $text.StartsWith("<") -or $text -match '^(SELECT|MDSCHEMA_|TMSCHEMA_)') { continue }
            $block = "--- elapsed $($e.Duration) ms | cpu $($e.CpuTime) ms`n$text`n"
            Write-Output $block
            if ($Out) { Add-Content -Path $Out -Value $block }
        }
    }
} finally {
    $trace.Stop()
    $trace.Drop()
    Unregister-Event -SourceIdentifier $job.Name -ErrorAction SilentlyContinue
    $server.Disconnect()
}
