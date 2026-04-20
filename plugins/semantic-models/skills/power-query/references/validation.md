# Validating Power Query Expressions

Two complementary approaches: execute against real data (comprehensive validation) or save to the model (quick syntax check).

## Approach 1: Execute via Power Query API

Full validation that runs the expression and returns actual data. Catches syntax errors, missing columns, data source issues, and type problems.

### Prerequisites

- A runner dataflow in the workspace with the data source connection bound
- See the `executing-power-query` skill in the `etl` plugin for the full setup procedure

### Step 1: Extract the Expression and Parameters

```bash
# Get partition expression from TMDL
fab get "<Workspace>.Workspace/<Model>.SemanticModel" -f \
  -q "definition.parts[?path=='definition/tables/<Table>.tmdl'].payload"

# Get shared M parameters
fab get "<Workspace>.Workspace/<Model>.SemanticModel" -f \
  -q "definition.parts[?path=='definition/expressions.tmdl'].payload"
```

The partition expression is in the `partition` block of the TMDL. Shared parameters are `expression` declarations in `expressions.tmdl`.

### Step 2: Build the Mashup Document

Wrap the expression in a section document, inlining parameter values as `shared` declarations:

```
section Section1;
shared SqlEndpoint = "myserver.database.windows.net";
shared Database = "MyDatabase";
shared Result = let
    Source = Sql.Database(SqlEndpoint, Database),
    Data = Source{[Schema="dbo",Item="Orders"]}[Data],
    #"Select Columns" = Table.SelectColumns(Data, {"OrderId", "Amount"}),
    Limited = Table.FirstN(#"Select Columns", 100)
in Limited;
```

Key points:
- Replace `#"SqlEndpoint"` references with `SqlEndpoint` (the shared declaration)
- The `shared Result = ...` name must match the `queryName` in the API call
- Add `Table.FirstN` to limit rows for large tables
- For incremental refresh, inline `RangeStart` and `RangeEnd` with concrete date values

### Step 3: Execute

```bash
TOKEN=$(az account get-access-token \
  --resource https://api.fabric.microsoft.com --query accessToken -o tsv)

curl -s -o /tmp/pq_result.bin -X POST \
  "https://api.fabric.microsoft.com/v1/workspaces/${WS_ID}/dataflows/${DF_ID}/executeQuery" \
  -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
  -d "$(jq -n --arg m "$MASHUP" '{queryName:"Result",customMashupDocument:$m}')"
```

### Step 4: Read and Validate Results

```bash
uv run --with pyarrow python3 -c "
import pyarrow.ipc as ipc, io, json

with open('/tmp/pq_result.bin', 'rb') as f:
    table = ipc.open_stream(io.BytesIO(f.read())).read_all()
    df = table.to_pandas()

if 'PQ Arrow Metadata' in df.columns:
    meta = df['PQ Arrow Metadata'].dropna()
    if len(meta) > 0 and len(df.columns) == 1:
        error = json.loads(meta.iloc[0])
        print('ERROR:', error.get('Error', error))
    else:
        cols = [c for c in df.columns if c != 'PQ Arrow Metadata']
        print(f'Columns: {cols}')
        print(df[cols].head(10).to_string(index=False))
        print(f'({len(df)} rows, {len(cols)} columns)')
        print(f'Types: {dict(df[cols].dtypes)}')
else:
    print(f'Columns: {list(df.columns)}')
    print(df.head(10).to_string(index=False))
    print(f'({len(df)} rows)')
"
```

### Common Errors

| Error message | Cause | Fix |
|---------------|-------|-----|
| `Credentials are required to connect to the SQL source` | Connection not bound to the runner dataflow | Bind the connection via `updateDefinition` |
| `Query name not found` | `queryName` doesn't match `shared` name in mashup | Ensure both are `Result` |
| `Expression.Error: The column '...' was not found` | Column name mismatch | Check source table schema |
| `DataSource.Error: ... could not be reached` | Server unreachable or wrong endpoint | Verify connection details |
| Timeout (90 seconds) | Query too expensive | Add `Table.FirstN` to limit rows |

## Approach 2: Save to Model via XMLA/TOM

Analysis Services validates M syntax when a partition expression is saved. This is faster than executing but only catches structural errors; it won't detect wrong column names or data source issues.

### Using TMDL editing or Tabular Editor

Edit the partition expression in the TMDL file directly, or use Tabular Editor to modify and deploy:

```bash
# Edit the partition expression in the TMDL file
# Open: <Model>.SemanticModel/definition/tables/Orders.tmdl
# Modify the partition expression under the "partition" block, then deploy:
fab import "<Workspace>.Workspace/<Model>.SemanticModel" -i ./<Model>.SemanticModel -f
```

If the expression has syntax errors, AS returns an error like:

```
Token Eof expected.
Expression.SyntaxError: Token Literal expected.
```

### Using TMDL Files

Edit the partition `source =` block in the `.tmdl` file and deploy. The deployment process validates the expression.

### What XMLA Validation Catches

- Missing or mismatched `let`/`in` blocks
- Undefined step references (e.g., referencing `#"Step3"` that doesn't exist)
- Invalid M function names
- Syntax errors (missing commas, unbalanced brackets)
- Invalid type names in `TransformColumnTypes`

### What XMLA Validation Misses

- Wrong column names (the expression is syntactically valid but the column doesn't exist at the source)
- Data source connectivity issues
- Runtime errors (division by zero, type conversion failures on actual data)
- Performance issues (broken query folding)

## Step-by-Step Debugging

When an expression fails or produces unexpected results, preview intermediate steps by changing the `in` clause:

```
section Section1;
shared SqlEndpoint = "myserver.database.windows.net";
shared Database = "MyDB";
shared Result = let
    Source = Sql.Database(SqlEndpoint, Database),
    Data = Source{[Schema="dbo",Item="Orders"]}[Data],
    #"Filtered" = Table.SelectRows(Data, each [Status] <> "Cancelled"),
    #"Selected" = Table.SelectColumns(#"Filtered", {"OrderId", "Amount"})
in Data;  -- Change this to inspect different steps
```

| `in` target | What it shows |
|-------------|---------------|
| `in Source` | Table listing from the database |
| `in Data` | All columns from the source table |
| `in #"Filtered"` | After row filtering |
| `in #"Selected"` | After column selection (final) |

For each step, check:
- Column names and count (did a rename/select work?)
- Row count (did a filter apply correctly?)
- Data types (`df.dtypes` in Python)
- Null counts (`df.isnull().sum()`)
- Sample values (do they look right?)

## Validation Checklist

Before deploying a new or modified partition expression:

1. **Syntax**: Save to model (XMLA) to catch structural errors
2. **Data**: Execute via API with `Table.FirstN(_, 100)` to verify correct columns and values
3. **Types**: Check `df.dtypes` matches expected semantic model column types
4. **Nulls**: Check `df.isnull().sum()` for unexpected nulls from type casting
5. **Row count**: Execute without `Table.FirstN` (or with a large limit) to verify filter logic
6. **Folding**: For large tables, verify the query completes within 90 seconds (indicates folding is working)
