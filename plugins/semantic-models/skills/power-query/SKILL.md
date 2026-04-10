---
name: power-query
version: 0.22.3
description: Author, validate, and test Power Query M expressions in semantic model partitions. Automatically invoke when the user mentions "Power Query", "M code", "M expression", "partition expression", "query folding", or asks to "write Power Query", "fix Power Query", "test a partition", "preview partition data", "debug Power Query step", "optimize Power Query".
---

# Power Query for Semantic Models

Author, validate, and test Power Query M expressions in semantic model import partitions. Covers writing correct M code, preserving query folding, validating expressions, and testing them by executing against real data sources.

## Partition Expressions

Each import table in a semantic model has a partition with an M expression defining what data gets loaded during refresh. The expression typically connects to a data source, navigates to a table/view, and applies transformations.

### Structure of a Partition Expression

```
let
    Source = Sql.Database(#"SqlEndpoint", #"Database"),
    Data = Source{[Schema="dbo", Item="Orders"]}[Data],
    #"Removed Columns" = Table.RemoveColumns(Data, {"InternalId"}),
    #"Changed Type" = Table.TransformColumnTypes(#"Removed Columns", {{"Amount", Currency.Type}})
in
    #"Changed Type"
```

Key elements:
- **Parameters**: `#"SqlEndpoint"`, `#"Database"` are shared M parameters defined at the model level
- **Navigation**: `Source{[Schema="dbo", Item="Orders"]}[Data]` navigates to a specific table
- **Steps**: Each step is a named variable in the `let...in` chain
- **Quoted identifiers**: Step names with spaces use `#"Step Name"` syntax

### Extracting Expressions

```bash
# Get partition expression from TMDL via fab
fab get "<Workspace>.Workspace/<Model>.SemanticModel" -f \
  -q "definition.parts[?path=='definition/tables/<Table>.tmdl'].payload"

# Get shared M parameters
fab get "<Workspace>.Workspace/<Model>.SemanticModel" -f \
  -q "definition.parts[?path=='definition/expressions.tmdl'].payload"
```

## Writing M Expressions

### Query Folding

Query folding is the most important performance concept. The M engine translates compatible steps into native data source queries (e.g., SQL). When folding breaks, subsequent steps run in the mashup engine, pulling all data into memory first.

**Steps that typically fold** (for SQL sources):
- `Table.SelectColumns` / `Table.RemoveColumns` -> `SELECT`
- `Table.SelectRows` -> `WHERE`
- `Table.Sort` -> `ORDER BY`
- `Table.FirstN` -> `TOP`
- `Table.Group` -> `GROUP BY`
- `Table.RenameColumns` -> `AS` aliases

**Steps that may or may not fold** (source-dependent):
- `Table.TransformColumnTypes` -- frequently breaks folding for text-to-numeric/date conversions on SQL Server sources. Use `Table.TransformColumns` with explicit conversion functions (e.g., `Number.From`) as a more reliable foldable alternative.

**Steps that break folding:**
- `Table.AddColumn` with custom M functions (not translatable to SQL)
- `Table.Buffer` (forces materialization; prefer `Table.StopFolding` to stop folding without the memory overhead)
- `Table.LastN` (no SQL equivalent without subquery)
- `Table.Combine` across different data sources (cross-database folding within the same SQL Server is possible via `EnableCrossDatabaseFolding`)
- Complex `each` expressions with M-specific logic
- Any step after a fold-breaking step

**Best practice:** Apply folding-compatible steps (filter, select, type) early; add custom columns and M-only transforms after all foldable work is done.

### Column Pruning and Row Filtering

Remove unused columns and filter rows as early as possible:

```
let
    Source = Sql.Database(SqlEndpoint, Database),
    Data = Source{[Schema="dbo", Item="Orders"]}[Data],
    // Filter and select BEFORE any custom transforms
    #"Filtered" = Table.SelectRows(Data, each [Status] <> "Cancelled"),
    #"Selected" = Table.SelectColumns(#"Filtered", {"OrderId", "Date", "Amount", "CustomerId"})
in
    #"Selected"
```

These steps fold to SQL: `SELECT OrderId, Date, Amount, CustomerId FROM dbo.Orders WHERE Status <> 'Cancelled'`

### Type Handling

- Apply `Table.TransformColumnTypes` early (folds to `CAST` in SQL)
- Use explicit M types: `Int64.Type`, `type text`, `type date`, `Currency.Type`, `type logical`
- Avoid implicit type inference on large datasets

### Naming Conventions

