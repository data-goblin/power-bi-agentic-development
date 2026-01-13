# BPA Expression Syntax

Dynamic LINQ expression syntax for Best Practice Analyzer rules.

## Overview

BPA expressions use Dynamic LINQ with access to the Tabular Object Model (TOM). Expressions return `true` for objects that **violate** the rule.

## Basic Syntax

### String Operations

```csharp
// Null/empty checks
string.IsNullOrWhitespace(Description)
string.IsNullOrEmpty(Expression)

// Contains
Expression.Contains("CALCULATE")
Name.Contains(" ")

// StartsWith / EndsWith
Name.StartsWith("_")
Name.EndsWith("ID")

// Case-insensitive search
Expression.IndexOf("TODO", StringComparison.OrdinalIgnoreCase) >= 0

// Regex matching
RegEx.IsMatch(Name, "^[A-Z][a-z]+")
RegEx.IsMatch(Expression, @"\bSUM\s*\(")
```

### Boolean Logic

```csharp
// Simple boolean
IsHidden
not IsHidden
IsVisible

// AND / OR
IsHidden and ReferencedBy.Count = 0
IsVisible or Table.IsVisible

// Complex conditions
(IsHidden or Table.IsHidden) and ReferencedBy.Count = 0
```

### Numeric Comparisons

```csharp
// Equality
Columns.Count = 0
Severity = 3

// Inequality
ReferencedBy.Count > 0
Measures.Count < 5

// Range (use AND)
Columns.Count >= 10 and Columns.Count <= 50
```

### Collection Operations (LINQ)

```csharp
// Any - at least one matches
DependsOn.Any()
DependsOn.Any(Key.ObjectType = "Column")
Columns.Any(IsHidden)

// All - every item matches
Columns.All(IsHidden)
Measures.All(string.IsNullOrWhitespace(Description))

// Count
ReferencedBy.Count = 0
Columns.Count(IsHidden) > 5

// Where (filter)
Columns.Where(not IsHidden).Count() > 100
```

### Nested Property Access

```csharp
// Parent object
Table.Name
Table.IsHidden
Column.Table.Model.Name

// Child collections
Table.Columns.Count
Table.Measures.Any()
```

## Properties by Object Type

<!-- TODO: Expand with complete TOM property reference -->

### Model

```csharp
Name                    // Model name
Tables                  // Collection of tables
Relationships           // Collection of relationships
Perspectives            // Collection of perspectives
Cultures                // Collection of cultures
Roles                   // Collection of roles
DataSources            // Collection of data sources
```

### Table

```csharp
Name                    // Table name
Description             // Table description
IsHidden                // Is table hidden
IsPrivate               // Is table private (calculation group)
Columns                 // Collection of columns
Measures                // Collection of measures
Hierarchies             // Collection of hierarchies
Partitions              // Collection of partitions
CalculationGroup        // Calculation group (if calc group table)
ObjectType              // "Table"
```

### Column

```csharp
Name                    // Column name
Description             // Column description
DataType                // DataType enum
SourceColumn            // Source column name (for data columns)
Expression              // DAX expression (calculated columns)
FormatString            // Format string
DisplayFolder           // Display folder path
IsHidden                // Is column hidden
IsKey                   // Is primary key
IsNullable              // Allows nulls
IsAvailableInMDX        // Available in MDX
SummarizeBy             // Default aggregation
SortByColumn            // Sort by column reference
Table                   // Parent table
ReferencedBy            // Objects referencing this column
DependsOn               // Objects this column depends on
UsedInRelationships     // Relationships using this column
UsedInSortBy            // Columns sorted by this
UsedInHierarchies       // Hierarchies containing this
ObjectType              // "Column", "CalculatedColumn", etc.
```

### Measure

```csharp
Name                    // Measure name
Description             // Measure description
Expression              // DAX expression
FormatString            // Format string
DisplayFolder           // Display folder path
IsHidden                // Is measure hidden
IsSimpleMeasure         // Is implicit measure
Table                   // Parent table
ReferencedBy            // Objects referencing this measure
DependsOn               // Objects this measure depends on
KPI                     // KPI (if defined)
ObjectType              // "Measure"
```

### Hierarchy

