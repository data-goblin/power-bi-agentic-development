# fab CLI vs az CLI for Fabric Administrators

The `fab` CLI and `az` CLI serve different layers of the same platform. They are complementary with essentially zero overlap.

- **`fab` CLI** -- Fabric data plane. Manages workspaces, items (semantic models, reports, notebooks, pipelines), jobs, deployments, and Fabric-internal operations.
- **`az` CLI** -- Azure infrastructure plane. Manages the capacity resource, networking, monitoring, identity, billing, and all Azure services that Fabric integrates with.

## When to Use Which

| Task | Tool | Why |
|------|------|-----|
| List workspaces and items | `fab` | Fabric data plane |
| Deploy semantic models or reports | `fab` | Fabric data plane |
| Run DAX queries or refresh models | `fab` | Power BI REST API via `fab api` |
| Create or delete a Fabric capacity | `az` | Capacity is an ARM resource |
| Pause/resume a capacity | `az` (or `fab start/stop`) | ARM lifecycle operation; `fab start/stop .capacities/` also works |
| Scale a capacity (change SKU) | `az` | ARM resource update |
| Set up Private Link / VNet | `az` | Pure Azure networking |
| Create VNet data gateway subnet | `az` | Azure VNet delegation |
| Configure Key Vault access | `az` | Azure RBAC / Key Vault policy |
| Set up Log Analytics for Spark | `az` | Azure Monitor resources |
| Create Event Hubs for streaming | `az` | Azure messaging resource |
| Manage cost and reservations | `az` | Azure Cost Management |
| Tag capacities for cost allocation | `az` | ARM resource tagging |
| Assign workspace permissions | `fab` | Fabric data plane (`fab acl`) |
| Manage gateway datasource users | `fab` | `fab api -A powerbi` or `fab acl` |

---

## Fabric Capacity as an Azure Resource

Fabric capacities are standard ARM resources under `Microsoft.Fabric/capacities`. The `az fabric capacity` commands (from the `microsoft-fabric` extension) handle the full lifecycle.

### Prerequisites

```bash
# Install the Fabric extension (requires az CLI >= 2.61.0)
az extension add --name microsoft-fabric

# Register the resource provider (first time only)
az provider register --namespace Microsoft.Fabric
```

### Capacity CRUD

```bash
# Create a capacity
az fabric capacity create \
  --resource-group FabricRG \
  --capacity-name prod-f64 \
  --administration "{members:[admin@contoso.com]}" \
  --sku "{name:F64,tier:Fabric}" \
  --location westeurope

# Show capacity details
az fabric capacity show --resource-group FabricRG --capacity-name prod-f64

# List all capacities in subscription
az fabric capacity list

# List capacities in a resource group
az fabric capacity list --resource-group FabricRG

# Update capacity (scale SKU or change admins)
az fabric capacity update \
  --resource-group FabricRG \
  --capacity-name prod-f64 \
  --sku "{name:F128,tier:Fabric}"

# Delete a capacity
az fabric capacity delete --resource-group FabricRG --capacity-name prod-f64

# List eligible SKUs
az fabric capacity list-skus

# Check name availability
az fabric capacity check-name-availability \
  --location westeurope \
  --name prod-f64 \
  --type Microsoft.Fabric/capacities
```

### Capacity Suspend / Resume

Pausing a capacity stops billing immediately. Content becomes unavailable while paused.

```bash
# Pause (suspend)
az fabric capacity suspend --resource-group FabricRG --capacity-name prod-f64

# Resume
az fabric capacity resume --resource-group FabricRG --capacity-name prod-f64

# Async with polling
az fabric capacity suspend --resource-group FabricRG --capacity-name prod-f64 --no-wait
az fabric capacity wait --resource-group FabricRG --capacity-name prod-f64 \
  --custom "provisioningState=='Paused'"
```

**fab CLI alternative:** `fab start/stop .capacities/prod-f64.Capacity` also works for pause/resume but cannot create, scale, or delete capacities.

### RBAC for Capacity Management

