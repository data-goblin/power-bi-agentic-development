---
title: Fabric connections credential types and OAuth2 limit
summary: Credential types the Create Connection API accepts, why OAuth2 needs the portal, and the fab paths for list, get, set and rm.
kind: gotcha
status: current
sources:
  - url: https://learn.microsoft.com/en-us/rest/api/fabric/core/connections
  - url: https://learn.microsoft.com/en-us/rest/api/fabric/core/connections/create-connection
  - url: https://learn.microsoft.com/en-us/fabric/data-factory/data-source-management
  - url: https://learn.microsoft.com/en-us/rest/api/fabric/core/connections/update-connection
  - url: https://learn.microsoft.com/en-us/fabric/security/workspace-identity-authenticate
  - url: https://microsoft.github.io/fabric-cli/commands/fs/set/
tools:
  fab: 1.9.0
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
skills: [fabric-cli/fabric-cli]
---

# Fabric connections credential types and OAuth2 limit

Learn: [Connections REST API](https://learn.microsoft.com/en-us/rest/api/fabric/core/connections), [Create Connection](https://learn.microsoft.com/en-us/rest/api/fabric/core/connections/create-connection), [Data source management](https://learn.microsoft.com/en-us/fabric/data-factory/data-source-management).

## fab paths

- `fab ls .connections -l` lists connections; on fab 1.7.0 some entries appeared as `<guid>.Connection`, so find the name or id in the long listing before you address one.
- `fab get ".connections/<Name>.Connection"` and `-q connectionDetails` read one; `fab set ".connections/<Name>.Connection" -q displayName -i "New Name"` renames. `fab set` accepts the properties the Update Connection API documents ([fab set](https://microsoft.github.io/fabric-cli/commands/fs/set/)), and that API takes `credentialDetails`, so `fab set -q credentialDetails` updates credentials ([Update Connection](https://learn.microsoft.com/en-us/rest/api/fabric/core/connections/update-connection)).
- `fab rm ".connections/<Name>.Connection" -f` deletes it permanently.
- `fab acl` works on connections: roles `Owner`, `User`, `UserWithReshare`; `fab acl set -I` takes an Entra objectId.
- Create with `fab mkdir ".connections/<Name>.Connection" -P connectionDetails.type=...,credentialDetails.type=...`. fab requires `connectionDetails.type`, `connectionDetails.parameters.*`, `credentialDetails.type` and the matching `credentialDetails.*` keys, and takes `gateway` or `gatewayId` for a gateway connection (checked in the 1.9.0 source). For a body that is easier to write as JSON, use `fab api -X post connections` with the body below. It needs scope `Connection.ReadWrite.All`; a service principal needs the tenant setting that lets it create connections.

## Credential types

```yaml
accepted by Create Connection (Learn definitions): Anonymous, Basic, Key, KeyPair, ServicePrincipal, SharedAccessSignature, Windows, WindowsWithoutImpersonation, WorkspaceIdentity
not accepted: OAuth2 (the create API defines no OAuth2 credential)
```

- OAuth2 needs interactive browser consent. Create it once in the portal and reference its id from automation, or use `WorkspaceIdentity` or `ServicePrincipal`.
- `WorkspaceIdentity` uses the workspace's managed identity: no secret, for Fabric data sources such as SQL endpoints and ADLS. Learn does not list the connectors; it points to the Fabric connector overview and says workspace identity is not supported for gateway connections ([workspace identity](https://learn.microsoft.com/en-us/fabric/security/workspace-identity-authenticate)).
- Windows credentials belong to on-premises gateway connections; the caller needs permission on the gateway.
- Update Connection accepts the same credential types as create, without OAuth2.

## Example: create a SQL connection with WorkspaceIdentity

```bash
fab api -X post connections -i '{"connectivityType": "ShareableCloud", "displayName": "LakehouseSql", "connectionDetails": {"type": "SQL", "creationMethod": "SQL", "parameters": [{"dataType": "Text", "name": "server", "value": "<endpoint>.datawarehouse.fabric.microsoft.com"}, {"dataType": "Text", "name": "database", "value": "<LakehouseName>"}]}, "privacyLevel": "Organizational", "credentialDetails": {"singleSignOnType": "None", "connectionEncryption": "Encrypted", "skipTestConnection": false, "credentials": {"credentialType": "WorkspaceIdentity"}}}'
```

For `Basic`, replace `credentials` with `{"credentialType": "Basic", "username": "<user>", "password": "<secret>"}`. For `ServicePrincipal` supply `servicePrincipalClientId`, `servicePrincipalSecret` and `tenantId`. Fetch secrets from 1Password at call time and never hardcode them.

The body follows the Create Connection example on Learn.
