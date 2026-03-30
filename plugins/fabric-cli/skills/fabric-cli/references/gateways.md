# Gateway Operations

Data gateways bridge cloud services (Fabric, Power BI, Power Platform) to on-premises and private-network data sources. Three gateway types exist:

## Gateway Types

| Type | Description | API Support | Recommendation |
|------|-------------|-------------|----------------|
| **On-premises data gateway (standard mode)** | Shared gateway installed on an always-on VM. Supports multiple users, DirectQuery, live connections, clustering, and all Power Platform services. Centrally managed by IT. | Full REST API (this document) | **Recommended for team, departmental, and enterprise use** |
| **Virtual network (VNet) data gateway** | Microsoft-managed gateway injected into an Azure VNet. No installation required. Connects to Azure data sources via private endpoints and service endpoints. Requires Premium/Fabric capacity (P, F, or A4+ SKUs). | No dedicated REST API; managed via Fabric portal or Power Platform admin center. `fab acl` works for permissions on VNet gateways. | **Recommended for Azure data sources behind VNets** |
| **On-premises data gateway (personal mode)** | Single-user gateway installed on a personal machine. Power BI only. Cannot be shared, no DirectQuery, no live connections, no clustering. | **No REST API support.** Cannot be managed programmatically. | **Avoid for anything beyond personal BI. Anti-pattern for team/enterprise scenarios.** |

### Personal Gateway Anti-Pattern

Personal gateways should be avoided in production or shared scenarios. They:
- Run on a user's machine (gateway goes offline when machine is off)
- Cannot be shared with other users
- Cannot be centrally managed, governed, or audited via API
- Support only Import mode (no DirectQuery, no live connections)
- Support only Power BI (no Power Apps, Power Automate, Logic Apps, or Fabric items)
- Have no REST API -- cannot be automated or monitored programmatically

If a personal gateway is discovered in an environment, migrate to a standard mode gateway on a centrally-managed VM or a VNet gateway. Personal gateway installation can be restricted at the tenant level via PowerShell (`Set-DataGatewayTenantPolicy`).

### VNet Gateway Notes

VNet gateways are managed through the Fabric portal (Manage Connections and Gateways) or Power Platform admin center, not via the REST API. Key characteristics:
- No software installation -- fully Microsoft-managed
- Connects to Azure data sources via private endpoints (no public exposure)
- Supports Fabric Dataflow Gen2, data pipelines, Copy Job, Mirroring, Power BI semantic models, and paginated reports
- Does **not** support Gen1 Power BI dataflows or datamarts
- Billed at 4 CUs/hour via Fabric capacity
- OAuth2 token auto-refresh is not supported (tokens expire after ~1 hour during long refreshes)
- User management: `fab acl ls/set .gateways/gw.Gateway` works for VNet gateways

---

The remainder of this document covers the **on-premises data gateway (standard mode) REST API**, which is the only gateway type with programmatic management support.

Gateway operations use `fab api -A powerbi` since there are no native `fab` gateway commands (except `fab acl` for permissions).

Syntax reference: `fab api [-A audience] [-X method] "endpoint" [-i body] [-q jmespath]`

---

## List and Get Gateways

List all gateways where the caller is an admin:

```bash
fab api -A powerbi "gateways"
```

Get a specific gateway by ID:

```bash
fab api -A powerbi "gateways/<gw-id>"
```

Extract the gateway public key (required for encrypting on-premises credentials):

```bash
fab api -A powerbi "gateways/<gw-id>" -q "publicKey"
```

### Gateway Object Properties

| Property | Type | Description |
|----------|------|-------------|
| id | uuid | Gateway ID (equals cluster ID for primary gateway) |
| name | string | Gateway name |
| type | string | Gateway type (e.g. `Resource`) |
| publicKey | object | RSA public key (exponent + modulus) for credential encryption |
| gatewayAnnotation | string | Metadata in JSON format |
| gatewayStatus | string | Connectivity status |

The `publicKey` is critical -- on-premises credentials must be encrypted using this RSA key before sending via API.

---

## Datasource Management

### List Datasources on a Gateway

```bash
fab api -A powerbi "gateways/<gw-id>/datasources"
```

### Get a Specific Datasource

```bash
fab api -A powerbi "gateways/<gw-id>/datasources/<ds-id>"
```

### Create a Datasource

