# Refresh Troubleshooting

Common refresh failures, their causes, and resolutions. Use this reference when a refresh fails or behaves unexpectedly.


## Credential and Authentication Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| `DatasourceHasNoCredentialError` | Data source credentials missing or not configured | Set credentials in dataset settings (Power BI service); for cloud connections, re-authenticate via OAuth |
| `OAuthTokenRefreshFailedError` | OAuth token expired during refresh (common with Entra ID sources like SharePoint, Dynamics) | Token expires after ~1 hour; reduce data volume per query or switch to a service principal |
| Access forbidden / 403 | Insufficient workspace permissions | Verify workspace contributor role or higher |
| Credentials not carried after `fab cp` | Personal or gateway-bound credentials don't transfer when copying a model to a new workspace | Re-authenticate in dataset settings; only shared cloud connections carry over automatically |


## Data Source and Gateway Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| `GatewayNotReachable` | On-premises gateway offline or outdated | Install latest gateway version; check gateway status in admin portal |
| Unsupported data source for refresh | Data source type not supported for scheduled refresh | Check supported sources; consider using a gateway or switching connectors |
| `Web.Page` connector fails | Web connector requires gateway after Nov 2016 | Configure an on-premises data gateway |
| Connection timed out or was lost | Transient network error or long-running M query | Retry; if persistent, use `Table.Buffer` for complex joins; check data source timeouts |


## Type and Schema Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| Type mismatch | Source column type doesn't match model column `dataType` | Add `Table.TransformColumnTypes` in the partition expression; or fix the model column type to match the source |
| Column does not exist in rowset | Source column renamed, removed, or differently cased | Check source schema; add `Table.RenameColumns` in the partition expression |
| Duplicate value on key column | Source has duplicates on a column used on the "one" side of a relationship | Add `Table.Distinct` in partition expression; or fix source data; or review whether the column should be a key |
| `ANY` type column with TRUE/FALSE | Boolean values convert to -1/0 in the service (differs from Desktop) | Set explicit data types in Power Query before publishing |


## Timeout and Size Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| Scheduled refresh timeout (2h / 5h) | Model too large or complex for the refresh window (2h shared, 5h Premium) | Reduce model size; implement incremental refresh; use partitioned refresh via XMLA |
| Uncompressed data limit exceeded | Shared capacity: 10 GB uncompressed limit during refresh | Reduce data volume; filter in Power Query; move to Premium |
| Model size exceeds capacity limit | Model larger than the capacity's max size (1 GB Pro, 25 GB Trial, varies by Fabric SKU) | Enable large model storage format (Premium); reduce model size; upgrade capacity |
| Data source query timeout | Source system has its own query timeout | Override via `CommandTimeout` in the connection string or M expression |
| Initial incremental refresh timeout | First refresh must load all historical data | Bootstrap the initial refresh via XMLA endpoint to create partition objects without loading data |


## Incremental Refresh Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| Query not folded | `RangeStart`/`RangeEnd` filter not pushed to source; engine loads all data then filters locally | Verify query folding with source profiling; ensure filter step is foldable; check `RangeStart`/`RangeEnd` are `DateTime` type matching the source column |
| Data type mismatch on parameters | `RangeStart`/`RangeEnd` type doesn't match the date column | Both must be `DateTime`; if source uses integer keys, create a conversion function |
| Partition-key conflicts | Date column values updated at source after initial partition | Refresh all affected partitions from the changed date forward via XMLA |
| Data truncated | Source returns > 64 MB compressed (Azure Data Explorer, Log Analytics) | Specify smaller refresh/store periods so each partition query stays under the limit |
| Duplicate values after date change | Transaction dates changed at source cause a row to appear in two partitions | Refresh partitions from the change point forward; avoid updating the date column used for partitioning |


