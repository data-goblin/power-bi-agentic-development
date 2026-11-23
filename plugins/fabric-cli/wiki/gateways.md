---
title: Gateways with fab and the Power BI REST API
summary: Which gateway types REST and fab can manage, credential encryption, and how to rebind a semantic model or rotate datasource credentials.
kind: gotcha
status: current
sources:
  - url: https://learn.microsoft.com/en-us/rest/api/power-bi/gateways
  - url: https://learn.microsoft.com/en-us/rest/api/power-bi/datasets/bind-to-gateway
  - url: https://learn.microsoft.com/en-us/data-integration/vnet/overview
  - url: https://learn.microsoft.com/en-us/rest/api/power-bi/gateways/update-datasource
  - url: https://learn.microsoft.com/en-us/rest/api/power-bi/gateways/get-datasource-status
tools:
  fab: 1.7.0
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
skills: [fabric-cli/fabric-cli]
---

# Gateways with fab and the Power BI REST API

Learn: [Gateways REST API](https://learn.microsoft.com/en-us/rest/api/power-bi/gateways), [Datasets Bind To Gateway](https://learn.microsoft.com/en-us/rest/api/power-bi/datasets/bind-to-gateway), [VNet data gateway](https://learn.microsoft.com/en-us/data-integration/vnet/overview). Credential encryption samples: [PowerBI-Developer-Samples](https://github.com/microsoft/PowerBI-Developer-Samples).

fab has no gateway command except `fab acl`. Every datasource call goes through `fab api -A powerbi`.

## What can be managed

```yaml
on-premises standard mode: full Gateways REST API (datasources, users, status), plus Datasets Bind To Gateway
VNet gateway: no REST API; Fabric portal or Power Platform admin center; fab acl works for permissions
personal mode: no REST API at all; cannot be shared, no DirectQuery; migrate to standard mode or a VNet gateway
gateway cluster: REST has no cluster support; the gateway id is the primary (first) member
```

- `fab acl` on a gateway uses Entra objectIds with `-I`; roles are `Admin`, `ConnectionCreator`, `ConnectionCreatorWithResharing`. `fab acl rm` also accepts a UPN.
- VNet gateway: OAuth2 tokens are not refreshed, so a long refresh fails after about 1 hour; Power BI dataflows and datamarts are not supported.

## Datasource gotchas

- Create datasource: not for VNet or cloud gateways; server and database cannot change after creation.
- On-premises credentials must be RSA-OAEP encrypted with the gateway `publicKey` (`encryptionAlgorithm: RSA-OAEP`); cloud datasources use `encryptionAlgorithm: None`.
- OAuth2 works only when updating an existing datasource, never on create; the access token lives about 1 hour and the refresh token is not stored.
- `SAS` credentials are valid only for Azure Blob and ADLS datasources.
- `useCallerAADIdentity` and `useEndUserOAuth2Credentials` are mutually exclusive.
- Privacy levels set in Power BI Desktop are not honored by gateways.
- Add datasource user: groups are not supported; use `emailAddress` or a service principal object id in `identifier`.
- Bind To Gateway: the API caller must itself be a datasource user on the gateway. Without `datasourceObjectIds` the model binds to the first matching datasource.
- Cloud datasources: only the datasource owner can update credentials; use the semantic model TakeOver API first.
- All calls need gateway admin permission.

## Example: rebind a model and rotate Basic credentials

```bash
DS_ID=$(fab get "ws.Workspace/Model.SemanticModel" -q id)
fab api -A powerbi "datasets/$DS_ID/datasources" -q "text.value[].{gw:gatewayId, ds:datasourceId}"
fab api -A powerbi "datasets/$DS_ID/Default.DiscoverGateways" -q "text.value[].{id:id, name:name}"
fab api -A powerbi -X post "datasets/$DS_ID/Default.BindToGateway" -i '{"gatewayObjectId": "<gw-id>"}'
fab api -A powerbi -X patch "gateways/<gw-id>/datasources/<ds-id>" -i '{"credentialDetails": {"credentialType": "Basic", "credentials": "{\"credentialData\":[{\"name\":\"username\",\"value\":\"<user>\"},{\"name\":\"password\",\"value\":\"<secret>\"}]}", "encryptedConnection": "Encrypted", "encryptionAlgorithm": "None", "privacyLevel": "Organizational"}}'
```

Check connectivity before a refresh with `fab api -A powerbi "gateways/<gw-id>/datasources/<ds-id>/status" -q status_code`; a failure returns a code such as `DM_GWPipeline_Client_GatewayUnreachable` (400).

The request bodies follow the Learn samples for [Update Datasource](https://learn.microsoft.com/en-us/rest/api/power-bi/gateways/update-datasource), Bind To Gateway and [Get Datasource Status](https://learn.microsoft.com/en-us/rest/api/power-bi/gateways/get-datasource-status). Take the `<secret>` from `op read`, never hardcode it.
