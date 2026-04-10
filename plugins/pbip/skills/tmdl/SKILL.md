---
name: tmdl
version: 0.22.3
description: Direct TMDL file authoring and BIM-to-TMDL conversion for semantic models in PBIP projects. Automatically invoke when the user asks to "edit TMDL", "add a measure in TMDL", "TMDL syntax", "fix formatString", "fix summarizeBy", "TMDL indentation", "convert BIM to TMDL", "add a column description", "create a calculated column in TMDL", or mentions .tmdl file editing or BIM-to-TMDL migration.
---

# TMDL Authoring

Expert guidance for authoring and editing TMDL (Tabular Model Definition Language) files directly in PBIP projects.

> **This skill is a last resort.** Direct TMDL file editing lacks the validation, atomicity, and DAX query capabilities of the Tabular Editor CLI, Power BI MCP server, or the `connect-pbid` skill (TOM via PowerShell). Use those tools when available. TMDL editing is appropriate when:
>
> - Working with PBIP files in a Git repo without Power BI Desktop open
> - No Tabular Editor CLI or MCP server is installed
> - Making quick text-level fixes (descriptions, format strings, display folders) where a full tool chain is overkill
>
> Direct TMDL editing does not validate DAX syntax, check referential integrity, or verify that property values are valid. Errors will only surface when the model is next loaded in Power BI Desktop or deployed via XMLA. Use the **`pbip-validator`** agent to check TMDL files for syntax issues, indentation errors, and referential integrity before opening in PBI Desktop.

## When to Use This Skill

Activate only when the Tabular Editor CLI, Power BI MCP server, or `connect-pbid` skill are not available, and tasks involve:

- Editing `.tmdl` files directly (measures, columns, tables, relationships)
- Adding or modifying measure definitions in TMDL
- Adding descriptions to columns, measures, or tables
- Fixing `summarizeBy` or `formatString` values
- Understanding TMDL syntax rules (indentation, quoting, property ordering)
- Writing multi-line DAX in TMDL format
- Understanding the difference between `///` descriptions and `//` comments

## Critical

- **`///` (triple-slash) sets the `Description` property** on the object that immediately follows it. A `///` line must be immediately followed by a declaration (`measure`, `column`, `table`, etc.) — never by a blank line or another `///`. Use `//` for regular comments.
- **Indentation is semantic.** TMDL uses tabs for indentation, and depth equals nesting level. Properties of a table are indented one level; properties of a column (which belongs to a table) are indented two levels. Incorrect indentation will break the model.
- **Name quoting rules:** Only quote names that contain spaces, special characters, or start with a digit. Simple names and underscore-prefixed names are unquoted. See the Name Quoting section for details.

## TMDL File Types

| File | Contents | Location |
|------|----------|----------|
| `model.tmdl` | Model configuration, `ref table` entries, query groups, annotations | `definition/` |
| `database.tmdl` | Compatibility level, model ID | `definition/` |
| `relationships.tmdl` | All relationships between tables | `definition/` |
| `expressions.tmdl` | Shared M expressions and parameters | `definition/` |
| `functions.tmdl` | DAX user-defined functions (reusable parameterized DAX) | `definition/` |
| `roles/<RoleName>.tmdl` | One file per security role (RLS filters, role members, OLS) | `definition/roles/` |
| `perspectives/<Name>.tmdl` | One file per perspective (object membership) | `definition/perspectives/` |
| `dataSources.tmdl` | Legacy data source definitions (if present) | `definition/` |
| `tables/<Name>.tmdl` | Table definition with columns, measures, hierarchies, partitions | `definition/tables/` |
| `cultures/<locale>.tmdl` | Linguistic metadata and translations | `definition/cultures/` |

## Object Nesting Rules

Objects must be nested inside their correct parent. The validator enforces these rules:

| Object | Allowed Parent(s) |
|--------|-------------------|
| `column`, `measure`, `hierarchy`, `partition`, `calculationGroup` | `table` |
| `level` | `hierarchy` |
| `calculationItem` | `calculationGroup` |
| `tablePermission` | `role` |
| `columnPermission` | `tablePermission` |
| `perspectiveTable` | `perspective` |
| `perspectiveColumn`, `perspectiveMeasure`, `perspectiveHierarchy` | `perspectiveTable` |
| `linguisticMetadata`, `translation` | `cultureInfo` |
| `dataAccessOptions` | `model` |
| `formatStringDefinition` | `measure`, `calculationItem` |
| `detailRowsDefinition` | `measure`, `table` |
| `alternateOf` | `column` |
| `member` | `role` |
| `annotation`, `extendedProperty` | any object (including `queryGroup`, `function`, `member`) |
| `ref` | `model`, `table` |

