# Columns

Table columns store data values or calculated results in the model.

## Column Types

| Type | Description |
|------|-------------|
| `ColumnType.Data` | Regular data column from source |
| `ColumnType.Calculated` | Calculated column with DAX expression |
| `ColumnType.RowNumber` | Internal row number (system-generated) |

## Key Properties

| Property | Type | Description |
|----------|------|-------------|
| `Name` | string | Column name |
| `Type` | ColumnType | Data/Calculated/RowNumber |
| `DataType` | DataType | Int64/String/DateTime/Decimal/Double/Boolean |
| `FormatString` | string | Number/date display format |
| `Description` | string | Documentation text |
| `DisplayFolder` | string | Organization folder path |
| `IsHidden` | bool | Visibility in client tools |
| `IsKey` | bool | Whether column is a key |
| `SummarizeBy` | AggregateFunction | Default aggregation (None/Sum/Average/etc.) |
| `SortByColumn` | Column | Column to sort by |
| `Table` | Table | Parent table (read-only) |
| `SourceColumn` | string | Source column name (data columns only) |
| `DataCategory` | string | Semantic type (City, Country, WebURL, etc.) |
| `IsAvailableInMDX` | bool | Available for MDX/Excel queries |
| `DaxObjectFullName` | string | Fully qualified DAX reference |

## Calculated Column Properties

```csharp
var calcCol = column as CalculatedColumn;
if(calcCol != null) {
    calcCol.Expression = "Sales[Qty] * Sales[Price]";
}
```

## Common Methods

| Method | Description |
|--------|-------------|
| `Table.AddCalculatedColumn(name, expression)` | Create calculated column |
| `Table.AddDataColumn(name)` | Add data column (metadata only) |
| `Column.Delete()` | Remove column from model |
| `Column.FormatDax()` | Format calculated column DAX |

## Access Patterns

```csharp
// All columns in table
foreach(var c in Model.Tables["Sales"].Columns) { }

// All columns in model
foreach(var c in Model.AllColumns) { }

// Filter by name pattern
var keyColumns = Model.AllColumns.Where(c => c.Name.EndsWith("Key"));

// Exclude row number columns
var dataColumns = table.Columns.Where(c => c.Type != ColumnType.RowNumber);
```

## CRUD Operations

### Create Calculated Column
```csharp
var col = Model.Tables["Sales"].AddCalculatedColumn(
    "Line Total",
    "Sales[Qty] * Sales[Price]"
);
col.FormatString = "$#,0.00";
col.DisplayFolder = "Calculated";
col.IsHidden = true;  // Hide if used only in measures
```

### Update Properties
```csharp
column.Name = "New Name";
column.FormatString = "#,0";
column.Description = "Column description";
column.IsHidden = true;
column.SummarizeBy = AggregateFunction.None;
```

### Configure Sort By Column
```csharp
var monthName = table.Columns["MonthName"];
var monthNum = table.Columns["MonthNumber"];
monthName.SortByColumn = monthNum;
```

### Set Data Category
```csharp
column.DataCategory = "City";
column.DataCategory = "Country";
column.DataCategory = "Latitude";
column.DataCategory = "Longitude";
column.DataCategory = "WebURL";
column.DataCategory = "ImageURL";
```

### Delete
```csharp
Model.Tables["Sales"].Columns["OldColumn"].Delete();
```

## Common Patterns

### Hide All Key Columns
```csharp
foreach(var c in Model.AllColumns.Where(c => c.Name.EndsWith("Key") || c.Name.EndsWith("ID"))) {
    c.IsHidden = true;
    c.SummarizeBy = AggregateFunction.None;
}
```

### Disable Default Summarization
```csharp
foreach(var c in Model.AllColumns.Where(c => c.Type == ColumnType.Data)) {
    c.SummarizeBy = AggregateFunction.None;
}
```

### Apply Currency Format
```csharp
foreach(var c in Model.AllColumns.Where(c => c.Name.Contains("Amount") || c.Name.Contains("Price"))) {
    c.FormatString = "$#,##0.00";
}
```

### Organize into Display Folders
```csharp
foreach(var c in table.Columns.Where(c => c.Type != ColumnType.RowNumber)) {
    if(c.Name.EndsWith("Key") || c.Name.EndsWith("ID")) {
        c.DisplayFolder = "_Keys";
    } else if(c.DataType == DataType.DateTime) {
        c.DisplayFolder = "Dates";
    }
}
```

### Report Column Statistics
```csharp
foreach(var c in Model.AllColumns.Where(c => c.Type != ColumnType.RowNumber)) {
    Info($"{c.DaxObjectFullName}: {c.DataType}, Hidden={c.IsHidden}");
}
```

## Best Practices

1. **Hide key columns** - And disable summarization (`SummarizeBy = None`)
2. **Set data categories** - For geographic data (maps) and URLs
3. **Use SortByColumn** - For month names, day names, etc.
4. **Apply format strings** - Consistent display formatting
5. **Hide calculated columns** - If only used internally in measures
6. **Organize into folders** - Use DisplayFolder for logical grouping

## Reference Examples

See `samples/columns/` for working examples.
