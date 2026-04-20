# DAX and Query Structure Patterns

Tier 1 DAX patterns (DAX001-DAX021) and Tier 2 query structure patterns (QRY001-QRY004).

> **Related references:** [Engine Internals](./engine-internals.md) · [Model and Direct Lake Optimization](./model-optimization.md)

---

## Section 3: Tier 1 DAX Optimization Patterns

> **Autonomy: Auto-apply freely. Modify only measure/UDF definitions in the DEFINE block. Keep EVALUATE and SUMMARIZECOLUMNS grouping identical.**

> **Prefer SUMMARIZECOLUMNS:** Fully supported inside measure definitions — earlier restrictions no longer apply. Use it to replace `ADDCOLUMNS`/`SUMMARIZE` patterns (DAX002), pre-materialize context transitions before iterating (DAX006), and cache repeated evaluations into a single virtual table (DAX003). Prefer it over `ADDCOLUMNS(VALUES(...), ...)` unless a specific scenario prevents it.

### DAX001: Use Simple Column Filter Predicates as CALCULATE Arguments

CALCULATE accepts simple boolean column predicates directly — these are more efficient than wrapping a table in FILTER (causes excessive materialization). Split `&&` into separate filter arguments.

**Anti-pattern — FILTER with table expression uses an iterator:**
```dax
CALCULATE(
    SUM('Sales'[Amount]),
    FILTER('Product', 'Product'[Category] = "Electronics")
)
```

**Preferred — column predicate, no iterator:**
```dax
CALCULATE(
    SUM('Sales'[Amount]),
    KEEPFILTERS( 'Product'[Category] = "Electronics")
)
```

**Anti-pattern — `&&` joins predicates into a single iterator argument:**
```dax
CALCULATETABLE( 'Sales', 'Sales'[Region] = "West" && 'Sales'[Amount] > 1000 )
```

**Preferred — separate predicates for better query plan:**
```dax
CALCULATETABLE( 'Sales', 'Sales'[Region] = "West", 'Sales'[Amount] > 1000 )
```

---

### DAX002: Replace ADDCOLUMNS/SUMMARIZE with SUMMARIZECOLUMNS

SUMMARIZECOLUMNS defines grouping + calculation in one step, enabling better SE fusion. Replace all ADDCOLUMNS/SUMMARIZE patterns.

**Anti-patterns:**
```dax
SUMMARIZE ( 'Sales', 'Sales'[ProductKey], "Total Profit", [Profit] )
ADDCOLUMNS ( SUMMARIZE ( 'Sales', 'Sales'[ProductKey] ), "Total Profit", [Profit] )
ADDCOLUMNS ( 'Sales', "Total Profit", CALCULATE ( [Profit] ) )
ADDCOLUMNS ( VALUES('Sales'[ProductKey]), "Total Profit", [Profit] )
```

**Preferred:**
```dax
SUMMARIZECOLUMNS ( 'Sales'[ProductKey], "Total Profit", [Profit] )
```

---

### DAX003: Cache Repeated and Context-Independent Expressions in Variables

Evaluating the same measure multiple times or placing context-independent expressions inside iterators causes redundant SE queries. Cache in a variable.

**Anti-pattern — repeated measure reference:**
```dax
VAR TotalA = [Sales Amount] * 1.1
VAR TotalB = [Sales Amount] * 0.9
VAR TotalC = [Sales Amount] + 1000
```

**Preferred:**
```dax
VAR _SalesAmount = [Sales Amount]
VAR TotalA = _SalesAmount * 1.1
VAR TotalB = _SalesAmount * 0.9
VAR TotalC = _SalesAmount + 1000
```

**Anti-pattern — same measure iterated twice:**
```dax
VAR A = SUMX ( VALUES('Sales'[ProductKey]), [Total Sales] )
VAR B = AVERAGEX ( VALUES('Sales'[ProductKey]), [Total Sales] )
```

