// Name: Create Relationships by Naming Convention
// Context: Model
// Description: Auto-creates relationships based on Key column naming patterns

var createdCount = 0;

foreach(var factTable in Model.Tables) {
    foreach(var column in factTable.Columns) {
        // Skip if not a key column
        if(!column.Name.EndsWith("Key") && !column.Name.EndsWith("ID")) continue;

        // Skip if relationship already exists
        if(Model.Relationships.Any(r => r.FromColumn == column)) continue;

        // Derive dimension table name from column name
        var dimTableName = column.Name
            .Replace("Key", "")
            .Replace("ID", "")
            .Replace("Id", "");

        // Try to find matching dimension table
        var dimTable = Model.Tables.FirstOrDefault(t =>
            t.Name == dimTableName ||
            t.Name == "Dim" + dimTableName ||
            t.Name == dimTableName + "Dim"
        );

        if(dimTable == null) continue;

        // Find matching column in dimension table
        var dimColumn = dimTable.Columns.FirstOrDefault(c =>
            c.Name == column.Name ||
            c.Name == dimTableName + "Key" ||
            c.Name == dimTableName + "ID"
        );

        if(dimColumn == null) continue;

        // Create relationship
        var rel = Model.AddRelationship();
        rel.FromColumn = column;
        rel.ToColumn = dimColumn;
        rel.FromCardinality = RelationshipEndCardinality.Many;
        rel.ToCardinality = RelationshipEndCardinality.One;
        rel.IsActive = true;

        createdCount++;
        Info("Created: " + factTable.Name + "[" + column.Name + "] -> " +
             dimTable.Name + "[" + dimColumn.Name + "]");
    }
}

Info("Created " + createdCount + " relationships");
