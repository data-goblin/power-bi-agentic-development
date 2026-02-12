# Column Properties Reference

Complete reference for column properties in TMDL files, including valid values, rules, and common patterns.

## Property Reference

### dataType

Specifies the column's data type. Required for data columns.

| Value | Description | When to Use |
|-------|-------------|-------------|
| `string` | Text values | Names, codes, descriptions, categories |
| `int64` | 64-bit integer | Keys, counts, year numbers, integer quantities |
| `double` | Double-precision floating point | Calculated values, ratios, percentages |
| `decimal` | Fixed-point decimal | Currency amounts, precise financial values |
| `dateTime` | Date and time | Date columns, timestamps |
| `boolean` | True/False | Flag columns, indicators |
| `binary` | Binary data | Rarely used in analytical models |

**Example:**
```tmdl
column 'Product Name'
	dataType: string
```

### summarizeBy

Controls the default aggregation behavior when the column is used in a visual without an explicit measure. This is a metadata property that affects the Power BI UI, not DAX calculations.

| Value | Description | When to Use |
|-------|-------------|-------------|
| `none` | No default aggregation | Keys, attributes, dates, text columns, non-additive numbers |
| `sum` | Default to SUM | Additive numeric facts (amounts, quantities, counts) |
| `count` | Default to COUNT | Rarely used; prefer explicit measures |
| `min` | Default to MIN | Rarely used |
| `max` | Default to MAX | Rarely used |
| `average` | Default to AVERAGE | Rarely used |

#### summarizeBy Decision Rules

**Use `none` for:**
- All key columns (surrogate keys, natural keys, foreign keys)
- All text/string columns (names, codes, types, descriptions)
- All date/dateTime columns
- All boolean columns
- Non-additive numeric columns (rates, percentages, ratios, rankings)
- Numeric columns that serve as sort keys (e.g., month number for sorting month name)
- Year number columns (e.g., `Calendar Year Number (ie 2021)`)

**Use `sum` for:**
- Additive fact columns (sales amount, quantity, line total)
- Columns where implicit SUM makes business sense

**General rule:** When in doubt, use `none`. It's always safe — users should create explicit measures for aggregation rather than relying on implicit aggregation.

**Example fix — year number column incorrectly set to sum:**
```tmdl
// Before (wrong: year number should not be summed)
column 'Calendar Year Number (ie 2021)'
	displayFolder: 1. Year
	lineageTag: abc-123
	summarizeBy: sum
	isNameInferred
	sourceColumn: [Calendar Year Number (ie 2021)]

	annotation SummarizationSetBy = Automatic

// After (correct)
column 'Calendar Year Number (ie 2021)'
	displayFolder: 1. Year
	lineageTag: abc-123
	summarizeBy: none
	isNameInferred
	sourceColumn: [Calendar Year Number (ie 2021)]

	annotation SummarizationSetBy = Automatic
```

### isHidden

A flag property (no value) that hides the column from report authors. Written on its own line:

```tmdl
column 'Product Key'
	dataType: int64
	isHidden
	displayFolder: 5. Keys
	lineageTag: abc-123
	summarizeBy: none
	sourceColumn: Product Key
```

**When to hide:**
- Surrogate key columns (used only in relationships)
- Technical columns not relevant to report authors
- Columns superseded by a hierarchy

### isKey

A flag property marking the column as the table's primary key:

```tmdl
column Date
	isKey
	displayFolder: 6. Calendar Date
	lineageTag: abc-123
	summarizeBy: none
	sourceColumn: [Date]
```

Only one column per table should have `isKey`. It enables certain DAX optimizations and is required for the Date table (`dataCategory: Time`).

### displayFolder

Organizes columns into folders in the Power BI field list:

```tmdl
column 'Product Name'
	displayFolder: 1. Product Hierarchy
```

**Nesting:** Use backslash for subfolder nesting:

```tmdl
measure '# Workdays MTD' =
		CALCULATE( MAX( 'Date'[Workdays MTD] ), 'Date'[IsDateInScope] = TRUE )
	displayFolder: 5. Weekday / Workday\Measures\# Workdays
```

**Numbering convention:** Prefix folder names with numbers for ordering: `1. Year`, `2. Product Attributes`, `5. Keys`.

### sourceColumn

References the Power Query output column that feeds this column:

```tmdl
// When column name matches source name
column 'Product Name'
	sourceColumn: Product Name

// When column is name-inferred (auto-generated from source)
column Date
	isNameInferred
	sourceColumn: [Date]
```

**Note:** `isNameInferred` indicates the column name was automatically derived from the source. The `sourceColumn` value in square brackets (`[Date]`) is the M expression format.

