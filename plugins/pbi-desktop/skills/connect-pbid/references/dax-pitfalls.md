# DAX Pitfalls: Deprecated, Not Recommended, and Non-Existent Functions

Reference for avoiding common DAX mistakes; particularly those that AI agents generate from training data in other languages (SQL, Python, Excel, M).


## Functions Marked "Not Recommended" on dax.guide

These exist and execute without error but should be replaced with modern alternatives.

| Function | Status | Alternative | Why |
|---|---|---|---|
| `EARLIER(col)` | Not recommended | `VAR` | Confusing row context semantics. Capture the value in a variable before entering a nested row context |
| `EARLIEST(col)` | Not recommended | `VAR` | Same as EARLIER but retrieves from the outermost row context. Even more confusing |
| `SUMMARIZE` Name/Expression params | Deprecated | `SUMMARIZECOLUMNS` or `ADDCOLUMNS(SUMMARIZE(...))` | Extension columns in SUMMARIZE use clustering semantics that differ from what most users expect. Use SUMMARIZE only for grouping (no added columns) |


## Functions That Do Not Exist in DAX

Agents frequently hallucinate these from SQL, Python, Excel VBA, or M training data. They will cause immediate syntax errors.

| Hallucinated Function | Language Source | DAX Equivalent |
|---|---|---|
| `TRY ... CATCH` | Python, C#, JavaScript | `IFERROR(expr, fallback)` |
| `TRY ... OTHERWISE` | Power Query M | `IFERROR(expr, fallback)` |
| `ISNULL(expr)` | SQL Server | `ISBLANK(expr)` ; DAX has no null concept, only BLANK |
| `IIF(cond, true, false)` | SQL Server, VBA | `IF(cond, true, false)` |
| `NZ(expr, default)` | Access VBA | `IF(ISBLANK(expr), default, expr)` or `COALESCE(expr, default)` |
| `COALESCE(a, b, ...)` | SQL | `COALESCE(a, b, ...)` actually exists in DAX (added ~2020). But agents sometimes use SQL-style `ISNULL` or `IFNULL` instead |
| `IFNULL(expr, default)` | MySQL, SQLite | `COALESCE(expr, default)` or `IF(ISBLANK(expr), default, expr)` |
| `NVL(expr, default)` | Oracle | `COALESCE(expr, default)` |
| `CAST(expr AS type)` | SQL | `CONVERT(expr, type)` or implicit conversion |
| `SUBSTRING(text, start, len)` | SQL | `MID(text, start, len)` |
| `CONCAT(a, b)` | SQL | `a & b` (ampersand operator) or `CONCATENATE(a, b)` |
| `LEN(text)` | Excel, SQL | `LEN(text)` actually exists in DAX |
| `TRIM(text)` | Excel, SQL | `TRIM(text)` actually exists in DAX |
| `GETDATE()` | SQL Server | `TODAY()` or `NOW()` |
| `CURDATE()` | MySQL | `TODAY()` |
| `DATEDIFF(start, end, unit)` | SQL | `DATEDIFF(date1, date2, interval)` exists but parameter order and interval names differ from SQL |
| `GROUP BY` | SQL | Not a function; DAX has no GROUP BY clause. Use `SUMMARIZECOLUMNS` or `GROUPBY` |
| `HAVING` | SQL | Not a function; use `FILTER` on a summarized table |
| `JOIN` / `LEFT JOIN` | SQL | Not a function; DAX uses relationships + `RELATED`/`RELATEDTABLE`, or `NATURALINNERJOIN`/`NATURALLEFTOUTERJOIN` |
| `PIVOT` / `UNPIVOT` | SQL | Not functions; do reshaping in Power Query (M), not DAX |
| `COLLECT` / `REDUCE` | Python, JavaScript | Not functions; use iterators like `SUMX`, `MAXX`, `CONCATENATEX` |
| `MAP` / `APPLY` | Python, R | Not functions; use `ADDCOLUMNS` or iterator functions |
| `LAMBDA` | Excel, Python | Not a function; use `VAR` for intermediate expressions |
| `STRING(expr)` | Various | `FORMAT(expr, format_string)` or `CONVERT(expr, STRING)` |
| `TOSTRING(expr)` | JavaScript | `FORMAT(expr, format_string)` or `CONVERT(expr, STRING)` |
| `TOINT(expr)` / `TOFLOAT(expr)` | Python | `INT(expr)` or `CONVERT(expr, INTEGER)` / `CONVERT(expr, DOUBLE)` |
| `POWER(base, exp)` | Excel | `POWER(base, exp)` actually exists in DAX |
| `ROUND(num, digits)` | Various | `ROUND(num, digits)` actually exists in DAX |
| `ARRAY(...)` | Various | Not a function; use table constructors `{(val1, val2), ...}` |
| `PRINT` / `CONSOLE.LOG` | Various | Not functions; DAX has no output/debug statements |


