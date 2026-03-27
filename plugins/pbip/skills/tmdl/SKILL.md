---
name: tmdl
version: 0.8.5
description: This skill should be used as a last resort when the Tabular Editor CLI, Power BI MCP server, or connect-pbid skill are not available. Use when the user asks to "edit TMDL", "add a measure in TMDL", "add a column description", "fix summarizeBy", "TMDL syntax", "write a measure in TMDL", "create a calculated column in TMDL", "fix formatString", "TMDL indentation", or mentions TMDL file editing or direct semantic model file authoring in PBIP projects.
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
- Multi-line DAX expression bodies are at depth 3 (one level deeper than properties -- this is required by the TMDL parser)
- Annotations are at the same depth as properties of their parent object, separated by a blank line

### Descriptions (`///`)

Triple-slash sets the `Description` property on the **next** declaration:

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

### Basic Column

```tmdl
column 'Product Name'
	dataType: string
	displayFolder: 1. Product Hierarchy
	lineageTag: abc-123
	summarizeBy: none
	sourceColumn: Product Name

	annotation SummarizationSetBy = Automatic
```

### Column with isHidden

```tmdl
column 'Product Key'
	dataType: int64
	isHidden
	displayFolder: 5. Keys
	lineageTag: def-456
	summarizeBy: none
	sourceColumn: Product Key

	annotation SummarizationSetBy = Automatic
```

### Column with Description

```tmdl
/// The shipping classification determining logistics handling.
column 'Ship Class for Part'
	dataType: string
	displayFolder: 2. Product Attributes
	lineageTag: ghi-789
	summarizeBy: none
	sourceColumn: Ship Class for Part

	annotation SummarizationSetBy = Automatic
```

### Key Column

```tmdl
column Date
	isKey
	displayFolder: 6. Calendar Date
	lineageTag: abc-123
	summarizeBy: none
	isNameInferred
	sourceColumn: [Date]

	annotation SummarizationSetBy = Automatic
```

### Column with sortByColumn

```tmdl
column 'Calendar Year (ie 2021)'
	displayFolder: 1. Year
	lineageTag: abc-123
	summarizeBy: none
	isNameInferred
	sourceColumn: [Calendar Year (ie 2021)]
	sortByColumn: 'Calendar Year Number (ie 2021)'

	annotation SummarizationSetBy = Automatic
```

For a complete property reference, see `references/column-properties.md`.

## Measure Definitions

### Single-Line DAX

```tmdl
measure '# Products' = COUNTROWS ( VALUES ( Product[Product Name] ) )
	formatString: #,##0
	displayFolder: Measures
	lineageTag: abc-123
```

### Multi-Line DAX

Multi-line DAX is indented with two extra tabs from the measure's parent (table) level:

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

## Calculated Columns

A calculated column has a DAX expression instead of a `sourceColumn`:

```tmdl
	column 'Full Name' =
			[First Name] & " " & [Last Name]
		dataType: string
		lineageTag: abc-123
		summarizeBy: none
		isDataTypeInferred

		annotation SummarizationSetBy = Automatic
```

The DAX body follows the same depth rule as measures -- one level deeper than the column's properties.


## Roles (Row-Level Security)

Each role is defined in its own file under `definition/roles/` (e.g., `roles/Regional Sales.tmdl`):

```tmdl
role 'Regional Sales'
	modelPermission: read

	tablePermission Sales = [Region] = USERPRINCIPALNAME()
```

With object-level security (OLS) on a column:

```tmdl
role 'Restricted Finance'
	modelPermission: read

	tablePermission Sales = [Department] = "Finance"

		columnPermission Margin
			metadataPermission: none
```


## Calculation Groups

A calculation group is a special table with `calculationGroup` and `calculationItem` objects:

```tmdl
table 'Time Intelligence'
	lineageTag: abc-123

	calculationGroup
		precedence: 10

		calculationItem YTD =
				CALCULATE (
				    SELECTEDMEASURE (),
				    DATESYTD ( 'Date'[Date] )
				)
			ordinal: 0

		calculationItem 'Prior Year' =
				CALCULATE (
				    SELECTEDMEASURE (),
				    DATEADD ( 'Date'[Date], -1, YEAR )
				)
			ordinal: 1

	column Name
		dataType: string
		isHidden
		lineageTag: def-456
		summarizeBy: none
		sourceColumn: Name

	partition 'Time Intelligence' = calculationGroup
		mode: import
```


## Date Table Marking

Mark a table as a date table by setting `dataCategory: Time` and `isKey` on the date column:

```tmdl
table Date
	dataCategory: Time
	lineageTag: abc-123

	column Date
		isKey
		dataType: dateTime
		lineageTag: def-456
		summarizeBy: none
		sourceColumn: Date
```


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