**Preferred — materialize once:**
```dax
VAR Base = SUMMARIZECOLUMNS ( 'Sales'[ProductKey], "@TotalSales", [Total Sales] )
VAR A = SUMX ( Base, [@TotalSales] )
VAR B = AVERAGEX ( Base, [@TotalSales] )
```

**Anti-pattern — context-independent expression inside iterator:**
```dax
SUMX( 'Sales', 'Sales'[Quantity] * [Average Price] * 1.1 )
// [Average Price] doesn't change per row
```

**Preferred:**
```dax
VAR _AvgPrice = [Average Price]
RETURN SUMX( 'Sales', 'Sales'[Quantity] * _AvgPrice * 1.1 )
```

---

### DAX004: Remove Duplicate and Redundant Filters

Applying the same filter condition twice — whether as duplicate CALCULATE arguments or as a variable that restates an existing predicate — causes redundant SE evaluation.

**Anti-pattern — same predicate in CALCULATE + FILTER:**
```dax
CALCULATE(
    SUM('Sales'[Amount]),
    'Sales'[Year] = 2023,
    FILTER('Sales', 'Sales'[Year] = 2023)
)
```

**Anti-pattern — redundant filter variable:**
```dax
VAR FilteredValues = CALCULATETABLE ( DISTINCT ( 'Table'[Key1] ), 'Table'[Amount] > 1000 )
VAR Result =
    CALCULATETABLE (
        SUMMARIZECOLUMNS ( 'Table'[Key2], "TotalQty", SUM ( 'Table'[Quantity] ) ),
        'Table'[Amount] > 1000,
        'Table'[Key1] IN FilteredValues  -- redundant: already filtered by Amount > 1000
    )
```

**Preferred — single filter, no duplication:**
```dax
CALCULATE( SUM('Sales'[Amount]), 'Sales'[Year] = 2023 )

VAR Result =
    CALCULATETABLE (
        SUMMARIZECOLUMNS ( 'Table'[Key2], "TotalQty", SUM ( 'Table'[Quantity] ) ),
        'Table'[Amount] > 1000
    )
```

---

### DAX005: SUMMARIZE with Complex Table Expression

Instead of using SUMMARIZE with complex table expressions as the first argument, wrap with CALCULATETABLE instead.

**Anti-pattern:**
```dax
SUMMARIZE(
    CALCULATETABLE('Sales', 'Sales'[Year] = 2023, 'Sales'[CustomerKey] IN SellingPOCs),
    'Sales'[CustomerKey],
    "DistinctSKUs", DISTINCTCOUNT('Sales'[StoreKey])
)
```

**Preferred:**
```dax
CALCULATETABLE(
    SUMMARIZECOLUMNS(
        'Sales'[CustomerKey],
        "DistinctSKUs", DISTINCTCOUNT('Sales'[StoreKey])
    ),
    'Sales'[Year] = 2023,
    'Sales'[CustomerKey] IN SellingPOCs
)
```

---

### DAX006: Pre-Materialize Context Transitions with SUMMARIZECOLUMNS

Materializing context transition results in SUMMARIZECOLUMNS and iterating over pre-calculated values can improve query plan.

**Anti-pattern:**
```dax
SUMX(
    VALUES('Product'[Attribute]),
    CALCULATE(SUM('Sales'[Amount]))
)
```

**Preferred:**
```dax
SUMX(
    SUMMARIZECOLUMNS(
        'Product'[Attribute],
        "@Amount", SUM('Sales'[Amount])
    ),
    [@Amount]
)
```

---

### DAX007: Replace IF with INT for Boolean Conversion

INT with boolean expressions avoids conditional logic callbacks that IF statements trigger.

**Anti-pattern:**
```dax
SUMX(
    'Products',
    IF([Sales Amount] > 10000000, 1, 0)
)
```

**Preferred:**
```dax
SUMX(
    'Products',
    INT([Sales Amount] > 10000000)
)
```

