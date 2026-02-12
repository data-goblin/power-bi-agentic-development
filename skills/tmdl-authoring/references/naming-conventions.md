# Naming Conventions Reference

SQLBI-aligned naming conventions for Power BI semantic models, distilled into actionable patterns for TMDL authoring.

## Table Naming

### Dimension Tables

Use **singular nouns** in PascalCase or natural language:

| Good | Avoid |
|------|-------|
| `Customer` | `Customers`, `DimCustomer`, `dim_customer` |
| `Product` | `Products`, `DimProduct`, `tbl_Products` |
| `Date` | `Dates`, `DimDate`, `Calendar` |
| `'Invoice Document Type'` | `InvoiceDocumentTypes`, `Invoice_Document_Type` |

### Fact Tables

Use **plural nouns** in PascalCase or natural language:

| Good | Avoid |
|------|-------|
| `Orders` | `Order`, `FactOrders`, `fact_orders` |
| `Invoices` | `Invoice`, `FactInvoice`, `fct_Invoice` |
| `Budgets` | `Budget`, `FactBudget` |

### Supporting Tables

| Table Type | Convention | Examples |
|------------|-----------|----------|
| Measure table | Underscore prefix: `_Measures` | `_Measures`, `___ProjectSpecific` |
| Disconnected slicer | Descriptive with numbered prefix | `'1) Selected Metric'`, `'2) Selected Unit'` |
| Calculation group | `Cg` prefix + PascalCase | `CgMetricValue`, `CgTimeIntelligence`, `CgUnit` |
| Bridge / link table | Descriptive name | `'On-Time Delivery'`, `'Exchange Rate'` |

## Column Naming

### General Rules

- Use **natural language** with spaces: `'Product Name'`, not `ProductName` or `product_name`
- Use **title case**: `'Account Type'`, not `'account type'`
- Be descriptive: `'Calendar Year Number (ie 2021)'` is better than `'Year'` when disambiguation is needed

### Key Columns

- Suffix with `Key`: `'Product Key'`, `'Customer Key'`
- Hide key columns from report authors (`isHidden`)
- Place in a `Keys` display folder (often numbered: `5. Keys`)

### Code/Type Columns

- Include the entity context: `'Billing Document Type Code'`, not just `'Type Code'`
- Be specific: `'Ship Class for Part'`, not `'Ship Class'`

## Measure Naming

### Prefixes for Count Measures

Use `#` prefix for count measures:

```
# Products
# Customers
# Orders
# Workdays MTD
```

### Prefixes for Percentage Measures

Use `%` prefix for percentage measures:

```
% Workdays MTD
OTD % (Value)
```

### Time Intelligence Suffixes

| Suffix | Meaning | Example |
|--------|---------|---------|
| `MTD` | Month-to-date | `Actuals MTD` |
| `YTD` | Year-to-date | `Sales Target YTD` |
| `PY` | Prior year | `Net Orders PY` |
| `PY REPT` | Prior year repeated | `OTD % (Value; PY REPT)` |

### Comparison Measures

Use descriptive names with delta symbols or comparison indicators:

```
Orders Target vs. Net Orders (Δ)
Sales Target MTD vs. Actuals (%)
Orders Target vs. Net Orders (Δ) Trend Line
```

### Measure Table

Store measures in a dedicated `_Measures` table (unquoted, underscore prefix). This keeps measures organized separately from table columns.

For project-specific measure tables, use multiple underscores: `___ProjectSpecific`.

## Display Folder Conventions

### Numbered Folders

Prefix display folder names with numbers for consistent ordering:

```
1. Product Hierarchy
2. Product Attributes
3. Brand
4. Logistics
5. Keys
```

### Nested Folders

Use backslash for subfolder nesting:

```
2. MTD\Actuals
2. MTD\Sales Target
4. YTD
5. Weekday / Workday\Measures\# Workdays
```

### Common Folder Patterns

| Folder | Contents |
|--------|----------|
| `Measures` | General measures on a table |
| `1. [Hierarchy Name]` | Columns in a hierarchy |
| `2. [Attribute Group]` | Related attribute columns |
| `5. Keys` | Hidden key columns |

## Calculation Group Naming

### Table Name

Use `Cg` prefix followed by PascalCase description:

```
CgMetricValue
CgMetricQuantity
CgMetricLines
CgUnit
CgSalesTarget
CgOrdersTarget
CgTimeIntelligence
```

### Calculation Items

Use descriptive names matching their purpose:

```
// In CgTimeIntelligence:
Full Period
MTD
YTD
Prior Year
```

## Relationship Naming

Relationships use auto-generated GUIDs as identifiers. The meaningful parts are the `fromColumn` and `toColumn` references:

```tmdl
relationship abc-123
	fromColumn: Invoices.'Customer Key'
	toColumn: Customer.'Customer Key'
```

Convention: the `fromColumn` is on the many side (fact table), and the `toColumn` is on the one side (dimension table).

## Summary: Quick Decision Table

| Object | Convention | Example |
|--------|-----------|---------|
| Dimension table | Singular noun | `Customer` |
| Fact table | Plural noun | `Orders` |
| Measure table | `_` prefix | `_Measures` |
| Calculation group | `Cg` prefix | `CgTimeIntelligence` |
| Column | Natural language, title case | `'Product Name'` |
| Key column | `Key` suffix, hidden | `'Product Key'` |
| Count measure | `#` prefix | `# Products` |
| Percentage measure | `%` prefix or suffix | `% Workdays MTD` |
| Time intelligence | Standard suffix | `Actuals MTD`, `Net Orders PY` |
| Display folder | Numbered prefix | `1. Product Hierarchy` |
