# Annotations and Extended Properties Reference

Annotations are key-value metadata pairs attachable to any TOM object (model, table, column, measure, partition, expression, role, etc.). They store metadata consumed by Power BI, Tabular Editor, DAX libraries, and custom tooling.

All examples assume `$model` is already connected (see SKILL.md section 3).


## How Annotations Work

Annotations are strings. The key is the name; the value can be plain text, JSON, a number, or anything serializable as a string. They are invisible to report consumers and DAX queries; they only affect tooling behaviour.

Extended properties (`extendedProperty`) are a related but distinct concept; they use typed values (JSON, string) and are consumed by the engine rather than tooling. The most important extended property is `ParameterMetadata` on field parameters.


## CRUD Operations

### Create

```powershell
$ann = New-Object Microsoft.AnalysisServices.Tabular.Annotation
$ann.Name = "MyApp_Category"
$ann.Value = "Revenue"
$model.Tables["Sales"].Measures["Total Revenue"].Annotations.Add($ann)

# Shorthand for simple annotations
$model.Tables["Sales"].Annotations.Add(
    (New-Object Microsoft.AnalysisServices.Tabular.Annotation -Property @{ Name = "TabularEditor_TableGroup"; Value = "02. Fact Tables" })
)
```

### Read

```powershell
# All annotations on an object
foreach ($ann in $model.Tables["Sales"].Annotations) {
    Write-Output "  [$($ann.Name)] = $($ann.Value)"
}

# Specific annotation
$val = $model.Tables["Sales"].Annotations["TabularEditor_TableGroup"]?.Value
```

### Enumerate all annotations across the model

```powershell
# Model-level
foreach ($ann in $model.Annotations) { Write-Output "MODEL: [$($ann.Name)] = $($ann.Value)" }

# Table-level
foreach ($t in $model.Tables) {
    foreach ($ann in $t.Annotations) { Write-Output "TABLE [$($t.Name)]: [$($ann.Name)] = $($ann.Value)" }
    foreach ($c in $t.Columns) {
        foreach ($ann in $c.Annotations) { Write-Output "  COL [$($t.Name)].[$($c.Name)]: [$($ann.Name)] = $($ann.Value)" }
    }
    foreach ($m in $t.Measures) {
        foreach ($ann in $m.Annotations) { Write-Output "  MEAS [$($t.Name)].[$($m.Name)]: [$($ann.Name)] = $($ann.Value)" }
    }
}
```

### Update

```powershell
$model.Tables["Sales"].Annotations["TabularEditor_TableGroup"].Value = "01. Dimension Tables"
```

### Delete

```powershell
$ann = $model.Tables["Sales"].Annotations["MyApp_Category"]
$model.Tables["Sales"].Annotations.Remove($ann)
```


## Standard Power BI Annotations

These are set automatically by Power BI Desktop and the service. Modifying them changes PBI behaviour.

| Annotation | Scope | Purpose | Example Value |
|---|---|---|---|
| `SummarizationSetBy` | Column | Controls who set the summarize-by | `Automatic`, `User` |
| `PBI_FormatHint` | Column, Measure | UI format hint | `{"isGeneralNumber":true}`, `{"isText":true}` |
| `UnderlyingDateTimeDataType` | Column | Date subtype for the PBI engine | `Date`, `DateTimeZone` |
| `PBI_NavigationStepName` | Table, Expression | Power Query navigation marker | `Navigation` |
| `PBI_ResultType` | Table, Expression | Power Query result type | `Table`, `Text`, `DateTime` |
| `PBI_QueryOrder` | Model | Display order of tables/expressions | JSON array of names |
| `PBI_QueryGroupOrder` | Query Group | Order of query groups | Integer (`0`, `1`, `2`) |
| `PBI_Id` | Role | Unique identifier for security roles | Hex GUID string |
| `__PBI_TimeIntelligenceEnabled` | Model | Auto date/time feature toggle | `0` (disabled), `1` (enabled) |


