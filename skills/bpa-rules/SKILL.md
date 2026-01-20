---
name: bpa-rules
description: This skill should be used when the user asks to "create a BPA rule", "write a Best Practice Analyzer rule", "improve a BPA expression", "fix expression for BPA", "analyze BPA annotations", "check model for best practices", "audit BPA rules", "discover BPA rules", "list all BPA rules", "validate BPA rules", or mentions Tabular Editor BPA rules. Provides guidance for creating, improving, auditing, and understanding Best Practice Analyzer rules for Power BI semantic models.
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
- Auditing or discovering all BPA rules across sources (built-in, URL, model, user, machine)

## Critical

- Always validate rule expressions before suggesting them
- Test expressions against the target scope (Measure, Column, Table, etc.)
- Ensure FixExpression does not cause data loss or break the model
- Consider CompatibilityLevel when using newer TOM properties

## Tabular Editor Compatibility

BPA rule files must follow specific formatting requirements for Tabular Editor to load them correctly. Files that don't follow these rules may show empty rule collections or fail to load entirely.

### Line Endings (CRLF Required)

Tabular Editor on Windows requires **Windows line endings (CRLF, `\r\n`)**. Files with Unix line endings (LF only) will fail to load or show empty rule collections.

To convert a file to CRLF:
```bash
# macOS/Linux
sed -i 's/$/\r/' rules.json

# Or use the validation script
python scripts/validate_rules.py --fix rules.json
```

### File Paths

When adding rule files in Tabular Editor:
- **Use absolute paths** (e.g., `C:\BPARules\my-rules.json`)
- **Avoid relative paths** with `..\..\..` - TE may fail to resolve these
- URLs work reliably (e.g., `https://raw.githubusercontent.com/...`)

### JSON Format Requirements

**No extra properties:** TE's JSON parser is strict. Only use allowed fields:
- `ID`, `Name`, `Category`, `Description`, `Severity`, `Scope`, `Expression`
- `FixExpression`, `CompatibilityLevel`, `Source`, `Remarks`

**Avoid these patterns:**
```json
// BAD: _comment fields not allowed
{ "_comment": "Section header", "ID": "RULE1", ... }

// BAD: Runtime fields (TE adds these, don't include them)
{ "ID": "RULE1", "ObjectCount": 0, "ErrorMessage": null, ... }

// GOOD: FixExpression can be null or omitted
{ "ID": "RULE1", "FixExpression": null, ... }
{ "ID": "RULE1", "Name": "...", "Severity": 2, "Scope": "Measure", "Expression": "..." }
```

**Note:** `FixExpression: null` is valid. `ErrorMessage` and `ObjectCount` are runtime fields that TE adds - do not include them in rule definitions.

### Regex Expression Syntax

When using `RegEx.IsMatch()` in expressions:

**No `@` prefix:** Do not use C# verbatim string prefix
```csharp
// BAD: @ prefix not supported
RegEx.IsMatch(Expression, @"FILTER\s*\(\s*ALL")

// GOOD: Standard escaping
RegEx.IsMatch(Expression, "FILTER\\s*\\(\\s*ALL")
```

**No RegexOptions parameter:** TE doesn't support the options parameter
```csharp
// BAD: RegexOptions not supported
RegEx.IsMatch(Name, "^DATE$", RegexOptions.IgnoreCase)

// GOOD: Use inline flag or pattern only
RegEx.IsMatch(Name, "(?i)^DATE$")
RegEx.IsMatch(Name, "^(DATE|date|Date)$")
```

### Correct Scope Names

Use the exact scope names from the TOM enum. Common mistakes:

| Wrong | Correct |
|-------|---------|
| `Role` | `ModelRole` |
| `Member` | `ModelRoleMember` |
| `Expression` | `NamedExpression` |
| `DataSource` | `ProviderDataSource` or `StructuredDataSource` |

**Note:** `Column` is valid as a backwards-compatible alias for `DataColumn, CalculatedColumn, CalculatedTableColumn`.

### Validation Script

Use the validation script to check and fix TE compatibility issues:

```bash
# Check for issues
python scripts/validate_rules.py rules.json

# Auto-fix issues (CRLF, remove nulls, remove _comment)
python scripts/validate_rules.py --fix rules.json
```

The script checks:
- Line endings (CRLF)
- No `_comment` fields
- No `null` values for optional fields
- Valid scope names
- Expression syntax warnings

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
| **Rules within current model** | See below | Rules embedded in model metadata |
| **Rules for local user** | `%LocalAppData%\TabularEditor3\BPARules.json` | User-specific rules on Windows |
| **Rules on local machine** | `%ProgramData%\TabularEditor3\BPARules.json` | Machine-wide rules for all users |

### Built-in Rules (TE3 Only)

Tabular Editor 3 includes built-in BPA rules embedded in the application. These are **not** stored as separate JSON files but are compiled into the DLLs.

**Configuration:** `%LocalAppData%\TabularEditor3\Preferences.json`
- `BuiltInBpaRules`: `"Enable"` | `"Disable"` | `"EnableWithWarnings"`
- `DisabledBuiltInRuleIds`: Array of rule IDs to disable

**Built-in Rule IDs:**