**When the result is a count of qualifying rows, eliminate the iterator and callback entirely with a simple predicate:**
```dax
-- Anti-pattern: iterator + conditional = callback
SUMX( 'Sales', IF('Sales'[Amount] > 1000, 1, 0) )

-- Preferred: native SE aggregation, no iterator, no callback
CALCULATE( COUNTROWS('Sales'), 'Sales'[Amount] > 1000 )
```

---

### DAX008: Context Transition in Iterator

Context transition is powerful but expensive. Optimize by:

1. **Remove it completely:**
```dax
// Instead of: SUMX( 'Sales', [Sales Amount] )
// Use: SUMX( 'Sales', 'Sales'[Unit Price] * 'Sales'[Quantity] )
```

2. **Reduce number of columns:**
```dax
// Instead of: SUMX( 'Account', [Total Sales] )
// Use: SUMX( VALUES ( 'Account'[Account Key] ), [Total Sales] )
```

3. **Reduce cardinality before iteration:**
```dax
// Instead of: SUMX( 'Account', [Total Sales] * 'Account'[Corporate Discount] )
// Use: SUMX( VALUES ( 'Account'[Corporate Discount] ), [Total Sales] * 'Account'[Corporate Discount] )
```

---

### DAX009: Wrap SUMMARIZECOLUMNS Filters with CALCULATETABLE

Filters passed as direct arguments to SUMMARIZECOLUMNS inside measures can produce unexpected results. Move filters to a wrapping CALCULATETABLE instead.

**Anti-pattern:**
```dax
SUMMARIZECOLUMNS (
    'Table'[Column],
    TREATAS ( { "Value" }, 'Table'[FilterColumn] ),
    "@Calculation", [Measure]
)
```

**Preferred:**
```dax
CALCULATETABLE (
    SUMMARIZECOLUMNS (
        'Table'[Column],
        "@Calculation", [Measure]
    ),
    'Table'[FilterColumn] = "Value"
)
```

---

### DAX010: Apply Filters Using CALCULATETABLE Instead of FILTER

CALCULATETABLE modifies filter context directly for better query plans.

**Anti-pattern:**
```dax
FILTER( 'Sales', 'Sales'[Year] = 2023 )
```

**Preferred:**
```dax
CALCULATETABLE( 'Sales', 'Sales'[Year] = 2023 )
```

---

### DAX011: Distinct Count Alternatives

Depending on cardinality and data layout, moving DISTINCTCOUNT to SUMX(VALUES(),1) can improve performance by forcing FE evaluation.

**Storage Engine Bound:**
```dax
DISTINCTCOUNT('Sales'[CustomerKey])
```

**Formula Engine Bound (sometimes faster):**
```dax
SUMX(VALUES('Sales'[CustomerKey]), 1)
```

---

### DAX012: Use ALLEXCEPT Instead of ALL and VALUES Restoration

When clearing filter context with ALL() and then restoring specific columns via VALUES(), ALLEXCEPT achieves the same in one operation.

**Anti-pattern:**
```dax
CALCULATE( [Total Sales], ALL('Sales'), VALUES('Sales'[Region]) )
```

**Preferred:**
```dax
CALCULATE( [Total Sales], ALLEXCEPT('Sales', 'Sales'[Region]) )
```

> **Note:** Only valid when `'Sales'[Region]` is actively filtered. Without it, `VALUES` returns all regions (no-op restore) while `ALLEXCEPT` still clears other filters — the two forms are not equivalent, and `ALL + VALUES` is required.

---

### DAX013: SWITCH/IF Branch Optimization in SUMMARIZECOLUMNS

SWITCH/IF inside SUMMARIZECOLUMNS enables branch optimization — the engine evaluates only the matching branch. When this fails, it materializes a full cartesian product. Three things break it:

