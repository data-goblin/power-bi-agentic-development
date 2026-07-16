# Functions Scripts

Scripts for managing DAX user-defined functions (UDFs) in Tabular models.

## Available Scripts

- `add-function.csx` - Create a new DAX function
- `delete-function.csx` - Remove a DAX function
- `list-functions.csx` - List all functions in the model
- `modify-function.csx` - Update function properties

## Usage Examples

### Execute Inline
```bash
te script "model.bim" -e 'var fn = Model.AddExpression("MyFunction", "VAR Result = 1 RETURN Result");' --save
```

### Execute Script File
```bash
te script "model.bim" -S samples/functions/add-function.csx --save
te script -s "Production" -d "Sales" -S samples/functions/list-functions.csx
```

### With Fabric CLI Workflow
```bash
# Export model
fab export "Workspace/Model.SemanticModel" -o ./model -f

# Manage functions
te script "./model/Model.SemanticModel/definition" -S samples/functions/add-function.csx --save

# Import back
fab import "Workspace/Model.SemanticModel" -i ./model/Model.SemanticModel -f
```

## Common Patterns

### Create DAX Function
```csharp
// Create simple function
var fn = Model.AddExpression("GetCurrentYear");
fn.Expression = "YEAR(TODAY())";
fn.Description = "Returns the current year";
fn.Kind = ExpressionKind.M;  // or ExpressionKind.N for DAX
```

### Create Parameterized Function
```csharp
var fn = Model.AddExpression("FormatCurrency");
fn.Expression = @"
(Value as number) as text =>
let
    Formatted = ""$"" & Number.ToText(Value, ""#,0.00"")
in
    Formatted
";
fn.Kind = ExpressionKind.M;
fn.Description = "Formats a number as currency";
```

### List All Functions
```csharp
foreach(var expr in Model.Expressions) {
    Info($"Function: {expr.Name}");
    Info($"  Kind: {expr.Kind}");
    Info($"  Description: {expr.Description}");
    Info($"  Expression: {expr.Expression}");
}
```

### Delete Function
```csharp
var fn = Model.Expressions["MyFunction"];
if(fn != null) {
    fn.Delete();
    Info("Deleted function: MyFunction");
}
```

### Update Function
```csharp
var fn = Model.Expressions["MyFunction"];
fn.Expression = "VAR NewValue = 2 RETURN NewValue";
fn.Description = "Updated description";
```

## Property Reference

### Expression Properties
- `Name` - Function name
- `Expression` - Function DAX or M code
- `Kind` - Expression type (M or N for DAX)
- `Description` - Function description

### Expression Kinds
- `ExpressionKind.M` - Power Query M expression
- `ExpressionKind.N` - DAX expression (calculated tables use this)

## Best Practices

1. **Function Naming**
   - Use clear, descriptive names
   - Follow consistent naming conventions
   - Prefix with category if needed (e.g., "Date_GetCurrentYear")

2. **Documentation**
   - Add comprehensive descriptions
   - Document parameters
   - Include usage examples

3. **Testing**
   - Test functions with various inputs
   - Validate return values
   - Handle edge cases

4. **Organization**
   - Group related functions
   - Use consistent patterns
   - Keep functions focused and simple

## Common Use Cases

### Date Functions
```csharp
var fn = Model.AddExpression("GetFiscalYear");
fn.Expression = @"
(InputDate as date) as number =>
let
    FiscalYear = if Date.Month(InputDate) >= 7
                 then Date.Year(InputDate) + 1
                 else Date.Year(InputDate)
in
    FiscalYear
";
fn.Kind = ExpressionKind.M;
```

### Text Functions
```csharp
var fn = Model.AddExpression("CleanText");
fn.Expression = @"
(InputText as text) as text =>
let
    Trimmed = Text.Trim(InputText),
    Cleaned = Text.Upper(Trimmed)
in
    Cleaned
";
fn.Kind = ExpressionKind.M;
```

### Calculation Functions
```csharp
var fn = Model.AddExpression("CalculateMargin");
fn.Expression = @"
(Revenue as number, Cost as number) as number =>
let
    Margin = (Revenue - Cost) / Revenue
in
    Margin
";
fn.Kind = ExpressionKind.M;
```

## See Also

- [Shared Expressions](../shared-expressions/)
- [Measures](../measures/)
- [Tables](../tables/)
