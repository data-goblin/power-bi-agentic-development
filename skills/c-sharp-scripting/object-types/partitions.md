# Partitions

Partitions define data sources and queries for tables. Each table has at least one partition that specifies how data is loaded.


## Partition Types

| Type | SourceType | Description |
|------|------------|-------------|
| **M Partition** | `M` | Power Query/M expression |
| **Legacy Partition** | `Query` | SQL query (legacy mode) |
| **Calculated** | `Calculated` | Calculated table (DAX) |
| **Policy Range** | `PolicyRange` | Incremental refresh partition |


## Accessing Partitions

```csharp
// Table's partitions
var partitions = Model.Tables["Sales"].Partitions;

// First/only partition
var partition = Model.Tables["Sales"].Partitions[0];

// By name
var partition = Model.Tables["Sales"].Partitions["Sales"];

// Hidden partitions (Calculated Tables, Calc Groups)
// These don't show in UI but are accessible via script
var calcTablePartition = Model.Tables["MyCalcTable"].Partitions[0];
calcTablePartition.Output();  // View/edit in property grid
```


## Creating Partitions

### M Partition (Power Query)

```csharp
var table = Model.Tables["Sales"];

// Create M partition
var partition = table.AddMPartition("Sales_2024");
partition.Expression = @"
let
    Source = Sql.Database(""server"", ""database""),
    Sales = Source{[Schema=""dbo"",Item=""Sales""]}[Data],
    Filtered = Table.SelectRows(Sales, each [Year] = 2024)
in
    Filtered
";
```

### Legacy SQL Partition

```csharp
// Requires legacy data source
var table = Model.Tables["Sales"];
var partition = table.AddPartition("Sales_2024");
partition.Query = "SELECT * FROM Sales WHERE Year = 2024";
partition.DataSource = Model.DataSources["SQL Server"];
```


## Partition Properties

### Common Properties

| Property | Type | Description |
|----------|------|-------------|
| `Name` | string | Partition name |
| `Table` | Table | Parent table |
| `SourceType` | PartitionSourceType | M, Query, Calculated, PolicyRange |
| `Expression` | string | M expression (for M partitions) |
| `Query` | string | SQL query (for legacy partitions) |
| `DataSource` | DataSource | Data source reference (legacy) |
| `Mode` | ModeType | Import, DirectQuery, Dual |

### M Partition Specific

```csharp
var partition = Model.Tables["Sales"].Partitions[0] as MPartition;

// M expression
partition.Expression = @"
let
    Source = ...
in
    Result
";
```

### Calculated Table Partition

```csharp
// Calculated tables have a single Calculated partition
var calcTable = Model.Tables["DateTable"];
var partition = calcTable.Partitions[0];

// The Expression is the DAX
Info(partition.Expression);  // Shows the CALENDAR() or similar DAX
```


## Working with Incremental Refresh

Incremental refresh creates PolicyRange partitions automatically.

### Check Refresh Policy

```csharp
var table = Model.Tables["FactSales"];

if(table.EnableRefreshPolicy) {
    Info("Refresh policy enabled");
    Info($"Rolling window: {table.RollingWindowPeriods} {table.RollingWindowGranularity}");
    Info($"Incremental: {table.IncrementalPeriods} {table.IncrementalGranularity}");
}
```

### Enable Refresh Policy

```csharp
var table = Model.Tables["FactSales"];

table.EnableRefreshPolicy = true;
table.RollingWindowGranularity = RefreshGranularityType.Year;
table.RollingWindowPeriods = 3;  // Keep 3 years
table.IncrementalGranularity = RefreshGranularityType.Day;
table.IncrementalPeriods = 30;   // Refresh last 30 days
table.IncrementalPeriodsOffset = -1;  // Complete periods only
```

### Source Expression for Incremental

```csharp
// Set source M expression that references RangeStart/RangeEnd
table.SourceExpression = @"
let
    Source = Sql.Database(""server"", ""db""),
    Sales = Source{[Schema=""dbo"",Item=""Sales""]}[Data],
    Filtered = Table.SelectRows(Sales, each
        [OrderDate] >= #""RangeStart"" and
        [OrderDate] < #""RangeEnd"")
in
    Filtered
";
```


## Common Patterns

### List All Partitions

```csharp
foreach(var table in Model.Tables) {
    Info($"Table: {table.Name}");
    foreach(var partition in table.Partitions) {
        Info($"  - {partition.Name} ({partition.SourceType})");
    }
}
```

### Count M Partitions

```csharp
var mPartitionCount = 0;
foreach(var table in Model.Tables) {
    foreach(var partition in table.Partitions) {
        if(Convert.ToString(partition.SourceType) == "M") {
            mPartitionCount++;
        }
    }
}
Info($"Total M partitions: {mPartitionCount}");
```

### Find Tables with Multiple Partitions

```csharp
var multiPartitionTables = Model.Tables
    .Where(t => t.Partitions.Count > 1)
    .Select(t => $"{t.Name}: {t.Partitions.Count} partitions");

Output(string.Join("\n", multiPartitionTables));
```

### View Hidden Partition (Calc Tables)

```csharp
// Calculated tables hide their partitions in UI
// Access via script to view/edit
Selected.Table.Partitions[0].Output();
```

### Modify Partition M Expression

```csharp
var partition = Model.Tables["Sales"].Partitions[0] as MPartition;

// Add a filter step
var currentExpr = partition.Expression;
partition.Expression = currentExpr.Replace(
    "in\n    Result",
    @",
    Filtered = Table.SelectRows(Result, each [IsActive] = true)
in
    Filtered"
);
```


## Partition Mode (Import/DirectQuery)

```csharp
// Check mode
var partition = Model.Tables["Sales"].Partitions[0];
Info($"Mode: {partition.Mode}");

// Set mode (when supported)
partition.Mode = ModeType.Import;
// partition.Mode = ModeType.DirectQuery;
// partition.Mode = ModeType.Dual;
```


## Delete Operations

```csharp
// Delete partition by name (if table has multiple)
Model.Tables["Sales"].Partitions["Sales_2023"].Delete();

// Cannot delete the only partition in a table
// Table must have at least one partition
```


## Best Practices

1. **Name partitions descriptively** - Especially for tables with multiple partitions
2. **Use M partitions** - Modern approach, avoid legacy SQL partitions
3. **Leverage incremental refresh** - For large fact tables
4. **Test M expressions** - Validate Power Query before saving
5. **Avoid editing calc table partitions** - Unless you understand the implications
6. **Document partition logic** - In table description or annotations
