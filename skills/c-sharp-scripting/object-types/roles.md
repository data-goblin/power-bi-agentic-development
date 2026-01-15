# Roles (Security)

Roles define row-level security (RLS) and object-level security (OLS) for semantic models.

## Key Properties

| Property | Type | Description |
|----------|------|-------------|
| `Name` | string | Role name |
| `Description` | string | Documentation text |
| `ModelPermission` | ModelPermission | Model-level permission |
| `Members` | Collection | Role members (users/groups) |
| `TablePermissions` | Collection | Table-level filters and OLS |

## Model Permissions

| Permission | Description |
|------------|-------------|
| `None` | No access |
| `Read` | Read data only |
| `ReadRefresh` | Read and refresh data |
| `Refresh` | Refresh only (no read) |
| `Administrator` | Full access |

## Common Methods

| Method | Description |
|--------|-------------|
| `Model.AddRole(name)` | Create new role |
| `Role.AddMember(identity, type)` | Add member to role |
| `Role.AddTablePermission(table)` | Add table permission entry |
| `Role.Delete()` | Remove role |
| `Member.Delete()` | Remove member |

## Access Patterns

```csharp
// All roles
foreach(var role in Model.Roles) { }

// Single role
var role = Model.Roles["SalesRegion"];

// Access members
foreach(var member in role.Members) {
    Info(member.MemberName);
}

// Access RLS filter
var filter = role.TablePermissions["Sales"].FilterExpression;
```

## CRUD Operations

### Create Role
```csharp
var role = Model.AddRole("SalesRegion");
role.ModelPermission = ModelPermission.Read;
role.Description = "Sales team with regional filtering";
```

### Add Members
```csharp
// Windows Active Directory
role.AddMember("DOMAIN\\SalesTeam", ModelRoleMemberType.Windows);
role.AddMember("DOMAIN\\jdoe", ModelRoleMemberType.Windows);

// Azure AD (email or object ID)
role.AddMember("sales@contoso.com", ModelRoleMemberType.External);
role.AddMember("12345678-guid-here", ModelRoleMemberType.External);
```

### Configure RLS Filter
```csharp
// Add table permission
var tablePerm = role.TablePermissions.Find("Sales");
if(tablePerm == null) {
    tablePerm = role.AddTablePermission(Model.Tables["Sales"]);
}

// Set filter expression
tablePerm.FilterExpression = "'Region'[Region] = \"West\"";
```

### Configure OLS (Object-Level Security)
```csharp
// Hide table from role
tablePerm.MetadataPermission = MetadataPermission.None;

// Default (visible)
tablePerm.MetadataPermission = MetadataPermission.Default;
```

### Delete Role
```csharp
Model.Roles["OldRole"].Delete();
```

## RLS Filter Patterns

### Static Filter
```csharp
tablePerm.FilterExpression = "'Region'[Region] = \"West\"";
```

### Dynamic Filter with USERNAME()
```csharp
tablePerm.FilterExpression = "'Employee'[Email] = USERNAME()";
```

### Dynamic Filter with USERPRINCIPALNAME()
```csharp
tablePerm.FilterExpression = "'Employee'[UPN] = USERPRINCIPALNAME()";
```

### Multiple Values
```csharp
tablePerm.FilterExpression = @"
'Region'[Region] IN { ""West"", ""Central"" }
";
```

### Complex Filter
```csharp
tablePerm.FilterExpression = @"
'Region'[Region] IN { ""West"", ""Central"" }
&& 'Product'[Category] <> ""Confidential""
";
```

### Security Table Pattern
```csharp
tablePerm.FilterExpression = @"
'Sales'[RegionID] IN
    CALCULATETABLE(
        VALUES('UserRegions'[RegionID]),
        'UserRegions'[Email] = USERNAME()
    )
";
```

### Manager Hierarchy
```csharp
tablePerm.FilterExpression = @"
PATHCONTAINS('Employee'[ManagerPath], USERNAME())
";
```

## Common Patterns

### Create Regional Roles
```csharp
var regions = new[] { "West", "East", "Central", "South" };
foreach(var region in regions) {
    var role = Model.AddRole(region + " Sales");
    role.ModelPermission = ModelPermission.Read;

    var perm = role.AddTablePermission(Model.Tables["Sales"]);
    perm.FilterExpression = $"'Geography'[Region] = \"{region}\"";
}
```

### List All Roles with Filters
```csharp
foreach(var role in Model.Roles) {
    Info($"Role: {role.Name} ({role.ModelPermission})");
    foreach(var perm in role.TablePermissions) {
        if(!string.IsNullOrEmpty(perm.FilterExpression)) {
            Info($"  RLS on {perm.Table.Name}: {perm.FilterExpression}");
        }
    }
}
```

### Copy Role
```csharp
var sourceRole = Model.Roles["Original"];
var newRole = Model.AddRole("Copy of " + sourceRole.Name);
newRole.ModelPermission = sourceRole.ModelPermission;

foreach(var perm in sourceRole.TablePermissions) {
    var newPerm = newRole.AddTablePermission(perm.Table);
    newPerm.FilterExpression = perm.FilterExpression;
    newPerm.MetadataPermission = perm.MetadataPermission;
}
```

## Best Practices

1. **Test RLS thoroughly** - Verify with test users before deployment
2. **Use dynamic security** - USERNAME() or USERPRINCIPALNAME() for scalability
3. **Document filter logic** - Add descriptions to roles
4. **Consider performance** - Complex filters impact query speed
5. **Use security tables** - For maintainable, data-driven RLS
6. **Validate members** - Ensure users/groups exist before adding
7. **Combine with perspectives** - For complete access control

## Reference Examples

See `samples/roles/` for working examples.