## Common DAX Syntax Mistakes from Other Languages

| Mistake | Correct DAX |
|---|---|
| `-- comment` | `// comment` (double dash is not a comment in DAX) |
| `= 'text'` (single-quoted string) | `= "text"` (double-quoted; single quotes are for table names) |
| `table.column` (dot notation) | `'Table'[Column]` (bracket notation with single-quoted table) |
| `[Column]` without table (in measures) | `'Table'[Column]` (always fully qualify column references) |
| `variable = value` (assignment) | `VAR variable = value RETURN ...` (VAR/RETURN pattern required) |
| `SELECT ... FROM` | `EVALUATE ...` (DAX queries use EVALUATE, not SELECT; SELECT is for DMV only) |
| `WHERE condition` | `CALCULATETABLE(table, condition)` or `FILTER(table, condition)` |
| `ORDER BY col ASC` outside EVALUATE | `ORDER BY` must follow an `EVALUATE` expression in a DAX query |
| `!=` (not equal) | `<>` (DAX uses diamond operator for not-equal) |
| `&&` / `||` (logical) | `&&` and `||` actually work in DAX, but `AND()`/`OR()` are also valid |
| `true` / `false` (lowercase) | `TRUE()` / `FALSE()` (function syntax with parens) |
| `null` | `BLANK()` (DAX has no null literal) |


## Common Correctness Traps

Patterns that execute without error but produce wrong results. These account for the majority of DAX debugging questions on community forums.