```bash
fab api -A powerbi -X post "gateways/<gw-id>/datasources" -i '{
  "dataSourceType": "SQL",
  "connectionDetails": "{\"server\":\"MyServer\",\"database\":\"MyDatabase\"}",
  "datasourceName": "Sample Datasource",
  "credentialDetails": {
    "credentialType": "Windows",
    "credentials": "AB....EF==",
    "encryptedConnection": "Encrypted",
    "encryptionAlgorithm": "RSA-OAEP",
    "privacyLevel": "None"
  }
}'
```

Key constraints for creation:
- On-premises credentials must be encrypted with the gateway's RSA public key
- Set `encryptionAlgorithm` to `RSA-OAEP` for on-prem datasources, `None` for cloud
- OAuth2 credential type is not supported for datasource creation
- VNet and cloud gateways are not supported
- Server and database names cannot be changed after creation

### Update Datasource Credentials

```bash
fab api -A powerbi -X patch "gateways/<gw-id>/datasources/<ds-id>" -i '{
  "credentialDetails": {
    "credentialType": "Basic",
    "credentials": "{\"credentialData\":[{\"name\":\"username\",\"value\":\"john\"},{\"name\":\"password\",\"value\":\"*****\"}]}",
    "encryptedConnection": "Encrypted",
    "encryptionAlgorithm": "None",
    "privacyLevel": "None"
  }
}'
```

### Delete a Datasource

```bash
fab api -A powerbi -X delete "gateways/<gw-id>/datasources/<ds-id>"
```

### Check Datasource Connectivity Status

```bash
fab api -A powerbi "gateways/<gw-id>/datasources/<ds-id>/status"
```

Returns 200 OK on success. On failure, returns error codes such as `DM_GWPipeline_Client_GatewayUnreachable` (400).

### Datasource Object Properties

| Property | Type | Description |
|----------|------|-------------|
| id | uuid | Datasource ID |
| gatewayId | uuid | Associated gateway ID |
| datasourceType | string | Type: `Sql`, `AnalysisServices`, `Oracle`, etc. |
| datasourceName | string | Display name |
| connectionDetails | string | JSON connection info (server, database) |
| credentialType | enum | `Basic`, `Windows`, `Anonymous`, `OAuth2`, `Key`, `SAS` |
| credentialDetails | object | Credential metadata and flags |

### Supported Datasource Types

`ActiveDirectory`, `AnalysisServices`, `AzureBlobs`, `AzureDataLakeStorage`, `AzureTables`, `CustomConnector`, `DB2`, `Excel`, `Exchange`, `Extension`, `File`, `Folder`, `Hdfs`, `Informix`, `MySql`, `OData`, `ODBC`, `OleDb`, `Oracle`, `PostgreSql`, `PowerQueryMashup`, `Salesforce`, `SAPBW`, `SAPHana`, `SharePoint`, `SharePointDocLib`, `SharePointList`, `Sql`, `Sybase`, `Teradata`, `Web`

---

## Datasource User Management

### List Datasource Users

```bash
fab api -A powerbi "gateways/<gw-id>/datasources/<ds-id>/users"
```

Example response:

```json
{
  "value": [
    {
      "datasourceAccessRight": "Read",
      "displayName": "John Nick",
      "emailAddress": "john@contoso.com",
      "identifier": "john@contoso.com",
      "principalType": "User"
    },
    {
      "datasourceAccessRight": "ReadOverrideEffectiveIdentity",
      "displayName": "ContosoTestApp",
      "identifier": "3d9b93c6-7b6d-4801-a491-1738910904fd",
      "principalType": "App"
    }
  ]
}
```

### Add or Update a Datasource User

Add by email:

```bash
fab api -A powerbi -X post "gateways/<gw-id>/datasources/<ds-id>/users" -i '{
  "emailAddress": "john@contoso.com",
  "datasourceAccessRight": "Read"
}'
```

Add by service principal object ID:

```bash
fab api -A powerbi -X post "gateways/<gw-id>/datasources/<ds-id>/users" -i '{
  "identifier": "3d9b93c6-7b6d-4801-a491-1738910904fd",
  "datasourceAccessRight": "ReadOverrideEffectiveIdentity"
}'
```

### Remove a Datasource User

```bash
fab api -A powerbi -X delete "gateways/<gw-id>/datasources/<ds-id>/users/john@contoso.com"
```

### Native Alternative: fab acl

Gateway permissions can also be managed using native `fab acl` commands:

```bash
# List gateway permissions
fab acl ls .gateways/gw.Gateway

# Set gateway permissions
fab acl set .gateways/gw.Gateway -I <objectId> -R Admin
```

