# Relationships

Relationships connect tables and enable filter propagation across the model.

## Key Properties

| Property | Type | Description |
|----------|------|-------------|
| `FromTable` | Table | Source table (many side) |
| `FromColumn` | Column | Source column |
| `ToTable` | Table | Target table (one side) |
| `ToColumn` | Column | Target column |
| `FromCardinality` | RelationshipEndCardinality | Source cardinality (One/Many) |
| `ToCardinality` | RelationshipEndCardinality | Target cardinality (One/Many) |
| `CrossFilteringBehavior` | CrossFilteringBehavior | Filter direction |
| `IsActive` | bool | Whether relationship is active |
| `SecurityFilteringBehavior` | SecurityFilteringBehavior | RLS filter propagation |
| `Name` | string | Auto-generated relationship name |

## Cardinality Values

| Value | Description |
|-------|-------------|
| `One` | One side of relationship |
| `Many` | Many side of relationship |

## Cross Filtering Behavior

| Value | Description |
|-------|-------------|
| `SingleDirection` | Filters from one to many only |
| `BothDirections` | Bidirectional filtering |

## Security Filtering Behavior

| Value | Description |
|-------|-------------|
| `OneDirection` | RLS filters in single direction |
| `BothDirections` | RLS filters bidirectionally |
| `None` | No RLS filter propagation |

## Common Methods

| Method | Description |
|--------|-------------|
| `Model.AddRelationship()` | Create new relationship |
| `Relationship.Delete()` | Remove relationship |

## Access Patterns

```csharp
// All relationships
foreach(var rel in Model.Relationships) { }

// Find by tables
var rel = Model.Relationships.FirstOrDefault(r =>
    r.FromTable.Name == "Sales" && r.ToTable.Name == "Product"
);

// Relationships for a table
var tableRels = Model.Relationships.Where(r =>
    r.FromTable == table || r.ToTable == table
);
```

## CRUD Operations

### Create Relationship
```csharp
var rel = Model.AddRelationship();
rel.FromColumn = Model.Tables["Sales"].Columns["ProductKey"];
rel.ToColumn = Model.Tables["Product"].Columns["ProductKey"];
rel.FromCardinality = RelationshipEndCardinality.Many;
rel.ToCardinality = RelationshipEndCardinality.One;
rel.CrossFilteringBehavior = CrossFilteringBehavior.SingleDirection;
rel.IsActive = true;
```

### Modify Properties
```csharp
// Enable bidirectional filtering
rel.CrossFilteringBehavior = CrossFilteringBehavior.BothDirections;

// Deactivate relationship
rel.IsActive = false;

// Configure RLS behavior
rel.SecurityFilteringBehavior = SecurityFilteringBehavior.BothDirections;
```

### Delete
```csharp
rel.Delete();
```

## Common Patterns

### List All Relationships
```csharp
foreach(var rel in Model.Relationships) {
    var direction = rel.CrossFilteringBehavior == CrossFilteringBehavior.BothDirections ? "<->" : "->";
    var active = rel.IsActive ? "" : " [INACTIVE]";
    Info($"{rel.FromTable.Name}[{rel.FromColumn.Name}] {direction} {rel.ToTable.Name}[{rel.ToColumn.Name}]{active}");
}
```

### Find Inactive Relationships
```csharp
var inactive = Model.Relationships.Where(r => !r.IsActive);
foreach(var rel in inactive) {
    Info($"Inactive: {rel.FromTable.Name} -> {rel.ToTable.Name}");
}
```

### Find Bidirectional Relationships
```csharp
var bidir = Model.Relationships.Where(r =>
    r.CrossFilteringBehavior == CrossFilteringBehavior.BothDirections
);
foreach(var rel in bidir) {
    Info($"Bidirectional: {rel.FromTable.Name} <-> {rel.ToTable.Name}");
}
```

### Create Relationships by Naming Convention
```csharp
// Find matching columns by name
foreach(var factTable in Model.Tables.Where(t => t.Name.StartsWith("Fact"))) {
    foreach(var col in factTable.Columns.Where(c => c.Name.EndsWith("Key"))) {
        var dimName = col.Name.Replace("Key", "");
        var dimTable = Model.Tables.FirstOrDefault(t => t.Name == "Dim" + dimName);

        if(dimTable != null && dimTable.Columns.Contains(col.Name)) {
            var exists = Model.Relationships.Any(r =>
                r.FromColumn == col && r.ToColumn == dimTable.Columns[col.Name]
            );

            if(!exists) {
                var rel = Model.AddRelationship();
                rel.FromColumn = col;
                rel.ToColumn = dimTable.Columns[col.Name];
                rel.FromCardinality = RelationshipEndCardinality.Many;
                rel.ToCardinality = RelationshipEndCardinality.One;
                Info($"Created: {factTable.Name}[{col.Name}] -> {dimTable.Name}[{col.Name}]");
            }
        }
    }
}
```

### Audit Relationship Integrity
```csharp
foreach(var rel in Model.Relationships.Where(r => r.IsActive)) {
    var daxCheck = $@"
COUNTROWS(
    FILTER(
        {rel.FromTable.DaxObjectFullName},
        ISBLANK(RELATED({rel.ToColumn.DaxObjectFullName}))
    )
)";
    var violations = EvaluateDax(daxCheck);
    if(Convert.ToInt64(violations) > 0) {
        Warning($"RI violation: {rel.FromTable.Name}[{rel.FromColumn.Name}] has {violations} orphan keys");
    }
}
```

## Best Practices

1. **Use single-direction filtering** - Unless bidirectional is explicitly needed
2. **Limit bidirectional relationships** - Can cause performance and ambiguity issues
3. **Only one active path** - Between any two tables
4. **Name columns consistently** - Enables automated relationship creation
5. **Check referential integrity** - Identify orphan keys
6. **Document inactive relationships** - Explain why they're deactivated

## Reference Examples

See `samples/relationships/` for working examples.
