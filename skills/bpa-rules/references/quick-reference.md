# BPA Rules Quick Reference

## Rule JSON Structure

BPA rules have the following fields:

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `ID` | Yes | string | Unique identifier for the rule (e.g., `META_MEASURE_NO_DESC`) |
| `Name` | Yes | string | Human-readable name displayed in UI |
| `Category` | No | string | Rule grouping (e.g., `Performance`, `DAX Expressions`, `Metadata`) |
| `Description` | No | string | Explanation of why the rule matters. Supports placeholders: `%object%`, `%objectname%`, `%objecttype%` |
| `Severity` | Yes | int | Priority level: `1` (Low), `2` (Medium), `3` (High) |
| `Scope` | Yes | string | Comma-separated list of object types the rule applies to |
| `Expression` | Yes | string | Dynamic LINQ expression evaluated against scoped objects; returns `true` for violations |
| `FixExpression` | No | string | Dynamic LINQ expression to auto-fix violations (e.g., `IsHidden = true`) |
| `CompatibilityLevel` | No | int | Minimum model compatibility level required for the rule to apply |
| `Remarks` | No | string | Additional notes or context about the rule |

```json
{
  "ID": "RULE_PREFIX_NAME",
  "Name": "Human-readable rule name",
  "Category": "Performance|Formatting|Metadata|DAX Expressions|Naming Conventions|Governance",
  "Description": "Explanation of why this rule matters for %objecttype% '%objectname%'",
  "Severity": 2,
  "Scope": "Measure, CalculatedColumn, Table",
  "Expression": "DynamicLINQ expression returning true for violations",
  "FixExpression": "PropertyName = Value",
  "CompatibilityLevel": 1200
}
```

## Valid Scope Values

All valid scope values from the `RuleScope` enum (can be combined with commas):

| Scope | TOM Type | Description |
|-------|----------|-------------|
| `Model` | Model | The entire semantic model |
| `Table` | Table | Regular tables (excludes calculated tables) |
| `CalculatedTable` | CalculatedTable | Tables defined by DAX expressions |
| `Measure` | Measure | DAX measures |
| `DataColumn` | DataColumn | Columns from data source |
| `CalculatedColumn` | CalculatedColumn | Columns defined by DAX |
| `CalculatedTableColumn` | CalculatedTableColumn | Columns in calculated tables |
| `Hierarchy` | Hierarchy | User-defined hierarchies |
| `Level` | Level | Hierarchy levels |
| `Relationship` | SingleColumnRelationship | Table relationships |
| `Partition` | Partition | Table partitions |
| `Perspective` | Perspective | Model perspectives |
| `Culture` | Culture | Translations/cultures |
| `KPI` | KPI | Key Performance Indicators |
| `CalculationGroup` | CalculationGroupTable | Calculation group tables |
| `CalculationItem` | CalculationItem | Items within calculation groups |
| `ProviderDataSource` | ProviderDataSource | Legacy/provider data sources |
| `StructuredDataSource` | StructuredDataSource | M/Power Query data sources |
| `NamedExpression` | NamedExpression | Shared M expressions |
| `ModelRole` | ModelRole | Security roles |
| `ModelRoleMember` | ModelRoleMember | Members of security roles |
| `TablePermission` | TablePermission | RLS table permissions |
| `Variation` | Variation | Column variations |
| `Calendar` | Calendar | Calendar/date tables |
| `UserDefinedFunction` | UserDefinedFunction | DAX user-defined functions |

**Backwards compatibility:** `Column` expands to `DataColumn, CalculatedColumn, CalculatedTableColumn`; `DataSource` expands to `ProviderDataSource`

## Severity Levels

| Level | Name | Meaning |
|-------|------|---------|
| 1 | Low | Informational suggestion, minor improvement |
| 2 | Medium | Warning, should fix for quality |
| 3 | High | Error, must fix for correctness |

## Compatibility Levels

The `CompatibilityLevel` field specifies the minimum model version required. Rules only apply if the model's compatibility level >= the rule's level.

| Level | Platform | Features Introduced |
|-------|----------|---------------------|
| 1200 | AAS/SSAS 2016 | JSON metadata format, base TOM |
| 1400 | AAS/SSAS 2017 | Detail rows, object-level security, ragged hierarchies |
| 1500 | AAS/SSAS 2019 | Calculation groups |
| 1560+ | Power BI | Power BI-specific features begin |
| 1600 | SQL Server 2022 | Enhanced AS features |
| 1702 | Power BI / Fabric | Current Power BI compatibility level (dynamic format strings, field parameters, DAX UDFs, etc.) |

**Note:** Power BI models use 1560+ with current level at 1702. Use `Model.Database.CompatibilityLevel` in expressions to check the model's level.

## Category Prefixes

Common ID prefix conventions:

| Prefix | Category |
|--------|----------|
| `DAX_` | DAX Expressions |
| `META_` | Metadata |
| `PERF_` | Performance |
| `NAME_` | Naming Conventions |
| `LAYOUT_` | Model Layout |
| `FORMAT_` | Formatting |
| `ERR_` | Error Prevention |
| `GOV_` | Governance |
| `MAINT_` | Maintenance |

## Expression Syntax Overview

BPA expressions use Dynamic LINQ with access to TOM (Tabular Object Model) properties.

### Basic Patterns

```csharp
// String checks
string.IsNullOrWhitespace(Description)
Name.StartsWith("_")
Expression.Contains("CALCULATE")

// Boolean checks
IsHidden
not IsHidden
IsVisible and not HasAnnotations

// Numeric checks
ReferencedBy.Count = 0
Columns.Count > 100

// Collection checks
DependsOn.Any()
Columns.All(IsHidden)
```

### Common Properties by Scope

**Measure:**
- `Expression`, `FormatString`, `DisplayFolder`, `Description`
- `IsHidden`, `IsVisible`, `ReferencedBy`, `DependsOn`

**Column:**
- `DataType`, `SourceColumn`, `FormatString`, `SummarizeBy`
- `IsHidden`, `IsKey`, `IsNullable`, `SortByColumn`

**Table:**
- `Columns`, `Measures`, `Partitions`, `IsHidden`
- `CalculationGroup` (for calc group tables)

For complete expression syntax, see `expression-syntax.md`.

## TMDL Annotations

BPA rules can be embedded in TMDL files via annotations:

```tmdl
annotation BestPracticeAnalyzer = [{ "ID": "...", ... }]
annotation BestPracticeAnalyzer_IgnoreRules = {"RuleIDs":["RULE1","RULE2"]}
annotation BestPracticeAnalyzer_ExternalRuleFiles = ["https://..."]
```

For complete annotation patterns, see `tmdl-annotations.md`.
