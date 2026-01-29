# Dynamic DAX Query Construction

Patterns for building DAX queries from TOM (Tabular Object Model) metadata.

**Source**: Extracted from production macro development at https://github.com/vdvoorder/tabular-editor-macros

## The Goal

Build DAX queries that adapt to user selection - work with any columns, tables, or measures the user selects.

## Pattern 1: Selection-Aware Query Building

```csharp
int columnCount = Selected.Columns.Count();
int tableCount = Selected.Tables.Count();
int measureCount = Selected.Measures.Count();

if (columnCount > 0)
{
    // Build column-based query
}
else if (tableCount > 0)
{
    // Build table-based query
}
else if (measureCount > 0)
{
    // Build measure-based query
}
else
{
    Info("Please select tables, columns, or measures");
}
```

## Pattern 2: Same-Table Validation

Many operations require columns from the same table:

```csharp
var columns = Selected.Columns.ToList();

if (columns.Count == 0)
{
    Info("Please select one or more columns");
    return;
}

// Check all columns from same table
var firstTable = columns.First().Table;
bool sameTable = columns.All(c => c.Table == firstTable);

if (!sameTable)
{
    Info("Please select columns from the same table only");
    return;
}

// Safe to proceed with firstTable.DaxObjectFullName
```

## Pattern 3: Building UNION Queries

When processing multiple objects, build separate ROW() expressions and UNION them:

```csharp
var rows = new List<string>();

foreach (var col in Selected.Columns)
{
    string colName = col.Name;
    string colDaxName = col.DaxObjectFullName;
    string tableDaxName = col.Table.DaxObjectFullName;

    string rowExpr =
        "ROW(\n" +
        $@"""Column"", ""{colName}""," + "\n" +
        $@"""Distinct"", DISTINCTCOUNT({colDaxName})," + "\n" +
        $@"""Total"", COUNTROWS({tableDaxName}))";

    rows.Add(rowExpr);
}

// Single row: return as-is
// Multiple rows: UNION them
string dax = rows.Count == 1
    ? rows[0]
    : "UNION(\n" + String.Join(",\n", rows) + ")";

var result = EvaluateDax(dax);
```

**Why UNION?** Returns all results in one execution, in consistent table format.

## Pattern 4: Type-Conditional Query Generation

Different column types need different DAX:

```csharp
bool IsNumericColumn(Column col)
{
    var dt = col.DataType;
    return dt == DataType.Int64 || dt == DataType.Decimal || dt == DataType.Double;
}

bool IsBooleanColumn(Column col)
{
    return col.DataType == DataType.Boolean;
}

// Build query based on type
foreach (var col in Selected.Columns)
{
    string minExpr, maxExpr;

    if (IsBooleanColumn(col))
    {
        // Boolean requires FORMAT wrapper (MINX/MAXX don't support Boolean directly)
        minExpr = $@"MINX({col.Table.DaxObjectFullName}, FORMAT({col.DaxObjectFullName}, ""True/False""))";
        maxExpr = $@"MAXX({col.Table.DaxObjectFullName}, FORMAT({col.DaxObjectFullName}, ""True/False""))";
    }
    else
    {
        // Numeric and text work directly
        minExpr = $"MINX({col.Table.DaxObjectFullName}, {col.DaxObjectFullName})";
        maxExpr = $"MAXX({col.Table.DaxObjectFullName}, {col.DaxObjectFullName})";
    }

    string dax = $@"ROW(""Min"", {minExpr}, ""Max"", {maxExpr})";
    var result = EvaluateDax(dax);
    // Process result
}
```

**Critical Edge Case**: Boolean columns crash MINX/MAXX without FORMAT wrapper.

## Pattern 5: Comma-Separated Lists

For SUMMARIZECOLUMNS, GROUPBY, etc.:

```csharp
var columnList = Selected.Columns
    .Select(c => c.DaxObjectFullName)
    .ToList();

string columns = String.Join(", ", columnList);

string dax = $@"
EVALUATE
SUMMARIZECOLUMNS(
    {columns},
    ""Count"", COUNTROWS({Selected.Columns.First().Table.DaxObjectFullName})
)";
```

## Pattern 6: Measures with Special Prefix

Measures in SUMMARIZECOLUMNS get @ prefix:

```csharp
var measureList = new List<string>();

foreach (var measure in Selected.Measures)
{
    measureList.Add($@"""@{measure.Name}""");  // Quoted name with @
    measureList.Add(measure.DaxObjectFullName);  // Measure reference
}

string measures = String.Join(", ", measureList);

// Combines with columns
string dax = $@"
EVALUATE
SUMMARIZECOLUMNS(
    {columns},
    {measures}
)";
```