1. **Multiple aggregations in one branch** — merge into single SUMX: `SUMX('Sales', 'Sales'[SalesAmount] - 'Sales'[TotalCost])`
2. **Mismatched data types across branches** — an implicit cast breaks the optimization; use explicit conversion: `CONVERT(SUM('Sales'[OrderQuantity]), CURRENCY)`
3. **Context transition inside a branch iterator** — a measure reference that requires a context transition (e.g., `SUMX(Sales, 'Sales'[Quantity] * [selection])`) forces a full crossjoin. If the measure is context-independent, cache it before the iterator: `VAR _UnitDiscount = [Unit Discount]`

---

### DAX014: Use COUNTROWS Instead of DISTINCTCOUNT on Key Columns

Use when a column is a primary key (one-side of a relationship).

**Anti-pattern:**
```dax
DISTINCTCOUNT ( 'Product'[ProductKey] )
```

**Preferred:**
```dax
COUNTROWS ( 'Product' )
```

For non-key columns where DISTINCTCOUNT is a bottleneck, see DAX011 for alternatives.

---

### DAX015: Move Calculation to Lower Granularity

When an iterator scans a high-cardinality table but the calculation depends on a low-cardinality attribute, iterate over the attribute instead.

**Anti-pattern:**
```dax
-- 100K customers but only 5 distinct DiscountRate values → 100K context transitions
SUMX( 'Customer', CALCULATE(SUM('Sales'[Amount])) * 'Customer'[DiscountRate] )
```

**Preferred:**
```dax
-- 5 iterations instead of 100K
SUMX( VALUES('Customer'[DiscountRate]), CALCULATE(SUM('Sales'[Amount])) * 'Customer'[DiscountRate] )
```

---

### DAX016: Experiment with Relationship Overrides via TREATAS and CROSSFILTER

Relationship direction and filter propagation directly affect SE query plans. Sometimes bidirectional is faster; sometimes explicit filter propagation wins. Use TREATAS and CROSSFILTER to experiment without model changes.

**Example — replace bidirectional bridge with explicit filter:**
```dax
CALCULATE(
    SUM('Sales'[Amount]),
    CROSSFILTER('Customer'[CustomerKey], 'SportBridge'[CustomerKey], NONE),
    TREATAS(VALUES('SportBridge'[CustomerKey]), 'Customer'[CustomerKey])
)
```

---

### DAX017: Apply Boolean Multiplier to Unblock Fusion

**SE signal:** Near-identical SE queries on the same fact table that differ only by a column filter value or by per-measure `VAND` tuple predicates on the same column.

**Fix:** Replace the per-measure filter with `SUMX(KEEPFILTERS(ALL(Column)), expr * boolean)` to move the filter from SE to FE, making SE queries structurally identical across measures.

```dax
-- Anti-pattern: separate SE query per measure
CALCULATE( SUM('Sales'[Amount]), 'Product'[Category] = "Bikes" )
CALCULATE( SUM('Sales'[Amount]), 'Date'[Date] = _dateAnchor )
CALCULATE( MAX('Sales'[DateKey]),  'Sales'[Metric] <> 0 )

-- Fix: boolean multiplier — structurally identical SE queries → engine fuses
SUMX( KEEPFILTERS(ALL('Product'[Category])), CALCULATE(SUM('Sales'[Amount])) * ('Product'[Category] = "Bikes") )
SUMX( KEEPFILTERS(ALL('Date'[Date])),        CALCULATE(SUM('Sales'[Amount])) * ('Date'[Date] = _dateAnchor) )
MAXX( ALL('Date'[Date]),                     CALCULATE(MAX('Sales'[DateKey])) * INT(NOT ISBLANK(CALCULATE(SUM('Sales'[Metric])))) )
```

`KEEPFILTERS` preserves external context; when the column is in the groupby, detail cells iterate only 1 row. Works with all aggregation types.

**BLANK → 0 caveat:** the boolean pattern returns 0 instead of BLANK when no data exists. If `ISBLANK()` checks matter downstream, wrap: `VAR _r = SUMX(...) RETURN IF(_r = 0, BLANK(), _r)`.

