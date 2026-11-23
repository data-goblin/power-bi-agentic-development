# fab versus az

`fab` manages the Fabric data plane; `az` manages the Azure infrastructure plane around it. Overlap is small.

## Learn

```yaml
az fabric capacity (microsoft-fabric extension): https://learn.microsoft.com/en-us/cli/azure/fabric/capacity
capacity ARM resource: https://learn.microsoft.com/en-us/rest/api/microsoftfabric/fabric-capacities
Private Link: https://learn.microsoft.com/en-us/fabric/security/security-private-links-overview
customer-managed keys: https://learn.microsoft.com/en-us/fabric/security/workspace-customer-managed-keys
workspace identity and Key Vault: https://learn.microsoft.com/en-us/fabric/security/workspace-identity
```

## Which tool

```yaml
list workspaces and items: fab
deploy semantic models, reports, notebooks: fab (import, cp, the deploy subcommand)
run jobs and schedules: fab job
DAX, refresh, REST calls: fab api
workspace, connection and gateway permissions: fab acl
create, scale (change SKU) or delete a capacity: az fabric capacity create, update, delete (ARM resource Microsoft.Fabric/capacities)
pause and resume a capacity: az fabric capacity suspend and resume, or fab stop and fab start on .capacities/<name>.Capacity
assign a capacity or domain to a workspace: fab assign
Private Link, VNet data gateway subnet, NSG service tags: az
Key Vault access and RBAC: az
Log Analytics and Azure Monitor for Spark: az
Event Hubs for streaming: az
cost, reservations and capacity tags: az
customer-managed keys: az (key side) plus the Fabric workspace setting
Entra app registrations and service principals: az ad (see service-principals.md)
```

- `az fabric` needs the `microsoft-fabric` extension (`az extension add --name microsoft-fabric`, az 2.61.0 or later) and `az provider register --namespace Microsoft.Fabric` once
- Create a capacity: `az fabric capacity create --resource-group <rg> --capacity-name <name> --administration "{members:[admin@contoso.com]}" --sku "{name:F64,tier:Fabric}" --location <region>`
- Suspend stops billing at once and the content is unavailable while paused; `--no-wait` plus `az fabric capacity wait` for async
- IaC: Bicep `br/public:avm/res/fabric/capacity`, Terraform AzAPI `Microsoft.Fabric/capacities`, PowerShell `New-AzFabricCapacity`
- Capacity ARM permissions: `Microsoft.Fabric/capacities/read`, `write`, `suspend/action`, `resume/action`, `delete`
- `fab api -A azure` reaches ARM with fab's token for read calls such as `subscriptions/<id>/providers/Microsoft.Fabric/capacities?api-version=2023-11-01`; use `az` for anything that changes Azure resources

## Azure CLI as an auth source for fab

Since fab 1.8.0 (release notes, October 2026) the Azure CLI is a supported authentication source, so an existing `az login` session can back `fab`. On older versions, use fab's own login. Select it by passing the --azure-cli flag to the login command (it takes the tenant from the `az` session, so `--tenant` cannot be combined; [auth command](https://microsoft.github.io/fabric-cli/commands/auth/)). fab 1.7.0 (installed here) predates it, so keep a separate `fab auth login` there. Environment-variable tokens (`FAB_TOKEN` and friends) are ignored when Azure CLI authentication is in use.
