# TOM Object Types and Properties Reference

Complete create, read, update, and delete examples for TOM object types accessible via Power BI Desktop's local Analysis Services instance.

All examples assume `$model` is already connected (see SKILL.md section 3).

> **This reference is not exhaustive.** The TOM API has many properties not covered here. When working with unfamiliar object types or properties, always verify against the official Microsoft documentation:
>
> - [Microsoft.AnalysisServices.Tabular namespace](https://learn.microsoft.com/en-us/dotnet/api/microsoft.analysisservices.tabular)
> - [TOM overview](https://learn.microsoft.com/en-us/analysis-services/tom/introduction-to-the-tabular-object-model-tom-in-analysis-services-amo)
> - [Create Tables, Partitions, Columns (MS sample code)](https://learn.microsoft.com/en-us/analysis-services/tom/create-tables-partitions-and-columns-in-a-tabular-model)
> - [Programming PBI datasets with TOM](https://learn.microsoft.com/en-us/analysis-services/tom/tom-pbi-datasets)
>
> Use PowerShell reflection to discover properties not listed here:
> ```powershell
> [Microsoft.AnalysisServices.Tabular.Table].GetProperties() | Where-Object { $_.CanWrite } | ForEach-Object { "$($_.Name) : $($_.PropertyType.Name)" }
> ```


## Gotchas and Common Pitfalls

### RowNumberColumn (Internal Engine Column)

Every table has a hidden `RowNumberColumn` (name like `RowNumber-2662979B-1795-4F74-8F37-6A1BA8059B61`) automatically created by the VertiPaq storage engine for internal indexing. It cannot be created, modified, or deleted -- it is managed by the engine.

When enumerating columns, always filter it out:

```powershell
$userColumns = $table.Columns | Where-Object { $_ -isnot [Microsoft.AnalysisServices.Tabular.RowNumberColumn] }
```

### Table Creation Requires Explicit Columns

When creating tables via TOM against PBI Desktop, columns **must** be defined explicitly as `DataColumn` objects. PBI Desktop does not auto-discover columns from M/Power Query expressions via TOM (unlike the Tabular Editor UI or SSMS, which process the partition and infer columns).

Each `DataColumn` requires a `SourceColumn` property that maps to the column name in the M expression or source query output:

```powershell
$col = New-Object Microsoft.AnalysisServices.Tabular.DataColumn
$col.Name = "Order Date"
$col.DataType = [Microsoft.AnalysisServices.Tabular.DataType]::DateTime
$col.SourceColumn = "Order Date"    # must match the source query output exactly
$table.Columns.Add($col)
```

### Relationship to Newly-Created Tables

When creating a relationship that references a newly-added table, reference the column *object* directly (not by name lookup on the table) and add both the table and relationship in one `SaveChanges()` batch:

```powershell
$col = New-Object Microsoft.AnalysisServices.Tabular.DataColumn
$col.Name = "CustomerID"; $col.DataType = [Microsoft.AnalysisServices.Tabular.DataType]::Int64; $col.SourceColumn = "CustomerID"
$newTable.Columns.Add($col)

$rel = New-Object Microsoft.AnalysisServices.Tabular.SingleColumnRelationship
$rel.FromColumn = $col                    # reference the object, not $newTable.Columns["CustomerID"]
$rel.ToColumn = $model.Tables["Customers"].Columns["CustomerID"]
# ...
$model.Tables.Add($newTable)
$model.Relationships.Add($rel)
$model.SaveChanges()                      # one batch
```

If you look up the column by name *after* adding the table but *before* saving, the server hasn't assigned internal IDs yet and the relationship will fail with "invalid table ID 0".


## Tables

### Create

```powershell
$table = New-Object Microsoft.AnalysisServices.Tabular.Table
$table.Name = "NewTable"
$table.Description = "Fact table for orders"

# Define columns explicitly (see gotcha above)
$c1 = New-Object Microsoft.AnalysisServices.Tabular.DataColumn
$c1.Name = "OrderID"; $c1.DataType = [Microsoft.AnalysisServices.Tabular.DataType]::Int64; $c1.SourceColumn = "OrderID"
$table.Columns.Add($c1)

$c2 = New-Object Microsoft.AnalysisServices.Tabular.DataColumn
$c2.Name = "Amount"; $c2.DataType = [Microsoft.AnalysisServices.Tabular.DataType]::Double; $c2.SourceColumn = "Amount"
$table.Columns.Add($c2)

# Add M partition
$partition = New-Object Microsoft.AnalysisServices.Tabular.Partition
$partition.Name = "NewTable-Partition"
$partition.Source = New-Object Microsoft.AnalysisServices.Tabular.MPartitionSource
$partition.Source.Expression = 'let Source = Sql.Database("server", "db"), Orders = Source{[Schema="dbo",Item="Orders"]}[Data] in Orders'
$table.Partitions.Add($partition)

$model.Tables.Add($table)
```

### Create (Calculated Table via DAX)

```powershell
$table = New-Object Microsoft.AnalysisServices.Tabular.Table
$table.Name = "Date"

# Calculated table uses a CalculatedPartitionSource with a DAX expression
$partition = New-Object Microsoft.AnalysisServices.Tabular.Partition
$partition.Name = "Date"
$partition.Source = New-Object Microsoft.AnalysisServices.Tabular.CalculatedPartitionSource
$partition.Source.Expression = 'CALENDAR(DATE(2020, 1, 1), DATE(2030, 12, 31))'
$table.Partitions.Add($partition)

$model.Tables.Add($table)
# After SaveChanges(), the server infers CalculatedTableColumns automatically
```

### Create (DAX Date Table / Calendar)

```powershell
# Create a custom DAX calendar and mark it as a date table
$table = New-Object Microsoft.AnalysisServices.Tabular.Table
$table.Name = "Date"
$table.DataCategory = "Time"    # marks as date table for time intelligence

$partition = New-Object Microsoft.AnalysisServices.Tabular.Partition
$partition.Name = "Date"
$partition.Source = New-Object Microsoft.AnalysisServices.Tabular.CalculatedPartitionSource
$partition.Source.Expression = @"
VAR _StartDate = DATE(2020, 1, 1)
VAR _EndDate = DATE(2030, 12, 31)
VAR _Calendar = CALENDAR(_StartDate, _EndDate)
RETURN
    ADDCOLUMNS(
        _Calendar,
        "Year", YEAR([Date]),
        "Month", FORMAT([Date], "MMM"),
        "MonthNumber", MONTH([Date]),
        "Quarter", "Q" & FORMAT([Date], "Q"),
        "DayOfWeek", FORMAT([Date], "ddd"),
        "DayOfWeekNumber", WEEKDAY([Date], 2),
        "IsWeekday", WEEKDAY([Date], 2) <= 5
    )
"@
$table.Partitions.Add($partition)

$model.Tables.Add($table)
# After SaveChanges(), set the date column as the key for time intelligence:
# $model.Tables["Date"].Columns["Date"].IsKey = $true
```

### Read

```powershell
$table = $model.Tables["Sales"]

foreach ($t in $model.Tables) {
    Write-Output "[$($t.Name)] Hidden=$($t.IsHidden) Cols=$($t.Columns.Count) Measures=$($t.Measures.Count)"
}

# Filter for calculated tables
$calcTables = $model.Tables | Where-Object {
    ($_.Partitions | Where-Object { $_.SourceType -eq "Calculated" }).Count -gt 0
}
```

### Update

```powershell
$table.Name = "Renamed Table"
$table.IsHidden = $true
$table.Description = "Archived fact table"
$table.DataCategory = "Time"           # marks as date table for time intelligence
$table.IsPrivate = $true               # hides from field list entirely
$table.ExcludeFromModelRefresh = $true  # skips during full model refresh
```

### Delete

```powershell
$table = $model.Tables["OldTable"]
$model.Tables.Remove($table)
```


## Columns

### Column Types

| Type | Class | Description |
|------|-------|-------------|
| Data Column | `DataColumn` | Regular column backed by source data; requires `SourceColumn` |
| Calculated Column | `CalculatedColumn` | Column defined by a DAX expression |
| Calculated Table Column | `CalculatedTableColumn` | Auto-generated column in calculated tables; has `SourceColumn` and `IsNameInferred` |
| Row Number Column | `RowNumberColumn` | Internal VertiPaq index column; cannot be created/modified/deleted |

### Create (Data Column)

```powershell
$col = New-Object Microsoft.AnalysisServices.Tabular.DataColumn
$col.Name = "Region"
$col.DataType = [Microsoft.AnalysisServices.Tabular.DataType]::String
$col.SourceColumn = "region_code"      # must match source query output
$model.Tables["Sales"].Columns.Add($col)
```

### Create (Calculated Column)

```powershell
$cc = New-Object Microsoft.AnalysisServices.Tabular.CalculatedColumn
$cc.Name = "Full Name"
$cc.Expression = "[FirstName] & "" "" & [LastName]"
$cc.DataType = [Microsoft.AnalysisServices.Tabular.DataType]::String
$model.Tables["Customers"].Columns.Add($cc)
```

### Read

```powershell
$col = $model.Tables["Sales"].Columns["Amount"]

# All user-visible columns (skip RowNumberColumn)
foreach ($t in $model.Tables) {
    foreach ($c in $t.Columns | Where-Object { $_ -isnot [Microsoft.AnalysisServices.Tabular.RowNumberColumn] }) {
        $type = if ($c -is [Microsoft.AnalysisServices.Tabular.CalculatedColumn]) { "Calc" }
                elseif ($c -is [Microsoft.AnalysisServices.Tabular.CalculatedTableColumn]) { "CalcTbl" }
                elseif ($c -is [Microsoft.AnalysisServices.Tabular.DataColumn]) { "Data" }
                else { "Other" }
        Write-Output "[$($t.Name)].[$($c.Name)] $($c.DataType) ($type)"
    }
}
```

### Update

```powershell
$col.Name = "Sales Amount"
$col.DataType = [Microsoft.AnalysisServices.Tabular.DataType]::Decimal
$col.FormatString = "#,0.00"
$col.IsHidden = $true
$col.DisplayFolder = "Financials\Revenue"
$col.Description = "Net sales amount in USD"
$col.SummarizeBy = [Microsoft.AnalysisServices.Tabular.AggregateFunction]::Sum
$col.SortByColumn = $model.Tables["Date"].Columns["MonthNumber"]
$col.IsKey = $true                     # marks as table key (required for date tables)
$col.IsNullable = $false
$col.IsUnique = $true
$col.DataCategory = "WebUrl"           # or "ImageUrl", "Barcode", "City", "Country", etc.
$col.EncodingHint = [Microsoft.AnalysisServices.Tabular.EncodingHintType]::Hash  # or Value
```

### Delete

```powershell
$col = $model.Tables["Sales"].Columns["OldColumn"]
$model.Tables["Sales"].Columns.Remove($col)
```


## Measures

### Create

```powershell
$m = New-Object Microsoft.AnalysisServices.Tabular.Measure
$m.Name = "Total Revenue"
$m.Expression = "SUM(Sales[Amount])"
$m.FormatString = "`$#,0.00"
$m.DisplayFolder = "Key Metrics"
$m.Description = "Sum of all sales amounts"
$m.IsHidden = $false
$model.Tables["Sales"].Measures.Add($m)
```

### Create with KPI

```powershell
$m = New-Object Microsoft.AnalysisServices.Tabular.Measure
$m.Name = "Revenue vs Target"
$m.Expression = "DIVIDE([Total Revenue], [Revenue Target])"
$m.FormatString = "0.0%"
$model.Tables["Sales"].Measures.Add($m)

$kpi = New-Object Microsoft.AnalysisServices.Tabular.KPI
$kpi.TargetExpression = "1"
$kpi.StatusExpression = "IF([Revenue vs Target] >= 1, 1, IF([Revenue vs Target] >= 0.8, 0, -1))"
$m.KPI = $kpi
```

### Create with Detail Rows

```powershell
$m = New-Object Microsoft.AnalysisServices.Tabular.Measure
$m.Name = "Total Sales"
$m.Expression = "SUM(Sales[Amount])"
$m.FormatString = "`$#,0"
$model.Tables["Sales"].Measures.Add($m)

# DetailRowsDefinition defines what shows when user drills through
$drd = New-Object Microsoft.AnalysisServices.Tabular.DetailRowsDefinition
$drd.Expression = "SELECTCOLUMNS(Sales, ""Product"", Sales[Product], ""Amount"", Sales[Amount], ""Date"", Sales[OrderDate])"
$m.DetailRowsDefinition = $drd
```

### Create with Dynamic Format String

```powershell
# FormatStringDefinition uses a DAX expression to dynamically choose the format
# Requires compatibility level 1470+
$m = New-Object Microsoft.AnalysisServices.Tabular.Measure
$m.Name = "Dynamic Metric"
$m.Expression = "IF(SELECTEDVALUE(Metric[Type]) = ""Pct"", [PctValue], [AbsValue])"
$model.Tables["Metrics"].Measures.Add($m)

$fsd = New-Object Microsoft.AnalysisServices.Tabular.FormatStringDefinition
$fsd.Expression = 'IF(SELECTEDVALUE(Metric[Type]) = "Pct", "0.0%", "#,0")'
$m.FormatStringDefinition = $fsd
```

### Read

```powershell
$m = $model.Tables["Sales"].Measures["Total Revenue"]
Write-Output "Expression: $($m.Expression)"
Write-Output "Format: $($m.FormatString)"
Write-Output "Folder: $($m.DisplayFolder)"
Write-Output "HasKPI: $($m.KPI -ne $null)"
Write-Output "HasDetailRows: $($m.DetailRowsDefinition -ne $null)"
Write-Output "HasDynamicFormat: $($m.FormatStringDefinition -and $m.FormatStringDefinition.Expression)"

# All measures across model
foreach ($t in $model.Tables) {
    foreach ($m in $t.Measures) {
        Write-Output "[$($t.Name)].[$($m.Name)] = $($m.Expression)"
    }
}
```

### Update

```powershell
$m.Expression = "CALCULATE(SUM(Sales[Amount]), Sales[Status] = ""Active"")"
$m.FormatString = "#,0"
$m.DisplayFolder = "Revenue"
$m.Description = "Active sales revenue"
```

### Delete

```powershell
$m = $model.Tables["Sales"].Measures["Old Measure"]
$model.Tables["Sales"].Measures.Remove($m)
```


## Relationships

### Create

```powershell
$rel = New-Object Microsoft.AnalysisServices.Tabular.SingleColumnRelationship
$rel.Name = "Sales_Date"
$rel.FromColumn = $model.Tables["Sales"].Columns["DateKey"]
$rel.ToColumn = $model.Tables["Date"].Columns["DateKey"]
$rel.FromCardinality = [Microsoft.AnalysisServices.Tabular.RelationshipEndCardinality]::Many
$rel.ToCardinality = [Microsoft.AnalysisServices.Tabular.RelationshipEndCardinality]::One
$rel.IsActive = $true
$rel.CrossFilteringBehavior = [Microsoft.AnalysisServices.Tabular.CrossFilteringBehavior]::OneDirection
$rel.RelyOnReferentialIntegrity = $false  # set true if source guarantees RI (performance optimization)
$model.Relationships.Add($rel)
```

### Read

```powershell
foreach ($rel in $model.Relationships) {
    $sr = [Microsoft.AnalysisServices.Tabular.SingleColumnRelationship]$rel
    Write-Output "[$($sr.FromTable.Name)].[$($sr.FromColumn.Name)] -> [$($sr.ToTable.Name)].[$($sr.ToColumn.Name)] Active=$($sr.IsActive) CrossFilter=$($sr.CrossFilteringBehavior) RI=$($sr.RelyOnReferentialIntegrity)"
}
```

### Update

```powershell
$sr = [Microsoft.AnalysisServices.Tabular.SingleColumnRelationship]$model.Relationships[0]
$sr.IsActive = $false
$sr.CrossFilteringBehavior = [Microsoft.AnalysisServices.Tabular.CrossFilteringBehavior]::BothDirections
$sr.SecurityFilteringBehavior = [Microsoft.AnalysisServices.Tabular.SecurityFilteringBehavior]::OneDirection
$sr.RelyOnReferentialIntegrity = $true
```

### Delete

```powershell
$model.Relationships.Remove($model.Relationships[0])
```


## Hierarchies

### Create

```powershell
$h = New-Object Microsoft.AnalysisServices.Tabular.Hierarchy
$h.Name = "Geography"
$h.DisplayFolder = "Dimensions"

$l1 = New-Object Microsoft.AnalysisServices.Tabular.Level
$l1.Name = "Country"; $l1.Column = $model.Tables["Geo"].Columns["Country"]; $l1.Ordinal = 0
$h.Levels.Add($l1)

$l2 = New-Object Microsoft.AnalysisServices.Tabular.Level
$l2.Name = "State"; $l2.Column = $model.Tables["Geo"].Columns["State"]; $l2.Ordinal = 1
$h.Levels.Add($l2)

$l3 = New-Object Microsoft.AnalysisServices.Tabular.Level
$l3.Name = "City"; $l3.Column = $model.Tables["Geo"].Columns["City"]; $l3.Ordinal = 2
$h.Levels.Add($l3)

$model.Tables["Geo"].Hierarchies.Add($h)
```

### Read

```powershell
foreach ($t in $model.Tables) {
    foreach ($h in $t.Hierarchies) {
        $levels = ($h.Levels | Sort-Object Ordinal | ForEach-Object { $_.Name }) -join " > "
        Write-Output "[$($t.Name)].[$($h.Name)]: $levels"
    }
}
```

### Update

```powershell
$h = $model.Tables["Geo"].Hierarchies["Geography"]
$h.IsHidden = $true
$h.DisplayFolder = "Navigation"
$h.Description = "Drill-down hierarchy for geographic analysis"
```

### Delete

```powershell
$h = $model.Tables["Geo"].Hierarchies["Geography"]
$model.Tables["Geo"].Hierarchies.Remove($h)
```


## Roles (RLS/OLS)

### Create

```powershell
$role = New-Object Microsoft.AnalysisServices.Tabular.ModelRole
$role.Name = "Sales Region"
$role.ModelPermission = [Microsoft.AnalysisServices.Tabular.ModelPermission]::Read
$role.Description = "Row-level security by region"
$model.Roles.Add($role)

# Add table permission (RLS filter)
$tp = New-Object Microsoft.AnalysisServices.Tabular.TablePermission
$tp.Table = $model.Tables["Sales"]
$tp.FilterExpression = "[Region] = USERNAME()"
$role.TablePermissions.Add($tp)

# Add OLS (column-level security)
$cp = New-Object Microsoft.AnalysisServices.Tabular.ColumnPermission
$cp.Column = $model.Tables["Sales"].Columns["Margin"]
$cp.MetadataPermission = [Microsoft.AnalysisServices.Tabular.MetadataPermission]::None
$tp.ColumnPermissions.Add($cp)
```

### Add Role Members

```powershell
# Windows user
$member = New-Object Microsoft.AnalysisServices.Tabular.WindowsModelRoleMember
$member.MemberName = "DOMAIN\username"
$role.Members.Add($member)

# External user (Azure AD / Entra ID)
$extMember = New-Object Microsoft.AnalysisServices.Tabular.ExternalModelRoleMember
$extMember.MemberName = "user@contoso.com"
$extMember.IdentityProvider = "AzureAD"
$role.Members.Add($extMember)
```

### Read

```powershell
foreach ($role in $model.Roles) {
    Write-Output "Role: [$($role.Name)] Permission=$($role.ModelPermission) Members=$($role.Members.Count)"
    foreach ($member in $role.Members) {
        Write-Output "  Member: $($member.MemberName)"
    }
    foreach ($tp in $role.TablePermissions) {
        Write-Output "  Table: [$($tp.Table.Name)] Filter: $($tp.FilterExpression)"
        foreach ($cp in $tp.ColumnPermissions) {
            Write-Output "    Column: [$($cp.Column.Name)] Metadata=$($cp.MetadataPermission)"
        }
    }
}
```

### Update

```powershell
$role = $model.Roles["Sales Region"]
$role.ModelPermission = [Microsoft.AnalysisServices.Tabular.ModelPermission]::ReadRefresh
$role.TablePermissions["Sales"].FilterExpression = "[Region] = USERPRINCIPALNAME()"
```

### Delete

```powershell
$role = $model.Roles["Sales Region"]
$model.Roles.Remove($role)
```


## Perspectives

### Create

```powershell
$p = New-Object Microsoft.AnalysisServices.Tabular.Perspective
$p.Name = "Sales View"
$p.Description = "Restricted view for sales analysts"
$model.Perspectives.Add($p)
```

### Toggle Membership

```powershell
$model.Tables["Sales"].InPerspective["Sales View"] = $true
$model.Tables["Date"].InPerspective["Sales View"] = $true
$model.Tables["Sales"].Columns["Amount"].InPerspective["Sales View"] = $true
$model.Tables["Sales"].Measures["Total Revenue"].InPerspective["Sales View"] = $true
```

### Read

```powershell
foreach ($p in $model.Perspectives) {
    Write-Output "Perspective: [$($p.Name)]"
    foreach ($t in $model.Tables) {
        if ($t.InPerspective[$p.Name]) {
            Write-Output "  Table: [$($t.Name)]"
        }
    }
}
```

### Delete

```powershell
$model.Perspectives.Remove($model.Perspectives["Sales View"])
```


## Cultures (Translations)

### Create

```powershell
$culture = New-Object Microsoft.AnalysisServices.Tabular.Culture
$culture.Name = "de-DE"
$model.Cultures.Add($culture)
```

### Add Translations

```powershell
$model.Tables["Sales"].TranslatedNames["de-DE"] = "Verkauf"
$model.Tables["Sales"].Columns["Amount"].TranslatedNames["de-DE"] = "Betrag"
$model.Tables["Sales"].Measures["Total Revenue"].TranslatedNames["de-DE"] = "Gesamtumsatz"
```

### Read

```powershell
foreach ($c in $model.Cultures) {
    Write-Output "Culture: [$($c.Name)] Translations=$($c.ObjectTranslations.Count)"
    foreach ($t in $c.ObjectTranslations) {
        Write-Output "  $($t.Object.GetType().Name): $($t.Property) = $($t.Value)"
    }
}
```

### Delete

```powershell
$model.Cultures.Remove($model.Cultures["de-DE"])
```


## Partitions

### Create

```powershell
# M partition
$p = New-Object Microsoft.AnalysisServices.Tabular.Partition
$p.Name = "Sales-2024"
$p.Source = New-Object Microsoft.AnalysisServices.Tabular.MPartitionSource
$p.Source.Expression = 'let Source = Sql.Database("server", "db"), Filtered = Table.SelectRows(Source, each [Year] = 2024) in Filtered'
$p.Mode = [Microsoft.AnalysisServices.Tabular.ModeType]::Import    # Import, DirectQuery, Dual, or Default
$model.Tables["Sales"].Partitions.Add($p)
```

### Read

```powershell
foreach ($t in $model.Tables) {
    foreach ($p in $t.Partitions) {
        Write-Output "[$($t.Name)] Partition=[$($p.Name)] Source=$($p.SourceType) Mode=$($p.Mode)"
        if ($p.Source -is [Microsoft.AnalysisServices.Tabular.MPartitionSource]) {
            Write-Output "  M: $($p.Source.Expression)"
        }
    }
}
```

### Update

```powershell
$partition = $model.Tables["Sales"].Partitions["Sales-2024"]
$mSource = [Microsoft.AnalysisServices.Tabular.MPartitionSource]$partition.Source
$mSource.Expression = 'let Source = Sql.Database("newserver", "newdb") in Source'
$partition.Mode = [Microsoft.AnalysisServices.Tabular.ModeType]::DirectQuery
```

### Delete

```powershell
# A table must retain at least one partition
$p = $model.Tables["Sales"].Partitions["Sales-2023"]
$model.Tables["Sales"].Partitions.Remove($p)
```


## Data Sources

### Create

```powershell
# Structured (modern) data source
$ds = New-Object Microsoft.AnalysisServices.Tabular.StructuredDataSource
$ds.Name = "SQL Server"
$ds.ConnectionDetails = New-Object Microsoft.AnalysisServices.Tabular.ConnectionDetails
$ds.ConnectionDetails.Address = New-Object Microsoft.AnalysisServices.Tabular.ConnectionAddress
$ds.ConnectionDetails.Address.Server = "myserver.database.windows.net"
$ds.ConnectionDetails.Address.Database = "mydb"
$ds.ConnectionDetails.Protocol = "tds"
$model.DataSources.Add($ds)

# Provider (legacy) data source
$pds = New-Object Microsoft.AnalysisServices.Tabular.ProviderDataSource
$pds.Name = "Legacy SQL"
$pds.ConnectionString = "Provider=SQLNCLI11;Data Source=localhost;Initial Catalog=AdventureWorks;Integrated Security=SSPI"
$pds.ImpersonationMode = [Microsoft.AnalysisServices.Tabular.ImpersonationMode]::ImpersonateServiceAccount
$model.DataSources.Add($pds)
```

### Read

```powershell
foreach ($ds in $model.DataSources) {
    $dsType = $ds.GetType().Name
    Write-Output "[$($ds.Name)] Type=$dsType"
    if ($ds -is [Microsoft.AnalysisServices.Tabular.StructuredDataSource]) {
        Write-Output "  Server: $($ds.ConnectionDetails.Address.Server)"
        Write-Output "  Database: $($ds.ConnectionDetails.Address.Database)"
    }
    if ($ds -is [Microsoft.AnalysisServices.Tabular.ProviderDataSource]) {
        Write-Output "  ConnectionString: $($ds.ConnectionString)"
    }
}
```

### Update

```powershell
$ds = $model.DataSources["SQL Server"]
if ($ds -is [Microsoft.AnalysisServices.Tabular.StructuredDataSource]) {
    $ds.ConnectionDetails.Address.Server = "newserver.database.windows.net"
}
```

### Delete

```powershell
$model.DataSources.Remove($model.DataSources["Legacy SQL"])
```


## Annotations (Custom Metadata)

### Create

```powershell
$ann = New-Object Microsoft.AnalysisServices.Tabular.Annotation
$ann.Name = "PBI_Description"
$ann.Value = "This measure tracks quarterly revenue"
$model.Tables["Sales"].Measures["Total Revenue"].Annotations.Add($ann)
```

### Read

```powershell
foreach ($ann in $model.Tables["Sales"].Annotations) {
    Write-Output "[$($ann.Name)] = $($ann.Value)"
}
```

### Update

```powershell
$model.Tables["Sales"].Annotations["PBI_Description"].Value = "Updated description"
```

### Delete

```powershell
$ann = $model.Tables["Sales"].Annotations["PBI_Description"]
$model.Tables["Sales"].Annotations.Remove($ann)
```


## Named Expressions (Shared M Queries / Parameters)

Used for shared Power Query connections, M parameters, and reusable functions.

### Create

```powershell
# Shared connection
$expr = New-Object Microsoft.AnalysisServices.Tabular.NamedExpression
$expr.Name = "DatabaseConnection"
$expr.Kind = [Microsoft.AnalysisServices.Tabular.ExpressionKind]::M
$expr.Expression = 'Sql.Database("myserver.database.windows.net", "mydb")'
$model.Expressions.Add($expr)

# M parameter (for incremental refresh or parameterized queries)
$param = New-Object Microsoft.AnalysisServices.Tabular.NamedExpression
$param.Name = "RangeStart"
$param.Kind = [Microsoft.AnalysisServices.Tabular.ExpressionKind]::M
$param.Expression = '#datetime(2024, 1, 1, 0, 0, 0) meta [IsParameterQuery=true, Type="DateTime", IsParameterQueryRequired=true]'
$model.Expressions.Add($param)

# M function (reusable transformation logic)
$func = New-Object Microsoft.AnalysisServices.Tabular.NamedExpression
$func.Name = "fnCleanText"
$func.Kind = [Microsoft.AnalysisServices.Tabular.ExpressionKind]::M
$func.Expression = '(inputText as text) => Text.Trim(Text.Clean(inputText))'
$model.Expressions.Add($func)
```

### Read

```powershell
foreach ($e in $model.Expressions) {
    Write-Output "[$($e.Name)] Kind=$($e.Kind)"
    Write-Output "  $($e.Expression)"
}
```

### Update

```powershell
$model.Expressions["DatabaseConnection"].Expression = 'Sql.Database("newserver", "newdb")'
```

### Delete

```powershell
$model.Expressions.Remove($model.Expressions["DatabaseConnection"])
```


## Calculation Groups

### Create

```powershell
# A calculation group is a special table
$cgTable = New-Object Microsoft.AnalysisServices.Tabular.Table
$cgTable.Name = "Time Intelligence"
$cgTable.CalculationGroup = New-Object Microsoft.AnalysisServices.Tabular.CalculationGroup
$cgTable.CalculationGroup.Precedence = 10

# Add partition (required)
$partition = New-Object Microsoft.AnalysisServices.Tabular.Partition
$partition.Name = "Time Intelligence"
$partition.Source = New-Object Microsoft.AnalysisServices.Tabular.CalculationGroupSource
$cgTable.Partitions.Add($partition)

# Add calculation items
$ytd = New-Object Microsoft.AnalysisServices.Tabular.CalculationItem
$ytd.Name = "YTD"
$ytd.Expression = "CALCULATE(SELECTEDMEASURE(), DATESYTD('Date'[Date]))"
$ytd.Ordinal = 0
$cgTable.CalculationGroup.CalculationItems.Add($ytd)

$py = New-Object Microsoft.AnalysisServices.Tabular.CalculationItem
$py.Name = "Prior Year"
$py.Expression = "CALCULATE(SELECTEDMEASURE(), DATEADD('Date'[Date], -1, YEAR))"
$py.Ordinal = 1
# Dynamic format string per calculation item (compat level 1470+)
$pyFsd = New-Object Microsoft.AnalysisServices.Tabular.FormatStringDefinition
$pyFsd.Expression = 'SELECTEDMEASUREFORMATSTRING()'
$py.FormatStringDefinition = $pyFsd
$cgTable.CalculationGroup.CalculationItems.Add($py)

$model.Tables.Add($cgTable)
```

### Read

```powershell
foreach ($t in $model.Tables | Where-Object { $_.CalculationGroup -ne $null }) {
    Write-Output "Calc Group: [$($t.Name)] Precedence=$($t.CalculationGroup.Precedence)"
    foreach ($item in $t.CalculationGroup.CalculationItems) {
        Write-Output "  [$($item.Name)] Ordinal=$($item.Ordinal)"
        Write-Output "    $($item.Expression)"
    }
}
```

### Update

```powershell
$cg = ($model.Tables | Where-Object { $_.Name -eq "Time Intelligence" }).CalculationGroup
$cg.Precedence = 20

# Modify a calculation item
$item = $cg.CalculationItems["YTD"]
$item.Expression = "CALCULATE(SELECTEDMEASURE(), DATESYTD('Date'[Date], ""6/30""))"  # fiscal year
```

### Delete

```powershell
# Remove a calculation item
$cg = ($model.Tables | Where-Object { $_.Name -eq "Time Intelligence" }).CalculationGroup
$cg.CalculationItems.Remove($cg.CalculationItems["Prior Year"])

# Remove entire calculation group (remove the table)
$model.Tables.Remove($model.Tables["Time Intelligence"])
```


## Saving All Changes

After any combination of the above operations:

```powershell
$model.SaveChanges()
```

This persists all pending modifications in a single transaction. If validation fails, the entire batch is rolled back and an error is thrown with details.


## Refresh After Modifications

`SaveChanges()` persists metadata, but the VertiPaq engine may need a refresh to materialize the changes:

| What was added/changed | Required refresh |
|------------------------|-----------------|
| Measure (DAX expression) | `calculate` -- recalculates DAX without re-querying source |
| Calculated column | `calculate` -- evaluates DAX expression and populates column |
| Calculated table | `calculate` -- evaluates DAX partition expression |
| Regular table / data column | `full` -- re-queries the data source and loads data |
| Partition M expression change | `full` on that partition/table |
| Relationship (new or modified) | `calculate` -- engine re-evaluates cross-filter propagation |
| Column/measure rename, folder, format | None -- metadata-only, visible immediately |
| Role / perspective / culture | None -- metadata-only |

```powershell
# After adding a calculated table or calculated column
$model.RequestRefresh([Microsoft.AnalysisServices.Tabular.RefreshType]::Calculate)
$model.SaveChanges()

# After adding a regular table with a data source
$model.Tables["NewTable"].RequestRefresh([Microsoft.AnalysisServices.Tabular.RefreshType]::Full)
$model.SaveChanges()
```


## Validating Changes with DAX Queries

After modifying the model, always validate that changes work as expected. Use ADOMD.NET DAX queries to confirm.

### Verify a New Measure

After adding a DAX measure, query it to confirm the expression evaluates correctly:

```powershell
$cmd.CommandText = "EVALUATE ROW(""@Result"", [New Measure Name])"
# If this returns an error, the DAX expression is invalid
# Check for division by zero, missing column references, circular dependencies
```

### Verify a Relationship

Test a new relationship by grouping a column from the "many" side and aggregating from the "one" side (or vice versa). If the relationship works, the aggregation will respect the filter context:

```powershell
# Relationship: Sales[CustomerID] -> Customers[CustomerID]
# Group by customer name (from side), aggregate sales amount (to side)
$cmd.CommandText = "EVALUATE SUMMARIZECOLUMNS('Customers'[Name], ""@TotalSales"", SUM('Sales'[Amount]))"
# If this returns one row per customer with correct totals, the relationship is working
# If all rows show the same total, the relationship is inactive or misconfigured
```

### Check for Referential Integrity Violations Before Creating a Relationship

Before creating a relationship, check if the "many" side has values not present in the "one" side. Orphaned keys cause blank rows in reports and can indicate data quality issues:

```powershell
# Find values in Sales[CustomerID] that don't exist in Customers[CustomerID]
$cmd.CommandText = @"
EVALUATE
FILTER(
    DISTINCT('Sales'[CustomerID]),
    NOT 'Sales'[CustomerID] IN VALUES('Customers'[CustomerID])
)
"@
# If this returns rows, those are orphaned keys -- they will produce blank rows in visuals
# Fix the source data or set RelyOnReferentialIntegrity = true (skips the check, assumes clean data)
```

### Verify a Calculated Table or Column Exists

After creating a calculated table or column and running a `calculate` refresh, confirm it was materialized:

```powershell
# Check row count of a calculated table
$cmd.CommandText = "EVALUATE ROW(""@RowCount"", COUNTROWS('CalculatedTableName'))"

# Check a calculated column has values
$cmd.CommandText = "EVALUATE TOPN(5, SELECTCOLUMNS('Table', ""@Col"", 'Table'[CalculatedColumnName]))"
```