| Action | Permission |
|--------|-----------|
| View capacity | `Microsoft.Fabric/capacities/read` |
| Create/update | `Microsoft.Fabric/capacities/write` |
| Pause | `Microsoft.Fabric/capacities/suspend/action` |
| Resume | `Microsoft.Fabric/capacities/resume/action` |
| Delete | `Microsoft.Fabric/capacities/delete` |

### IaC Support

Fabric capacities can be provisioned via:
- **Bicep:** `br/public:avm/res/fabric/capacity` (Azure Verified Module)
- **Terraform:** AzAPI provider with `Microsoft.Fabric/capacities@2023-11-01`
- **ARM Templates:** standard deployment
- **PowerShell:** `New-AzFabricCapacity`, `Suspend-AzFabricCapacity`, `Resume-AzFabricCapacity`

---

## Private Networking

Fabric supports multiple networking models, all managed on the Azure side.

### Private Link for Fabric

Two levels of private link exist:

| Level | Resource Type | Scope |
|-------|--------------|-------|
| Tenant-level | `Microsoft.PowerBI/privateLinkServicesForPowerBI` | All workspaces in tenant |
| Workspace-level | `Microsoft.Fabric/privateLinkServicesForFabric` | Individual workspaces |

Tenant-level private links enforce that ALL traffic goes through private endpoints. Workspace-level allows selective enforcement.

**Setup workflow:**

1. Enable "Azure Private Link" in Fabric Admin Portal > Tenant Settings
2. Create Azure resources:

```bash
# Create VNet and subnet
az network vnet create \
  --name fabric-vnet \
  --resource-group FabricRG \
  --location westeurope \
  --subnet-name pe-subnet

# Create private endpoint
az network private-endpoint create \
  --name fabric-pe \
  --resource-group FabricRG \
  --vnet-name fabric-vnet \
  --subnet pe-subnet \
  --private-connection-resource-id <power-bi-resource-id> \
  --group-id Tenant \
  --connection-name fabric-pe-conn

# Create required DNS zones
for zone in privatelink.analysis.windows.net \
            privatelink.pbidedicated.windows.net \
            privatelink.prod.powerquery.microsoft.com; do
  az network private-dns zone create --resource-group FabricRG --name $zone
  az network private-dns link vnet create \
    --resource-group FabricRG \
    --zone-name $zone \
    --name fabric-dns-link \
    --virtual-network fabric-vnet \
    --registration-enabled false
done
```

**Considerations:**
- After enabling tenant-level PL, all traffic must go through private network
- On-premises access requires ExpressRoute or site-to-site VPN
- Performance impact for users distant from the PE location

### VNet Data Gateway

A Microsoft-managed gateway injected into a customer VNet. Requires subnet delegation.

```bash
# Create and delegate subnet for VNet data gateway
az network vnet subnet create \
  --name gw-subnet \
  --vnet-name fabric-vnet \
  --resource-group FabricRG \
  --address-prefixes 10.0.1.0/24 \
  --delegations Microsoft.PowerPlatform/vnetaccesslinks
```

Gateway creation and management is done via Fabric portal (Manage Connections and Gateways) or Power Platform admin center -- not via CLI.

### Managed VNets and Managed Private Endpoints

For Spark workloads, Fabric creates managed VNets per workspace. Outbound connections to data sources can use Managed Private Endpoints (MPEs).

- MPE creation: Fabric portal > Workspace Settings > Networking
- Data source owner approves the PE in Azure Portal
- Supports Data Engineering, Data Science, and Data Pipeline items

### Network Security Groups (Service Tags)

Simplify NSG rules using Azure service tags instead of IP ranges:

```bash
az network nsg rule create \
  --nsg-name fabric-nsg \
  --resource-group FabricRG \
  --name AllowFabricOutbound \
  --priority 100 \
  --source-address-prefixes VirtualNetwork \
  --destination-service-tag DataFactory PowerBI \
  --destination-port-ranges 443 \
  --access Allow \
  --direction Outbound
```

---

## Azure Key Vault Integration