Root-level objects (indent 0 only): `model`, `database`, `table`, `relationship`, `role`, `cultureInfo`, `perspective`, `dataSource`, `expression`, `queryGroup`, `function`.

## Syntax Rules

### Indentation

TMDL uses **tab-based indentation** where depth equals nesting level:

```tmdl
table Product                              // depth 0: top-level declaration
	lineageTag: abc-123                    // depth 1: table property

	measure '# Products' =                // depth 1: measure declaration
			COUNTROWS (                    // depth 3: DAX expression body (one deeper than properties)
			    VALUES ( Product[Name] )   // depth 3: continued
			)                              // depth 3: continued
		formatString: #,##0               // depth 2: measure property
		displayFolder: Measures            // depth 2: measure property
		lineageTag: def-456               // depth 2: measure property

	column 'Product Name'                  // depth 1: column declaration
		dataType: string                   // depth 2: column property
		lineageTag: ghi-789               // depth 2: column property
		summarizeBy: none                  // depth 2: column property
		sourceColumn: Product Name         // depth 2: column property

		annotation SummarizationSetBy = Automatic  // depth 2: column annotation
```

**Key rules:**
- Use tabs, not spaces
- Table-level objects (columns, measures, hierarchies, partitions) are at depth 1
- Properties of those objects are at depth 2
- Multi-line DAX expression bodies are always **2 levels deeper than the enclosing declaration** (depth 3 for measures/columns inside a table; depth 2 for top-level functions; depth 4 for calculationItems)
- Annotations are at the same depth as properties of their parent object, separated by a blank line

### Descriptions (`///`)

Triple-slash sets the `Description` property on the **next** declaration. This is native TMDL syntax (not a Tabular Editor extension); the TMDL spec treats `///` as first-class description support.

```tmdl
/// Count of distinct products in the current filter context.
measure '# Products' =
		COUNTROWS ( VALUES ( Product[Product Name] ) )
	formatString: #,##0
	lineageTag: abc-123
```

**Rules:**
- `///` must be immediately followed by a declaration on the next line
- No blank line between `///` and the declaration
- Multiple `///` lines concatenate into a single description
- `///` applies to the next `measure`, `column`, `table`, `hierarchy`, or `level`

**Common mistake:**
```tmdl
// WRONG: blank line between /// and declaration
/// This is a description.

measure 'My Measure' = 1

// WRONG: /// used as a separator comment
///
measure 'My Measure' = 1

// RIGHT: /// immediately before declaration
/// This is a description.
measure 'My Measure' = 1

// RIGHT: // used for regular comments
// This is just a comment, not a description.
measure 'My Measure' = 1
```

### Comments (`//`)

Double-slash is a regular comment with no semantic effect:

```tmdl
// This is a comment — it does not set any property
measure 'My Measure' = 1
```

### Property Ordering

Properties should follow a consistent order, though TMDL is not strict about it. The conventional order is:

**For columns:** `dataType`, `isHidden`, `isKey`, `displayFolder`, `lineageTag`, `summarizeBy`, `isNameInferred`, `sourceColumn`, `sortByColumn`, then annotations.

**For measures:** DAX expression (on the `=` line or multi-line), `formatString` or `formatStringDefinition`, `displayFolder`, `lineageTag`, then annotations.

## Name Quoting

### When to Quote

Use single quotes around names that contain any of these characters:
- Spaces: `'Product Name'`
- Dots: `'Sales.Amount'`
- Equals: `'Price = Target'`
- Colons: `'Date:Key'`
- Single quotes (escape by doubling): `'Customer''s Name'`
- Other special characters: `'Sales ($)'`, `'OTD % (Value)'`, `'1) Selected Metric'`
- Names starting with a digit: `'4) Selected Period'`

### When NOT to Quote

Do not quote names that are simple identifiers:
- `Product` (simple word)
- `_Measures` (underscore prefix, no spaces)
- `Date` (simple word)
- `CgMetricQuantity` (PascalCase, no spaces)

