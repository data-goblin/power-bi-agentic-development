# Previewing Semantic Model Partitions

Preview the actual data that a semantic model's import partition returns. Inspect any intermediate Power Query step, limit row counts, and write results to local files or OneLake.

## How Import Partitions Work

Each table in an import-mode semantic model has one or more partitions. Each partition has an M expression that defines what data gets loaded during refresh. The M expression typically:

1. Connects to a data source (`Sql.Database`, `Lakehouse.Contents`, etc.)
2. Navigates to a specific table or view
3. Applies transformations (column selection, filtering, renaming, type casting)

The expression references shared M parameters (like `#"SqlEndpoint"`, `#"Database"`) defined at the model level.

## Extracting the Expression

### Get the Partition M Expression

```bash
te get <TableName> -s "<Workspace>" -d "<Model>" -q expression
```

This returns the M expression as a JSON-escaped string. For example:

```
"let\n    Source = Sql.Database(#\"SqlEndpoint\",#\"Database\"),\n    Data = Source{[Schema=\"Factview\",Item=\"Budget\"]}[Data],\n    #\"Select Columns\" = Table.SelectColumns(Data, {\"Customer Key\", \"Month\", \"Total Budget\"})\nin\n    #\"Select Columns\""
```

### Get Shared M Parameters

```bash
te ls -s "<Workspace>" -d "<Model>" expressions
```

Returns parameter names, kinds, and values:

```json
[
  {"name": "SqlEndpoint", "kind": "M", "expression": "\"myserver.database.windows.net\" meta [...]"},
  {"name": "Database", "kind": "M", "expression": "\"MyDatabase\" meta [...]"}
]
```

Extract the actual values from the expression strings (the quoted string before `meta`).

### Get Expression for a Specific Partition

If a table has multiple partitions (e.g., incremental refresh):

```bash
te get <TableName>/<PartitionName> -s "<Workspace>" -d "<Model>" -q expression
```

## Building the Mashup Document

### Inline Parameters

Replace M parameter references with `shared` declarations containing actual values:

```
section Section1;
shared SqlEndpoint = "te3-training-eu.database.windows.net";
shared Database = "SpacePartsCoDW";
shared Result = let
    Source = Sql.Database(SqlEndpoint, Database),
    Data = Source{[Schema="Factview",Item="Budget"]}[Data],
    #"Select Columns" = Table.SelectColumns(Data, {"Customer Key", "Month", "Total Budget"}),
    #"Renamed Columns" = Table.RenameColumns(#"Select Columns", {{"Total Budget", "Budget (EUR)"}})
in #"Renamed Columns";
```

Key points:
- The original expression uses `#"SqlEndpoint"` (quoted identifier); replace with `SqlEndpoint` (shared declaration)
- The `shared Result = ...` wrapper is required; `Result` must match the `queryName` in the API call
- Incremental refresh partitions may reference `#"RangeStart"` and `#"RangeEnd"` parameters; inline those too

## Previewing Intermediate Steps

Change the `in` clause to end at any earlier step in the `let...in` chain:

| Step | `in` clause | What it shows |
|------|-------------|---------------|
| Source | `in Source;` | Raw table/view listing from the database |
| Data | `in Data;` | All columns from the source table before transforms |
| Select Columns | `in #"Select Columns";` | After column filtering |
| Renamed Columns | `in #"Renamed Columns";` | Final result after renaming |

This is equivalent to clicking each step in the Power Query editor to see its output at that point.

### Example: Inspecting the Raw Source

```
section Section1;
shared SqlEndpoint = "te3-training-eu.database.windows.net";
shared Database = "SpacePartsCoDW";
shared Result = let
    Source = Sql.Database(SqlEndpoint, Database),
    Data = Source{[Schema="Factview",Item="Budget"]}[Data]
in Data;
```

Returns all columns from the Budget view before any transformations; useful for seeing what columns are available and what the raw data looks like.

## Limiting Row Counts

Large tables can hit the 90-second timeout or exhaust mashup engine memory. Add `Table.FirstN` to limit rows.

### Limit at the End

Wrap the final step in `Table.FirstN`:

