---
name: executing-power-query
version: 0.17.0
description: This skill should be used when the user asks to "execute Power Query", "run M expression", "test a partition expression", "preview Power Query results", "preview a Power Query step", "run a dataflow query", "test mashup code", "execute M script in Fabric", "see what a partition returns", "debug Power Query", or needs to run Power Query M expressions programmatically via the Fabric REST API.
---

# Executing Power Query M Programmatically

Execute arbitrary Power Query M scripts via the Fabric REST API. Returns Apache Arrow results (readable as pandas DataFrames). Useful for previewing what a semantic model partition returns, testing M transformations, or debugging Power Query step-by-step.

**Status:** Preview API. 90-second timeout per query.

## Why a Dataflow Is Required

The `executeQuery` endpoint is a method on a Dataflow Gen2 item. There is no standalone Power Query execution endpoint. The dataflow provides compute context (capacity metering), connection bindings (credential resolution), and staging storage. Treat it as a reusable "runner"; create once per workspace, bind connections as needed, reuse indefinitely. The `customMashupDocument` parameter overrides the dataflow's own queries entirely.

## Workflow

### 1. Authenticate

```bash
TOKEN=$(az account get-access-token \
  --resource https://api.fabric.microsoft.com --query accessToken -o tsv)
```

### 2. Create a Runner Dataflow (Once Per Workspace)

```bash
curl -s -X POST "https://api.fabric.microsoft.com/v1/workspaces/${WS_ID}/items" \
  -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
  -d '{"type":"Dataflow","displayName":"PQRunner","description":"Power Query runner"}'
```

Save the returned `id` as `DF_ID`.

### 3. Bind Connections (If Accessing Data Sources)

Skip if the M expression only uses inline data.

Connection binding lives in `queryMetadata.json` inside the dataflow definition. To bind programmatically: find the connection, then push a definition with the binding. See **`references/examples.md` > Full Programmatic Pipeline** for the complete procedure including connection discovery, ClusterId lookup, and definition update.

### 4. Execute M Expressions

```bash
curl -s -o result.bin -X POST \
  "https://api.fabric.microsoft.com/v1/workspaces/${WS_ID}/dataflows/${DF_ID}/executeQuery" \
  -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
  -d "$(jq -n --arg m "$MASHUP" '{queryName:"Result",customMashupDocument:$m}')"
```

The `customMashupDocument` is a full M section document:

```
section Section1;
shared Result = <M expression>;
```

### 5. Read Results

```python
import pyarrow.ipc as ipc, io, json

with open("result.bin", "rb") as f:
    df = ipc.open_stream(io.BytesIO(f.read())).read_all().to_pandas()

if "PQ Arrow Metadata" in df.columns:
    meta = df["PQ Arrow Metadata"].dropna()
    if len(meta) > 0 and len(df.columns) == 1:
        print("Error:", json.loads(meta.iloc[0]))
```

Errors from the mashup engine appear in a `PQ Arrow Metadata` column as JSON.

### 6. Clean Up (Optional)

Delete the runner when no longer needed:

```bash
curl -s -X DELETE \
  "https://api.fabric.microsoft.com/v1/workspaces/${WS_ID}/items/${DF_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
```

Or keep it for future use; an empty runner consumes no capacity when idle.

## Previewing Semantic Model Partitions

The most valuable use case: see the actual data a semantic model's import partition returns, validate intermediate transformation steps, limit row counts for large tables, and optionally write results to a local file or OneLake.

Extract partition expressions with `te get <Table> -q expression` and shared M parameters with `te ls expressions`. Inline the parameter values as `shared` declarations, then truncate the `let...in` to end at any step to see intermediate results.

See **`references/partition-preview.md`** for the full workflow: extracting expressions, inlining parameters, step-by-step preview, row limiting, and output options (local file, OneLake, lakehouse table).

## What Works Without Connections

Inline M that doesn't access external data sources needs no connection binding:

```
section Section1;
shared Result = #table({"Name", "Value"}, {{"Revenue", 42000}, {"Cost", 18500}});
```

All `Table.*`, `List.*`, `Record.*`, `Text.*` functions work.

## What Needs Connections

Any `Sql.Database`, `Lakehouse.Contents`, `Web.Contents`, or similar connector call requires a connection bound to the runner dataflow. The connection must already exist in the tenant (list via `GET /v1/connections`) or be creatable via the Connections API. OAuth2 connections may require one-time browser consent; `WorkspaceIdentity` or `ServicePrincipal` credentials can be created fully programmatically. See **`references/examples.md`** for connection discovery, creation, and binding.

## Limitations

- 90-second execution timeout
- Preview API; may change
- Results limited by mashup engine memory
- `ClusterId` for connection binding must be discovered from an existing bound dataflow
- One runner can hold multiple connections for different source types

## References

- **`references/examples.md`** -- Full pipeline with connection binding, inline M, error handling
- **`references/partition-preview.md`** -- Previewing semantic model partitions, step inspection, row limits, output to file/OneLake
- [Execute Query API](https://learn.microsoft.com/en-us/rest/api/fabric/dataflow/query-execution/execute-query)
- [Dataflow Definition Structure](https://learn.microsoft.com/en-us/rest/api/fabric/articles/item-management/definitions/dataflow-definition)
- [Connections API](https://learn.microsoft.com/en-us/rest/api/fabric/core/connections)