### Examples

```tmdl
table Product                    // unquoted: simple name
table _Measures                  // unquoted: underscore prefix
table 'Budget Rate'              // quoted: contains space
table 'Invoice Document Type'    // quoted: contains spaces
table '1) Selected Metric'       // quoted: starts with digit
table 'On-Time Delivery'         // quoted: contains space
```

## Column Definitions

For complete column examples (basic, hidden, key, sortByColumn, description), see **`references/tmdl-file-examples.md`**. For full property reference, see **`references/column-properties.md`**.

Key column pattern:

```tmdl
column 'Product Name'
	dataType: string
	displayFolder: 1. Product Hierarchy
	lineageTag: abc-123
	summarizeBy: none
	sourceColumn: Product Name

	annotation SummarizationSetBy = Automatic
```

## Measure Definitions

### Single-Line DAX

```tmdl
measure '# Products' = COUNTROWS ( VALUES ( Product[Product Name] ) )
	formatString: #,##0
	displayFolder: Measures
	lineageTag: abc-123
```

### Multi-Line DAX

Two syntaxes for multi-line DAX:

**1. Indented block** (most common) -- expression body indented two levels deeper than the declaration:

**2. Triple-backtick block** -- DAX enclosed in `` ``` `` fences, useful for expressions with complex indentation:

```tmdl
measure Percentage = ```
		VAR _Total = CALCULATE( SUM ( 'Table'[Quantitative] ), REMOVEFILTERS ( ) )
		RETURN
		DIVIDE ( SUM ( 'Table'[Quantitative] ), _Total )
		```
	formatString: 0.0%;-0.0%;0.0%
	lineageTag: abc-123
```

**Indented block syntax** (standard approach) -- indented two extra tabs from the measure's parent (table) level:

```tmdl
measure 'Actuals MTD' =
		CALCULATE (
		    [Actuals],
		    CALCULATETABLE (
		        DATESMTD ( 'Date'[Date] ),
		        'Date'[IsDateInScope]
		    )
		)
	formatString: #,##0
	displayFolder: 2. MTD\Actuals
	lineageTag: abc-123
```

### Measure with Description

```tmdl
/// Number of workdays elapsed month-to-date, considering only dates in scope.
measure '# Workdays MTD' =
		CALCULATE(
		    MAX( 'Date'[Workdays MTD] ),
		    'Date'[IsDateInScope] = TRUE
		)
	formatString: #,##0
	displayFolder: 5. Weekday / Workday\Measures\# Workdays
	lineageTag: abc-123
```

### Measure with formatStringDefinition (Dynamic Format)

```tmdl
measure 'Sales Target MTD vs. Actuals (%)' =
		Comparison.RelativeToTarget (
		    [Actuals MTD],
		    [Sales Target MTD]
		)
	displayFolder: 2. MTD\Sales Target
	lineageTag: abc-123

	formatStringDefinition =
			FormatString.Comparison.RelativeToTarget (
			    "SUFFIX",
			    1,
			    "ARROWS",
			    "",
			    ""
			)
```

**Note:** `formatStringDefinition` replaces `formatString` when the format is computed dynamically via a DAX expression (often a calculation group format function).

## Other Object Types

For complete examples of calculated columns, roles (RLS/OLS), calculation groups, date table marking, hierarchies, partitions, relationships, shared expressions, and model configuration, see **`references/tmdl-file-examples.md`**.


## Common Data Quality Patterns

### summarizeBy Rules

| Column Type | Correct `summarizeBy` | Reason |
|-------------|----------------------|--------|
| Keys (surrogate/natural) | `none` | Keys are never aggregated |
| Attributes (names, codes, types) | `none` | Text attributes are never summed |
| Dates | `none` | Dates are never summed |
| Boolean flags | `none` | Flags are never summed |
| Additive numeric facts (amounts, quantities) | `sum` | Default aggregation is SUM |
| Non-additive numeric facts (rates, percentages) | `none` | Cannot be meaningfully summed |

**Common fix pattern** — changing `summarizeBy: sum` to `summarizeBy: none` for key columns:

```tmdl
// Before (wrong - key column should not sum)
column 'Customer Key'
	dataType: int64
	isHidden
	lineageTag: abc-123
	summarizeBy: sum
	sourceColumn: Customer Key