Fabric does not have a native Key Vault linked service (unlike Azure Data Factory). Access Key Vault from Fabric using workspace identity or service principal credentials.

### Grant Workspace Identity Access to Key Vault

After enabling workspace identity in Fabric portal:

```bash
# With Key Vault access policy model
az keyvault set-policy \
  --name MyKeyVault \
  --spn <workspace-identity-app-id> \
  --secret-permissions get list

# With Azure RBAC model (recommended)
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee <workspace-identity-object-id> \
  --scope /subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.KeyVault/vaults/MyKeyVault
```

### Access Key Vault from Fabric Notebooks

```python
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient

credential = DefaultAzureCredential()
client = SecretClient(vault_url="https://MyKeyVault.vault.azure.net", credential=credential)
secret = client.get_secret("my-connection-string")
```

Requires `azure-identity` and `azure-keyvault-secrets` packages installed in the Spark environment.

### Trusted Workspace Access to ADLS Gen2

Workspace identity enables firewall-bypassing access to storage accounts:

```bash
# Grant storage access to workspace identity
az role assignment create \
  --role "Storage Blob Data Contributor" \
  --assignee <workspace-identity-object-id> \
  --scope /subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.Storage/storageAccounts/MyStorage
```

Resource instance rules (configured via ARM template) control which Fabric workspaces can access firewall-enabled storage. Only F SKU capacities support trusted workspace access (not Trial).

---

## Azure Monitor and Log Analytics

### Stream Azure Diagnostics into Fabric

Fabric Real-Time Hub can ingest diagnostic logs from Azure resources:

1. Real-Time Hub > Data Sources > Azure Diagnostics
2. Select an Azure resource (e.g., SQL, Service Bus)
3. The wizard auto-creates: Event Hubs namespace + event hub, diagnostic setting on the source resource, Eventstream in Fabric, KQL database table

Manual setup via CLI:

```bash
# Create Event Hubs namespace
az eventhubs namespace create \
  --name fabric-diag-ns \
  --resource-group FabricRG \
  --location westeurope \
  --sku Standard

# Create event hub
az eventhubs eventhub create \
  --name fabric-diag \
  --namespace-name fabric-diag-ns \
  --resource-group FabricRG

# Create diagnostic setting on an Azure resource
az monitor diagnostic-settings create \
  --name FabricDiag \
  --resource <azure-resource-id> \
  --event-hub-name fabric-diag \
  --event-hub-rule <event-hub-auth-rule-id> \
  --logs '[{"category":"AllLogs","enabled":true}]'
```

### Stream Fabric Spark Logs to Log Analytics

For monitoring Spark workloads, use the Fabric diagnostic emitter extension:

```bash
# Create Log Analytics workspace
az monitor log-analytics workspace create \
  --resource-group FabricRG \
  --workspace-name FabricSparkMonitor \
  --location westeurope

# Get workspace ID and key (needed for DCE/DCR configuration)
az monitor log-analytics workspace show \
  --resource-group FabricRG \
  --workspace-name FabricSparkMonitor \
  --query "customerId"
```

The diagnostic emitter is configured via Spark session properties in Fabric notebooks or environment settings, pointing to a Data Collection Endpoint (DCE) and Data Collection Rule (DCR).

---

## Azure Event Hubs for Real-Time Intelligence

Event Hubs is the primary bridge between Azure streaming sources and Fabric Real-Time Intelligence.

```bash
# Create namespace and event hub
az eventhubs namespace create \
  --name streaming-ns \
  --resource-group FabricRG \
  --location westeurope \
  --sku Standard

az eventhubs eventhub create \
  --name telemetry \
  --namespace-name streaming-ns \
  --resource-group FabricRG \
  --partition-count 4

# Create SAS policy for Fabric
az eventhubs eventhub authorization-rule create \
  --name FabricListener \
  --namespace-name streaming-ns \
  --eventhub-name telemetry \
  --resource-group FabricRG \
  --rights Listen

# Get connection string
az eventhubs eventhub authorization-rule keys list \
  --name FabricListener \
  --namespace-name streaming-ns \
  --eventhub-name telemetry \
  --resource-group FabricRG \
  --query "primaryConnectionString" -o tsv
```

