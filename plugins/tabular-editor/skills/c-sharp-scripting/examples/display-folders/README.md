# Display Folders Scripts

Scripts for organizing objects into display folders in Tabular models.

## Available Scripts

- `clear_all_display_folders.csx` - Remove all display folders from the model
- `clear_display_folders.csx` - Clear display folders for specific objects
- `organize_columns_by_type.csx` - Organize columns into folders by data type
- `organize_folders.csx` - Organize measures into logical folder structure
- `organize_measures_by_type.csx` - Organize measures by type (Base, Time Intelligence, etc.)

## Usage Examples

### Execute Inline
```bash
te script "model.bim" -e 'foreach(var m in Model.AllMeasures.Where(m => m.Name.StartsWith("Total"))) { m.DisplayFolder = "Totals"; }' --save
```

### Execute Script File
```bash
te script "model.bim" -S samples/display-folders/organize_folders.csx --save
te script -s "Production" -d "Sales" -S samples/display-folders/organize_measures_by_type.csx --save
```

### With Fabric CLI Workflow
```bash
# Export model
fab export "Workspace/Model.SemanticModel" -o ./model -f

# Organize folders
te script "./model/Model.SemanticModel/definition" -S samples/display-folders/organize_folders.csx --save

# Import back
fab import "Workspace/Model.SemanticModel" -i ./model/Model.SemanticModel -f
```

## Common Patterns

### Organize by Naming Pattern
```csharp
// Organize measures with prefixes into folders
foreach(var measure in Model.AllMeasures) {
    if(measure.Name.Contains(" - ")) {
        var parts = measure.Name.Split(new[] { " - " }, 2, StringSplitOptions.None);
        measure.DisplayFolder = parts[0];
    }
}
```

### Create Nested Folders
```csharp
// Create nested folder structure
foreach(var measure in Model.AllMeasures) {
    if(measure.Name.StartsWith("YTD")) {
        measure.DisplayFolder = "Time Intelligence\\Year to Date";
    }
    else if(measure.Name.StartsWith("MTD")) {
        measure.DisplayFolder = "Time Intelligence\\Month to Date";
    }
}
```

### Organize Columns by Type
```csharp
foreach(var column in Model.AllColumns) {
    if(column.DataType == DataType.DateTime) {
        column.DisplayFolder = "Dates";
    }
    else if(column.DataType == DataType.String) {
        column.DisplayFolder = "Attributes";
    }
    else if(column.DataType == DataType.Int64 || column.DataType == DataType.Double) {
        column.DisplayFolder = "Numeric";
    }
}
```

### Clear All Display Folders
```csharp
foreach(var measure in Model.AllMeasures) {
    measure.DisplayFolder = "";
}

foreach(var column in Model.AllColumns) {
    column.DisplayFolder = "";
}
```

### Organize by Table
```csharp
// Create folders based on table name
foreach(var measure in Model.AllMeasures) {
    measure.DisplayFolder = measure.Table.Name + "\\Measures";
}
```

## Property Reference

### Display Folder Properties
- `DisplayFolder` - Folder path (use `\\` for nested folders)
- `TranslatedDisplayFolders[culture]` - Translated folder names

### Folder Path Examples
- `"Sales"` - Single folder
- `"Sales\\Revenue"` - Nested folder
- `"Time Intelligence\\YTD"` - Multi-level nesting
- `""` - No folder (root level)

## Best Practices

1. **Use Consistent Structure**
   - Define a standard folder hierarchy
   - Use same structure across tables
   - Document folder conventions

2. **Nested Folders**
   - Use `\\` separator for nested folders
   - Limit nesting depth to 2-3 levels
   - Keep folder names short and clear

3. **Naming Conventions**
   - Use Title Case for folder names
   - Avoid special characters
   - Keep names under 50 characters

4. **Organization Patterns**
   - By subject area (Sales, Finance, HR)
   - By calculation type (Base, Time Intelligence, KPIs)
   - By data type (Dates, Attributes, Metrics)

## Common Folder Structures

### By Calculation Type
```text
Base Measures
Calculated Measures
Time Intelligence
  ├─ YTD
  ├─ MTD
  └─ QTD
KPIs
Ratios
```

### By Subject Area
```text
Sales
  ├─ Revenue
  ├─ Quantity
  └─ Returns
Finance
  ├─ Costs
  ├─ Profit
  └─ Margin
```

### By Data Type
```text
Dates
Attributes
Metrics
Keys (Hidden)
```

## See Also

- [Measures](../measures/)
- [Columns](../columns/)
- [Bulk Operations](../bulk-operations/)
