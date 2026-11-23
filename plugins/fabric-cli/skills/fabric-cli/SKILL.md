---
name: fabric-cli
description: "Operate the Fabric and Power BI service from the terminal with `fab` and `fab api` (workspaces, items, jobs, export/import, capacities, OneLake, admin REST), and estimate the capacity units an operation will cost before running it. Use for cloud items, not for local PBIP/TMDL/PBIR files."
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/hooks/fab-guard.sh"
---

# Fabric CLI (`fab`)

`fab` works on the cloud service only, with a Power BI Pro, PPU or Fabric account; a Fabric capacity is not required. It is installed with `uv tool install ms-fabric-cli`. Use `fab <command> --help` for syntax and `fab desc .<ItemType>` (or a path) for the commands an item type supports; an unknown element such as `fab desc .x` prints the list of valid item types; this skill holds only what the help does not say.

## Rules

- Run `fab auth status` first; if unauthenticated, ask the user to run `fab auth login`
- Read `fab <command> --help` the first time you use a command. Never write a flag you have not seen there
- Ask when a workspace or item name is unclear, then confirm with `fab exists` or `fab ls`
- Never move, delete, rename, assign or change properties without the user's explicit direction. A command blocked by permissions is a stop sign, not something to route around
- CU gate: before anything that consumes capacity (creating items, running notebooks, pipelines or refreshes, large queries, Copilot, scheduled work, preview items such as Plan, Ontology, Graph), estimate the CU-hours and the effect on the capacity. Get explicit approval when the charge is flat or per session, exceeds a quarter of the capacity's daily CU-hours, recurs, cannot be estimated, or the capacity already throttles. Naming a feature is not consent to its cost. Method: [capacity-cost.md](./references/capacity-cost.md)
- `-f` skips prompts that would hang a non-interactive run (`get -q definition`, `export`, `import`, `cp`, `rm`, `assign`, `mv`). Ask the user first when sensitivity labels are in play: `-f` exports without the label
- `fab rm` is permanent unless the tenant has Fabric item recovery on; `rm --hard` (items only) is always permanent. Confirm the exact path with the user first
- No item-level ACL: `fab acl` works on workspaces, connections and gateways only (`acl ls` on a SemanticModel returns `[UnsupportedCommand]`). `acl set -I` takes an Entra objectId, not a UPN (`acl rm` accepts a UPN); workspace roles are Admin, Member, Contributor, Viewer; there is no `Read` role. Item sharing goes through the REST API ([permissions.md](./references/permissions.md))
- `fab api -q` queries the envelope `{status_code, text}` (start with `text.`); `fab get -q` queries the item. `fab api` has no `-o`
- `fab export` does not create parent directories; `mkdir -p` the target first or it fails with `[InvalidPath]`
- Do not write `.claude/rules` files or other memory unasked
- While this skill is active, `hooks/fab-guard.sh` asks before fab commands that change the tenant or consume capacity and denies invocations known to fail (`fab api -o`, `fab desc all`, `fab acl` on an item). It needs `jq` and says so on stderr when it is missing

## Versions

Installed here: fab 1.7.0; PyPI had 1.9.0 on 2026-11-04. Check `fab --version` and upgrade with `uv tool upgrade ms-fabric-cli` unless the user pinned a version. Release notes: https://microsoft.github.io/fabric-cli/release-notes

```yaml
1.7.0: bulk-export (folder structure and bindings kept; --recursive required for a workspace or folder), config-file deploy subcommand
1.8.0: Ontology and GraphModel items, Azure CLI as an auth source
1.9.0: Plan, WarehouseSnapshot and more item types, --json, job start --wait/--timeout/--polling_interval, faster LRO polling
```

An item type missing from the `fab desc` element list (Plan, Ontology, GraphModel on 1.7.0) means the installed fab is too old for it.

## Paths, auth, output

- Paths: `"Workspace Name.Workspace/Item Name.ItemType"`; quote them when they hold spaces or punctuation. Lakehouse data: `ws.Workspace/LH.Lakehouse/Tables/<schema>/<table>` and `.../Files/<file>`. Capacities: `fab ls .capacities` (names end in `.Capacity`)
- `--output_format json` works on every command and wraps the result in `{status, command, result.data}`
- API audiences (`fab api -A`): `fabric` (default), `powerbi`, `storage`, `azure`. Power BI endpoints (`groups/<ws>/datasets/...`, `admin/capacities`) need `-A powerbi`
- `fab get ".capacities/<name>.Capacity" -q properties.state` prints `Active` or `Paused` followed by `\r`; strip it before comparing. `fab ls .capacities -l` shows `Inactive` for a paused one

## Task map