// After (correct)
column 'Customer Key'
	dataType: int64
	isHidden
	lineageTag: abc-123
	summarizeBy: none
	sourceColumn: Customer Key
```

### formatString Patterns

| Data Type | Pattern | Example |
|-----------|---------|---------|
| Integer | `#,##0` | 1,234 |
| Decimal (2 places) | `#,##0.00` | 1,234.56 |
| Percentage | `#,##0%` or `0.00%` | 85% or 85.00% |
| Currency | `$#,##0.00` | $1,234.56 |
| Date | `mm/dd/yyyy` or `dd/mm/yyyy` | 01/15/2024 |

### PBI_FormatHint Annotation

Power BI Desktop may add a `PBI_FormatHint` annotation alongside `formatString`:

```tmdl
column Amount
	dataType: decimal
	formatString: #,##0.00
	lineageTag: abc-123
	summarizeBy: sum
	sourceColumn: Amount

	annotation SummarizationSetBy = Automatic

	annotation PBI_FormatHint = {"isGeneralNumber":true}
```

**Do not fight this annotation.** Power BI tooling re-adds it automatically. When setting a `formatString`, leave any existing `PBI_FormatHint` in place. If Power BI re-adds a removed `PBI_FormatHint`, accept it.


## Quick Reference

### Property Cheat Sheet

For the complete property reference for every object type, see **`references/object-properties.md`**.

