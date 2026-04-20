# DAX Performance Profiling via Trace API

Programmatic equivalent of DAX Studio's Server Timings. Subscribe to trace events to measure Formula Engine (FE) and Storage Engine (SE) time per query, without external tools.


## Trace Events for Performance

| Event | Enum ID | What it captures |
|-------|---------|------------------|
| `QueryEnd` | 10 | Total query duration + CPU time |
| `VertiPaqSEQueryEnd` | 83 | Per-scan SE duration |
| `VertiPaqSEQueryCacheMatch` | 85 | SE cache hit (no scan needed) |
| `VertiPaqSEQueryBegin` | 82 | SE scan start |
| `DAXQueryPlan` | 112 | Logical + physical query plan |

**Key formula:** FE time = Total duration - sum(SE durations)


## Setting Up a Performance Trace

```powershell
$trace = $server.Traces.Add("Perf_" + [guid]::NewGuid().ToString("N").Substring(0,8))

# QueryEnd and VertiPaqSEQueryEnd support Duration + CpuTime columns
foreach ($ec in @(
    [Microsoft.AnalysisServices.TraceEventClass]::QueryEnd,
    [Microsoft.AnalysisServices.TraceEventClass]::VertiPaqSEQueryEnd
)) {
    $te = $trace.Events.Add($ec)
    $te.Columns.Add([Microsoft.AnalysisServices.TraceColumn]::TextData)
    $te.Columns.Add([Microsoft.AnalysisServices.TraceColumn]::EventClass)
    $te.Columns.Add([Microsoft.AnalysisServices.TraceColumn]::Duration)
    $te.Columns.Add([Microsoft.AnalysisServices.TraceColumn]::CpuTime)
}

# CacheMatch does NOT support Duration/CpuTime columns (causes error)
$te2 = $trace.Events.Add([Microsoft.AnalysisServices.TraceEventClass]::VertiPaqSEQueryCacheMatch)
$te2.Columns.Add([Microsoft.AnalysisServices.TraceColumn]::TextData)
$te2.Columns.Add([Microsoft.AnalysisServices.TraceColumn]::EventClass)

$trace.Update()

# Capture events with synchronized collection
$perfEvents = [System.Collections.ArrayList]::Synchronized((New-Object System.Collections.ArrayList))
$job = Register-ObjectEvent -InputObject $trace -EventName "OnEvent" -MessageData $perfEvents -Action {
    $Event.MessageData.Add($Event.SourceEventArgs) | Out-Null
}
$trace.Start()
```


## Running a Profiled Query

```powershell
# Clear cache for cold timings
$tmsl = '{ "clearCache": { "object": { "database": "' + $db.Name + '" } } }'
$server.Execute($tmsl) | Out-Null

# Execute via ADOMD.NET
$startIdx = $perfEvents.Count
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "EVALUATE SUMMARIZECOLUMNS('Date'[Year], ""@Rev"", [Total Revenue])"
$reader = $cmd.ExecuteReader()
$rowCount = 0
while ($reader.Read()) { $rowCount++ }
$reader.Close()
$conn.Close()

Start-Sleep -Milliseconds 500  # allow events to arrive
```


## Analyzing Results

```powershell
# Filter events from this query only (by startIdx)
$queryEnd = @($perfEvents[$startIdx..($perfEvents.Count-1)] | Where-Object { $_.EventClass -eq "QueryEnd" })
$seQueries = @($perfEvents[$startIdx..($perfEvents.Count-1)] | Where-Object { $_.EventClass -eq "VertiPaqSEQueryEnd" })
$cacheHits = @($perfEvents[$startIdx..($perfEvents.Count-1)] | Where-Object { $_.EventClass -eq "VertiPaqSEQueryCacheMatch" })

$totalMs = if ($queryEnd.Count -gt 0) { $queryEnd[0].Duration } else { 0 }
$cpuMs   = if ($queryEnd.Count -gt 0) { $queryEnd[0].CpuTime } else { 0 }
$seMs    = 0; foreach ($se in $seQueries) { $seMs += $se.Duration }
$feMs    = [Math]::Max(0, $totalMs - $seMs)

Write-Output "Total: ${totalMs}ms | FE: ${feMs}ms | SE: ${seMs}ms | CPU: ${cpuMs}ms"
Write-Output "SE queries: $($seQueries.Count) | Cache hits: $($cacheHits.Count) | Rows: $rowCount"
```


