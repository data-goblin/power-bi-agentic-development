# Relationships Scripts

Scripts for managing relationships between tables in Tabular models.

## Available Scripts

- `add-relationship.csx` - Create a new relationship
- `modify-relationship-properties.csx` - Update relationship properties
- `test-relationship-integrity.csx` - Validate referential integrity
- `find-ri-violations.csx` - Find referential integrity violations
- `create-relationships-by-naming-convention.csx` - Auto-create relationships based on column names

## Usage Examples

### Execute Inline
```bash
te script "model.bim" -e 'Model.AddRelationship().FromColumn = Model.Tables["Sales"].Columns["ProductKey"]; Model.Relationships.Last().ToColumn = Model.Tables["Product"].Columns["ProductKey"];' --save
```

### Execute Script File
```bash
te script "model.bim" -S samples/relationships/add-relationship.csx --save
te script -s "Production" -d "Sales" -S samples/relationships/create-relationships-by-naming-convention.csx --save
```

### With Fabric CLI Workflow
```bash
# Export model
fab export "Workspace/Model.SemanticModel" -o ./model -f

# Create relationships
te script "./model/Model.SemanticModel/definition" -S samples/relationships/add-relationship.csx --save

# Import back
fab import "Workspace/Model.SemanticModel" -i ./model/Model.SemanticModel -f
```

## Common Patterns

### Create Simple Relationship
```csharp
var relationship = Model.AddRelationship();
relationship.FromColumn = Model.Tables["Sales"].Columns["ProductKey"];
relationship.ToColumn = Model.Tables["Product"].Columns["ProductKey"];
relationship.FromCardinality = RelationshipEndCardinality.Many;
relationship.ToCardinality = RelationshipEndCardinality.One;
relationship.IsActive = true;
```

### Create Inactive Relationship
```csharp
var relationship = Model.AddRelationship();
relationship.FromColumn = Model.Tables["Sales"].Columns["ShipDateKey"];
relationship.ToColumn = Model.Tables["Date"].Columns["DateKey"];
relationship.IsActive = false;  // For role-playing dimensions
relationship.CrossFilteringBehavior = CrossFilteringBehavior.OneDirection;
```

### Auto-Create by Naming Convention
```csharp
// Find columns ending with "Key" and match to tables
foreach(var factTable in Model.Tables.Where(t => t.Name.StartsWith("Fact"))) {
    foreach(var column in factTable.Columns.Where(c => c.Name.EndsWith("Key"))) {
        // Extract dimension table name
        var dimTableName = column.Name.Replace("Key", "");
        var dimTable = Model.Tables.FirstOrDefault(t => t.Name == dimTableName);

        if(dimTable != null) {
            var dimKey = dimTable.Columns.FirstOrDefault(c => c.Name == column.Name || c.Name == dimTableName + "Key");

            if(dimKey != null && !Model.Relationships.Any(r =>
                r.FromColumn == column && r.ToColumn == dimKey)) {
                var rel = Model.AddRelationship();
                rel.FromColumn = column;
                rel.ToColumn = dimKey;
                Info($"Created: {factTable.Name}[{column.Name}] -> {dimTable.Name}[{dimKey.Name}]");
            }
        }
    }
}
```

### Modify Relationship Properties
```csharp
var relationship = Model.Relationships.First(r =>
    r.FromTable.Name == "Sales" &&
    r.ToTable.Name == "Product");

relationship.CrossFilteringBehavior = CrossFilteringBehavior.BothDirections;
relationship.SecurityFilteringBehavior = SecurityFilteringBehavior.BothDirections;
relationship.IsActive = true;
```

### Find Relationships for Table
```csharp
var tableName = "Sales";

// Outgoing relationships (from this table)
var outgoing = Model.Relationships.Where(r => r.FromTable.Name == tableName);
foreach(var rel in outgoing) {
    Info($"{rel.FromTable.Name}[{rel.FromColumn.Name}] -> {rel.ToTable.Name}[{rel.ToColumn.Name}]");
}

// Incoming relationships (to this table)
var incoming = Model.Relationships.Where(r => r.ToTable.Name == tableName);
foreach(var rel in incoming) {
    Info($"{rel.FromTable.Name}[{rel.FromColumn.Name}] -> {rel.ToTable.Name}[{rel.ToColumn.Name}]");
}
```

## Property Reference

