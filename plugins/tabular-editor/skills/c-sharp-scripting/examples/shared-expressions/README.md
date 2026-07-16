# Shared Expressions Scripts

Scripts for managing shared M expressions (Power Query parameters and functions) in Tabular models.

## Available Scripts

- `add-shared-expression.csx` - Create a new shared expression
- `delete-shared-expression.csx` - Remove a shared expression
- `list-shared-expressions.csx` - List all shared expressions
- `modify-shared-expression.csx` - Update expression properties

## Usage Examples

### Execute Inline
```bash
te script "model.bim" -e 'var expr = Model.AddExpression("ServerName", "\"prod-server\"", ExpressionKind.M);' --save
```

### Execute Script File
```bash
te script "model.bim" -S samples/shared-expressions/add-shared-expression.csx --save
te script -s "Production" -d "Sales" -S samples/shared-expressions/list-shared-expressions.csx
```

### With Fabric CLI Workflow
```bash
# Export model
fab export "Workspace/Model.SemanticModel" -o ./model -f

# Manage shared expressions
te script "./model/Model.SemanticModel/definition" -S samples/shared-expressions/add-shared-expression.csx --save

# Import back
fab import "Workspace/Model.SemanticModel" -i ./model/Model.SemanticModel -f
```

## Common Patterns

### Create Power Query Parameter
```csharp
// Create parameter for server name
var param = Model.AddExpression("ServerName");
param.Kind = ExpressionKind.M;
param.Expression = "\"prod-server\"";
param.Description = "SQL Server name";
```

### Create Shared Function
```csharp
// Create reusable M function
var func = Model.AddExpression("GetCurrentFiscalYear");
func.Kind = ExpressionKind.M;
func.Expression = @"
() as number =>
let
    Today = DateTime.LocalNow(),
    FiscalYearStart = 7, // July
    CurrentYear = Date.Year(Today),
    CurrentMonth = Date.Month(Today),
    FiscalYear = if CurrentMonth >= FiscalYearStart
                 then CurrentYear + 1
                 else CurrentYear
in
    FiscalYear
";
func.Description = "Returns current fiscal year (July start)";
```

### List All Shared Expressions
```csharp
foreach(var expr in Model.Expressions) {
    Info($"Expression: {expr.Name}");
    Info($"  Kind: {expr.Kind}");
    Info($"  Description: {expr.Description}");
    Info($"  Expression: {expr.Expression}");
}
```

### Delete Expression
```csharp
var expr = Model.Expressions["OldParameter"];
if(expr != null) {
    expr.Delete();
    Info("Deleted expression");
}
```

### Update Expression
```csharp
var expr = Model.Expressions["ServerName"];
expr.Expression = "\"new-server\"";
expr.Description = "Updated server name";
```

## Property Reference

### Expression Properties
- `Name` - Expression name
- `Expression` - M or DAX code
- `Kind` - ExpressionKind.M or ExpressionKind.N
- `Description` - Expression description

### Expression Kinds
- `ExpressionKind.M` - Power Query M expression (parameters, functions)
- `ExpressionKind.N` - DAX expression (calculated tables)

## Common Use Cases

### Environment Parameters
```csharp
// Development
var dev = Model.AddExpression("Environment");
dev.Kind = ExpressionKind.M;
dev.Expression = "\"Development\"";

// Server
var server = Model.AddExpression("ServerName");
server.Kind = ExpressionKind.M;
server.Expression = "\"dev-server\"";

// Database
var db = Model.AddExpression("DatabaseName");
db.Kind = ExpressionKind.M;
db.Expression = "\"AdventureWorks_Dev\"";
```

### Data Source Functions
```csharp
var func = Model.AddExpression("GetSQLSource");
func.Kind = ExpressionKind.M;
func.Expression = @"
(tableName as text) as table =>
let
    Source = Sql.Database(ServerName, DatabaseName),
    Table = Source{[Schema=""dbo"", Item=tableName]}[Data]
in
    Table
";
func.Description = "Connects to SQL database and returns specified table";
```

### Date Range Parameters
```csharp
// Start Date
var startDate = Model.AddExpression("StartDate");
startDate.Kind = ExpressionKind.M;
startDate.Expression = "#date(2024, 1, 1)";
startDate.Description = "Data extraction start date";

// End Date
var endDate = Model.AddExpression("EndDate");
endDate.Kind = ExpressionKind.M;
endDate.Expression = "DateTime.Date(DateTime.LocalNow())";
endDate.Description = "Data extraction end date";
```

### Transformation Functions
```csharp
var func = Model.AddExpression("CleanColumnNames");
func.Kind = ExpressionKind.M;
func.Expression = @"
(table as table) as table =>
let
    CleanedNames = Table.TransformColumnNames(
        table,
        each Text.Trim(_),
        each Text.Replace(_, "" "", ""_"")
    )
in
    CleanedNames
";
func.Description = "Trims and replaces spaces in column names";
```

## Using Shared Expressions

### In Power Query
```m
// Reference parameter
let
    Source = Sql.Database(ServerName, DatabaseName),
    ...
in
    Source

// Call function
let
    CurrentYear = GetCurrentFiscalYear(),
    ...
in
    CurrentYear
```

### In Partition Expressions
```csharp
var table = Model.Tables["Sales"];
var partition = table.Partitions[0] as MPartition;

partition.Expression = @"
let
    Source = GetSQLSource(""FactSales""),
    FilteredRows = Table.SelectRows(Source, each [OrderDate] >= StartDate and [OrderDate] <= EndDate)
in
    FilteredRows
";
```

## Best Practices

1. **Parameter Naming**
   - Use PascalCase for parameters
   - Use descriptive names
   - Group related parameters with prefixes

2. **Function Design**
   - Keep functions focused and simple
   - Document parameters and return types
   - Include error handling

3. **Environment Configuration**
   - Use parameters for environment-specific values
   - Document expected values
   - Update in deployment scripts

4. **Reusability**
   - Create functions for repeated logic
   - Share common transformations
   - Centralize connection logic

5. **Documentation**
   - Add descriptions to all expressions
   - Document parameter formats
   - Include usage examples

## Common Parameters

### Connection Parameters
```m
ServerName = "prod-server" meta [IsParameterQuery=true, Type="Text"]
DatabaseName = "AdventureWorks" meta [IsParameterQuery=true, Type="Text"]
```

### Date Parameters
```m
StartDate = #date(2024,1,1) meta [IsParameterQuery=true, Type="Date"]
EndDate = DateTime.Date(DateTime.LocalNow()) meta [IsParameterQuery=true, Type="Date"]
```

### Filter Parameters
```m
Region = "West" meta [IsParameterQuery=true, Type="Text"]
MinAmount = 1000 meta [IsParameterQuery=true, Type="Number"]
```

## See Also

- [Functions](../functions/)
- [Tables](../tables/)
- [Partitions](../partitions/)
