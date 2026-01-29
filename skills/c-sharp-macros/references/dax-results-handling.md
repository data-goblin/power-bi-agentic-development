# Handling DAX Query Results in C#

Patterns for processing DAX query results returned as `System.Data.DataTable`.

**Source**: Extracted from production macro development at https://github.com/vdvoorder/tabular-editor-macros

## The Pattern

```csharp
string dax = /* your query */;
var result = EvaluateDax(dax) as System.Data.DataTable;

// Always check for null
if (result == null || result.Rows.Count == 0)
{
    Info("No results returned");
    return;
}

// Process rows
foreach (System.Data.DataRow row in result.Rows)
{
    // Access columns here
}
```

## Column Name Format

DAX returns column names with brackets:
```csharp
// DAX query: ROW("MyColumn", 1)
// Column name in DataTable: "[MyColumn]"

var value = row["[MyColumn]"];  // ✅ Include brackets
```

**Stripping brackets for display**:
```csharp
string StripBrackets(string name)
{
    return name.StartsWith("[") && name.EndsWith("]")
        ? name.Substring(1, name.Length - 2)
        : name;
}

string displayName = StripBrackets(row.Table.Columns[0].ColumnName);
```

## DBNull Handling (Critical)

**DAX BLANK maps to `DBNull.Value` in C#.** Always check before type conversion:

```csharp
// ❌ Crashes if value is BLANK
long count = Convert.ToInt64(row["[Count]"]);

// ✅ Safe
long count = row["[Count]"] == DBNull.Value ? 0 : Convert.ToInt64(row["[Count]"]);
```

**Pattern for different types**:
```csharp
// Integer
long intValue = row["[Column]"] == DBNull.Value ? 0 : Convert.ToInt64(row["[Column]"]);

// Double
double doubleValue = row["[Column]"] == DBNull.Value ? 0.0 : Convert.ToDouble(row["[Column]"]);

// Special: NaN for missing numeric stats
double mean = row["[Mean]"] == DBNull.Value ? double.NaN : Convert.ToDouble(row["[Mean]"]);

// String
string strValue = row["[Column]"] == DBNull.Value ? "" : row["[Column]"].ToString();

// Boolean (rarely used, but possible)
bool boolValue = row["[Column]"] == DBNull.Value ? false : Convert.ToBoolean(row["[Column]"]);
```

## Type-Safe Access Pattern

```csharp
T GetValueOrDefault<T>(DataRow row, string columnName, T defaultValue)
{
    if (row[columnName] == DBNull.Value)
        return defaultValue;

    return (T)Convert.ChangeType(row[columnName], typeof(T));
}

// Usage
long count = GetValueOrDefault(row, "[Count]", 0L);
double avg = GetValueOrDefault(row, "[Average]", double.NaN);
```

## Building Output DataTables

When transforming DAX results for display:

```csharp
var outputTable = new System.Data.DataTable();

// Add columns with proper types
outputTable.Columns.Add("Name", typeof(string));
outputTable.Columns.Add("Count", typeof(long));
outputTable.Columns.Add("Average", typeof(double));

// Populate rows
foreach (System.Data.DataRow sourceRow in result.Rows)
{
    var newRow = outputTable.NewRow();

    newRow["Name"] = StripBrackets(sourceRow["[Column]"].ToString());
    newRow["Count"] = sourceRow["[Count]"] == DBNull.Value ? 0 : Convert.ToInt64(sourceRow["[Count]"]);
    newRow["Average"] = sourceRow["[Average]"] == DBNull.Value ? DBNull.Value : sourceRow["[Average]"];

    outputTable.Rows.Add(newRow);
}

// Display
outputTable.Output();
```

## Conditional Column Addition

Add columns to output only when relevant:

```csharp
var outputTable = new System.Data.DataTable();
outputTable.Columns.Add("Name", typeof(string));
outputTable.Columns.Add("Count", typeof(long));

// Pre-scan: Check if any rows have non-zero errors
bool anyErrors = false;
foreach (System.Data.DataRow row in result.Rows)
{
    long errors = row["[Errors]"] == DBNull.Value ? 0 : Convert.ToInt64(row["[Errors]"]);
    if (errors > 0) { anyErrors = true; break; }
}

// Only add error column if needed
if (anyErrors)
{
    outputTable.Columns.Add("Errors", typeof(long));
}

// Populate rows (conditional logic for error column)
foreach (System.Data.DataRow row in result.Rows)
{
    var newRow = outputTable.NewRow();
    newRow["Name"] = row["[Name]"].ToString();
    newRow["Count"] = row["[Count]"] == DBNull.Value ? 0 : Convert.ToInt64(row["[Count]"]);

    if (anyErrors)
    {
        newRow["Errors"] = row["[Errors]"] == DBNull.Value ? 0 : Convert.ToInt64(row["[Errors]"]);
    }

    outputTable.Rows.Add(newRow);
}
```

**Why**: Reduces visual clutter when columns are always zero/empty.

## Column Header Formatting

Add metadata to column headers:

```csharp
// With timing
var stopwatch = System.Diagnostics.Stopwatch.StartNew();
// ... execute query ...
stopwatch.Stop();

string columnName = $"Column ({stopwatch.ElapsedMilliseconds / 1000.0:F2}s)";
outputTable.Columns.Add(columnName, typeof(string));
```

## Iterating Over Columns

When processing dynamic columns:

```csharp
// Get all column names
var columnNames = result.Columns.Cast<DataColumn>()
    .Select(c => c.ColumnName)
    .ToList();

// Filter to specific patterns
var measureColumns = columnNames.Where(c => c.StartsWith("[@")).ToList();

// Process each
foreach (var colName in measureColumns)
{
    foreach (System.Data.DataRow row in result.Rows)
    {
        var value = row[colName] == DBNull.Value ? 0.0 : Convert.ToDouble(row[colName]);
        // Process value
    }
}
```

## Error Handling

```csharp
try
{
    var result = EvaluateDax(dax) as System.Data.DataTable;

    if (result == null || result.Rows.Count == 0)
    {
        Info("Query returned no results");
        return;
    }

    // Process results
}
catch (Exception ex)
{
    Error($"DAX query failed: {ex.Message}");
    // Optionally show the query for debugging
    Output($"Failed query:\n{dax}");
}
```

## Common Pitfalls

### ❌ Don't: Forget brackets in column names
```csharp
var value = row["Count"];  // ❌ Missing brackets, throws exception
var value = row["[Count]"];  // ✅ Correct
```

### ❌ Don't: Assume columns exist
```csharp
// ❌ Crashes if column doesn't exist
var value = row["[MaybeColumn]"];

// ✅ Check first
if (result.Columns.Contains("[MaybeColumn]"))
{
    var value = row["[MaybeColumn]"];
}
```

### ❌ Don't: Convert DBNull directly
```csharp
// ❌ Crashes on BLANK values
long count = Convert.ToInt64(row["[Count]"]);

// ✅ Check for DBNull first
long count = row["[Count]"] == DBNull.Value ? 0 : Convert.ToInt64(row["[Count]"]);
```

## Best Practices

1. **Always check for `DBNull.Value`** before type conversion
2. **Always check result is not null** before processing
3. **Strip brackets** from column names when displaying to users
4. **Use proper types** in output DataTables (not all strings)
5. **Pre-scan when adding conditional columns** to reduce clutter
6. **Wrap in try-catch** and show meaningful error messages

## Reference

For production examples, see: https://github.com/vdvoorder/tabular-editor-macros