Use `fab acl` when managing gateway-level permissions. Use the REST API user endpoints when managing datasource-level user access within a gateway.

### Datasource Access Rights

| Value | Description |
|-------|-------------|
| None | No permission (use in updates to revoke access) |
| Read | Semantic models owned by the user have read access to the datasource |
| ReadOverrideEffectiveIdentity | Can override effective identity for PBI Embedded (on-prem AS only) |

### Principal Types

| Value | Description |
|-------|-------------|
| None | Whole organization level |
| User | User principal |
| Group | Group principal |
| App | Service principal |

**Note:** Adding groups through the API is not supported.

---

## Credential Types

All credential payloads follow a common structure within `credentialDetails`. For cloud datasources, set `encryptionAlgorithm` to `None`. For on-premises datasources, encrypt with the gateway RSA public key and set `encryptionAlgorithm` to `RSA-OAEP`.

### Basic (Cloud)

```json
{
  "credentialType": "Basic",
  "credentials": "{\"credentialData\":[{\"name\":\"username\",\"value\":\"john\"},{\"name\":\"password\",\"value\":\"*****\"}]}",
  "encryptedConnection": "Encrypted",
  "encryptionAlgorithm": "None",
  "privacyLevel": "None"
}
```

### Windows (On-Premises, Encrypted)

```json
{
  "credentialType": "Windows",
  "credentials": "AB....EF==",
  "encryptedConnection": "Encrypted",
  "encryptionAlgorithm": "RSA-OAEP",
  "privacyLevel": "None"
}
```

The `credentials` value is the RSA-OAEP encrypted string of the username/password payload.

### Anonymous

```json
{
  "credentialType": "Anonymous",
  "credentials": "{\"credentialData\":\"\"}",
  "encryptedConnection": "Encrypted",
  "encryptionAlgorithm": "None",
  "privacyLevel": "None"
}
```

### OAuth2

```json
{
  "credentialType": "OAuth2",
  "credentials": "{\"credentialData\":[{\"name\":\"accessToken\",\"value\":\"eyJ0....fwtQ\"}]}",
  "encryptedConnection": "Encrypted",
  "encryptionAlgorithm": "None",
  "privacyLevel": "None"
}
```

OAuth2 is only supported for updating existing datasources, not for creation. The access token has a short lifetime (~1 hour) and the refresh token is not incorporated.

### Key

```json
{
  "credentialType": "Key",
  "credentials": "{\"credentialData\":[{\"name\":\"key\",\"value\":\"ec....LA=\"}]}",
  "encryptedConnection": "Encrypted",
  "encryptionAlgorithm": "None",
  "privacyLevel": "None"
}
```

### SAS (Azure Blob Storage / Azure Data Lake Storage Only)

```json
{
  "credentialType": "SAS",
  "credentials": "{\"credentialData\":[{\"name\":\"token\",\"value\":\"sp=rl&st=...\"}]}",
  "encryptedConnection": "Encrypted",
  "encryptionAlgorithm": "None",
  "privacyLevel": "None"
}
```

SAS tokens are only valid for `AzureBlobStorage` and `AzureDataLakeStorage` datasource types.

### Credential Detail Flags

| Property | Type | Description |
|----------|------|-------------|
| useCallerAADIdentity | boolean | Use API caller's Entra ID for credentials. Mutually exclusive with `useEndUserOAuth2Credentials` |
| useEndUserOAuth2Credentials | boolean | Use end-user Entra ID for DirectQuery SSO. Mutually exclusive with `useCallerAADIdentity` |

### Privacy Levels

| Value | Description |
|-------|-------------|
| None | No privacy level set |
| Public | Public data |
| Organizational | Organizational data |
| Private | Private data |

Privacy levels set in Power BI Desktop are not honored by gateways.

### On-Premises Credential Encryption Flow

For on-premises datasources, credentials must be encrypted before sending:

1. Retrieve the gateway public key:

```bash
fab api -A powerbi "gateways/<gw-id>" -q "publicKey"
```

2. Encrypt credentials using RSA-OAEP with the returned exponent and modulus.
3. Send the encrypted string as the `credentials` field with `encryptionAlgorithm: "RSA-OAEP"`.

