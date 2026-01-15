# Perspectives

Perspectives provide filtered views of the model, showing only relevant tables, columns, measures, and hierarchies to specific user groups.


## Accessing Perspectives

```csharp
// All perspectives
var perspectives = Model.Perspectives;

// Specific perspective
var perspective = Model.Perspectives["Sales"];

// Check if perspective exists
if(Model.Perspectives.Contains("Sales")) {
    var sales = Model.Perspectives["Sales"];
}
```


## Creating Perspectives

```csharp
// Create new perspective
var perspective = Model.AddPerspective("Sales Analysis");
perspective.Description = "Sales team view with key sales metrics";
```


## Perspective Properties

| Property | Type | Description |
|----------|------|-------------|
| `Name` | string | Perspective name (unique) |
| `Description` | string | Documentation |
| `TranslatedNames[culture]` | string | Localized name |
| `TranslatedDescriptions[culture]` | string | Localized description |


## Adding Objects to Perspectives

Objects have an `InPerspective` property that controls membership.

### Tables

```csharp
// Add table to perspective
Model.Tables["Sales"].InPerspective["Sales Analysis"] = true;

// Remove table from perspective
Model.Tables["InternalMetrics"].InPerspective["Sales Analysis"] = false;
```

### Measures

```csharp
// Add measure
Model.Tables["Sales"].Measures["Revenue"].InPerspective["Sales Analysis"] = true;

// Add all visible measures
foreach(var m in Model.AllMeasures.Where(m => !m.IsHidden)) {
    m.InPerspective["Sales Analysis"] = true;
}
```

### Columns

```csharp
// Add column
Model.Tables["Sales"].Columns["Region"].InPerspective["Sales Analysis"] = true;

// Add all non-hidden columns from a table
foreach(var c in Model.Tables["Sales"].Columns.Where(c => !c.IsHidden)) {
    c.InPerspective["Sales Analysis"] = true;
}
```

### Hierarchies

```csharp
// Add hierarchy
Model.Tables["Geography"].Hierarchies["Geography"].InPerspective["Sales Analysis"] = true;
```


## Common Patterns

### Create Role-Based Perspective

```csharp
var perspectiveName = "Finance Team";
var perspective = Model.AddPerspective(perspectiveName);
perspective.Description = "Finance team view with financial metrics";

// Include specific tables
var includeTables = new[] { "Date", "Finance", "Budget", "Actuals" };
foreach(var tableName in includeTables) {
    if(Model.Tables.Contains(tableName)) {
        var table = Model.Tables[tableName];
        table.InPerspective[perspectiveName] = true;

        // Include all visible columns
        foreach(var c in table.Columns.Where(c => !c.IsHidden)) {
            c.InPerspective[perspectiveName] = true;
        }

        // Include all visible measures
        foreach(var m in table.Measures.Where(m => !m.IsHidden)) {
            m.InPerspective[perspectiveName] = true;
        }

        // Include all hierarchies
        foreach(var h in table.Hierarchies) {
            h.InPerspective[perspectiveName] = true;
        }
    }
}

Info($"Created perspective: {perspectiveName}");
```

### Sync Perspective with Hidden Status

```csharp
// Add all non-hidden objects to a perspective
var perspectiveName = "Public View";

foreach(var table in Model.Tables.Where(t => !t.IsHidden)) {
    table.InPerspective[perspectiveName] = true;

    foreach(var c in table.Columns.Where(c => !c.IsHidden)) {
        c.InPerspective[perspectiveName] = true;
    }

    foreach(var m in table.Measures.Where(m => !m.IsHidden)) {
        m.InPerspective[perspectiveName] = true;
    }

    foreach(var h in table.Hierarchies.Where(h => !h.IsHidden)) {
        h.InPerspective[perspectiveName] = true;
    }
}
```

### Audit Perspective Membership

```csharp
var perspectiveName = "Sales Analysis";

var report = new System.Text.StringBuilder();
report.AppendLine($"Perspective: {perspectiveName}");
report.AppendLine("---");

foreach(var table in Model.Tables) {
    if(table.InPerspective[perspectiveName]) {
        report.AppendLine($"Table: {table.Name}");

        var cols = table.Columns.Where(c => c.InPerspective[perspectiveName]).Count();
        var measures = table.Measures.Where(m => m.InPerspective[perspectiveName]).Count();

        report.AppendLine($"  Columns: {cols}");
        report.AppendLine($"  Measures: {measures}");
    }
}

Output(report.ToString());
```

### Copy Perspective

```csharp
var sourceName = "Sales Analysis";
var targetName = "Sales Analysis - Copy";

var newPerspective = Model.AddPerspective(targetName);
newPerspective.Description = Model.Perspectives[sourceName].Description;

// Copy all memberships
foreach(var table in Model.Tables) {
    table.InPerspective[targetName] = table.InPerspective[sourceName];

    foreach(var c in table.Columns) {
        c.InPerspective[targetName] = c.InPerspective[sourceName];
    }

    foreach(var m in table.Measures) {
        m.InPerspective[targetName] = m.InPerspective[sourceName];
    }

    foreach(var h in table.Hierarchies) {
        h.InPerspective[targetName] = h.InPerspective[sourceName];
    }
}

Info($"Created copy: {targetName}");
```

### Remove Empty Perspectives

```csharp
var emptyPerspectives = new List<string>();

foreach(var perspective in Model.Perspectives) {
    var hasObjects = Model.Tables.Any(t => t.InPerspective[perspective.Name]) ||
                    Model.AllMeasures.Any(m => m.InPerspective[perspective.Name]);

    if(!hasObjects) {
        emptyPerspectives.Add(perspective.Name);
    }
}

foreach(var name in emptyPerspectives) {
    Model.Perspectives[name].Delete();
    Info($"Deleted empty perspective: {name}");
}
```


## Delete Operations

```csharp
// Delete perspective
Model.Perspectives["Old View"].Delete();

// Delete all perspectives
foreach(var p in Model.Perspectives.ToList()) {
    p.Delete();
}
```


## Best Practices

1. **Name perspectives by audience** - "Sales Team", "Finance", "Executive"
2. **Include related objects** - If a measure references a column, include both
3. **Document with descriptions** - Explain what each perspective is for
4. **Keep perspectives synchronized** - When adding new objects, update perspectives
5. **Avoid too many perspectives** - Each requires maintenance
6. **Test in client tools** - Verify perspectives work as expected in Power BI
