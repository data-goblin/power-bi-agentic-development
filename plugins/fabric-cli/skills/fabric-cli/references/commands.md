# fab commands: what `--help` does not say

Flags and examples live in `fab <command> --help` (check there first; fab 1.7.0 is installed). This file keeps only behaviour the help omits. Item types: run `fab desc` for the element types and `fab desc .<ItemType>` for the commands one supports.

## Learn

```yaml
fab docs: https://microsoft.github.io/fabric-cli/
settings: https://microsoft.github.io/fabric-cli/essentials/settings/
environment variables: https://microsoft.github.io/fabric-cli/essentials/env_vars/
release notes: https://microsoft.github.io/fabric-cli/release-notes
item recovery: https://learn.microsoft.com/en-us/fabric/admin/recycle-bin
```

## Versions

```yaml
1.7.0: installed; bulk-export, deploy --bulk_publish, job run and job start return the job id as a structured field
1.8.0: Ontology and GraphModel items; Azure CLI auth source; fish completion; Python 3.14
1.9.0: Plan, OrgApp, OrgAppAudience, WarehouseSnapshot and more item types; --json shorthand; job start --wait/--timeout/--polling_interval; faster LRO polling
```

- `fab job start` in 1.7.0 is async only; `fab job run` is the synchronous form (`--timeout`, `--polling_interval`)
- Interactive mode (`fab` with no arguments, or `fab config set mode interactive`) breaks scripted I/O; use one-shot calls in automation

## rm and recovery

`fab rm` is permanent unless the tenant has Fabric item recovery on (tenant setting `ConfigureArtifactRetentionPeriod`, 7 to 90 days; see [admin.md](./admin.md)). With it on, deleted items go to the workspace recycle bin. `--hard` (items only) always deletes permanently and bypasses the bin; use it only after explicit confirmation. Workspace deletion follows the separate workspace retention setting.

```bash
fab api "workspaces/$WS/recoverableItems"
fab api -X post "workspaces/$WS/recoverableItems/$ITEM/recover"
fab api -X delete "workspaces/$WS/recoverableItems/$ITEM"
```

Recover needs Contributor or above; the permanent delete needs workspace Admin. Consequences of enabling recovery:

- Deleted items keep billing OneLake storage for the retention window and may consume small amounts of capacity
- Re-creating an item with the same display name right after `fab rm` fails with `ItemDisplayNameNotAvailableYet` for several minutes
- Folders cannot be deleted while they hold soft-deleted items
- Shared item permissions are not restored; re-share
- `Microsoft.Fabric.ItemDeleteSucceeded` events fire only on permanent delete
- Git sync or deployment pipelines can re-create a soft-deleted item as an empty definition-only shell
- Warehouse snapshots do not come back with a recovered warehouse
- Recovery fails if a same-name item exists; rename it and retry, restoring dependencies first

## ln (shortcuts)

- The path must end in `.Shortcut`; `--type` is oneLake, adlsGen2, amazonS3, googleCloudStorage, dataverse or s3Compatible
- Internal shortcuts need `--target` (relative OneLake path); external ones need `-i` JSON with the location subpath and connection GUID
- Deleting a shortcut removes the reference, never the target data
- Details: [lakehouses.md](./lakehouses.md)

## config

```yaml
mode: command_line or interactive
default_capacity: capacity used by mkdir when none is given (for example Trial-0000)
output_format: text (default) or json
show_hidden: list capacities, connections, domains and gateways in fab ls without -a
folder_listing_enabled: recursive ls
local_definition_labels: path to the sensitivity-label JSON (see below)
job_cancel_ontimeout: true by default; cancels a job run that exceeds --timeout
context_persistence_enabled: keep the cd context across invocations
encryption_fallback_enabled: store tokens in plain text when secure storage is missing; leave off
default_az_subscription_id, default_az_resource_group, default_az_location, default_az_admin: defaults for capacity creation
```

Stale cache: `fab config clear-cache`.

## Sensitivity labels

```bash
fab config set local_definition_labels /path/to/labels.json
fab label list-local
fab label set "ws.Workspace/Sales.Report" -n "Confidential" -f
fab label rm "ws.Workspace/Sales.Report" -f
```

`label set` resolves `-n` against the local file, so configure it first; Unverified: the JSON schema of the labels file (not in `--help`). `fab get`, `fab export` and `fab bulk-export` with `-f` return definitions without the label.

## Authentication

```yaml
interactive: fab auth login, then choose the browser flow
service principal secret: fab auth login -u <client_id> -p <secret> --tenant <tenant_id>
service principal certificate: fab auth login -u <client_id> --certificate <pem> --tenant <tenant_id>
federated token: fab auth login -u <client_id> --federated-token <token> --tenant <tenant_id>
managed identity: fab auth login --identity (user-assigned: add -u <client_id>)
environment SPN: FAB_SPN_CLIENT_ID plus FAB_SPN_CLIENT_SECRET (or FAB_SPN_CERT_PATH, FAB_SPN_FEDERATED_TOKEN) plus FAB_TENANT_ID; FAB_MANAGED_IDENTITY=true for managed identity
environment tokens: FAB_TOKEN, FAB_TOKEN_ONELAKE, FAB_TOKEN_AZURE and FAB_TENANT_ID, all four, same principal and tenant; ignored under SPN, managed identity or Azure CLI auth; you refresh them
Azure CLI: auth source since fab 1.8.0
```

- One method at a time; SPN setup and a non-destructive test: [service-principals.md](./service-principals.md); `fab auth status` shows the principal

## -f policy

- Pass `-f` in every non-interactive call (`import`, `cp`, `mv`, `rm`, `assign`, `ln`, `acl set`, `label set`); without it the prompt hangs when stdin is not a terminal
- `-f` also runs deletes unattended, so check the path with `fab exists` before any `fab rm ... -f`; on `get` and `export` it also drops the sensitivity label
