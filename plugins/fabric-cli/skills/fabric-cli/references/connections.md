# Connections API

Programmatically create, update, list, and delete Fabric cloud connections.

## List Connections

```bash
fab ls .connections -l
```

Or via API:

```
GET https://api.fabric.microsoft.com/v1/connections
```

## Create Connection

```
POST https://api.fabric.microsoft.com/v1/connections
```

### With WorkspaceIdentity (no secrets needed)

```json
{
  "connectivityType": "ShareableCloud",
  "displayName": "MyLakehouseConnection",
  "connectionDetails": {
    "type": "SQL",
    "creationMethod": "SQL",
    "parameters": [
      {"dataType": "Text", "name": "server", "value": "<endpoint>.datawarehouse.fabric.microsoft.com"},
      {"dataType": "Text", "name": "database", "value": "<LakehouseName>"}
    ]
  },
  "privacyLevel": "Organizational",
  "credentialDetails": {
    "singleSignOnType": "None",
    "connectionEncryption": "Encrypted",
    "skipTestConnection": false,
    "credentials": {
      "credentialType": "WorkspaceIdentity"
    }
  }
}
```

WorkspaceIdentity uses the workspace's managed service principal. No passwords, secrets, or OAuth consent. Supported for Fabric data sources (SQL, ADLS connectors).

### With Basic Auth

```json
{
  "connectivityType": "ShareableCloud",
  "displayName": "MyConnection",
  "connectionDetails": {
    "type": "SQL",
    "creationMethod": "SQL",
    "parameters": [
      {"dataType": "Text", "name": "server", "value": "myserver.database.windows.net"},
      {"dataType": "Text", "name": "database", "value": "mydb"}
    ]
  },
  "privacyLevel": "Organizational",
  "credentialDetails": {
    "singleSignOnType": "None",
    "connectionEncryption": "NotEncrypted",
    "skipTestConnection": false,
    "credentials": {
      "credentialType": "Basic",
      "username": "admin",
      "password": "********"
    }
  }
}
```

### With Service Principal

```json
{
  "credentialDetails": {
    "credentials": {
      "credentialType": "ServicePrincipal",
      "servicePrincipalClientId": "<client-id>",
      "servicePrincipalSecret": "<secret>",
      "tenantId": "<tenant-id>"
    }
  }
}
```

## Supported Credential Types

| Type | API Support | Notes |
|------|------------|-------|
| WorkspaceIdentity | Yes | No secrets; uses workspace managed identity |
| Basic | Yes | Username + password |
| ServicePrincipal | Yes | Client ID + secret + tenant |
| Key | Yes | API key or account key |
| SharedAccessSignature | Yes | SAS token |
| Anonymous | Yes | No credentials |
| OAuth2 | **No** | Requires browser consent; cannot be created via API |
| Windows | No | On-premises gateway only |

## Update Connection

```
PATCH https://api.fabric.microsoft.com/v1/connections/{connectionId}
```

Update display name or credential details. Cannot change credential type (e.g. OAuth2 to WorkspaceIdentity).

## Delete Connection

```
DELETE https://api.fabric.microsoft.com/v1/connections/{connectionId}
```

## Get Connection Details

```bash
fab get .connections/<ConnectionName>.Connection
fab get .connections/<ConnectionName>.Connection -q "connectionDetails"
```

## Key Limitation: OAuth2 Connections

OAuth2 connections **cannot be created or refreshed via API**. They require an interactive browser OAuth consent flow. This affects:

- Dataflow `executeQuery` API: needs OAuth-authenticated connections for data source access
- Semantic model refresh: needs OAuth connections for cloud data sources

**Workarounds:**
- Use `WorkspaceIdentity` or `ServicePrincipal` credential types instead of OAuth2
- For OAuth2: create the connection once in the portal, then reference it by ID in automation
- Use `fab` CLI connections management: `fab ls .connections`, `fab get .connections/Name.Connection`

## Microsoft Documentation

- [Create Connection API](https://learn.microsoft.com/en-us/rest/api/fabric/core/connections/create-connection)
- [Update Connection API](https://learn.microsoft.com/en-us/rest/api/fabric/core/connections/update-connection)
- [List Connections API](https://learn.microsoft.com/en-us/rest/api/fabric/core/connections/list-connections)
- [Data Source Management](https://learn.microsoft.com/en-us/fabric/data-factory/data-source-management)
