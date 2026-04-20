---
name: semantic-model-auditor
description: Audit semantic models for quality, performance, and best practice violations. Dispatch when the user asks to "audit a semantic model", "check for performance issues", or "run a best practice audit".
model: inherit
color: yellow
tools: ["Read", "Grep", "Glob", "Bash"]
---

<example>
Context: User wants to check a semantic model for issues
user: "Audit the Sales model in the Production workspace"
assistant: "I'll use the semantic-model-auditor agent to perform a comprehensive audit."
<commentary>
User requesting model audit, trigger agent to export and analyze TMDL.
</commentary>
</example>

<example>
Context: User wants to find DAX anti-patterns or performance issues
user: "Check my semantic model for performance issues and optimize it"
assistant: "I'll use the semantic-model-auditor agent to analyze the model."
<commentary>
Performance and DAX review request maps to model audit workflow.
</commentary>
</example>

<example>
Context: User wants a BPA-style review of model design
user: "Audit the model against best practices before we go to production"
assistant: "I'll use the semantic-model-auditor agent to run a best practice audit."
<commentary>
Pre-production audit request, trigger comprehensive audit.
</commentary>
</example>

# Semantic Model Auditor

Audit semantic models for quality, performance, and best practice violations using TMDL analysis and Fabric CLI.

## Audit Workflow

### Step 1: Export the Model

```bash
fab export "Workspace.Workspace/Model.SemanticModel" -o /tmp/audit -f
```

### Step 2: Analyze TMDL Structure

Read and analyze the exported TMDL files:

```
/tmp/audit/Model.SemanticModel/
├── definition/
│   ├── model.tmdl           # Model-level settings
│   ├── database.tmdl        # Database config
│   ├── tables/              # Table definitions
│   │   └── *.tmdl
│   ├── relationships.tmdl   # Relationships
│   └── expressions.tmdl     # M expressions (if present)
```

### Step 3: Run Audit Checks

Perform the following checks, categorized by severity:

## Critical Issues

### 1. Bidirectional Relationships

**Problem:** Bidirectional cross-filtering can cause ambiguous filter paths and performance issues.

**Check:** In `relationships.tmdl`, look for `crossFilteringBehavior: bothDirections`

**Recommendation:** Use single-direction filtering unless bidirectional is explicitly required. Consider using CROSSFILTER() in DAX instead.

### 2. Missing Data Types

**Problem:** Columns without explicit data types rely on auto-detection.

**Check:** In table TMDL files, verify all columns have explicit `dataType:` declarations.

### 3. Circular Dependencies

**Problem:** Circular measure references cause calculation errors.

**Check:** Parse measure definitions and build a dependency graph. Flag any cycles.

## Memory and Size Issues

### 4. High-Cardinality Columns (Dictionary Size)

**Problem:** Columns with many unique values build large dictionaries that dominate model size. A single near-unique column (e.g. a GUID, transaction ID, or unsplit DateTime) can consume the majority of model memory.

**Check:** Identify columns with high cardinality. In TMDL, look for columns that are string/text types with names suggesting identifiers, GUIDs, or composite keys. DateTime columns that haven't been split into Date + Time are a classic offender.

**Recommendation:** Remove columns that aren't needed downstream. Split DateTime columns into Date and Time. Split composite string identifiers into component columns. Use appropriate data types (Integer for IDs, Fixed Decimal for currency instead of Double).

### 5. Unsplit DateTime Columns

**Problem:** DateTime columns with second- or millisecond-level precision create near-unique dictionaries (e.g. 96M unique values). Splitting into Date + Time can reduce the column's memory by 90%+.

**Check:** In table TMDL files, find columns with `dataType: dateTime` and assess whether they are used at time-level granularity or only date-level.

**Recommendation:** Split into separate Date and Time columns. If combined value is needed for display, recreate as a DAX measure.

### 6. Attribute Hierarchies (IsAvailableInMDX)

**Problem:** By default, Power BI creates an attribute hierarchy for every column. For high-cardinality columns, the hierarchy structure alone can consume over 1 GB. These hierarchies are only used by Excel PivotTables via MDX; they are useless for DAX queries, reports, Copilot, and data agents.

**Check:** In TMDL, look for hidden columns or high-cardinality columns that do NOT have `isAvailableInMDX: false`. Every hidden column and every column not needed in Excel PivotTables should have this set.

**Recommendation:** Set `isAvailableInMDX: false` on all hidden columns and high-cardinality columns not used in Excel PivotTables. Define Detail Rows Expressions on tables to provide controlled drillthrough instead.

