# Measures

DAX measures are model calculations that aggregate or compute values at query time.

## Key Properties

| Property | Type | Description |
|----------|------|-------------|
| `Name` | string | Measure name |
| `Expression` | string | DAX formula |
| `FormatString` | string | Display format (e.g., `"$#,0"`, `"0.00%"`) |
| `Description` | string | Documentation text |
| `DisplayFolder` | string | Organization folder path (use `/` for hierarchy) |
| `IsHidden` | bool | Visibility in client tools |
| `Table` | Table | Parent table (read-only) |
| `KPI` | KPI | Associated KPI or null |
| `DetailRowsExpression` | string | Detail rows DAX for drillthrough |
| `DataCategory` | string | Semantic category (URL, ImageURL, etc.) |
| `DaxObjectFullName` | string | Fully qualified DAX reference (read-only) |

## Common Methods

| Method | Description |
|--------|-------------|
| `Table.AddMeasure(name)` | Create new measure with empty expression |
| `Table.AddMeasure(name, expression)` | Create measure with DAX expression |
| `Measure.Delete()` | Remove measure from model |
| `Measure.FormatDax()` | Auto-format DAX code |
| `Measure.Clone()` | Create duplicate measure |

## Access Patterns

```csharp
// All measures in single table
foreach(var m in Model.Tables["Sales"].Measures) { }

// All measures in model
foreach(var m in Model.AllMeasures) { }

// Filter by name pattern
var ytdMeasures = Model.AllMeasures.Where(m => m.Name.Contains("YTD"));

// Get specific measure
var totalSales = Model.Tables["Sales"].Measures["Total Sales"];
```

## CRUD Operations

### Create
```csharp
var m = Model.Tables["Sales"].AddMeasure("Total Sales", "SUM(Sales[Amount])");
m.FormatString = "$#,0";
m.DisplayFolder = "Key Metrics";
m.Description = "Total sales amount";
```

### Read
```csharp
var expression = measure.Expression;
var format = measure.FormatString;
var folder = measure.DisplayFolder;
```

### Update
```csharp
measure.Name = "New Name";
measure.Expression = "SUMX(Sales, Sales[Qty] * Sales[Price])";
measure.FormatString = "0.00%";
measure.IsHidden = true;
```

### Delete
```csharp
Model.Tables["Sales"].Measures["Old Measure"].Delete();
// Or
measure.Delete();
```

## Common Patterns

### Bulk Format String Update
```csharp
foreach(var m in Model.AllMeasures.Where(m => m.Name.EndsWith("Amount"))) {
    m.FormatString = "$#,0.00";
}
```

### Organize into Folders
```csharp
foreach(var m in Model.AllMeasures) {
    if(m.Name.Contains("YTD")) m.DisplayFolder = "Time Intelligence";
    else if(m.Name.Contains("PY")) m.DisplayFolder = "Time Intelligence";
    else if(m.Name.StartsWith("_")) m.DisplayFolder = "_Supporting";
}
```

### Hide Supporting Measures
```csharp
foreach(var m in Model.AllMeasures.Where(m => m.Name.StartsWith("_"))) {
    m.IsHidden = true;
}
```

### Create Time Intelligence
```csharp
var baseMeasure = Model.Tables["Sales"].Measures["Sales Amount"];
var table = baseMeasure.Table;

var ytd = table.AddMeasure(
    baseMeasure.Name + " YTD",
    "CALCULATE([" + baseMeasure.Name + "], DATESYTD('Date'[Date]))"
);
ytd.FormatString = baseMeasure.FormatString;
ytd.DisplayFolder = "Time Intelligence";
```

### Format All Measures
```csharp
var count = 0;
foreach(var m in Model.AllMeasures) {
    m.FormatDax();
    count++;
}
Info("Formatted " + count + " measures");
```

## Best Practices

1. **Use descriptive names** - Explain what the measure calculates
2. **Add descriptions** - Document complex logic for other developers
3. **Organize into folders** - Use DisplayFolder for logical grouping
4. **Hide helper measures** - Prefix with `_` and set IsHidden = true
5. **Apply format strings** - Currency, percentage, integer as appropriate
6. **Format DAX** - Use FormatDax() for consistent code style
7. **Use forward slashes** - In DisplayFolder paths (`Sales/YTD` becomes `Sales\YTD`)

## Reference Examples

See `samples/measures/` for working examples.
