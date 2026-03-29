# Refresh Types Reference

Complete reference for all refresh types available in the Power BI Enhanced Refresh API and TMSL refresh command. These types apply to databases, tables, and partitions.

## Refresh Type Summary

| Type          | Reloads Data | Recalculates | Clears First | Scope               | Use Case                                         |
|---------------|:------------:|:------------:|:------------:|----------------------|--------------------------------------------------|
| `full`        | Yes          | Yes          | Yes          | DB / Table / Part.   | Complete reload and recalculation from scratch    |
| `automatic`   | Conditional  | Conditional  | No           | DB / Table / Part.   | Smart refresh; only processes what needs updating |
| `dataOnly`    | Yes          | No           | Yes          | DB / Table / Part.   | Reload data without recalculating dependents      |
| `calculate`   | No           | Yes          | No           | DB / Table / Part.   | Recalculate without reloading any data            |
| `clearValues` | No           | No           | Yes          | DB / Table / Part.   | Empty data from objects and all dependents        |
| `add`         | Yes (append) | Yes          | No           | Partition only       | Append new rows to an existing partition          |
| `defragment`  | No           | No           | No           | DB / Table           | Clean up unused dictionary entries                |

## Detailed Descriptions

### `full`

Reload all data from the source and recalculate all dependent objects. The most thorough but most expensive operation.

- Clears existing data before reloading
- Recalculates all calculated columns, calculated tables, and measures
- Processes all partitions in the specified scope
- For calculation partitions, recalculates the partition and all its dependents
- Use when data sources have changed structurally or after schema changes
- Use when partition states are inconsistent or in an error state

### `automatic`

Conditionally refresh and recalculate only objects that need it. The default type when no type is specified.

- Checks the state of each object; only processes objects not in a `Ready` state
- If a partition already has data and is in Ready state, it is skipped
- More efficient than `full` for incremental scenarios
- Ideal for scheduled refreshes and general-purpose automation
- Behaves like `full` for objects that need processing

### `dataOnly`

Reload data from the source without recalculating any dependent objects.

- Clears existing data and reloads from source
- Does NOT recalculate calculated columns, calculated tables, or measures
- **Dependents are cleared to an unprocessed state** (calculated columns become empty, calculated tables lose data); they must be recalculated with a subsequent `calculate` refresh
- Useful as the first step in a two-phase refresh (dataOnly + calculate)
- Reduces processing time when recalculation will happen in a separate step
- The model may be in a partially unprocessed state until the `calculate` step runs

### `calculate`

Recalculate dependent objects without reloading any data from sources.

- No data source connections are made
- Recalculates calculated columns, calculated tables, and measures
- Only recalculates objects that need it (unless they are volatile formulas)
- Useful after a `dataOnly` refresh to recalculate in a controlled step
- Useful when only DAX logic has changed (new measures or modified expressions)

### `clearValues`

Remove all data from the specified objects and their dependents.

- Does not reload data; simply empties the object
- Clears all dependent objects as well
- Leaves the object in an unprocessed state
- Useful to free memory before a selective reload
- Useful to reset a partition or table to empty state

### `add` (Partition only; TMSL only)

Append new rows to an existing partition without removing current data. **Not available via the REST API**; requires XMLA/TMSL endpoint access (SSMS, Tabular Editor, PowerShell).

- Only valid for regular (import) partitions; not for calculation partitions
- Appends data from the partition source query
- Recalculates all dependents after appending
- Does NOT clear existing data first
- Useful for log/event tables where new data is appended
- Requires that the source query returns only the new rows to append

### `defragment`

Clean up unused dictionary entries in column stores.

- No data is reloaded or recalculated
- Removes values from column dictionaries that no longer exist in actual data
- Reduces memory consumption after many add/remove operations
- Useful for models with frequent partition changes (incremental refresh)
- Minimal impact on query performance during execution


## Two-Phase Refresh Pattern

For large models, split the refresh into two phases for better control:

**Phase 1 -- Data reload:**
```json
{
  "type": "dataOnly",
  "commitMode": "partialBatch",
  "maxParallelism": 4,
  "objects": [
    {"table": "FactSales"},
    {"table": "FactInventory"}
  ]
}
```

**Phase 2 -- Recalculation:**
```json
{
  "type": "calculate",
  "commitMode": "transactional"
}
```

