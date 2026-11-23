# fab api

Raw REST through `fab api`, with the CLI's auth and envelope. Use a native command first (`fab acl`, `fab assign`, `fab start`, `fab stop`, `fab label`, `fab ls -q`); reach for `fab api` for what they do not cover.

## Learn

```yaml
Fabric REST: https://learn.microsoft.com/en-us/rest/api/fabric/articles/
Power BI REST: https://learn.microsoft.com/en-us/rest/api/power-bi/
OneLake API: https://learn.microsoft.com/en-us/fabric/onelake/onelake-access-api
Azure Resource Manager (Fabric capacities): https://learn.microsoft.com/en-us/rest/api/microsoftfabric/fabric-capacities
long-running operations: https://learn.microsoft.com/en-us/rest/api/fabric/articles/long-running-operation
throttling: https://learn.microsoft.com/en-us/rest/api/fabric/articles/throttling
```

## Flags

```yaml
-X: HTTP method, default get
-i: request body, inline JSON or a file path
-A: audience, fabric (default) | powerbi | storage | azure
-P: query parameters as key=value,key=value
-H: extra headers as key=value,key=value
-q: JMESPath filter
--show_headers: include response headers (needed for Location and x-ms-operation-id)
```

There is no `-o`: redirect with shell `>`. `fab ls` has only `-l`, `-a`, `-q`.

```yaml
fabric: https://api.fabric.microsoft.com/v1, items, workspaces, jobs, deployment pipelines, tenant admin
powerbi: https://api.powerbi.com/v1.0/myorg, datasets, reports, groups, gateways, admin/capacities, admin/groups, executeQueries, refreshes
storage: OneLake DFS (https://onelake.dfs.fabric.microsoft.com)
azure: https://management.azure.com (ARM; capacities as Microsoft.Fabric/capacities)
```

- The same logical operation often exists on both Fabric and Power BI with different shapes; pick one surface per workflow
- Endpoints are relative; `workspaces` not `/v1/workspaces`

## The response envelope

`fab api` returns `{status_code, text}` (plus `headers` with `--show_headers`). `-q` runs against that envelope, so response fields need the `text.` prefix; a path without it returns nothing:

```bash
fab api workspaces -q "text.value[?type=='Workspace'].displayName"
fab api "workspaces/$WS/items" -q "text.value[?type=='Lakehouse'].{name:displayName,id:id}"
fab api admin/tenantsettings -q status_code
```

`fab get -q` is different: it is applied to the item itself (`fab get "ws.Workspace" -q id`), prints the bare value, and needs no `tr -d '"'`.

## Calls that return 202

Creates, definition updates, deploys and refreshes are long-running.

```bash
fab api -X post "workspaces/$WS/semanticModels/$MODEL/updateDefinition" -i update.json --show_headers
fab api "operations/<id-from-Location>" -q "text.status"
fab api "operations/<id>/result"
```

- The id is in the `Location` or `x-ms-operation-id` header; poll until `Succeeded` or `Failed`
- Honour `Retry-After` on 429
- Results expire (24 hours for deployment operations)
- An empty-body 202 can surface `[UnexpectedError] Expecting value: line 1 column 1 (char 0)` from the JSON parser; the operation still ran, so verify with a read

## Shell gotchas

- Quote `$top`: `fab api -A powerbi 'admin/groups?$top=100'`; percent-encode `$` as `%24` inside double quotes (`?%24top=50`)
- Page by following `continuationUri` or `continuationToken` (Fabric) or `@odata.nextLink` (Power BI); the next call takes the URL as given
- Use `-P` for query parameters with commas-free values; values with commas or quotes (activity-event dates) go in the endpoint string
- For JSON bodies with quotes, write the body to a file and pass `-i file.json`
- Pass IDs between calls with `$(fab get "ws.Workspace/Item.Type" -q id)`

## Common endpoints

```yaml
capacities (Fabric): GET capacities (id, displayName, sku, region, state); pause and resume natively with fab stop and fab start
gateways (powerbi): gateways, gateways/<id>/datasources, gateways/<id>/users; permissions via fab acl on .gateways/
domains: admin/domains, admin/domains/<id>/workspaces, POST admin/domains/<id>/assignWorkspaces {"workspacesIds": [...]}; natively fab assign .domains/<name>.Domain -W ws.Workspace
workspace apps (powerbi): apps, apps/<id>, apps/<id>/reports, apps/<id>/dashboards
Gen1 dataflows (powerbi): groups/<ws>/dataflows; Gen2 dataflows are Fabric items
tenant items (Fabric): admin/items
risky sharing (powerbi): admin/widelySharedArtifacts/linksSharedToWholeOrganization, admin/widelySharedArtifacts/publishedToWeb
```

- Pipelines, admin audits, scanner and activity events: [deployment-pipelines.md](./deployment-pipelines.md) and [admin.md](./admin.md)
- Dataflows, gateways, org apps and workspaces: [../../../wiki/dataflows.md](../../../wiki/dataflows.md), [../../../wiki/gateways.md](../../../wiki/gateways.md), [../../../wiki/org-apps.md](../../../wiki/org-apps.md), [../../../wiki/workspaces.md](../../../wiki/workspaces.md)
- Capacity pause through `az resource update ... --set properties.state=Paused` is the ARM route; see [fab-vs-az.md](./fab-vs-az.md)
