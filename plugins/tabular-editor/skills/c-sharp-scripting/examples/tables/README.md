# Tables Scripts

Scripts for managing tables in Tabular models.

## Available Scripts

- `add-field-parameter.csx` - Create field parameter table
- `add-measure-table.csx` - Create centralized measures table
- `add-last-refresh-table.csx` - Create table showing refresh times
- `add-date-table.csx` - Create comprehensive date dimension table
- `format-power-query.csx` - Format M expressions in partitions
- `setup-incremental-refresh.csx` - Configure incremental refresh
- `set-table-properties.csx` - Update table properties
- `hide-table.csx` - Hide a table
- `delete-table.csx` - Remove a table
- `mark-as-date-table.csx` - Mark table as date table
- `find-replace-in-partition-expression.csx` - Find/replace in M expressions
- `parameterize-power-query.csx` - Add parameters to Power Query
- `add-to-table-group.csx` - Organize tables into groups
- `mark-table-as-private.csx` - Mark table as private
- `add-detail-rows-expression.csx` - Configure drill-through details
- `configure-rls.csx` - Set row-level security on table
- `configure-ols.csx` - Set object-level security on table

## Usage Examples

### Execute Inline
```bash
te script "model.bim" -e 'var t = Model.AddTable("NewTable"); t.AddDataColumn("ID"); t.Partitions[0].Expression = "Source";' --save
```

### Execute Script File
```bash
te script "model.bim" -S samples/tables/add-date-table.csx --save
te script -s "Production" -d "Sales" -S samples/tables/add-measure-table.csx --save
```

### With Fabric CLI Workflow
```bash
# Export model
fab export "Workspace/Model.SemanticModel" -o ./model -f

# Create/modify tables
te script "./model/Model.SemanticModel/definition" -S samples/tables/add-date-table.csx --save

# Import back
fab import "Workspace/Model.SemanticModel" -i ./model/Model.SemanticModel -f
```

## Common Patterns

### Create Basic Table
```csharp
var table = Model.AddTable("MyTable");

// Add data column
var col = table.AddDataColumn("ID");
col.DataType = DataType.Int64;
col.IsKey = true;

// Set partition
var partition = table.Partitions[0] as MPartition;
partition.Expression = @"
let
    Source = Sql.Database(""server"", ""database""),
    Table = Source{[Schema=""dbo"", Item=""MyTable""]}[Data]
in
    Table
";
```

### Create Calculated Table
```csharp
var table = Model.AddCalculatedTable("Calendar");
table.Expression = "CALENDAR(DATE(2020,1,1), DATE(2025,12,31))";

// Add calculated columns
table.AddCalculatedColumn("Year", "YEAR([Date])");
table.AddCalculatedColumn("Month", "MONTH([Date])");
table.AddCalculatedColumn("MonthName", "FORMAT([Date], \"MMMM\")");
```

### Create Measures Table
```csharp
var measuresTable = Model.AddTable("_Measures");
measuresTable.IsHidden = true;
measuresTable.Description = "Centralized measures table";

// Add a dummy column (required)
var col = measuresTable.AddDataColumn("_Dummy");
col.IsHidden = true;

// Set partition to empty
var partition = measuresTable.Partitions[0] as MPartition;
partition.Expression = "#table(type table [_Dummy = Int64.Type], {})";
```

### Mark as Date Table
```csharp
var dateTable = Model.Tables["Date"];
dateTable.DataCategory = "Time";

// Mark key column
var dateColumn = dateTable.Columns["Date"];
dateColumn.IsKey = true;
dateColumn.DataType = DataType.DateTime;
```

### Set Table Properties
```csharp
var table = Model.Tables["Sales"];

table.Description = "Fact table for sales transactions";
table.IsHidden = false;
table.ShowAsVariationsOnly = false;

// Set detail rows expression
table.DefaultDetailRowsExpression = "TOPN(100, 'Sales')";
```

### Hide/Show Tables
```csharp
// Hide helper tables
foreach(var table in Model.Tables.Where(t => t.Name.StartsWith("_"))) {
    table.IsHidden = true;
}

// Show dimension tables
foreach(var table in Model.Tables.Where(t => t.Name.StartsWith("Dim"))) {
    table.IsHidden = false;
}
```

## Property Reference

