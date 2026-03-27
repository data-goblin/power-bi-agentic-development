---
name: standardize-naming-conventions
version: 0.8.1
description: This skill should be used when the user asks to "standardize naming conventions", "fix naming conventions", "rename measures", "rename columns", "clean up model names", "fix table names", "apply naming standards", "audit naming conventions", "standardize my model", "rename fields", "fix abbreviations in model", "make names human readable", or mentions improving naming conventions in a Power BI semantic model. Provides interactive naming convention standardization for TMDL-based Power BI semantic models.
---

# Standardize Naming Conventions

Interactive workflow for auditing and standardizing naming conventions in Power BI semantic models stored as TMDL files. Ensures tables, columns, measures, and display folders follow human-readable, consistent, business-aligned naming standards.

## Primary Workflow

### Phase 1: Discover the Model

Locate the TMDL files. Ask the user for the path to the `.SemanticModel/definition/` directory if not obvious from context. Then scan the model structure:

```bash
# Count tables and get an overview
ls <path>/tables/*.tmdl
```

Read all table TMDL files to build a complete picture of current naming patterns. Focus on:
- Table names (check for DIM_, FACT_, or other technical prefixes)
- Measure names (check for abbreviations, programming conventions, inconsistent syntax)
- Column names (check for CamelCase, snake_case, abbreviations)
- Display folder structure (check for organization and consistency)
- Presence of descriptions (`///` comments)

### Phase 2: Understand Business Context

**CRITICAL: Do not rename anything without understanding the business terminology.**

Use `AskUserQuestion` to gather context:

1. **Business terminology**: "What terminology does your organization use for key metrics? For example, do you call it Revenue, Turnover, Sales, or Gross Sales?"
2. **Existing conventions**: "Do you have any documented naming conventions or standards already?"
3. **Period conventions**: "How do you typically refer to prior periods? (e.g., 1YP, PY, Prior Year, Last Year)"
4. **Unit conventions**: "How do you typically express units in measure names? (e.g., parentheses like (%), (Value), (Quantity))"
5. **Downstream impact**: "Are there downstream reports connected to this model that would need visual rebinding after renaming?"

Adapt the naming rules to the user's business context. The rules in `references/naming-rules.md` are defaults -- override them when the user's organization has established conventions.

### Phase 3: Audit and Report

Before making changes, produce an audit report. Present a markdown table showing each proposed rename:

```
| Object Type | Current Name | Proposed Name | Issues Found |
|-------------|-------------|---------------|-------------|
| Table | FACT_Invoices | Invoices | Technical prefix |
| Measure | NetSls | Net Sales | CamelCase, abbreviation |
| Column | shp_dt | Ship Date | snake_case, abbreviation |
```

Group findings by issue type:
- **Programming conventions**: CamelCase, snake_case, UPPER_CASE
- **Abbreviations/acronyms**: Shortened or opaque names
- **Inconsistent syntax**: Mixed period, unit, or aggregation patterns
- **Technical prefixes**: DIM_, FACT_, STG_ on tables
- **Missing descriptions**: Objects without `///` docstrings
- **Disorganized folders**: Missing or flat display folder hierarchy

Ask the user to confirm or adjust the proposed renames before proceeding.

### Phase 4: Apply Changes

After user approval, edit the TMDL files. For each table file:

1. **Rename the table** (if needed): Change the `table` declaration
2. **Rename measures**: Change measure names in their declarations. IMPORTANT: Also update all internal DAX references to renamed measures using `[Old Name]` -> `[New Name]` patterns across ALL table files in the model
3. **Rename columns**: Change column names in their declarations. IMPORTANT: Also update DAX references using `'Table'[Old Column]` -> `'Table'[New Column]` across ALL table files
4. **Reorganize display folders**: Add or restructure `displayFolder:` properties
5. **Add descriptions**: Add `///` comments for measures and columns that lack them
6. **Update relationship references**: Check `relationships.tmdl` for renamed tables/columns

**Cross-file reference updates are critical.** When renaming a measure or column, search the entire `definition/` directory for all references:

```bash
# Find all references to a renamed measure
rg "OldMeasureName" <path>/definition/tables/
rg "OldMeasureName" <path>/definition/relationships.tmdl
```

### Phase 5: Validate

After applying changes, verify:
1. All TMDL files still parse correctly (no syntax errors)
2. No orphaned references to old names remain in any file
3. Display folders are consistent across tables
4. Descriptions are present on all visible measures and columns

Run a final search to check for any missed references:
```bash
# Check for any remaining old names
rg -n "old_name_pattern" <path>/definition/
```

## Naming Convention Rules

Consult `references/naming-rules.md` for the complete rule set including:
- Human-readable name requirements
- Abbreviation and acronym rules
- Technical prefix rules
- Aggregation, unit, and period syntax standards
- Display folder organization patterns
- Measure name construction order: `[Aggregation] [Base Name] [Period] ([Unit])`
- Column naming patterns

## Key Anti-Patterns to Detect

Quick-reference checklist for the most common issues:

| Anti-Pattern | Rule | Example Fix |
|-------------|------|-------------|
| `snake_case` | Use spaces | `net_sales` -> `Net Sales` |
| `CamelCase` | Use spaces | `NetSales` -> `Net Sales` |
| `UPPER_CASE` | Use spaces | `TOTAL_COST` -> `Total Cost` |
| Abbreviations | Spell out | `Del. Mrgn` -> `Delivery Margin` |
| Opaque acronyms | Spell out | `TFS` -> `Total Freight Surcharge` |
| Technical prefix | Remove | `FACT_Orders` -> `Orders` |
| Inconsistent periods | Standardize | `LY`/`PY`/`Last Year` -> `1YP` |
| Inconsistent units | Standardize | `pct`/`%`/`(%)` -> `(%)` |
| Missing descriptions | Add | `///` docstrings on all visible objects |
| Flat folders | Organize | Numbered hierarchy with subfolders |

## Downstream Report Impact

**WARNING:** Renaming model objects breaks downstream report visuals that reference those fields. After renaming:

1. Identify all connected reports (`.pbir` files or Power BI Service reports)
2. Rebind visuals to use the new field names
3. This can be done manually in Power BI Desktop, or programmatically by editing the `visual.json` files in PBIR format

Always warn the user about this before applying renames. If downstream reports exist, consider:
- Making a backup of the model before changes
- Planning a rebinding session after the rename
- Using a C# script in Tabular Editor to batch-rename with rebinding

## Additional Resources

### Reference Files

- **`references/naming-rules.md`** -- Complete naming convention rules with detection patterns, anti-pattern tables, and the measure name construction order

### Fetching Docs

To retrieve current semantic model and TMDL reference docs, use `microsoft_docs_search` + `microsoft_docs_fetch` (MCP) if available, otherwise `mslearn search` + `mslearn fetch` (CLI). Search based on the user's request and run multiple searches as needed to ensure sufficient context before proceeding.
