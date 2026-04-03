# Power Query executeQuery Examples

## Full Programmatic Pipeline

Complete end-to-end workflow: authenticate, create runner, find connection, bind it, execute, read results, clean up.

### Step 1: Set Variables and Authenticate

```bash
WS_ID="<workspace-guid>"
TOKEN=$(az account get-access-token \
  --resource https://api.fabric.microsoft.com --query accessToken -o tsv)
```

### Step 2: Create Runner Dataflow

```bash
RUNNER=$(curl -s -X POST \
  "https://api.fabric.microsoft.com/v1/workspaces/${WS_ID}/items" \
  -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
  -d '{"type":"Dataflow","displayName":"PQRunner","description":"Power Query runner"}')

DF_ID=$(echo "$RUNNER" | jq -r '.id')
echo "Runner ID: ${DF_ID}"
```

### Step 3: Find an Existing Connection

List all connections and filter for the target data source:

```bash
curl -s "https://api.fabric.microsoft.com/v1/connections" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.value[] | select(.connectionDetails.path | test("myserver";"i"))
        | {id, displayName, connectivityType, connectionDetails}'
```

The `id` from the matching connection is the `DatasourceId` needed for binding.

If no connection exists, create one:

```bash
curl -s -X POST "https://api.fabric.microsoft.com/v1/connections" \
  -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
  -d '{
    "connectivityType": "ShareableCloud",
    "displayName": "MySQL Connection",
    "connectionDetails": {
      "type": "SQL",
      "path": "myserver.database.windows.net;MyDatabase"
    },
    "credentialDetails": {
      "credentialType": "OAuth2",
      "singleCredential": {
        "connectionEncryption": "NotEncrypted",
        "skipTestConnection": false
      }
    }
  }'
```

Note: OAuth2 may require one-time browser consent. `WorkspaceIdentity` or `ServicePrincipal` credential types are fully programmatic.

### Step 4: Discover ClusterId

The `ClusterId` is a Fabric cluster identifier required for the connection binding. Find it from any dataflow in the same workspace that already has a bound connection:

```bash
# Get definition of an existing dataflow with a connection
EXISTING_DF_ID="<a-dataflow-with-connections>"
curl -s -X POST \
  "https://api.fabric.microsoft.com/v1/workspaces/${WS_ID}/items/${EXISTING_DF_ID}/getDefinition" \
  -H "Authorization: Bearer ${TOKEN}" -H "Content-Length: 0" \
  | jq '.definition.parts[] | select(.path == "queryMetadata.json")
        | .payload | @base64d | fromjson | .connections'
```

The `ClusterId` is stable per Fabric region/cluster. Once discovered, reuse it for all connections in that workspace.

If no existing dataflow has a connection, create one via the Fabric portal (one-time setup): open any dataflow, add a data source, authenticate. Then extract the ClusterId from its definition.

### Step 5: Bind Connection to Runner

Push a dataflow definition with the connection binding in `queryMetadata.json`:

```bash
CONN_ID="<connection-guid>"
CLUSTER_ID="<cluster-guid>"
SERVER="myserver.database.windows.net"
DATABASE="MyDatabase"

MASHUP_B64=$(echo -n 'section Section1;' | base64)

METADATA=$(cat <<EOF
{
  "formatVersion": "202502",
  "computeEngineSettings": {"allowFastCopy": false},
  "name": "",
  "allowNativeQueries": false,
  "connections": [
    {
      "path": "${SERVER};${DATABASE}",
      "kind": "SQL",
      "connectionId": "{\"ClusterId\":\"${CLUSTER_ID}\",\"DatasourceId\":\"${CONN_ID}\"}"
    }
  ]
}
EOF
)
METADATA_B64=$(echo -n "$METADATA" | base64)

curl -s -X POST \
  "https://api.fabric.microsoft.com/v1/workspaces/${WS_ID}/items/${DF_ID}/updateDefinition" \
  -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
  -d "$(jq -n --arg m "$MASHUP_B64" --arg meta "$METADATA_B64" \
    '{definition:{parts:[
      {path:"mashup.pq",payload:$m,payloadType:"InlineBase64"},
      {path:"queryMetadata.json",payload:$meta,payloadType:"InlineBase64"}
    ]}}')"
```