## Tabular Editor Annotations

Annotations consumed by Tabular Editor for organization and serialization.

### Table Groups (`TabularEditor_TableGroup`)

Organizes tables into logical categories displayed in Tabular Editor's model tree. Does not affect Power BI reports or the engine; purely organizational for developers.

```powershell
# Assign a table to a group
$model.Tables["Sales"].Annotations.Add(
    (New-Object Microsoft.AnalysisServices.Tabular.Annotation -Property @{
        Name = "TabularEditor_TableGroup"
        Value = "02. Fact Tables"
    })
)
```

Common group naming convention (numbered prefix for ordering):

| Group | Tables |
|---|---|
| `00. Measure Tables` | Dedicated measure tables (`__Measures`, etc.) |
| `01. Dimension Tables` | Dimension/lookup tables |
| `02. Fact Tables` | Fact/transaction tables |
| `03. Other Tables` | Bridge tables, helper tables |
| `04. Selection Tables` | Slicer/parameter selection tables |
| `05. Parameters` | Field parameter tables |
| `06. Calculation Groups` | Calculation group tables |

```powershell
# Bulk-assign table groups by naming pattern
foreach ($t in $model.Tables) {
    $group = if ($t.Name -match '^__') { "00. Measure Tables" }
             elseif ($t.CalculationGroup -ne $null) { "06. Calculation Groups" }
             elseif ($t.Name -match '^FP ') { "05. Parameters" }
             elseif ($t.Name -match '^Z\d') { "06. Calculation Groups" }
             else { $null }
    if ($group) {
        $existing = $t.Annotations["TabularEditor_TableGroup"]
        if ($existing) { $existing.Value = $group }
        else {
            $t.Annotations.Add(
                (New-Object Microsoft.AnalysisServices.Tabular.Annotation -Property @{
                    Name = "TabularEditor_TableGroup"; Value = $group
                })
            )
        }
    }
}
```

### Serialization Options (`TabularEditor_SerializeOptions`)

Model-level annotation controlling how Tabular Editor serializes the model to disk (BIM/TMDL). Only relevant when using Tabular Editor's Save to Folder; do not create manually.

```powershell
# Read (informational; do not modify unless migrating TE settings)
$opts = $model.Annotations["TabularEditor_SerializeOptions"]?.Value
if ($opts) { $opts | ConvertFrom-Json | Format-List }
```


## Auto Date/Time (`__PBI_TimeIntelligenceEnabled`)

Controls whether Power BI auto-generates hidden date tables for every date column. Disabling this is best practice for production models; use explicit date tables instead.

```powershell
# Check current state
$val = $model.Annotations["__PBI_TimeIntelligenceEnabled"]?.Value
Write-Output "Auto date/time: $(if ($val -eq '0') { 'DISABLED' } else { 'ENABLED' })"

# Disable auto date/time
$ann = $model.Annotations["__PBI_TimeIntelligenceEnabled"]
if ($ann) { $ann.Value = "0" }
else {
    $model.Annotations.Add(
        (New-Object Microsoft.AnalysisServices.Tabular.Annotation -Property @{
            Name = "__PBI_TimeIntelligenceEnabled"; Value = "0"
        })
    )
}
```

When disabled, remove the auto-generated `LocalDateTable_*` and `DateTableTemplate_*` tables that PBI may have already created, or they persist as orphaned metadata.


## Field Parameters

Field parameters are calculated tables with a specific structure and an `extendedProperty` (not annotation) called `ParameterMetadata` that tells Power BI to treat the table as a field parameter slicer.

### Structure

A field parameter table has three columns:

| Column | Purpose | Properties |
|---|---|---|
| Display name column | Shown in slicer; user-facing | `sortByColumn` = order column; `relatedColumnDetails.groupByColumn` = fields column |
| Fields column | Contains `NAMEOF()` references to actual measures/columns | Hidden; has `extendedProperty ParameterMetadata` |
| Order column | Sort order integer | Hidden |

