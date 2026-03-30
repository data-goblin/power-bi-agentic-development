# LINQ Reference for Tabular Editor Scripts

LINQ (Language Integrated Query) is essential for filtering and transforming TOM object collections.

## Common LINQ Methods

| Method | Purpose | Example |
|--------|---------|---------|
| `Where(predicate)` | Filter collection | `.Where(m => m.Name.Contains("YTD"))` |
| `First([predicate])` | Get first item | `.First(t => t.Name == "Sales")` |
| `FirstOrDefault([predicate])` | Get first or null | `.FirstOrDefault(t => t.Name == "Sales")` |
| `Any([predicate])` | Check if any match | `.Any(m => m.IsHidden)` |
| `All(predicate)` | Check if all match | `.All(c => c.DataType == DataType.String)` |
| `Count([predicate])` | Count items | `.Count(m => !m.IsHidden)` |
| `Select(map)` | Transform items | `.Select(m => m.Name)` |
| `OrderBy(key)` | Sort ascending | `.OrderBy(m => m.Name)` |
| `OrderByDescending(key)` | Sort descending | `.OrderByDescending(m => m.Name)` |
| `ToList()` | Convert to List | `.Where(...).ToList()` |
| `ForEach(action)` | Execute on each | `.ForEach(m => m.IsHidden = true)` |

## Lambda Expression Syntax

```csharp
// Simple predicate (returns bool)
m => m.Name.Contains("YTD")

// Multi-condition predicate
m => m.Name.StartsWith("Total") && !m.IsHidden

// Complex predicate with curly braces
m => {
    if(m.Expression.Contains("CALCULATE")) {
        return m.Name.StartsWith("_");
    }
    return false;
}

// Action (no return value)
m => m.DisplayFolder = "Metrics"

// Map/projection
m => m.Name + " (" + m.Table.Name + ")"
```

## LINQ Examples

```csharp
// Filter measures by name pattern
var ytdMeasures = Model.AllMeasures.Where(m => m.Name.EndsWith("YTD"));

// Check if table exists before accessing
if(Model.Tables.Any(t => t.Name == "Sales")) {
    var sales = Model.Tables["Sales"];
}

// Get all hidden columns
var hiddenCols = Model.AllColumns.Where(c => c.IsHidden);

// Count measures per table
foreach(var t in Model.Tables) {
    Info($"{t.Name}: {t.Measures.Count()} measures");
}

// Find first matching or null
var dateTable = Model.Tables.FirstOrDefault(t => t.DataCategory == "Time");

// Chain operations
Model.AllMeasures
    .Where(m => m.Name.Contains("Revenue"))
    .Where(m => string.IsNullOrEmpty(m.FormatString))
    .ForEach(m => m.FormatString = "$#,0");
```
