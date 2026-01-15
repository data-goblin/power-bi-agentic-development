# Hierarchies

Hierarchies in Power BI semantic models provide drill-down navigation paths for users. Each hierarchy belongs to a table and contains ordered levels.


## Accessing Hierarchies

```csharp
// All hierarchies in a table
var hierarchies = Model.Tables["Geography"].Hierarchies;

// Specific hierarchy
var geoHierarchy = Model.Tables["Geography"].Hierarchies["Geography"];

// All hierarchies in model
var allHierarchies = Model.Tables.SelectMany(t => t.Hierarchies);

// Selected hierarchies (IDE only)
var selected = Selected.Hierarchies;
```


## Creating Hierarchies

### Basic Creation

```csharp
var table = Model.Tables["Geography"];

// Create hierarchy with name
var hierarchy = table.AddHierarchy("Geography");

// Add levels in order (top to bottom)
hierarchy.AddLevel(table.Columns["Country"]);
hierarchy.AddLevel(table.Columns["State"]);
hierarchy.AddLevel(table.Columns["City"]);

// Set display folder
hierarchy.DisplayFolder = "Navigation";

Info("Created hierarchy: " + hierarchy.Name);
```

### With Custom Level Names

```csharp
var table = Model.Tables["Date"];
var hierarchy = table.AddHierarchy("Calendar");

// Levels with custom names
var yearLevel = hierarchy.AddLevel(table.Columns["Year"]);
yearLevel.Name = "Year";

var quarterLevel = hierarchy.AddLevel(table.Columns["Quarter"]);
quarterLevel.Name = "Quarter";

var monthLevel = hierarchy.AddLevel(table.Columns["Month"]);
monthLevel.Name = "Month";
```


## Hierarchy Properties

| Property | Type | Description |
|----------|------|-------------|
| `Name` | string | Hierarchy name (unique within table) |
| `Table` | Table | Parent table |
| `Levels` | LevelCollection | Ordered collection of levels |
| `DisplayFolder` | string | Display folder path |
| `Description` | string | Documentation |
| `IsHidden` | bool | Hide from client tools |
| `InPerspective[name]` | bool | Perspective membership |
| `TranslatedNames[culture]` | string | Localized name |
| `TranslatedDisplayFolders[culture]` | string | Localized folder |


## Working with Levels

### Level Properties

| Property | Type | Description |
|----------|------|-------------|
| `Name` | string | Level display name |
| `Column` | Column | Source column |
| `Ordinal` | int | Position (0 = top) |
| `Hierarchy` | Hierarchy | Parent hierarchy |

### Reordering Levels

```csharp
var hierarchy = Model.Tables["Date"].Hierarchies["Calendar"];

// Change ordinal to reorder
foreach(var level in hierarchy.Levels) {
    if(level.Name == "Month") {
        level.Ordinal = 0;  // Move to top
    }
}
```

### Adding/Removing Levels

```csharp
var hierarchy = Model.Tables["Date"].Hierarchies["Calendar"];

// Add level at specific position
var weekLevel = hierarchy.AddLevel(Model.Tables["Date"].Columns["Week"]);
weekLevel.Ordinal = 2;  // Insert after Month

// Remove a level
hierarchy.Levels["Quarter"].Delete();
```


## Common Patterns

### Create Date Hierarchy

```csharp
var dateTable = Model.Tables["Date"];
var calendarHierarchy = dateTable.AddHierarchy("Calendar");

// Standard date drill-down
calendarHierarchy.AddLevel(dateTable.Columns["Year"]);
calendarHierarchy.AddLevel(dateTable.Columns["Quarter"]);
calendarHierarchy.AddLevel(dateTable.Columns["Month"]);
calendarHierarchy.AddLevel(dateTable.Columns["Day"]);

calendarHierarchy.DisplayFolder = "Hierarchies";
```

### Create Fiscal Hierarchy

```csharp
var dateTable = Model.Tables["Date"];
var fiscalHierarchy = dateTable.AddHierarchy("Fiscal");

fiscalHierarchy.AddLevel(dateTable.Columns["Fiscal Year"]);
fiscalHierarchy.AddLevel(dateTable.Columns["Fiscal Quarter"]);
fiscalHierarchy.AddLevel(dateTable.Columns["Fiscal Month"]);

fiscalHierarchy.DisplayFolder = "Hierarchies";
```

### Create Product Category Hierarchy

```csharp
var productTable = Model.Tables["Product"];
var categoryHierarchy = productTable.AddHierarchy("Product Category");

categoryHierarchy.AddLevel(productTable.Columns["Category"]);
categoryHierarchy.AddLevel(productTable.Columns["Subcategory"]);
categoryHierarchy.AddLevel(productTable.Columns["Product Name"]);
```

### Audit All Hierarchies

```csharp
foreach(var table in Model.Tables) {
    foreach(var hierarchy in table.Hierarchies) {
        var levels = string.Join(" > ",
            hierarchy.Levels.OrderBy(l => l.Ordinal).Select(l => l.Name));
        Info($"{table.Name}.{hierarchy.Name}: {levels}");
    }
}
```

### Hide Source Columns

```csharp
// Hide columns that are only used in hierarchies
foreach(var table in Model.Tables) {
    foreach(var hierarchy in table.Hierarchies) {
        foreach(var level in hierarchy.Levels) {
            // Only hide if column not used elsewhere
            var col = level.Column;
            if(!Model.AllMeasures.Any(m => m.Expression.Contains(col.DaxObjectFullName))) {
                col.IsHidden = true;
            }
        }
    }
}
```


## Delete Operations

```csharp
// Delete specific hierarchy
Model.Tables["Geography"].Hierarchies["Geography"].Delete();

// Delete all hierarchies in a table
foreach(var h in Model.Tables["Geography"].Hierarchies.ToList()) {
    h.Delete();
}
```


## Best Practices

1. **Name levels clearly** - Use descriptive names even if different from column names
2. **Order logically** - Top-down from general to specific
3. **Hide source columns** - If columns are only for hierarchy navigation
4. **Use display folders** - Group hierarchies in "Hierarchies" or "Navigation" folders
5. **Add descriptions** - Document the purpose and expected drill-down behavior
6. **Consider perspectives** - Include/exclude hierarchies as appropriate
