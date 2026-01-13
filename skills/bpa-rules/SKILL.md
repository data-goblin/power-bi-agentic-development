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

## Quick Reference

### Rule JSON Structure

```json
{
  "ID": "RULE_PREFIX_NAME",
  "Name": "Human-readable rule name",
  "Category": "Performance|Formatting|Metadata|DAX Expressions|Naming Conventions",
  "Description": "Explanation of why this rule matters",
  "Severity": 1,
  "Scope": "Measure, CalculatedColumn, Table",
  "Expression": "DynamicLINQ expression returning true for violations",
  "FixExpression": "PropertyName = Value",
  "CompatibilityLevel": 1200
}
```

### Common Scopes

| Scope | Description |
|-------|-------------|
| `Model` | The entire model |
| `Table` | Tables (including calculated tables) |
| `Column` | All columns |
| `CalculatedColumn` | Calculated columns only |
| `Measure` | Measures |
| `Hierarchy` | Hierarchies |
| `Relationship` | Relationships |
| `Partition` | Partitions |
| `DataSource` | Data sources |
| `Role` | Security roles |
| `Perspective` | Perspectives |
| `Culture` | Cultures/translations |
| `CalculationGroup` | Calculation groups |
| `CalculationItem` | Calculation items |
| `UserDefinedFunction` | DAX UDFs |
| `Calendar` | Calendar tables |

### Severity Levels

| Level | Meaning |
|-------|---------|
| 1 | Informational / suggestion |
| 2 | Warning / should fix |
| 3 | Error / must fix |

### Category Prefixes

| Prefix | Category |
|--------|----------|
| `DAX_` | DAX Expressions |
| `META_` | Metadata |
| `PERF_` | Performance |
| `NAME_` | Naming Conventions |
| `LAYOUT_` | Model Layout |
| `FORMAT_` | Formatting |

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

- **`references/rule-schema.md`** - Complete BPA rule JSON schema and field descriptions
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

- [Tabular Editor BPA Documentation](https://docs.tabulareditor.com/common/using-bpa.html)
- [BPA Rules Repository](https://github.com/TabularEditor/BestPracticeRules)
- [Sample Rules Expressions](https://docs.tabulareditor.com/common/using-bpa-sample-rules-expressions.html)
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