```yaml
find an item across workspaces: fab find 'sales' -P type=Report -l        # governance fields: scripts/search_across_workspaces.py
inspect an item: fab get "ws.Workspace/Model.SemanticModel" -q definition -f
list data: fab ls "ws.Workspace/LH.Lakehouse/Tables"; fab table schema "<path>"
query data: scripts below (they resolve ids, hosts and auth); route priority in querying-data.md
refresh a model: fab api -A powerbi "groups/<ws-id>/datasets/<model-id>/refreshes" -X post -i '{"type":"Full"}'   # 409 while one runs; costs CU
run a notebook or pipeline: fab job run | fab job start; check the real outcome (see gotchas)
export/import: fab export | fab import | fab cp; whole workspace with folders: fab bulk-export "ws.Workspace" -o ./out --recursive
promote dev to prod: deployment-pipelines.md (pipelines API, or the config-file deploy subcommand)
service principal for automation: service-principals.md
```

## Gotchas

- A job `Completed` only means the process finished. A notebook can catch its own exception and exit a failure payload; read the exit value or run `scripts/run_notebook_checked.py` ([notebooks.md](./references/notebooks.md))
- Creating or updating a definition is a long-running operation (202 plus `Retry-After`). On fab 1.7.0 `import` took 25-60s for a notebook the server finished in about 1s because of the poll cadence; `scripts/deploy_notebook.py` polls every 0.3s. Re-measure on 1.9.0 before relying on this, since its LRO polling was improved
- `fab ls` browses workspaces, items and lakehouse or warehouse data; on other items read the definition with `fab get`
- `fab api` is for operations no command covers. Admin endpoints need the admin role; admin writes: 25 per minute, honour `Retry-After` on 429, print the exact command and wait for approval
- Never put a secret in an argument, file or echoed variable; see [service-principals.md](./references/service-principals.md) and [fab-vs-az.md](./references/fab-vs-az.md)
- Spark runtime: 2.0 is GA (Spark 4.1, Python 3.13); 1.3 is end-of-support-announced; 1.2 is retired

## Scripts

Run with `uv run ${CLAUDE_SKILL_DIR}/scripts/<name>.py --help`; they reuse `fab` and `az login`. Usage: [scripts/README.md](./scripts/README.md).

```yaml
execute_dax.py: DAX against a semantic model (table, csv, json)
query_sql_endpoint.py: T-SQL on a lakehouse SQL endpoint, warehouse or SQL database via sqlcmd
query_sql_mcp.py: the same over the hosted Fabric SQL endpoint with a bearer token; not exercised in this audit
query_lakehouse_duckdb.py: Delta over OneLake with DuckDB (needs the duckdb CLI)
create_direct_lake_model.py: Direct Lake model from lakehouse tables
get_semantic_model_ai_metadata.py: AI instructions and schema of a model
get-downstream-reports.py: reports bound to a model, no admin needed
search_across_workspaces.py: last visit, refresh, owner, storage mode, capacity SKU across workspaces
download_workspace.py: full workspace with item definitions and lakehouse files
run_notebook_checked.py: run a notebook and verify its exit value
deploy_notebook.py: create or update a notebook definition with tight LRO polling
task_flow.py: workspace task flows through internal endpoints (no public API)
```

## References

```yaml
capacity-cost.md: SKU budgets, smoothing, throttling, carry forward, known flat charges
commands.md: rm recovery, shortcuts, config keys, labels, auth modes
admin.md: admin REST, tenant settings, overrides (tenant audits: fabric-admin plugin)
permissions.md: workspace roles, item sharing through REST, ACL exposure audits
notebooks.md: job runs, exit value, scheduling, Livy and kernels
semantic-models.md: refresh, enhanced refresh, storage mode, rebinding
reports.md: export, import, rebinding a thin report
deployment-pipelines.md: pipelines API, deploy subcommand, bulk-export
import-download-deploy.md: export, import, copy, PBIP round trips
querying-data.md: DAX, T-SQL, DuckDB route priority and OneLake paths
lakehouses.md, warehouses.md, sql-databases.md: item-specific gotchas
fab-api.md: capacities, domains and other REST patterns
service-principals.md: SPN setup and authenticating fab as one
fab-vs-az.md: when az CLI is the right tool
```

Wiki pages (Learn links plus gotchas): [workspaces](../../wiki/workspaces.md), [folders](../../wiki/folders.md), [tags](../../wiki/tags.md), [connections](../../wiki/connections.md), [gateways](../../wiki/gateways.md), [dataflows](../../wiki/dataflows.md), [paginated reports](../../wiki/paginated-reports.md), [dashboards](../../wiki/dashboards.md), [org apps](../../wiki/org-apps.md), [scorecards](../../wiki/scorecards.md).

Docs: https://microsoft.github.io/fabric-cli/ | https://learn.microsoft.com/en-us/rest/api/fabric/articles/ | https://learn.microsoft.com/en-us/rest/api/power-bi/
