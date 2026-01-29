# Embedding DAX in C# Macros

Patterns for embedding DAX query strings in C# without syntax conflicts.

**Source**: Extracted from production macro development at https://github.com/vdvoorder/tabular-editor-macros

## The Challenge

DAX queries use quotes, brackets, and newlines. C# strings use quotes. This creates escaping nightmares:

```csharp
// ❌ Syntax hell
string dax = "EVALUATE ROW(\"Column\", \"Value\", \"Count\", COUNTROWS('Table'))";
```

## Pattern 1: Verbatim Strings with Escaped Quotes

Use `@""` for verbatim strings, escape inner quotes with `""`:

```csharp
// ✅ Readable
string dax = @"
EVALUATE
ROW(
    ""Column"", ""Value"",
    ""Count"", COUNTROWS('Table')
)";
```

**When to use**: Simple queries with minimal dynamic content.

## Pattern 2: String Interpolation with DaxObjectFullName

Combine verbatim strings with interpolation for dynamic column/table references:

```csharp
var col = Selected.Column;
string colDaxName = col.DaxObjectFullName;  // 'Table'[Column]
string tableDaxName = col.Table.DaxObjectFullName;  // 'Table'

string dax = $@"
EVALUATE
ROW(
    ""Column"", ""{col.Name}"",
    ""Distinct"", DISTINCTCOUNT({colDaxName}),
    ""Total"", COUNTROWS({tableDaxName})
)";
```

**Key insight**: `DaxObjectFullName` already has quotes/brackets. Don't add more:
```csharp
// ❌ Wrong
$"'{colDaxName}'"  // Results in: ''Table'[Column]'

// ✅ Right
$"{colDaxName}"    // Results in: 'Table'[Column]
```

## Pattern 3: Multi-Line String Building

For complex queries, build strings line-by-line:

```csharp
var rows = new List<string>();
foreach (var col in Selected.Columns)
{
    string rowExpr =
        "ROW(\n" +
        $@"""Column"", ""{col.Name}""," + "\n" +
        $@"""Count"", COUNTROWS({col.Table.DaxObjectFullName}))" ;

    rows.Add(rowExpr);
}

string dax = rows.Count == 1
    ? rows[0]
    : "UNION(\n" + String.Join(",\n", rows) + ")";
```

**When to use**: Dynamic number of columns/tables, need to UNION multiple ROW() expressions.

## Pattern 4: Newline Handling

DAX doesn't require newlines, but they improve readability in output:

```csharp
// Option A: Explicit \n in strings
string dax = "EVALUATE\nROW(\"A\", 1)";

// Option B: Real newlines in verbatim strings
string dax = @"
EVALUATE
ROW(""A"", 1)
";

// Option C: No newlines (compact)
string dax = @"EVALUATE ROW(""A"", 1)";
```

All three are valid DAX. Choose based on debuggability needs.

## Pattern 5: InvariantCulture for Numbers

When embedding calculated numbers in DAX strings:

```csharp
double binSize = (max - min) / 12;

// ❌ Wrong - uses current culture (might use comma as decimal)
string dax = $"VAR _binSize = {binSize}";  // Could become: VAR _binSize = 1,5

// ✅ Right - always uses period
string dax = $"VAR _binSize = {binSize.ToString(System.Globalization.CultureInfo.InvariantCulture)}";
```

**Why**: DAX always uses period for decimals. Culture-dependent formatting breaks queries in non-US locales.

## Common Pitfalls

### ❌ Don't: Nest quotes incorrectly
```csharp
string dax = $"ROW(\"{col.Name}\", {col.DaxObjectFullName})";
// Results in: ROW("Sales", 'Dim'[Sales])
// DAX expects: ROW("Sales", 'Dim'[Sales]) - this is actually fine
```

Actually, the above works. The real pitfall is:

```csharp
// ❌ Wrong - double-quoting already-quoted names
string dax = $"ROW(\"{col.Name}\", \"{col.DaxObjectFullName}\")";
// Results in: ROW("Sales", "'Dim'[Sales]")  - DAX string, not column reference!
```

### ❌ Don't: Forget comma separators in ROW()
```csharp
string dax = $@"ROW(""A"" ""B"")";  // Missing comma between "A" and "B"
```

### ❌ Don't: Use single quotes for strings in DAX
```csharp
// ❌ Wrong - DAX uses double quotes for strings
string dax = "ROW('Column', 'Value')";

// ✅ Right
string dax = @"ROW(""Column"", ""Value"")";
```

## Best Practices

1. **Always use verbatim strings** (`@""`) for DAX queries
2. **Use `DaxObjectFullName`** for table/column references - it handles quoting
3. **Use `InvariantCulture`** for number-to-string conversion
4. **Test with special characters** - table/column names with spaces, quotes, brackets
5. **Add comments** in C# code explaining what DAX you're building

## Testing Pattern

Before committing to complex string building:

```csharp
// Step 1: Build the DAX
string dax = /* your construction logic */;

// Step 2: Output it to see what you built
Output(dax);

// Step 3: Execute only after verifying
var result = EvaluateDax(dax);
```

This catches quoting/escaping errors before execution.

## Reference

For more examples, see production macros at: https://github.com/vdvoorder/tabular-editor-macros