## Capacity and Throttling Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| Refresh throttled | Too many concurrent refreshes on the capacity | Refresh during off-peak hours; stagger schedules; check SKU concurrent refresh limits |
| `Capacity level limit exceeded` | Capacity-wide concurrent refresh limit hit | Retry later; reduce overlapping refresh schedules |
| Memory error during refresh | Insufficient memory; refresh requires ~2x model size (original + copy for queries) | Increase `Max Memory %` in capacity settings; reduce model complexity; enable scale-out for refresh isolation |
| `Container exited unexpectedly (0x0000DEAD)` | Internal service error | Disable scheduled refresh; republish the model; re-enable |


## Calculated Table / Calculated Column Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| Circular dependency on refresh | `SummarizeColumns` inside `CalculateTable` introduced new dependencies (Sept 2024 change) | Add the grouped tables as explicit filters inside `SummarizeColumns` |
| Calculated tables empty after `dataOnly` refresh | `dataOnly` clears but doesn't rebuild calculated objects | Follow with a `calculate` refresh to rebuild |
| `calculate` refresh times out | Many calculation groups or large calculated tables | Refresh calculated tables individually via XMLA; increase timeout |


## Debugging Workflow

### 1. Check the refresh history

```bash
WS_ID=$(fab get "MyWorkspace.Workspace" -q "id" | tr -d '"')
MODEL_ID=$(fab get "MyWorkspace.Workspace/MyModel.SemanticModel" -q "id" | tr -d '"')
fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID/refreshes?\$top=5"
```

Look at `status` and `serviceExceptionJson` for the specific error message and which table/partition failed.

### 2. Isolate the failing table

Refresh tables one at a time to find which one fails:

```bash
te connect "MyWorkspace" "MyModel"
te refresh --table Customers --type full    # Dimensions first
te refresh --table Products --type full
te refresh --table Invoices --type full     # Then facts
te refresh --type calculate                 # Then calculated tables
```

### 3. Compare source schema to model schema

Check what the source provides vs what the model expects:

```bash
# Source schema (lakehouse example)
fab table schema "MyWorkspace.Workspace/MyLakehouse.Lakehouse/Tables/invoices"

# Model column types
te get "Invoices/Billing Date" -q dataType
te get "Invoices/Customer Key" -q dataType
```

If they don't match, add type conversion steps in the partition expression.

### 4. Verify query folding

For incremental refresh, confirm the filter is pushed to the source:

- In Power BI Desktop: right-click the filter step in Power Query; if "View Native Query" is available and shows a WHERE clause, folding works
- At the source: use SQL Profiler or query logs to verify a single filtered query per partition

### 5. Check capacity state

```bash
# Is the workspace on a capacity?
fab get "MyWorkspace.Workspace" -q "capacityId"

# Is the capacity active?
fab api -A powerbi "capacities" -q "value[].{name:displayName, state:state, sku:sku}"
```

A workspace without a capacity (or on a suspended capacity) will fail all refresh operations.


## Strategies for Large Models

For models that are too large or slow to refresh in a single operation:

### Partition-level refresh

Refresh individual partitions instead of entire tables. Requires Premium/Fabric capacity with XMLA endpoint access:

```bash
# Refresh only recent partitions (via enhanced REST API)
fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID/refreshes" -X post \
  -i '{"type":"Full","objects":[{"table":"Invoices","partition":"2024-Q4"}]}'
```

### Incremental refresh

Automatically partition large tables by date so only recent data refreshes each cycle. Configure in Power BI Desktop with `RangeStart`/`RangeEnd` parameters. Consider:

- Store period: how much historical data to keep (e.g. 3 years)
- Refresh period: how much recent data to reload each cycle (e.g. 30 days)
- Detect data changes: skip unchanged historical partitions entirely

### Aggregations

Pre-aggregate large fact tables at a coarser grain (e.g. monthly by category) into an import-mode aggregation table. Detail queries fall through to DirectQuery. Reduces both refresh time and memory.

### Hybrid tables

Combine import mode (historical data) with DirectQuery (recent data) on the same table. Historical partitions import during scheduled refresh; real-time partition queries the source live. Related tables must be set to Dual storage mode.

### Scale-out

Enable semantic model scale-out on Premium capacities to isolate refresh from query workloads. A read-only replica handles interactive queries while the read/write replica refreshes.
