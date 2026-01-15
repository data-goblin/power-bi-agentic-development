# Tables

Tables are containers for columns and measures, backed by partitions that define data sources.

## Table Types

| Type | Description |
|------|-------------|
| `Table` | Regular table with data partitions |
| `CalculatedTable` | DAX expression creates data at refresh |
| `CalculationGroupTable` | Special table for calculation groups |

## Key Properties

| Property | Type | Description |
|----------|------|-------------|
| `Name` | string | Table name |
| `Description` | string | Documentation text |
| `IsHidden` | bool | Visibility in client tools |
| `DataCategory` | string | Semantic type (`"Time"` for date tables) |
| `Columns` | ColumnCollection | All columns |
| `Measures` | MeasureCollection | All measures |
| `Hierarchies` | HierarchyCollection | User-defined hierarchies |
| `Partitions` | PartitionCollection | Data partitions |
| `IsPrivate` | bool | Exclude from model schema |
| `ExcludeFromModelRefresh` | bool | Skip during model refresh |
| `DaxObjectFullName` | string | Fully qualified DAX reference |

## Calculated Table Properties

```csharp
var calcTable = table as CalculatedTable;
if(calcTable != null) {
    calcTable.Expression = "CALENDAR(DATE(2020,1,1), DATE(2025,12,31))";
}
```

## Common Methods

| Method | Description |
|--------|-------------|
| `Model.AddTable(name)` | Create new empty table |
| `Model.AddCalculatedTable(name, expression)` | Create calculated table |
| `Model.AddCalculationGroup(name)` | Create calculation group |
| `Table.AddMeasure(name, expression)` | Add measure to table |
| `Table.AddCalculatedColumn(name, expression)` | Add calculated column |
| `Table.AddHierarchy(name)` | Add user-defined hierarchy |
| `Table.Delete()` | Remove table from model |

## Access Patterns

```csharp
// All tables
foreach(var t in Model.Tables) { }

// Single table by name
var sales = Model.Tables["Sales"];

// Check existence
if(Model.Tables.Contains("Sales")) { }

// Filter tables
var visibleTables = Model.Tables.Where(t => !t.IsHidden);
var factTables = Model.Tables.Where(t => t.Name.StartsWith("Fact"));
```

## CRUD Operations

### Create Regular Table
```csharp
var table = Model.AddTable("NewTable");
table.Description = "Table description";
// Add partition with M query or other source
```

### Create Calculated Table
```csharp
var dateTable = Model.AddCalculatedTable("Date",
    "CALENDAR(DATE(2020,1,1), DATE(2030,12,31))"
);
dateTable.DataCategory = "Time";
```

### Read Properties
```csharp
var name = table.Name;
var columnCount = table.Columns.Count;
var measureCount = table.Measures.Count;
var isHidden = table.IsHidden;
```

### Update
```csharp
table.Name = "Sales_Renamed";
table.Description = "Updated description";
table.IsHidden = true;
```

### Delete
```csharp
Model.Tables["OldTable"].Delete();
```

## Common Patterns

### Find Tables by Naming Convention
```csharp
var factTables = Model.Tables.Where(t => t.Name.StartsWith("Fact"));
var dimTables = Model.Tables.Where(t => t.Name.StartsWith("Dim"));
var calcGroups = Model.Tables.OfType<CalculationGroupTable>();
```

### Mark as Date Table
```csharp
var dateTable = Model.Tables["Date"];
dateTable.DataCategory = "Time";
// Also set date column in TE3 or via TMSL
```

### Hide All Calculation Groups
```csharp
foreach(var cg in Model.CalculationGroups) {
    cg.IsHidden = true;
}
```

### Report Table Statistics
```csharp
foreach(var t in Model.Tables) {
    var colCount = t.Columns.Count(c => c.Type != ColumnType.RowNumber);
    var measureCount = t.Measures.Count;
    Info($"{t.Name}: {colCount} columns, {measureCount} measures");
}
```

### Exclude from Refresh
```csharp
// Useful for static reference tables
table.ExcludeFromModelRefresh = true;
```

## Best Practices

1. **Consistent naming** - Use Fact/Dim prefixes or similar convention
2. **Hide calc groups** - They're for calculation, not direct use
3. **Mark date tables** - Set DataCategory = "Time"
4. **Document purpose** - Add descriptions for clarity
5. **Check existence** - Use Contains() before accessing by name

## Reference Examples

See `samples/tables/` for working examples.
