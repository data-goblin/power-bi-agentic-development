# Format DAX Scripts

Scripts for formatting DAX expressions using built-in formatter.

## Available Scripts

- `format-measures.csx` - Format all measures in the model
- `format-calculation-items.csx` - Format calculation items in calculation groups
- `format-calculated-tables.csx` - Format calculated table expressions
- `format-calculated-columns.csx` - Format calculated column expressions

## Usage Examples

### Execute Script File
```bash
te script "model.bim" -S samples/format-dax/format-measures.csx --save
te script -s "Production" -d "Sales" -S samples/format-dax/format-calculated-columns.csx --save
```

### Execute Inline
```bash
te script "model.bim" -e 'foreach(var m in Model.AllMeasures) { m.Expression = FormatDax(m.Expression); }' --save
```

### With Fabric CLI Workflow
```bash
# Export model
fab export "Workspace/Model.SemanticModel" -o ./model -f

# Format all DAX
te script "./model/Model.SemanticModel/definition" -S samples/format-dax/format-measures.csx --save
te script "./model/Model.SemanticModel/definition" -S samples/format-dax/format-calculated-columns.csx --save

# Import back
fab import "Workspace/Model.SemanticModel" -i ./model/Model.SemanticModel -f
```

## Common Patterns

### Format All Measures
```csharp
foreach(var measure in Model.AllMeasures) {
    measure.Expression = FormatDax(measure.Expression);
}
Info("Formatted " + Model.AllMeasures.Count() + " measures");
```

### Format Calculated Columns
```csharp
foreach(var column in Model.AllColumns.OfType<CalculatedColumn>()) {
    column.Expression = FormatDax(column.Expression);
}
```

### Format Calculation Items
```csharp
foreach(var item in Model.AllCalculationItems) {
    item.Expression = FormatDax(item.Expression);
}
```

### Format Calculated Tables
```csharp
foreach(var table in Model.Tables) {
    foreach(var partition in table.Partitions.OfType<MPartition>()) {
        if(partition.SourceType == PartitionSourceType.Calculated) {
            partition.Expression = FormatDax(partition.Expression);
        }
    }
}
```

### Format Selected Objects
```csharp
// Format only selected measures
foreach(var measure in Selected.Measures) {
    measure.Expression = FormatDax(measure.Expression);
}
Info("Formatted " + Selected.Measures.Count() + " selected measures");
```

### Format with Error Handling
```csharp
var formatted = 0;
var errors = 0;

foreach(var measure in Model.AllMeasures) {
    try {
        measure.Expression = FormatDax(measure.Expression);
        formatted++;
    }
    catch(Exception ex) {
        Error("Failed to format measure: " + measure.Name);
        errors++;
    }
}

Info("Formatted: " + formatted + ", Errors: " + errors);
```

## Property Reference

### FormatDax Function
- `FormatDax(expression)` - Format DAX expression using built-in formatter
- Returns formatted DAX string
- Throws exception if DAX is invalid

### Expression Properties
- `Measure.Expression` - Measure DAX expression
- `CalculatedColumn.Expression` - Column DAX expression
- `CalculationItem.Expression` - Calculation item DAX expression
- `MPartition.Expression` - Table DAX expression (calculated tables)

## Best Practices

1. **Pre-Formatting Checks**
   - Validate DAX syntax before formatting
   - Test on selected objects first
   - Use try-catch for error handling

2. **Formatting Standards**
   - Format all DAX regularly
   - Maintain consistent formatting
   - Format before commits/deployments

3. **Performance**
   - Format can be slow on large models
   - Consider formatting only changed objects
   - Run during off-hours for large models

4. **Error Handling**
   - Log formatting errors
   - Don't fail entire script on one error
   - Report which objects failed

## Common Formatting Benefits

1. **Readability**
   - Consistent indentation
   - Aligned operators
   - Clear structure

2. **Maintainability**
   - Easier to understand complex DAX
   - Standardized across team
   - Reduces review time

3. **Quality**
   - Reveals syntax issues
   - Highlights missing elements
   - Improves code review

## See Also

- [Measures](../measures/)
- [Calculation Groups](../calculation-groups/)
- [Tables](../tables/)
- [Columns](../columns/)
