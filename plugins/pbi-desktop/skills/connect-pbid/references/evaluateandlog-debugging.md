# Debugging DAX with EVALUATEANDLOG

`EVALUATEANDLOG(<Value>, [<Label>], [<MaxRows>])` is DAX's print-debugging function. It returns its first argument unchanged and emits the intermediate result as a JSON payload via a **DAX Evaluation Log** trace event. Works in PBI Desktop only; passthrough elsewhere.


## Capturing Trace Events Programmatically

The TOM Trace API captures EVALUATEANDLOG output without external tools (no DAX Debug Output, SQL Server Profiler, or DAX Studio needed).

### Setup

```powershell
# Create trace (after connecting via TOM; see Section 3 of main skill)
$trace = $server.Traces.Add("EvalLog_" + [guid]::NewGuid().ToString("N").Substring(0,8))
$te = $trace.Events.Add([Microsoft.AnalysisServices.TraceEventClass]::DAXEvaluationLog)
$te.Columns.Add([Microsoft.AnalysisServices.TraceColumn]::TextData)
$te.Columns.Add([Microsoft.AnalysisServices.TraceColumn]::EventClass)
$trace.Update()
```

### Event Capture with Synchronized Collection

`Register-ObjectEvent -Action` runs in a separate PowerShell runspace. `$global:` variables in the action block do not share scope with the calling script. Pass a synchronized collection via `-MessageData`:

```powershell
$evalEvents = [System.Collections.ArrayList]::Synchronized((New-Object System.Collections.ArrayList))
$job = Register-ObjectEvent -InputObject $trace -EventName "OnEvent" -MessageData $evalEvents -Action {
    $Event.MessageData.Add($Event.SourceEventArgs) | Out-Null
}
$trace.Start()
```

### Run Query + Read Events

```powershell
# Clear cache first (ensures fresh evaluation)
$tmsl = '{ "clearCache": { "object": { "database": "' + $db.Name + '" } } }'
$server.Execute($tmsl) | Out-Null

# Execute DAX with EVALUATEANDLOG via ADOMD.NET (Section 5)
$cmd.CommandText = "EVALUATE ROW(""@R"", EVALUATEANDLOG(COUNTROWS('Sales'), ""RowCount""))"
$reader = $cmd.ExecuteReader()
# ... read results ...
$reader.Close()

Start-Sleep -Seconds 2  # events arrive asynchronously

# Parse captured events
foreach ($evt in $evalEvents) {
    $json = $evt.TextData | ConvertFrom-Json
    # $json.expression, $json.label, $json.inputs, $json.data
}
```

### Cleanup

```powershell
$trace.Stop()
Unregister-Event -SourceIdentifier $job.Name -ErrorAction SilentlyContinue
$trace.Drop()
```


## JSON Payload Structure

Each trace event's `TextData` contains:

```json
{
    "expression": "COUNTROWS('Sales')",
    "label": "RowCount",
    "inputs": ["'Date'[Year]"],
    "data": [
        { "input": [2023], "output": 15000 },
        { "input": [2024], "output": 18500 }
    ]
}
```

| Field | Description |
|-------|-------------|
| `expression` | Text of the wrapped expression |
| `label` | The Label parameter (if provided) |
| `inputs` | Columns in the evaluation context that affect the result |
| `outputs` | Output column names (table expressions only) |
| `data` | Array of input/output pairs grouped by evaluation context |
| `data[].rowCount` | True row count for table expressions (not truncated by MaxRows) |


## Event Batching Behavior

Events do not arrive synchronously per query. The engine groups evaluations by granularity level and may delay events until subsequent queries trigger flushing. Practical implications:

- Use a **persistent trace** across multiple queries; index events by `$evalEvents.Count` before each query
- Allow **2+ seconds** after query execution before reading events
- Some EVALUATEANDLOG calls produce **no trace event** due to engine optimizations (confirmed by Microsoft docs)
- A dummy query after the real queries can flush remaining events


## Clearing the VertiPaq Cache

Cached results prevent EVALUATEANDLOG from firing. Clear cache before debugging queries:

```powershell
# Database-level (TMSL; simplest)
$tmsl = '{ "clearCache": { "object": { "database": "' + $db.Name + '" } } }'
$server.Execute($tmsl) | Out-Null

# Table-level (XMLA; surgical)
$xmla = '<ClearCache xmlns="http://schemas.microsoft.com/analysisservices/2003/engine"><Object><DatabaseID>' + $db.ID + '</DatabaseID><DimensionID>Sales</DimensionID></Object></ClearCache>'
$server.Execute($xmla)
```


## Debugging Patterns

### Pattern 1: Measure Chain Decomposition

Wrap each intermediate step with a labeled EVALUATEANDLOG to trace through a dependency chain:

```dax
EVALUATE
SUMMARIZECOLUMNS(
    'Maps'[Name],
    "@QuestsText", EVALUATEANDLOG( [Quests & Leads Text], "Step1_Text" ),
    "@TextLength", EVALUATEANDLOG( LEN( [Quests & Leads Text] ), "Step2_Len" ),
    "@Cost",       EVALUATEANDLOG( [Cost], "Step3_Cost" )
)
```