### sortByColumn

Specifies another column to use for sorting:

```tmdl
column 'Calendar Month (ie Jan)'
	displayFolder: 2. Month
	lineageTag: abc-123
	summarizeBy: none
	sourceColumn: [Calendar Month (ie Jan)]
	sortByColumn: 'Calendar Month Number (ie 01)'
```

The sort column must be in the same table and should have a one-to-one or many-to-one relationship with the sorted column.

### lineageTag

A GUID that uniquely identifies the column across model versions. **Never change an existing lineageTag** — it would break report bindings.

```tmdl
column 'Product Name'
	lineageTag: a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

When adding a new column, generate a fresh GUID.

## formatString Patterns

### Numeric Formats

| Pattern | Description | Example Output |
|---------|-------------|----------------|
| `#,##0` | Integer with thousands separator | 1,234 |
| `#,##0.00` | Two decimal places | 1,234.56 |
| `#,##0.0` | One decimal place | 1,234.6 |
| `0` | Integer, no thousands separator | 1234 |
| `0.00` | Two decimals, no thousands separator | 1234.56 |

### Percentage Formats

| Pattern | Description | Example Output |
|---------|-------------|----------------|
| `#,##0%` | Integer percentage (value * 100) | 85% |
| `0.00%` | Two decimal percentage | 85.00% |
| `0.0%` | One decimal percentage | 85.0% |
| `#,##0.00%` | Two decimals with thousands | 1,234.56% |
| `0.00\ %;-0.00\ %;0.00\ %` | With space before %, positive/negative/zero | 85.00 % |

### Currency Formats

| Pattern | Description | Example Output |
|---------|-------------|----------------|
| `$#,##0` | USD integer | $1,234 |
| `$#,##0.00` | USD with cents | $1,234.56 |
| `#,##0.00 €` | Euro with symbol after | 1,234.56 € |

### Date Formats

| Pattern | Description | Example Output |
|---------|-------------|----------------|
| `mm/dd/yyyy` | US date | 01/15/2024 |
| `dd/mm/yyyy` | EU date | 15/01/2024 |
| `yyyy-mm-dd` | ISO date | 2024-01-15 |
| `mmm yyyy` | Month abbreviation and year | Jan 2024 |

### Where to Apply formatString

- **Measures:** Apply `formatString` to the measure definition
- **Columns:** Apply `formatString` to the column definition (less common; usually done for date display columns)

## PBI_FormatHint Annotation

Power BI Desktop automatically adds `PBI_FormatHint` annotations to describe the format type:

```tmdl
annotation PBI_FormatHint = {"isGeneralNumber":true}
```

Common values:

| Hint | Meaning |
|------|---------|
| `{"isGeneralNumber":true}` | General numeric format |
| `{"isDecimal":true}` | Decimal format |
| `{"isDateTimeCustom":true}` | Custom date/time format |
| `{"currencyCulture":"en-US"}` | Currency with culture |

**Behavior:**
- Power BI Desktop adds `PBI_FormatHint` automatically when a `formatString` is set through the UI
- Removing `PBI_FormatHint` is safe, but Power BI may re-add it on the next save
- When setting `formatString` in TMDL directly, you don't need to add `PBI_FormatHint` — but don't remove it if it's already there
- Having both `formatString` and `PBI_FormatHint` is normal and expected

## Common Annotations

### SummarizationSetBy

```tmdl
annotation SummarizationSetBy = Automatic
```

Indicates how the `summarizeBy` value was determined. Values: `Automatic` (Power BI inferred it) or `User` (explicitly set). This is informational — changing the annotation alone doesn't change the actual `summarizeBy` behavior.

### PBI_NavigationStepName

```tmdl
annotation PBI_NavigationStepName = Navigation
```

Power BI internal navigation metadata. Leave as-is.

### PBI_ResultType

```tmdl
annotation PBI_ResultType = Table
```

Indicates the M expression result type. Values: `Table`, `Text`, `DateTime`, etc. Leave as-is.

## Annotation Syntax

Annotations are key-value pairs at the same indentation level as properties, separated from properties by a blank line:

```tmdl
column 'Product Name'
	dataType: string
	lineageTag: abc-123
	summarizeBy: none
	sourceColumn: Product Name

	annotation SummarizationSetBy = Automatic

	annotation PBI_FormatHint = {"isGeneralNumber":true}
```

**Rules:**
- Blank line before the first annotation (separating it from properties)
- Blank line between annotations
- Same indentation depth as properties
- Format: `annotation <Name> = <Value>`
- Multi-line annotation values use indented continuation lines
