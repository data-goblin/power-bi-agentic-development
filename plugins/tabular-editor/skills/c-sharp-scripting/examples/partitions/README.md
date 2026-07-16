# Partitions Scripts

Scripts for managing table partitions and incremental refresh.

## Available Scripts

- `refresh-partition.csx` - Refresh a specific partition
- `refresh-partitions-by-pattern.csx` - Refresh partitions matching pattern
- `setup-custom-partitions.csx` - Create custom partition scheme
- `setup-hybrid-table.csx` - Configure hybrid table (DirectQuery + Import)
- `setup-incremental-refresh-with-polling.csx` - Setup incremental refresh with polling

## Usage Examples

### Execute Script File
```bash
te script "model.bim" -S samples/partitions/setup-custom-partitions.csx --save
te script -s "Production" -d "Sales" -S samples/partitions/refresh-partition.csx --save
```

### Execute Inline
```bash
te script "model.bim" -e 'Model.Tables["Sales"].Partitions["Sales_2024"].RequestRefresh(RefreshType.Full);' --save
```

### With Fabric CLI Workflow
```bash
# Export model
fab export "Workspace/Model.SemanticModel" -o ./model -f

# Setup partitions
te script "./model/Model.SemanticModel/definition" -S samples/partitions/setup-custom-partitions.csx --save

# Import back
fab import "Workspace/Model.SemanticModel" -i ./model/Model.SemanticModel -f
```

## Common Patterns

### Create Date-Based Partitions
```csharp
var table = Model.Tables["Sales"];

// Remove default partition
table.Partitions[0].Delete();

// Create yearly partitions
for(int year = 2020; year <= 2024; year++) {
    var partition = table.AddMPartition($"Sales_{year}");
    partition.Expression = $@"
let
    Source = #""Source"",
    FilteredRows = Table.SelectRows(Source, each [Year] = {year})
in
    FilteredRows
";
}
```

### Setup Incremental Refresh
```csharp
var table = Model.Tables["Sales"];

// Create RangeStart and RangeEnd parameters in Power Query first
var policy = table.EnableRefreshPolicy();
policy.IncrementalPeriodsOffset = -1;
policy.RollingWindowPeriods = 3;
policy.RollingWindowGranularity = RefreshGranularity.Year;
policy.IncrementalGranularity = RefreshGranularity.Day;
policy.IncrementalPeriods = 10;
policy.SourceExpression = "[Date]";
```

### Refresh Specific Partition
```csharp
var partition = Model.Tables["Sales"].Partitions["Sales_2024"];
partition.RequestRefresh(RefreshType.Full);
```

### Refresh Partitions by Pattern
```csharp
foreach(var partition in Model.Tables["Sales"].Partitions) {
    if(partition.Name.Contains("2024")) {
        partition.RequestRefresh(RefreshType.Full);
    }
}
```

### Setup Hybrid Table
```csharp
var table = Model.Tables["Sales"];

// Set mode to Dual
table.Mode = ModeType.Dual;

// Create DirectQuery partition for recent data
var dqPartition = table.AddMPartition("Recent_DirectQuery");
dqPartition.Mode = ModeType.DirectQuery;
dqPartition.Expression = @"
let
    Source = #""Source"",
    RecentData = Table.SelectRows(Source, each [Date] >= Date.AddDays(DateTime.LocalNow(), -30))
in
    RecentData
";

// Import partition for historical data
var importPartition = table.AddMPartition("Historical_Import");
importPartition.Mode = ModeType.Import;
importPartition.Expression = @"
let
    Source = #""Source"",
    HistoricalData = Table.SelectRows(Source, each [Date] < Date.AddDays(DateTime.LocalNow(), -30))
in
    HistoricalData
";
```

## Property Reference

### Partition Properties
- `Name` - Partition name
- `Expression` - M or DAX expression
- `Mode` - Import or DirectQuery
- `SourceType` - M, Query, Calculated, etc.
- `RefreshPolicy` - Incremental refresh settings
- `RequestRefresh(type)` - Request refresh operation

### Table Partition Properties
- `Partitions` - Collection of partitions
- `AddMPartition(name)` - Add M partition
- `AddPartition(name)` - Add basic partition
- `EnableRefreshPolicy()` - Enable incremental refresh

### Refresh Policy Properties
- `IncrementalPeriodsOffset` - Offset from current period
- `RollingWindowPeriods` - Number of historical periods
- `RollingWindowGranularity` - Year, Quarter, Month, Day
- `IncrementalGranularity` - Granularity for incremental refresh
- `IncrementalPeriods` - Number of incremental periods
- `SourceExpression` - Date column expression

### Mode Types
- `ModeType.Import` - Import mode
- `ModeType.DirectQuery` - DirectQuery mode
- `ModeType.Dual` - Dual mode (hybrid)

### Refresh Granularity
- `RefreshGranularity.Year` - Yearly partitions
- `RefreshGranularity.Quarter` - Quarterly partitions
- `RefreshGranularity.Month` - Monthly partitions
- `RefreshGranularity.Day` - Daily partitions

## Best Practices

1. **Partition Strategy**
   - Partition large tables by date
   - Use meaningful partition names
   - Balance partition count vs size
   - Document partition scheme

2. **Incremental Refresh**
   - Use for large, growing tables
   - Set appropriate rolling window
   - Test with production data volumes
   - Monitor refresh performance

3. **Hybrid Tables**
   - Use for real-time + historical scenarios
   - DirectQuery for recent data
   - Import for historical data
   - Consider query performance

4. **Refresh Operations**
   - Refresh only changed partitions
   - Use parallel refresh when possible
   - Monitor memory usage
   - Log refresh results

## Common Partition Schemes

### Yearly Partitions
```csharp
// Create one partition per year
for(int year = 2020; year <= 2024; year++) {
    var partition = table.AddMPartition($"Year_{year}");
    partition.Expression = $"/* Filter for year {year} */";
}
```

### Monthly Partitions
```csharp
// Create one partition per month
for(int year = 2023; year <= 2024; year++) {
    for(int month = 1; month <= 12; month++) {
        var partition = table.AddMPartition($"{year}_{month:D2}");
        partition.Expression = $"/* Filter for {year}-{month:D2} */";
    }
}
```

### Rolling Window
```csharp
// Keep last 3 years, refresh last 30 days
var policy = table.EnableRefreshPolicy();
policy.RollingWindowPeriods = 3;
policy.RollingWindowGranularity = RefreshGranularity.Year;
policy.IncrementalPeriods = 30;
policy.IncrementalGranularity = RefreshGranularity.Day;
```

## See Also

- [Tables](../tables/)
- [Model](../model/)
- [Bulk Operations](../bulk-operations/)