The partition is a calculated table (DAX) with rows of tuples: `{("Label", NAMEOF([Measure]), 0), ...}`

### Create a field parameter via TOM

```powershell
# Define the measures to include
$measures = @(
    @{ Label = "Revenue"; Ref = "[Total Revenue]"; Order = 0 },
    @{ Label = "Cost"; Ref = "[Total Cost]"; Order = 1 },
    @{ Label = "Margin"; Ref = "[Gross Margin]"; Order = 2 }
)

# Build DAX expression
$rows = ($measures | ForEach-Object {
    "    (`"$($_.Label)`", NAMEOF($($_.Ref)), $($_.Order))"
}) -join ",`n"
$daxExpr = "{`n$rows`n}"

# Create the table
$fpTable = New-Object Microsoft.AnalysisServices.Tabular.Table
$fpTable.Name = "FP - Metrics"

# Partition (calculated)
$partition = New-Object Microsoft.AnalysisServices.Tabular.Partition
$partition.Name = "FP - Metrics"
$partition.Source = New-Object Microsoft.AnalysisServices.Tabular.CalculatedPartitionSource
$partition.Source.Expression = $daxExpr
$fpTable.Partitions.Add($partition)

$model.Tables.Add($fpTable)
$model.SaveChanges()

# After SaveChanges, the engine auto-infers 3 CalculatedTableColumns.
# Refresh to populate them:
$model.RequestRefresh([Microsoft.AnalysisServices.Tabular.RefreshType]::Calculate)
$model.SaveChanges()

# Now configure the columns
$fpTable = $model.Tables["FP - Metrics"]
$nameCol = $fpTable.Columns | Where-Object { $_.SourceColumn -eq "[Value1]" }
$fieldsCol = $fpTable.Columns | Where-Object { $_.SourceColumn -eq "[Value2]" }
$orderCol = $fpTable.Columns | Where-Object { $_.SourceColumn -eq "[Value3]" }

# Rename columns
$nameCol.Name = "FP - Metrics"
$fieldsCol.Name = "FP - Metrics Fields"
$orderCol.Name = "FP - Metrics Order"

# Configure visibility
$fieldsCol.IsHidden = $true
$orderCol.IsHidden = $true

# Sort name column by order column
$nameCol.SortByColumn = $orderCol

# Set the groupBy relationship (name column grouped by fields column)
$nameCol.RelatedColumnDetails = New-Object Microsoft.AnalysisServices.Tabular.RelatedColumnDetails
$nameCol.RelatedColumnDetails.GroupByColumn = $fieldsCol

# Set the ParameterMetadata extended property on the fields column
$fieldsCol.SetExtendedProperty(
    "ParameterMetadata",
    '{"version":3,"kind":2}',
    [Microsoft.AnalysisServices.Tabular.ExtendedPropertyType]::Json
)

# Sort fields column by order column too
$fieldsCol.SortByColumn = $orderCol

# Table group annotation (optional; for Tabular Editor organization)
$fpTable.Annotations.Add(
    (New-Object Microsoft.AnalysisServices.Tabular.Annotation -Property @{
        Name = "TabularEditor_TableGroup"; Value = "05. Parameters"
    })
)

