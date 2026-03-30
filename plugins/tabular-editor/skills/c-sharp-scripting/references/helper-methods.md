# Helper Methods Reference

Built-in helper methods available in Tabular Editor C# scripts.

## Output and Messaging

| Method | Purpose |
|--------|---------|
| `Info(message)` | Display info popup (CLI: writes to console) |
| `Warning(message)` | Display warning popup |
| `Error(message)` | Display error popup and stop script |
| `Output(object)` | Display detailed object inspector dialog |

### Output() Variations

```csharp
// Scalar value - shows simple message
Output("Hello World");
Output(123);

// Single TOM object - shows property grid (editable)
Output(Model.Tables["Sales"].Measures["Revenue"]);

// Collection of TOM objects - shows list with property grid
Output(Model.AllMeasures.Where(m => m.IsHidden));

// DataTable - shows sortable grid
var dt = new System.Data.DataTable();
dt.Columns.Add("Name");
dt.Columns.Add("Expression");
foreach(var m in Model.AllMeasures) {
    dt.Rows.Add(m.Name, m.Expression);
}
Output(dt);
```

## File Operations

```csharp
SaveFile("path/to/file.txt", content);
string content = ReadFile("path/to/file.txt");
```

## Property Export/Import

```csharp
// Export to TSV
var tsv = ExportProperties(Model.AllMeasures, "Name,Expression,FormatString");
SaveFile("measures.tsv", tsv);

// Import from TSV
var tsv = ReadFile("measures.tsv");
ImportProperties(tsv);
```

## Interactive Selection (IDE Only)

```csharp
// Let user select a measure
var measure = SelectMeasure();
var measure = SelectMeasure(preselect, "Choose a base measure");

// Let user select from any collection
var table = SelectTable(Model.Tables, null, "Select target table");
var column = SelectColumn(table.Columns, null, "Select date column");
var obj = SelectObject(Model.AllMeasures, null, "Pick one");

// Multi-select
var selected = SelectObjects(Model.AllMeasures, null, "Pick measures");
```

## DAX Formatting

```csharp
// Queue for formatting (executed after script)
measure.FormatDax();

// Format immediately
CallDaxFormatter();

// Format collection
Model.AllMeasures.FormatDax();

// Convert locale (US/UK <-> non-US/UK)
var converted = ConvertDax(daxExpression, useSemicolons: true);
```

## DAX Execution (When Connected to AS)

```csharp
// Evaluate scalar or table expression
var result = EvaluateDax("SUM(Sales[Amount])");
var table = EvaluateDax("TOPN(10, Sales)");

// Execute DAX query returning DataSet
var ds = ExecuteDax("EVALUATE Sales");

// Execute and stream results
using(var reader = ExecuteReader("EVALUATE Sales")) {
    while(reader.Read()) { /* process rows */ }
}

// Execute TMSL command
ExecuteCommand(tmslJson);

// Execute XMLA command
ExecuteCommand(xmla, isXmla: true);
```

## Macro/Custom Action Invocation

```csharp
// Call another macro by name
CustomAction("Time Intelligence\\Create YTD");
CustomAction(Selected.Measures, "Format Measures");
```
