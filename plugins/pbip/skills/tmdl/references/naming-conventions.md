# Naming Conventions Reference

Naming conventions for Power BI semantic models, distilled into actionable patterns for TMDL authoring.

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
| Measure table | Underscore prefix: `__Measures` | `__Measures`, `___ProjectSpecific` |
| Disconnected slicer | Descriptive with numbered prefix | `'1) Selected Metric'`, `'2) Selected Unit'` |
| Calculation group | `Cg` prefix + PascalCase | `CgMetricValue`, `CgTimeIntelligence`, `CgUnit` |
| Bridge / link table | Standard convention - descriptive name | `'On-Time Delivery'`, `'Exchange Rate'` |

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

Store measures in a dedicated `__Measures` table (unquoted, underscore prefix). This keeps measures organized separately from table columns.

## Display Folder Conventions

### Numbered Folders

Prefix display folder names with numbers for consistent ordering:

```
01. Product Hierarchy
02. Product Attributes
03. Brand
04. Logistics
05. Keys
```

### Nested Folders

Use backslash for subfolder nesting:

```
02. MTD\A. Actuals
02. MTD\B. Sales Target
04. YTD
05. Weekday / Workday\Measures\C. Workdays
```

### Common Folder Patterns

| Folder | Contents |
|--------|----------|
| `Measures` | General measures on a table |
| `01. [Hierarchy Name]` | Columns in a hierarchy |
| `02. [Attribute Group]` | Related attribute columns |
| `05. Keys` | Hidden key columns |

### Calculation Items

Use descriptive names matching their purpose:

```
// In CgTimeIntelligence:
Full Period
MTD
YTD
Prior Year
```

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

## References

- sqlbi naming conventions (DAX): https://docs.sqlbi.com/dax-style/dax-naming-conventions
- Tabular Editor: https://tabulareditor.com/blog/gather-requirements-for-semantic-models
