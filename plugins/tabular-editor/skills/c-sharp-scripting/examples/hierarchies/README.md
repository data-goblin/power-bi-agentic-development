# Hierarchies Scripts

Scripts for managing hierarchies in Tabular models.

## Available Scripts

- `add-hierarchy.csx` - Create a new hierarchy
- `delete-hierarchy.csx` - Remove a hierarchy
- `list-hierarchies.csx` - List all hierarchies in the model
- `modify-hierarchy.csx` - Update hierarchy properties

## Usage Examples

### Execute Inline
```bash
te script "model.bim" -e 'var h = Model.Tables["Geography"].AddHierarchy("Geography Hierarchy"); h.AddLevel("Country"); h.AddLevel("State"); h.AddLevel("City");' --save
```

### Execute Script File
```bash
te script "model.bim" -S samples/hierarchies/add-hierarchy.csx --save
te script -s "Production" -d "Sales" -S samples/hierarchies/list-hierarchies.csx
```

### With Fabric CLI Workflow
```bash
# Export model
fab export "Workspace/Model.SemanticModel" -o ./model -f

# Create hierarchies
te script "./model/Model.SemanticModel/definition" -S samples/hierarchies/add-hierarchy.csx --save

# Import back
fab import "Workspace/Model.SemanticModel" -i ./model/Model.SemanticModel -f
```

## Common Patterns

### Create Simple Hierarchy
```csharp
var table = Model.Tables["Date"];
var hierarchy = table.AddHierarchy("Calendar Hierarchy");

hierarchy.AddLevel("Year", "Year");
hierarchy.AddLevel("Quarter", "Quarter");
hierarchy.AddLevel("Month", "Month Name");
hierarchy.AddLevel("Day", "Date");
```

### Create Geography Hierarchy
```csharp
var geo = Model.Tables["Geography"];
var hierarchy = geo.AddHierarchy("Geography");

hierarchy.AddLevel("Country", "Country");
hierarchy.AddLevel("State/Province", "State");
hierarchy.AddLevel("City", "City");
hierarchy.AddLevel("Postal Code", "PostalCode");
```

### List All Hierarchies
```csharp
foreach(var table in Model.Tables) {
    foreach(var hierarchy in table.Hierarchies) {
        Info($"Hierarchy: {hierarchy.Name} in {table.Name}");
        foreach(var level in hierarchy.Levels) {
            Info($"  Level: {level.Name} -> {level.Column.Name}");
        }
    }
}
```

### Delete Hierarchy
```csharp
var hierarchy = Model.Tables["Date"].Hierarchies["Calendar Hierarchy"];
if(hierarchy != null) {
    hierarchy.Delete();
    Info("Deleted hierarchy");
}
```

### Modify Hierarchy Levels
```csharp
var hierarchy = Model.Tables["Date"].Hierarchies["Calendar"];

// Add new level
hierarchy.AddLevel("Week", "Week Number");

// Remove level
var level = hierarchy.Levels["Day"];
if(level != null) {
    level.Delete();
}

// Reorder levels by setting Ordinal
hierarchy.Levels["Year"].Ordinal = 0;
hierarchy.Levels["Quarter"].Ordinal = 1;
hierarchy.Levels["Month"].Ordinal = 2;
```

## Property Reference

### Hierarchy Properties
- `Name` - Hierarchy name
- `Description` - Hierarchy description
- `IsHidden` - Visibility flag
- `Levels` - Collection of hierarchy levels
- `AddLevel(name, columnName)` - Add a level to hierarchy

### Level Properties
- `Name` - Level name
- `Ordinal` - Position in hierarchy (0-based)
- `Column` - Column reference
- `Description` - Level description

## Common Hierarchy Types

### Date Hierarchies
```csharp
// Fiscal Year Hierarchy
var fiscal = dateTable.AddHierarchy("Fiscal Hierarchy");
fiscal.AddLevel("Fiscal Year", "Fiscal Year");
fiscal.AddLevel("Fiscal Quarter", "Fiscal Quarter");
fiscal.AddLevel("Fiscal Month", "Fiscal Month");

// Calendar Hierarchy
var calendar = dateTable.AddHierarchy("Calendar");
calendar.AddLevel("Year", "Year");
calendar.AddLevel("Month", "Month Name");
calendar.AddLevel("Date", "Date");
```

### Product Hierarchies
```csharp
var products = Model.Tables["Product"];
var hierarchy = products.AddHierarchy("Product Category");

hierarchy.AddLevel("Category", "Category");
hierarchy.AddLevel("Subcategory", "Subcategory");
hierarchy.AddLevel("Product", "Product Name");
```

### Organization Hierarchies
```csharp
var org = Model.Tables["Organization"];
var hierarchy = org.AddHierarchy("Org Structure");

hierarchy.AddLevel("Division", "Division");
hierarchy.AddLevel("Department", "Department");
hierarchy.AddLevel("Team", "Team");
hierarchy.AddLevel("Employee", "Employee Name");
```

## Best Practices

1. **Hierarchy Design**
   - Create natural drill paths
   - Order levels from high to low granularity
   - Use meaningful level names

2. **Column Selection**
   - Use columns with proper cardinality
   - Ensure parent-child relationships exist
   - Avoid skipped levels in data

3. **Naming**
   - Use clear, descriptive names
   - Follow consistent conventions
   - Match user terminology

4. **Testing**
   - Verify drill-down/up works correctly
   - Test with actual data
   - Check performance with large datasets

## See Also

- [Columns](../columns/)
- [Tables](../tables/)
- [Display Folders](../display-folders/)
