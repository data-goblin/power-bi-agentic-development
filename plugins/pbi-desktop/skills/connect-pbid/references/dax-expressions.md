# DAX Expression Locations in a Semantic Model

DAX appears in many places across a semantic model, each with different rules for what is valid. Understanding where DAX lives and how to read/write each location via TOM is essential for model modification.

All examples assume `$model` is already connected (see SKILL.md section 3).


## Expression Types at a Glance

| Location | TOM Property | Returns | Context | Refresh Needed |
|---|---|---|---|---|
| Measure expression | `Measure.Expression` | Scalar | Filter context from visuals | No |
| Calculated column | `CalculatedColumn.Expression` | Scalar (per row) | Row context of host table | `calculate` |
| Calculated table | `CalculatedPartitionSource.Expression` | Table | No context (model-level) | `calculate` |
| Calculation item | `CalculationItem.Expression` | Depends on `SELECTEDMEASURE()` | Filter context | No |
| Format string (static) | `Measure.FormatString` | n/a (format pattern) | n/a | No |
| Format string (dynamic) | `FormatStringDefinition.Expression` | String | Filter context | No |
| Detail rows | `DetailRowsDefinition.Expression` | Table | Filter context from drillthrough | No |
| RLS filter | `TablePermission.FilterExpression` | Boolean | Row context of filtered table | No |
| DAX UDF | `UserDefinedFunction.Expression` | Scalar or Table | Depends on call site | No |
| KPI status/target/trend | `KPI.StatusExpression`, `.TargetExpression`, `.TrendExpression` | Scalar | Filter context | No |


## Measure Expressions

The most common DAX location. Evaluated at query time in filter context; never materialized.

```powershell
# Read
$expr = $model.Tables["Sales"].Measures["Total Revenue"].Expression

# Write
$model.Tables["Sales"].Measures["Total Revenue"].Expression = "SUM('Sales'[Amount])"
```

**Rules:** Must return a scalar value. Can reference columns (fully qualified: `'Table'[Column]`), other measures (unqualified: `[Measure]`), and use any DAX function. Cannot use row context functions like `RELATED()` without an iterator.


## Calculated Column Expressions

Evaluated row-by-row in the host table's row context. Materialized in storage after refresh.

```powershell
# Read
$cc = $model.Tables["Customers"].Columns | Where-Object { $_ -is [Microsoft.AnalysisServices.Tabular.CalculatedColumn] }
foreach ($c in $cc) { Write-Output "[$($c.Name)] = $($c.Expression)" }

# Write
$col = [Microsoft.AnalysisServices.Tabular.CalculatedColumn]$model.Tables["Customers"].Columns["Full Name"]
$col.Expression = "'Customers'[FirstName] & "" "" & 'Customers'[LastName]"
```

**Rules:** Has implicit row context for the host table. Can use `RELATED()` to access columns from related tables (following relationships). Cannot use `CALCULATE()` without explicit context transition. Must return a scalar.


## Calculated Table Expressions

Evaluated at model level with no implicit filter or row context. Returns a full table.

```powershell
# Read
foreach ($t in $model.Tables) {
    foreach ($p in $t.Partitions) {
        if ($p.Source -is [Microsoft.AnalysisServices.Tabular.CalculatedPartitionSource]) {
            Write-Output "[$($t.Name)] = $([Microsoft.AnalysisServices.Tabular.CalculatedPartitionSource]$p.Source).Expression"
        }
    }
}

# Write
$partition = $model.Tables["Date"].Partitions["Date"]
$src = [Microsoft.AnalysisServices.Tabular.CalculatedPartitionSource]$partition.Source
$src.Expression = "CALENDAR(DATE(2020,1,1), DATE(2030,12,31))"
```

**Rules:** Must return a table. Common functions: `CALENDAR`, `CALENDARAUTO`, `DATATABLE`, `GENERATESERIES`, `SELECTCOLUMNS`, `UNION`, `ROW` (single-row table), literal table constructors `{(...), ...}`. Field parameters use literal tuple constructors with `NAMEOF()`.


## Calculation Item Expressions

Part of calculation groups. Use `SELECTEDMEASURE()` to reference whatever measure the calc group modifies.

```powershell
# Read
$cgTable = $model.Tables | Where-Object { $_.CalculationGroup -ne $null } | Select-Object -First 1
foreach ($item in $cgTable.CalculationGroup.CalculationItems) {
    Write-Output "[$($item.Name)] = $($item.Expression)"
}

# Write
$item = $cgTable.CalculationGroup.CalculationItems["YTD"]
$item.Expression = "CALCULATE(SELECTEDMEASURE(), DATESYTD('Date'[Date]))"
```

**Rules:** Must use `SELECTEDMEASURE()` to reference the base measure being modified. Can also use `SELECTEDMEASURENAME()`, `SELECTEDMEASUREFORMATSTRING()`, `ISSELECTEDMEASURE()`. Runs in the filter context of the visual.


## Format String Expressions (Dynamic)

DAX expression that returns a format string. Requires compatibility level 1470+.

```powershell
# Read
$m = $model.Tables["Sales"].Measures["Dynamic Metric"]
if ($m.FormatStringDefinition -and $m.FormatStringDefinition.Expression) {
    Write-Output "Dynamic format: $($m.FormatStringDefinition.Expression)"
}

# Write
$fsd = New-Object Microsoft.AnalysisServices.Tabular.FormatStringDefinition
$fsd.Expression = 'IF(SELECTEDVALUE(''Metric''[Type]) = "Pct", "0.0%", "$#,0")'
$m.FormatStringDefinition = $fsd
```

