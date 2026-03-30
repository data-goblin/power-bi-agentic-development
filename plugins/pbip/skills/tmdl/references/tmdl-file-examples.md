# TMDL File Type Examples

All examples reference the SpaceParts model in `examples/SpaceParts.SemanticModel/definition/`. Read those files directly for complete, real-world TMDL.

## File Type Index

| File Type | Example Path | What It Shows |
|-----------|-------------|---------------|
| `database.tmdl` | `definition/database.tmdl` | Compatibility level (minimal file) |
| `model.tmdl` | `definition/model.tmdl` | Model config, queryGroups, ref entries, annotations, auto date/time toggle |
| `expressions.tmdl` | `definition/expressions.tmdl` | Shared M parameters (text, datetime), M functions, backtick-enclosed blocks, queryGroup assignment |
| `functions.tmdl` | `definition/functions.tmdl` | DAX UDFs with typed parameters (`EXPR`, `STRING`, `INT64`, `ANYVAL`, `COLUMN`), `=>` syntax, backtick blocks |
| `relationships.tmdl` | `definition/relationships.tmdl` | Active/inactive relationships, `crossFilteringBehavior`, `toCardinality: many`, `///` comments on inactive |
| Role files | `definition/roles/*.tmdl` | RLS with UDF calls (`RLS.ApplySimpleRLS`), `modelPermission`, `tablePermission` with DAX filter |
| Perspective files | `definition/perspectives/*.tmdl` | `perspectiveTable`, `perspectiveColumn`, `perspectiveMeasure`, `perspectiveHierarchy` |
| Culture file | `definition/cultures/en-US.tmdl` | `linguisticMetadata` with JSON content |
| Dimension table | `definition/tables/Brands.tmdl` | Columns, hierarchy, partition with M source, `sortByColumn`, `displayFolder`, `TabularEditor_TableGroup` |
| Fact table | `definition/tables/Invoices.tmdl` | 51 measures (single-line + multi-line DAX), 18 columns, `formatString`, `displayFolder` nesting, `///` descriptions |
| Calculated table | `definition/tables/__Measures.tmdl` | Measure-only table, `partition = calculated`, `source = {1}` |
| Date table | `definition/tables/Date.tmdl` | `dataCategory: Time`, calculated table with extensive DAX, boolean flags, sort columns |
| Calc group | `definition/tables/Z04CG1 - Time Intelligence.tmdl` | `calculationGroup`, `calculationItem` with backtick DAX, `precedence` |
| Calc group (UDFs) | `definition/tables/Z04CG1 - Time Intelligence - UDFs.tmdl` | Calc items calling DAX UDFs from `functions.tmdl` |
| Field parameter | `definition/tables/1) Selected Metric.tmdl` | `NAMEOF`, sort-by pattern, 3-column structure |
| SVG measures | `definition/tables/__SVGs.tmdl` | SVG DAX measures with backtick-enclosed expressions |
| UDF demo | `definition/tables/__Demo UDFs.tmdl` | Measures calling DAX UDFs |
| OTD measures | `definition/tables/On-Time Delivery.tmdl` | Measures with `///` descriptions, `DIVIDE`, percentage formatStrings |

## Key Syntax Patterns

These patterns appear in the example files. Read the files directly for full context.

### Backtick-Enclosed Expressions (triple `` ``` ``)

Used for DAX or M that contains TMDL-conflicting characters (colons, equals). See `functions.tmdl` and `Z04CG1 - Time Intelligence.tmdl`.

### DAX UDF Parameter Types

From `functions.tmdl`:

| Type | Description | Example |
|------|-------------|---------|
| `EXPR` | DAX expression (measure reference) | `[Sales Amount]` |
| `SCALAR NUMERIC VAL` | Numeric scalar value | `273.15` |
| `INT64` | Integer | `12` |
| `STRING` | Text value | `"PREFIX"` |
| `ANYVAL` | Any scalar value | `1`, `"text"`, `TRUE` |
| `COLUMN` | Column reference | `'Date'[Date]` |

### M Parameter Meta Syntax

From `expressions.tmdl`:

```tmdl
expression SqlEndpoint =
		"server.database.windows.net" meta
		[
			IsParameterQuery = true,
			IsParameterQueryRequired = true,
			Type = "Text"
		]
	lineageTag: abc-123
	queryGroup: Parameters
```

### RLS with UDFs

From `roles/Account Managers.tmdl`:

```tmdl
role 'Account Managers'
	modelPermission: read

	tablePermission Customers = RLS.ApplySimpleRLS ( 'Customers'[Account Manager] )
```

### Calculated Table (Measure Table Pattern)

From `tables/__Measures.tmdl`:

```tmdl
table __Measures
	lineageTag: abc-123

	column Value
		isHidden
		lineageTag: def-456
		isNameInferred
		sourceColumn: [Value]

	partition __Measures = calculated
		mode: import
		source = {1}
```