Benefits:
- Data reload failures do not leave calculated columns in an inconsistent state
- Each phase can have different commit modes (partialBatch for data, transactional for calc)
- Better visibility into which phase failed


## Commit Modes

### `transactional` (default)

- All objects are committed atomically; either everything succeeds or nothing changes
- If any object fails, the entire operation rolls back
- Model remains in its pre-refresh state on failure
- Safer for production workloads

### `partialBatch`

- Each object is committed individually as it completes
- If one table fails, previously committed tables retain their new data
- On failure, the model may contain a mix of old and new data
- Faster for large models with many independent tables
- `applyRefreshPolicy` must be `false` when using partialBatch


## Incremental Refresh Policy Interaction

When `applyRefreshPolicy` is `true` (default) and the table has an incremental refresh policy:

| Type          | Behavior with Policy Applied                                                     |
|---------------|----------------------------------------------------------------------------------|
| `full`        | Creates/updates partitions per policy; refreshes incremental range; skips history |
| `dataOnly`    | Same as full but without recalculation of dependents                             |
| `automatic`   | Same as full but partitions use automatic processing                             |
| `calculate`   | Policy does not affect behavior                                                  |
| `clearValues` | Policy does not affect behavior                                                  |
| `add`         | Policy does not affect behavior                                                  |
| `defragment`  | Policy does not affect behavior                                                  |

Set `applyRefreshPolicy: false` to bypass the policy and refresh all partitions manually. This is required when using `commitMode: partialBatch`.


## MaxParallelism

Controls the number of threads used for parallel processing.

- Default: `10`
- Setting to `1` forces sequential processing
- Higher values consume more capacity resources
- For optimal parallel processing order:
  1. `clearValues` on all objects first
  2. `dataOnly` on all objects
  3. `full` or `calculate` on all objects


## Enhanced Refresh API vs Standard Refresh

| Feature                       | Standard Refresh        | Enhanced Refresh               |
|-------------------------------|-------------------------|--------------------------------|
| Trigger endpoint              | POST /refreshes         | POST /refreshes (with body)    |
| Table/partition targeting     | No                      | Yes                            |
| Custom commit mode            | No                      | Yes                            |
| Max parallelism control       | No                      | Yes                            |
| Retry count                   | No                      | Yes                            |
| Per-object status (GET)       | No                      | Yes                            |
| Cancel in-progress            | No                      | Yes (DELETE /refreshes/{id})   |
| Timeout configuration         | No                      | Yes                            |
| Apply/skip refresh policy     | Always applies          | Configurable                   |
| Effective date override       | No                      | Yes                            |
| Requires Premium/Fabric       | No (Pro supported)      | Yes                            |


## Status Values

Returned by the GET /refreshes endpoint:

| Status        | Meaning                                                     |
|---------------|-------------------------------------------------------------|
| `Unknown`     | Completion state cannot be determined; may still be running |
| `Completed`   | Refresh completed successfully                              |
| `Failed`      | Refresh encountered an error                                |
| `Disabled`    | Refresh was disabled (e.g. by selective refresh)            |
| `InProgress`  | Refresh is currently running                                |
| `Cancelled`   | Refresh was cancelled via DELETE                            |

The `extendedStatus` field provides additional detail:

| Extended Status | Meaning                        |
|-----------------|--------------------------------|
| `NotStarted`   | Queued but not yet started     |
| `InProgress`   | Currently processing           |
| `Completed`    | Successfully completed         |
| `Failed`       | Error during processing        |
| `Cancelled`    | Cancelled by user              |


## XMLA / TMSL Refresh (Advanced)

For direct XMLA endpoint access (SSMS, Tabular Editor, PowerShell), the TMSL refresh command accepts the same types:

```json
{
  "refresh": {
    "type": "full",
    "objects": [
      {
        "database": "MyModel",
        "table": "FactSales",
        "partition": "Sales_2024_Q1"
      }
    ]
  }
}
```

TMSL also supports:
- **Connection string overrides** during refresh
- **Query definition overrides** for partitions
- **Sequence commands** for ordered multi-step operations
- The `add` type (not available via REST API)

TMSL requires a persistent XMLA connection. For long-running refreshes, prefer the REST API.