---

### DAX018: Replace DIVIDE with Division Operator in Iterators

DIVIDE() includes divide-by-zero protection that forces FE callbacks inside iterators. Use the native `/` operator to keep the expression SE-native. Only use `/` when the denominator is guaranteed non-zero. If zero is possible, pre-filter: `CALCULATETABLE('Items', 'Items'[LocationAdjustment] <> 0)`.

**Anti-pattern:**
```dax
SUMX('Fact', 'Fact'[BaseAmount] * DIVIDE(RELATED('Items'[Discount]), RELATED('Items'[LocationAdjustment])))
```

**Preferred:**
```dax
SUMX('Fact', 'Fact'[BaseAmount] * (RELATED('Items'[Discount]) / RELATED('Items'[LocationAdjustment])))
```

---

### DAX019: Lift Time Intelligence to Outer CALCULATE for Vertical Fusion

TI functions (DATESYTD, DATEADD, etc.) break vertical fusion — each TI-modified measure gets its own SE query. Keep base measures TI-free and apply TI once in an outer wrapper.

> **Custom time intelligence (VAR-based predicates):** When measures use manual date anchoring via `CALCULATE(expr, Column = _var)` instead of built-in TI functions, DAX019 does not apply — see **DAX017** for the boolean multiplier workaround.

**Anti-pattern — each measure applies TI independently (no fusion):**
```dax
MEASURE 'Sales'[Revenue YTD] = CALCULATE ( [Revenue], DATESYTD('Date'[Date]) )
MEASURE 'Sales'[Cost YTD]    = CALCULATE ( [Cost],   DATESYTD('Date'[Date]) )
MEASURE 'Sales'[Margin YTD] =
    [Revenue YTD] - [Cost YTD]
```

**Preferred — base measures fuse, TI applied once:**
```dax
MEASURE 'Sales'[Margin YTD] =
    CALCULATE ( [Revenue] - [Cost], DATESYTD ( 'Date'[Date] ) )
```

---

### DAX020: Unblock Horizontal Fusion by Lifting Filters

Horizontal fusion merges SE queries that differ only by column-slice filter. It breaks when the filtered column is missing from groupby, or when table-valued / runtime-computed filters are applied per measure. Fix: keep only simple column-slice filters inside base measures; lift everything else (TI, dynamic variables) to an outer CALCULATE.

**Anti-pattern — TI inside each slice measure (no fusion):**
```dax
MEASURE 'Sales'[Bikes YTD]       = CALCULATE ( SUM('Sales'[Amount]), 'Product'[Category] = "Bikes",       DATESYTD('Date'[Date]) )
MEASURE 'Sales'[Accessories YTD] = CALCULATE ( SUM('Sales'[Amount]), 'Product'[Category] = "Accessories", DATESYTD('Date'[Date]) )
```

**Preferred — slice measures fuse, TI applied once:**
```dax
MEASURE 'Sales'[Bikes]       = CALCULATE ( SUM('Sales'[Amount]), 'Product'[Category] = "Bikes" )
MEASURE 'Sales'[Accessories] = CALCULATE ( SUM('Sales'[Amount]), 'Product'[Category] = "Accessories" )
MEASURE 'Sales'[Combined YTD] = CALCULATE ( [Bikes] + [Accessories], DATESYTD('Date'[Date]) )
```

Same principle applies to runtime variable filters — move them to the consuming measure. See DAX017 when the filtered column is not in the groupby.

---

### DAX021: Pre-Compute and Join Instead of Filter Round-Trip

When a measure computes a qualifying key set from a filtered aggregation and then uses TREATAS or IN to filter a second aggregation by those keys, the outer SUMMARIZECOLUMNS context compounds the key filter with groupby columns — generating large tuple semi-joins (e.g., 500+ `(Brand, Key)` pairs in a single WHERE clause). The compound-tuple SE scan often dominates total query time.