```csharp
Name                    // Hierarchy name
Description             // Hierarchy description
DisplayFolder           // Display folder path
IsHidden                // Is hierarchy hidden
Levels                  // Collection of levels
Table                   // Parent table
```

### Relationship

```csharp
FromTable               // From table
FromColumn              // From column
ToTable                 // To table
ToColumn                // To column
FromCardinality         // Cardinality (Many/One)
ToCardinality           // Cardinality (Many/One)
CrossFilteringBehavior  // OneDirection/BothDirections
IsActive                // Is relationship active
SecurityFilteringBehavior // Security filtering
```

### Partition

```csharp
Name                    // Partition name
Description             // Partition description
Expression              // M query or SQL
SourceType              // Query/M/Calculated
Table                   // Parent table
Mode                    // Import/DirectQuery/Dual
```

### CalculationItem

```csharp
Name                    // Calculation item name
Description             // Description
Expression              // DAX expression
FormatStringExpression  // Format string DAX
Ordinal                 // Sort order
CalculationGroup        // Parent calculation group
```

## Common Patterns

### Unused Objects

```csharp
// Unused hidden column
IsHidden and ReferencedBy.Count = 0 and not UsedInRelationships.Any()

// Unused measure
ReferencedBy.Count = 0 and not string.IsNullOrEmpty(Expression)
```

### Missing Metadata

```csharp
// No description
string.IsNullOrWhitespace(Description)

// No format string on numeric measure
DataType = DataType.Int64 and string.IsNullOrWhitespace(FormatString)

// Visible with no display folder
not IsHidden and string.IsNullOrWhitespace(DisplayFolder)
```

### DAX Anti-patterns

```csharp
// Uses IFERROR
Expression.Contains("IFERROR")

// Uses implicit CALCULATE
DependsOn.Any(Key.ObjectType = "Column" and Value.Any(not FullyQualified))

// Division without DIVIDE
Expression.Contains("/") and not Expression.Contains("DIVIDE")
```

### Naming Conventions

```csharp
// Starts with number
RegEx.IsMatch(Name, "^[0-9]")

// Contains special characters
RegEx.IsMatch(Name, "[^a-zA-Z0-9 _-]")

// Not in PascalCase
not RegEx.IsMatch(Name, "^[A-Z][a-z]+(?:[A-Z][a-z]+)*$")
```

### Performance Issues

```csharp
// Table too wide
Columns.Count > 100

// Many calculated columns
Columns.Count(ObjectType = "CalculatedColumn") > 10

// Bi-directional relationship
CrossFilteringBehavior = CrossFilteringBehavior.BothDirections
```

## Fix Expression Syntax

Fix expressions modify object properties or call methods.

### Property Assignment

```csharp
// Set string property
Description = "TODO: Add description"
DisplayFolder = "Measures\\Calculated"

// Set boolean
IsHidden = true
IsAvailableInMDX = false

// Set enum
DataType = DataType.Decimal
SummarizeBy = AggregateFunction.None
CrossFilteringBehavior = CrossFilteringBehavior.OneDirection
```

### Method Calls

```csharp
// Delete object (use with caution!)
Delete()
```

### Enum Values

**DataType:**
`Unknown`, `String`, `Int64`, `Double`, `DateTime`, `Decimal`, `Boolean`, `Binary`, `Variant`

**AggregateFunction:**
`Default`, `None`, `Sum`, `Min`, `Max`, `Count`, `Average`, `DistinctCount`

**CrossFilteringBehavior:**
`OneDirection`, `BothDirections`, `Automatic`

## DAX Token Analysis (Tokenize)

The `Tokenize()` method parses DAX expressions into tokens for precise analysis.

### Basic Usage

```csharp
// Check if expression uses division operator (not dividing by literal)
Tokenize().Any(Type = DIV and Next.Type <> INTEGER_LITERAL and Next.Type <> REAL_LITERAL)

// Check for specific function usage
Tokenize().Any(Type = FUNCTION and Text = "CALCULATE")

// Find FILTER(ALL(...)) pattern
Tokenize().Any(Type = FUNCTION and Text = "FILTER" and Next.Next.Type = FUNCTION and Next.Next.Text = "ALL")
```

