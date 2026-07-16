# Perspectives Scripts

Scripts for managing perspectives (simplified views) in Tabular models.

## Available Scripts

- `add-perspective.csx` - Create a new perspective
- `delete-perspective.csx` - Remove a perspective
- `list-perspectives.csx` - List all perspectives in the model
- `modify-perspective.csx` - Update perspective membership

## Usage Examples

### Execute Inline
```bash
te script "model.bim" -e 'var p = Model.AddPerspective("Sales View"); p.SetActive(Model.Tables["Sales"], true);' --save
```

### Execute Script File
```bash
te script "model.bim" -S samples/perspectives/add-perspective.csx --save
te script -s "Production" -d "Sales" -S samples/perspectives/list-perspectives.csx
```

### With Fabric CLI Workflow
```bash
# Export model
fab export "Workspace/Model.SemanticModel" -o ./model -f

# Create perspectives
te script "./model/Model.SemanticModel/definition" -S samples/perspectives/add-perspective.csx --save

# Import back
fab import "Workspace/Model.SemanticModel" -i ./model/Model.SemanticModel -f
```

## Common Patterns

### Create Perspective
```csharp
// Create new perspective
var perspective = Model.AddPerspective("Sales Analysis");

// Add tables to perspective
perspective.SetActive(Model.Tables["Sales"], true);
perspective.SetActive(Model.Tables["Customer"], true);
perspective.SetActive(Model.Tables["Product"], true);
perspective.SetActive(Model.Tables["Date"], true);
```

### Add Specific Columns/Measures
```csharp
var perspective = Model.Perspectives["Sales Analysis"];

// Add specific measures
foreach(var measure in Model.Tables["Sales"].Measures) {
    if(!measure.Name.StartsWith("_")) {
        perspective.SetActive(measure, true);
    }
}

// Add specific columns
foreach(var column in Model.Tables["Customer"].Columns) {
    if(!column.IsHidden) {
        perspective.SetActive(column, true);
    }
}
```

### List All Perspectives
```csharp
foreach(var perspective in Model.Perspectives) {
    Info($"Perspective: {perspective.Name}");

    // Count objects in perspective
    var tableCount = Model.Tables.Count(t => perspective.IsActive(t));
    Info($"  Tables: {tableCount}");
}
```

### Delete Perspective
```csharp
var perspective = Model.Perspectives["Sales Analysis"];
if(perspective != null) {
    perspective.Delete();
    Info("Deleted perspective");
}
```

### Create Department-Specific Perspective
```csharp
var salesPerspective = Model.AddPerspective("Sales Department");

// Add all tables with "Sales" in name
foreach(var table in Model.Tables.Where(t => t.Name.Contains("Sales"))) {
    salesPerspective.SetActive(table, true);
}

// Add all measures in Sales table
foreach(var measure in Model.Tables["Sales"].Measures) {
    salesPerspective.SetActive(measure, true);
}

// Add Date table for time analysis
salesPerspective.SetActive(Model.Tables["Date"], true);
```

## Property Reference

### Perspective Properties
- `Name` - Perspective name
- `Description` - Perspective description
- `IsActive(object)` - Check if object is in perspective
- `SetActive(object, active)` - Add/remove object from perspective

### Objects That Support Perspectives
- Tables
- Columns
- Measures
- Hierarchies
- Calculation items

## Common Use Cases

### Sales Perspective
```csharp
var sales = Model.AddPerspective("Sales");

// Core sales tables
sales.SetActive(Model.Tables["Sales"], true);
sales.SetActive(Model.Tables["Customer"], true);
sales.SetActive(Model.Tables["Product"], true);
sales.SetActive(Model.Tables["Date"], true);

// Key sales measures
foreach(var m in Model.AllMeasures.Where(m =>
    m.Name.Contains("Sales") ||
    m.Name.Contains("Revenue"))) {
    sales.SetActive(m, true);
}
```

### Finance Perspective
```csharp
var finance = Model.AddPerspective("Finance");

// Finance tables
finance.SetActive(Model.Tables["GL"], true);
finance.SetActive(Model.Tables["Budget"], true);
finance.SetActive(Model.Tables["Account"], true);
finance.SetActive(Model.Tables["Date"], true);

// Finance measures
foreach(var m in Model.AllMeasures.Where(m =>
    m.Name.Contains("Cost") ||
    m.Name.Contains("Expense") ||
    m.Name.Contains("Budget"))) {
    finance.SetActive(m, true);
}
```

### Executive Dashboard Perspective
```csharp
var executive = Model.AddPerspective("Executive Dashboard");

// Only summary tables
executive.SetActive(Model.Tables["KPI"], true);
executive.SetActive(Model.Tables["Summary"], true);
executive.SetActive(Model.Tables["Date"], true);

// Only high-level measures
foreach(var m in Model.AllMeasures.Where(m =>
    !m.Name.StartsWith("_") &&
    m.DisplayFolder.Contains("Executive"))) {
    executive.SetActive(m, true);
}
```

## Best Practices

1. **Purpose-Driven**
   - Create perspectives for specific audiences
   - Group related objects logically
   - Keep perspectives simple and focused

2. **Naming**
   - Use clear, descriptive names
   - Match user/department terminology
   - Document perspective purpose

3. **Maintenance**
   - Update perspectives when adding objects
   - Review regularly for relevance
   - Remove unused perspectives

4. **Organization**
   - Don't duplicate efforts with RLS
   - Use perspectives for UI simplification
   - Use RLS for security

5. **User Experience**
   - Include Date table in all perspectives
   - Include related tables together
   - Don't hide critical context

## Perspectives vs. RLS

| Feature | Perspectives | Row-Level Security (RLS) |
|---------|-------------|-------------------------|
| Purpose | Simplify UI | Secure data |
| Security | No | Yes |
| User Selection | Manual | Automatic by role |
| Object Visibility | Hide/show tables | All tables visible |
| Data Filtering | None | Row-level filters |
| Use Case | Different audiences | Data security |

## See Also

- [Roles](../roles/)
- [Tables](../tables/)
- [Measures](../measures/)