## Interpreting Timing Breakdown

| Metric | Meaning | If too high |
|--------|---------|-------------|
| **Total** | Wall-clock query duration | Investigate FE vs SE split |
| **FE (Formula Engine)** | Time in DAX formula evaluation | Complex measure logic; simplify expressions, reduce iterator nesting |
| **SE (Storage Engine)** | Time scanning VertiPaq data | High cardinality columns, large tables; optimize model, add aggregations |
| **CPU** | Processor time consumed | Multi-threaded SE can exceed wall clock; normal |
| **SE queries** | Number of SE scans | Many scans = complex query plan; simplify grouping or reduce measures |
| **Cache hits** | SE scans served from cache | Higher is better on warm cache; indicates query reuse |


## Cold vs Warm Cache Comparison

```powershell
# Cold: clear cache, run query, capture timings
$server.Execute($tmsl) | Out-Null
# ... run + capture (as above) ...
$coldTotal = $totalMs

# Warm: run same query again without clearing
# ... run + capture (same code, no cache clear) ...
$warmTotal = $totalMs

$speedup = if ($warmTotal -gt 0) { [math]::Round($coldTotal / $warmTotal, 1) } else { "N/A" }
Write-Output "Cold: ${coldTotal}ms | Warm: ${warmTotal}ms | Speedup: ${speedup}x"
```


## Statistical Sampling for Reliable Measurements

Single measurements are noisy; the VertiPaq engine, GC pauses, background PBI Desktop activity, and OS scheduling all introduce variance. Always take multiple samples and use the median (not mean; outliers skew it) to compare before/after a change.

**Minimum samples:** 3 for a quick sanity check; 6-12 for a reliable comparison.

```powershell
function Measure-QueryMedian {
    param(
        [string]$Query,
        [int]$Samples = 6,
        [bool]$ColdCache = $false
    )

    $durations = @()
    for ($run = 1; $run -le $Samples; $run++) {
        if ($ColdCache) {
            $server.Execute('{ "clearCache": { "object": { "database": "' + $db.Name + '" } } }') | Out-Null
        }

        $startIdx = $perfEvents.Count

        $conn = New-Object Microsoft.AnalysisServices.AdomdClient.AdomdConnection
        $conn.ConnectionString = "Data Source=localhost:$Port"; $conn.Open()
        $cmd = $conn.CreateCommand(); $cmd.CommandText = $Query
        $reader = $cmd.ExecuteReader()
        while ($reader.Read()) {}
        $reader.Close(); $conn.Close()

        Start-Sleep -Milliseconds 500
        $qe = @($perfEvents[$startIdx..($perfEvents.Count-1)] | Where-Object { $_.EventClass -eq "QueryEnd" })
        if ($qe.Count -gt 0) { $durations += $qe[0].Duration }
    }

    $sorted = $durations | Sort-Object
    $median = $sorted[[math]::Floor($sorted.Count / 2)]
    $min = $sorted[0]
    $max = $sorted[-1]

    return @{ Median = $median; Min = $min; Max = $max; Samples = $sorted }
}
```

### Before/After Comparison

To measure the impact of a DAX change (e.g., rewriting a measure):