| ID | Category | Description |
|----|----------|-------------|
| `TE3_BUILT_IN_DATA_COLUMN_SOURCE` | Schema | Data column source validation |
| `TE3_BUILT_IN_EXPRESSION_REQUIRED` | Schema | Expression required for calculated objects |
| `TE3_BUILT_IN_AVOID_PROVIDER_PARTITIONS_STRUCTURED` | Data Sources | Avoid provider partitions with structured sources |
| `TE3_BUILT_IN_SET_ISAVAILABLEINMDX_FALSE` | Performance | Set IsAvailableInMdx to false for non-MDX columns |
| `TE3_BUILT_IN_DATE_TABLE_EXISTS` | Schema | Date table should exist |
| `TE3_BUILT_IN_MANY_TO_MANY_SINGLE_DIRECTION` | Relationships | Many-to-many should use single direction |
| `TE3_BUILT_IN_RELATIONSHIP_SAME_DATATYPE` | Relationships | Relationship columns should have same data type |
| `TE3_BUILT_IN_AVOID_INVALID_CHARACTERS_NAMES` | Naming | Avoid invalid characters in names |
| `TE3_BUILT_IN_AVOID_INVALID_CHARACTERS_DESCRIPTIONS` | Metadata | Avoid invalid characters in descriptions |
| `TE3_BUILT_IN_SET_ISAVAILABLEINMDX_TRUE_NECESSARY` | Performance | Set IsAvailableInMdx true only when necessary |
| `TE3_BUILT_IN_REMOVE_UNUSED_DATA_SOURCES` | Maintenance | Remove unused data sources |
| `TE3_BUILT_IN_VISIBLE_TABLES_NO_DESCRIPTION` | Metadata | Visible tables should have descriptions |
| `TE3_BUILT_IN_VISIBLE_COLUMNS_NO_DESCRIPTION` | Metadata | Visible columns should have descriptions |
| `TE3_BUILT_IN_VISIBLE_MEASURES_NO_DESCRIPTION` | Metadata | Visible measures should have descriptions |
| `TE3_BUILT_IN_VISIBLE_CALCULATION_GROUPS_NO_DESCRIPTION` | Metadata | Visible calculation groups should have descriptions |
| `TE3_BUILT_IN_VISIBLE_UDF_NO_DESCRIPTION` | Metadata | Visible UDFs should have descriptions |
| `TE3_BUILT_IN_PERSPECTIVES_NO_OBJECTS` | Schema | Perspectives should contain objects |
| `TE3_BUILT_IN_CALCULATION_GROUPS_NO_ITEMS` | Schema | Calculation groups should have items |
| `TE3_BUILT_IN_TRIM_OBJECT_NAMES` | Naming | Object names should be trimmed |
| `TE3_BUILT_IN_FORMAT_STRING_COLUMNS` | Formatting | Columns should have format strings |
| `TE3_BUILT_IN_TRANSLATE_DISPLAY_FOLDERS` | Translations | Display folders should be translated |
| `TE3_BUILT_IN_TRANSLATE_DESCRIPTIONS` | Translations | Descriptions should be translated |
| `TE3_BUILT_IN_TRANSLATE_VISIBLE_NAMES` | Translations | Visible names should be translated |
| `TE3_BUILT_IN_TRANSLATE_HIERARCHY_LEVELS` | Translations | Hierarchy levels should be translated |
| `TE3_BUILT_IN_TRANSLATE_PERSPECTIVES` | Translations | Perspectives should be translated |
| `TE3_BUILT_IN_SPECIFY_APPLICATION_NAME` | Metadata | Specify application name |
| `TE3_BUILT_IN_POWERBI_LATEST_COMPATIBILITY` | Compatibility | Use latest Power BI compatibility level |

**Note:** This list is extracted from TE3 v3.25.0 Preferences.json. Built-in rules are not documented separately by Tabular Editor.

**Model-embedded rules** can be stored in two formats:

| Format | Location | Syntax |
|--------|----------|--------|
| **model.bim** (JSON) | `model.annotations` array | `{ "name": "BestPracticeAnalyzer", "value": "[{...rules...}]" }` |
| **TMDL** | `model.tmdl` file | `annotation BestPracticeAnalyzer = [{...rules...}]` |

**File format:** All locations use the same JSON array format containing rule objects.

**Priority:** When the same rule ID exists in multiple locations, rules are merged with local rules taking precedence over remote/built-in rules.

### Cross-Platform Access (macOS/Linux)

When working on macOS or Linux with Tabular Editor installed in a Windows VM:

**Parallels on macOS:**
```
/Users/<macUser>/Library/Parallels/Windows Disks/{VM-UUID}/[C] <DiskName>.hidden/
```

Full paths to BPA rules:
- **User-level:** `<ParallelsRoot>/Users/<WinUser>/AppData/Local/TabularEditor3/BPARules.json`
- **Machine-level:** `<ParallelsRoot>/ProgramData/TabularEditor3/BPARules.json`

**Other platforms:**
- **VMware Fusion** - Check `/Volumes/` for mounted Windows drives
- **WSL on Windows** - `/mnt/c/Users/<username>/AppData/Local/TabularEditor3/`

**Note:** The VM must be running for the filesystem to be accessible. If paths appear empty, start the Windows VM first.

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

Utility scripts:

- **`/scripts/bpa_rules_audit.py`** - Comprehensive BPA rules audit across all sources (built-in, URL, model, user, machine). Supports Windows, WSL, and macOS with Parallels. Outputs ASCII report and JSON export.
- **`scripts/validate_rules.py`** - Validate BPA rule JSON files for schema compliance

**Audit Script Usage:**
```bash
# Basic audit
python scripts/bpa_rules_audit.py /path/to/model

# Export to JSON
python scripts/bpa_rules_audit.py /path/to/model --json output.json

# Quiet mode (summary only)
python scripts/bpa_rules_audit.py /path/to/model --quiet
```

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
  "Expression": "string.IsNullOrWhitespace(Description)"
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