**Rules:** Must return a string that is a valid format pattern. Evaluated in filter context. Common patterns: switching format based on a slicer selection, or using `SELECTEDMEASUREFORMATSTRING()` in calculation items.

Calculation items can also have their own `FormatStringDefinition`:

```powershell
$item = $cgTable.CalculationGroup.CalculationItems["YoY Change"]
$itemFsd = New-Object Microsoft.AnalysisServices.Tabular.FormatStringDefinition
$itemFsd.Expression = '"0.0%"'
$item.FormatStringDefinition = $itemFsd
```


## Static Format Strings

Not DAX; a .NET format pattern string. Set on measures and columns.

```powershell
$m.FormatString = "#,0.00"       # two decimal places
$m.FormatString = "$#,0"         # currency
$m.FormatString = "0.0%"         # percentage
$m.FormatString = "yyyy-MM-dd"   # date
```


## Detail Rows Expressions

Defines what rows appear when a user drills through a measure. Must return a table.

```powershell
# Read
$m = $model.Tables["Sales"].Measures["Total Revenue"]
if ($m.DetailRowsDefinition) {
    Write-Output "Detail rows: $($m.DetailRowsDefinition.Expression)"
}

# Write
$drd = New-Object Microsoft.AnalysisServices.Tabular.DetailRowsDefinition
$drd.Expression = 'SELECTCOLUMNS(''Sales'', "Product", RELATED(''Products''[Name]), "Amount", ''Sales''[Amount], "Date", ''Sales''[OrderDate])'
$m.DetailRowsDefinition = $drd
```

**Rules:** Must return a table. Evaluated in the filter context of the drillthrough action. Can use `RELATED()` since it iterates over a fact table.

Tables can also have a default detail rows expression:

```powershell
$table = $model.Tables["Sales"]
$tableDrd = New-Object Microsoft.AnalysisServices.Tabular.DetailRowsDefinition
$tableDrd.Expression = 'SELECTCOLUMNS(''Sales'', "Product", RELATED(''Products''[Name]), "Amount", ''Sales''[Amount])'
$table.DefaultDetailRowsDefinition = $tableDrd
```


## RLS Filter Expressions

Row-Level Security expressions filter rows visible to a role. Evaluated in row context of the target table.

```powershell
# Read
foreach ($role in $model.Roles) {
    foreach ($tp in $role.TablePermissions) {
        if ($tp.FilterExpression) {
            Write-Output "Role [$($role.Name)] on [$($tp.Table.Name)]: $($tp.FilterExpression)"
        }
    }
}

# Write
$tp = $model.Roles["Region Filter"].TablePermissions | Where-Object { $_.Table.Name -eq "Sales" }
$tp.FilterExpression = "'Sales'[Region] = USERPRINCIPALNAME()"
```

**Rules:** Must return a boolean. Has implicit row context for the filtered table. Can use `USERNAME()`, `USERPRINCIPALNAME()`, `CUSTOMDATA()`. Can reference other tables via `RELATED()` or `LOOKUPVALUE()`. Cannot use measures directly.


## DAX User Defined Function Expressions

Reusable parameterized DAX callable from measures. Requires compatibility level 1702+.

```powershell
# Read
if ($model.PSObject.Properties['UserDefinedFunctions']) {
    foreach ($udf in $model.UserDefinedFunctions) {
        Write-Output "[$($udf.Name)] = $($udf.Expression)"
    }
}

# Write (see tom-object-types.md for full UDF creation including parameters)
$udf = $model.UserDefinedFunctions["PriorYearValue"]
$udf.Expression = '(expression : Scalar Variant Expr, dateColumn : AnyRef) => CALCULATE(expression, SAMEPERIODLASTYEAR(dateColumn))'
```

**Rules:** Function body follows the `(params) => body` syntax. Parameters have type hints (`Scalar`, `Table`, `AnyRef`) and evaluation modes (`Val`, `Expr`). See tom-object-types.md for the full parameter type reference.


## KPI Expressions

Legacy KPI objects on measures. Three expression slots:

```powershell
$kpi = $model.Tables["Sales"].Measures["Revenue vs Target"].KPI
# Target: scalar expression for the goal
$kpi.TargetExpression = "1.0"
# Status: returns -1, 0, or 1 (bad, neutral, good)
$kpi.StatusExpression = 'IF([Revenue vs Target] >= 1, 1, IF([Revenue vs Target] >= 0.8, 0, -1))'
# Trend: optional; returns -1, 0, or 1
$kpi.TrendExpression = 'IF([Revenue vs Target] > [Revenue vs Target PY], 1, -1)'
```

**Note:** KPIs are a legacy SSAS feature. Power BI visuals ignore them; use conditional formatting measures instead.


## Summary: Validation Patterns

Before saving any DAX expression, test it against the live model:

| Expression Type | Validation Wrapper |
|---|---|
| Measure | `EVALUATE ROW("@Test", <expr>)` |
| Calculated column | `EVALUATE ROW("@Test", CALCULATE(<expr>))` (approximate) |
| Calculated table | `EVALUATE <expr>` or `EVALUATE ROW("@Count", COUNTROWS(<expr>))` |
| RLS filter | `EVALUATE CALCULATETABLE(ROW("@OK", 1), <expr>)` |
| Format string | `EVALUATE ROW("@Fmt", <expr>)` -- check it returns a string |
| Detail rows | `EVALUATE <expr>` -- check it returns a table |