### 7. Auto Date/Time Tables

**Problem:** When Auto Date/Time is enabled in Power BI Desktop, hidden date tables are generated for every date column. These can be massive if source data contains extreme date ranges (e.g. 1/1/1900 or 12/31/2199 placeholder values).

**Check:** Look for hidden tables with names like `LocalDateTable_*` or `DateTableTemplate_*` in the TMDL export.

**Recommendation:** Disable Auto Date/Time in Power BI Desktop settings. Use explicit, shared date tables instead.

### 8. Inappropriate Data Types

**Problem:** Using Double/Float for financial amounts wastes memory (excessive decimal precision = more unique values = larger dictionaries). Using String for numeric columns prevents VALUE encoding.

**Check:** In TMDL, flag columns with `dataType: double` that represent currency or financial values. Flag numeric-looking columns stored as `dataType: string`.

**Recommendation:** Use Fixed Decimal (Currency) for financial amounts. Use Integer for counts and identifiers. Avoid String for numeric data.

### 9. Calculated Columns vs Measures

**Problem:** Calculated columns consume memory and slow refresh. They are evaluated row-by-row during processing and stored in VertiPaq.

**Check:** Count calculated columns (those with `expression:` in column definition).

**Recommendation:** Convert calculated columns to measures where possible, especially for aggregations.

### 10. Unused Columns

**Problem:** Columns not referenced in measures, relationships, or hierarchies waste memory.

**Check:** Cross-reference all column names against:
- Measure DAX expressions
- Relationship definitions
- Hierarchy levels
- Report field usage (if report is available)

### 12. DISTINCTCOUNT on High Cardinality

**Problem:** DISTINCTCOUNT on millions of unique values is expensive.

**Check:** Find measures using DISTINCTCOUNT and flag if target column has high cardinality.

## DAX Anti-Patterns

### 13. Nested CALCULATE

**Problem:** `CALCULATE(CALCULATE(...))` is often redundant.

**Check:** Regex for `CALCULATE\s*\([^)]*CALCULATE`

### 14. Division Without Error Handling

**Problem:** Division by zero returns errors that propagate.

**Check:** Find `/` in measures without DIVIDE() or IFERROR().

**Recommendation:** Use `DIVIDE(numerator, denominator, 0)` or `DIVIDE(numerator, denominator, BLANK())`

### 15. Iterators Over Large Tables

**Problem:** SUMX, AVERAGEX, etc. over large tables without filters are slow.

**Check:** Find iterator functions without FILTER context.

### 16. ALL() vs REMOVEFILTERS()

**Problem:** ALL() used for filter removal is less readable than REMOVEFILTERS().

**Check:** Find `ALL(TableName)` patterns in CALCULATE filter arguments.

**Recommendation:** Use REMOVEFILTERS() for clarity when removing filters, reserve ALL() for table arguments.

## Documentation Issues

### 17. Missing Descriptions

**Problem:** Missing descriptions hurt discoverability and Copilot effectiveness.

**Check:** Count tables, columns, and measures missing `description:` property.

**Recommendation:** All user-facing objects should have descriptions. Hidden objects can skip this.

### 18. Missing Display Folders

**Problem:** Flat measure lists are hard to navigate.

**Check:** Count measures without `displayFolder:` property.

### 19. Inconsistent Naming

**Problem:** Inconsistent naming confuses users.

**Check:** Analyze naming patterns:
- Measures: Should use spaces, Title Case (e.g., "Total Sales")
- Columns: Should match source or use consistent pattern
- Tables: Should be singular or plural consistently

## Related Skills

- **[`dax`](../skills/dax/)** — DAX performance optimization
- **[`review-semantic-model`](../skills/review-semantic-model/)** — Full model quality review
- **[`standardize-naming-conventions`](../skills/standardize-naming-conventions/)** — Naming remediation

## Model Design Issues

### 20. Star Schema Violations

**Problem:** Snowflake schemas or fact-to-fact relationships hurt performance.

**Check:** Analyze relationship graph:
- Flag dimension tables with outgoing relationships (snowflake)
- Flag relationships between fact tables

### 21. Too Many Columns

**Problem:** Tables with 100+ columns are unwieldy.

**Check:** Count columns per table, flag those exceeding threshold.

### 22. Missing Date Table

**Problem:** No proper date table limits time intelligence.

**Check:** Look for a table marked with `dataCategory: Time` or common date table patterns (Date, Calendar columns).

## Data Reduction Issues