**Result**: Column [@MeasureName] in DataTable.

## Pattern 7: Column Name Extraction

Sometimes you need the column name without table prefix:

```csharp
string colDaxName = col.DaxObjectFullName;  // 'Table'[Column]
string colNameOnly = colDaxName.Split('[')[1].TrimEnd(']');  // Column

// Useful for:
// FILTER(table, ISBLANK([ColumnName]))  -- needs name only, not 'Table'[Column]
```

## Pattern 8: Phased Query Execution

When different columns need different statistics:

```csharp
var allColumns = Selected.Columns.ToList();
var numericColumns = allColumns.Where(c => IsNumericColumn(c)).ToList();

// Phase 1: Universal stats (all columns)
string universalDax = /* build query for all columns */;
var universalResult = EvaluateDax(universalDax);

// Phase 2: Numeric-only stats
if (numericColumns.Any())
{
    string numericDax = /* build query for numeric columns only */;
    var numericResult = EvaluateDax(numericDax);
}

// Combine results for output
```

**Why**: Avoids running expensive numeric calculations on text columns.

## Pattern 9: Error Resilience Per Object

Process each object separately with error handling:

```csharp
var results = new Dictionary<string, (bool success, string error, object value)>();

foreach (var col in Selected.Columns)
{
    try
    {
        string dax = BuildQueryForColumn(col);
        var result = EvaluateDax(dax);
        results[col.Name] = (true, null, result);
    }
    catch (Exception ex)
    {
        results[col.Name] = (false, ex.Message, null);
    }
}

// Display results, showing errors for problematic columns
foreach (var kvp in results)
{
    if (kvp.Value.success)
    {
        // Display value
    }
    else
    {
        Output($"{kvp.Key}: ERROR - {kvp.Value.error}");
    }
}
```

**Why**: One problematic column doesn't fail entire operation.

## Pattern 10: Building Calculated Values

For histograms, bins, etc.:

```csharp
// Get min/max first
string minMaxDax = $@"
ROW(
    ""Min"", MINX({table}, {column}),
    ""Max"", MAXX({table}, {column})
)";

var minMaxResult = EvaluateDax(minMaxDax) as System.Data.DataTable;
double min = Convert.ToDouble(minMaxResult.Rows[0]["[Min]"]);
double max = Convert.ToDouble(minMaxResult.Rows[0]["[Max]"]);

// Calculate bin size
double binSize = (max - min) / 12;

// Build histogram query using calculated value
string histogramDax = $@"
VAR _binSize = {binSize.ToString(System.Globalization.CultureInfo.InvariantCulture)}
VAR _bins = GENERATESERIES({min}, {max - binSize}, _binSize)
RETURN
ADDCOLUMNS(
    _bins,
    ""Count"",
    VAR _start = [Value]
    VAR _end = [Value] + _binSize
    RETURN COUNTROWS(FILTER({table}, {column} >= _start && {column} < _end))
)";
```

**Key**: Use C# to calculate intermediate values, embed in DAX.

## Common Pitfalls

### ❌ Don't: Forget to check for null/empty selections
```csharp
var col = Selected.Column;  // ❌ Null if multiple or zero selected
var cols = Selected.Columns;  // ✅ Always safe (empty list if none)
```

### ❌ Don't: Mix columns from different tables
```csharp
// Most DAX operations require same table
GROUPBY('Table1', 'Table2'[Column])  // ❌ Error
```

### ❌ Don't: Forget Boolean column edge case
```csharp
MINX(table, [BooleanColumn])  // ❌ Crashes
MINX(table, FORMAT([BooleanColumn], "True/False"))  // ✅ Works
```

### ❌ Don't: Hardcode table/column names
```csharp
string dax = "COUNTROWS('Sales')";  // ❌ Brittle

string dax = $"COUNTROWS({Selected.Table.DaxObjectFullName})";  // ✅ Dynamic
```

## Best Practices

1. **Always validate selection** (count, same table check)
2. **Use `DaxObjectFullName`** for references - handles special characters
3. **Build separate queries per object** when types differ
4. **Handle Boolean columns specially** (FORMAT wrapper)
5. **Use UNION pattern** for consistent result structure
6. **Test with edge cases**: empty strings, special chars in names, Boolean columns

## Reference

For complete working examples, see: https://github.com/vdvoorder/tabular-editor-macros