**SE signal:** `VertiPaqSEQueryEnd` with `DEFINE TABLE ... ININDEX` or `WHERE ... IN` containing hundreds of compound tuples. Single scan duration disproportionately high relative to others.

**Fix:** Pre-compute both aggregations independently at the shared key grain, then join with NATURALINNERJOIN in the FE. The table expression used to build each side — `ADDCOLUMNS(VALUES(...), ...)`, `SUMMARIZECOLUMNS(...)`, etc. — does not matter; the key is that both sides share a common lineage column for the join.

**Anti-pattern — TREATAS pushes key set back to SE, compounded by outer groupby:**
```dax
VAR _FilteredAgg =
    CALCULATETABLE (
        ADDCOLUMNS ( VALUES ( 'Fact'[Key] ), "@Agg1", [Measure] ),
        'Dim'[Filter] = "X"
    )
VAR _Qualifying = FILTER ( _FilteredAgg, [@Agg1] > 1000000 )
VAR _Result =
    CALCULATE (
        [Measure],
        TREATAS ( SELECTCOLUMNS ( _Qualifying, "K", 'Fact'[Key] ), 'Fact'[Key] )
    )
```

**Preferred — both aggregations pre-computed, joined in FE:**
```dax
VAR _FilteredAgg =
    CALCULATETABLE (
        ADDCOLUMNS ( VALUES ( 'Fact'[Key] ), "@Agg1", [Measure] ),
        'Dim'[Filter] = "X"
    )
VAR _Qualifying = FILTER ( _FilteredAgg, [@Agg1] > 1000000 )
VAR _UnfilteredAgg =
    ADDCOLUMNS ( VALUES ( 'Fact'[Key] ), "@Agg2", [Measure] )
VAR _Joined = NATURALINNERJOIN ( _Qualifying, _UnfilteredAgg )
VAR _Result = SUMX ( _Joined, [@Agg2] )
```

> **Why it works:** Each pre-computed table generates independent SE scans — clean, no tuple filters. NATURALINNERJOIN matches on the shared `'Fact'[Key]` lineage column in the FE, replacing the expensive compound-tuple SE round-trip with a fast in-memory join over small pre-materialized tables.

---

## Section 4: Tier 2 Query Structure Patterns

> **STOP — Requires user approval before applying any change. Explain the impact on query output and wait for explicit confirmation.**

> **Scope: Desktop-Achievable Changes Only**
> 
> Every Tier 2 recommendation must map to an action the report author can perform in Power BI Desktop's UI. The agent optimizes the *generated* DAX query, but the user implements changes through the Desktop interface — not by editing DAX directly in the query pane. Examples of valid changes:
> - **Changing the axis/groupby field** (e.g., swap `Calendar Date` for `Calendar Month` on a visual axis)
> - **Removing or adding visual-level filters** (e.g., drop an unneeded slicer selection)
> - **Changing filter values** (e.g., narrow a date range filter)
> - **Removing measure value filters** (e.g., remove a "Top N" or "> threshold" filter from a visual)
> - **Changing aggregation type** on a column (e.g., Sum → Average)

### QRY001: Remove Unneeded Filters

Every filter adds a `WHERE` clause in xmSQL and may force an extra SE join. Users often apply global slicer or visual-level filters that don't actually affect the calculation being optimized.

**Detection:** `WHERE` clauses on columns not used in the measure logic, or filter variables that restrict to a single value (e.g., `Currency[Code] = "USD"` in a USD-only model).

**Fix:** Experiment — remove filters one at a time and re-run. If the result doesn't change, the filter might be unnecessary. Global filters that are needed across all visuals should be pushed to the data source (model-level change — see [Section 5](./model-optimization.md#section-5-tier-3-model-optimization-patterns)).