| Trap | What happens | Fix |
|---|---|---|
| `CALCULATE(expr, ALL('Table'))` | Removes ALL filters including SUMMARIZECOLUMNS grouping; every row shows the same value | Use `ALL('Table'[Column])` or `REMOVEFILTERS('Table'[Column])` to target specific columns |
| `CALCULATE(expr, 'T'[Col] = "X")` | **Replaces** existing filter on that column (doesn't AND) | Use `KEEPFILTERS('T'[Col] = "X")` to intersect with existing filters |
| `VAR _x = SUM(...) RETURN CALCULATE(_x, filter)` | VAR is evaluated once at definition; CALCULATE cannot re-evaluate it | Move the aggregation inside CALCULATE: `CALCULATE(SUM(...), filter)` |
| `SUM(A) / SUM(B)` in grand total | Divides global sums, not sum of row-level ratios; total appears "wrong" | This is mathematically correct (weighted average); if sum-of-ratios is needed, use `SUMX(VALUES(Dim[Key]), [Ratio])` |
| `DATEADD(scalar_date, -1, MONTH)` | DATEADD requires a date **table**, not a scalar value | Use `DATEADD('Date'[Date], -1, MONTH)` with a date column reference |
| `CALCULATE(expr, FILTER('Sales', condition))` | Filters the **expanded table** (includes related tables via relationships), not just Sales. Causes both incorrect results (intersection with related tables) and severe performance degradation (117x slower in SQLBI benchmarks) | Use column predicates: `CALCULATE(expr, 'Sales'[Col] = "X")`. For complex conditions use `KEEPFILTERS(condition)`. Only use FILTER on a table when the condition spans multiple columns that can't be expressed as separate filter arguments |
| `ALLSELECTED()` with no arguments | Removes all grouping filters from SUMMARIZECOLUMNS; not just slicer filters | Always specify the table or column: `ALLSELECTED('Date')` |
| Deeply nested IF / repeated measure in IF branches | Each IF branch may be evaluated independently; referencing the same measure in both branches causes double evaluation | Store the measure in a VAR before the IF; use SWITCH(TRUE(), ...) for multi-condition logic. Place VARs **inside** conditional branches if they're only used there (preserves short-circuit optimization) |
| Implicit measures (auto-sum) | Numeric columns auto-aggregate in visuals; bypasses explicit measure logic | Disable via model property or set `SummarizeBy = None` on columns that shouldn't auto-aggregate |


## CALCULATE Modifiers Reference

Functions used as filter arguments inside CALCULATE / CALCULATETABLE. They modify the filter context rather than returning values. Misusing them produces the most common visual symptoms reported on community forums.

### Filter Removal

| Modifier | What it removes | Visual symptom if misused |
|---|---|---|
| `ALL('Table')` | All filters on the table, **including** the visual's grouping columns | Every row in the matrix/table shows the **same value** (the ungrouped total). The #1 reported DAX bug on community forums |
| `ALL('Table'[Col])` | Filters on that one column only; preserves grouping and other column filters | Correct per-row values but **grand total ignores one dimension** (e.g. region total that ignores region) |
| `ALL('T'[C1], 'T'[C2])` | Filters on specific columns only | Same as above but for multiple columns |
| `ALLEXCEPT('Table', 'T'[KeepCol])` | All filters except the named columns | Rows look correct but subtotals may differ from expected; confusing when the "kept" column isn't the one in the visual |
| `ALLSELECTED('Table')` | Grouping filters from SUMMARIZECOLUMNS; preserves slicer/page filters | If table is omitted (`ALLSELECTED()` with no args): same-value-every-row because ALL grouping is removed, not just the intended dimension |
| `REMOVEFILTERS('Table')` | Same as `ALL('Table')` | Same same-value symptom. Prefer REMOVEFILTERS over ALL for clarity; signals intent to remove filters rather than to materialize all rows |
| `REMOVEFILTERS('T'[Col])` | Same as `ALL('T'[Col])` | Same column-level removal |

**Common mistake:** Using `ALL('Sales')` as a denominator for % of total when the visual groups by `'Sales'[Region]`. The ALL removes the Region grouping, so the denominator is correct (grand total) but if accidentally applied to the numerator too, every row shows the grand total. Fix: use `ALL('Sales'[Region])` or `ALLSELECTED('Sales'[Region])`.

### Filter Intersection

| Modifier | What it does | Visual symptom if missing |
|---|---|---|
| `KEEPFILTERS('T'[Col] = "X")` | Intersects the new filter with existing filters on that column | Without KEEPFILTERS: the filter **replaces** existing filters. If the visual already filters to Region = "East" and the measure does `CALCULATE(expr, 'T'[Region] = "West")`, it overrides "East" with "West" instead of returning BLANK (no intersection). The user sees "West" values appearing in "East" rows |
| `KEEPFILTERS(table_expr)` | Same intersection behavior for table expressions | Same override problem with table-level filters |

**Common mistake:** Building a "Red Sales" measure as `CALCULATE([Sales], 'Product'[Color] = "Red")`. When the visual has a slicer on Color = "Blue", the measure **still shows Red** because the filter replaces the slicer. With `KEEPFILTERS('Product'[Color] = "Red")`, it correctly returns BLANK when Blue is selected (intersection of Red and Blue is empty).

### Relationship Modifiers

| Modifier | What it does | Visual symptom if wrong |
|---|---|---|
| `USERELATIONSHIP('Fact'[ShipDate], 'Date'[Date])` | Activates an inactive relationship for this calculation | Without it: measure uses the active relationship (e.g. order date) when the user expects ship date. Values look plausible but are offset by the order-to-ship lag |
| `CROSSFILTER('T1'[Col], 'T2'[Col], Both)` | Changes cross-filter direction to bidirectional for this calculation | Without it: dimension slicer doesn't filter the fact table (appears to "do nothing"). Common with bridge tables in many-to-many patterns |

**USERELATIONSHIP limitation:** Cannot be used when the target table has Row-level security (RLS). Use TREATAS as a workaround.

### Virtual Relationships

| Function | What it does | When to use |
|---|---|---|
| `TREATAS(table_expr, 'T'[Col])` | Applies values from a table expression as a filter on the target column, as if a relationship existed | When tables are unrelated or USERELATIONSHIP is blocked by RLS. Also useful for disconnected slicer tables (parameter tables that drive measure behavior without a physical relationship) |

**Common symptom without TREATAS:** A slicer on a disconnected table "doesn't filter anything." TREATAS bridges the gap by projecting the slicer's values onto the target column.

### Key Rules

- Filter arguments in CALCULATE are evaluated in the **original** context before being applied
- Multiple filter arguments AND together (each narrows independently)
- `ALL` / `REMOVEFILTERS` execute before explicit filter arguments in CALCULATE's evaluation order
- Without KEEPFILTERS, a filter argument on column X **replaces** any existing filter on column X
- USERELATIONSHIP and CROSSFILTER override model-level relationship settings for the calculation only
- Innermost CALCULATE wins when nested expressions contain conflicting modifiers


## BLANK vs NULL

DAX has no concept of NULL. The equivalent is BLANK, which behaves differently from SQL NULL:

- `BLANK() + 1` returns `1` (not BLANK); SQL NULL + 1 returns NULL
- `BLANK() & "text"` returns `"text"`; SQL NULL || 'text' returns NULL
- `IF(BLANK(), "yes", "no")` returns `"no"` (BLANK is falsy)
- `BLANK() = BLANK()` returns `TRUE`; SQL NULL = NULL returns NULL (unknown)

Use `ISBLANK()` to test, not `ISNULL()` (which does not exist).
