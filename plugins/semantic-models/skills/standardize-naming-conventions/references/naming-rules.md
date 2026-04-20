# Naming Convention Rules Reference

Rules for standardizing naming conventions in Power BI semantic models (TMDL format). These rules are derived from common best practices and should be adapted to each organization's business terminology.

## Core Principle

Names must align with the business terminology used by people in the organization. Never assume terminology -- always confirm with the user or infer from existing patterns in the model. The model should be an authoritative source of truth for terminology.

## Rule Categories

### 1. Human-Readable Names (No Programming Conventions)

**Rule:** All table, column, and measure names must use standard casing with spaces. No CamelCase, snake_case, UPPER_CASE, or other programming conventions.

| Anti-Pattern | Correct |
|-------------|---------|
| `OrderStatus` | `Order Status` |
| `past_due_orders` | `Past Due Orders` |
| `TOTAL_COST` | `Total Cost` |
| `net_sales_previous_year` | `Net Sales 1YP` |
| `TurnoverMTD` | `Turnover MTD` |
| `SellMrgn%` | `Selling Margin (%)` |

**Detection patterns in TMDL:**
- `measure [a-z]+_[a-z]+` -- snake_case measures
- `measure [A-Z][a-z]+[A-Z]` -- CamelCase measures
- `measure [A-Z_]{4,}` -- UPPER_CASE measures
- Same patterns for `column` declarations

### 2. No Abbreviations or Acronyms

**Rule:** Spell out full words. Exceptions only for universally understood abbreviations (MTD, YTD, QTD) or standard business acronyms that are defined in descriptions.

| Anti-Pattern | Correct |
|-------------|---------|
| `Del. Mrgn %` | `Delivery Margin (%)` |
| `TFS` | `Total Freight Surcharge` |
| `COGS` | `Total Net Invoice COGS` (with description defining COGS) |
| `T&CF` | `Total Taxes & Commercial Fees` |
| `NetSls` | `Net Sales` |
| `TotDelCst` | `Total Delivery Cost` |
| `inv_lines_cnt` | `Invoice Lines` |
| `frght` | `Freight` |
| `shp_dt` | `Ship Date` |
| `CustKey` | `Customer Key` |
| `BillDocTypeCd` | `Billing Document Type Code` |
| `NI_COGS` | `Net Invoice COGS` |

**Detection patterns:**
- Names shorter than 5 characters that aren't common words
- Names containing periods followed by spaces (abbreviation dots): `\w+\.\s`
- Names with vowels removed: consecutive consonants of 3+ characters
- Single-letter or two-letter words that aren't prepositions/articles

### 3. No Technical Prefixes

**Rule:** Do not use DIM_, FACT_, or similar technical prefixes on table names. Use Tabular Editor's Table Groups annotation to organize tables into Dimension/Fact categories instead.

| Anti-Pattern | Correct |
|-------------|---------|
| `DIM_Customer` | `Customer` |
| `FACT_Invoices` | `Invoices` |
| `DIM_Date` | `Date` |
| `stg_Orders` | `Orders` |

**Exception:** Field parameters can use `FP_` prefix and calculation groups can use `CG_` prefix when not exposed to end users or the AI schema. Technical tables like `__Measures` or `__Formatting` can use underscore prefixes.

**Detection patterns:**
- `table (DIM|FACT|dim|fact|STG|stg|RAW|raw)_` -- technical prefixes

### 4. No Excessive Symbols or Special Characters

**Rule:** Avoid emojis, excessive dollar signs, Unicode decorations, or other non-standard characters in names.

| Anti-Pattern | Correct |
|-------------|---------|
| `Turnover $$$` | `Turnover` |
| `Revenue $$` | `Revenue` |
| `SELL_MARGIN_$` | `Selling Margin (Value)` |

**Detection patterns:**
- Names containing `$`, `#` (except `#` in count measures like `# Customers`)
- Names containing emoji Unicode ranges
- Names with repeated special characters

### 5. Consistent Aggregation Syntax

**Rule:** Choose one convention for time aggregations and apply it uniformly throughout the model.

**Recommended convention:** Use standard abbreviations as suffixes, wrapped in nothing or minimal syntax:
- `MTD` (Month to Date)
- `QTD` (Quarter to Date)
- `YTD` (Year to Date)
- `Weekly Average`, `Daily Average` (for rolling)

**Placement:** Aggregation follows the base measure name:
- `Turnover MTD`
- `Budget QTD`
- `Net Sales YTD`