```dax
-- Before: filter on Currency adds an SE join for no benefit
SUMMARIZECOLUMNS (
    'Product'[Category],
    KEEPFILTERS ( TREATAS ( {"USD"}, 'Currency'[Code] ) ),
    "Revenue", [Total Revenue]
)

-- After: filter removed, same result, one fewer SE join
SUMMARIZECOLUMNS ( 'Product'[Category], "Revenue", [Total Revenue] )
```

---

### QRY002: Eliminate Report Measure Filters (__ValueFilterDM)

When a visual filters on a measure value (e.g., "Revenue > 1M"), Power BI generates a `__ValueFilterDM` variable that evaluates the measure twice — once for the filter check, once for display. Roughly doubles execution time.

**Detection:** `__ValueFilterDM` in the generated query.

**Fix:** Move the threshold into the measure itself — return BLANK below the cutoff. SUMMARIZECOLUMNS auto-drops blank rows, achieving the same visual result in one pass:
```dax
MEASURE 'Sales'[Total Revenue Filtered] =
    VAR __Rev = [Total Revenue]
    RETURN IF ( __Rev > 1000000, __Rev )
```

---

### QRY003: Reduce Query Grain

Grouping by a high-cardinality column (e.g., `Calendar[Date]` → 365 rows) when the user only needs monthly data (12 rows) inflates SE row count ~30×.

**Detection:** Groupby on a date or high-cardinality column producing far more rows than the visual needs.

**Option A — coarser groupby:**
```dax
-- Daily → monthly
SUMMARIZECOLUMNS ( 'Calendar'[YearMonth], "Revenue", [Total Revenue] )
```

**Option B — period-end axis + measure pin** (show period-end snapshot instead of full-period aggregate):

Requires a period-end column in the date table (e.g., `Calendar[MonthEndDate]`). User changes the visual axis to it, then pins the measure to that date:
```dax
-- User changes axis from Calendar[Date] to Calendar[MonthEndDate]
-- Measure pins CALCULATE to the period-end date to return that day's value only
MEASURE 'Sales'[Active Customers] =
    CALCULATE (
        DISTINCTCOUNT ( 'Sales'[CustomerID] ),
        'Calendar'[Date] = MAX ( 'Calendar'[MonthEndDate] )
    )
```
> Without the pin, grouping by `MonthEndDate` aggregates all days in the month instead of returning the single-day value.

**Option C — return BLANK for non-boundary dates** (keeps all dates in groupby but only computes on end-of-month):
```dax
MEASURE 'Sales'[Revenue EOM] =
    IF ( MAX('Calendar'[Date]) = EOMONTH(MAX('Calendar'[Date]), 0), [Total Revenue] )
```

**Option D — daily additive measure approximated at coarser grain** (divide monthly total by days in month):
```dax
MEASURE 'Sales'[Daily Avg Revenue] =
    DIVIDE (
        [Total Revenue],
        DAY ( EOMONTH ( MAX('Calendar'[Date]), 0 ) )
    )
```

---

### QRY004: Remove BLANK Suppression (Changes Result Shape)

`+ 0`, `IF(ISBLANK([M]), 0, [M])`, or `COALESCE(..., 0)` force SUMMARIZECOLUMNS to evaluate every groupby combination — including rows with no data — inflating the result set.

**Detection:** `+ 0`, `IF(ISBLANK(...))`, or `COALESCE(..., 0)` appended to measures.

**Anti-pattern:**
```dax
MEASURE 'Sales'[Revenue] = SUM ( 'Sales'[SalesAmount] ) + 0
```

**Preferred:**
```dax
MEASURE 'Sales'[Revenue] = SUM ( 'Sales'[SalesAmount] )
```

**If zeros are required selectively**, conditionally add 0 where it makes sense:
```dax
MEASURE 'Sales'[Revenue] =
    VAR _ForceZero = NOT ISEMPTY ( 'Sales' )
    RETURN [Sales Amount] + IF ( _ForceZero, 0 )
```