| Object | Property | Values | Notes |
|--------|----------|--------|-------|
| Column | `dataType` | `string`, `int64`, `double`, `decimal`, `dateTime`, `boolean`, `binary`, `unknown`, `variant`, `automatic` | Required for data columns |
| Column | `summarizeBy` | `default`, `none`, `sum`, `min`, `max`, `count`, `average`, `distinctCount` | Use `none` for keys/attributes |
| Column | `type` | `data`, `calculated`, `rowNumber`, `calculatedTableColumn` | Column type variant |
| Column | `isHidden` | (flag, no value) | Boolean flags: write the keyword alone on its own line |
| Column | `isKey` | (flag, no value) | Marks the column as the table's key |
| Column | `isNullable` | (flag, no value) | Column allows nulls |
| Column | `isUnique` | (flag, no value) | Column values are unique |
| Column | `isNameInferred` | (flag, no value) | Name inferred from source |
| Column | `isDefaultLabel` | (flag, no value) | Default label for the table |
| Column | `isDefaultImage` | (flag, no value) | Default image for the table |
| Column | `isDataTypeInferred` | (flag, no value) | Data type inferred from source |
| Column | `isAvailableInMdx` | (flag, no value) | Available in MDX queries |
| Column | `keepUniqueRows` | (flag, no value) | Keep unique rows |
| Column | `encodingHint` | `default`, `hash`, `value` | Storage encoding hint |
| Column | `alignment` | `default`, `left`, `right`, `center` | Column alignment |
| Column | `displayFolder` | folder path string | Use `\` for nesting: `1. Year\Quarter` |
| Column | `sourceColumn` | source column name | Must match the Power Query output column |
| Column | `sortByColumn` | column name reference | Column to sort by (e.g., month name sorted by month number) |
| Column | `expression` | DAX expression | For calculated columns |
| Measure | `formatString` | format pattern | e.g., `#,##0`, `0.00%` |
| Measure | `displayFolder` | folder path string | Use `\` for nesting |
| Measure | `formatStringDefinition` | DAX expression block | Dynamic format string (replaces `formatString`) |
| Measure | `isHidden` | (flag, no value) | Hide the measure |
| Measure | `isSimpleMeasure` | (flag, no value) | Simple implicit-style measure |
| Measure | `dataCategory` | string | Semantic data category |
| Partition | `mode` | `import`, `directQuery`, `default`, `push`, `dual`, `directLake` | Storage mode |
| Partition | `sourceType` | `query`, `calculated`, `none`, `m`, `entity`, `policyRange`, `calculationGroup`, `inferred` | Source type |
| Relationship | `crossFilteringBehavior` | `oneDirection`, `bothDirections`, `automatic` | Cross-filter direction |
| Relationship | `securityFilteringBehavior` | `oneDirection`, `bothDirections`, `none` | RLS filter direction |
| Relationship | `fromCardinality` / `toCardinality` | `none`, `one`, `many` | Cardinality ends |
| Relationship | `isActive` | (flag, no value) | Active relationship |
| Role | `modelPermission` | `none`, `read`, `readRefresh`, `refresh`, `administrator` | Role permission level |
| Model | `discourageImplicitMeasures` | (flag, no value) | Disables implicit measures |
| Model | `defaultPowerBIDataSourceVersion` | `powerBI_V1`, `powerBI_V2`, `powerBI_V3` | PBI data source version |
| Model | `directLakeBehavior` | `automatic`, `directLakeOnly`, `directQueryOnly` | Direct Lake mode |
| All | `lineageTag` | GUID | Unique identifier, do not change existing values |

### Indentation Depth Summary

**Rule: a multi-line DAX body is always 2 levels deeper than its enclosing object declaration.**

| Context | Depth | Tabs |
|---------|-------|------|
| Top-level declaration (`table`, `relationship`, `expression`) | 0 | 0 |
| Table properties, column/measure/hierarchy declarations | 1 | 1 |
| Column/measure properties, hierarchy levels | 2 | 2 |
| DAX body for measure/column declared at depth 1 (inside table) | 3 | 3 |
| Level properties | 3 | 3 |
| DAX body for top-level `function` declared at depth 0 | 2 | 2 |
| `calculationItem` inside `calculationGroup` (depth 1) | 2 | 2 |
| DAX body for `calculationItem` at depth 2 | 4 | 4 |

## Additional Resources

### Reference Files

- **`references/object-properties.md`** - Complete property reference for all 30+ TMDL object types with valid enum values for every property type (dataType, summarizeBy, modeType, crossFilteringBehavior, etc.)
- **`references/column-properties.md`** - Column-specific property guide with `summarizeBy` rules, `formatString` patterns, `PBI_FormatHint` behavior
- **`references/naming-conventions.md`** - SQLBI naming conventions, display folder conventions, measure table conventions, and calculation group naming
- **`references/bim-to-tmdl.md`** - Converting between `model.bim` (TMSL) and `definition/` (TMDL) via Tabular Editor CLI or TOM TmdlSerializer
- **`references/tmdl-file-examples.md`** - Complete examples for every TMDL file type (model, database, expressions, relationships, roles, perspectives, tables, cultures) including backtick-enclosed expressions, field parameters, calculation groups, and date tables

### Fetching Docs

To retrieve current TMDL reference docs, use `microsoft_docs_search` + `microsoft_docs_fetch` (MCP) if available, otherwise `mslearn search` + `mslearn fetch` (CLI). Search based on the user's request and run multiple searches as needed to ensure sufficient context before proceeding.

### Example Model

- **`examples/SpaceParts.SemanticModel/`** -- Complete real-world TMDL model (SpaceParts) with 40 tables, 152 measures, 8 calculation groups, 8 RLS roles, 2 perspectives, DAX UDFs (functions.tmdl), shared M expressions, relationships, and cultures. Covers every TMDL file type. Key files to study:
  - `definition/functions.tmdl` -- DAX user-defined functions with parameters, types, and multi-line expressions
  - `definition/tables/Z04CG1 - Time Intelligence.tmdl` -- Calculation group with triple-backtick DAX
  - `definition/tables/__Measures.tmdl` -- Measures table with calculation group references
  - `definition/tables/Invoices.tmdl` -- Large fact table (51 measures, 18 columns)
  - `definition/tables/Date.tmdl` -- Calculated date table with 42 columns
  - `definition/roles/Account Managers.tmdl` -- RLS role with DAX filter expression
  - `definition/relationships.tmdl` -- 27 relationships including inactive
  - `definition/expressions.tmdl` -- Shared M/Power Query expressions and parameters
  - `definition/perspectives/Measure Selection.tmdl` -- Perspective definition

### External References

- [TMDL overview (Microsoft Learn)](https://learn.microsoft.com/en-us/analysis-services/tmdl/tmdl-overview)
- [TMDL syntax reference (Microsoft Learn)](https://learn.microsoft.com/en-us/analysis-services/tmdl/tmdl-how-to)
- [SQLBI naming conventions](https://www.sqlbi.com/articles/rules-of-the-game-how-to-name-things-in-your-data-model/)
