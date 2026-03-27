# VertiPaq Column Statistics

Query the AS storage engine DMVs to get column cardinality, dictionary size, and data size — the same data VertiPaq Analyzer uses. Useful for identifying bloated columns and memory hotspots.

All examples assume an open ADOMD.NET connection `$conn` on the correct port (see SKILL.md sections 2–5).

## Column size and dictionary

```powershell
$c = $conn.CreateCommand()
$c.CommandText = @"
SELECT
    DIMENSION_NAME         AS TableName,
    ATTRIBUTE_NAME         AS ColumnName,
    DICTIONARY_SIZE        AS DictionaryBytes,
    USED_SIZE              AS DataBytes,
    SEGMENT_NUMBER         AS Segments,
    RECORDS_COUNT          AS Rows
FROM `$SYSTEM.DISCOVER_STORAGE_TABLE_COLUMN_SEGMENTS
WHERE LEFT(DIMENSION_NAME, 1) <> '$'
ORDER BY USED_SIZE DESC
"@
$reader = $c.ExecuteReader()
Write-Output ("Table".PadRight(30) + "Column".PadRight(40) + "Dict(KB)".PadRight(12) + "Data(KB)".PadRight(12) + "Rows")
while ($reader.Read()) {
    $table = $reader.GetValue(0).ToString().PadRight(30)
    $col   = $reader.GetValue(1).ToString().PadRight(40)
    $dict  = [Math]::Round($reader.GetValue(2) / 1024, 1).ToString().PadRight(12)
    $data  = [Math]::Round($reader.GetValue(3) / 1024, 1).ToString().PadRight(12)
    $rows  = $reader.GetValue(5)
    Write-Output "$table$col$dict$data$rows"
}
$reader.Close()
```

## Column cardinality (distinct values)

High cardinality = large dictionary = more memory. Key columns and date/time columns are common culprits.

```powershell
$c.CommandText = @"
SELECT
    DIMENSION_NAME  AS TableName,
    ATTRIBUTE_NAME  AS ColumnName,
    CARDINALITY     AS DistinctValues
FROM `$SYSTEM.DISCOVER_STORAGE_TABLE_COLUMNS
WHERE LEFT(DIMENSION_NAME, 1) <> '$'
ORDER BY CARDINALITY DESC
"@
```

## Total model memory by table

```powershell
$c.CommandText = @"
SELECT
    DIMENSION_NAME                       AS TableName,
    SUM(USED_SIZE + DICTIONARY_SIZE)     AS TotalBytes,
    SUM(RECORDS_COUNT)                   AS TotalRows
FROM `$SYSTEM.DISCOVER_STORAGE_TABLE_COLUMN_SEGMENTS
WHERE LEFT(DIMENSION_NAME, 1) <> '$'
GROUP BY DIMENSION_NAME
ORDER BY TotalBytes DESC
"@
$reader = $c.ExecuteReader()
Write-Output ("Table".PadRight(40) + "TotalMB".PadRight(12) + "Rows")
while ($reader.Read()) {
    $table = $reader.GetValue(0).ToString().PadRight(40)
    $mb    = [Math]::Round($reader.GetValue(1) / 1MB, 2).ToString().PadRight(12)
    $rows  = $reader.GetValue(2)
    Write-Output "$table$mb$rows"
}
$reader.Close()
```

## Server timings for a specific query

After executing a DAX query, read elapsed and CPU time from `DISCOVER_SESSIONS`:

```powershell
$c.CommandText = @"
SELECT
    SESSION_LAST_COMMAND_ELAPSED_TIME_MS  AS ElapsedMs,
    SESSION_LAST_COMMAND_CPU_TIME_MS      AS CpuMs,
    SESSION_LAST_COMMAND_START_TIME       AS StartTime
FROM `$SYSTEM.DISCOVER_SESSIONS
WHERE SESSION_LAST_COMMAND_ELAPSED_TIME_MS > 0
ORDER BY SESSION_LAST_COMMAND_START_TIME DESC
"@
$reader = $c.ExecuteReader()
while ($reader.Read()) {
    Write-Output "Elapsed: $($reader.GetValue(0))ms | CPU: $($reader.GetValue(1))ms | Start: $($reader.GetValue(2))"
}
$reader.Close()
```

> For deeper query plan analysis (storage engine vs formula engine breakdown), use DAX Studio connected to the same `localhost:$port` — it has a dedicated Server Timings pane. The DMV approach gives high-level timing; DAX Studio gives the full callstack.
