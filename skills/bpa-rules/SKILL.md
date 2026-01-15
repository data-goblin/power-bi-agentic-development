---
name: bpa-rules
description: This skill should be used when the user asks to "create a BPA rule", "write a Best Practice Analyzer rule", "improve a BPA expression", "fix expression for BPA", "analyze BPA annotations", "check model for best practices", or mentions Tabular Editor BPA rules. Provides guidance for creating, improving, and understanding Best Practice Analyzer rules for Power BI semantic models.
---

# Best Practice Analyzer Rules

Expert guidance for creating and improving BPA (Best Practice Analyzer) rules for Tabular Editor and Power BI semantic models.

## When to Use This Skill

Activate automatically when tasks involve:

- Creating new BPA rules for semantic model validation
- Improving or debugging BPA rule expressions
- Writing FixExpression to auto-remediate rule violations
- Understanding BPA annotations in TMDL files
- Analyzing a semantic model against best practices
- Converting ad-hoc checks into reusable BPA rules

## Critical

- Always validate rule expressions before suggesting them
- Test expressions against the target scope (Measure, Column, Table, etc.)
- Ensure FixExpression does not cause data loss or break the model
- Consider CompatibilityLevel when using newer TOM properties

## About BPA rules

- BPA rules define automatic tests for semantic models in Power BI and Fabric for QA/QC
- BPA rules are used by Tabular Editor 2, 3, CLI, or Fabric notebooks
- Rule expressions are defined in C# for Tabular Editor or Python for Fabric Notebooks
- BPA rules are better defined and used by Tabular Editor because they are actionable with ability to ignore or fix, and they are integrated with the IDE

## File Locations

BPA rules can exist in multiple locations (evaluated in order of priority):

| Location | Path / Source | Description |
|----------|---------------|-------------|
| **Built-in Best Practices** | Internal to TE3 | Default rules bundled with Tabular Editor 3 |
| **URL** | Any valid URL (e.g., `https://raw.githubusercontent.com/TabularEditor/BestPracticeRules/master/BPARules-standard.json`) | Remote rule collections loaded from web |
| **Rules within current model** | `Model.SetAnnotation("BestPracticeAnalyzer", ...)` | Rules embedded in model.bim via annotation |
| **Rules for local user** | `%LocalAppData%\TabularEditor3\BPARules.json` | User-specific rules on Windows |
| **Rules on local machine** | `%ProgramData%\TabularEditor3\BPARules.json` | Machine-wide rules for all users |

**File format:** All locations use the same JSON array format containing rule objects.

**Priority:** When the same rule ID exists in multiple locations, rules are merged with local rules taking precedence over remote/built-in rules.

## Quick Reference

### Rule JSON Structure

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

### Valid Scope Values

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

### Severity Levels

| Level | Name | Meaning |
|-------|------|---------|
| 1 | Low | Informational suggestion, minor improvement |
| 2 | Medium | Warning, should fix for quality |
| 3 | High | Error, must fix for correctness |

### Compatibility Levels

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

### Category Prefixes

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

For complete expression syntax, see `references/expression-syntax.md`.

## TMDL Annotations

BPA rules can be embedded in TMDL files via annotations:

```tmdl
annotation BestPracticeAnalyzer = [{ "ID": "...", ... }]
annotation BestPracticeAnalyzer_IgnoreRules = {"RuleIDs":["RULE1","RULE2"]}
annotation BestPracticeAnalyzer_ExternalRuleFiles = ["https://..."]
```

For complete annotation patterns, see `references/tmdl-annotations.md`.

## Workflow

### Creating a New Rule

1. Identify the best practice to enforce
2. Determine the appropriate Scope
3. Write the Expression to detect violations
4. Optionally write a FixExpression for auto-remediation
5. Test against sample models
6. Add to rule collection

### Improving an Existing Rule

1. Understand the current rule's intent
2. Identify false positives or missed cases
3. Refine the Expression logic
4. Verify FixExpression doesn't cause side effects
5. Test thoroughly

## Additional Resources

### Reference Files

For detailed syntax and patterns, consult:

- **`schema/bparules-schema.json`** - JSON Schema for validating BPA rule files (Draft-07) *(temporary location)*
- **`references/rule-schema.md`** - Human-readable BPA rule field descriptions
- **`references/expression-syntax.md`** - Dynamic LINQ expression syntax, TOM properties, Tokenize(), DependsOn, ReferencedBy
- **`references/tmdl-annotations.md`** - BPA annotations in TMDL format

### Example Files

Working examples in `examples/`:

- **`examples/comprehensive-rules.json`** - 30+ production-ready rules across all categories
- **`examples/model-with-bpa-annotations.tmdl`** - TMDL file showing all annotation patterns

### Scripts

Utility scripts in `scripts/`:

- **`scripts/validate_rules.py`** - Validate BPA rule JSON files for schema compliance

### Related Commands

- **`/suggest-rule`** - Generate BPA rules from descriptions

### Related Agents

- **`bpa-expression-helper`** - Debug and improve BPA expressions

### External References

- [Tabular Editor BPA Getting Started](https://docs.tabulareditor.com/getting-started/bpa.html)
- [Tabular Editor BPA View](https://docs.tabulareditor.com/features/views/bpa-view.html)
- [BPA Sample Rule Expressions](https://docs.tabulareditor.com/features/using-bpa-sample-rules-expressions.html)
- [TabularEditor BPA Source Code](https://github.com/TabularEditor/TabularEditor/tree/master/TabularEditor/BestPracticeAnalyzer)
- [BPA Rules Repository](https://github.com/TabularEditor/BestPracticeRules)
- [TabularEditor Docs Repository](https://github.com/TabularEditor/TabularEditorDocs)
- [Power BI Semantic Model Checklist](https://data-goblins.com/dataset-checklist)

## Example Rules

### Measure Without Description

```json
{
  "ID": "META_MEASURE_NO_DESCRIPTION",
  "Name": "Measure has no description",
  "Category": "Metadata",
  "Description": "All measures should have descriptions for documentation.",
  "Severity": 2,
  "Scope": "Measure",
  "Expression": "string.IsNullOrWhitespace(Description)",
  "FixExpression": null
}
```

### Hidden Unused Column

```json
{
  "ID": "PERF_UNUSED_HIDDEN_COLUMN",
  "Name": "Remove hidden columns not used",
  "Category": "Performance",
  "Description": "Hidden columns with no references waste memory.",
  "Severity": 3,
  "Scope": "Column",
  "Expression": "IsHidden and ReferencedBy.Count = 0 and not UsedInRelationships.Any()",
  "FixExpression": "Delete()"
}
```
