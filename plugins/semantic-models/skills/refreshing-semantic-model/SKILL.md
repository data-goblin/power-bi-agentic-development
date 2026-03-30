---
name: refreshing-semantic-model
version: 0.11.2
description: This skill should be used when the user asks to "refresh a semantic model", "trigger a dataset refresh", "refresh specific tables", "refresh partitions", "check refresh status", "monitor refresh history", "do a data-only refresh", "recalculate measures", "clear model data", "cancel a refresh", "validate refresh results", or mentions refresh types, refresh failures, incremental refresh, or enhanced refresh for Power BI semantic models.
---

# Refreshing Semantic Models

Trigger, monitor, validate, and troubleshoot semantic model refreshes via the Power BI Enhanced Refresh REST API and Fabric CLI.

## Core Concepts

A semantic model refresh reloads data from upstream sources and/or recalculates dependent objects (calculated columns, calculated tables, measures). The scope can be the entire model, specific tables, or individual partitions.

Six refresh types are available via the REST API; a seventh (`add`) is TMSL-only:

| Type          | Reloads Data | Recalculates | Primary Use Case                     | API  |
|---------------|:------------:|:------------:|--------------------------------------|:----:|
| `full`        | Yes          | Yes          | Complete reload from scratch         | REST |
| `automatic`   | Conditional  | Conditional  | Smart refresh; process only if needed| REST |
| `dataOnly`    | Yes          | No*          | Reload data; clear dependents        | REST |
| `calculate`   | No           | Yes          | Recalculate without reloading data   | REST |
| `clearValues` | No           | No           | Empty data from objects              | REST |
| `defragment`  | No           | No           | Clean up column dictionaries         | REST |
| `add`         | Append       | Yes          | Append rows to a partition           | TMSL |

*`dataOnly` clears dependent objects (calculated columns, calculated tables) but does not recalculate them. Follow with a `calculate` refresh to restore them.

For detailed descriptions, behavior with incremental refresh policies, commit modes, and parallelism options, consult **`references/refresh-types.md`**.

## Refresh Workflow

### Step 1: Resolve IDs

Extract the workspace and model GUIDs needed for API calls:

```bash
WS_ID=$(fab get "WorkspaceName.Workspace" -q "id" | tr -d '"')
MODEL_ID=$(fab get "WorkspaceName.Workspace/ModelName.SemanticModel" -q "id" | tr -d '"')
```

### Step 2: Query Baseline Data (Pre-Refresh Validation)

Before triggering the refresh, capture a baseline snapshot to later verify that data actually changed. Execute a DAX query against the model to get current row counts or max dates:

```bash
fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID/executeQueries" \
  -X post -i '{
    "queries": [{"query": "EVALUATE ROW(\"RowCount\", COUNTROWS(FactSales), \"MaxDate\", MAX(FactSales[OrderDate]))"}],
    "serializerSettings": {"includeNulls": true}
  }'
```

Record the output. This baseline is compared after refresh to confirm new data arrived.

### Step 3: Trigger the Refresh

**Full model refresh (simplest):**

```bash
fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID/refreshes" \
  -X post -i '{"type":"full"}'
```

**Refresh specific tables:**

```bash
fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID/refreshes" \
  -X post -i '{
    "type": "full",
    "objects": [{"table": "FactSales"}, {"table": "DimProduct"}]
  }'
```

**Refresh specific partitions:**

```bash
fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID/refreshes" \
  -X post -i '{
    "type": "full",
    "objects": [
      {"table": "FactSales", "partition": "FactSales_2024"},
      {"table": "FactSales", "partition": "FactSales_2023"}
    ]
  }'
```

**Data-only refresh (skip recalculation):**

```bash
fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID/refreshes" \
  -X post -i '{"type":"dataOnly","objects":[{"table":"FactSales"}]}'
```

**Calculate only (no data reload):**

```bash
fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID/refreshes" \
  -X post -i '{"type":"calculate"}'
```

**Clear values from a table:**

```bash
fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID/refreshes" \
  -X post -i '{"type":"clearValues","objects":[{"table":"StagingTable"}]}'
```

For the script-based approach with CLI arguments, use **`scripts/refresh_model.py`**.

### Step 4: Monitor Status

```bash
fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID/refreshes?\$top=1"
```

Status values: `Unknown`, `InProgress`, `Completed`, `Failed`, `Disabled`, `Cancelled`