- Step names should describe the transformation: `#"Removed Duplicates"`, `#"Filtered Active"`
- Avoid generic names like `#"Custom1"` or `#"Step1"`
- Use quoted identifiers `#"Name"` for steps with spaces (Power Query convention)

## Validating M Expressions

Two approaches to validate that an M expression is syntactically correct and produces expected results:

### 1. Execute via the Power Query API (Recommended)

Test the expression by running it against real data. This validates syntax, data source connectivity, and transformation correctness in one step.

The `executing-power-query` skill in the `etl` plugin provides the full workflow. In summary:

1. Create or reuse a runner dataflow in the workspace
2. Bind the data source connection to the runner
3. Wrap the expression in a section document, inline parameters
4. Execute via `POST /v1/workspaces/{wsId}/dataflows/{dfId}/executeQuery`
5. Parse the Arrow response to verify data

```bash
MASHUP='section Section1;
shared SqlEndpoint = "myserver.database.windows.net";
shared Database = "MyDB";
shared Result = let
    Source = Sql.Database(SqlEndpoint, Database),
    Data = Table.FirstN(Source{[Schema="dbo",Item="Orders"]}[Data], 10)
in Data;'

curl -s -o result.bin -X POST ".../executeQuery" \
  -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
  -d "$(jq -n --arg m "$MASHUP" '{queryName:"Result",customMashupDocument:$m}')"
```

See **`references/validation.md`** for step-by-step instructions and error handling.

### 2. Save the Partition via XMLA / TOM

Write the expression back to the model; Analysis Services validates the M syntax on save. This doesn't execute the query but catches structural errors:

- Missing or mismatched `let`/`in`
- Undefined step references
- Invalid function calls
- Type mismatches in `TransformColumnTypes`

```bash
# Edit the TMDL partition source directly and deploy via fab import,
# or use the XMLA endpoint with Tabular Editor or SSMS to modify
# the partition expression on the deployed model.
```

AS returns an error if the expression is malformed. This is faster than a full execute but doesn't catch runtime errors (wrong column names, data source issues).

### Choosing a Validation Approach

| Need | Use |
|------|-----|
| Full data validation (correct columns, types, values) | Execute via API |
| Quick syntax check | Save to model via XMLA/TOM |
| Step-by-step debugging | Execute with truncated `in` clause |
| Performance testing (check folding) | Execute with full data, observe timing |

## Previewing Partition Steps

See the data at any point in the transformation chain by truncating the `let...in`:

```
-- See raw source data (all columns)
in Data;

-- See after column removal
in #"Removed Columns";

-- See final result
in #"Changed Type";
```

Add `Table.FirstN(stepName, 100)` before the `in` to limit rows for large tables. See **`references/validation.md`** for the complete procedure.

## Common Patterns

### Incremental Refresh Partitions

Incremental refresh partitions use `RangeStart` and `RangeEnd` parameters:

```
let
    Source = Sql.Database(#"SqlEndpoint", #"Database"),
    Data = Source{[Schema="dbo", Item="Orders"]}[Data],
    #"Filtered" = Table.SelectRows(Data, each
        [OrderDate] >= #"RangeStart" and [OrderDate] < #"RangeEnd")
in
    #"Filtered"
```

When testing, inline concrete date values for `RangeStart` and `RangeEnd`.

### Lakehouse Sources

```
let
    Source = Lakehouse.Contents(null),
    Data = Source{[Id="lakehouse-guid"]}[Data],
    Table = Data{[Id="table-name", ItemKind="Table"]}[Data]
in
    Table
```

### SQL with Native Query

For complex SQL that can't be expressed in M:

```
let
    Source = Sql.Database("server", "db"),
    Data = Value.NativeQuery(Source, "SELECT * FROM dbo.MyView WHERE Year = 2024", null, [EnableFolding=true])
in
    Data
```

`Value.NativeQuery` with `EnableFolding=true` allows subsequent M steps to fold on top of the native query.

## References

- **`references/validation.md`** -- Detailed validation workflow with executeQuery API, step preview, error handling
- **`references/best-practices.md`** -- Query folding guidance, fold-breaker list, anti-patterns, performance tips
- **`examples/execute_m.py`** -- Python script to execute M expressions via the Fabric API (CLI tool)
- **`examples/preview_partition.py`** -- Python script to preview partition data at any step (uses `fab get` + `execute_m.py`)
- [Power Query M Reference](https://learn.microsoft.com/en-us/powerquery-m/)
- [Query Folding Guidance](https://learn.microsoft.com/en-us/power-bi/guidance/power-query-folding)