```powershell
# 1. Measure the original
$before = Measure-QueryMedian -Query $daxQuery -Samples 8 -ColdCache $true

# 2. Apply the change (e.g., modify measure via TOM)
# ...

# 3. Measure the modified version
$after = Measure-QueryMedian -Query $daxQuery -Samples 8 -ColdCache $true

# 4. Compare
$delta = $before.Median - $after.Median
$pctChange = if ($before.Median -gt 0) { [math]::Round($delta / $before.Median * 100, 1) } else { 0 }
Write-Output "Before: $($before.Median)ms (range $($before.Min)-$($before.Max)ms)"
Write-Output "After:  $($after.Median)ms (range $($after.Min)-$($after.Max)ms)"
Write-Output "Change: ${delta}ms (${pctChange}%)"
```

**Interpreting results:**
- If the ranges overlap significantly, the change may not be meaningful; increase sample count
- A change under 10% on a sub-100ms query is likely noise
- For cold cache measurements, the first run is often slower (JIT compilation); consider discarding the first sample as a warm-up
- SE time is generally more stable than FE time across runs; large FE variance suggests GC or background contention


## Profiling Visual Queries from PBIR

To profile actual visual queries, construct SUMMARIZECOLUMNS from the visual.json definitions:

### Visual-to-DAX Translation

The `visual.json` `query.queryState` structure maps to DAX:

| PBIR Field | DAX Equivalent |
|-----------|----------------|
| `projections` with `Column` + `SourceRef.Entity` + `Property` | `'Entity'[Property]` in SUMMARIZECOLUMNS group-by |
| `projections` with `Measure` | `[MeasureName]` as measure reference |
| `projections` with `Aggregation` + `Function: 0` | `SUM('Entity'[Property])` |
| `Aggregation.Function` values | 0=Sum, 1=Min, 2=Max, 3=Count, 4=Average |
| `filterConfig.filters` | TREATAS or WHERE clauses |
| `sortDefinition.sort` | ORDER BY clause |

### Example

Given a scatter chart with:
- Category: `Maps[Name]`
- Series: `Maps[Visited]`
- X: `SUM(Maps[X_Coord])`
- Y: `SUM(Maps[Y_Coord])`
- Size: `[Cost]` measure

The equivalent query:

```dax
EVALUATE
SUMMARIZECOLUMNS(
    'Maps'[Name],
    'Maps'[Visited],
    "@X", SUM('Maps'[X_Coord]),
    "@Y", SUM('Maps'[Y_Coord]),
    "@Cost", [Cost]
)
```


## All Available Trace Events

```
NotAvailable=0, AuditLogin=1, AuditLogout=2, AuditServerStartsAndStops=4,
ProgressReportBegin=5, ProgressReportEnd=6, ProgressReportCurrent=7,
ProgressReportError=8, QueryBegin=9, QueryEnd=10, QuerySubcube=11,
QuerySubcubeVerbose=12, CommandBegin=15, CommandEnd=16, Error=17,
DiscoverBegin=36, DiscoverEnd=38, Notification=39,
LockAcquired=52, LockReleased=53, LockWaiting=54,
QueryCubeBegin=70, QueryCubeEnd=71,
VertiPaqSEQueryBegin=82, VertiPaqSEQueryEnd=83, ResourceUsage=84,
VertiPaqSEQueryCacheMatch=85, VertiPaqSEQueryCacheMiss=86,
DirectQueryBegin=98, DirectQueryEnd=99,
CalculationEvaluation=110, CalculationEvaluationDetailedInformation=111,
DAXQueryPlan=112, DAXEvaluationLog=135, ExecutionMetrics=136
```

### Column Support Per Event

Not all columns work with all events. Column-event compatibility:

| Column | ID | QueryEnd | VertiPaqSEQueryEnd | CacheMatch | DAXEvaluationLog |
|--------|----|---------:|-------------------:|-----------:|-----------------:|
| TextData | 42 | Yes | Yes | Yes | Yes (JSON payload) |
| EventClass | 0 | Yes | Yes | Yes | Yes |
| Duration | 5 | Yes | Yes | **No** | No |
| CpuTime | 6 | Yes | Yes | **No** | No |
| DatabaseName | 28 | Yes | Yes | Yes | Yes |

Adding an unsupported column causes `$trace.Update()` to throw an error. Always match columns to the specific event type.