**Connection binding fields:**

| Field | Value | Source |
|-------|-------|--------|
| `path` | `server;database` | Data source path as the M connector resolves it |
| `kind` | `SQL`, `Lakehouse`, `Web` | Matches the M connector type |
| `DatasourceId` | Connection GUID | `GET /v1/connections` |
| `ClusterId` | Cluster GUID | Existing dataflow definition (Step 4) |

### Step 6: Execute

```bash
MASHUP='section Section1;
shared SqlEndpoint = "myserver.database.windows.net";
shared Database = "MyDatabase";
shared Result = let
    Source = Sql.Database(SqlEndpoint, Database),
    Data = Source{[Schema="dbo",Item="MyTable"]}[Data],
    Top10 = Table.FirstN(Data, 10)
in Top10;'

curl -s -o /tmp/pq_result.bin -X POST \
  "https://api.fabric.microsoft.com/v1/workspaces/${WS_ID}/dataflows/${DF_ID}/executeQuery" \
  -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
  -d "$(jq -n --arg m "$MASHUP" '{queryName:"Result",customMashupDocument:$m}')"
```

### Step 7: Read Results

```bash
uv run --with pyarrow python3 -c "
import pyarrow.ipc as ipc, io, json

with open('/tmp/pq_result.bin', 'rb') as f:
    table = ipc.open_stream(io.BytesIO(f.read())).read_all()
    df = table.to_pandas()

if 'PQ Arrow Metadata' in df.columns:
    meta = df['PQ Arrow Metadata'].dropna()
    if len(meta) > 0 and len(df.columns) == 1:
        print('Error:', json.loads(meta.iloc[0]))
    else:
        print(df.drop(columns=['PQ Arrow Metadata']).to_string(index=False))
else:
    print(df.to_string(index=False))
print(f'({len(df)} rows)')
"
```

### Step 8: Clean Up (Optional)

```bash
curl -s -X DELETE \
  "https://api.fabric.microsoft.com/v1/workspaces/${WS_ID}/items/${DF_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
```

An idle runner consumes no capacity; safe to keep for reuse.

## Inline M (No Connection Needed)

Test M transformations without any data source:

```
section Section1;
shared Result = let
    Raw = #table({"date", "category", "amount"}, {
        {"2025-01-15", "A", 100},
        {"2025-01-20", "B", 200},
        {"2025-02-10", "A", 150}
    }),
    Typed = Table.TransformColumnTypes(Raw, {
        {"date", type date}, {"amount", Int64.Type}
    }),
    Grouped = Table.Group(Typed, {"category"}, {
        {"Total", each List.Sum([amount]), type number},
        {"Count", each Table.RowCount(_), Int64.Type}
    })
in Grouped;
```

## Running Existing Dataflow Queries

Execute a named query from the dataflow's own mashup (no `customMashupDocument`):

```json
{"queryName": "MyExistingQuery"}
```

## Error Handling

Errors appear in the `PQ Arrow Metadata` column as JSON:

| Error | Cause | Fix |
|-------|-------|-----|
| `Credentials are required to connect to the SQL source` | No connection bound for this data source | Bind the connection (Step 5) |
| `Query name not found` | `queryName` doesn't match a `shared` declaration | Check spelling matches the shared name in the mashup |
| Timeout | Query exceeded 90 seconds | Add `Table.FirstN` or simplify |
| HTTP 404 on executeQuery | Dataflow doesn't exist or API not available in region | Verify DF_ID and workspace |

## Multiple Connections

Bind multiple connections for different source types by adding entries to the `connections` array:

```json
"connections": [
  {
    "path": "sqlserver.database.windows.net;MyDB",
    "kind": "SQL",
    "connectionId": "{\"ClusterId\":\"...\",\"DatasourceId\":\"sql-conn-guid\"}"
  },
  {
    "path": "my-lakehouse.datawarehouse.fabric.microsoft.com;lakehouse-guid",
    "kind": "Lakehouse",
    "connectionId": "{\"ClusterId\":\"...\",\"DatasourceId\":\"lakehouse-conn-guid\"}"
  }
]
```
