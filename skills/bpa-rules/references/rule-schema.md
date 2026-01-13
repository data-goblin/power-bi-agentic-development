# BPA Rule JSON Schema

Complete schema reference for Best Practice Analyzer rule definitions.

## Full Schema

```json
{
  "ID": "string (required)",
  "Name": "string (required)",
  "Category": "string (required)",
  "Description": "string (optional)",
  "Severity": "integer 1-3 (required)",
  "Scope": "string - comma-separated (required)",
  "Expression": "string - Dynamic LINQ (required)",
  "FixExpression": "string or null (optional)",
  "CompatibilityLevel": "integer (optional, default 1200)",
  "Source": "string (optional)",
  "Remarks": "string (optional)"
}
```

## Field Details

### ID

**Required.** Unique identifier for the rule.

**Convention:** `PREFIX_DESCRIPTIVE_NAME` in SCREAMING_SNAKE_CASE

**Prefix by category:**
- `DAX_` - DAX expression rules
- `META_` - Metadata rules
- `PERF_` - Performance rules
- `NAME_` - Naming convention rules
- `LAYOUT_` - Model layout rules
- `FORMAT_` - Formatting rules

**Examples:**
- `DAX_AVOID_IFERROR`
- `META_MEASURE_NO_DESCRIPTION`
- `PERF_UNUSED_COLUMNS`
- `NAME_MEASURE_SHOULD_NOT_BE_ENCODED`

### Name

**Required.** Human-readable rule title displayed in UI.

**Best practices:**
- Be concise but descriptive
- Start with action verb or object
- Avoid technical jargon in name (put in Description)

**Examples:**
- "Measure has no description"
- "Avoid IFERROR in measures"
- "Column should be hidden"

### Category

**Required.** Classification for grouping rules in UI.

**Standard categories:**
- `DAX Expressions` - Rules about DAX formulas
- `Metadata` - Rules about metadata properties (descriptions, annotations)
- `Performance` - Rules affecting query or processing performance
- `Naming Conventions` - Rules about naming standards
- `Model Layout` - Rules about visibility, perspectives, display folders
- `Formatting` - Rules about format strings, display settings

**Custom categories allowed** - Use for organization-specific groupings.

### Description

**Optional.** Explanation of the rule's purpose and rationale.

**Best practices:**
- Explain *why* this matters, not just *what* it checks
- Include guidance for remediation if no FixExpression
- Keep under 200 characters for UI display

### Severity

**Required.** Integer indicating rule importance.

| Value | Level | Usage |
|-------|-------|-------|
| 1 | Informational | Suggestions, style preferences |
| 2 | Warning | Should fix, potential issues |
| 3 | Error | Must fix, significant problems |

### Scope

**Required.** Comma-separated list of object types to check.

<!-- TODO: Complete list of all valid scopes with descriptions -->

**Common scopes:**

| Scope | Objects Checked |
|-------|-----------------|
| `Model` | The entire model (single object) |
| `Table` | All tables including calculated tables |
| `Column` | All columns (data, calculated, computed) |
| `DataColumn` | Data columns only (from source) |
| `CalculatedColumn` | Calculated columns only |
| `CalculatedTableColumn` | Columns in calculated tables |
| `Measure` | All measures |
| `Hierarchy` | Hierarchies |
| `Level` | Hierarchy levels |
| `Relationship` | Relationships |
| `Partition` | Table partitions |
| `DataSource` | Data sources |
| `Role` | Security roles |
| `RoleMember` | Role members |
| `TablePermission` | RLS table permissions |
| `Perspective` | Perspectives |
| `Culture` | Cultures/translations |
| `CalculationGroup` | Calculation group tables |
| `CalculationItem` | Calculation items |
| `UserDefinedFunction` | DAX UDFs |
| `Calendar` | Calendar tables |
| `KPI` | KPIs |

**Multiple scopes:** Separate with commas: `Measure, CalculatedColumn`

### Expression

**Required.** Dynamic LINQ expression returning `true` for violations.

See `expression-syntax.md` for complete syntax reference.

### FixExpression

**Optional.** Expression to auto-remediate violations.

**Format:** `PropertyName = Value` or method call

**Examples:**
```csharp
// Set property
Description = "TODO: Add description"
IsHidden = true
FormatString = "#,##0"
SummarizeBy = AggregateFunction.None

// Method call
Delete()
```

**When to use null:**
- Fix requires human judgment
- Multiple valid remediation paths
- Risk of data loss

### CompatibilityLevel

**Optional.** Minimum model compatibility level required.

| Level | Version |
|-------|---------|
| 1200 | SQL Server 2016 / Power BI |
| 1400 | SQL Server 2017 |
| 1470 | Power BI enhanced features |
| 1500 | SQL Server 2019 |
| 1600 | Latest features |

**Default:** 1200 if not specified

### Source

**Optional.** Attribution for rule origin.

**Examples:**
- "Microsoft Best Practices"
- "Tabular Editor Standard Rules"
- "Internal: Data Team"

### Remarks

**Optional.** Additional notes about limitations or edge cases.

**Use for:**
- Known false positives
- Performance considerations
- Version-specific behavior

## Example: Complete Rule

```json
{
  "ID": "PERF_UNUSED_COLUMNS",
  "Name": "Remove columns that are not used",
  "Category": "Performance",
  "Description": "Hidden columns with no references consume memory without benefit. Consider removing or using in a measure/relationship.",
  "Severity": 2,
  "Scope": "DataColumn, CalculatedColumn",
  "Expression": "(IsHidden or Table.IsHidden) and ReferencedBy.Count = 0 and not UsedInRelationships.Any() and not UsedInSortBy.Any() and not UsedInHierarchies.Any()",
  "FixExpression": null,
  "CompatibilityLevel": 1200,
  "Source": "Tabular Editor Standard Rules",
  "Remarks": "Does not check for references in external tools or reports. Review before deletion."
}
```

## Rule Collection Format

Rules are stored in JSON arrays:

```json
[
  { "ID": "RULE_1", ... },
  { "ID": "RULE_2", ... }
]
```

**File locations:**
- User rules: `%LocalAppData%\TabularEditor3\BPARules.json`
- Machine rules: `%ProgramData%\TabularEditor\BPARules.json`
- External: URL reference in model annotation
