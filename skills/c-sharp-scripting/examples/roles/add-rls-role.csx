// Name: Add RLS Role
// Context: Model
// Description: Creates a security role with Row-Level Security filter

// Configuration
var roleName = "SalesRegion";
var description = "Users filtered by their sales region";
var tableName = "Sales";
var filterExpression = "[Region] = USERPRINCIPALNAME()";

// Validation
if(Model.Roles.Contains(roleName)) {
    Error("Role already exists: " + roleName);
}

if(!Model.Tables.Contains(tableName)) {
    Error("Table not found: " + tableName);
}

// Create role
var role = Model.AddRole(roleName);
role.ModelPermission = ModelPermission.Read;
role.Description = description;

// Add table filter (RLS)
role.TablePermissions.Add(
    new TablePermission {
        Table = Model.Tables[tableName],
        FilterExpression = filterExpression
    }
);

Info("Created role: " + roleName);
Info("RLS filter on " + tableName + ": " + filterExpression);