### Step 5: Post-Refresh Validation

After the refresh completes, re-run the same DAX query from Step 2 and compare:

```bash
fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID/executeQueries" \
  -X post -i '{
    "queries": [{"query": "EVALUATE ROW(\"RowCount\", COUNTROWS(FactSales), \"MaxDate\", MAX(FactSales[OrderDate]))"}],
    "serializerSettings": {"includeNulls": true}
  }'
```

**If data has not changed** after a successful refresh:
- The upstream data source has not been updated
- The ETL pipeline (Fabric pipeline, notebook, Data Factory, or other orchestration) needs to run first
- Check the lakehouse/warehouse/SQL database to verify fresh data exists
- For Fabric lakehouses: run `fab run "Workspace.Workspace/Pipeline.DataPipeline"` or trigger the notebook
- The refresh only pulls what the source provides; if the source is stale, the refresh will succeed but show no new data

### Step 6: Cancel (if needed)

To cancel an in-progress enhanced refresh, first retrieve the `requestId` from the refresh history:

```bash
fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID/refreshes?\$top=1"
```

The response includes a `requestId` field. Use it to cancel:

```bash
fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID/refreshes/<requestId>" \
  -X delete
```

Only works for refreshes triggered via the Enhanced API (not scheduled or portal refreshes).

## Using the Refresh Script

The **`scripts/refresh_model.py`** script wraps the Enhanced Refresh API with CLI arguments:

```bash
# Full refresh
uv run scripts/refresh_model.py -w $WS_ID -m $MODEL_ID

# Refresh specific tables
uv run scripts/refresh_model.py -w $WS_ID -m $MODEL_ID --tables Sales,Calendar

# Refresh specific partitions
uv run scripts/refresh_model.py -w $WS_ID -m $MODEL_ID --partitions Sales:Sales_2024

# Data-only then calculate (two-phase)
uv run scripts/refresh_model.py -w $WS_ID -m $MODEL_ID -t dataOnly --tables FactSales
uv run scripts/refresh_model.py -w $WS_ID -m $MODEL_ID -t calculate

# Partial batch with parallelism
uv run scripts/refresh_model.py -w $WS_ID -m $MODEL_ID --commit partialBatch --parallelism 4

# Skip incremental refresh policy
uv run scripts/refresh_model.py -w $WS_ID -m $MODEL_ID --no-policy

# Check status only
uv run scripts/refresh_model.py -w $WS_ID -m $MODEL_ID --status-only

# Poll until complete
uv run scripts/refresh_model.py -w $WS_ID -m $MODEL_ID --poll
```

## Enhanced Refresh Options

The Enhanced Refresh API (Premium/Fabric capacity required) extends the standard refresh with:

| Parameter          | Default         | Purpose                                                  |
|--------------------|-----------------|----------------------------------------------------------|
| `type`             | `automatic`     | Refresh type (full, automatic, dataOnly, calculate, etc.)|
| `commitMode`       | `transactional` | Atomic commit or per-object partial batch                |
| `maxParallelism`   | `10`            | Number of parallel processing threads                    |
| `retryCount`       | `0`             | Automatic retries on failure                             |
| `objects`          | Entire model    | Array of table/partition targets                         |
| `applyRefreshPolicy`| `true`         | Apply or skip incremental refresh policy                 |
| `effectiveDate`    | Current date    | Override date for incremental policy window              |
| `timeout`          | `05:00:00`      | Per-attempt timeout (max total 24h with retries)         |

## Common Patterns

### Two-Phase Refresh (Large Models)

Split data loading and recalculation for better control and failure isolation:

1. `dataOnly` with `partialBatch` to reload all tables (each committed independently)
2. `calculate` with `transactional` to recalculate everything atomically

### Selective Partition Refresh

For tables with incremental refresh, refresh only specific time-range partitions rather than the entire table. To discover partition names, query the model's TMSL metadata via the XMLA endpoint using Tabular Editor, SSMS, or by exporting with the Fabric CLI:

```bash
fab export "Workspace.Workspace/Model.SemanticModel" -o /tmp/model -f
```

Inspect the exported TMDL table files; each `partition` block lists the partition name. Target specific partitions in the `objects` array of the refresh request.

### Refresh After ETL

When orchestrating a data pipeline:

1. Run the upstream ETL (Fabric pipeline, notebook, ADF, or custom)
2. Verify fresh data in the source (lakehouse, warehouse, SQL)
3. Trigger the semantic model refresh
4. Validate with a DAX query that row counts or max dates changed
5. If unchanged, investigate the ETL output; the semantic model refresh succeeded but the source was stale

## Troubleshooting

Quick reference for the most common failures. For the full troubleshooting guide with debugging workflows and detailed error tables, read **`references/troubleshooting.md`**.

| Symptom                        | Likely Cause                                    | Resolution                                         |
|--------------------------------|-------------------------------------------------|----------------------------------------------------|
| Failed with credential error   | Credentials expired, missing, or didn't carry over after copy | Update in dataset settings; only shared cloud connections transfer with `fab cp` |
| Type mismatch on a table       | Source column types don't match model column types | Check `te get "Table/Column" -q dataType` vs source schema; add `Table.TransformColumnTypes` in partition expression |
| Column does not exist          | Source column renamed, removed, or differently cased | Check source schema; add `Table.RenameColumns` in partition expression |
| Timeout (2h shared / 5h Premium) | Model too large for a single refresh window | Implement incremental refresh; use partition-level refresh via XMLA; reduce model size |
| Calculated tables empty        | `dataOnly` refresh clears but doesn't rebuild | Follow with `te refresh --type calculate` to rebuild calculated tables and calc groups |
| Throttled on Premium           | Too many concurrent refreshes                   | Stagger refresh schedules; refresh during off-peak |

### Debugging per-table failures

When a full refresh fails, isolate the failing table:

```bash
te refresh --table Customers --type full    # Dimensions first
te refresh --table Invoices --type full     # Then facts
te refresh --type calculate                 # Then calculated tables
```

Check the failing table's partition expression and compare source schema against the model's expected column names and types with `te get` and `fab table schema`.

## Large Model Strategies

Models over 1 GB or with refresh times exceeding an hour benefit from targeted approaches:

- **Partition-level refresh**: Refresh individual table partitions via the enhanced REST API or XMLA endpoint instead of the full model. Requires Premium/Fabric capacity.
- **Incremental refresh**: Automatically partition large tables by date; only recent data refreshes each cycle. Configure `RangeStart`/`RangeEnd` parameters in Power Query. Also supports detect-data-changes to skip unchanged partitions entirely.
- **Aggregations**: Pre-aggregate large fact tables at a coarser grain into an import-mode aggregation table. Detail queries fall through to DirectQuery. Reduces both refresh time and memory.
- **Hybrid tables**: Historical partitions in import mode; a real-time DirectQuery partition for recent data. Related tables must be Dual storage mode.
- **Scale-out**: Isolate refresh from query workloads by enabling semantic model scale-out on Premium capacities. A read-only replica handles queries while the primary refreshes.

## Capacity Limits

| Capacity Type      | Max Refreshes/Day | Default Timeout | Enhanced Features |
|--------------------|:-----------------:|:---------------:|:-----------------:|
| Pro                | 8                 | 2 hours         | No                |
| Premium Per User   | 48                | 5 hours         | Yes               |
| Premium / Fabric   | 48                | 5 hours         | Yes               |

Pro capacity supports only full-model standard refreshes. Enhanced refresh features (table/partition targeting, commit modes, parallelism, cancel, timeout override) require Premium or Fabric capacity.

## Requirements

- Workspace contributor or higher permissions
- `fab` CLI authenticated: `fab auth login`

## Additional Resources

### Reference Files

- **`references/refresh-types.md`** -- Complete reference for all 7 refresh types, commit modes, parallelism, incremental policy interaction, status values, XMLA/TMSL details, and the two-phase refresh pattern
- **`references/troubleshooting.md`** -- Comprehensive troubleshooting guide: credential errors, type/schema mismatches, timeouts, capacity limits, incremental refresh issues, debugging workflows, and large model strategies

### Scripts

- **`scripts/refresh_model.py`** -- CLI tool for triggering and monitoring refreshes with all enhanced options

## Related Skills

- **`review-semantic-model`** -- Structured model quality and performance review
- **`lineage-analysis`** -- Downstream report discovery and impact analysis
- **`standardize-naming-conventions`** -- Naming audit and remediation
- **`fabric-cli`** (fabric-cli plugin) -- Workspace and item management via `fab` CLI