Microsoft provides encryption samples for .NET Core, Java, Python, and PowerShell in the [PowerBI-Developer-Samples](https://github.com/microsoft/PowerBI-Developer-Samples) repository.

---

## Semantic Model-Gateway Binding

The gateway-semantic model relationship is managed through the **Datasets API** (the REST API still uses "datasets" in endpoint paths), not the Gateways API. Use the `powerbi` audience for all calls.

### Discover Datasources for a Semantic Model

```bash
DS_ID=$(fab get "ws.Workspace/Model.SemanticModel" -q "id" | tr -d '"')
fab api -A powerbi "datasets/$DS_ID/datasources"
```

The response includes `gatewayId` and `datasourceId` for each datasource.

### Discover Compatible Gateways

```bash
fab api -A powerbi -X get "datasets/$DS_ID/Default.DiscoverGateways"
```

Returns gateways that can serve the semantic model's datasources.

### Bind a Semantic Model to a Gateway

```bash
fab api -A powerbi -X post "datasets/$DS_ID/Default.BindToGateway" -i '{
  "gatewayObjectId": "<gw-id>"
}'
```

### Full Credential Update Flow

The typical flow for updating semantic model credentials through a gateway:

1. Discover the semantic model's datasources to get `gatewayId` and `datasourceId`:

```bash
fab api -A powerbi "datasets/$DS_ID/datasources"
```

2. Get the gateway public key (for on-prem encryption):

```bash
fab api -A powerbi "gateways/<gw-id>" -q "publicKey"
```

3. Encrypt credentials with the RSA public key (using an external script or SDK).

4. Update the datasource credentials:

```bash
fab api -A powerbi -X patch "gateways/<gw-id>/datasources/<ds-id>" -i '{
  "credentialDetails": {
    "credentialType": "Windows",
    "credentials": "<encrypted-string>",
    "encryptedConnection": "Encrypted",
    "encryptionAlgorithm": "RSA-OAEP",
    "privacyLevel": "None"
  }
}'
```

For cloud datasources, the calling user must be the datasource owner. Transfer ownership using the semantic model TakeOver API if needed.

---

## Common Workflows

### Audit All Gateway Datasources and Their Users

```bash
# List gateways
fab api -A powerbi "gateways" -q "value[].{id:id, name:name}"

# For each gateway, list datasources
fab api -A powerbi "gateways/<gw-id>/datasources" -q "value[].{id:id, name:datasourceName, type:datasourceType}"

# For each datasource, list users
fab api -A powerbi "gateways/<gw-id>/datasources/<ds-id>/users" -q "value[].{name:displayName, right:datasourceAccessRight, type:principalType}"
```

### Verify Gateway Connectivity Before Refresh

```bash
# Check datasource status
fab api -A powerbi "gateways/<gw-id>/datasources/<ds-id>/status"
```

A 200 response confirms connectivity. Use this before triggering semantic model refreshes to catch gateway issues early.

### Rotate Datasource Credentials

```bash
# Update with new Basic credentials (cloud)
fab api -A powerbi -X patch "gateways/<gw-id>/datasources/<ds-id>" -i '{
  "credentialDetails": {
    "credentialType": "Basic",
    "credentials": "{\"credentialData\":[{\"name\":\"username\",\"value\":\"new-user\"},{\"name\":\"password\",\"value\":\"new-pass\"}]}",
    "encryptedConnection": "Encrypted",
    "encryptionAlgorithm": "None",
    "privacyLevel": "Organizational"
  }
}'
```

### Grant a Service Principal Access to a Datasource

```bash
fab api -A powerbi -X post "gateways/<gw-id>/datasources/<ds-id>/users" -i '{
  "identifier": "<service-principal-object-id>",
  "datasourceAccessRight": "Read",
  "principalType": "App"
}'
```

---

## Limitations

**REST API scope:**
- The Gateways REST API only supports **on-premises data gateways (standard mode)**
- **VNet gateways** -- no REST API; manage via Fabric portal or Power Platform admin center
- **Personal gateways** -- no REST API; no programmatic management at all
- The REST API does not support [gateway clusters](https://learn.microsoft.com/data-integration/gateway/service-gateway-high-availability-clusters) -- gateway ID in clusters refers to the primary (first) member

**Datasource operations:**
- Server and database names in a datasource cannot be changed after creation
- Adding groups through the datasource users API is not supported
- OAuth2 credential type is only supported for updating existing datasources, not creation
- OAuth2 refresh tokens are not incorporated (access tokens expire in ~1 hour during long refreshes)
- SAS tokens are restricted to `AzureBlobStorage` and `AzureDataLakeStorage` types
- For cloud datasources, the user must be datasource owner to update credentials

**General:**
- The caller must have gateway admin permissions for all operations
- Privacy levels set in Power BI Desktop are not honored by gateways