Each label produces a separate trace event showing input context -> output value for all rows.

### Pattern 2: Filter Context Inspection

Trace how CALCULATE modifies the filter context:

```dax
EVALUATE
SUMMARIZECOLUMNS(
    'Sales'[Region],
    "@Direct",      EVALUATEANDLOG( SUM('Sales'[Amount]), "DirectSum" ),
    "@AllRegions",  EVALUATEANDLOG( CALCULATE(SUM('Sales'[Amount]), ALL('Sales'[Region])), "AllRegions" ),
    "@KeepFilters", EVALUATEANDLOG( CALCULATE(SUM('Sales'[Amount]), KEEPFILTERS('Sales'[Region] = "West")), "KeepFilters" )
)
```

When `ALL('Sales'[Region])` is used, the trace shows a single ungrouped value (same for all rows). When KEEPFILTERS is used, the trace shows filtered results.

### Pattern 3: BLANK vs Zero Detection

Trace the actual value before comparison:

```dax
EVALUATE
SUMMARIZECOLUMNS(
    'Products'[Category],
    "@RawValue", EVALUATEANDLOG( [Revenue], "RawRevenue" ),
    "@IsBlank",  EVALUATEANDLOG( ISBLANK([Revenue]), "IsBlank" ),
    "@Comparison", EVALUATEANDLOG( [Revenue] = 0, "EqualsZero" )
)
```

The trace reveals whether each cell is truly BLANK or numeric zero; `BLANK() = 0` is TRUE in DAX, which catches many people off guard.

### Pattern 4: Variable Context Trap

Prove that a VAR is evaluated once and not re-evaluated by CALCULATE:

```dax
EVALUATE
ROW(
    "@VarValue", EVALUATEANDLOG(
        VAR _x = SUM('Sales'[Amount])
        RETURN CALCULATE(_x, 'Sales'[Region] = "West"),
        "VarNotReEvaluated"
    ),
    "@DirectCalc", EVALUATEANDLOG(
        CALCULATE(SUM('Sales'[Amount]), 'Sales'[Region] = "West"),
        "DirectCalc"
    )
)
```

The trace shows `VarNotReEvaluated` returns the unfiltered sum (variable captures context at definition), while `DirectCalc` returns the filtered sum.

### Pattern 5: Table Expression Inspection

See what rows feed into an aggregation:

```dax
EVALUATE
ROW(
    "@Reward", EVALUATEANDLOG( [Accumulated Reward], "TotalReward" ),
    "@Rows",   EVALUATEANDLOG(
        CALCULATETABLE(
            SELECTCOLUMNS('Sales', "@Item", 'Sales'[Product], "@Amt", 'Sales'[Amount]),
            'Sales'[Status] = "Complete"
        ),
        "FilteredRows",
        20
    )
)
```

The trace shows the actual filtered table (up to MaxRows) with column names and values. `rowCount` reflects the true count even when output is truncated.

### Pattern 6: Grand Total Diagnosis

Diagnose why a ratio measure shows wrong grand totals:

```dax
EVALUATE
SUMMARIZECOLUMNS(
    'Products'[Category],
    "@Numerator",   EVALUATEANDLOG( SUM('Sales'[Revenue]), "Numerator" ),
    "@Denominator", EVALUATEANDLOG( SUM('Sales'[Qty]), "Denominator" ),
    "@Ratio",       EVALUATEANDLOG( DIVIDE(SUM('Sales'[Revenue]), SUM('Sales'[Qty])), "Ratio" )
)
```

At row level, the trace shows per-category values. At the grand total level (no inputs), the trace shows global sums being divided; this reveals why the ratio total differs from summing row-level ratios.


## Common DAX Issues Diagnosable with EVALUATEANDLOG

Based on community forum analysis, the most frequent DAX bugs:

| Issue | Frequency | EVALUATEANDLOG Approach |
|-------|-----------|------------------------|
| Filter context wrong (CALCULATE/ALL) | Very high | Trace both sides of DIVIDE; check if values are identical across rows |
| Grand total incorrect | Very high | Trace numerator + denominator at each granularity; compare row vs total grain |
| BLANK propagation | High | Trace pre-comparison value; distinguish BLANK from 0 |
| Time intelligence returns BLANK | High | Trace the date filter table to see if dates are in context |
| SELECTEDVALUE returns BLANK | High | Trace in different grouping contexts; check when >1 value exists |
| Variable not re-evaluated | Medium | Trace VAR value alongside CALCULATE result; prove they're identical |
| SWITCH evaluation order | Medium | Trace each condition branch to see which evaluates TRUE first |

## Limitations

- **PBI Desktop only**; passthrough in Service, SSAS, Azure AS
- **May disable DAX optimizations**; remove after debugging
- **Engine may skip** EVALUATEANDLOG due to optimizations (no trace event emitted)
- **Event batching**; events may arrive delayed, grouped by granularity level
- **1M character limit**; payloads exceeding this are truncated (preserving valid JSON)
- **MaxRows default 10**; for table expressions, increase with the third parameter
- **Known bug**: `COUNTROWS(EVALUATEANDLOG(table))` may fail; wrap differently
