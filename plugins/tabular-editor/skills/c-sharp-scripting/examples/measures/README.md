# Measures Scripts

Scripts for managing DAX measures in Tabular models.

## CRUD Operations

### Create
- `add_single_measure.csx` - Create a single measure
- `add_measures.csx` - Create multiple measures at once
- `create_sum_measures.csx` - Generate SUM measures for numeric columns
- `create_countrows_measures.csx` - Generate COUNTROWS measures for tables
- `create_time_intelligence.csx` - Create time intelligence measures (YTD, MTD, etc.)
- `copy_measure.csx` - Duplicate an existing measure

### Read
- `list-measures.csx` - List all measures with properties
- `read-measure-properties.csx` - Display detailed properties of a specific measure

### Update
- `update-measure.csx` - Update measure properties (expression, format, folder, description)
- `rename-measure.csx` - Rename a measure
- `move-measures-to-table.csx` - Move measures between tables

### Delete
- `delete-measure.csx` - Delete a specific measure
- `delete-measures-by-pattern.csx` - Delete measures matching a pattern

## Visibility Management

- `hide-measures.csx` - Hide all measures in a specific table
- `unhide-measures.csx` - Unhide all measures in a specific table
- `hide-all-measures.csx` - Hide all measures in the entire model

## Utility Scripts

- `format-all-measures.csx` - Format DAX for all measures using built-in formatter
- `create-selected-column-sums.csx` - Generate SUM measures for selected columns

## Usage Examples

### Execute Inline
```bash
te script "model.bim" -e 'var m = Model.Tables["Sales"].AddMeasure("Revenue", "SUM(Sales[Amount])"); m.FormatString = "$#,0";' --save
```

### Execute Script File
```bash
te script "model.bim" -S samples/measures/hide-measures.csx --save
te script -s "Production" -d "Sales" -S samples/measures/format-all-measures.csx --save
```

### With Fabric CLI Workflow
```bash
# Export model
fab export "Workspace/Model.SemanticModel" -o ./model -f

# Run measure scripts
te script "./model/Model.SemanticModel/definition" -S samples/measures/add_measures.csx --save
te script "./model/Model.SemanticModel/definition" -S samples/measures/format-all-measures.csx --save

# Import back
fab import "Workspace/Model.SemanticModel" -i ./model/Model.SemanticModel -f
```

## Common Patterns

### Create Measure with All Properties
```csharp
var measure = Model.Tables["Sales"].AddMeasure(
    "Total Revenue",
    "SUM(Sales[Amount])"
);

measure.FormatString = "$#,0.00";
measure.DisplayFolder = "Revenue Metrics";
measure.Description = "Total sales revenue across all transactions";
measure.IsHidden = false;
```

### Batch Update Format Strings
```csharp
foreach(var measure in Model.AllMeasures.Where(m => m.Name.Contains("Amount"))) {
    measure.FormatString = "$#,0.00";
}
```

### Hide Helper Measures
```csharp
foreach(var measure in Model.AllMeasures.Where(m => m.Name.StartsWith("_"))) {
    measure.IsHidden = true;
}
```

### Move Measures to Centralized Table
```csharp
var measuresTable = Model.Tables["_Measures"];

foreach(var table in Model.Tables) {
    var measures = table.Measures.ToList();
    foreach(var measure in measures) {
        measure.Table = measuresTable;
    }
}
```

## Property Reference

### Measure Properties
- `Name` - Measure name
- `Expression` - DAX expression
- `FormatString` - Number format (e.g., `"$#,0.00"`, `"0.0%"`)
- `DisplayFolder` - Folder path (e.g., `"Sales\\Revenue"`)
- `Description` - Measure description
- `IsHidden` - Visibility flag
- `DataType` - Return data type
- `Table` - Parent table

### Common Format Strings
- Currency: `"$#,0.00"` or `"$#,0"`
- Percentage: `"0.0%"` or `"0.00%"`
- Integer: `"#,0"`
- Decimal: `"#,0.00"`
- Date: `"mm/dd/yyyy"`

## Best Practices

1. **Naming Conventions**
   - Use descriptive names: `Total Sales` not `Sales1`
   - Prefix helper measures with underscore: `_HelperMeasure`
   - Use consistent casing

2. **Organization**
   - Use Display Folders to group related measures
   - Consider a centralized `_Measures` table
   - Hide intermediate calculation measures

3. **Documentation**
   - Add descriptions to all visible measures
   - Document complex DAX logic in comments
   - Use consistent format strings

4. **Performance**
   - Avoid CALCULATE with too many filters
   - Use variables to avoid recalculation
   - Test with actual data volumes

## See Also

- [DAX Formatting Scripts](../format-dax/)
- [Display Folders](../display-folders/)
- [Format Strings](../format-strings/)
- [Calculation Groups](../calculation-groups/)