Connect to Fabric via Real-Time Hub, Eventstream source connector, or KQL Database direct ingestion.

For Event Hubs behind private networks, register the streaming VNet gateway resource provider:

```bash
az provider register --namespace Microsoft.MessagingConnectors
```

---

## Cost Management and Billing

Fabric usage appears in Azure Cost Management under the `Microsoft.Fabric/capacities` resource type.

### View Costs

```bash
# Tag capacity for cost allocation
az fabric capacity update \
  --resource-group FabricRG \
  --capacity-name prod-f64 \
  --tags "{CostCenter:Analytics,Environment:Production,Team:BI}"

# Query costs (requires Cost Management Reader role)
az costmanagement query \
  --type ActualCost \
  --timeframe MonthToDate \
  --dataset-filter "{dimensions:{name:ResourceType,operator:In,values:[Microsoft.Fabric/capacities]}}"
```

### Reservations

Purchase 1-year or 3-year Fabric capacity reservations for cost savings:
- Azure Portal > Reservations > Microsoft Fabric
- Buy by CU quantity (e.g., 64 CUs for an F64)
- Can exchange existing Synapse Analytics reserved capacity for Fabric reservations

### Cost Optimization Patterns

| Pattern | Implementation |
|---------|---------------|
| Pause during off-hours | `az fabric capacity suspend` on schedule (Azure Automation runbook) |
| Scale down off-peak | `az fabric capacity update --sku "{name:F8,tier:Fabric}"` |
| Reservations | 1yr/3yr commitment via Azure Portal |
| Tag for chargeback | `az fabric capacity update --tags` per team/project |
| Monitor usage | Fabric Capacity Metrics App + Azure Cost Management |

---

## Customer-Managed Keys (CMK / BYOK)

Fabric encrypts all data at rest with Microsoft-managed keys by default. For compliance requirements, enable customer-managed keys (CMK) using Azure Key Vault.

### Setup

1. Enable "Apply customer-managed keys" tenant setting in Fabric Admin Portal
2. Create a service principal for the `Fabric Platform CMK` app (App ID: `61d6811f-7544-4e75-a1e6-1c59c0383311`)
3. Configure Key Vault:

```bash
# Create Key Vault with required settings
az keyvault create \
  --name FabricCMKVault \
  --resource-group FabricRG \
  --location westeurope \
  --enable-soft-delete true \
  --enable-purge-protection true

# Create RSA key (2048, 3072, or 4096 bit)
az keyvault key create \
  --vault-name FabricCMKVault \
  --name fabric-encryption-key \
  --kty RSA \
  --size 3072

# Grant Fabric Platform CMK app access
az role assignment create \
  --role "Key Vault Crypto Service Encryption User" \
  --assignee <fabric-platform-cmk-sp-object-id> \
  --scope /subscriptions/<sub>/resourceGroups/FabricRG/providers/Microsoft.KeyVault/vaults/FabricCMKVault
```

4. In Fabric workspace settings > Encryption, enable CMK and paste the key identifier

### Key Requirements
- Key Vault must have soft-delete and purge protection enabled
- Key must be RSA or RSA-HSM (2048/3072/4096 bit; 4096 not supported for SQL Database in Fabric)
- Fabric uses **versionless** key identifiers (checks daily for new versions)
- Firewall-enabled Key Vaults supported via "Allow Trusted Microsoft Services" bypass
- Revoking the key blocks all read/write to the workspace within 60 minutes

---

## Git Integration and CI/CD (Azure DevOps / GitHub)

Fabric workspaces connect to Git repositories (Azure DevOps or GitHub) for version control and CI/CD. This integration is managed via Fabric REST APIs and portal, but relies on Azure DevOps/GitHub infrastructure.

### Azure DevOps Integration