## Other TMDL Constructs

### Hierarchy

```tmdl
hierarchy 'Product Hierarchy'
	displayFolder: 1. Product Hierarchy
	lineageTag: abc-123

	level Type
		lineageTag: def-456
		column: Type

	level Subtype
		lineageTag: ghi-789
		column: Subtype

	level 'Product Name'
		lineageTag: jkl-012
		column: 'Product Name'
```

### Partition

```tmdl
partition Product = m
	mode: import
	queryGroup: Tables
	source =
			let
			    Source = Sql.Database(#"SqlEndpoint",#"Database"),
			    Data = Source{[Schema="Dimview",Item="Products"]}[Data]
			in
			    Data
```

### Relationship (in relationships.tmdl)

```tmdl
relationship abc-123
	fromColumn: Invoices.'Product Key'
	toColumn: Product.'Product Key'
```

### Shared Expression (in expressions.tmdl)

```tmdl
expression SqlEndpoint = "server.database.windows.net" meta [IsParameterQuery=true, Type="Text", IsParameterQueryRequired=true]
	lineageTag: abc-123
	queryGroup: Parameters

	annotation PBI_NavigationStepName = Navigation

	annotation PBI_ResultType = Text
```

### Model Configuration (in model.tmdl)

```tmdl
model ModelName
	culture: en-US
	defaultPowerBIDataSourceVersion: powerBI_V3
	discourageImplicitMeasures
	sourceQueryCulture: en-US

queryGroup Tables

	annotation PBI_QueryGroupOrder = 0

ref table Product
ref table Customer
ref table _Measures

ref role 'Regional Sales'
ref perspective 'Sales View'

ref cultureInfo en-US
```

## Quick Reference

### Property Cheat Sheet

| Object | Property | Values | Notes |
|--------|----------|--------|-------|
| Column | `dataType` | `string`, `int64`, `double`, `decimal`, `dateTime`, `boolean` | Required for data columns |
| Column | `summarizeBy` | `none`, `sum`, `count`, `min`, `max`, `average`, `distinctCount` | Use `none` for keys/attributes |
| Column | `isHidden` | (flag, no value) | Just write `isHidden` on its own line |
| Column | `isKey` | (flag, no value) | Marks the column as the table's key |
| Column | `displayFolder` | folder path string | Use `\` for nesting: `1. Year\Quarter` |
| Column | `sourceColumn` | source column name | Must match the Power Query output column |
| Column | `sortByColumn` | column name reference | Column to sort by (e.g., month name sorted by month number) |
| Measure | `formatString` | format pattern | e.g., `#,##0`, `0.00%` |
| Measure | `displayFolder` | folder path string | Use `\` for nesting |
| Measure | `formatStringDefinition` | DAX expression | Dynamic format string (replaces `formatString`) |
| All | `lineageTag` | GUID | Unique identifier, do not change existing values |

### Indentation Depth Summary

| Context | Depth | Tabs |
|---------|-------|------|
| Top-level declaration (`table`, `relationship`, `expression`) | 0 | 0 |
| Table properties, column/measure/hierarchy declarations | 1 | 1 |
| Column/measure properties, hierarchy levels | 2 | 2 |
| Multi-line DAX expression body | 3 | 3 |
| Level properties | 3 | 3 |

## Additional Resources

### Reference Files

- **`references/column-properties.md`** - Full property reference with valid values, `summarizeBy` rules, `formatString` patterns, `PBI_FormatHint` behavior, and `dataType` values
- **`references/naming-conventions.md`** - SQLBI naming conventions, display folder conventions, measure table conventions, and calculation group naming
- **`references/tmdl-file-examples.md`** - Complete examples for every TMDL file type (model, database, expressions, relationships, roles, perspectives, tables, cultures) including backtick-enclosed expressions, field parameters, calculation groups, and date tables

### Fetching Docs

To retrieve current TMDL reference docs, use `microsoft_docs_search` + `microsoft_docs_fetch` (MCP) if available, otherwise `mslearn search` + `mslearn fetch` (CLI). Search based on the user's request and run multiple searches as needed to ensure sufficient context before proceeding.

### External References

- [TMDL overview (Microsoft Learn)](https://learn.microsoft.com/en-us/analysis-services/tmdl/tmdl-overview)
- [TMDL syntax reference (Microsoft Learn)](https://learn.microsoft.com/en-us/analysis-services/tmdl/tmdl-how-to)
- [SQLBI naming conventions](https://www.sqlbi.com/articles/rules-of-the-game-how-to-name-things-in-your-data-model/)