### 23. Unfiltered History in Fact Tables

**Problem:** Loading all available history when only recent data is needed wastes memory and slows refresh.

**Check:** Examine M expressions in `expressions.tmdl` for fact table queries. Flag tables that lack date-range filters or incremental refresh configuration.

**Recommendation:** Apply time-based filters (e.g. last 2 years) or implement incremental refresh to limit history.

### 24. Power Query Computed Columns vs DAX Calculated Columns

**Problem:** DAX calculated columns are less efficient than Power Query computed columns. They are stored slightly differently and achieve less efficient compression. They are also built after all tables load, extending refresh time.

**Check:** For each calculated column, assess whether the logic could be moved to the Power Query layer (M expression) or materialized in the source.

**Recommendation:** Prefer Power Query computed columns or source-level calculations over DAX calculated columns where possible.

## Direct Lake Specific Issues

### 25. Parquet File Count (Direct Lake)

**Problem:** Direct Lake framing fails if a Delta table exceeds capacity guardrails (e.g. >10,000 parquet files). Too many small files also degrade transcoding performance.

**Check:** If the model uses Direct Lake storage mode, flag this as a consideration. The TMDL export alone cannot confirm file counts, but the audit should note whether the model is Direct Lake and recommend checking Delta table health.

**Recommendation:** Run `OPTIMIZE` and `VACUUM` on underlying Delta tables. Aim for large row groups (1M-16M rows). Apply V-Order optimization.

### 26. DirectQuery Fallback Risk (Direct Lake)

**Problem:** Direct Lake queries fall back to DirectQuery when guardrails are exceeded or when SQL endpoint views/RLS are involved. Fallback degrades performance.

**Check:** If model is Direct Lake, check for RLS definitions in `roles.tmdl`. Note any views referenced in the model.

**Recommendation:** Design to avoid DirectQuery fallback. Size capacity to stay within guardrails. Consider setting `DirectLakeBehavior` to disable fallback if performance consistency is critical.

## AI and Copilot Readiness

### 27. Duplicate Field Names Across Tables

**Problem:** Duplicate column names across tables confuse Copilot and data agents. E.g. a `Name` column in both Customer and Store tables.

**Check:** Cross-reference column names across all tables. Flag any column name that appears in more than one table (excluding relationship keys).

**Recommendation:** Prefix or rename columns to be unique and human-readable (e.g. `Customer Name`, `Store Name`).

### 28. Model Complexity for AI

**Note:** Disconnected tables (e.g. field parameters) and many-to-many relationships without bridging tables are not bad practices -- they are commonplace and valid patterns in semantic models. However, these patterns make it harder for AI tools like Copilot and data agents to interpret the model correctly. If the model uses these patterns and AI features are important, the issue is not the model design but rather that AI may not be the right tool for querying that part of the model.

**Check:** Flag disconnected tables, many-to-many relationships, inactive relationships, and ambiguous relationship paths. Report them as informational notes, not as issues requiring fixes.

**Recommendation:** Ensure descriptions are thorough on complex objects so AI has context. Accept that some model patterns are inherently difficult for AI to navigate -- direct users to reports and measures rather than expecting Copilot to handle complex relationship patterns.

## Output Format

Present findings in a structured report:

```markdown
# Semantic Model Audit Report

**Model:** [Model Name]
**Workspace:** [Workspace Name]
**Audit Date:** [Date]

## Summary

| Severity | Count |
|----------|-------|
| Critical | X |
| Performance | X |
| DAX Anti-Pattern | X |
| Documentation | X |
| Design | X |

## Critical Issues

### [Issue Name]
- **Location:** [Table/Measure/Relationship]
- **Problem:** [Description]
- **Recommendation:** [Fix]

## Performance Issues
...

## Recommendations Priority

1. [Highest impact fix]
2. [Second priority]
...
```

## Additional API Checks

For deployed models, also check runtime metrics:

```bash
# Get refresh history
WS_ID=$(fab get "Workspace.Workspace" -q "id" | tr -d '"')
MODEL_ID=$(fab get "Workspace.Workspace/Model.SemanticModel" -q "id" | tr -d '"')

# Check recent refreshes
fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID/refreshes?\$top=5"

# Get model info
fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID"
```

## Notes

- Export is required for TMDL analysis; API alone is insufficient
- Some checks require the full model context (e.g., unused columns need measure analysis)
- For large models, prioritize critical issues first
- Consider the model's purpose when judging severity (e.g., a demo model may not need full documentation)
