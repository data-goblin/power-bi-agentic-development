---
name: lineage-analysis
version: 0.22.3
description: Trace relationships between semantic models and downstream reports across Fabric workspaces. Automatically invoke when the user asks to "find downstream reports", "show report lineage", "impact analysis", "what depends on this dataset", "cross-workspace lineage", "which reports are connected", "get model dependencies", or mentions model-to-report dependency tracing.
---

# Lineage Analysis

Trace downstream dependencies from a semantic model to all connected reports across the tenant. No admin permissions required -- workspace contributor access is sufficient.

## When to Use

- Before modifying or deleting a semantic model, to understand impact
- Auditing which reports are connected to a model and where they live
- Identifying orphaned or test reports connected to production models
- Cross-workspace dependency mapping

## Downstream Reports

Run `scripts/get-downstream-reports.py` to find all reports bound to a semantic model.

```bash
# By workspace and model name
python3 scripts/get-downstream-reports.py "Workspace Name" "Model Name"

# By dataset GUID directly
python3 scripts/get-downstream-reports.py --dataset-id <guid>

# JSON output for further processing
python3 scripts/get-downstream-reports.py "Workspace" "Model" --json
```

**Requirements:** `azure-identity`, `requests` (`pip install azure-identity requests`). Authenticated via `DefaultAzureCredential` (works with `az login`, managed identity, or environment variables).

**How it works:** Lists all workspaces the user can access, then queries each workspace's reports in parallel (8 workers) checking `datasetId`. Groups results by workspace. Typically completes in under 10 seconds for ~100 workspaces.

**Permissions:** Workspace contributor or higher on any workspace to be scanned. Reports in workspaces without access will not appear. For full tenant coverage, use the `--dataset-id` flag with a tenant admin token and the `admin/reports` API instead.

## Limitations

**Reports are not the only consumers.** A semantic model can also be consumed by:
- Analyze in Excel workbooks (.xlsx live connections)
- Composite models (other semantic models chaining via DirectQuery)
- Explorations (ad-hoc visual explorations in the Power BI service)
- Fabric notebooks (connecting via Spark or sempy)
- Fabric data agents
- Paginated reports (.rdl)
- Dataflows referencing the model
- Third-party tools connecting via XMLA

The script only discovers Power BI reports. For full dependency mapping including these other item types, use the Fabric lineage APIs (`fab api "admin/groups/{id}/lineage"`) or the lineage view in the Power BI service UI.

**Not appropriate for many models at once.** The script scans all accessible workspaces per invocation. Running it in a loop over dozens of semantic models will generate excessive API calls and risk throttling. For bulk lineage analysis across many models, use the admin scan APIs (`admin/workspaces/getInfo`) or the DataHub search script instead.

## Interpreting Results

| Field | Meaning |
|-------|---------|
| Report format `PBIR` | Modern format, editable as JSON |
| Report format `PBIRLegacy` | Legacy format, needs conversion to PBIR for direct editing |
| Reports in unexpected workspaces | May indicate copies, forks, or thin reports pointing at a shared model |
| Many downstream reports | High-impact model -- changes require coordination |

## Related Skills

- **`review-semantic-model`** -- Audit model quality, memory, DAX, design
- **`refreshing-semantic-model`** -- Trigger and monitor model refreshes
- **`fabric-cli`** (fabric-cli plugin) -- Workspace and item management via `fab` CLI
