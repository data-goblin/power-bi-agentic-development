# Power Query Best Practices for Semantic Models

Practical guidance for writing performant, maintainable M expressions in semantic model partitions.

## Safe Pattern for Writing M

When writing or generating M expressions for import partitions, follow this order to maximize query folding:

```
let
    Source = Sql.Database(SqlEndpoint, Database),
    Data = Source{[Schema="dbo", Item="MyTable"]}[Data],
    -- 1. Filter rows (folds to WHERE)
    Filtered = Table.SelectRows(Data, each [IsActive] = true),
    -- 2. Select columns (folds to SELECT)
    Selected = Table.SelectColumns(Filtered, {"Id", "Date", "Amount"}),
    -- 3. Set types (folds to CAST)
    Typed = Table.TransformColumnTypes(Selected, {{"Amount", Currency.Type}}),
    -- 4. Sort if needed (folds to ORDER BY)
    Sorted = Table.Sort(Typed, {{"Date", Order.Descending}}),
    -- 5. Non-foldable transforms LAST
    Added = Table.AddColumn(Sorted, "Category", each if [Amount] > 1000 then "High" else "Low")
in
    Added
```

If the transform logic is too complex for M, use `Value.NativeQuery` to pass native SQL directly:

```
let
    Source = Sql.Database(SqlEndpoint, Database),
    Data = Value.NativeQuery(Source,
        "SELECT Id, Date, Amount FROM dbo.MyTable WHERE IsActive = 1",
        null, [EnableFolding=true])
in
    Data
```

`EnableFolding=true` allows subsequent M steps to fold on top of the native query result.

## Query Folding

Query folding translates M steps into native data source queries (SQL, OData, etc.). When folding works, the data source does the heavy lifting. When it breaks, the mashup engine pulls all data into memory and processes it locally.

### Why It Matters

- A folded query against a 10M row table sends `SELECT TOP 1000 ... WHERE ...` to SQL Server; fast
- A non-folded query pulls all 10M rows into the mashup engine, then filters locally; slow and memory-heavy
- For large tables, broken folding often causes refresh timeouts or out-of-memory errors

### Steps That Fold (SQL Sources)

| M Function | SQL Equivalent |
|------------|---------------|
| `Table.SelectColumns` | `SELECT col1, col2` |
| `Table.RemoveColumns` | `SELECT` (excluding columns) |
| `Table.SelectRows` | `WHERE` |
| `Table.Sort` | `ORDER BY` |
| `Table.FirstN` | `TOP N` |
| `Table.Group` | `GROUP BY` |
| `Table.TransformColumnTypes` | `CAST` |
| `Table.RenameColumns` | `AS` alias |
| `Table.ExpandTableColumn` | `JOIN` |
| `Table.NestedJoin` | `JOIN` |
| `Table.Distinct` | `DISTINCT` |
| `Table.Skip` | `OFFSET` |

### Operations That Break Folding

Once folding breaks, all subsequent steps also run locally. This list applies primarily to SQL Server via `Sql.Database`; other sources may differ.

**Table construction / materialization:**
- `Table.Buffer` -- forces full data load to memory
- `List.Buffer` -- forces full list load to memory
- `Table.StopFolding` -- explicitly stops folding
- `#table` constructor, `Table.FromList`, `Table.FromRecords`, `Table.FromRows`, `Table.FromValue`, `Table.FromColumns` -- creates table locally

**Row position / index operations:**
- `Table.AddIndexColumn` -- no SQL row index equivalent
- `Table.LastN` / `Table.RemoveLastN` -- no SQL BOTTOM N
- `Table.Range` (mid-range), `Table.Repeat`, `Table.AlternateRows` -- no SQL equivalent
- `Table.InsertRows`, `Table.RemoveRows` (by position) -- positional, not predicate-based
- `Table.ReverseRows` -- no SQL row-reverse
- `Table.FindText` -- full-text search not translatable

**Text functions (inside `Table.TransformColumns` or `Table.AddColumn`):**
- `Text.Proper` / "Capitalize Each Word"
- `Text.Combine` (multi-column merge), `Text.Insert`, `Text.Remove`, `Text.RemoveRange`
- `Text.Select`, `Text.Split`, `Text.SplitAny`
- `Text.BeforeDelimiter`, `Text.AfterDelimiter`, `Text.BetweenDelimiters`
- `Text.PadStart`, `Text.PadEnd`, `Text.Reverse`, `Text.Format`
- `Text.ToList`, `Text.Clean`
- `Text.From` with format/culture arguments