```bash
# The fabric-cicd Python package handles deployments
pip install fabric-cicd

# Store service principal credentials in Key Vault
az keyvault secret set --vault-name FabricCMKVault --name "fabric-sp-client-id" --value "<client-id>"
az keyvault secret set --vault-name FabricCMKVault --name "fabric-sp-secret" --value "<client-secret>"
```

**Fabric Git REST APIs** (via `fab api`):
- Connect workspace to repo: `fab api -X post "workspaces/<ws-id>/git/connect"`
- Get git status: `fab api "workspaces/<ws-id>/git/status"`
- Commit to git: `fab api -X post "workspaces/<ws-id>/git/commitToGit"`
- Update from git: `fab api -X post "workspaces/<ws-id>/git/updateFromGit"`
- Initialize connection: `fab api -X post "workspaces/<ws-id>/git/initializeConnection"`

### CI/CD Pipeline Pattern

| Component | Tool |
|-----------|------|
| Source control | Azure DevOps / GitHub (Git) |
| Credential storage | Azure Key Vault |
| Pipeline execution | Azure DevOps YAML / GitHub Actions |
| Deployment | `fabric-cicd` Python package or Fabric Deployment Pipelines |
| Environment promotion | Fabric Deployment Pipelines (`fab api "deploymentPipelines/..."`) |

Only the `dev` branch typically connects to a Fabric workspace. Test and prod branches serve as deployment records; actual promotion uses Fabric Deployment Pipelines.

---

## Microsoft Purview Integration

Fabric integrates with Microsoft Purview for unified data governance, cataloging, and compliance.

- Purview scans Fabric workspaces and OneLake for metadata, lineage, and classification
- Sensitivity labels from Purview apply across Fabric items
- Data quality checks and profiling via Purview's Unified Catalog
- Authentication for scans uses Entra ID service principals

Purview is managed through the Purview portal and Azure CLI (`az purview`), not through `fab` CLI. Enable Fabric tenant settings to allow read-only API access for Purview scanning.

---

## Responsibility Matrix

| Domain | `az` CLI | `fab` CLI | Fabric Portal |
|--------|----------|-----------|---------------|
| Capacity CRUD | create, show, update, delete, list | -- | View/link |
| Capacity lifecycle | suspend, resume, scale | start/stop (pause/resume only) | Pause/Resume buttons |
| Capacity RBAC | role assignment | -- | -- |
| VNet / subnet / NSG | Full control | -- | -- |
| Private endpoints | create, approve, DNS zones | -- | Enable tenant setting |
| Managed Private Endpoints | -- | -- | Create/approve |
| VNet Data Gateway | Subnet delegation | `fab acl` for permissions | Gateway creation/mgmt |
| Key Vault | create, set-policy, key/secret mgmt | -- | -- |
| Customer-Managed Keys | Key Vault + RBAC setup | -- | Enable CMK in workspace settings |
| Storage account RBAC | role assignment | -- | -- |
| Event Hubs | Full control | -- | Connection setup via UI |
| Log Analytics | Full control | -- | -- |
| Diagnostic settings | Full control | -- | Real-Time Hub wizard |
| Cost Management | Queries, budgets, tags, reservations | -- | Cost analysis UI |
| Git / CI/CD | Azure DevOps infra, Key Vault for creds | `fab api` for git connect/commit/update | Workspace git settings |
| Purview governance | `az purview` for scans | -- | Enable tenant settings |
| Workspaces and items | -- | Full control | Full control |
| Workspace permissions | -- | `fab acl` | Manage access UI |
| Deployments | -- | `fab api` for deployment pipelines | Pipeline UI |
| Jobs and refresh | -- | `fab job`, `fab api` | UI triggers |

### Key Principle

The `az` CLI manages Azure infrastructure: capacity resources, networking, monitoring, identity RBAC, and billing. The `fab` CLI manages Fabric content: workspaces, items, deployments, jobs, and permissions. They are complementary tools serving different layers of the same platform with minimal overlap. The only shared surface is capacity pause/resume (`az fabric capacity suspend/resume` and `fab start/stop .capacities/`).
