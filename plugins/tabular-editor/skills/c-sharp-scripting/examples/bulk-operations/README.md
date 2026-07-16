# Bulk Operations Scripts

Scripts for performing batch operations across multiple model objects.

## Available Scripts

- `add-format-strings.csx` - Interactive dialog to apply custom format strings to selected measures
- `add-measure-selection.csx` - Bulk add measures based on selection criteria
- `add-time-intelligence.csx` - Bulk create time intelligence measures
- `add_descriptions_to_all.csx` - Add descriptions to all model objects
- `add_expression_to_descriptions.csx` - Append DAX expressions to measure descriptions
- `clean_object_names.csx` - Convert CamelCase names to Proper Case with spaces
- `create_measures_from_columns.csx` - Generate measures from numeric columns
- `initialize_model.csx` - Initialize new model with common setup tasks
- `sync_folders_from_names.csx` - Sync display folders based on naming patterns
- `update_descriptions_from_comments.csx` - Extract DAX comments to descriptions
- `validate_and_fix_issues.csx` - Validate model and fix common issues

## Usage Examples

### Execute Inline
```bash
te script "model.bim" -e 'foreach(var m in Model.AllMeasures) { m.Description = m.Expression; }' --save
```

### Execute Script File
```bash
te script "model.bim" -S samples/bulk-operations/clean_object_names.csx --save
te script -s "Production" -d "Sales" -S samples/bulk-operations/initialize_model.csx --save
```

### With Fabric CLI Workflow
```bash
# Export model
fab export "Workspace/Model.SemanticModel" -o ./model -f

# Run bulk operations
te script "./model/Model.SemanticModel/definition" -S samples/bulk-operations/clean_object_names.csx --save
te script "./model/Model.SemanticModel/definition" -S samples/bulk-operations/add_descriptions_to_all.csx --save

# Import back
fab import "Workspace/Model.SemanticModel" -i ./model/Model.SemanticModel -f
```

## Common Patterns

### Clean All Object Names
```csharp
#r "System.Text.RegularExpressions"
var rex = new System.Text.RegularExpressions.Regex("(^[a-z]+|[A-Z]+(?![a-z])|[A-Z][a-z]+)");

foreach (var tbl in Model.Tables) {
    if (!tbl.Name.Contains(" ")) {
        var words = rex.Matches(tbl.Name)
            .OfType<System.Text.RegularExpressions.Match>()
            .Select(m => char.ToUpper(m.Value.First()) + m.Value.Substring(1))
            .ToArray();
        tbl.Name = string.Join(" ", words);
    }
}
```

### Initialize Model Setup
```csharp
// Hide key columns and disable summarization
foreach(var table in Model.Tables) {
    foreach(var column in table.Columns) {
        if(column.Name.Contains("Key") || column.Name.EndsWith("ID")) {
            column.IsHidden = true;
        }
        column.SummarizeBy = AggregateFunction.None;
    }
}
```

### Add Descriptions to All Objects
```csharp
// Add descriptions to measures
foreach(var measure in Model.AllMeasures) {
    if(string.IsNullOrEmpty(measure.Description)) {
        measure.Description = "Measure: " + measure.Name;
    }
}

// Add descriptions to columns
foreach(var column in Model.AllColumns) {
    if(string.IsNullOrEmpty(column.Description)) {
        column.Description = "Column: " + column.Name;
    }
}
```

### Sync Display Folders from Names
```csharp
// Extract folder from naming pattern (e.g., "Sales - Revenue" -> "Sales")
foreach(var measure in Model.AllMeasures) {
    if(measure.Name.Contains(" - ")) {
        var parts = measure.Name.Split(new[] { " - " }, 2, StringSplitOptions.None);
        measure.DisplayFolder = parts[0];
    }
}
```

## Property Reference

### Common Properties for Bulk Operations
- `Model.AllMeasures` - All measures in the model
- `Model.AllColumns` - All columns in the model
- `Model.AllTables` - All tables in the model
- `Selected.Measures` - Currently selected measures
- `Selected.Columns` - Currently selected columns
- `Selected.Tables` - Currently selected tables

### Object Properties
- `Name` - Object name
- `Description` - Object description
- `DisplayFolder` - Display folder path
- `IsHidden` - Visibility flag
- `Expression` - DAX expression (measures, calculated columns)
- `FormatString` - Number format

## Best Practices

1. **Backup First**
   - Always save a backup before bulk operations
   - Test on a copy of the model first
   - Use version control for model files

2. **Use Filters**
   - Filter objects before bulk operations
   - Use LINQ Where() clauses to target specific objects
   - Validate selection before making changes

3. **Logging**
   - Use Info() to report what was changed
   - Count affected objects and display summary
   - Log errors with Error() for troubleshooting

4. **Performance**
   - Process large models in batches if needed
   - Disable refresh during bulk operations
   - Use Selected.* when possible instead of Model.All*

## See Also

- [Measures](../measures/)
- [Columns](../columns/)
- [Display Folders](../display-folders/)
- [Format Strings](../format-strings/)