**Column splitting / combining:**
- `Table.SplitColumn`, `Table.CombineColumns`, all `Splitter.*` functions

**Pivot / transpose / structure:**
- `Table.Transpose`, `Table.DemoteHeaders`, `Table.PromoteHeaders`

**Fill / imputation:**
- `Table.FillDown`, `Table.FillUp` -- requires stateful row scanning

**Error handling:**
- `Table.RemoveRowsWithErrors`, `Table.SelectRowsWithErrors`
- `try...otherwise` in row context

**Schema / metadata:**
- `Table.Schema`, `Table.ColumnNames`, `Value.Type`, `Type.Is`

**Custom functions / iteration:**
- User-defined `(x) => ...` lambdas in row context
- `Table.TransformRows` -- arbitrary M function per row
- `List.Generate`, `List.Accumulate` -- iterative; no SQL equivalent
- `List.Transform` with complex logic

**Record / list / structured columns:**
- `Table.ExpandListColumn`, `Table.ExpandRecordColumn` (except after same-source NestedJoin)
- `Record.*` functions, `Table.ToRecords`, `Table.ToRows`, `Table.ToList`, `Table.Column`

**Date/time in row context:**
- `Date.ToText` / `DateTime.ToText` / `Duration.ToText` with format strings
- `Date.IsInCurrentMonth`, `Date.IsInCurrentWeek` and similar relative date filters
- `Date.DayOfWeekName`, `Date.MonthName` -- locale-dependent

**Miscellaneous:**
- `Table.Profile` -- statistical summary; local only
- `Table.Max`, `Table.Min` (returning row) -- returns record not table
- `Table.Contains`, `Table.ContainsAll`, `Table.ContainsAny`, `Table.IsDistinct` -- returns boolean

### Operations That Sometimes Fold

These fold under certain conditions:

- `Table.AddColumn` -- folds if expression uses only SQL-translatable functions (arithmetic, `Text.Upper`); breaks with complex M logic
- `Table.TransformColumns` -- folds for `Text.Upper`, `Text.Lower`, `Text.Trim`, `Number.Round`; breaks for `Text.Proper`, complex lambdas
- `Table.TransformColumnTypes` -- folds for compatible casts (int to decimal); breaks for locale-specific or M-only types
- `Table.ReplaceValue` -- folds with simple literal replacement; breaks with patterns
- `Table.Pivot` / `Table.Unpivot` -- folds on SQL Server (PIVOT/UNPIVOT support); breaks on other sources
- `Table.NestedJoin` -- folds when both sources are the same SQL connection; breaks across different sources
- `Table.Combine` / append -- folds as UNION ALL when all inputs are same SQL source
- `Table.SelectRows` with `Text.Contains` -- folds as `LIKE '%value%'` on SQL Server
- `Table.Group` -- folds with standard aggregations (`List.Sum`, `List.Count`, `List.Average`); breaks with custom functions
- `Value.NativeQuery` -- subsequent steps fold only if `EnableFolding=true` is set
- `Text.Start` / `Text.End` -- often fold as `LEFT()` / `RIGHT()`; `Text.Middle` often does not
- `Date.Year`, `Date.Month`, `Date.Day` -- fold as `YEAR()`, `MONTH()`, `DAY()`
- `Date.AddDays` / `Date.AddMonths` -- fold as `DATEADD()`

### Environmental Fold-Breakers

Not functions, but conditions that prevent folding:

- Merging/appending queries from different data sources
- Incompatible data privacy levels between sources (Data Privacy Firewall intervenes)
- Source is a flat file (CSV, Excel, JSON, XML) -- no query engine
- Source is `Web.Contents` / API -- no SQL engine
- Custom SQL without `EnableFolding=true`
- Any step after a fold-breaking step (chain is broken; cannot re-fold)

### Folding Strategy

**Rule:** Do all foldable work first, then do non-foldable work.

```
let
    Source = Sql.Database(SqlEndpoint, Database),
    Data = Source{[Schema="dbo", Item="Orders"]}[Data],

    -- FOLDABLE: These translate to SQL
    #"Filtered Rows" = Table.SelectRows(Data, each [Year] >= 2023),
    #"Selected Columns" = Table.SelectColumns(#"Filtered Rows",
        {"OrderId", "Date", "Amount", "CustomerId", "Status"}),
    #"Set Types" = Table.TransformColumnTypes(#"Selected Columns", {
        {"Amount", Currency.Type}, {"Date", type date}}),

    -- NON-FOLDABLE: These run in the mashup engine
    #"Added Category" = Table.AddColumn(#"Set Types", "AmountBucket",
        each if [Amount] > 10000 then "Large" else "Small", type text)
in
    #"Added Category"
```