| Anti-Pattern | Correct |
|-------------|---------|
| `mtd_turnover_ly` | `MTD Turnover 1YP` |
| `TurnoverMTD` | `Turnover MTD` |
| `MonthToDateSales` | `Sales MTD` |

### 6. Consistent Unit Syntax

**Rule:** Choose one convention for units and apply it uniformly. Use parentheses for units.

**Recommended convention:** `Measure Name (Unit)` where unit is one of:
- Currency symbol or code in parentheses when needed: `(EUR)`, `(USD)`
- `(%)` for percentages
- `(Quantity)` for quantity measures
- `(Value)` for monetary value (default, sometimes omitted)
- `(Units)` or `(pcs)` for piece counts

| Anti-Pattern | Correct |
|-------------|---------|
| `SellMrgn%` | `Selling Margin (%)` |
| `SELL_MARGIN_$` | `Selling Margin (Value)` |
| `TrnOvr_Qty` | `Turnover (Quantity)` |
| `SM pct 1YP` | `Selling Margin 1YP (%)` |

### 7. Consistent Period Syntax

**Rule:** Choose one convention for time period comparisons and apply it uniformly.

**Recommended convention:** Use `nYP` (n-Year Prior) format:
- `1YP` = 1 Year Prior (previous year)
- `2YP` = 2 Years Prior
- `1MP` = 1 Month Prior (if needed)

**Placement:** Period follows the base measure name but precedes unit:
- `Turnover 1YP`
- `Net Sales 2YP`
- `Selling Margin 1YP (%)`

| Anti-Pattern | Correct |
|-------------|---------|
| `Turnover_Last_Year` | `Turnover 1YP` |
| `T.O. Qty PY` | `Turnover 1YP (Quantity)` |
| `TRNVR_2YR` | `Turnover 2YP` |
| `DM val 2 yrs ago` | `Delivery Margin 2YP (Value)` |
| `net_sales_previous_year` | `Net Sales 1YP` |
| `S.M. % LY` | `Standard Margin 1YP (%)` |

### 8. Consistent Comparison Syntax

**Rule:** For measures that compare actuals to targets or prior periods, use `vs.` syntax with the target/period and unit.

**Recommended convention:** `Base Measure vs. Target (Unit)`
- `Turnover vs 1YP (%)` -- percentage variance to prior year
- `Budget MTD vs. Turnover (delta)` -- absolute variance using delta symbol or word
- `Forecast vs. Turnover (%)` -- percentage variance to forecast

Use the delta symbol or abbreviation consistently:
- Either always `(delta)` or always the delta symbol
- Either always `vs.` (with period) or always `vs` (without)

### 9. Display Folder Organization

**Rule:** Use numbered prefixes for display folders to control sort order. Organize into a logical hierarchy.

**Recommended structure for fact tables:**
```
0. Measures\
    1. Value\
        i. Total
        ii. 1YP
        iii. 2YP
    2. Quantity
    3. Lines
1. Facts
2. Degenerate Dimensions
3. Keys\
    Dates
```

**Recommended structure for dimension tables:**
```
1. [Primary Hierarchy Name]
2. [Attributes]
3. Managers
4. Keys
```

### 10. Descriptions

**Rule:** All visible measures and columns should have descriptions (TMDL `///` comments). Descriptions should explain:
- What the measure calculates
- Any business context needed to interpret it
- How to use it (for measures that require filter context, like field parameters)
- Definition of acronyms used in the name

**Example:**
```tmdl
/// Net orders exclude cancellation document types
measure 'Net Orders' =
```

### 11. Synonyms (Prep for AI)

When using "Prep your data for AI" or setting synonyms:
- Only list real synonyms that people in the organization use
- Consider multilingual synonyms for international organizations
- Synonyms primarily benefit AI/agent queries

## Measure Name Construction Order

The full name of a measure should follow this consistent construction:

```
[Aggregation] [Base Name] [Period] ([Unit])
```

Examples:
- `Turnover` (base only)
- `Turnover (Quantity)` (base + unit)
- `Turnover 1YP` (base + period)
- `Turnover 1YP (Quantity)` (base + period + unit)
- `MTD Turnover 1YP` (aggregation + base + period)
- `Turnover vs 1YP (%)` (base + comparison + unit)
- `MTD Turnover vs 1YP (%)` (aggregation + base + comparison + unit)

## Column Name Rules

Columns generally follow simpler rules:
1. Use full, human-readable names with spaces
2. Use standard casing (not snake_case or CamelCase)
3. Avoid abbreviations
4. Hidden key columns can use `[Table Name] Key` pattern
5. Group into display folders by purpose (Hierarchy, Attributes, Keys, Facts)