### Relationship Properties
- `FromColumn` - Source column (many side)
- `ToColumn` - Target column (one side)
- `FromTable` - Source table
- `ToTable` - Target table
- `FromCardinality` - Source cardinality (Many, One, None)
- `ToCardinality` - Target cardinality (One, Many, None)
- `IsActive` - Active/inactive status
- `CrossFilteringBehavior` - OneDirection, BothDirections, Automatic
- `SecurityFilteringBehavior` - OneDirection, BothDirections, None
- `RelyOnReferentialIntegrity` - Assume referential integrity flag

### Cardinality Types
- `RelationshipEndCardinality.Many` - Many side (*)
- `RelationshipEndCardinality.One` - One side (1)
- `RelationshipEndCardinality.None` - No cardinality

### Cross Filtering Behavior
- `CrossFilteringBehavior.OneDirection` - Single direction (default)
- `CrossFilteringBehavior.BothDirections` - Bi-directional
- `CrossFilteringBehavior.Automatic` - Let engine decide

### Security Filtering Behavior
- `SecurityFilteringBehavior.OneDirection` - Filter one way
- `SecurityFilteringBehavior.BothDirections` - Filter both ways
- `SecurityFilteringBehavior.None` - No security filtering

## Best Practices

1. **Cardinality**
   - Always set correct cardinality
   - Many-to-one is most common
   - Avoid many-to-many when possible

2. **Active Relationships**
   - Only one active relationship per column pair
   - Use inactive for role-playing dimensions
   - Activate via USERELATIONSHIP() in DAX

3. **Cross Filtering**
   - Avoid bi-directional unless necessary
   - Can cause performance issues
   - Can create ambiguous paths

4. **Referential Integrity**
   - Enable for DirectQuery performance
   - Only when data guarantees integrity
   - Test thoroughly

5. **Naming Conventions**
   - Use consistent key column names
   - Suffix with "Key" or "ID"
   - Makes auto-creation easier

## Common Relationship Patterns

### Star Schema
```csharp
// Fact table in center, dimension tables around it
var sales = Model.Tables["Sales"];
var product = Model.Tables["Product"];
var customer = Model.Tables["Customer"];
var date = Model.Tables["Date"];

// Sales -> Product
var rel1 = Model.AddRelationship();
rel1.FromColumn = sales.Columns["ProductKey"];
rel1.ToColumn = product.Columns["ProductKey"];

// Sales -> Customer
var rel2 = Model.AddRelationship();
rel2.FromColumn = sales.Columns["CustomerKey"];
rel2.ToColumn = customer.Columns["CustomerKey"];

// Sales -> Date
var rel3 = Model.AddRelationship();
rel3.FromColumn = sales.Columns["DateKey"];
rel3.ToColumn = date.Columns["DateKey"];
```

### Role-Playing Dimensions
```csharp
// Multiple date relationships
var sales = Model.Tables["Sales"];
var date = Model.Tables["Date"];

// Active relationship for order date
var orderDate = Model.AddRelationship();
orderDate.FromColumn = sales.Columns["OrderDateKey"];
orderDate.ToColumn = date.Columns["DateKey"];
orderDate.IsActive = true;

// Inactive relationship for ship date
var shipDate = Model.AddRelationship();
shipDate.FromColumn = sales.Columns["ShipDateKey"];
shipDate.ToColumn = date.Columns["DateKey"];
shipDate.IsActive = false;

// Use in DAX: CALCULATE([Sales], USERELATIONSHIP(Sales[ShipDateKey], Date[DateKey]))
```

### Bridge Tables
```csharp
// Many-to-many via bridge
var sales = Model.Tables["Sales"];
var bridge = Model.Tables["SalesTerritory_Bridge"];
var territory = Model.Tables["Territory"];

// Sales -> Bridge (many-to-one)
var rel1 = Model.AddRelationship();
rel1.FromColumn = sales.Columns["TerritoryKey"];
rel1.ToColumn = bridge.Columns["TerritoryKey"];

// Bridge -> Territory (many-to-one)
var rel2 = Model.AddRelationship();
rel2.FromColumn = bridge.Columns["ActualTerritoryKey"];
rel2.ToColumn = territory.Columns["TerritoryKey"];
```

## See Also

- [Tables](../tables/)
- [Columns](../columns/)
- [Model](../model/)