$model.SaveChanges()
```

### Read field parameter details

```powershell
foreach ($t in $model.Tables) {
    foreach ($c in $t.Columns) {
        $ep = $c.ExtendedProperties | Where-Object { $_.Name -eq "ParameterMetadata" }
        if ($ep) {
            Write-Output "FIELD PARAM: [$($t.Name)] Fields column: [$($c.Name)]"
            Write-Output "  Metadata: $($ep.Value)"
            # Find the display column (the one that groups by this column)
            $displayCol = $t.Columns | Where-Object {
                $_.RelatedColumnDetails -and $_.RelatedColumnDetails.GroupByColumn -eq $c
            }
            if ($displayCol) {
                Write-Output "  Display column: [$($displayCol.Name)]"
            }
        }
    }
}
```

### ParameterMetadata values

| Field | Value | Meaning |
|---|---|---|
| `version` | `3` | Metadata schema version |
| `kind` | `2` | Field parameter (measures/columns); `kind: 1` is a numeric range parameter |


## DAX Library Annotations

Used by DAX library packages (reusable DAX function collections) to track package identity and version. Only relevant when managing DAX library functions.

| Annotation | Scope | Purpose | Example |
|---|---|---|---|
| `DAXLIB_PackageId` | Function | Package identifier | `DaxLib.FormatString` |
| `DAXLIB_PackageVersion` | Function | Semantic version | `1.0.0-beta` |


## Query Groups

Query groups organize named expressions (M queries/parameters) into folders in the Power Query editor. They are model-level objects with an ordering annotation.

### Create

```powershell
# Add a query group
$qg = New-Object Microsoft.AnalysisServices.Tabular.QueryGroup
$qg.Folder = "Parameters"
$model.QueryGroups.Add($qg)

# Set the display order annotation
$qg.Annotations.Add(
    (New-Object Microsoft.AnalysisServices.Tabular.Annotation -Property @{
        Name = "PBI_QueryGroupOrder"; Value = "0"
    })
)

# Assign an expression to a query group (reference the QueryGroup object, not a string)
$targetGroup = $model.QueryGroups | Where-Object { $_.Folder -eq "Parameters" }
$model.Expressions["RangeStart"].QueryGroup = $targetGroup
```

### Read

```powershell
foreach ($qg in $model.QueryGroups) {
    $order = $qg.Annotations["PBI_QueryGroupOrder"]
    $orderVal = if ($order) { $order.Value } else { "n/a" }
    Write-Output "Query Group: [$($qg.Folder)] Order=$orderVal"
}

# Expressions and their groups
foreach ($e in $model.Expressions) {
    $groupName = if ($e.QueryGroup) { $e.QueryGroup.Folder } else { "(ungrouped)" }
    Write-Output "  [$($e.Name)] -> $groupName"
}
```


## Custom Annotations for Tooling

Create application-specific annotations with a namespaced prefix to avoid collisions:

```powershell
# Custom annotation with a namespace prefix
$model.Annotations.Add(
    (New-Object Microsoft.AnalysisServices.Tabular.Annotation -Property @{
        Name = "MyOrg_ModelOwner"; Value = "data-team@example.com"
    })
)

# Store structured metadata as JSON
$model.Tables["Sales"].Annotations.Add(
    (New-Object Microsoft.AnalysisServices.Tabular.Annotation -Property @{
        Name = "MyOrg_DataLineage"
        Value = '{"source":"ERP","schema":"dbo","lastVerified":"2026-01-15"}'
    })
)
```

Naming conventions:
- Prefix with an org/tool namespace to avoid collisions (`MyOrg_`, `DataGoblins_`)
- PBI reserves annotations starting with `PBI_` or `__PBI_`
- Tabular Editor uses `TabularEditor_`
- Do not overwrite annotations with unknown prefixes; they may be consumed by other tools


## Best Practices

1. **Disable auto date/time** (`__PBI_TimeIntelligenceEnabled = 0`) on all production models; use explicit date tables
2. **Set table groups** (`TabularEditor_TableGroup`) for developer ergonomics in Tabular Editor
3. **Use namespaced prefixes** for custom annotations to avoid collisions
4. **Treat PBI_ annotations as read-only** unless deliberately overriding PBI behaviour
5. **Field parameters require both** the `ParameterMetadata` extended property AND the correct column relationships (`sortByColumn`, `relatedColumnDetails.groupByColumn`, hidden flags)
6. **Query groups** with `PBI_QueryGroupOrder` keep the Power Query editor organized; number them sequentially