### Verifying Folding

In Power Query Online or Desktop, right-click a step and check "View Native Query". If greyed out, the step doesn't fold.

Programmatically: execute the expression via the `executeQuery` API. If a query on a large table completes well within the timeout, folding is likely working. If it times out or is slow, folding may be broken.

## Column Pruning

Remove columns as early as possible. Every column not removed travels through every subsequent step.

```
-- Good: remove columns immediately after navigation
Data = Source{[Schema="dbo", Item="Orders"]}[Data],
#"Selected" = Table.SelectColumns(Data, {"OrderId", "Date", "Amount"}),
...

-- Bad: remove columns at the end after all transforms
...
#"Final" = Table.RemoveColumns(#"Transformed", {"Col1", "Col2", "Col3", ...})
```

Early column pruning folds to SQL `SELECT`, reducing data transfer from the source.

## Row Filtering

Filter rows early for the same reason. A `Table.SelectRows` immediately after navigation folds to `WHERE`:

```
Data = Source{[Schema="dbo", Item="Orders"]}[Data],
#"Filtered" = Table.SelectRows(Data, each [IsActive] = true and [Year] >= 2023),
```

This is especially important for incremental refresh, where `RangeStart`/`RangeEnd` filters must fold to be effective.

## Type Handling

### Apply Types Early

`Table.TransformColumnTypes` folds to `CAST` in SQL. Apply it right after column selection:

```
#"Selected" = Table.SelectColumns(Data, {"OrderId", "Date", "Amount"}),
#"Typed" = Table.TransformColumnTypes(#"Selected", {
    {"OrderId", Int64.Type},
    {"Date", type date},
    {"Amount", Currency.Type}
}),
```

### Avoid Implicit Type Detection

Never use `Table.TransformColumnTypes` with `Replacer.ReplaceValue` or locale-dependent conversions on large datasets. These don't fold and can introduce unexpected nulls.

### Common Type Mappings

| M Type | Use for |
|--------|---------|
| `Int64.Type` | Integer keys, counts |
| `type text` | Strings |
| `type date` | Date-only columns |
| `type datetime` | DateTime columns |
| `type datetimezone` | DateTime with timezone |
| `Currency.Type` | Financial amounts (fixed decimal) |
| `type logical` | Boolean flags |
| `Percentage.Type` | Rates, percentages |

## Anti-Patterns

### Pulling Entire Tables Then Filtering

```
-- Anti-pattern: filter after all transforms
Data = Source{[Schema="dbo", Item="BigTable"]}[Data],
#"Added Column" = Table.AddColumn(Data, ...),  -- breaks folding
#"Filtered" = Table.SelectRows(#"Added Column", each [Year] >= 2023)
-- Filter runs locally on ALL rows
```

### Using Table.Buffer Unnecessarily

`Table.Buffer` forces the entire table into memory. Only use when the same table is referenced multiple times and re-evaluation would be expensive.

### Referencing Other Queries

Cross-query references (accessing a column from a different query) break folding and can cause cascading performance issues.

### Excessive Step Count

Each step adds overhead. Combine related operations where natural; don't create a separate step for each individual column rename when `Table.RenameColumns` handles multiples:

```
-- Good: one step for all renames
#"Renamed" = Table.RenameColumns(Data, {
    {"OldName1", "NewName1"},
    {"OldName2", "NewName2"}
})

-- Bad: separate step per rename
#"Renamed1" = Table.RenameColumns(Data, {{"OldName1", "NewName1"}}),
#"Renamed2" = Table.RenameColumns(#"Renamed1", {{"OldName2", "NewName2"}})
```

## Naming Conventions

- Use descriptive step names: `#"Filtered Active Orders"` not `#"Custom1"`
- Use `#"Quoted Identifiers"` for steps with spaces (standard Power Query convention)
- Parameters: `PascalCase` without spaces (`SqlEndpoint`, `DatabaseName`)
- Keep step names consistent with what the Power Query UI would generate

## Error Handling

For production partitions, avoid `try...otherwise` patterns that silently swallow errors. A failed refresh is better than silently loading wrong data.

If error handling is necessary (e.g., optional columns), make it explicit and narrow:

```
#"Safe Amount" = Table.TransformColumns(Data, {
    {"Amount", each try Number.FromText(_) otherwise null, type number}
})
```
