# Roles Scripts

Scripts for managing security roles and row-level security (RLS) in Tabular models.

## Available Scripts

- `add-role.csx` - Create a new security role
- `add-role-members.csx` - Add members to a role
- `delete-role.csx` - Remove a security role
- `list-roles.csx` - List all roles in the model
- `modify-role.csx` - Update role properties
- `configure-rls.csx` - Configure row-level security filters
- `configure-ols.csx` - Configure object-level security

## Usage Examples

### Execute Inline
```bash
te script "model.bim" -e 'var role = Model.AddRole("Sales Team"); role.ModelPermission = ModelPermission.Read;' --save
```

### Execute Script File
```bash
te script "model.bim" -S samples/roles/add-role.csx --save
te script -s "Production" -d "Sales" -S samples/roles/configure-rls.csx --save
```

### With Fabric CLI Workflow
```bash
# Export model
fab export "Workspace/Model.SemanticModel" -o ./model -f

# Configure roles
te script "./model/Model.SemanticModel/definition" -S samples/roles/add-role.csx --save
te script "./model/Model.SemanticModel/definition" -S samples/roles/configure-rls.csx --save

# Import back
fab import "Workspace/Model.SemanticModel" -i ./model/Model.SemanticModel -f
```

## Common Patterns

### Create Role with RLS
```csharp
// Create role
var role = Model.AddRole("Sales Team");
role.ModelPermission = ModelPermission.Read;

// Add RLS filter on Sales table
var tablePermission = role.TablePermissions[Model.Tables["Sales"]];
tablePermission.FilterExpression = "[Region] = \"West\"";
```

### Add Role Members
```csharp
var role = Model.Roles["Sales Team"];

// Add individual members
role.Members.Add(new ModelRoleMember {
    MemberName = "user@contoso.com"
});

role.Members.Add(new ModelRoleMember {
    MemberName = "DOMAIN\\SalesGroup"
});
```

### Configure Dynamic RLS
```csharp
var role = Model.AddRole("Regional Sales");
role.ModelPermission = ModelPermission.Read;

// Dynamic filter based on USERNAME()
var tablePermission = role.TablePermissions[Model.Tables["Sales"]];
tablePermission.FilterExpression = @"
[Region] IN (
    SELECTCOLUMNS(
        FILTER('UserRegion', 'UserRegion'[UserPrincipalName] = USERNAME()),
        'UserRegion'[Region]
    )
)
";
```

### Configure Object-Level Security (OLS)
```csharp
var role = Model.Roles["Limited Access"];

// Hide specific tables
role.TablePermissions[Model.Tables["Salary"]].MetadataPermission = MetadataPermission.None;

// Hide specific columns
var customerTable = Model.Tables["Customer"];
role.TablePermissions[customerTable].ColumnPermissions["Email"].MetadataPermission = MetadataPermission.None;
role.TablePermissions[customerTable].ColumnPermissions["Phone"].MetadataPermission = MetadataPermission.None;
```

### List All Roles and Filters
```csharp
foreach(var role in Model.Roles) {
    Info($"Role: {role.Name}");
    Info($"  Permission: {role.ModelPermission}");

    foreach(var tp in role.TablePermissions) {
        if(!string.IsNullOrEmpty(tp.FilterExpression)) {
            Info($"  RLS on {tp.Table.Name}: {tp.FilterExpression}");
        }
    }
}
```

## Property Reference

### Role Properties
- `Name` - Role name
- `Description` - Role description
- `ModelPermission` - Read, ReadRefresh, Refresh, Administrator
- `Members` - Collection of role members
- `TablePermissions` - Collection of table permissions

### Model Permission Types
- `ModelPermission.Read` - Read data only
- `ModelPermission.ReadRefresh` - Read and refresh data
- `ModelPermission.Refresh` - Refresh only (no read)
- `ModelPermission.Administrator` - Full admin access