### Token Types

Common token types available in `Tokenize()`:

| Token Type | Description |
|------------|-------------|
| `FUNCTION` | DAX function name |
| `COLUMN_OR_MEASURE` | Column or measure reference |
| `TABLE` | Table reference |
| `INTEGER_LITERAL` | Integer constant |
| `REAL_LITERAL` | Decimal constant |
| `STRING_LITERAL` | String constant |
| `DIV` | Division operator `/` |
| `MULT` | Multiplication operator `*` |
| `PLUS` | Addition operator `+` |
| `MINUS` | Subtraction operator `-` |
| `EQ` | Equals operator `=` |
| `OPEN_PARENS` | Opening parenthesis `(` |
| `CLOSE_PARENS` | Closing parenthesis `)` |
| `COMMA` | Comma separator `,` |

### Token Properties

```csharp
Type        // Token type (see table above)
Text        // Actual text of the token
Next        // Next token in sequence
Previous    // Previous token in sequence
```

### Examples

```csharp
// Detect division by variable (not constant)
Tokenize().Any(Type = DIV and Next.Type <> INTEGER_LITERAL and Next.Type <> REAL_LITERAL)

// Find SUMX usage
Tokenize().Any(Type = FUNCTION and Text = "SUMX")

// Find nested CALCULATE
Tokenize().Count(Type = FUNCTION and Text = "CALCULATE") > 1

// Detect IF with three arguments (potential for SWITCH)
Tokenize().Any(Type = FUNCTION and Text = "IF")
```


## DependsOn Collection

The `DependsOn` property provides dependency analysis for measures and calculated columns.

### Structure

```csharp
DependsOn.Any()                              // Has any dependencies
DependsOn.Any(Key.ObjectType = "Column")     // Depends on columns
DependsOn.Any(Key.ObjectType = "Measure")    // Depends on measures
DependsOn.Any(Key.ObjectType = "Table")      // Depends on tables
```

### Checking Qualification

```csharp
// Column references should be fully qualified
DependsOn.Any(Key.ObjectType = "Column" and Value.Any(not FullyQualified))

// Measure references should NOT be fully qualified
DependsOn.Any(Key.ObjectType = "Measure" and Value.Any(FullyQualified))
```

### Value Properties

Each dependency entry has a `Value` collection with properties:

```csharp
FullyQualified    // Is the reference fully qualified (e.g., 'Table'[Column])
```


## ReferencedBy Collection

The `ReferencedBy` property shows what objects reference the current object.

### Common Uses

```csharp
// Not referenced by anything
ReferencedBy.Count = 0

// Referenced by visible measures
ReferencedBy.AllMeasures.Any(not IsHidden)

// Referenced by roles (RLS)
ReferencedBy.Roles.Any()

// Check for orphaned hidden objects
(IsHidden or Table.IsHidden) and
not ReferencedBy.AllMeasures.Any(not IsHidden) and
not ReferencedBy.AllColumns.Any(not IsHidden)
```

### Sub-collections

```csharp
ReferencedBy.AllMeasures      // All measures referencing this
ReferencedBy.AllColumns       // All columns referencing this
ReferencedBy.AllTables        // All tables referencing this
ReferencedBy.Roles            // Security roles referencing this
```


## OuterIt Reference

When using nested LINQ expressions, `outerIt` refers to the outer object.

### Examples

```csharp
// Check if column is used in any relationship from this table
Model.Relationships.Any(FromColumn = outerIt)

// Check if table has any measure with empty description
Measures.Any(string.IsNullOrWhitespace(outerIt.Description))

// Multiple relationships between same tables
Model.Relationships.Count(FromTable = OuterIt.FromTable and ToTable = OuterIt.ToTable) > 1
```


## Tips

1. **Test incrementally** - Build complex expressions step by step
2. **Check parentheses** - Group conditions explicitly
3. **Handle nulls** - Use `string.IsNullOrWhitespace()` for strings
4. **Consider inheritance** - Column checks apply to all column types
5. **Performance** - Complex expressions slow BPA scanning
6. **Use Tokenize() for DAX analysis** - More precise than string matching
7. **Prefer DependsOn over string matching** - Handles edge cases correctly