### Table Properties
- `Name` - Table name
- `Description` - Table description
- `IsHidden` - Visibility flag
- `DataCategory` - Data category (e.g., "Time" for date tables)
- `Mode` - Import, DirectQuery, or Dual
- `Partitions` - Collection of partitions
- `Columns` - Collection of columns
- `Measures` - Collection of measures
- `Hierarchies` - Collection of hierarchies
- `DefaultDetailRowsExpression` - DAX for drill-through

### Table Creation Methods
- `Model.AddTable(name)` - Add standard table
- `Model.AddCalculatedTable(name)` - Add calculated table
- `table.AddDataColumn(name)` - Add data column
- `table.AddCalculatedColumn(name, expression)` - Add calculated column
- `table.AddMeasure(name, expression)` - Add measure
- `table.AddHierarchy(name)` - Add hierarchy

### Mode Types
- `ModeType.Import` - Import mode (cached)
- `ModeType.DirectQuery` - DirectQuery mode (live)
- `ModeType.Dual` - Dual mode (hybrid)

## Common Table Types

### Date Dimension
```csharp
var dateTable = Model.AddCalculatedTable("Date");
dateTable.Expression = "CALENDAR(DATE(2020,1,1), DATE(2030,12,31))";
dateTable.DataCategory = "Time";

// Add calculated columns
dateTable.AddCalculatedColumn("Year", "YEAR([Date])");
dateTable.AddCalculatedColumn("YearMonth", "FORMAT([Date], \"YYYY-MM\")");
dateTable.AddCalculatedColumn("MonthName", "FORMAT([Date], \"MMMM\")");
dateTable.AddCalculatedColumn("DayOfWeek", "FORMAT([Date], \"dddd\")");
dateTable.AddCalculatedColumn("Quarter", "\"Q\" & QUARTER([Date])");
dateTable.AddCalculatedColumn("IsWeekend", "WEEKDAY([Date]) IN {1, 7}");

// Mark as date table
dateTable.Columns["Date"].IsKey = true;
```

### Field Parameter
```csharp
var fieldParam = Model.AddCalculatedTable("FieldParameter");
fieldParam.Expression = @"
{
    (""Sales"", NAMEOF('Sales'[Total Sales]), 0),
    (""Quantity"", NAMEOF('Sales'[Total Quantity]), 1),
    (""Profit"", NAMEOF('Sales'[Total Profit]), 2)
}
";

// Add columns
fieldParam.AddCalculatedColumn("Field", "[Value1]");
fieldParam.AddCalculatedColumn("Measure", "[Value2]");
fieldParam.AddCalculatedColumn("SortOrder", "[Value3]");

// Add measure for dynamic calculation
var dynMeasure = fieldParam.AddMeasure("Selected Measure");
dynMeasure.Expression = "SELECTEDVALUE('FieldParameter'[Measure])";
```

### Measures Table
```csharp
var measures = Model.AddTable("_Measures");
measures.IsHidden = true;
measures.Description = "Centralized container for all measures";

// Required dummy column
var dummy = measures.AddDataColumn("_");
dummy.IsHidden = true;
dummy.DataType = DataType.Int64;

// Empty partition
var partition = measures.Partitions[0] as MPartition;
partition.Expression = "#table(type table [_ = Int64.Type], {})";

// Move all measures to this table
foreach(var table in Model.Tables) {
    var measuresList = table.Measures.ToList();
    foreach(var measure in measuresList) {
        measure.Table = measures;
    }
}
```

## Best Practices

1. **Table Organization**
   - Use prefixes (Fact, Dim, Bridge)
   - Hide helper/staging tables
   - Group related tables
   - Document table purposes

2. **Date Tables**
   - Always create explicit date table
   - Disable Auto Date/Time
   - Mark date column as key
   - Include common date attributes

3. **Measures Tables**
   - Consider centralized measures table
   - Reduces visual clutter
   - Easier to manage
   - Hide the table itself

4. **Naming Conventions**
   - Use clear, descriptive names
   - Follow consistent patterns
   - Avoid spaces if possible
   - Use underscores or PascalCase

5. **Storage Mode**
   - Import for best performance
   - DirectQuery for real-time needs
   - Dual for hybrid scenarios
   - Document mode choices

## See Also

- [Columns](../columns/)
- [Measures](../measures/)
- [Partitions](../partitions/)
- [Relationships](../relationships/)