```
section Section1;
shared SqlEndpoint = "te3-training-eu.database.windows.net";
shared Database = "SpacePartsCoDW";
shared Result = let
    Source = Sql.Database(SqlEndpoint, Database),
    Data = Source{[Schema="Factview",Item="Budget"]}[Data],
    #"Select Columns" = Table.SelectColumns(Data, {"Customer Key", "Month", "Total Budget"}),
    Limited = Table.FirstN(#"Select Columns", 100)
in Limited;
```

### Limit Earlier (For Very Large Tables)

If the source table is so large that even the `Data` step times out, apply the limit immediately after navigation. The M engine folds `Table.FirstN` into the SQL query as `TOP N`, so this runs server-side:

```
    Data = Table.FirstN(Source{[Schema="Factview",Item="Budget"]}[Data], 1000),
```

### Row Count Without Fetching Data

Get just the row count:

```
section Section1;
shared SqlEndpoint = "te3-training-eu.database.windows.net";
shared Database = "SpacePartsCoDW";
shared Result = let
    Source = Sql.Database(SqlEndpoint, Database),
    Data = Source{[Schema="Factview",Item="Budget"]}[Data],
    Count = Table.RowCount(Data)
in #table({"RowCount"}, {{Count}});
```

## Output Options

### Local CSV File

After reading the Arrow result into a pandas DataFrame:

```python
df.to_csv("/tmp/budget_preview.csv", index=False)
```

### Local Parquet File

```python
df.to_parquet("/tmp/budget_preview.parquet", index=False)
```

### OneLake via `az storage`

Write directly to a OneLake path using the Azure CLI:

```bash
# Write parquet to a lakehouse Files/ folder
az storage fs file upload \
  --source /tmp/budget_preview.parquet \
  --path "Files/previews/budget_preview.parquet" \
  --file-system "<workspace-guid>" \
  --account-name "onelake" \
  --auth-mode login
```

The `--file-system` is the workspace GUID. The `--path` follows the pattern `<ItemName>.Lakehouse/Files/<path>` or `<ItemName>.Lakehouse/Tables/<tablename>`.

### OneLake via Fabric REST API

Upload to a lakehouse using the OneLake file API:

```bash
LAKEHOUSE_PATH="https://onelake.dfs.fabric.microsoft.com/${WS_ID}/<LakehouseName>.Lakehouse/Files/previews/budget.parquet"

curl -s -X PUT "${LAKEHOUSE_PATH}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-ms-blob-type: BlockBlob" \
  --data-binary @/tmp/budget_preview.parquet
```

### Lakehouse Delta Table

To write as a managed Delta table (queryable via SQL endpoint), use a notebook or the lakehouse table API. The simplest path from a local parquet:

1. Upload the parquet file to `Tables/<tablename>/` in the lakehouse
2. Or use a Fabric notebook with `spark.read.parquet(...).write.saveAsTable(...)`

For ad-hoc previews, writing to `Files/` as parquet or CSV is usually sufficient.

## Common Patterns

### Preview All Tables in a Model

Loop through all tables and preview each partition:

```bash
# List all tables
TABLES=$(te ls -s "MyWorkspace" -d "MyModel" --output json | jq -r '.items[].name')

for TABLE in $TABLES; do
    echo "=== $TABLE ==="
    EXPR=$(te get "$TABLE" -s "MyWorkspace" -d "MyModel" -q expression 2>/dev/null)
    if [ -n "$EXPR" ]; then
        # Build mashup with inlined parameters and Table.FirstN(_, 5)
        # Execute and display
    fi
done
```

### Compare Steps Before and After a Transform

Execute twice with different `in` clauses and compare:

```python
# df_before = execute with "in Data;"
# df_after = execute with "in #\"Select Columns\";"

print(f"Before: {df_before.shape[1]} columns, {df_before.shape[0]} rows")
print(f"After:  {df_after.shape[1]} columns, {df_after.shape[0]} rows")
print(f"Removed columns: {set(df_before.columns) - set(df_after.columns)}")
```

### Validate Data Types After Type Casting

```python
print(df.dtypes)
# Check for unexpected nulls introduced by type casting
print(df.isnull().sum())
```