### Table Permission Properties
- `FilterExpression` - DAX filter expression for RLS
- `MetadataPermission` - None, Default, Read
- `ColumnPermissions` - Column-level permissions

### Metadata Permission Types
- `MetadataPermission.Default` - Inherit from parent
- `MetadataPermission.None` - Hide object
- `MetadataPermission.Read` - Show object

## Common RLS Patterns

### Static Region Filter
```csharp
var role = Model.AddRole("West Region");
role.ModelPermission = ModelPermission.Read;

var tp = role.TablePermissions[Model.Tables["Sales"]];
tp.FilterExpression = "[Region] = \"West\"";
```

### Dynamic User Filter
```csharp
var role = Model.AddRole("Sales Reps");
role.ModelPermission = ModelPermission.Read;

var tp = role.TablePermissions[Model.Tables["Sales"]];
tp.FilterExpression = "[SalesRepEmail] = USERNAME()";
```

### Multi-Table RLS
```csharp
var role = Model.AddRole("Department Filter");
role.ModelPermission = ModelPermission.Read;

// Filter dimension table
var deptTP = role.TablePermissions[Model.Tables["Department"]];
deptTP.FilterExpression = "[DepartmentName] IN {\"Sales\", \"Marketing\"}";

// Relationships automatically filter fact tables
// No need to filter Sales table if it has relationship to Department
```

### Manager Hierarchy
```csharp
var role = Model.AddRole("Managers");
role.ModelPermission = ModelPermission.Read;

var tp = role.TablePermissions[Model.Tables["Employee"]];
tp.FilterExpression = @"
PATHCONTAINS(
    [ManagerPath],
    LOOKUPVALUE(
        'Employee'[EmployeeKey],
        'Employee'[Email],
        USERNAME()
    )
)
";
```

## Best Practices

1. **Role Design**
   - Create roles by business function
   - Use meaningful role names
   - Document filter logic
   - Test with actual users

2. **RLS Filters**
   - Filter dimension tables when possible
   - Leverage relationships
   - Avoid complex DAX in filters
   - Use USERNAME() or USERPRINCIPALNAME()

3. **Performance**
   - Keep filters simple
   - Avoid CALCULATE in RLS
   - Test with production data volumes
   - Monitor query performance

4. **Dynamic RLS**
   - Use security mapping tables
   - Cache user-to-region mappings
   - Update security tables regularly
   - Document mapping logic

5. **Object-Level Security**
   - Hide sensitive columns
   - Hide helper tables
   - Document hidden objects
   - Test with restricted users

## Testing RLS

### View As Role
```csharp
// In Tabular Editor, use "View as Role" feature
// Or test in Power BI Desktop with "View as Roles"
```

### DAX Query Testing
```dax
// Test filter results
EVALUATE
CALCULATETABLE(
    'Sales',
    [Region] = "West"
)
```

## Common Use Cases

### Sales Territory Security
```csharp
var role = Model.AddRole("Territory Access");
role.ModelPermission = ModelPermission.Read;

var tp = role.TablePermissions[Model.Tables["Territory"]];
tp.FilterExpression = @"
[TerritoryID] IN (
    VALUES('UserTerritory'[TerritoryID])
)
";
```

### Manager Access
```csharp
var role = Model.AddRole("Manager Access");
role.ModelPermission = ModelPermission.Read;

var tp = role.TablePermissions[Model.Tables["Employee"]];
tp.FilterExpression = "[ManagerEmail] = USERNAME()";
```

### Customer Data Access
```csharp
var role = Model.AddRole("Customer Portal");
role.ModelPermission = ModelPermission.Read;

var tp = role.TablePermissions[Model.Tables["Sales"]];
tp.FilterExpression = "[CustomerEmail] = USERPRINCIPALNAME()";
```

## See Also

- [Tables](../tables/)
- [Perspectives](../perspectives/)
- [Model](../model/)
